// Script pour initialiser/vérifier la table temporaire
const sql = require('mssql');
require('dotenv').config();

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: true,
    trustServerCertificate: true,
    enableArithAbort: true
  }
};

async function initTempTable() {
  console.log('\n🔧 Initialisation de la table temporaire...\n');

  let pool;
  try {
    pool = await sql.connect(dbConfig);

    // Vérifier si temp_INFOSTRANSFERTPARTENAIRES existe
    const tableExists = await pool.request().query(`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = 'temp_INFOSTRANSFERTPARTENAIRES'
    `);

    if (tableExists.recordset.length === 0) {
      console.log('📋 Création de la table temp_INFOSTRANSFERTPARTENAIRES...');

      await pool.request().query(`
        CREATE TABLE temp_INFOSTRANSFERTPARTENAIRES (
          id INT IDENTITY(1,1) PRIMARY KEY,
          import_session_id VARCHAR(50) NOT NULL,
          NUMERO NUMERIC NULL,
          CODEENVOI VARCHAR(50) NULL,
          DATEOPERATION DATE NULL,
          TYPEOPERATION VARCHAR(50) NULL,
          NOMPRENOMEXPEDITEUR VARCHAR(250) NULL,
          NOMPRENOMBENEFICIAIRE VARCHAR(250) NULL,
          MONTANT NUMERIC NULL,
          COMMISSION NUMERIC NULL,
          TAXES NUMERIC NULL,
          PARTENAIRETRANSF VARCHAR(50) NULL,
          CODEAGENCE VARCHAR(50) NULL,
          EFFECTUEPAR VARCHAR(50) NULL,
          MONTANTTOTAL NUMERIC NULL,
          AGENT_UNIQUE_ID INT NULL,
          import_user_id VARCHAR(50) NULL,
          import_date DATETIME NULL,
          statut_validation VARCHAR(20) DEFAULT 'EN_ATTENTE',
          validation_user_id VARCHAR(50) NULL,
          validation_date DATETIME NULL,
          commentaire VARCHAR(500) NULL
        )
      `);

      console.log('✅ Table créée avec succès');
    } else {
      console.log('✅ Table temp_INFOSTRANSFERTPARTENAIRES existe déjà');

      // Vérifier et ajouter les colonnes manquantes
      const columns = await pool.request().query(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'temp_INFOSTRANSFERTPARTENAIRES'
      `);

      const columnNames = columns.recordset.map(c => c.COLUMN_NAME);

      if (!columnNames.includes('import_session_id')) {
        console.log('   Ajout de la colonne import_session_id...');
        await pool.request().query(`
          ALTER TABLE temp_INFOSTRANSFERTPARTENAIRES
          ADD import_session_id VARCHAR(50) NULL
        `);
      }

      if (!columnNames.includes('statut_validation')) {
        console.log('   Ajout de la colonne statut_validation...');
        await pool.request().query(`
          ALTER TABLE temp_INFOSTRANSFERTPARTENAIRES
          ADD statut_validation VARCHAR(20) DEFAULT 'EN_ATTENTE'
        `);
      }

      if (!columnNames.includes('AGENT_UNIQUE_ID')) {
        console.log('   Ajout de la colonne AGENT_UNIQUE_ID...');
        await pool.request().query(`
          ALTER TABLE temp_INFOSTRANSFERTPARTENAIRES
          ADD AGENT_UNIQUE_ID INT NULL
        `);
      }

      if (!columnNames.includes('import_user_id')) {
        console.log('   Ajout de la colonne import_user_id...');
        await pool.request().query(`
          ALTER TABLE temp_INFOSTRANSFERTPARTENAIRES
          ADD import_user_id VARCHAR(50) NULL
        `);
      }

      if (!columnNames.includes('import_date')) {
        console.log('   Ajout de la colonne import_date...');
        await pool.request().query(`
          ALTER TABLE temp_INFOSTRANSFERTPARTENAIRES
          ADD import_date DATETIME NULL
        `);
      }

      if (!columnNames.includes('validation_user_id')) {
        console.log('   Ajout de la colonne validation_user_id...');
        await pool.request().query(`
          ALTER TABLE temp_INFOSTRANSFERTPARTENAIRES
          ADD validation_user_id VARCHAR(50) NULL
        `);
      }

      if (!columnNames.includes('validation_date')) {
        console.log('   Ajout de la colonne validation_date...');
        await pool.request().query(`
          ALTER TABLE temp_INFOSTRANSFERTPARTENAIRES
          ADD validation_date DATETIME NULL
        `);
      }

      if (!columnNames.includes('commentaire')) {
        console.log('   Ajout de la colonne commentaire...');
        await pool.request().query(`
          ALTER TABLE temp_INFOSTRANSFERTPARTENAIRES
          ADD commentaire VARCHAR(500) NULL
        `);
      }

      console.log('✅ Table à jour');
    }

    // Afficher les statistiques
    const stats = await pool.request().query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN statut_validation = 'EN_ATTENTE' THEN 1 ELSE 0 END) as en_attente,
        SUM(CASE WHEN statut_validation = 'VALIDE' THEN 1 ELSE 0 END) as valides,
        SUM(CASE WHEN statut_validation = 'REJETE' THEN 1 ELSE 0 END) as rejetes
      FROM temp_INFOSTRANSFERTPARTENAIRES
    `);

    console.log('\n📊 Statistiques de la table temporaire:');
    console.log(`   Total: ${stats.recordset[0].total}`);
    console.log(`   En attente: ${stats.recordset[0].en_attente}`);
    console.log(`   Validés: ${stats.recordset[0].valides}`);
    console.log(`   Rejetés: ${stats.recordset[0].rejetes}`);

    await pool.close();
    console.log('\n✅ Initialisation terminée\n');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    if (pool) await pool.close();
    process.exit(1);
  }
}

if (require.main === module) {
  initTempTable().catch(console.error);
}

module.exports = { initTempTable };
