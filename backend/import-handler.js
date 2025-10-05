// import-handler.js - Import handler avec support MoneyGram, RIA, Western Union, Global
// Version: 2.0 - Fix parsing montants avec virgules
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
    const secondRow = worksheet.getRow(2).getCell(1).value;
    const fourthRow = worksheet.getRow(4).getCell(1).value;
    const row16 = worksheet.getRow(16).getCell(1).value;

    // MoneyGram paiement détaillé
    if (firstRow && firstRow.toString().includes('Rapport de Transaction Journalier')) {
      return 'MONEYGRAM_DETAIL';
    }

    // MoneyGram envois
    if (secondRow && secondRow.toString().includes('Rapport détaillé des transactions MoneyGram')) {
      return 'MONEYGRAM_ENVOIS';
    }

    // Résumés
    if (firstRow && firstRow.toString().includes('Résumé des transactions')) {
      if (firstRow.toString().includes('MoneyGram')) return 'MONEYGRAM_SUMMARY';
      if (firstRow.toString().includes('Ria')) return 'RIA_SUMMARY';
      if (firstRow.toString().includes('Global')) return 'GLOBAL_SUMMARY';
    }

    // RIA détaillé (format sans en-têtes, commence directement avec les dates)
    if (firstRow instanceof Date && worksheet.getRow(1).getCell(3).value) {
      const pin = worksheet.getRow(1).getCell(3).value;
      if (pin && pin.toString().length >= 10) {
        return 'RIA_DETAIL';
      }
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

        // Parser les montants (supprimer les virgules de formatage)
        const parseMontant = (val) => {
          if (!val) return 0;
          const str = val.toString().replace(/,/g, ''); // Enlever les virgules
          return Math.abs(parseFloat(str) || 0);
        };

        transactions.push({
          numero: parseInt(numRef) || 0,
          codeEnvoi: mtcn.toString().trim(),
          partenaire: 'MONEYGRAM',
          montant: parseMontant(montant),
          commission: parseMontant(commission),
          taxe: parseMontant(taxe),
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
   * Parse fichier RIA détaillé (format sans en-têtes)
   */
  async parseRiaDetail(filePath) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.worksheets[0];

    const transactions = [];

    // Helper pour parser les montants avec format KMF
    const parseMontantKMF = (val) => {
      if (!val) return 0;
      // Format: "49 200,00 KMF" ou "17 761,20 KMF"
      const str = val.toString().replace(/KMF/g, '').replace(/\s/g, '').replace(/,/g, '.');
      return Math.abs(parseFloat(str) || 0);
    };

    worksheet.eachRow((row, rowNumber) => {
      const dateCreation = row.getCell(1).value;
      const datePaiement = row.getCell(2).value;
      const pin = row.getCell(3).value;
      const agent = row.getCell(4).value;
      const expediteur = row.getCell(5).value;
      const beneficiaire = row.getCell(6).value;
      const codeTransaction = row.getCell(7).value;
      const montantSource = row.getCell(8).value;
      const deviseSource = row.getCell(9).value;
      const montantPaye = row.getCell(10).value;

      // Vérifier que c'est une ligne de données valide
      if (!pin || !datePaiement || !(datePaiement instanceof Date)) return;

      transactions.push({
        numero: parseInt(codeTransaction) || 0,
        codeEnvoi: pin.toString().trim(),
        partenaire: 'RIA',
        montant: parseMontantKMF(montantPaye),
        commission: 0, // Pas de commission dans ce format
        taxe: 0,
        effectuePar: (agent ? agent.toString() : 'INCONNU').substring(0, 50),
        dateOperation: datePaiement,
        beneficiaire: (beneficiaire ? beneficiaire.toString() : '').substring(0, 250),
        expediteur: (expediteur ? expediteur.toString() : '').substring(0, 250),
        codeAgence: '001', // Par défaut, sera déterminé par le système multi-agences
        typeOperation: 'PAIEMENT'
      });
    });

    return {
      type: 'RIA_DETAIL',
      transactions,
      count: transactions.length
    };
  }

  /**
   * Parse fichier MoneyGram Envois
   */
  async parseMoneygramEnvois(filePath) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.worksheets[0];

    const transactions = [];
    let currentAgence = null;

    worksheet.eachRow((row, rowNumber) => {
      const col1 = row.getCell(1).value;
      const col2 = row.getCell(2).value;

      // Détecter l'agence (ligne contenant le nom de l'agence avec son ID)
      if (col1 && col1.toString().includes('MCTV') && col1.toString().includes('(')) {
        const agenceMatch = col1.toString().match(/\((\d+)\)/);
        if (agenceMatch) {
          currentAgence = agenceMatch[1].substring(0, 3); // Garder les 3 premiers chiffres comme code agence
        }
      }

      // Ligne de données: commence par une date au format "2025-Apr-29 17:45:59"
      if (col1 && col1.toString().match(/\d{4}-[A-Za-z]{3}-\d{2}\s+\d{2}:\d{2}:\d{2}/)) {
        const dateStr = col1.toString();
        const numRef = row.getCell(2).value;
        const userId = row.getCell(4).value;
        const montant = row.getCell(6).value;
        const frais = row.getCell(7).value;

        // Parser la date
        const date = new Date(dateStr.replace(/-([A-Za-z]{3})-/, (m, month) => {
          const months = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
          return `-${String(months[month]+1).padStart(2,'0')}-`;
        }));

        if (numRef && montant) {
          transactions.push({
            numero: parseInt(numRef) || 0,
            codeEnvoi: numRef.toString().trim(),
            partenaire: 'MONEYGRAM',
            montant: Math.abs(parseFloat(montant) || 0),
            commission: Math.abs(parseFloat(frais) || 0),
            taxe: 0,
            effectuePar: (userId ? userId.toString() : 'INCONNU').substring(0, 50),
            dateOperation: date,
            beneficiaire: '',
            expediteur: '',
            codeAgence: currentAgence || '001',
            typeOperation: 'ENVOI'
          });
        }
      }
    });

    return {
      type: 'MONEYGRAM_ENVOIS',
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

      case 'RIA_DETAIL':
        return await this.parseRiaDetail(filePath);

      case 'MONEYGRAM_ENVOIS':
        return await this.parseMoneygramEnvois(filePath);

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

    // Calculer le montant total du fichier (toutes transactions confondues)
    const totalAmountFile = transactions.reduce((sum, t) => sum + (t.montant || 0), 0);

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
      totalAmount: totalAmountFile,  // Total du fichier (incluant doublons)
      totalAmountImported: totalAmount, // Total réellement importé en DB
      agentsUnifies: 0,
      errorDetails
    };
  }
}

module.exports = { ImportHandler, upload };
