const sql = require('mssql');
require('dotenv').config();

async function check() {
  const pool = await sql.connect({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: 'localhost',
    database: process.env.DB_NAME,
    options: { encrypt: false, trustServerCertificate: true }
  });

  const result = await pool.request().query(`
    SELECT
      c.COLUMN_NAME,
      c.IS_NULLABLE,
      c.DATA_TYPE,
      COLUMNPROPERTY(OBJECT_ID(c.TABLE_NAME), c.COLUMN_NAME, 'IsIdentity') as IS_IDENTITY
    FROM INFORMATION_SCHEMA.COLUMNS c
    WHERE c.TABLE_NAME = 'INFOSTRANSFERTPARTENAIRES'
    AND c.COLUMN_NAME = 'NUMERO'
  `);

  console.log(result.recordset[0]);

  await pool.close();
}

check().catch(console.error);
