// verify-import-detailed.js - Vérifier en détail ce qui a été importé
const sql = require('mssql');
require('dotenv').config();

async function verifyImport() {
  const pool = await sql.connect({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: 'localhost',
    database: process.env.DB_NAME,
    options: { encrypt: false, trustServerCertificate: true },
    requestTimeout: 60000
  });

  console.log('📊 VÉRIFICATION DE L\'IMPORT MONEYGRAM\n');
  console.log('='.repeat(60));

  // Total MoneyGram
  const total = await pool.request().query(`
    SELECT
      COUNT(*) as count,
      SUM(MONTANT) as totalMontant,
      MIN(DATEOPERATION) as dateMin,
      MAX(DATEOPERATION) as dateMax
    FROM INFOSTRANSFERTPARTENAIRES
    WHERE PARTENAIRETRANSF = 'MONEYGRAM'
  `);

  console.log('\n💰 TOTAL MONEYGRAM:');
  console.log(`   Transactions: ${total.recordset[0].count?.toLocaleString()}`);
  console.log(`   Montant total: ${total.recordset[0].totalMontant?.toLocaleString()} KMF`);
  console.log(`   Période: ${total.recordset[0].dateMin} → ${total.recordset[0].dateMax}`);

  // Par agence
  const byAgence = await pool.request().query(`
    SELECT
      CODEAGENCE,
      COUNT(*) as count,
      SUM(MONTANT) as totalMontant
    FROM INFOSTRANSFERTPARTENAIRES
    WHERE PARTENAIRETRANSF = 'MONEYGRAM'
    GROUP BY CODEAGENCE
    ORDER BY COUNT(*) DESC
  `);

  console.log('\n📍 PAR AGENCE:');
  byAgence.recordset.forEach(row => {
    console.log(`   ${row.CODEAGENCE}: ${row.count} trans, ${row.totalMontant?.toLocaleString()} KMF`);
  });

  // Quelques exemples
  const samples = await pool.request().query(`
    SELECT TOP 10
      NUMERO, CODEENVOI, NOMPRENOMBENEFICIAIRE, MONTANT, COMMISSION, TAXES,
      MONTANTTOTAL, CODEAGENCE, DATEOPERATION
    FROM INFOSTRANSFERTPARTENAIRES
    WHERE PARTENAIRETRANSF = 'MONEYGRAM'
    ORDER BY NUMERO DESC
  `);

  console.log('\n📝 EXEMPLES DE TRANSACTIONS:');
  samples.recordset.forEach(row => {
    console.log(`   ${row.CODEENVOI}: ${row.MONTANT} KMF (+ ${row.COMMISSION} comm + ${row.TAXES} taxes = ${row.MONTANTTOTAL} KMF) - ${row.CODEAGENCE}`);
  });

  // Statistiques des montants
  const stats = await pool.request().query(`
    SELECT
      MIN(MONTANT) as minMontant,
      MAX(MONTANT) as maxMontant,
      AVG(MONTANT) as avgMontant,
      SUM(COMMISSION) as totalCommission,
      SUM(TAXES) as totalTaxes,
      SUM(MONTANTTOTAL) as totalGeneral
    FROM INFOSTRANSFERTPARTENAIRES
    WHERE PARTENAIRETRANSF = 'MONEYGRAM'
  `);

  console.log('\n📈 STATISTIQUES:');
  console.log(`   Montant min: ${stats.recordset[0].minMontant?.toLocaleString()} KMF`);
  console.log(`   Montant max: ${stats.recordset[0].maxMontant?.toLocaleString()} KMF`);
  console.log(`   Montant moyen: ${stats.recordset[0].avgMontant?.toFixed(2)} KMF`);
  console.log(`   Total commissions: ${stats.recordset[0].totalCommission?.toLocaleString()} KMF`);
  console.log(`   Total taxes: ${stats.recordset[0].totalTaxes?.toLocaleString()} KMF`);
  console.log(`   TOTAL GÉNÉRAL (montant+comm+taxes): ${stats.recordset[0].totalGeneral?.toLocaleString()} KMF`);

  await pool.close();
}

verifyImport().catch(console.error);
