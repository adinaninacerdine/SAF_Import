// import-handler.js - Import handler avec support MoneyGram, RIA, Western Union, Global
// Version: 2.1 - Fix extraction codes agence MoneyGram (mapping par nom au lieu de téléphone)
const ExcelJS = require('exceljs');
const Papa = require('papaparse');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const sql = require('mssql');

// Mapping des noms d'agence → codes (extrait de PART_NOM_AGENCES)
// Les noms dans les fichiers MoneyGram peuvent contenir des téléphones entre parenthèses
// Il faut matcher sur le nom AVANT les parenthèses
const AGENCY_NAME_TO_CODE = {
  // Agences principales (0XX)
  'MCTV - ANJOUAN': '002',
  'MCTV MUTSAMUDOU': '002',
  'MCTV - CALTEX': '005',
  'MCTV CALTEX': '005',
  'MCTV - PHILIPS': '004',
  'MCTV - PHILLIPS': '004',
  'MCTV PHILIPS': '004',
  'MCTV - DZAHANI 2': '006',
  'MCTV DZAHANI 2': '006',
  'MCTV - IVEMBENI': '007',
  'MCTV IVEMBENI': '007',
  'MCTV.IVEMBENI': '007',
  'MCTV - OASIS': '008',
  'MCTV OASIS': '008',
  'MCTV-OAZIS': '008',
  'MCTV - MANDZA': '009',
  'MCTV MANDZA': '009',
  'MCTV-MANDZA': '009',
  'MCTV - CORNICHE': '010',
  'MCTV CORNICHE': '010',
  'MCTV - MCTV-CORNICHE': '010',
  'MCTV-CORNICHE': '010',
  'MCTV - MANGANI': '001',
  'MCTV MANGANI': '001',
  'MCTV - MCTV-MANGANI': '001',
  'MCTV-MANGANI': '001',
  'MCTV - MITSAMIHOULI': '013',
  'MCTV - MCTV-MITSAMIOULI': '013',
  'MCTV MITSAMIHOULI': '013',
  'MCTV-MITSAMIOULI': '013',
  'MKAZI': '011',
  'MCTV MKAZI': '011',
  'MCTV-MKAZI': '011',
  'MCTV - GARD DU NORD': '012',
  'MCTV GARD DU NORD': '012',
  'MCTV-GARD DU NORD': '012',

  // Sous-agences (1XX)
  'CJAP': '106',
  'CARREFOUR DES JEUNES AUTO PROMOTEURS': '106',
  'CJAP - MCTV': '106',
  'COOPERATIVE HAMNAMALEVU.SCOOPS': '103',
  'FDN.SARL': '105',
  'FEDERATION POUR LE DEVELOPPEMENT DE NVOUNAMBADANI': '105',
  'MALEZI SAFARI SARLU': '108',
  'MALEZI ZAFARI SARLU': '108',
  'MALEZI SAFARI SARLU - MCTV': '108',
  'ZUNGUDJU.COOP-CA': '107',
  'ZUNGUDJU.COOP-CA - MCTV': '107',
  'MCTV - KARTHALA': '110',
  'MOUNTAZ MAHAL': '110',
  'MSR.SARL': '111',
  'MORONI SERVICES  RAPIDE SARL': '111',
  'MSR.SARL - MCTV': '111',
  'H.CON SARL': '112',
  'MAISON FRANCE CHEZ SALIM SARLU': '112',
  'H.CON SARL - MCTV': '112',
  'MAGASIN RASMIA': '113',
  'COMOROS ENTREPRENEURSHIP CORPORATION': '114',
  'COMORES ENTREPREUNEURSHIP CORPORATION': '114',
  'COMOROS ENTREPRENEURSHIP CORPORATION(CEN': '114',
  'MOIFAKA MULTI-SECTORIELLES.SARL': '118',
  'AMCO': '120',
  'AMCO - MCTV': '120',
  'DAHALANI GENERATION.SARL': '121',
  'DAHALANI GENERATION.SARL - MCTV': '121',
  'TWAMAYA YA NGOENGWE.SARL': '122',
  'TWAMAYA YA NGOENGWE.SARL - MCTV': '122',
  'MULTI SERVICES-D-3I.SARL': '124',
  'MULTI SERVICES-D-3I.SARL - MCTV': '124',
  'MWANGAZA PRODUIT.SARLU': '125',
  'MWANGAZA PRODUIT.SARLU - MCTV': '125',
  'COMORIAN FINANCE CONSUL SARLU': '126',
  'COMORIAN FINANCE CONSULT SARLU': '126',
  'COMORIAN FINANCE CONSUL SARLU - MCTV': '126',
  'LE BON PRIX.SARL': '127',
  'AGS SERVICES SARL': '129',
  'REHMA SHOP.SARL': '130',
  'MYNET.SARLU': '132',
  'QDK': '133',
  'COMORES FERTILIZERS.SARL': '134',
  'MLEKEZO MALEZI.SARL': '136',
  'MLEKEZO MALEZI.SARL - MCTV': '136',
  'ETABLISSEMENT MARIA ABDOU FILS.SARLU': '137',
  'ETABLISSEMENT MARIA ABDOU FILS.SARLU - M': '137',
  'LA CENTRALE MULTI SERVICES.SARL': '140',
  'MERVEILLE MAGASIN': '141',
  'MERVEILLE MAGASIN - MCTV': '141',
  'FAIT TOUT BIEN SARL': '142',
  'FAIT TOUT BIEN.SARL': '142',
  'FAIT TOUT BIEN SARL - MCTV': '142',
  'MAGASIN FARES': '143',
  'BEN MULTISERVICE SARL': '144',
  'BEN MULTISERVICE SARL - MCTV': '144',
  'SOCIETE DE TOURISME DE SERVICE ET D\'INVE': '145',
  'SOCIETE DE TOURISME DE SERVICE ET D\'INVESTISSEMENT': '145',
  'AMANI AGENCE IMMOBILIER SARL': '146',
  'AMANI AGENCE IMMOBILIER SARL - MCTV': '146',
  'MAGASIN DJANATHANE': '147',
  'MAGASIN DJANATHANE - MCTV': '147',
  'YVANIG SARLU': '148',
  'YVANIC SARLU': '148',
  'YVANIG SARLU - MCTV': '148',
  'ZAINABA ABDALLAH': '149',
  'ZAINABA ABDALLAH - MCTV': '149',
  'NOUDJOUM SERVICE.SARL': '150',
  'NOUDJOUM SERVICES.SARL': '150',
  'NOUDJOUM SERVICE.SARL - MCTV': '150',
  'EDGY AGRO.SARL': '151',
  'AMIN MULTI-SERVICES': '152'
};

/**
 * Normalise le nom d'agence pour matching (supprime espaces multiples, tirets, points, casse)
 */
function normalizeAgencyName(name) {
  if (!name) return '';
  return name
    .toString()
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' ')       // Espaces multiples → un seul
    .replace(/[-\.]/g, ' ')      // Tirets et points → espaces
    .replace(/\s+/g, ' ')        // Re-normaliser les espaces
    .trim();
}

/**
 * Extrait le code agence à partir du nom d'agence
 * Utilise le mapping AGENCY_NAME_TO_CODE
 */
function extractAgencyCodeFromName(agencyLine) {
  if (!agencyLine) return null;

  // Extraire le nom de l'agence (tout avant les parenthèses avec numéro de téléphone)
  // Ex: "MCTV - GARD DU NORD (75114329)" → "MCTV - GARD DU NORD"
  const nameMatch = agencyLine.match(/^([^(]+?)(?:\s*\(\d+\))?$/);
  if (!nameMatch) return null;

  const agencyName = nameMatch[1].trim();
  const normalized = normalizeAgencyName(agencyName);

  // Chercher dans le mapping
  for (const [key, code] of Object.entries(AGENCY_NAME_TO_CODE)) {
    if (normalizeAgencyName(key) === normalized) {
      return code;
    }
  }

  return null; // Aucun match trouvé
}

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
        // Pour Global: trans.codeAgence est explicitement null, on ne doit PAS utiliser agenceId
        const finalCodeAgence = (trans.codeAgence === null) ? null : (trans.codeAgence || agenceId);

        await this.pool.request()
          .input('sessionId', sql.VarChar, importSessionId)
          .input('numero', sql.Numeric(20, 0), trans.numero)
          .input('codeEnvoi', sql.VarChar, trans.codeEnvoi)
          .input('partenaire', sql.VarChar, trans.partenaire)
          .input('montant', sql.Decimal(18, 2), trans.montant)
          .input('commission', sql.Decimal(18, 2), trans.commission)
          .input('taxes', sql.Decimal(18, 2), trans.taxe)
          .input('effectuePar', sql.VarChar, trans.effectuePar)
          .input('dateOperation', sql.DateTime, trans.dateOperation)
          .input('beneficiaire', sql.VarChar, trans.beneficiaire)
          .input('expediteur', sql.VarChar, trans.expediteur || '')
          .input('codeAgence', sql.VarChar, finalCodeAgence)
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
    const ext = path.extname(filePath).toLowerCase();

    // Pour les fichiers CSV/texte, utiliser une détection basée sur le contenu
    if (ext === '.csv' || ext === '.txt') {
      const content = await fs.readFile(filePath, 'utf-8');
      const firstLine = content.split('\n')[0];

      // Global: format tabulé avec colonnes spécifiques
      // Première ligne contient les données (pas d'en-tête) avec des tabulations
      // Format: date\tdate\tref\tagent\texp\tben\tcode\tmontant\tdevise\tmontant\tdevise
      const tabs = (firstLine.match(/\t/g) || []).length;
      if (tabs >= 10) {
        // Vérifier si ça ressemble à Global (date en début de ligne au format M/D/YY)
        if (firstLine.match(/^\d{1,2}\/\d{1,2}\/\d{2}\s+\d{1,2}:\d{2}\t/)) {
          return 'GLOBAL';
        }
      }
    }

    // Pour les fichiers Excel, utiliser ExcelJS
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

    // Global Excel (11 colonnes, commence par une date au format M/D/YY HH:mm)
    const cell1 = worksheet.getRow(1).getCell(1).value;
    const cell3 = worksheet.getRow(1).getCell(3).value;
    const cell10 = worksheet.getRow(1).getCell(10).value;

    // Vérifier si c'est Global: date en col1, code transaction 12 chiffres en col3, montant en col10
    if (cell1 && cell3 && cell10) {
      const dateStr = cell1.toString();
      const codeStr = cell3.toString();
      const montantStr = cell10.toString();

      // Date format M/D/YY ou Date Excel, code 12 chiffres, montant en KMF
      if ((dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{2}/) || cell1 instanceof Date) &&
          codeStr.match(/^\d{12}$/) &&
          (montantStr.includes('KMF') || typeof cell10 === 'number')) {
        return 'GLOBAL_EXCEL';
      }
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

      // Détecter l'agence (ligne contenant le nom de l'agence)
      // Ex: "MCTV - GARD DU NORD (75114329)" où (75114329) est un téléphone, PAS un code agence
      if (col1 && col1.toString().includes('MCTV')) {
        // Utiliser la fonction de mapping par nom
        const extractedCode = extractAgencyCodeFromName(col1.toString());
        if (extractedCode) {
          currentAgence = extractedCode;
          console.log(`  📍 Agence détectée: "${col1.toString()}" → Code: ${extractedCode}`);
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
   * Parse fichier Global (format tabulé)
   * Note: Global ne fournit pas de codes d'agence, l'agence doit être sélectionnée manuellement
   */
  async parseGlobal(filePath) {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const lines = fileContent.split('\n').filter(line => line.trim() !== '');

    const transactions = [];

    // Helper pour parser les montants avec format KMF
    const parseMontantKMF = (val) => {
      if (!val) return 0;
      // Format: "49 200,00 KMF" ou "17 761,20 KMF"
      const str = val.toString().replace(/KMF/g, '').replace(/\s/g, '').replace(/,/g, '.');
      return Math.abs(parseFloat(str) || 0);
    };

    // Helper pour parser les dates au format "4/30/25 14:58"
    const parseGlobalDate = (dateStr) => {
      if (!dateStr) return new Date();
      // Format: M/D/YY HH:mm
      const match = dateStr.toString().trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})\s+(\d{1,2}):(\d{2})$/);
      if (match) {
        const month = parseInt(match[1]);
        const day = parseInt(match[2]);
        const year = 2000 + parseInt(match[3]);
        const hour = parseInt(match[4]);
        const minute = parseInt(match[5]);
        return new Date(year, month - 1, day, hour, minute);
      }
      return new Date();
    };

    for (const line of lines) {
      const cols = line.split('\t');

      // Vérifier que la ligne a le bon nombre de colonnes (au moins 11)
      if (cols.length < 11) continue;

      const dateCreation = cols[0];
      const datePaiement = cols[1];
      const numeroRef = cols[2];
      const agent = cols[3];
      const expediteur = cols[4];
      const beneficiaire = cols[5];
      const codeInterne = cols[6];
      const montantSource = cols[7];
      const deviseSource = cols[8];
      const montantPaye = cols[9];
      const devisePaiement = cols[10];

      // Filtrer les lignes d'en-tête ou invalides
      if (!numeroRef || !datePaiement) continue;
      if (numeroRef.includes('Date') || agent.includes('Agent')) continue;

      // Vérifier que le numéro de référence est numérique
      if (!/^\d+$/.test(numeroRef.trim())) continue;

      const parsedDate = parseGlobalDate(datePaiement);
      const montant = parseMontantKMF(montantPaye);

      // Exclure les transactions avec montant = 0
      if (montant === 0) continue;

      transactions.push({
        numero: parseInt(codeInterne) || 0,
        codeEnvoi: numeroRef.toString().trim(),
        partenaire: 'GLOBAL',
        montant: montant,
        commission: 0, // Global ne fournit pas la commission séparément
        taxe: 0,
        effectuePar: (agent ? agent.toString().trim() : 'INCONNU').substring(0, 50),
        dateOperation: parsedDate,
        beneficiaire: (beneficiaire ? beneficiaire.toString() : '').substring(0, 250),
        expediteur: (expediteur ? expediteur.toString() : '').substring(0, 250),
        codeAgence: null, // Sera fourni manuellement par l'utilisateur
        typeOperation: 'PAIEMENT'
      });
    }

    return {
      type: 'GLOBAL',
      transactions,
      count: transactions.length
    };
  }

  /**
   * Parse fichier Global Excel (11 colonnes)
   * Note: Global ne fournit pas de codes d'agence, l'agence doit être assignée manuellement
   */
  async parseGlobalExcel(filePath) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.worksheets[0];

    const transactions = [];

    // Helper pour parser les montants avec format KMF
    const parseMontantKMF = (val) => {
      if (!val) return 0;
      // Format: "49 200,00 KMF" ou nombre directement
      const str = val.toString().replace(/KMF/g, '').replace(/\s/g, '').replace(/,/g, '.');
      return Math.abs(parseFloat(str) || 0);
    };

    // Helper pour parser les dates au format "4/30/25 14:58" ou Date Excel
    const parseGlobalDate = (dateVal) => {
      if (!dateVal) return new Date();

      // Si c'est déjà un objet Date Excel
      if (dateVal instanceof Date) {
        return dateVal;
      }

      // Sinon, parser le format M/D/YY HH:mm
      const dateStr = dateVal.toString().trim();
      const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})\s+(\d{1,2}):(\d{2})$/);
      if (match) {
        const month = parseInt(match[1]);
        const day = parseInt(match[2]);
        const year = 2000 + parseInt(match[3]);
        const hour = parseInt(match[4]);
        const minute = parseInt(match[5]);
        return new Date(year, month - 1, day, hour, minute);
      }
      return new Date();
    };

    worksheet.eachRow((row, rowNumber) => {
      // Colonnes Global Excel:
      // 1: Date envoi
      // 2: Date paiement
      // 3: Code transaction (12 chiffres)
      // 4: Agent
      // 5: Expéditeur
      // 6: Bénéficiaire
      // 7: Numéro téléphone (codeInterne)
      // 8: Montant EUR (non utilisé)
      // 9: Devise EUR
      // 10: Montant KMF (utilisé pour MONTANT)
      // 11: Devise KMF

      const dateCreation = row.getCell(1).value;
      const datePaiement = row.getCell(2).value;
      const numeroRef = row.getCell(3).value;
      const agent = row.getCell(4).value;
      const expediteur = row.getCell(5).value;
      const beneficiaire = row.getCell(6).value;
      const codeInterne = row.getCell(7).value;
      const montantSource = row.getCell(8).value;  // EUR - NOT USED
      const deviseSource = row.getCell(9).value;
      const montantPaye = row.getCell(10).value;    // KMF - THIS IS USED
      const devisePaiement = row.getCell(11).value;

      // Vérifier que c'est une ligne de données valide
      if (!numeroRef || !datePaiement) return;

      // Vérifier que le code transaction est bien numérique (12 chiffres)
      const numeroRefStr = numeroRef.toString().trim();
      if (!/^\d{12}$/.test(numeroRefStr)) return;

      // Parser la date
      const parsedDate = parseGlobalDate(datePaiement);

      // Parser le montant KMF (colonne 10)
      const montant = parseMontantKMF(montantPaye);

      // Exclure les transactions avec montant = 0
      if (montant === 0) return;

      transactions.push({
        numero: parseInt(codeInterne) || 0,
        codeEnvoi: numeroRefStr,
        partenaire: 'GLOBAL',
        montant: montant,
        commission: 0, // Global ne fournit pas la commission séparément
        taxe: 0,
        effectuePar: (agent ? agent.toString().trim() : 'INCONNU').substring(0, 50),
        dateOperation: parsedDate,
        beneficiaire: (beneficiaire ? beneficiaire.toString() : '').substring(0, 250),
        expediteur: (expediteur ? expediteur.toString() : '').substring(0, 250),
        codeAgence: null, // Sera fourni manuellement par l'utilisateur
        typeOperation: 'PAIEMENT'
      });
    });

    return {
      type: 'GLOBAL',
      transactions,
      count: transactions.length
    };
  }

  /**
   * Parse un fichier selon son type
   * @param {string} filePath - Chemin du fichier
   * @param {string} partnerOverride - Partenaire à forcer (optionnel)
   */
  async parseFile(filePath, partnerOverride = null) {
    const fileType = await this.detectFileType(filePath);
    console.log(`📊 Type détecté: ${fileType}`);

    let result;
    switch (fileType) {
      case 'MONEYGRAM_DETAIL':
        result = await this.parseMoneygramDetail(filePath);
        break;

      case 'RIA_DETAIL':
        result = await this.parseRiaDetail(filePath);
        break;

      case 'MONEYGRAM_ENVOIS':
        result = await this.parseMoneygramEnvois(filePath);
        break;

      case 'WESTERN_UNION':
        result = await this.parseWesternUnion(filePath);
        break;

      case 'GLOBAL':
        result = await this.parseGlobal(filePath);
        break;

      case 'GLOBAL_EXCEL':
        result = await this.parseGlobalExcel(filePath);
        break;

      case 'MONEYGRAM_SUMMARY':
      case 'RIA_SUMMARY':
      case 'GLOBAL_SUMMARY':
        throw new Error('Les fichiers de résumé ne contiennent pas de transactions individuelles');

      default:
        throw new Error('Format de fichier non reconnu');
    }

    // Si un partenaire est spécifié manuellement, l'appliquer à toutes les transactions
    if (partnerOverride && partnerOverride.trim() !== '') {
      console.log(`🔧 Application du partenaire manuel: ${partnerOverride}`);
      result.transactions = result.transactions.map(trans => ({
        ...trans,
        partenaire: partnerOverride.toUpperCase()
      }));
      result.type = partnerOverride.toUpperCase();
    }

    return result;
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
          .input('numero', sql.Numeric(20, 0), trans.numero)
          .query('SELECT NUMERO FROM INFOSTRANSFERTPARTENAIRES WHERE NUMERO = @numero');

        if (existingNum.recordset.length > 0) {
          duplicates++;
          continue;
        }

        // Insérer la transaction
        await this.pool.request()
          .input('numero', sql.Numeric(20, 0), trans.numero)
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
