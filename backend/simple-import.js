// simple-import.js - Import simplifié direct dans la base
const ExcelJS = require('exceljs');
const sql = require('mssql');
require('dotenv').config();

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: 'localhost',
  database: process.env.DB_NAME,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true
  }
};

async function parseMoneygramFile(filePath) {
  console.log('📁 Parsing MoneyGram file...');

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];

  const transactions = [];
  let currentAgence = null;
  let currentGuichetier = null;

  worksheet.eachRow((row, rowNumber) => {
    // Ligne 13+ contient les infos de succursale
    const col1 = row.getCell(1).value;

    if (col1 && col1.toString().includes('Succursale:')) {
      // Extraire l'agence et le guichetier
      const text = col1.toString();

      // Format: Succursale: Mctv-Mangani (001)     Guichetier: RAOUDHOI ABDEREHMANE
      const agenceMatch = text.match(/Succursale:.*?\((\d+)\)/);
      const guichetierMatch = text.match(/Guichetier:\s+([A-Z\s]+)/);

      if (agenceMatch) currentAgence = agenceMatch[1];
      if (guichetierMatch) currentGuichetier = guichetierMatch[1].trim();

      console.log(`📍 Agence détectée: ${currentAgence} - Guichetier: ${currentGuichetier}`);
    }

    // Ligne 14 = en-têtes (Numéro du transfert, Date de paiement, etc.)
    // Ligne 15+ = données
    if (rowNumber >= 15) {
      const mtcn = row.getCell(1).value;  // Numéro du transfert (MTCN)
      const datePaiement = row.getCell(2).value;  // Date de paiement
      const beneficiaire = row.getCell(3).value;  // Bénéficiaire
      const numRef = row.getCell(4).value;  // Seq / Num Réf
      const devise = row.getCell(5).value;  // Monnaie locale
      const montant = row.getCell(6).value;  // Montant reçu
      const taxe = row.getCell(7).value;  // Taxe
      const commission = row.getCell(9).value;  // Commission

      // Ignorer les lignes vides ou de total
      if (!mtcn || !datePaiement) return;
      if (mtcn.toString().toLowerCase().includes('total')) return;

      // Parser la date proprement
      let parsedDate;
      if (datePaiement instanceof Date) {
        parsedDate = datePaiement;
      } else {
        // Format: 16/04/2025 08:21:45
        const dateStr = datePaiement.toString();
        const parts = dateStr.match(/(\d+)\/(\d+)\/(\d+)\s+(\d+):(\d+):(\d+)/);
        if (parts) {
          parsedDate = new Date(parts[3], parts[2] - 1, parts[1], parts[4], parts[5], parts[6]);
        } else {
          parsedDate = new Date();
        }
      }

      transactions.push({
        numero: parseInt(numRef) || 0,  // Numéro de référence
        mtcn: mtcn.toString().trim(),
        datePaiement: parsedDate,
        beneficiaire: beneficiaire ? beneficiaire.toString() : '',
        devise: devise ? devise.toString() : 'KMF',
        montant: parseFloat(montant) || 0,
        taxe: parseFloat(taxe) || 0,
        commission: parseFloat(commission) || 0,
        agence: currentAgence || '001',
        guichetier: currentGuichetier || 'INCONNU'
      });
    }
  });

  console.log(`✅ ${transactions.length} transactions trouvées`);
  return transactions;
}

async function importToDatabase(transactions) {
  console.log('\n🔌 Connexion à la base de données...');
  const pool = await sql.connect(dbConfig);
  console.log('✅ Connecté');

  let success = 0;
  let duplicates = 0;
  let errors = 0;

  console.log('\n💾 Import des transactions...\n');

  for (const trans of transactions) {
    try {
      // Vérifier si doublon
      const existing = await pool.request()
        .input('mtcn', sql.VarChar, trans.mtcn)
        .query('SELECT NUMERO FROM INFOSTRANSFERTPARTENAIRES WHERE CODEENVOI = @mtcn');

      if (existing.recordset.length > 0) {
        duplicates++;
        continue;
      }

      // Insérer la transaction
      await pool.request()
        .input('numero', sql.Int, trans.numero)
        .input('codeEnvoi', sql.VarChar, trans.mtcn)
        .input('partenaire', sql.VarChar, 'MONEYGRAM')
        .input('montant', sql.Decimal(18, 2), Math.abs(trans.montant))
        .input('commission', sql.Decimal(18, 2), trans.commission)
        .input('taxes', sql.Decimal(18, 2), trans.taxe)
        .input('effectuePar', sql.VarChar, trans.guichetier.substring(0, 50))
        .input('dateOperation', sql.DateTime, trans.datePaiement)
        .input('beneficiaire', sql.VarChar, trans.beneficiaire.substring(0, 250))
        .input('codeAgence', sql.VarChar, trans.agence)
        .input('typeOp', sql.VarChar, 'PAIEMENT')
        .input('montantTotal', sql.Decimal(18, 2), Math.abs(trans.montant) + trans.taxe)
        .query(`
          INSERT INTO INFOSTRANSFERTPARTENAIRES
          (NUMERO, CODEENVOI, PARTENAIRETRANSF, MONTANT, COMMISSION, TAXES,
           EFFECTUEPAR, DATEOPERATION, NOMPRENOMBENEFICIAIRE, CODEAGENCE,
           TYPEOPERATION, MONTANTTOTAL, date_creation)
          VALUES
          (@numero, @codeEnvoi, @partenaire, @montant, @commission, @taxes,
           @effectuePar, @dateOperation, @beneficiaire, @codeAgence,
           @typeOp, @montantTotal, GETDATE())
        `);

      success++;

      if (success % 100 === 0) {
        console.log(`   ✓ ${success} transactions importées...`);
      }

    } catch (error) {
      errors++;
      if (errors <= 5) {
        console.error(`   ❌ Erreur ${trans.mtcn}: ${error.message}`);
      }
    }
  }

  await pool.close();

  console.log('\n📊 RÉSUMÉ:');
  console.log(`   ✅ Importées: ${success}`);
  console.log(`   ⚠️  Doublons: ${duplicates}`);
  console.log(`   ❌ Erreurs: ${errors}`);

  return { success, duplicates, errors };
}

async function main() {
  try {
    const filePath = './uploads/16-30-Avril-2025 (2).xlsx';

    const transactions = await parseMoneygramFile(filePath);

    console.log('\n🔍 Aperçu des premières transactions:');
    transactions.slice(0, 3).forEach(t => {
      console.log(`   ${t.mtcn} - ${t.beneficiaire} - ${t.montant} ${t.devise} - Agence: ${t.agence}`);
    });

    const result = await importToDatabase(transactions);

    console.log('\n✅ Import terminé!');

  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    console.error(error.stack);
  }
}

main();
