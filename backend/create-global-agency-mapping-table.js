// create-global-agency-mapping-table.js
// Crée la table de mapping agent-agence pour les imports Global

const sql = require('mssql');

const dbConfig = {
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'SAF_MCTV_COMORES',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'Admin@123',
  options: {
    encrypt: true,
    trustServerCertificate: true,
    enableArithAbort: true
  }
};

async function createGlobalAgencyMappingTable() {
  let pool;
  try {
    console.log('🔌 Connexion à la base de données...');
    pool = await sql.connect(dbConfig);

    console.log('\n📋 Création table tm_global_agent_agency_mapping...');

    // Créer la table de mapping agent-agence pour Global
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'tm_global_agent_agency_mapping')
      BEGIN
        CREATE TABLE tm_global_agent_agency_mapping (
          id INT IDENTITY(1,1) PRIMARY KEY,
          agent_unique_id INT NOT NULL,
          code_agence VARCHAR(50) NOT NULL,
          date_debut DATE NOT NULL,
          date_fin DATE NOT NULL,
          import_session_id VARCHAR(50),
          notes NVARCHAR(500),
          created_by VARCHAR(50),
          date_creation DATETIME DEFAULT GETDATE(),
          FOREIGN KEY (agent_unique_id) REFERENCES tm_agent_mapping(agent_unique_id)
        );

        CREATE INDEX idx_global_agent_agency_agent ON tm_global_agent_agency_mapping(agent_unique_id);
        CREATE INDEX idx_global_agent_agency_dates ON tm_global_agent_agency_mapping(date_debut, date_fin);

        PRINT '✅ Table tm_global_agent_agency_mapping créée avec succès';
      END
      ELSE
      BEGIN
        PRINT '⚠️ Table tm_global_agent_agency_mapping existe déjà';
      END
    `);

    console.log('✅ Table de mapping agent-agence Global créée avec succès!\n');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    throw error;
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

// Exécution si appelé directement
if (require.main === module) {
  createGlobalAgencyMappingTable()
    .then(() => {
      console.log('✅ Script terminé avec succès');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erreur fatale:', error);
      process.exit(1);
    });
}

module.exports = { createGlobalAgencyMappingTable };
