// test-full-system.js - Test complet du système d'import
const sql = require('mssql');
const { ImportHandler } = require('./import-handler');
require('dotenv').config();

async function testFullSystem() {
  console.log('🧪 TEST COMPLET DU SYSTÈME D\'IMPORT\n');
  console.log('='.repeat(60));

  const pool = await sql.connect({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: 'localhost',
    database: process.env.DB_NAME,
    options: { encrypt: false, trustServerCertificate: true },
    requestTimeout: 60000
  });

  const handler = new ImportHandler(pool);
  await handler.initialize();

  // Test 1: MoneyGram détaillé
  console.log('\n📊 TEST 1: Fichier MoneyGram détaillé');
  console.log('-'.repeat(60));

  try {
    const result = await handler.parseFile('./uploads/16-30-Avril-2025 (2).xlsx');
    console.log(`✅ Type: ${result.type}`);
    console.log(`✅ Transactions: ${result.count}`);
    console.log(`\n📋 Exemples:`);
    result.transactions.slice(0, 3).forEach(t => {
      console.log(`   ${t.codeEnvoi} | ${t.beneficiaire} | ${t.montant} KMF | Agence: ${t.codeAgence}`);
    });
  } catch (error) {
    console.error(`❌ Erreur: ${error.message}`);
  }

  // Test 2: Fichier résumé (devrait échouer)
  console.log('\n\n📊 TEST 2: Fichier résumé Global (doit rejeter)');
  console.log('-'.repeat(60));

  try {
    const result = await handler.parseFile('./uploads/resume_trans_Global_11-03-2025_30-03-2025.xlsx');
    console.log(`❌ Ne devrait pas arriver ici`);
  } catch (error) {
    console.log(`✅ Rejeté correctement: ${error.message}`);
  }

  // Test 3: Fichier résumé RIA
  console.log('\n\n📊 TEST 3: Fichier résumé RIA (doit rejeter)');
  console.log('-'.repeat(60));

  try {
    const result = await handler.parseFile('./uploads/resume_trans_Ria_11-03-2025_31-03-2025.xlsx');
    console.log(`❌ Ne devrait pas arriver ici`);
  } catch (error) {
    console.log(`✅ Rejeté correctement: ${error.message}`);
  }

  await pool.close();

  console.log('\n\n' + '='.repeat(60));
  console.log('✅ TESTS TERMINÉS');
  console.log('='.repeat(60));
}

testFullSystem().catch(console.error);
