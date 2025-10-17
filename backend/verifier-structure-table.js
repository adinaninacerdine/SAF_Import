// verifier-structure-table.js - Vérifier la structure exacte de la table
const sql = require('mssql');
require('dotenv').config();

const config = {
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'SAF_MCTV_COMORES',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'Admin@123',
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function verifierStructure() {
  try {
    const pool = await sql.connect(config);

    console.log('📋 Structure de la table INFOSTRANSFERTPARTENAIRES:\n');

    const structure = await pool.request().query(`
      SELECT
        COLUMN_NAME,
        DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH,
        IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'INFOSTRANSFERTPARTENAIRES'
      ORDER BY ORDINAL_POSITION
    `);

    console.table(structure.recordset);

    console.log('\n📊 Exemple de données (1 ligne) :\n');
    const exemple = await pool.request().query(`
      SELECT TOP 1 * FROM INFOSTRANSFERTPARTENAIRES
    `);

    if (exemple.recordset.length > 0) {
      const row = exemple.recordset[0];
      Object.keys(row).forEach(key => {
        console.log(`${key}: ${row[key]}`);
      });
    }

    await pool.close();

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

verifierStructure();
