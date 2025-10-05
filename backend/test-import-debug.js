// Debug: Simuler exactement ce que fait le frontend
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

async function testImportDebug() {
  console.log('\n🔍 DEBUG - Simulation exacte du flux frontend→backend\n');
  console.log('='.repeat(80));

  let pool;

  try {
    // Connexion
    pool = await sql.connect(dbConfig);
    console.log('✅ Connecté à SQL Server');

    // Supprimer les données existantes MoneyGram pour ce test
    console.log('\n🗑️ Nettoyage des données MoneyGram existantes...');
    const deleteResult = await pool.request()
      .query(`DELETE FROM INFOSTRANSFERTPARTENAIRES WHERE PARTENAIRETRANSF = 'MONEYGRAM' AND DATEOPERATION >= '2025-04-16' AND DATEOPERATION < '2025-05-01'`);
    console.log(`   Supprimé: ${deleteResult.rowsAffected[0]} lignes`);

    // Initialiser le handler
    const handler = new ImportHandler(pool);
    await handler.initialize();

    const fileName = '16-30-Avril-2025 (2).xlsx';
    const filePath = path.join(__dirname, 'uploads', fileName);

    console.log(`\n📂 Fichier: ${fileName}`);

    // SIMULATION EXACTE du code serveur (server.js ligne 262-274)
    console.log('\n' + '='.repeat(80));
    console.log('ÉTAPE 1: parseFile() - Comme dans server.js ligne 263');
    console.log('='.repeat(80));

    const parseResult = await handler.parseFile(filePath);

    console.log(`\n✅ parseResult:`);
    console.log(`   transactions.length = ${parseResult.transactions.length}`);
    console.log(`   type = ${parseResult.type}`);
    console.log(`   count = ${parseResult.count}`);

    // Calculer le total du parsing
    const totalParsing = parseResult.transactions.reduce((sum, t) => sum + (t.montant || 0), 0);
    console.log(`\n💰 Montant total calculé du parsing:`);
    console.log(`   ${totalParsing.toFixed(2)} KMF`);

    // ÉTAPE 2: importTransactions() - Comme dans server.js ligne 270-274
    console.log('\n' + '='.repeat(80));
    console.log('ÉTAPE 2: importTransactions() - Comme dans server.js ligne 270');
    console.log('='.repeat(80));

    const agenceId = '001';
    const userId = 'TEST_USER';

    const importResult = await handler.importTransactions(
      parseResult.transactions,
      agenceId,
      userId
    );

    console.log(`\n✅ importResult (retourné par importTransactions):`);
    console.log(`   success: ${importResult.success}`);
    console.log(`   duplicates: ${importResult.duplicates}`);
    console.log(`   errors: ${importResult.errors}`);
    console.log(`   totalAmount: ${importResult.totalAmount} KMF`);
    console.log(`   agentsUnifies: ${importResult.agentsUnifies}`);

    // ÉTAPE 3: Ce que le serveur renvoie au frontend (server.js ligne 288-297)
    console.log('\n' + '='.repeat(80));
    console.log('ÉTAPE 3: Response JSON envoyée au frontend - server.js ligne 288');
    console.log('='.repeat(80));

    const responseToFrontend = {
      success: true,
      totalRecords: parseResult.transactions.length,
      successCount: importResult.success,
      duplicates: importResult.duplicates,
      errors: importResult.errors,
      agentsUnifies: importResult.agentsUnifies,
      totalAmount: importResult.totalAmount,
      errorDetails: importResult.errorDetails
    };

    console.log('\n📤 JSON envoyé au frontend:');
    console.log(JSON.stringify(responseToFrontend, null, 2));

    console.log(`\n💰 Frontend affichera: ${responseToFrontend.totalAmount.toFixed(2)} KMF`);

    // Vérifier quelques transactions dans le parsing
    console.log('\n' + '='.repeat(80));
    console.log('ÉTAPE 4: ANALYSE DES MONTANTS PARSÉS');
    console.log('='.repeat(80));

    console.log(`\n📝 10 premières transactions parsées:`);
    parseResult.transactions.slice(0, 10).forEach((t, idx) => {
      console.log(`   ${idx + 1}. ${t.codeEnvoi} → ${t.montant} KMF (type: ${typeof t.montant})`);
    });

    console.log(`\n📊 Statistiques des montants:`);
    const montants = parseResult.transactions.map(t => t.montant || 0);
    const min = Math.min(...montants);
    const max = Math.max(...montants);
    const avg = totalParsing / parseResult.transactions.length;

    console.log(`   Min: ${min} KMF`);
    console.log(`   Max: ${max} KMF`);
    console.log(`   Moyenne: ${avg.toFixed(2)} KMF`);
    console.log(`   Total: ${totalParsing.toFixed(2)} KMF`);

    console.log('\n' + '='.repeat(80));
    console.log('✅ DEBUG TERMINÉ');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('\n❌ Erreur:', error);
    console.error('Stack:', error.stack);
  } finally {
    if (pool) {
      await pool.close();
      console.log('📡 Connexion fermée\n');
    }
  }
}

testImportDebug().catch(console.error);
