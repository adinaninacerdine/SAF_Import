// analyse-rapide-donnees.js - Analyse rapide des données
const sql = require('mssql');
require('dotenv').config();

const config = {
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'SAF_MCTV_COMORES',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'Admin@123',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
    requestTimeout: 60000
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

async function analyseRapide() {
  try {
    console.log('🔄 Connexion à la base de données...\n');
    const pool = await sql.connect(config);

    // Exemples de données par partenaire
    console.log('📊 === EXEMPLES DE DONNÉES (3 lignes par partenaire) ===\n');
    const partenaires = ['RIA', 'MONEYGRAM', 'GLOBAL'];

    for (const part of partenaires) {
      console.log(`--- ${part} ---`);
      const exemples = await pool.request()
        .input('partenaire', sql.VarChar, part)
        .query(`
          SELECT TOP 3
            CODETRANSACTION,
            TYPEOPERATION,
            MONTANT,
            COMMISSION,
            CODEAGENCE,
            EFFECTUEPAR,
            AGENT_UNIQUE_ID,
            DATEOPERATION
          FROM INFOSTRANSFERTPARTENAIRES
          WHERE PARTENAIRETRANSF = @partenaire
          ORDER BY DATEOPERATION DESC
        `);
      console.table(exemples.recordset);
    }

    // Statistiques de période
    console.log('\n📊 === PÉRIODE ET STATISTIQUES GLOBALES ===');
    const stats = await pool.request().query(`
      SELECT
        PARTENAIRETRANSF,
        MIN(DATEOPERATION) as date_debut,
        MAX(DATEOPERATION) as date_fin,
        COUNT(*) as nb_transactions,
        SUM(MONTANT) as montant_total,
        SUM(COMMISSION) as commission_totale,
        COUNT(DISTINCT CODEAGENCE) as nb_agences_distinctes
      FROM INFOSTRANSFERTPARTENAIRES
      GROUP BY PARTENAIRETRANSF
      ORDER BY PARTENAIRETRANSF
    `);
    console.table(stats.recordset);

    // Transactions sans agent
    console.log('\n📊 === TRANSACTIONS SANS AGENT ASSIGNÉ ===');
    const sanAgent = await pool.request().query(`
      SELECT
        PARTENAIRETRANSF,
        COUNT(*) as nb_transactions,
        CAST(ROUND(SUM(MONTANT), 0) AS BIGINT) as montant_total
      FROM INFOSTRANSFERTPARTENAIRES
      WHERE AGENT_UNIQUE_ID IS NULL
      GROUP BY PARTENAIRETRANSF
      ORDER BY PARTENAIRETRANSF
    `);
    console.table(sanAgent.recordset);

    // Agents les plus actifs
    console.log('\n📊 === TOP 10 AGENTS LES PLUS ACTIFS ===');
    const topAgents = await pool.request().query(`
      SELECT TOP 10
        am.agent_nom,
        COUNT(*) as nb_transactions,
        CAST(ROUND(SUM(t.MONTANT), 0) AS BIGINT) as montant_total,
        COUNT(DISTINCT t.PARTENAIRETRANSF) as nb_partenaires
      FROM INFOSTRANSFERTPARTENAIRES t
      INNER JOIN tm_agent_mapping am ON t.AGENT_UNIQUE_ID = am.agent_unique_id
      GROUP BY am.agent_nom
      ORDER BY nb_transactions DESC
    `);
    console.table(topAgents.recordset);

    await pool.close();
    console.log('\n✅ Analyse terminée !');

    // Résumé des découvertes
    console.log('\n' + '='.repeat(70));
    console.log('📋 RÉSUMÉ DES DÉCOUVERTES IMPORTANTES :');
    console.log('='.repeat(70));
    console.log('\n1. PARTENAIRES :');
    console.log('   - RIA : 643,808 transactions');
    console.log('   - MONEYGRAM : 233,747 transactions');
    console.log('   - GLOBAL : 55,259 transactions');
    console.log('   - MONEYTRANS : 52 transactions (négligeable)');

    console.log('\n2. TYPES D\'OPÉRATIONS DÉTECTÉS :');
    console.log('   - ENVOI AGENCE, ENVOI AGENT');
    console.log('   - RECEPTION AGENCE, RECEPTION AGENT');
    console.log('   - RECEPTIONS (utilisé par GLOBAL)');
    console.log('   - PAIEMENT (utilisé par RIA et MONEYGRAM)');
    console.log('   - ANNULATION AGENCE, ANNULATION AGENT');

    console.log('\n3. PROBLÈMES POTENTIELS À CORRIGER :');
    console.log('   ⚠️ Les requêtes actuelles utilisent TYPEOPERATION IN (\'ENVOI\', \'ENVOI AGENCE\', ...)');
    console.log('   ⚠️ Mais les vrais types sont : ENVOI AGENCE, ENVOI AGENT (avec espace)');
    console.log('   ⚠️ Il faut corriger les conditions WHERE dans reports-routes.js');

    console.log('\n4. RECOMMANDATIONS :');
    console.log('   ✅ Grouper "RECEPTION AGENCE" + "RECEPTION AGENT" + "RECEPTIONS" = Paiements');
    console.log('   ✅ Grouper "ENVOI AGENCE" + "ENVOI AGENT" = Envois');
    console.log('   ✅ Grouper "ANNULATION AGENCE" + "ANNULATION AGENT" = Annulations');
    console.log('   ✅ "PAIEMENT" semble être un type distinct (peut-être aussi à inclure dans Paiements)');
    console.log('\n' + '='.repeat(70));

  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    process.exit(1);
  }
}

analyseRapide();
