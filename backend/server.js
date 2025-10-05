// server.js - Serveur complet avec gestion sécurisée des uploads et déduplication
const express = require('express');
const cors = require('cors');
const sql = require('mssql');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();

// Importer les modules personnalisés
const { ImportHandler, upload } = require('./import-handler');
const AgentDeduplicationService = require('./agent-deduplication');
const validationRoutes = require('./validation-routes');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'saf-secret-key-2024';

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuration SQL Server
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

let pool;
let importHandler;
let agentService;

// Initialisation de la base de données
async function initDatabase() {
  try {
    pool = await sql.connect(dbConfig);
    console.log('✅ Connecté à SQL Server');

    // Initialiser les services
    agentService = new AgentDeduplicationService(pool);
    await agentService.initialize();

    importHandler = new ImportHandler(pool, agentService);
    await importHandler.initialize();
    
    // Vérifier les tables importantes
    const tables = await pool.request().query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME IN ('UTILISATEURS', 'INFOSTRANSFERTPARTENAIRES')
    `);
    
    console.log('📊 Tables trouvées:', tables.recordset.map(t => t.TABLE_NAME).join(', '));
    
    return pool;
  } catch (error) {
    console.error('❌ Erreur de connexion:', error);
    process.exit(1);
  }
}

// Middleware d'authentification
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Token manquant' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token invalide' });
  }
}

// Fonction pour déterminer le rôle
function getUserRole(codeUser, nom) {
  if (codeUser && codeUser.startsWith('SAF')) {
    return 'ADMIN';
  }
  if (nom) {
    const upperNom = nom.toUpperCase();
    if (upperNom.includes('SUPERVISOR') || upperNom.includes('ADMINISTRADOR')) {
      return 'ADMIN';
    }
  }
  return 'USER';
}

// ===== ROUTES D'AUTHENTIFICATION =====

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    console.log(`🔐 Tentative de connexion: ${username}`);
    
    const result = await pool.request()
      .input('username', sql.VarChar, username.toUpperCase())
      .query(`
        SELECT 
          u.CODEUSER,
          u.MOTPASSE,
          u.NOM,
          u.CODEAGENCE,
          a.LIBELLEAGENCE as nom_agence
        FROM UTILISATEURSl u
        LEFT JOIN AGENCES a ON u.CODEAGENCE = a.CODEAGENCE
        WHERE UPPER(u.CODEUSER) = @username
      `);
    
    if (result.recordset.length === 0) {
      return res.status(401).json({ error: 'Utilisateur non trouvé' });
    }
    
    const user = result.recordset[0];
    
    // Vérifier le mot de passe
    let isValid = false;
    if (user.MOTPASSE && user.MOTPASSE.startsWith('$2')) {
      isValid = await bcrypt.compare(password, user.MOTPASSE);
    } else {
      isValid = (password === user.MOTPASSE);
    }
    
    if (!isValid) {
      return res.status(401).json({ error: 'Mot de passe incorrect' });
    }
    
    const role = getUserRole(user.CODEUSER, user.NOM);
    
    const token = jwt.sign(
      { 
        userId: user.CODEUSER,
        username: user.CODEUSER,
        fullName: user.NOM,
        agenceCode: user.CODEAGENCE,
        agenceName: user.nom_agence,
        role: role
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );
    
    console.log(`✅ Connexion réussie: ${user.CODEUSER}`);
    
    res.json({
      success: true,
      token,
      user: {
        username: user.CODEUSER,
        fullName: user.NOM,
        agenceCode: user.CODEAGENCE,
        agenceName: user.nom_agence,
        role: role
      }
    });
    
  } catch (error) {
    console.error('Erreur login:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.get('/api/auth/verify', authMiddleware, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// ===== ROUTES PRINCIPALES =====

// Obtenir les agences
app.get('/api/agences', authMiddleware, async (req, res) => {
  try {
    const result = await pool.request()
      .query(`
        SELECT
          CODEAGENCE as code_agence,
          LIBELLEAGENCE as nom_agence,
          CODEAGENCE as agence_id
        FROM AGENCES
        ORDER BY CODEAGENCE
      `);
    
    res.json(result.recordset);
  } catch (error) {
    console.error('Erreur récupération agences:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtenir les agents d'une agence
app.get('/api/agences/:agenceId/agents', authMiddleware, async (req, res) => {
  try {
    const result = await pool.request()
      .input('agence_id', sql.VarChar, req.params.agenceId)
      .query(`
        SELECT DISTINCT
          u.CODEUSER as agent_id,
          u.CODEUSER as code_agent,
          u.NOM as nom_complet,
          am.agent_unique_id
        FROM UTILISATEURSl u
        LEFT JOIN tm_agent_codes ac ON u.CODEUSER = ac.code_user
        LEFT JOIN tm_agent_mapping am ON ac.agent_unique_id = am.agent_unique_id
        WHERE u.CODEAGENCE = @agence_id
        ORDER BY u.NOM
      `);
    
    res.json(result.recordset);
  } catch (error) {
    console.error('Erreur récupération agents:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== ROUTE D'IMPORT SÉCURISÉE =====

app.post('/api/import', authMiddleware, upload.single('file'), async (req, res) => {
  console.log('\n📁 NOUVELLE REQUÊTE D\'IMPORT');
  console.log('========================================');

  let filePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    filePath = req.file.path;
    const { partnerName, agenceId, useValidation } = req.body;
    const userId = req.user.userId;

    console.log(`📋 Fichier: ${req.file.originalname}`);
    console.log(`📊 Taille: ${(req.file.size / 1024).toFixed(2)} KB`);
    console.log(`📍 Agence: ${agenceId}`);
    console.log(`👤 Utilisateur: ${userId}`);
    console.log(`✅ Mode validation: ${useValidation ? 'OUI' : 'NON'}`);

    // Validation
    if (!agenceId) {
      return res.status(400).json({ error: 'Agence requise' });
    }

    // Parser le fichier
    console.log('\n🔄 Analyse du fichier...');
    const parseResult = await importHandler.parseFile(filePath);

    console.log(`✅ ${parseResult.transactions.length} transactions trouvées`);
    console.log(`📊 Format détecté: ${parseResult.type || partnerName || 'AUTO'}`);

    let importResult;

    // Import avec ou sans validation
    if (useValidation === 'true' || useValidation === true) {
      console.log('\n📋 Import en staging (validation requise)...');
      const { v4: uuidv4 } = require('uuid');
      const importSessionId = uuidv4();

      importResult = await importHandler.importToStaging(
        parseResult.transactions,
        agenceId,
        userId,
        importSessionId
      );

      importResult.importSessionId = importSessionId;
      importResult.requiresValidation = true;
    } else {
      console.log('\n💾 Import direct dans la base de données...');
      importResult = await importHandler.importTransactions(
        parseResult.transactions,
        agenceId,
        userId
      );
      importResult.requiresValidation = false;
    }
    
    // Nettoyer le fichier temporaire
    const fs = require('fs').promises;
    await fs.unlink(filePath);
    console.log('🗑️ Fichier temporaire supprimé');
    
    console.log('\n📊 RÉSUMÉ:');
    console.log(`✅ Importées: ${importResult.success}`);
    console.log(`⚠️ Doublons: ${importResult.duplicates}`);
    console.log(`❌ Erreurs: ${importResult.errors}`);
    console.log(`👥 Agents unifiés: ${importResult.agentsUnifies}`);
    console.log(`💰 Montant total: ${importResult.totalAmount.toFixed(2)}`);

    if (importResult.requiresValidation) {
      console.log(`🔄 Session d'import: ${importResult.importSessionId}`);
      console.log('⏳ En attente de validation...');
    }

    res.json({
      success: true,
      totalRecords: parseResult.transactions.length,
      successCount: importResult.success,
      duplicates: importResult.duplicates,
      errors: importResult.errors,
      agentsUnifies: importResult.agentsUnifies,
      totalAmount: importResult.totalAmount,
      errorDetails: importResult.errorDetails,
      requiresValidation: importResult.requiresValidation,
      importSessionId: importResult.importSessionId
    });
    
  } catch (error) {
    console.error('❌ Erreur import:', error);
    
    // Nettoyer le fichier en cas d'erreur
    if (filePath) {
      try {
        const fs = require('fs').promises;
        await fs.unlink(filePath);
      } catch (e) {
        // Ignorer
      }
    }
    
    res.status(500).json({ 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Historique des imports
app.get('/api/imports/history', authMiddleware, async (req, res) => {
  try {
    const result = await pool.request()
      .query(`
        SELECT TOP 50
          ID,
          PARTENAIRETRANSF as partner_name,
          COUNT(*) as total_records,
          SUM(MONTANT) as total_amount,
          MIN(DATEOPERATION) as date_debut,
          MAX(DATEOPERATION) as date_fin,
          COUNT(DISTINCT AGENT_UNIQUE_ID) as agents_uniques
        FROM INFOSTRANSFERTPARTENAIRES
        WHERE DATEOPERATION >= DATEADD(MONTH, -3, GETDATE())
        GROUP BY ID, PARTENAIRETRANSF
        ORDER BY MAX(DATEOPERATION) DESC
      `);
    
    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dashboard stats
app.get('/api/dashboard/stats', authMiddleware, async (req, res) => {
  try {
    const stats = {};
    
    // Stats du jour
    const todayStats = await pool.request()
      .query(`
        SELECT 
          COUNT(*) as transactions_jour,
          COUNT(DISTINCT AGENT_UNIQUE_ID) as agents_actifs,
          ISNULL(SUM(MONTANT), 0) as volume_jour,
          ISNULL(SUM(COMMISSION), 0) as commissions_jour
        FROM INFOSTRANSFERTPARTENAIRES
        WHERE CAST(DATEOPERATION AS DATE) = CAST(GETDATE() AS DATE)
      `);
    
    stats.today = todayStats.recordset[0];
    
    // Stats du mois
    const monthStats = await pool.request()
      .query(`
        SELECT 
          COUNT(*) as transactions_mois,
          COUNT(DISTINCT AGENT_UNIQUE_ID) as agents_uniques,
          ISNULL(SUM(MONTANT), 0) as volume_mois
        FROM INFOSTRANSFERTPARTENAIRES
        WHERE MONTH(DATEOPERATION) = MONTH(GETDATE())
          AND YEAR(DATEOPERATION) = YEAR(GETDATE())
      `);
    
    stats.month = monthStats.recordset[0];
    
    // Top agents (unifiés)
    const topAgents = await pool.request()
      .query(`
        SELECT TOP 10
          am.agent_nom as nom_agent,
          COUNT(*) as nb_transactions,
          SUM(t.MONTANT) as volume_total
        FROM INFOSTRANSFERTPARTENAIRES t
        INNER JOIN tm_agent_mapping am ON t.AGENT_UNIQUE_ID = am.agent_unique_id
        WHERE MONTH(t.DATEOPERATION) = MONTH(GETDATE())
        GROUP BY am.agent_unique_id, am.agent_nom
        ORDER BY COUNT(*) DESC
      `);
    
    stats.topAgents = topAgents.recordset;
    
    res.json(stats);
    
  } catch (error) {
    console.error('Erreur stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Templates
app.get('/api/templates/:partner', authMiddleware, (req, res) => {
  const { partner } = req.params;
  
  const templates = {
    'MONEYGRAM': 'MTCN,Sender Name,Receiver Name,Principal Amount Paid Out,Commission,Date/Time Paid,Operator',
    'RIA': 'PIN,Sender,Beneficiary,Payout Amount,Commission,Paid Date,User',
    'WESTERN_UNION': 'Date Creation,Date Paiement,MTCN,Agence,Expediteur,Beneficiaire,Code Agent,Montant Source,Devise,Montant Paye,Devise Paiement'
  };
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=template_${partner}.csv`);
  res.send(templates[partner] || templates['MONEYGRAM']);
});

// Routes de validation
app.use('/api/validation', validationRoutes(pool, importHandler, authMiddleware));

// Route par défaut
app.get('/', (req, res) => {
  res.json({
    message: 'API SAF Import',
    version: '2.0.0',
    status: 'running',
    security: 'enabled'
  });
});

// Gestion des erreurs globales
app.use((err, req, res, next) => {
  console.error('Erreur globale:', err);
  res.status(500).json({ 
    error: 'Erreur serveur',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Une erreur est survenue'
  });
});

// Démarrage du serveur
async function startServer() {
  await initDatabase();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔════════════════════════════════════════╗
║      SAF IMPORT - SERVEUR SÉCURISÉ     ║
╠════════════════════════════════════════╣
║  ✅ Port: ${PORT}                      ║
║  📊 Base: ${dbConfig.database}         ║
║  🔐 Auth: Comptes SAF                  ║
║  🔄 Déduplication: Activée             ║
║  📁 Upload: Sécurisé                   ║
╚════════════════════════════════════════╝
    `);
  });
}

process.on('SIGINT', async () => {
  console.log('\n⚡ Arrêt du serveur...');
  if (pool) await pool.close();
  process.exit(0);
});

startServer().catch(console.error);