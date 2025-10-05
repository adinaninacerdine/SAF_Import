const sql = require('mssql');
require('dotenv').config();

async function checkTable() {
  const pool = await sql.connect({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: 'localhost',
    database: process.env.DB_NAME,
    options: { encrypt: false, trustServerCertificate: true }
  });

  const columns = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'INFOSTRANSFERTPARTENAIRES'
    ORDER BY ORDINAL_POSITION
  `);

  console.log('Colonnes de INFOSTRANSFERTPARTENAIRES:');
  columns.recordset.forEach(c => {
    console.log(`  - ${c.COLUMN_NAME} (${c.DATA_TYPE}${c.CHARACTER_MAXIMUM_LENGTH ? `(${c.CHARACTER_MAXIMUM_LENGTH})` : ''})`);
  });

  // Voir une ligne exemple
  const sample = await pool.request().query(`
    SELECT TOP 1 * FROM INFOSTRANSFERTPARTENAIRES
  `);

  console.log('\nExemple de données:');
  if (sample.recordset.length > 0) {
    console.log(JSON.stringify(sample.recordset[0], null, 2));
  }

  await pool.close();
}

checkTable().catch(console.error);
