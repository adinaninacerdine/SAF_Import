// Simuler importTransactions avec seulement 100 transactions pour voir le problème
const { ImportHandler } = require('./import-handler.js');
const sql = require('mssql');
const path = require('path');
require('dotenv').config();

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: { encrypt: true, trustServerCertificate: true }
};

async function testImportSimulation() {
  console.log('\n🔍 SIMULATION IMPORT (100 premières transactions)\n');

  let pool;
  try {
    pool = await sql.connect(dbConfig);
    const handler = new ImportHandler(pool);
    await handler.initialize();

    const filePath = path.join(__dirname, 'uploads', '16-30-Avril-2025 (2).xlsx');
    const parseResult = await handler.parseFile(filePath);

    // Prendre seulement les 100 premières pour tester rapidement
    const transactionsTest = parseResult.transactions.slice(0, 100);

    console.log(`📊 Parsing: ${transactionsTest.length} transactions`);
    const totalParsing = transactionsTest.reduce((sum, t) => sum + (t.montant || 0), 0);
    console.log(`💰 Total du parsing (100 trans): ${totalParsing.toFixed(2)} KMF\n`);

    console.log('💾 Import dans la DB...');
    const importResult = await handler.importTransactions(transactionsTest, '001', 'TEST');

    console.log(`\n📊 Résultat de importTransactions():`);
    console.log(`   ✅ Importées: ${importResult.success}`);
    console.log(`   ⚠️  Doublons: ${importResult.duplicates}`);
    console.log(`   ❌ Erreurs: ${importResult.errors}`);
    console.log(`   💰 totalAmount retourné: ${importResult.totalAmount.toFixed(2)} KMF`);

    console.log(`\n🔍 ANALYSE:`);
    console.log(`   Parsing total: ${totalParsing.toFixed(2)} KMF`);
    console.log(`   Import totalAmount: ${importResult.totalAmount.toFixed(2)} KMF`);
    console.log(`   Différence: ${(totalParsing - importResult.totalAmount).toFixed(2)} KMF`);

    if (importResult.totalAmount < totalParsing) {
      console.log(`\n❌ PROBLÈME IDENTIFIÉ:`);
      console.log(`   Le totalAmount ne compte QUE les transactions importées avec succès.`);
      console.log(`   Les doublons (${importResult.duplicates}) ne sont PAS comptés dans totalAmount.`);
      console.log(`   C'est pourquoi le frontend affiche un montant réduit !`);
    }

    await pool.close();

  } catch (error) {
    console.error('❌', error.message);
    if (pool) await pool.close();
  }
}

testImportSimulation().catch(console.error);
