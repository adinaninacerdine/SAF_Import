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
    // Vérifier si déjà initialisé
    const existingCount = await this.pool.request().query(`
      SELECT COUNT(*) as count FROM tm_agent_mapping
    `);

    if (existingCount.recordset[0].count > 0) {
      console.log(`✅ Déduplication déjà initialisée (${existingCount.recordset[0].count} agents)`);
      return;
    }

    const users = await this.pool.request().query(`
      SELECT DISTINCT CODEUSER, NOM, CODEAGENCE
      FROM UTILISATEURSSAF
      WHERE NOM IS NOT NULL AND NOM != ''
      ORDER BY NOM
    `);

    const nameToId = new Map();
    let created = 0;
    let unified = 0;

    for (const user of users.recordset) {
      const normalizedName = this.normalizeName(user.NOM);
      if (!normalizedName) continue;

      let agentUniqueId;

      if (nameToId.has(normalizedName)) {
        // Agent existe déjà, réutiliser son ID
        agentUniqueId = nameToId.get(normalizedName);
        unified++;
      } else {
        // Vérifier si un agent avec ce nom normalisé existe déjà dans la table
        const existing = await this.pool.request()
          .input('nom_normalise', sql.NVarChar, normalizedName)
          .query(`
            SELECT agent_unique_id
            FROM tm_agent_mapping
            WHERE agent_nom_normalise = @nom_normalise
          `);

        if (existing.recordset.length > 0) {
          // Réutiliser l'agent existant
          agentUniqueId = existing.recordset[0].agent_unique_id;
          nameToId.set(normalizedName, agentUniqueId);
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
          created++;
        }
      }

      // Ajouter le lien code -> agent (seulement si pas déjà existant)
      try {
        await this.pool.request()
          .input('agent_unique_id', sql.Int, agentUniqueId)
          .input('code_user', sql.VarChar, user.CODEUSER)
          .input('code_agence', sql.VarChar, user.CODEAGENCE)
          .query(`
            IF NOT EXISTS (SELECT 1 FROM tm_agent_codes WHERE code_user = @code_user)
            INSERT INTO tm_agent_codes (agent_unique_id, code_user, code_agence)
            VALUES (@agent_unique_id, @code_user, @code_agence)
          `);
      } catch (e) {
        // Erreur si code déjà existant
      }
    }

    console.log(`✅ Unification terminée: ${created} agents créés, ${unified} codes unifiés`);
  }

  async getOrCreateAgent(codeUser, nomAgent = null, codeAgence = '') {
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
            INSERT INTO tm_agent_mapping (agent_nom, agent_nom_normalise, statut)
            VALUES (@nom, @nom_normalise, 'ACTIF');
            SELECT SCOPE_IDENTITY() as id;
          `);

        agentUniqueId = result.recordset[0].id;
      }

      // Lier le code à l'agent
      try {
        await this.pool.request()
          .input('agent_unique_id', sql.Int, agentUniqueId)
          .input('code_user', sql.VarChar, codeUser)
          .input('code_agence', sql.VarChar, codeAgence || '')
          .query(`
            IF NOT EXISTS (SELECT 1 FROM tm_agent_codes WHERE code_user = @code_user)
            INSERT INTO tm_agent_codes (agent_unique_id, code_user, code_agence)
            VALUES (@agent_unique_id, @code_user, @code_agence)
          `);
      } catch (e) {
        // Déjà existant
      }

      this.agentCache.set(codeUser, agentUniqueId);
      return agentUniqueId;
    }

    // Si pas de nom fourni (code inconnu comme MRAIZ00)
    // Créer un agent temporaire avec le code comme nom
    // Marquer comme INCONNU pour permettre liaison manuelle plus tard
    const normalizedCode = this.normalizeName(codeUser);

    const tempAgent = await this.pool.request()
      .input('nom', sql.NVarChar, codeUser)
      .input('nom_normalise', sql.NVarChar, normalizedCode)
      .query(`
        INSERT INTO tm_agent_mapping (agent_nom, agent_nom_normalise, statut)
        VALUES (@nom, @nom_normalise, 'INCONNU');
        SELECT SCOPE_IDENTITY() as id;
      `);

    const agentUniqueId = tempAgent.recordset[0].id;

    // Lier le code
    try {
      await this.pool.request()
        .input('agent_unique_id', sql.Int, agentUniqueId)
        .input('code_user', sql.VarChar, codeUser)
        .input('code_agence', sql.VarChar, codeAgence || '')
        .query(`
          INSERT INTO tm_agent_codes (agent_unique_id, code_user, code_agence)
          VALUES (@agent_unique_id, @code_user, @code_agence)
        `);
    } catch (e) {
      // Déjà existant
    }

    this.agentCache.set(codeUser, agentUniqueId);

    console.log(`⚠️  Code agent inconnu créé: ${codeUser} → agent_unique_id ${agentUniqueId} (INCONNU)`);

    return agentUniqueId;
  }

  /**
   * Lie un code agent inconnu à un agent existant
   */
  async linkUnknownCodeToAgent(codeUser, targetAgentId) {
    // Trouver l'agent inconnu actuel
    const currentCode = await this.pool.request()
      .input('code_user', sql.VarChar, codeUser)
      .query(`
        SELECT agent_unique_id
        FROM tm_agent_codes
        WHERE code_user = @code_user
      `);

    if (currentCode.recordset.length === 0) {
      throw new Error(`Code ${codeUser} non trouvé`);
    }

    const oldAgentId = currentCode.recordset[0].agent_unique_id;

    // Mettre à jour le code pour pointer vers le nouvel agent
    await this.pool.request()
      .input('code_user', sql.VarChar, codeUser)
      .input('new_agent_id', sql.Int, targetAgentId)
      .query(`
        UPDATE tm_agent_codes
        SET agent_unique_id = @new_agent_id
        WHERE code_user = @code_user
      `);

    // Supprimer l'ancien agent temporaire s'il n'a plus de codes liés
    const remainingCodes = await this.pool.request()
      .input('agent_id', sql.Int, oldAgentId)
      .query(`
        SELECT COUNT(*) as count
        FROM tm_agent_codes
        WHERE agent_unique_id = @agent_id
      `);

    if (remainingCodes.recordset[0].count === 0) {
      await this.pool.request()
        .input('agent_id', sql.Int, oldAgentId)
        .query(`DELETE FROM tm_agent_mapping WHERE agent_unique_id = @agent_id`);
    }

    // Invalider le cache
    this.agentCache.delete(codeUser);

    console.log(`✅ Code ${codeUser} lié à l'agent ${targetAgentId}`);
  }
}

module.exports = AgentDeduplicationService;