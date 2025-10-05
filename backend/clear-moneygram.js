// clear-moneygram.js - Supprimer les transactions MoneyGram pour réimporter
const sql = require('mssql');
require('dotenv').config();

async function clearMoneyGram() {
  const pool = await sql.connect({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: 'localhost',
    database: process.env.DB_NAME,
    options: { encrypt: false, trustServerCertificate: true },
    requestTimeout: 300000 // 5 minutes
  });

  // Compter les transactions MoneyGram
  const count = await pool.request().query(`
    SELECT COUNT(*) as total FROM INFOSTRANSFERTPARTENAIRES
    WHERE PARTENAIRETRANSF = 'MONEYGRAM'
  `);

  console.log(`📊 Transactions MoneyGram actuelles: ${count.recordset[0].total}`);

  // Supprimer
  console.log('🗑️ Suppression en cours...');
  await pool.request().query(`
    DELETE FROM INFOSTRANSFERTPARTENAIRES
    WHERE PARTENAIRETRANSF = 'MONEYGRAM'
  `);

  console.log('✅ Transactions MoneyGram supprimées!');
  console.log('Vous pouvez maintenant réimporter le fichier.');

  await pool.close();
}

clearMoneyGram().catch(console.error);
