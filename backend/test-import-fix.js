// test-import-fix.js - Tester le fix du parsing des montants
const { ImportHandler } = require('./import-handler');
const sql = require('mssql');
require('dotenv').config();

async function testImportFix() {
  console.log('🧪 TEST DU FIX DE PARSING DES MONTANTS\n');

  const pool = await sql.connect({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: 'localhost',
    database: process.env.DB_NAME,
    options: { encrypt: false, trustServerCertificate: true },
    requestTimeout: 300000
  });

  const handler = new ImportHandler(pool);

  console.log('📁 Parsing du fichier Excel...');
  const result = await handler.parseFile('./uploads/16-30-Avril-2025 (2).xlsx');

  console.log(`\n✅ ${result.transactions.length} transactions parsées`);
  console.log(`📊 Type: ${result.type}`);

  // Afficher quelques exemples de montants
  console.log('\n📝 Exemples de montants parsés:');
  result.transactions.slice(0, 10).forEach((t, i) => {
    console.log(`   ${i+1}. ${t.codeEnvoi}: ${t.montant.toLocaleString()} KMF (comm: ${t.commission}, taxe: ${t.taxe})`);
  });

  // Calculer le total
  const total = result.transactions.reduce((sum, t) => sum + t.montant, 0);
  const totalComm = result.transactions.reduce((sum, t) => sum + t.commission, 0);
  const totalTaxe = result.transactions.reduce((sum, t) => sum + t.taxe, 0);

  console.log(`\n💰 TOTAUX:`);
  console.log(`   Montant total: ${total.toLocaleString()} KMF`);
  console.log(`   Commissions: ${totalComm.toLocaleString()} KMF`);
  console.log(`   Taxes: ${totalTaxe.toLocaleString()} KMF`);
  console.log(`   TOTAL GÉNÉRAL: ${(total + totalComm + totalTaxe).toLocaleString()} KMF`);

  // Trouver les plus gros montants
  const sorted = [...result.transactions].sort((a, b) => b.montant - a.montant);
  console.log(`\n🏆 Top 5 des plus gros montants:`);
  sorted.slice(0, 5).forEach((t, i) => {
    console.log(`   ${i+1}. ${t.codeEnvoi}: ${t.montant.toLocaleString()} KMF`);
  });

  await pool.close();
}

testImportFix().catch(console.error);
