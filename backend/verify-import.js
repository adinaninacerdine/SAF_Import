const sql = require('mssql');
require('dotenv').config();

async function verify() {
  const pool = await sql.connect({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: 'localhost',
    database: process.env.DB_NAME,
    options: { encrypt: false, trustServerCertificate: true },
    requestTimeout: 60000
  });

  // Total des transactions
  const total = await pool.request().query(`
    SELECT COUNT(*) as total FROM INFOSTRANSFERTPARTENAIRES
  `);
  console.log(`📊 Total transactions: ${total.recordset[0].total}`);

  // Transactions MoneyGram importées aujourd'hui
  const imported = await pool.request()
    .query(`
      SELECT
        COUNT(*) as count,
        SUM(MONTANT) as totalMontant
      FROM INFOSTRANSFERTPARTENAIRES
      WHERE PARTENAIRETRANSF = 'MONEYGRAM'
      AND date_creation >= CAST(GETDATE() AS DATE)
    `);

  console.log(`\n✅ Import du jour (MONEYGRAM):`);
  console.log(`   Transactions: ${imported.recordset[0].count}`);
  console.log(`   Montant total: ${imported.recordset[0].totalMontant?.toFixed(2) || 0} KMF`);

  // Quelques exemples
  const samples = await pool.request().query(`
    SELECT TOP 5
      NUMERO, CODEENVOI, NOMPRENOMBENEFICIAIRE, MONTANT, CODEAGENCE, DATEOPERATION
    FROM INFOSTRANSFERTPARTENAIRES
    WHERE PARTENAIRETRANSF = 'MONEYGRAM'
    AND date_creation >= CAST(GETDATE() AS DATE)
    ORDER BY NUMERO DESC
  `);

  console.log(`\n📋 Exemples de transactions importées:`);
  samples.recordset.forEach(t => {
    console.log(`   ${t.NUMERO} | ${t.CODEENVOI} | ${t.NOMPRENOMBENEFICIAIRE} | ${t.MONTANT} KMF | Agence: ${t.CODEAGENCE}`);
  });

  await pool.close();
}

verify().catch(console.error);
