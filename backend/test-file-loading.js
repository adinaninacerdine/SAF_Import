// Test de chargement et d'analyse des fichiers
const { ImportHandler } = require('./import-handler.js');
const sql = require('mssql');
const path = require('path');
require('dotenv').config();

const dbConfig = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'Admin@123',
  server: process.env.DB_SERVER || 'sqlserver',
  database: process.env.DB_NAME || 'SAF_MCTV_COMORES',
  options: {
    encrypt: true,
    trustServerCertificate: true,
    enableArithAbort: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

async function testFileLoading() {
  console.log('\n🧪 TEST DE CHARGEMENT DES FICHIERS\n');
  console.log('='.repeat(80));

  let pool;

  try {
    // Connexion DB
    console.log('\n📡 Connexion à la base de données...');
    pool = await sql.connect(dbConfig);
    console.log('✅ Connecté à SQL Server');

    // Initialiser le handler
    const handler = new ImportHandler(pool);
    await handler.initialize();

    // Fichiers à tester
    const testFiles = [
      '16-30-Avril-2025 (2).xlsx',
      'resume_trans_MoneyGram_11-03-2025_30-03-2025.xlsx',
      'resume_trans_Ria_11-03-2025_31-03-2025.xlsx',
      'resume_trans_Global_11-03-2025_30-03-2025.xlsx'
    ];

    for (const fileName of testFiles) {
      console.log('\n' + '-'.repeat(80));
      console.log(`\n📂 Test du fichier: ${fileName}`);
      console.log('-'.repeat(80));

      const filePath = path.join(__dirname, 'uploads', fileName);

      try {
        // 1. Détection du type
        console.log('\n1️⃣ Détection du type de fichier...');
        const fileType = await handler.detectFileType(filePath);
        console.log(`   📊 Type détecté: ${fileType}`);

        // 2. Tentative de parsing
        console.log('\n2️⃣ Parsing du fichier...');
        const result = await handler.parseFile(filePath);

        console.log(`\n✅ Résultats du parsing:`);
        console.log(`   • Type: ${result.type}`);
        console.log(`   • Nombre de transactions: ${result.count}`);

        if (result.transactions && result.transactions.length > 0) {
          console.log(`\n📝 Aperçu des 3 premières transactions:`);
          result.transactions.slice(0, 3).forEach((trans, idx) => {
            console.log(`\n   Transaction #${idx + 1}:`);
            console.log(`     - Code envoi: ${trans.codeEnvoi}`);
            console.log(`     - Partenaire: ${trans.partenaire}`);
            console.log(`     - Montant: ${trans.montant} KMF`);
            console.log(`     - Commission: ${trans.commission} KMF`);
            console.log(`     - Effectué par: ${trans.effectuePar}`);
            console.log(`     - Date: ${trans.dateOperation}`);
            console.log(`     - Bénéficiaire: ${trans.beneficiaire}`);
            console.log(`     - Agence: ${trans.codeAgence}`);
          });

          // Statistiques
          const totalMontant = result.transactions.reduce((sum, t) => sum + (t.montant || 0), 0);
          const totalCommission = result.transactions.reduce((sum, t) => sum + (t.commission || 0), 0);

          console.log(`\n📊 Statistiques globales:`);
          console.log(`   • Total montants: ${totalMontant.toFixed(2)} KMF`);
          console.log(`   • Total commissions: ${totalCommission.toFixed(2)} KMF`);
          console.log(`   • Nombre d'agences: ${new Set(result.transactions.map(t => t.codeAgence)).size}`);
          console.log(`   • Guichetiers uniques: ${new Set(result.transactions.map(t => t.effectuePar)).size}`);
        }

      } catch (error) {
        console.error(`\n❌ Erreur lors du traitement du fichier:`);
        console.error(`   Message: ${error.message}`);
        if (error.stack) {
          console.error(`   Stack: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
        }
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Test terminé');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('\n❌ Erreur générale:', error);
  } finally {
    if (pool) {
      await pool.close();
      console.log('📡 Connexion fermée');
    }
  }
}

// Exécution
testFileLoading().catch(console.error);
