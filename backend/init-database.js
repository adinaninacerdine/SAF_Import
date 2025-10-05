// init-database.js - Script pour initialiser la base de données
const sql = require('mssql');
require('dotenv').config();

const config = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER || 'localhost\\MCTVTEST',
  database: process.env.DB_NAME || 'SAF_MCTV_COMORES',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true
  }
};

async function initDatabase() {
  let pool;
  
  try {
    console.log('🔌 Connexion à la base de données...');
    pool = await sql.connect(config);
    console.log('✅ Connecté avec succès\n');
    
    // 1. Vérifier/Créer INFOSTRANSFERTPARTENAIRES
    console.log('📊 Vérification de INFOSTRANSFERTPARTENAIRES...');
    const tableExists = await pool.request().query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = 'INFOSTRANSFERTPARTENAIRES'
    `);
    
    if (tableExists.recordset[0].count === 0) {
      console.log('Création de la table...');
      await pool.request().query(`
        CREATE TABLE INFOSTRANSFERTPARTENAIRES (
          ID INT IDENTITY(1,1) PRIMARY KEY,
          CODETRANSACTION VARCHAR(50),
          PARTENAIRETRANSF VARCHAR(50),
          MONTANT DECIMAL(18,2),
          COMMISSION DECIMAL(18,2),
          EFFECTUEPAR VARCHAR(50),
          AGENT_UNIQUE_ID INT,
          DATEOPERATION DATETIME,
          EXPEDITEUR NVARCHAR(200),
          BENEFICIAIRE NVARCHAR(200),
          CODEAGENCE VARCHAR(20),
          STATUT VARCHAR(20),
          DATEIMPORT DATETIME DEFAULT GETDATE(),
          INDEX IX_CODETRANSACTION (CODETRANSACTION),
          INDEX IX_DATEOPERATION (DATEOPERATION),
          INDEX IX_AGENT_UNIQUE_ID (AGENT_UNIQUE_ID)
        )
      `);
      console.log('✅ Table créée');
    } else {
      console.log('✅ Table existe déjà');
      
      // Ajouter colonnes manquantes si nécessaire
      try {
        await pool.request().query(`
          IF NOT EXISTS (
            SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'INFOSTRANSFERTPARTENAIRES' 
            AND COLUMN_NAME = 'AGENT_UNIQUE_ID'
          )
          ALTER TABLE INFOSTRANSFERTPARTENAIRES ADD AGENT_UNIQUE_ID INT
        `);
      } catch (e) {}
    }
    
    // 2. Créer les tables de déduplication
    console.log('\n📊 Vérification des tables de déduplication...');
    const mappingExists = await pool.request().query(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'tm_agent_mapping'
    `);
    
    if (mappingExists.recordset[0].count === 0) {
      console.log('Création des tables de mapping...');
      
      await pool.request().query(`
        CREATE TABLE tm_agent_mapping (
          agent_unique_id INT IDENTITY(1,1) PRIMARY KEY,
          agent_nom NVARCHAR(250) NOT NULL,
          agent_nom_normalise NVARCHAR(250),
          date_creation DATETIME DEFAULT GETDATE(),
          statut VARCHAR(20) DEFAULT 'ACTIF',
          INDEX IX_agent_nom_normalise (agent_nom_normalise)
        )
      `);
      
      await pool.request().query(`
        CREATE TABLE tm_agent_codes (
          id INT IDENTITY(1,1) PRIMARY KEY,
          agent_unique_id INT FOREIGN KEY REFERENCES tm_agent_mapping(agent_unique_id),
          code_user VARCHAR(50),
          code_agence VARCHAR(50),
          date_ajout DATETIME DEFAULT GETDATE(),
          INDEX IX_code_user (code_user),
          UNIQUE(code_user)
        )
      `);
      
      console.log('✅ Tables de déduplication créées');
    } else {
      console.log('✅ Tables de déduplication existent');
    }
    
    // 3. Créer le dossier uploads
    const fs = require('fs').promises;
    const uploadDir = process.env.UPLOAD_DIR || 'uploads';
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      console.log(`\n✅ Dossier ${uploadDir}/ créé ou vérifié`);
    } catch (e) {
      console.log(`⚠️ Impossible de créer ${uploadDir}/:`, e.message);
    }
    
    // 4. Statistiques
    console.log('\n📈 STATISTIQUES DE LA BASE');
    console.log('========================================');
    
    const stats = await pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM UTILISATEURSl) as nb_utilisateurs,
        (SELECT COUNT(*) FROM AGENCES) as nb_agences,
        (SELECT COUNT(*) FROM INFOSTRANSFERTPARTENAIRES) as nb_transactions,
        (SELECT COUNT(*) FROM tm_agent_mapping) as nb_agents_unifies
    `);
    
    const s = stats.recordset[0];
    console.log(`Utilisateurs: ${s.nb_utilisateurs}`);
    console.log(`Agences: ${s.nb_agences}`);
    console.log(`Transactions: ${s.nb_transactions}`);
    console.log(`Agents unifiés: ${s.nb_agents_unifies}`);
    
    console.log('\n✅ Base de données prête !');
    console.log('\n📝 Prochaines étapes:');
    console.log('1. npm start              - Démarrer le serveur');
    console.log('2. cd client && npm start - Démarrer le frontend');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
      console.log('\n🔌 Connexion fermée');
    }
  }
}

// Exécuter
console.log('========================================');
console.log('   INITIALISATION DE LA BASE DE DONNÉES');
console.log('========================================\n');

initDatabase().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Erreur fatale:', err);
  process.exit(1);
});