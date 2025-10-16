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
  'MCTV - IVEMBENI - MCTV': '007',
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
  'MKAZI - MCTV': '011',
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

  // Extraire le nom de l'agence (tout avant le dernier numéro de téléphone entre parenthèses)
  // Ex: "MCTV - GARD DU NORD (75114329)" → "MCTV - GARD DU NORD"
  // Ex: "COMOROS ENTREPRENEURSHIP CORPORATION(CEN (74119312)" → "COMOROS ENTREPRENEURSHIP CORPORATION(CEN"

  // Chercher le dernier groupe de chiffres entre parenthèses (le téléphone)
  const phoneMatch = agencyLine.match(/^(.+?)\s*\((\d{7,})\)\s*$/);

  let agencyName;
  if (phoneMatch) {
    agencyName = phoneMatch[1].trim();
  } else {
    agencyName = agencyLine.trim();
  }

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

        // Calculer le montant total : utiliser trans.montantTotal si fourni, sinon montant + taxe
        const montantTotal = trans.montantTotal !== undefined ? trans.montantTotal : (trans.montant + trans.taxe);

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
          .input('montantTotal', sql.Decimal(18, 2), montantTotal)
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
      const lines = content.split('\n').filter(l => l.trim());
      const firstLine = lines[0] || '';
      const secondLine = lines[1] || '';

      // MoneyGram CSV avec MTCN et Sender/Receiver (format Paiements)
      if (firstLine.includes('MTCN') && firstLine.includes('Sender') && firstLine.includes('Receiver')) {
        return 'MONEYGRAM_CSV';
      }

      // MoneyGram CSV: Heure et date (locales), Num Réf, Type d'offre, Identifiant d'utilisateur, ID de point de vente, Montant, Frais, Total
      if ((firstLine.includes('Heure et date') || firstLine.includes('Num Réf')) &&
          (firstLine.includes('Montant') && firstLine.includes('Frais'))) {
        return 'MONEYGRAM_CSV';
      }

      // MoneyGram CSV anglais: Date/Time, Reference Number, Offer Type, User ID, POS ID, Amount, Fees, Total
      if ((firstLine.includes('Date/Time') || firstLine.includes('Reference Number')) &&
          (firstLine.includes('Amount') && firstLine.includes('Fees'))) {
        return 'MONEYGRAM_CSV';
      }

      // RIA CSV: PIN,Sender,Beneficiary,Payout Amount,Commission,Paid Date,User
      if (firstLine.includes('PIN') && firstLine.includes('Sender') && firstLine.includes('Beneficiary')) {
        return 'RIA_CSV';
      }

      // Western Union CSV
      if (firstLine.includes('MTCN') && firstLine.includes('Date Creation') && firstLine.includes('Expediteur')) {
        return 'WESTERN_UNION_CSV';
      }

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

    // MoneyGram Paiements - Format "DÉTAILS DES RÉCEPTIONS"
    // Ligne 1: Nom agence (ex: "MAGASIN DJANATHANE - MCTV (74719893)")
    // Ligne 2: "DÉTAILS DES RÉCEPTIONS - KMF"
    if (firstRow && (firstRow.toString().includes('MCTV') || firstRow.toString().includes('MAGASIN')) &&
        secondRow && secondRow.toString().includes('DÉTAILS DES RÉCEPTIONS')) {
      return 'MONEYGRAM_PAIEMENTS';
    }

    // RIA paiement détaillé (Rapport de Transaction Journalier)
    // ATTENTION: Ce format est RIA, pas MoneyGram !
    if (firstRow && firstRow.toString().includes('Rapport de Transaction Journalier')) {
      return 'RIA_DETAIL';  // Changé de MONEYGRAM_DETAIL à RIA_DETAIL
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

    // Global Excel (11 colonnes)
    // Ligne 1 peut être soit un en-tête ("Date Creation") soit directement des données
    const cell1 = worksheet.getRow(1).getCell(1).value;
    const cell3 = worksheet.getRow(1).getCell(3).value;
    const cell10 = worksheet.getRow(1).getCell(10).value;

    // Vérifier si ligne 1 est un en-tête Global
    if (cell1 && cell1.toString().includes('Date') &&
        cell3 && cell3.toString().includes('MTCN') &&
        cell10 && cell10.toString().includes('Montant')) {
      return 'GLOBAL_EXCEL';
    }

    // Vérifier si ligne 1 contient des données Global (format ancien sans en-tête)
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

    // RIA détaillé avec ligne 13 contenant "Succursale:"
    // Vérifier la ligne 13 pour le format RIA Envois
    const row13 = worksheet.getRow(13).getCell(1).value;
    if (row13 && row13.toString().includes('Succursale:')) {
      return 'RIA_DETAIL';
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
   * Parse fichier RIA "Rapport de Transaction Journalier"
   * Structure exacte:
   * - Ligne 13: "Succursale: XXX (code)     Guichetier: NAME     Transfert d'Argent - Paiement  (count)  amount KMF"
   * - Ligne 14: En-têtes colonnes (Numéro du transfert | Date de paiement | Bénéficiaire | Seq | Monnaie locale | Montant reçu | Taxe | Total | Commission)
   * - Ligne 15+: Données transactions
   */
  async parseRiaReportDetail(filePath) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.worksheets[0];

    const transactions = [];
    let currentAgence = null;
    let currentGuichetier = null;

    worksheet.eachRow((row, rowNumber) => {
      const col1 = row.getCell(1).value;

      // Détecter succursale et guichetier (ligne 13 pattern)
      // Ex: "Succursale: Mctv-Mangani (001)     Guichetier: RAOUDHOI ABDEREHMANE     Transfert d'Argent - Paiement  (211)  -23,184,213.00 KMF"
      // Ex: "Succursale: EDGY AGRO.SARL (EDAS001)     Guichetier: AHMED MOHAMED     Transfert d'Argent - Envoi  (12)  2,052,638.00 KMF"
      if (col1 && col1.toString().includes('Succursale:')) {
        const text = col1.toString();

        // Extraire code agence entre parenthèses après nom succursale
        // Pattern pour capturer codes numériques (001) ou alphanumériques (EDAS001)
        const agenceMatch = text.match(/Succursale:.*?\(([A-Z0-9]+)\)/i);
        if (agenceMatch) {
          currentAgence = agenceMatch[1];
        }

        // Extraire nom guichetier
        const guichetierMatch = text.match(/Guichetier:\s+([A-Z\s]+?)(?:\s{2,}|Transfert)/);
        if (guichetierMatch) {
          currentGuichetier = guichetierMatch[1].trim();
        }

        console.log(`  📍 Ligne ${rowNumber} - Agence: ${currentAgence}, Guichetier: ${currentGuichetier}`);
      }

      // Ignorer les lignes d'en-tête
      if (col1 && (col1.toString() === 'Numéro du transfert' || col1.toString().includes('Rapport de Transaction'))) {
        return;
      }

      // Ligne de données: commence par un code transaction (ex: "FR1325792425")
      if (col1 && /^[A-Z]{2}\d+$/.test(col1.toString().trim())) {
        const pin = row.getCell(1).value;
        const datePaiement = row.getCell(2).value;
        const beneficiaire = row.getCell(3).value;
        const numRef = row.getCell(4).value;
        const devise = row.getCell(5).value;
        const montant = row.getCell(6).value;
        const taxe = row.getCell(7).value;
        const total = row.getCell(8).value;
        const commission = row.getCell(9).value;

        // Vérifier que les données essentielles sont présentes
        if (!pin || !datePaiement || !montant) return;

        // Parser date
        let parsedDate;
        if (datePaiement instanceof Date) {
          parsedDate = datePaiement;
        } else {
          const dateStr = datePaiement.toString();
          // Format: "16/04/2025 08:21:45"
          const parts = dateStr.match(/(\d+)\/(\d+)\/(\d+)\s+(\d+):(\d+):(\d+)/);
          if (parts) {
            parsedDate = new Date(parts[3], parts[2] - 1, parts[1], parts[4], parts[5], parts[6]);
          } else {
            parsedDate = new Date();
          }
        }

        // Parser les montants (supprimer les virgules, gérer les négatifs)
        const parseMontant = (val) => {
          if (!val) return 0;
          const str = val.toString().replace(/,/g, ''); // Enlever les virgules
          return Math.abs(parseFloat(str) || 0);
        };

        // Parser commission: "1.25" représente 1250 KMF selon la note utilisateur
        const parseCommission = (val) => {
          if (!val) return 0;
          const num = parseFloat(val.toString().replace(/,/g, ''));
          // Si la commission est < 100, c'est probablement en milliers (1.25 = 1250)
          if (num < 100 && num > 0) {
            return num * 1000;
          }
          return Math.abs(num);
        };

        const montantParsed = parseMontant(montant);

        // Exclure les transactions avec montant = 0
        if (montantParsed === 0) return;

        transactions.push({
          numero: parseInt(numRef) || 0,
          codeEnvoi: pin.toString().trim(),
          partenaire: 'RIA',
          montant: montantParsed,
          commission: parseCommission(commission),
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
      type: 'RIA_DETAIL',
      transactions,
      count: transactions.length
    };
  }

  /**
   * Parse fichier RIA CSV standard
   * Format: PIN,Sender,Beneficiary,Payout Amount,Commission,Paid Date,User
   */
  async parseRiaCSV(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    const Papa = require('papaparse');

    const parseResult = Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true
    });

    const transactions = [];

    // Mapper les colonnes RIA
    const columnMappings = {
      pin: ['PIN', 'Reference', 'Code'],
      sender: ['Sender', 'Expéditeur', 'Sender Name'],
      beneficiary: ['Beneficiary', 'Bénéficiaire', 'Receiver', 'Receiver Name'],
      amount: ['Payout Amount', 'Amount', 'Montant', 'Principal'],
      commission: ['Commission', 'Fees', 'Frais'],
      date: ['Paid Date', 'Date', 'Date/Time', 'Payment Date'],
      user: ['User', 'Operator', 'Agent', 'Effectué par']
    };

    // Fonction pour trouver la colonne
    const findColumn = (row, mappings) => {
      for (const key of Object.keys(row)) {
        const normalizedKey = key.trim().toLowerCase();
        for (const mapping of mappings) {
          if (normalizedKey.includes(mapping.toLowerCase())) {
            return row[key];
          }
        }
      }
      return null;
    };

    for (const row of parseResult.data) {
      const pin = findColumn(row, columnMappings.pin);
      const sender = findColumn(row, columnMappings.sender);
      const beneficiary = findColumn(row, columnMappings.beneficiary);
      const amount = findColumn(row, columnMappings.amount);
      const commission = findColumn(row, columnMappings.commission);
      const dateStr = findColumn(row, columnMappings.date);
      const user = findColumn(row, columnMappings.user);

      if (!pin || !amount) continue;

      // Parser le montant
      let montantValue = 0;
      if (typeof amount === 'number') {
        montantValue = Math.abs(amount);
      } else if (typeof amount === 'string') {
        let cleanAmount = amount.replace(/[^\d,.-]/g, '');
        const lastComma = cleanAmount.lastIndexOf(',');
        const lastDot = cleanAmount.lastIndexOf('.');

        if (lastComma > lastDot) {
          cleanAmount = cleanAmount.replace(/\./g, '').replace(',', '.');
        } else {
          cleanAmount = cleanAmount.replace(/,/g, '');
        }
        montantValue = Math.abs(parseFloat(cleanAmount) || 0);
      }

      // Parser la commission
      let commissionValue = 0;
      if (commission) {
        if (typeof commission === 'number') {
          commissionValue = Math.abs(commission);
        } else if (typeof commission === 'string') {
          let cleanCommission = commission.replace(/[^\d,.-]/g, '');
          const lastComma = cleanCommission.lastIndexOf(',');
          const lastDot = cleanCommission.lastIndexOf('.');

          if (lastComma > lastDot) {
            cleanCommission = cleanCommission.replace(/\./g, '').replace(',', '.');
          } else {
            cleanCommission = cleanCommission.replace(/,/g, '');
          }
          commissionValue = Math.abs(parseFloat(cleanCommission) || 0);
        }
      }

      // Parser la date
      let dateOperation = new Date();
      if (dateStr) {
        if (dateStr instanceof Date) {
          dateOperation = dateStr;
        } else {
          const dateString = dateStr.toString();
          // Format DD/MM/YYYY ou MM/DD/YYYY
          const dateMatch = dateString.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
          if (dateMatch) {
            const day = parseInt(dateMatch[1]);
            const month = parseInt(dateMatch[2]);
            const year = parseInt(dateMatch[3]);
            // Essayer format DD/MM/YYYY (plus courant)
            if (month <= 12) {
              dateOperation = new Date(year, month - 1, day);
            }
          }
        }
      }

      transactions.push({
        numero: 0,
        codeEnvoi: pin.toString().trim(),
        partenaire: 'RIA',
        montant: montantValue,
        commission: commissionValue,
        taxe: 0,
        effectuePar: user ? user.toString().substring(0, 50) : 'INCONNU',
        dateOperation: dateOperation,
        beneficiaire: beneficiary ? beneficiary.toString().substring(0, 250) : '',
        expediteur: sender ? sender.toString().substring(0, 250) : '',
        codeAgence: '001', // Par défaut
        typeOperation: 'PAIEMENT'
      });
    }

    return {
      type: 'RIA_CSV',
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
   * Parse fichier MoneyGram Envois et Réceptions (fichier combiné)
   *
   * Structure ENVOIS (8 colonnes):
   * Col1: Heure et date | Col2: Num Réf | Col3: Type d'offre (vide) | Col4: ID utilisateur | Col5: ID point vente | Col6: Montant | Col7: Frais | Col8: Total
   *
   * Structure RÉCEPTIONS (9 colonnes - colonne vide en plus):
   * Col1: Heure et date | Col2: Num Réf | Col3: [VIDE] | Col4: Code auth | Col5: ID utilisateur | Col6: ID point vente | Col7: Montant | Col8: Frais | Col9: Total
   *
   * MAPPING CORRECT:
   * ENVOIS:  userId=Col4, montant=Col6, frais=Col7, total=Col8
   * RÉCEPTIONS: userId=Col5, montant=Col7, frais=Col8, total=Col9
   */
  async parseMoneygramEnvois(filePath) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.worksheets[0];

    const transactions = [];
    let currentAgence = null;
    let currentTypeOperation = 'ENVOI'; // Par défaut ENVOI

    worksheet.eachRow((row, rowNumber) => {
      const col1 = row.getCell(1).value;
      const col1Str = col1 ? col1.toString() : '';

      // Détecter le type d'opération (ENVOI ou RÉCEPTION)
      if (col1Str.includes('Détails des envois') || col1Str.includes('DÉTAILS DES ENVOIS')) {
        currentTypeOperation = 'ENVOI';
        console.log(`  📤 Section ENVOIS détectée ligne ${rowNumber}`);
        return;
      }
      if (col1Str.includes('DÉTAILS DES RÉCEPTIONS') || col1Str.includes('Détails des réceptions')) {
        currentTypeOperation = 'PAIEMENT';
        console.log(`  📥 Section RÉCEPTIONS détectée ligne ${rowNumber}`);
        return;
      }

      // Détecter l'agence: ligne avec nom + numéro entre parenthèses
      // Ex: "COMOROS ENTREPRENEURSHIP CORPORATION(CEN (74119312)" ou "MCTV - CALTEX (73936897)"
      if (col1Str.match(/\(\d+\)/)) {
        // Ignorer les lignes de titre
        if (col1Str.includes('Détails') || col1Str.includes('DÉTAILS') || col1Str.includes('Rapport') || col1Str.includes('Total')) {
          return;
        }

        const extractedCode = extractAgencyCodeFromName(col1Str);
        if (extractedCode) {
          currentAgence = extractedCode;
          console.log(`  📍 Agence détectée ligne ${rowNumber}: "${col1Str}" → Code: ${extractedCode}`);
        } else {
          console.log(`  ⚠️ Agence non reconnue ligne ${rowNumber}: "${col1Str}"`);
          currentAgence = '001'; // Par défaut
        }
        return;
      }

      // Ligne de données: commence par une date au format "2025-Apr-29 17:45:59"
      if (col1Str.match(/\d{4}-[A-Za-z]{3}-\d{2}\s+\d{2}:\d{2}:\d{2}/)) {
        const dateStr = col1Str;
        const numRef = row.getCell(2).value;

        // MAPPING DIFFÉRENT selon type opération
        let userId, montantHT, frais, total;

        if (currentTypeOperation === 'ENVOI') {
          // ENVOIS: 8 colonnes
          // Col4: ID utilisateur, Col6: Montant HT, Col7: Frais, Col8: Total TTC
          userId = row.getCell(4).value;
          montantHT = row.getCell(6).value;  // Montant HT (utilisé pour MONTANT)
          frais = row.getCell(7).value;
          total = row.getCell(8).value;      // Total TTC (pour validation uniquement)
        } else {
          // RÉCEPTIONS: 9 colonnes (colonne vide en col3)
          // Col5: ID utilisateur, Col7: Montant = Total (frais=0), Col8: Frais, Col9: Total
          userId = row.getCell(5).value;
          montantHT = row.getCell(7).value;  // Montant = Total (car frais=0)
          frais = row.getCell(8).value;
          total = row.getCell(9).value;      // Total (même valeur que montantHT)
        }

        // Parser la date
        const date = new Date(dateStr.replace(/-([A-Za-z]{3})-/, (m, month) => {
          const months = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
          return `-${String(months[month]+1).padStart(2,'0')}-`;
        }));

        if (numRef && montantHT) {
          // Stocker le code agent EXACTEMENT tel qu'il est dans le fichier
          const codeAgentBrut = userId ? userId.toString().trim() : 'INCONNU';

          // Calculer le montant total TTC
          const montantHTParsed = Math.abs(parseFloat(montantHT) || 0);
          const fraisParsed = Math.abs(parseFloat(frais) || 0);
          const totalTTC = Math.abs(parseFloat(total) || 0);  // Lire directement le total du fichier

          transactions.push({
            numero: parseInt(numRef) || 0,
            codeEnvoi: numRef.toString().trim(),
            partenaire: 'MONEYGRAM',
            montant: montantHTParsed,  // MONTANT HT (col6 pour ENVOI, col7 pour RÉCEPTION)
            commission: fraisParsed,   // Frais/Commission
            taxe: 0,
            montantTotal: totalTTC,    // TOTAL TTC (col8 pour ENVOI, col9 pour RÉCEPTION)
            effectuePar: codeAgentBrut,  // Code agent BRUT du fichier
            dateOperation: date,
            beneficiaire: '',
            expediteur: '',
            codeAgence: currentAgence || '001',
            typeOperation: currentTypeOperation
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
   * Parse fichier MoneyGram Paiements (Format "DÉTAILS DES RÉCEPTIONS")
   * Structure:
   * - Ligne 1: Nom agence (ex: "MAGASIN DJANATHANE - MCTV (74719893)")
   * - Ligne 2: "DÉTAILS DES RÉCEPTIONS - KMF"
   * - Ligne 3: En-têtes (Heure et date | Num Réf | code d'autorisation | Identifiant d'utilisateur | ID point de vente | Montant | Frais | Total)
   * - Ligne 4+: Données transactions
   */
  async parseMoneygramPaiements(filePath) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.worksheets[0];

    const transactions = [];
    let currentAgence = null;

    // Extraire l'agence de la première ligne
    const firstRow = worksheet.getRow(1).getCell(1).value;
    if (firstRow) {
      const agencyLine = firstRow.toString();
      // Utiliser la fonction de mapping par nom
      const extractedCode = extractAgencyCodeFromName(agencyLine);
      if (extractedCode) {
        currentAgence = extractedCode;
        console.log(`  📍 Agence détectée: "${agencyLine}" → Code: ${extractedCode}`);
      } else {
        // Si pas trouvé dans le mapping, essayer de détecter le code par défaut
        console.log(`  ⚠️ Agence non reconnue: "${agencyLine}"`);
        currentAgence = '001'; // Par défaut
      }
    }

    // Parser les données à partir de la ligne 4
    worksheet.eachRow((row, rowNumber) => {
      // Ignorer les 3 premières lignes (agence, titre, en-têtes)
      if (rowNumber <= 3) return;

      const dateStr = row.getCell(1).value;      // Heure et date (locales)
      const numRef = row.getCell(2).value;       // Num Réf
      const codeAuth = row.getCell(3).value;     // code d'autorisation
      const userId = row.getCell(4).value;       // Identifiant d'utilisateur (code agent)
      const pointDeVente = row.getCell(5).value; // ID de point de vente
      const montant = row.getCell(6).value;      // Montant
      const frais = row.getCell(7).value;        // Frais
      const total = row.getCell(8).value;        // Total

      // Vérifier que c'est une ligne de données valide
      if (!dateStr || !numRef || !montant) return;

      // Parser la date (format: "2025-Apr-17 08:47:53")
      let parsedDate = new Date();
      if (dateStr instanceof Date) {
        parsedDate = dateStr;
      } else {
        const dateString = dateStr.toString();
        // Format avec mois abrégé: YYYY-Mon-DD HH:mm:ss
        if (dateString.match(/^\d{4}-[A-Za-z]{3}-\d{2}/)) {
          parsedDate = new Date(dateString.replace(/-([A-Za-z]{3})-/, (m, month) => {
            const months = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
            return `-${String(months[month]+1).padStart(2,'0')}-`;
          }));
        }
      }

      // Parser les montants (négatifs pour les paiements)
      const montantValue = Math.abs(parseFloat(montant) || 0);
      const fraisValue = Math.abs(parseFloat(frais) || 0);

      // Déterminer le code agent
      let codeAgent = 'INCONNU';
      if (userId) {
        codeAgent = userId.toString().trim().substring(0, 50);
      }

      transactions.push({
        numero: parseInt(codeAuth) || 0, // Utiliser code d'autorisation comme numéro
        codeEnvoi: numRef.toString().trim(),
        partenaire: 'MONEYGRAM',
        montant: montantValue,
        commission: fraisValue,
        taxe: 0,
        effectuePar: codeAgent,
        dateOperation: parsedDate,
        beneficiaire: '', // Pas de bénéficiaire dans ce format
        expediteur: '',   // Pas d'expéditeur dans ce format
        codeAgence: currentAgence || '001',
        typeOperation: 'PAIEMENT'
      });
    });

    return {
      type: 'MONEYGRAM_PAIEMENTS',
      transactions,
      count: transactions.length
    };
  }

  /**
   * Parse fichier MoneyGram CSV (Format standard et avec colonnes additionnelles)
   * Formats supportés:
   * 1. Standard: Date/Time,Reference Number,Sender Name,Receiver Name,Amount,Commission,etc.
   * 2. Envois: Heure et date,Num Réf,Type d'offre,ID utilisateur,Montant,Frais,etc.
   * 3. Paiements: MTCN,Sender Name,Receiver Name,Principal Amount Paid Out,Commission,Date/Time Paid,Operator
   * Note: Détection automatique du format basée sur les colonnes présentes
   */
  async parseMoneygramCSV(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());

    if (lines.length === 0) {
      throw new Error('Fichier CSV vide');
    }

    const transactions = [];
    const firstLine = lines[0];

    // Détecter le séparateur (virgule ou point-virgule)
    const separator = firstLine.includes(';') ? ';' : ',';

    // Parser avec Papa Parse pour gérer correctement les CSV
    const Papa = require('papaparse');
    const parseResult = Papa.parse(content, {
      delimiter: separator,
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true
    });

    if (parseResult.errors.length > 0) {
      console.warn('Avertissements de parsing CSV:', parseResult.errors);
    }

    // Déterminer le type de format basé sur les colonnes présentes
    const headers = Object.keys(parseResult.data[0] || {});
    const hasReceiver = headers.some(h => h && h.toLowerCase().includes('receiver'));
    const hasSender = headers.some(h => h && h.toLowerCase().includes('sender'));
    const hasMTCN = headers.some(h => h && h.toUpperCase() === 'MTCN');
    const hasOperator = headers.some(h => h && h.toLowerCase().includes('operator'));

    // Format détecté: Paiements (avec Sender/Receiver)
    if (hasMTCN && hasSender && hasReceiver) {
      console.log('📊 Format détecté: MoneyGram Paiements (MTCN/Sender/Receiver)');

      // Mapper les colonnes pour format Paiements
      const columnMappings = {
        mtcn: ['MTCN', 'Reference Number', 'Num Réf'],
        sender: ['Sender Name', 'Sender', 'Expéditeur'],
        receiver: ['Receiver Name', 'Receiver', 'Beneficiary', 'Bénéficiaire'],
        amount: ['Principal Amount Paid Out', 'Amount', 'Montant', 'Principal'],
        commission: ['Commission', 'Fees', 'Frais'],
        date: ['Date/Time Paid', 'Date/Time', 'Date', 'Heure et date'],
        operator: ['Operator', 'User', 'Agent', 'Effectué par'],
        agency: ['Agency', 'Agence', 'Code Agence'] // Colonne optionnelle
      };

      // Fonction pour trouver la colonne correspondante
      const findColumn = (row, mappings) => {
        for (const key of Object.keys(row)) {
          const normalizedKey = key.trim().toLowerCase();
          for (const mapping of mappings) {
            if (normalizedKey.includes(mapping.toLowerCase())) {
              return row[key];
            }
          }
        }
        return null;
      };

      // Parser chaque ligne pour format PAIEMENTS
      for (const row of parseResult.data) {
        const mtcn = findColumn(row, columnMappings.mtcn);
        const sender = findColumn(row, columnMappings.sender);
        const receiver = findColumn(row, columnMappings.receiver);
        const amount = findColumn(row, columnMappings.amount);
        const commission = findColumn(row, columnMappings.commission);
        const dateStr = findColumn(row, columnMappings.date);
        const operator = findColumn(row, columnMappings.operator);
        const agency = findColumn(row, columnMappings.agency); // Optionnel

        // Vérifier les champs requis
        if (!mtcn || !amount) continue;

        // Parser le montant
        let montantValue = 0;
        if (typeof amount === 'number') {
          montantValue = Math.abs(amount);
        } else if (typeof amount === 'string') {
          // Gérer les formats avec virgules et points
          let cleanAmount = amount.replace(/[^\d,.-]/g, '');
          const lastComma = cleanAmount.lastIndexOf(',');
          const lastDot = cleanAmount.lastIndexOf('.');

          if (lastComma > lastDot) {
            // Format français: virgule est le séparateur décimal
            cleanAmount = cleanAmount.replace(/\./g, '').replace(',', '.');
          } else {
            // Format anglais: point est le séparateur décimal
            cleanAmount = cleanAmount.replace(/,/g, '');
          }
          montantValue = Math.abs(parseFloat(cleanAmount) || 0);
        }

        // Parser la commission
        let commissionValue = 0;
        if (commission) {
          if (typeof commission === 'number') {
            commissionValue = Math.abs(commission);
          } else if (typeof commission === 'string') {
            let cleanCommission = commission.replace(/[^\d,.-]/g, '');
            const lastComma = cleanCommission.lastIndexOf(',');
            const lastDot = cleanCommission.lastIndexOf('.');

            if (lastComma > lastDot) {
              cleanCommission = cleanCommission.replace(/\./g, '').replace(',', '.');
            } else {
              cleanCommission = cleanCommission.replace(/,/g, '');
            }
            commissionValue = Math.abs(parseFloat(cleanCommission) || 0);
          }
        }

        // Parser la date
        let dateOperation = new Date();
        if (dateStr) {
          if (dateStr instanceof Date) {
            dateOperation = dateStr;
          } else {
            const dateString = dateStr.toString();
            // Format: DD/MM/YYYY HH:mm:ss ou MM/DD/YYYY HH:mm:ss
            const dateMatch = dateString.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})\s*(\d{1,2}:\d{2}(?::\d{2})?)?/);
            if (dateMatch) {
              const day = parseInt(dateMatch[1]);
              const month = parseInt(dateMatch[2]);
              const year = parseInt(dateMatch[3]);
              const time = dateMatch[4] || '00:00';
              const [hours, minutes] = time.split(':').map(Number);

              // Essayer format DD/MM/YYYY (plus courant aux Comores)
              if (month <= 12) {
                dateOperation = new Date(year, month - 1, day, hours || 0, minutes || 0);
              }
            }
          }
        }

        // Extraire le code agence si la colonne Agency existe
        let codeAgence = '001'; // Par défaut
        if (agency) {
          // Si c'est une ligne avec nom d'agence style "MCTV - CALTEX (73936897)"
          const extractedCode = extractAgencyCodeFromName(agency.toString());
          if (extractedCode) {
            codeAgence = extractedCode;
          }
        }

        transactions.push({
          numero: 0, // Sera généré par la DB
          codeEnvoi: mtcn.toString().trim(),
          partenaire: 'MONEYGRAM',
          montant: montantValue,
          commission: commissionValue,
          taxe: 0,
          effectuePar: operator ? operator.toString().substring(0, 50) : 'INCONNU',
          dateOperation: dateOperation,
          beneficiaire: receiver ? receiver.toString().substring(0, 250) : '',
          expediteur: sender ? sender.toString().substring(0, 250) : '',
          codeAgence: codeAgence,
          typeOperation: 'PAIEMENT'
        });
      }

    } else {
      // Format ENVOIS (sans Sender/Receiver mais avec Type d'offre)
      console.log('📊 Format détecté: MoneyGram Envois (sans expéditeur/bénéficiaire)');

      // Mapper les colonnes pour format Envois
      const columnMappings = {
        date: ['Heure et date (locales)', 'Heure et date', 'Date/Time', 'Date and Time'],
        reference: ['Num Réf', 'Numéro Référence', 'Reference Number', 'Ref Number'],
        offerType: ['Type d\'offre', 'Type offre', 'Offer Type', 'Offer'],
        userId: ['Identifiant d\'utilisateur', 'Identifiant utilisateur', 'User ID', 'User'],
        posId: ['ID de point de vente', 'Point de vente', 'POS ID', 'Point of Sale'],
        amount: ['Montant', 'Amount', 'Principal'],
        fees: ['Frais', 'Fees', 'Commission'],
        total: ['Total', 'Total Amount', 'Grand Total']
      };

      // Fonction pour trouver la colonne correspondante
      const findColumn = (row, mappings) => {
        for (const key of Object.keys(row)) {
          const normalizedKey = key.trim().toLowerCase();
          for (const mapping of mappings) {
            if (normalizedKey.includes(mapping.toLowerCase())) {
              return row[key];
            }
          }
        }
        return null;
      };

      // Parser chaque ligne pour format ENVOIS
      for (const row of parseResult.data) {
        const reference = findColumn(row, columnMappings.reference);
        const amount = findColumn(row, columnMappings.amount);
        const dateStr = findColumn(row, columnMappings.date);

        // Vérifier les champs requis
        if (!reference || !amount) continue;

        // Parser le montant
        let montantValue = 0;
        if (typeof amount === 'number') {
          montantValue = Math.abs(amount);
        } else if (typeof amount === 'string') {
          let cleanAmount = amount.replace(/[^\d,.-]/g, '');
          const lastComma = cleanAmount.lastIndexOf(',');
          const lastDot = cleanAmount.lastIndexOf('.');

          if (lastComma > lastDot) {
            cleanAmount = cleanAmount.replace(/\./g, '').replace(',', '.');
          } else {
            cleanAmount = cleanAmount.replace(/,/g, '');
          }
          montantValue = Math.abs(parseFloat(cleanAmount) || 0);
        }

        // Parser les frais
        let commissionValue = 0;
        const fees = findColumn(row, columnMappings.fees);
        if (fees) {
          if (typeof fees === 'number') {
            commissionValue = Math.abs(fees);
          } else if (typeof fees === 'string') {
            let cleanCommission = fees.replace(/[^\d,.-]/g, '');
            const lastComma = cleanCommission.lastIndexOf(',');
            const lastDot = cleanCommission.lastIndexOf('.');

            if (lastComma > lastDot) {
              cleanCommission = cleanCommission.replace(/\./g, '').replace(',', '.');
            } else {
              cleanCommission = cleanCommission.replace(/,/g, '');
            }
            commissionValue = Math.abs(parseFloat(cleanCommission) || 0);
          }
        }

        // Parser la date
        let dateOperation = new Date();
        if (dateStr) {
          if (dateStr instanceof Date) {
            dateOperation = dateStr;
          } else {
            const dateString = dateStr.toString();
            // Format: YYYY-Apr-DD HH:mm:ss ou standard
            if (dateString.match(/^\d{4}-[A-Za-z]{3}-\d{2}/)) {
              dateOperation = new Date(dateString.replace(/-([A-Za-z]{3})-/, (m, month) => {
                const months = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
                return `-${String(months[month]+1).padStart(2,'0')}-`;
              }));
            } else {
              // Format DD/MM/YYYY
              const dateMatch = dateString.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})\s*(\d{1,2}:\d{2}(?::\d{2})?)?/);
              if (dateMatch) {
                const day = parseInt(dateMatch[1]);
                const month = parseInt(dateMatch[2]);
                const year = parseInt(dateMatch[3]);
                const time = dateMatch[4] || '00:00';
                const [hours, minutes] = time.split(':').map(Number);
                dateOperation = new Date(year, month - 1, day, hours || 0, minutes || 0);
              }
            }
          }
        }

        // Récupérer les autres champs
        const userId = findColumn(row, columnMappings.userId) || 'INCONNU';
        const offerType = findColumn(row, columnMappings.offerType) || '';

        transactions.push({
          numero: 0, // Sera généré par la DB
          codeEnvoi: reference.toString().trim(),
          partenaire: 'MONEYGRAM',
          montant: montantValue,
          commission: commissionValue,
          taxe: 0,
          effectuePar: userId.toString().substring(0, 50),
          dateOperation: dateOperation,
          beneficiaire: offerType.toString().substring(0, 250), // Type d'offre
          expediteur: '', // Pas d'expéditeur dans ce format
          codeAgence: '001', // Par défaut, sera déterminé par contexte
          typeOperation: 'ENVOI'
        });
      }
    }

    return {
      type: 'MONEYGRAM_CSV',
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
      // 1: Date Creation (ou Date envoi)
      // 2: Date Paiement
      // 3: MTCN (Code transaction 12 chiffres)
      // 4: Expediteur (ou Agent dans certains formats)
      // 5: Beneficiaire
      // 6: Code Agent
      // 7: Code Agence
      // 8: Montant Source (EUR)
      // 9: Devise (EUR)
      // 10: Montant Paye (KMF) - UTILISÉ
      // 11: Devise Paiement (KMF)

      const dateCreation = row.getCell(1).value;
      const datePaiement = row.getCell(2).value;
      const numeroRef = row.getCell(3).value;
      const expediteur = row.getCell(4).value;
      const beneficiaire = row.getCell(5).value;
      const agent = row.getCell(6).value;
      const codeAgence = row.getCell(7).value;
      const montantSource = row.getCell(8).value;  // EUR - NOT USED
      const deviseSource = row.getCell(9).value;
      const montantPaye = row.getCell(10).value;    // KMF - THIS IS USED
      const devisePaiement = row.getCell(11).value;

      // Ignorer la ligne d'en-tête (si présente)
      if (rowNumber === 1 && numeroRef && numeroRef.toString().toUpperCase() === 'MTCN') {
        console.log('  ℹ️ Ligne d\'en-tête détectée, skip...');
        return;
      }

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
        numero: parseInt(codeAgence) || 0,  // Utiliser Code Agence (col 7) comme numero
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
      case 'MONEYGRAM_CSV':
        result = await this.parseMoneygramCSV(filePath);
        break;

      case 'MONEYGRAM_PAIEMENTS':
        result = await this.parseMoneygramPaiements(filePath);
        break;

      case 'RIA_DETAIL':
        result = await this.parseRiaReportDetail(filePath);
        break;

      case 'RIA_CSV':
        result = await this.parseRiaCSV(filePath);
        break;

      case 'MONEYGRAM_ENVOIS':
        result = await this.parseMoneygramEnvois(filePath);
        break;

      case 'WESTERN_UNION':
      case 'WESTERN_UNION_CSV':
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
        // Si le partenaire est spécifié manuellement et que le format n'est pas reconnu,
        // essayer de parser selon le partenaire spécifié
        if (partnerOverride && partnerOverride.toUpperCase() === 'RIA') {
          console.log('🔧 Format non reconnu, tentative de parsing RIA générique...');
          // Essayer d'abord le format "Rapport de Transaction"
          result = await this.parseMoneygramDetail(filePath).catch(async () => {
            // Si échec, essayer le format RIA simple
            console.log('🔧 Tentative format RIA alternatif...');
            return await this.parseRiaDetail(filePath);
          });
          break;
        } else if (partnerOverride && partnerOverride.toUpperCase() === 'MONEYGRAM') {
          console.log('🔧 Format non reconnu, tentative de parsing MoneyGram générique...');
          result = await this.parseMoneygramEnvois(filePath);
          break;
        }
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

        // Calculer le montant total : utiliser trans.montantTotal si fourni, sinon montant + taxe
        const montantTotal = trans.montantTotal !== undefined ? trans.montantTotal : (trans.montant + trans.taxe);

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
          .input('montantTotal', sql.Decimal(18, 2), montantTotal)
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
