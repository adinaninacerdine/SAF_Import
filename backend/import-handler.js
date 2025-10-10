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
  constructor(pool, agentService = null) {
    this.pool = pool;
    this.agentService = agentService;
  }

  async initialize() {
    console.log('✅ ImportHandler initialisé');
  }

  /**
   * Importe les transactions dans la table temporaire pour validation
   */
  async importToStaging(transactions, agenceId, userId, importSessionId) {
    let success = 0;
    let duplicates = 0;
    let errors = 0;
    let totalAmount = 0;
    const errorDetails = [];

    // Calculer le montant total du fichier
    const totalAmountFile = transactions.reduce((sum, t) => sum + (t.montant || 0), 0);

    console.log(`\n💾 Import vers table temporaire: ${transactions.length} transactions...`);

    for (const trans of transactions) {
      try {
        // 1. Obtenir ou créer l'agent unifié
        let agentUniqueId = null;
        if (this.agentService && trans.effectuePar) {
          try {
            agentUniqueId = await this.agentService.getOrCreateAgent(
              trans.effectuePar,
              trans.effectuePar,
              trans.codeAgence || agenceId
            );
          } catch (err) {
            console.warn(`⚠️ Erreur déduplication agent ${trans.effectuePar}:`, err.message);
          }
        }

        // 2. Vérifier doublon dans la table principale avec clé composite
        // Clé: CODEENVOI + PARTENAIRE + DATE OPERATION
        // Permet d'importer les annulations (même code, date différente)
        const existing = await this.pool.request()
          .input('codeEnvoi', sql.VarChar, trans.codeEnvoi)
          .input('partenaire', sql.VarChar, trans.partenaire)
          .input('dateOperation', sql.DateTime, trans.dateOperation)
          .query(`
            SELECT NUMERO
            FROM INFOSTRANSFERTPARTENAIRES
            WHERE CODEENVOI = @codeEnvoi
              AND PARTENAIRETRANSF = @partenaire
              AND DATEOPERATION = @dateOperation
          `);

        if (existing.recordset.length > 0) {
          duplicates++;
          continue;
        }

        // 3. Insérer dans la table temporaire
        await this.pool.request()
          .input('sessionId', sql.VarChar, importSessionId)
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
          .input('agentUniqueId', sql.Int, agentUniqueId)
          .input('userId', sql.VarChar, userId)
          .query(`
            INSERT INTO temp_INFOSTRANSFERTPARTENAIRES
            (import_session_id, NUMERO, CODEENVOI, PARTENAIRETRANSF, MONTANT, COMMISSION, TAXES,
             EFFECTUEPAR, DATEOPERATION, NOMPRENOMBENEFICIAIRE, NOMPRENOMEXPEDITEUR,
             CODEAGENCE, TYPEOPERATION, MONTANTTOTAL, AGENT_UNIQUE_ID,
             import_user_id, import_date, statut_validation)
            VALUES
            (@sessionId, @numero, @codeEnvoi, @partenaire, @montant, @commission, @taxes,
             @effectuePar, @dateOperation, @beneficiaire, @expediteur,
             @codeAgence, @typeOp, @montantTotal, @agentUniqueId,
             @userId, GETDATE(), 'EN_ATTENTE')
          `);

        success++;
        totalAmount += trans.montant || 0;

        if (success % 100 === 0) {
          console.log(`   ✓ ${success} transactions en attente de validation...`);
        }

      } catch (error) {
        errors++;
        if (errorDetails.length < 10) {
          errorDetails.push({
            transaction: trans.codeEnvoi,
            error: error.message
          });
          // LOG DÉTAILLÉ POUR DEBUGGING
          console.error(`❌ Erreur insertion ${trans.codeEnvoi}:`, error.message);
        }
      }
    }

    return {
      success,
      duplicates,
      errors,
      totalAmount: totalAmountFile,
      totalAmountImported: totalAmount,
      agentsUnifies: 0,
      errorDetails,
      importSessionId
    };
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

    // Western Union - Rechercher "Commission par direction" dans les 5 premières lignes
    for (let i = 1; i <= 5; i++) {
      const cellValue = worksheet.getRow(i).getCell(1).value;
      if (cellValue && cellValue.toString().includes('Commission par direction')) {
        return 'WESTERN_UNION';
      }
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

        // Filtrer les en-têtes répétés
        const mtcnStr = mtcn.toString().trim();
        if (mtcnStr === '' || mtcnStr === 'Numéro du transfert') return;

        // Filtrer les lignes de résumé "Succursale: ..."
        if (mtcnStr.includes('Succursale:')) return;

        // Filtrer les lignes avec bénéficiaire vide ou en-tête
        const beneficiaireStr = beneficiaire ? beneficiaire.toString().trim() : '';
        if (beneficiaireStr === '' || beneficiaireStr === 'Client' || beneficiaireStr === 'Bénéficiaire') return;

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

        const montantParsed = parseMontant(montant);

        // Exclure les transactions avec montant = 0 (lignes vides/résumés)
        if (montantParsed === 0) return;

        transactions.push({
          numero: parseInt(numRef) || 0,
          codeEnvoi: mtcn.toString().trim(),
          partenaire: 'MONEYGRAM',
          montant: montantParsed,
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
   * Parse fichier Western Union (Commission par direction)
   */
  async parseWesternUnion(filePath) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.worksheets[0];

    const transactions = [];
    let currentSite = null;
    let currentSiteCode = null;
    let isTransfertEnvoye = false; // Mode envoyé vs reçu

    const parseMontantKMF = (val) => {
      if (!val) return 0;
      const str = val.toString().replace(/\s/g, '').replace(/,/g, '.');
      return Math.abs(parseFloat(str) || 0);
    };

    const parseDate = (val) => {
      if (!val) return new Date();
      if (val instanceof Date) return val;

      // Format DD/MM/YYYY
      const match = val.toString().match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (match) {
        return new Date(match[3], match[2] - 1, match[1]);
      }
      return new Date();
    };

    worksheet.eachRow((row, rowNumber) => {
      const col1 = row.getCell(1).value;
      const col1Str = col1 ? col1.toString() : '';

      // Détecter le type de transfert
      if (col1Str.includes('Transferts envoyés')) {
        isTransfertEnvoye = true;
      } else if (col1Str.includes('Transferts reçus')) {
        isTransfertEnvoye = false;
      }

      // Détecter le site (agence)
      if (col1Str.includes('Site:') && col1Str.includes('(AHO')) {
        const siteMatch = col1Str.match(/Site:\s+([^(]+)\s+\((\w+)\)/);
        if (siteMatch) {
          currentSite = siteMatch[1].trim();
          currentSiteCode = siteMatch[2].trim(); // Ex: AHO060077

          // Extraire les derniers chiffres comme code agence (ex: 077)
          const agenceMatch = currentSiteCode.match(/(\d{3,4})$/);
          if (agenceMatch) {
            currentSiteCode = agenceMatch[1].substring(0, 3);
          }
        }
      }

      // Lignes de transactions: commence par une date DD/MM/YYYY
      const dateMatch = col1Str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
      if (dateMatch && currentSite) {
        const dateEnvoye = parseDate(col1Str);

        // Chercher MTCN (10 chiffres consécutifs)
        let mtcnValue = null;
        for (let colIdx = 1; colIdx <= 5; colIdx++) {
          const cellVal = row.getCell(colIdx).value;
          if (cellVal && typeof cellVal === 'number' && /^\d{10}$/.test(cellVal.toString())) {
            mtcnValue = cellVal.toString();
            break;
          }
        }

        if (!mtcnValue) return; // Pas de MTCN trouvé

        // Chercher les montants en KMF (colonnes avec montant > 1000, SAUF le MTCN)
        let montantKMF = 0;
        let commissionKMF = 0;

        for (let colIdx = 1; colIdx <= 15; colIdx++) {
          const cellVal = row.getCell(colIdx).value;
          // Exclure le MTCN de la recherche de montants
          if (cellVal && typeof cellVal === 'number' && cellVal > 1000 && cellVal.toString() !== mtcnValue) {
            if (montantKMF === 0) {
              montantKMF = cellVal; // Premier montant > 1000 = montant principal
            } else if (commissionKMF === 0 && cellVal < montantKMF) {
              commissionKMF = cellVal; // Montant plus petit = commission
            }
          }
        }

        // Chercher le pays (TURQUIE, FRANCE, MAROC, etc.)
        let pays = '';
        for (let colIdx = 1; colIdx <= 10; colIdx++) {
          const cellVal = row.getCell(colIdx).value;
          if (cellVal) {
            const str = cellVal.toString().toUpperCase();
            if (['FRANCE', 'TURQUIE', 'MAROC', 'SENEGAL', 'MADAGASCAR', 'CAMEROUN',
                 'NIGER', 'TUNISIE', 'OUGANDA', 'BURKINA FASO', 'ETATS UNIS'].includes(str)) {
              pays = str;
              break;
            }
          }
        }

        if (montantKMF > 0) {
          transactions.push({
            numero: 0, // Sera généré automatiquement
            codeEnvoi: mtcnValue,
            partenaire: 'WESTERN_UNION',
            montant: montantKMF,
            commission: commissionKMF,
            taxe: 0,
            effectuePar: currentSite.substring(0, 50), // Nom du site comme agent
            dateOperation: dateEnvoye,
            beneficiaire: pays || '', // Pays de destination
            expediteur: '',
            codeAgence: currentSiteCode || '001',
            typeOperation: isTransfertEnvoye ? 'ENVOI' : 'PAIEMENT'
          });
        }
      }
    });

    return {
      type: 'WESTERN_UNION',
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

      case 'WESTERN_UNION':
        return await this.parseWesternUnion(filePath);

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
