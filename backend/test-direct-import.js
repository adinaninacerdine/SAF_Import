// Test import direct sans passer par le serveur web
const sql = require('mssql');
const { ImportHandler } = require('./import-handler');
require('dotenv').config();

async function testDirectImport() {
  console.log('🧪 TEST IMPORT DIRECT\n');

  const pool = await sql.connect({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: 'localhost',
    database: process.env.DB_NAME,
    options: { encrypt: false, trustServerCertificate: true },
    requestTimeout: 300000
  });

  const handler = new ImportHandler(pool);

  // Parse
  console.log('📁 Parsing...');
  const parseResult = await handler.parseFile('./uploads/16-30-Avril-2025 (2).xlsx');
  console.log(`✅ ${parseResult.transactions.length} transactions parsées`);

  // Vérifier les premiers montants
  console.log('\n💰 Premiers montants:');
  parseResult.transactions.slice(0, 5).forEach(t => {
    console.log(`   ${t.codeEnvoi}: ${t.montant.toLocaleString()} KMF`);
  });

  const total = parseResult.transactions.reduce((sum, t) => sum + t.montant, 0);
  console.log(`\n💰 Total parsé: ${total.toLocaleString()} KMF`);

  // Import
  console.log('\n💾 Import en cours...');
  const importResult = await handler.importTransactions(parseResult.transactions, 'MULTI', 'TEST');

  console.log('\n📊 RÉSULTAT:');
  console.log(`   ✅ Importées: ${importResult.success}`);
  console.log(`   ⚠️  Doublons: ${importResult.duplicates}`);
  console.log(`   ❌ Erreurs: ${importResult.errors}`);
  console.log(`   💰 Montant: ${importResult.totalAmount?.toLocaleString()} KMF`);

  await pool.close();
}

testDirectImport().catch(console.error);
