const sql = require('mssql');
const { ImportHandler } = require('./import-handler-new');
require('dotenv').config();

async function test() {
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

  console.log('🧪 Test du nouveau handler\n');

  // Test avec le fichier MoneyGram
  const result = await handler.parseFile('./uploads/16-30-Avril-2025 (2).xlsx');
  console.log(`\n✅ Fichier parsé:`);
  console.log(`   Type: ${result.type}`);
  console.log(`   Transactions: ${result.count}`);

  console.log(`\n📋 Aperçu des 3 premières:`);
  result.transactions.slice(0, 3).forEach(t => {
    console.log(`   ${t.numero} | ${t.codeEnvoi} | ${t.beneficiaire} | ${t.montant} KMF | Agence: ${t.codeAgence}`);
  });

  // Test import (commenté pour ne pas réimporter)
  // const importResult = await handler.importTransactions(result.transactions, '001', 'TEST');
  // console.log(`\n✅ Import: ${importResult.success} réussis, ${importResult.duplicates} doublons, ${importResult.errors} erreurs`);

  await pool.close();
}

test().catch(console.error);
