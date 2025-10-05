// import-handler-new.js - Import handler avec support MoneyGram, RIA, Western Union, Global
const ExcelJS = require('exceljs');
const Papa = require('papaparse');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const sql = require('mssql');

// Configuration Multer
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || 'uploads';
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    const allowedExts = ['.xlsx', '.xls', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non supporté'));
    }
  }
});

class ImportHandler {
  constructor(pool) {
    this.pool = pool;
  }

  async initialize() {
    console.log('✅ ImportHandler initialisé');
  }

  /**
   * Détecte le type de fichier
   */
  async detectFileType(filePath) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.worksheets[0];

    // Lire les premières lignes
    const firstRow = worksheet.getRow(1).getCell(1).value;
    const fourthRow = worksheet.getRow(4).getCell(1).value;

    if (firstRow && firstRow.toString().includes('Rapport de Transaction Journalier')) {
      return 'MONEYGRAM_DETAIL';
    }

    if (firstRow && firstRow.toString().includes('Résumé des transactions')) {
      if (firstRow.toString().includes('MoneyGram')) return 'MONEYGRAM_SUMMARY';
      if (firstRow.toString().includes('Ria')) return 'RIA_SUMMARY';
      if (firstRow.toString().includes('Global')) return 'GLOBAL_SUMMARY';
    }

    return 'UNKNOWN';
  }

  /**
   * Parse fichier MoneyGram détaillé
   */
  async parseMoneygramDetail(filePath) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.worksheets[0];

    const transactions = [];
    let currentAgence = null;
    let currentGuichetier = null;

    worksheet.eachRow((row, rowNumber) => {
      const col1 = row.getCell(1).value;

      // Détecter succursale et guichetier
      if (col1 && col1.toString().includes('Succursale:')) {
        const text = col1.toString();
        const agenceMatch = text.match(/Succursale:.*?\((\d+)\)/);
        const guichetierMatch = text.match(/Guichetier:\s+([A-Z\s]+)/);

        if (agenceMatch) currentAgence = agenceMatch[1];
        if (guichetierMatch) currentGuichetier = guichetierMatch[1].trim();
      }

      // Ligne 15+ = données
      if (rowNumber >= 15) {
        const mtcn = row.getCell(1).value;
        const datePaiement = row.getCell(2).value;
        const beneficiaire = row.getCell(3).value;
        const numRef = row.getCell(4).value;
        const devise = row.getCell(5).value;
        const montant = row.getCell(6).value;
        const taxe = row.getCell(7).value;
        const commission = row.getCell(9).value;

        if (!mtcn || !datePaiement) return;
        if (mtcn.toString().toLowerCase().includes('total')) return;

        // Parser date
        let parsedDate;
        if (datePaiement instanceof Date) {
          parsedDate = datePaiement;
        } else {
          const dateStr = datePaiement.toString();
          const parts = dateStr.match(/(\d+)\/(\d+)\/(\d+)\s+(\d+):(\d+):(\d+)/);
          if (parts) {
            parsedDate = new Date(parts[3], parts[2] - 1, parts[1], parts[4], parts[5], parts[6]);
          } else {
            parsedDate = new Date();
          }
        }

        transactions.push({
          numero: parseInt(numRef) || 0,
          codeEnvoi: mtcn.toString().trim(),
          partenaire: 'MONEYGRAM',
          montant: Math.abs(parseFloat(montant) || 0),
          commission: parseFloat(commission) || 0,
          taxe: parseFloat(taxe) || 0,
          effectuePar: (currentGuichetier || 'INCONNU').substring(0, 50),
          dateOperation: parsedDate,
          beneficiaire: (beneficiaire ? beneficiaire.toString() : '').substring(0, 250),
          expediteur: '',
          codeAgence: currentAgence || '001',
          typeOperation: 'PAIEMENT'
        });
      }
    });

    return {
      type: 'MONEYGRAM_DETAIL',
      transactions,
      count: transactions.length
    };
  }

  /**
   * Parse un fichier selon son type
   */
  async parseFile(filePath) {
    const fileType = await this.detectFileType(filePath);
    console.log(`📊 Type détecté: ${fileType}`);

    switch (fileType) {
      case 'MONEYGRAM_DETAIL':
        return await this.parseMoneygramDetail(filePath);

      case 'MONEYGRAM_SUMMARY':
      case 'RIA_SUMMARY':
      case 'GLOBAL_SUMMARY':
        throw new Error('Les fichiers de résumé ne contiennent pas de transactions individuelles');

      default:
        throw new Error('Format de fichier non reconnu');
    }
  }

  /**
   * Importe les transactions dans la base
   */
  async importTransactions(transactions, agenceId, userId) {
    let success = 0;
    let duplicates = 0;
    let errors = 0;
    let totalAmount = 0;
    const errorDetails = [];

    console.log(`\\n💾 Import de ${transactions.length} transactions...`);

    for (const trans of transactions) {
      try {
        // Vérifier doublon par CODEENVOI
        const existing = await this.pool.request()
          .input('codeEnvoi', sql.VarChar, trans.codeEnvoi)
          .query('SELECT NUMERO FROM INFOSTRANSFERTPARTENAIRES WHERE CODEENVOI = @codeEnvoi');

        if (existing.recordset.length > 0) {
          duplicates++;
          continue;
        }

        // Vérifier doublon par NUMERO (clé primaire)
        const existingNum = await this.pool.request()
          .input('numero', sql.Int, trans.numero)
          .query('SELECT NUMERO FROM INFOSTRANSFERTPARTENAIRES WHERE NUMERO = @numero');

        if (existingNum.recordset.length > 0) {
          duplicates++;
          continue;
        }

        // Insérer la transaction
        await this.pool.request()
          .input('numero', sql.Int, trans.numero)
          .input('codeEnvoi', sql.VarChar, trans.codeEnvoi)
          .input('partenaire', sql.VarChar, trans.partenaire)
          .input('montant', sql.Decimal(18, 2), trans.montant)
          .input('commission', sql.Decimal(18, 2), trans.commission)
          .input('taxes', sql.Decimal(18, 2), trans.taxe)
          .input('effectuePar', sql.VarChar, trans.effectuePar)
          .input('dateOperation', sql.DateTime, trans.dateOperation)
          .input('beneficiaire', sql.VarChar, trans.beneficiaire)
          .input('expediteur', sql.VarChar, trans.expediteur || '')
          .input('codeAgence', sql.VarChar, trans.codeAgence || agenceId)
          .input('typeOp', sql.VarChar, trans.typeOperation)
          .input('montantTotal', sql.Decimal(18, 2), trans.montant + trans.taxe)
          .query(`
            INSERT INTO INFOSTRANSFERTPARTENAIRES
            (NUMERO, CODEENVOI, PARTENAIRETRANSF, MONTANT, COMMISSION, TAXES,
             EFFECTUEPAR, DATEOPERATION, NOMPRENOMBENEFICIAIRE, NOMPRENOMEXPEDITEUR,
             CODEAGENCE, TYPEOPERATION, MONTANTTOTAL, date_creation)
            VALUES
            (@numero, @codeEnvoi, @partenaire, @montant, @commission, @taxes,
             @effectuePar, @dateOperation, @beneficiaire, @expediteur,
             @codeAgence, @typeOp, @montantTotal, GETDATE())
          `);

        success++;
        totalAmount += trans.montant || 0;

        if (success % 100 === 0) {
          console.log(`   ✓ ${success} transactions importées...`);
        }

      } catch (error) {
        errors++;
        if (errorDetails.length < 10) {
          errorDetails.push({
            transaction: trans.codeEnvoi,
            error: error.message
          });
        }
      }
    }

    return {
      success,
      duplicates,
      errors,
      totalAmount,
      agentsUnifies: 0,
      errorDetails
    };
  }
}

module.exports = { ImportHandler, upload };
