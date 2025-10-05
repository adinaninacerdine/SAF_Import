// agent-deduplication.js - Gestion complète de l'unicité des agents
const sql = require('mssql');

class AgentDeduplicationService {
  constructor(pool) {
    this.pool = pool;
    this.agentCache = new Map();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    console.log('Initialisation du service de déduplication...');
    
    // Créer les tables si nécessaire
    await this.createTables();
    
    // Unifier les agents existants
    await this.unifyExistingAgents();
    
    this.initialized = true;
    console.log('✅ Service de déduplication prêt');
  }

  async createTables() {
    // Table mapping agents
    const mappingExists = await this.pool.request().query(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'tm_agent_mapping'
    `);
    
    if (mappingExists.recordset[0].count === 0) {
      await this.pool.request().query(`
        CREATE TABLE tm_agent_mapping (
          agent_unique_id INT IDENTITY(1,1) PRIMARY KEY,
          agent_nom NVARCHAR(250) NOT NULL,
          agent_nom_normalise NVARCHAR(250),
          date_creation DATETIME DEFAULT GETDATE(),
          statut VARCHAR(20) DEFAULT 'ACTIF',
          INDEX IX_agent_nom_normalise (agent_nom_normalise)
        )
      `);
      
      await this.pool.request().query(`
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
      
      console.log('✅ Tables de mapping créées');
    }
    
    // Ajouter colonnes à INFOSTRANSFERTPARTENAIRES si nécessaire
    try {
      await this.pool.request().query(`
        IF NOT EXISTS (
          SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = 'INFOSTRANSFERTPARTENAIRES' 
          AND COLUMN_NAME = 'AGENT_UNIQUE_ID'
        )
        ALTER TABLE INFOSTRANSFERTPARTENAIRES ADD AGENT_UNIQUE_ID INT
      `);
    } catch (e) {
      // Colonne existe déjà
    }
  }

  normalizeName(name) {
    if (!name) return '';
    
    return name
      .toUpperCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[0-9]+$/, '')
      .replace(/\([^)]*\)/g, '')
      .replace(/[^A-Z\s]/g, '')
      .trim();
  }

  async unifyExistingAgents() {
    const users = await this.pool.request().query(`
      SELECT DISTINCT CODEUSER, NOM, CODEAGENCE 
      FROM UTILISATEURSl 
      WHERE NOM IS NOT NULL AND NOM != ''
      ORDER BY NOM
    `);
    
    const nameToId = new Map();
    let unified = 0;
    
    for (const user of users.recordset) {
      const normalizedName = this.normalizeName(user.NOM);
      if (!normalizedName) continue;
      
      let agentUniqueId;
      
      if (nameToId.has(normalizedName)) {
        agentUniqueId = nameToId.get(normalizedName);
        unified++;
      } else {
        // Créer nouvel agent
        const result = await this.pool.request()
          .input('nom', sql.NVarChar, user.NOM)
          .input('nom_normalise', sql.NVarChar, normalizedName)
          .query(`
            INSERT INTO tm_agent_mapping (agent_nom, agent_nom_normalise)
            VALUES (@nom, @nom_normalise);
            SELECT SCOPE_IDENTITY() as id;
          `);
        
        agentUniqueId = result.recordset[0].id;
        nameToId.set(normalizedName, agentUniqueId);
      }
      
      // Ajouter le lien code -> agent
      try {
        await this.pool.request()
          .input('agent_unique_id', sql.Int, agentUniqueId)
          .input('code_user', sql.VarChar, user.CODEUSER)
          .input('code_agence', sql.VarChar, user.CODEAGENCE)
          .query(`
            INSERT INTO tm_agent_codes (agent_unique_id, code_user, code_agence)
            VALUES (@agent_unique_id, @code_user, @code_agence)
          `);
      } catch (e) {
        // Déjà existant
      }
    }
    
    console.log(`✅ ${unified} agents unifiés`);
  }

  async getOrCreateAgent(codeUser, nomAgent = null) {
    // Vérifier le cache
    if (this.agentCache.has(codeUser)) {
      return this.agentCache.get(codeUser);
    }
    
    // Chercher par code
    let result = await this.pool.request()
      .input('code_user', sql.VarChar, codeUser)
      .query(`
        SELECT agent_unique_id 
        FROM tm_agent_codes 
        WHERE code_user = @code_user
      `);
    
    if (result.recordset.length > 0) {
      const id = result.recordset[0].agent_unique_id;
      this.agentCache.set(codeUser, id);
      return id;
    }
    
    // Si pas trouvé et on a un nom, créer ou trouver par nom
    if (nomAgent) {
      const normalizedName = this.normalizeName(nomAgent);
      
      // Chercher par nom normalisé
      result = await this.pool.request()
        .input('nom_normalise', sql.NVarChar, normalizedName)
        .query(`
          SELECT agent_unique_id 
          FROM tm_agent_mapping 
          WHERE agent_nom_normalise = @nom_normalise
        `);
      
      let agentUniqueId;
      
      if (result.recordset.length > 0) {
        agentUniqueId = result.recordset[0].agent_unique_id;
      } else {
        // Créer nouvel agent
        result = await this.pool.request()
          .input('nom', sql.NVarChar, nomAgent)
          .input('nom_normalise', sql.NVarChar, normalizedName)
          .query(`
            INSERT INTO tm_agent_mapping (agent_nom, agent_nom_normalise)
            VALUES (@nom, @nom_normalise);
            SELECT SCOPE_IDENTITY() as id;
          `);
        
        agentUniqueId = result.recordset[0].id;
      }
      
      // Lier le code à l'agent
      try {
        await this.pool.request()
          .input('agent_unique_id', sql.Int, agentUniqueId)
          .input('code_user', sql.VarChar, codeUser)
          .query(`
            INSERT INTO tm_agent_codes (agent_unique_id, code_user, code_agence)
            VALUES (@agent_unique_id, @code_user, '')
          `);
      } catch (e) {
        // Déjà existant
      }
      
      this.agentCache.set(codeUser, agentUniqueId);
      return agentUniqueId;
    }
    
    return null;
  }
}

module.exports = AgentDeduplicationService;