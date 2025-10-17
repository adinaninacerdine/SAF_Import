// analyse-structure-donnees.js - Analyser la structure des données dans INFOSTRANSFERTPARTENAIRES
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
    enableArithAbort: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

async function analyseStructureDonnees() {
  try {
    console.log('🔄 Connexion à la base de données...\n');
    const pool = await sql.connect(config);

    // 1. Vérifier les partenaires disponibles
    console.log('📊 === PARTENAIRES DISPONIBLES ===');
    const partenaires = await pool.request().query(`
      SELECT DISTINCT PARTENAIRETRANSF, COUNT(*) as nb_transactions
      FROM INFOSTRANSFERTPARTENAIRES
      GROUP BY PARTENAIRETRANSF
      ORDER BY PARTENAIRETRANSF
    `);
    console.table(partenaires.recordset);

    // 2. Vérifier les types d'opérations disponibles
    console.log('\n📊 === TYPES D\'OPÉRATIONS DISPONIBLES ===');
    const typesOperations = await pool.request().query(`
      SELECT DISTINCT TYPEOPERATION, PARTENAIRETRANSF, COUNT(*) as nb_occurrences
      FROM INFOSTRANSFERTPARTENAIRES
      GROUP BY TYPEOPERATION, PARTENAIRETRANSF
      ORDER BY PARTENAIRETRANSF, TYPEOPERATION
    `);
    console.table(typesOperations.recordset);

    // 3. Vérifier les codes agences disponibles
    console.log('\n📊 === CODES AGENCES DISPONIBLES ===');
    const codesAgences = await pool.request().query(`
      SELECT
        t.CODEAGENCE,
        a.DES_AGENCIA,
        COUNT(*) as nb_transactions,
        COUNT(DISTINCT t.PARTENAIRETRANSF) as nb_partenaires
      FROM INFOSTRANSFERTPARTENAIRES t
      LEFT JOIN CF.CF_AGENCIAS a ON t.CODEAGENCE = a.COD_AGENCIA
      WHERE t.CODEAGENCE IS NOT NULL
      GROUP BY t.CODEAGENCE, a.DES_AGENCIA
      ORDER BY
        CASE
          WHEN TRY_CAST(t.CODEAGENCE AS INT) IS NOT NULL
          THEN CAST(t.CODEAGENCE AS INT)
          ELSE 9999
        END
    `);
    console.log('\nAgences principales (001-020):');
    console.table(codesAgences.recordset.filter(r => {
      const code = parseInt(r.CODEAGENCE);
      return code >= 1 && code <= 20;
    }));

    console.log('\nSous-agences (>= 100):');
    console.table(codesAgences.recordset.filter(r => {
      const code = parseInt(r.CODEAGENCE);
      return code >= 100;
    }));

    // 4. Vérifier les agents uniques mappés
    console.log('\n📊 === AGENTS UNIQUES (via tm_agent_mapping) ===');
    const agentsUniques = await pool.request().query(`
      SELECT TOP 20
        am.agent_unique_id,
        am.agent_nom,
        am.agent_nom_normalise,
        COUNT(DISTINCT ac.code_user) as nb_codes,
        COUNT(t.ID) as nb_transactions
      FROM tm_agent_mapping am
      LEFT JOIN tm_agent_codes ac ON am.agent_unique_id = ac.agent_unique_id
      LEFT JOIN INFOSTRANSFERTPARTENAIRES t ON am.agent_unique_id = t.AGENT_UNIQUE_ID
      GROUP BY am.agent_unique_id, am.agent_nom, am.agent_nom_normalise
      ORDER BY nb_transactions DESC
    `);
    console.table(agentsUniques.recordset);

    // 5. Vérifier les transactions sans agent assigné
    console.log('\n📊 === TRANSACTIONS SANS AGENT ASSIGNÉ ===');
    const sanAgent = await pool.request().query(`
      SELECT
        PARTENAIRETRANSF,
        COUNT(*) as nb_transactions,
        SUM(MONTANT) as montant_total
      FROM INFOSTRANSFERTPARTENAIRES
      WHERE AGENT_UNIQUE_ID IS NULL
      GROUP BY PARTENAIRETRANSF
      ORDER BY PARTENAIRETRANSF
    `);
    console.table(sanAgent.recordset);

    // 6. Exemple de données brutes pour chaque partenaire
    console.log('\n📊 === EXEMPLES DE DONNÉES BRUTES (5 premières lignes par partenaire) ===');
    const partenairesListe = ['RIA', 'MONEYGRAM', 'GLOBAL'];

    for (const part of partenairesListe) {
      console.log(`\n--- ${part} ---`);
      const exemples = await pool.request()
        .input('partenaire', sql.VarChar, part)
        .query(`
          SELECT TOP 5
            ID,
            CODETRANSACTION,
            PARTENAIRETRANSF,
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

    // 7. Statistiques de période
    console.log('\n📊 === PÉRIODE DES DONNÉES ===');
    const periode = await pool.request().query(`
      SELECT
        PARTENAIRETRANSF,
        MIN(DATEOPERATION) as date_debut,
        MAX(DATEOPERATION) as date_fin,
        COUNT(*) as nb_transactions,
        SUM(MONTANT) as montant_total,
        SUM(COMMISSION) as commission_totale
      FROM INFOSTRANSFERTPARTENAIRES
      GROUP BY PARTENAIRETRANSF
      ORDER BY PARTENAIRETRANSF
    `);
    console.table(periode.recordset);

    await pool.close();
    console.log('\n✅ Analyse terminée !');

  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

analyseStructureDonnees();
