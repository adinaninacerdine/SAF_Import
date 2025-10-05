const sql = require('mssql');
require('dotenv').config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

(async () => {
  try {
    const pool = await sql.connect(config);

    console.log('🗑️  Nettoyage des imports récents...\n');

    // 1. Supprimer uniquement les imports de staging (table temporaire)
    const tempBefore = await pool.request().query(`
      SELECT COUNT(*) as total FROM temp_INFOSTRANSFERTPARTENAIRES
    `);

    console.log(`Table temporaire: ${tempBefore.recordset[0].total} lignes`);

    await pool.request().query(`
      TRUNCATE TABLE temp_INFOSTRANSFERTPARTENAIRES
    `);

    console.log('✅ Table temporaire vidée\n');

    // 2. Supprimer seulement les imports d'aujourd'hui en production
    const today = new Date().toISOString().split('T')[0];

    const prodToday = await pool.request()
      .input('today', sql.VarChar, today)
      .query(`
        SELECT COUNT(*) as total
        FROM INFOSTRANSFERTPARTENAIRES
        WHERE CAST(date_creation AS DATE) = @today
      `);

    console.log(`Imports d'aujourd'hui en production: ${prodToday.recordset[0].total} lignes`);

    if (prodToday.recordset[0].total > 0) {
      await pool.request()
        .input('today', sql.VarChar, today)
        .query(`
          DELETE FROM INFOSTRANSFERTPARTENAIRES
          WHERE CAST(date_creation AS DATE) = @today
        `);

      console.log('✅ Imports d\'aujourd\'hui supprimés de la production\n');
    }

    console.log('✅ Nettoyage terminé !');
    console.log('   Vous pouvez maintenant tester avec validation.\n');

    await pool.close();
  } catch(err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  }
})();
