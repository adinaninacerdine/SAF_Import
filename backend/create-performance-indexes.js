// create-performance-indexes.js - Créer les index pour optimiser les rapports
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
  },
  requestTimeout: 300000
};

async function createIndexes() {
  try {
    console.log('🔄 Connexion à la base de données...');
    const pool = await sql.connect(config);

    // Liste des index à créer
    const indexes = [
      {
        name: 'IX_INFOSTRANSFERTPARTENAIRES_AGENT_PARTENAIRE',
        table: 'INFOSTRANSFERTPARTENAIRES',
        columns: 'AGENT_UNIQUE_ID, PARTENAIRETRANSF',
        includes: 'CODEAGENCE, TYPEOPERATION, MONTANT, COMMISSION',
        description: 'Index principal pour les requêtes de rapport par partenaire'
      },
      {
        name: 'IX_INFOSTRANSFERTPARTENAIRES_PARTENAIRE_AGENCE',
        table: 'INFOSTRANSFERTPARTENAIRES',
        columns: 'PARTENAIRETRANSF, CODEAGENCE',
        includes: 'AGENT_UNIQUE_ID, TYPEOPERATION, MONTANT, COMMISSION',
        description: 'Index pour les requêtes groupées par agence'
      }
    ];

    for (const index of indexes) {
      console.log(`\n📊 Création de l'index: ${index.name}`);
      console.log(`   Description: ${index.description}`);

      // Vérifier si l'index existe déjà
      const checkResult = await pool.request().query(`
        SELECT COUNT(*) as nb
        FROM sys.indexes
        WHERE name = '${index.name}'
          AND object_id = OBJECT_ID('${index.table}')
      `);

      if (checkResult.recordset[0].nb > 0) {
        console.log(`   ⚠️ Index déjà existant, passage au suivant...`);
        continue;
      }

      // Créer l'index
      const createSQL = `
        CREATE NONCLUSTERED INDEX ${index.name}
        ON ${index.table}(${index.columns})
        INCLUDE (${index.includes})
      `;

      console.log(`   🔨 Exécution: ${createSQL.trim()}`);
      await pool.request().query(createSQL);
      console.log(`   ✅ Index créé avec succès`);
    }

    // Statistiques sur la table
    console.log('\n📊 STATISTIQUES DE LA TABLE:');
    console.log('   ═══════════════════════════════════');

    const stats = await pool.request().query(`
      SELECT
        COUNT(*) as nb_total,
        COUNT(CASE WHEN AGENT_UNIQUE_ID IS NOT NULL THEN 1 END) as nb_avec_agent,
        COUNT(CASE WHEN PARTENAIRETRANSF = 'MONEYGRAM' THEN 1 END) as nb_moneygram,
        COUNT(CASE WHEN PARTENAIRETRANSF = 'RIA' THEN 1 END) as nb_ria
      FROM INFOSTRANSFERTPARTENAIRES
    `);

    const s = stats.recordset[0];
    console.log(`   Total transactions: ${s.nb_total.toLocaleString('fr-FR')}`);
    console.log(`   Avec AGENT_UNIQUE_ID: ${s.nb_avec_agent.toLocaleString('fr-FR')}`);
    console.log(`   MoneyGram: ${s.nb_moneygram.toLocaleString('fr-FR')}`);
    console.log(`   RIA: ${s.nb_ria.toLocaleString('fr-FR')}`);

    // Lister tous les index sur la table
    console.log('\n📋 INDEX EXISTANTS SUR LA TABLE:');
    console.log('   ═══════════════════════════════════');

    const indexList = await pool.request().query(`
      SELECT
        i.name as index_name,
        i.type_desc,
        STRING_AGG(c.name, ', ') as columns
      FROM sys.indexes i
      INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
      WHERE i.object_id = OBJECT_ID('INFOSTRANSFERTPARTENAIRES')
        AND i.is_primary_key = 0
      GROUP BY i.name, i.type_desc
      ORDER BY i.name
    `);

    indexList.recordset.forEach(idx => {
      console.log(`   - ${idx.index_name} (${idx.type_desc})`);
      console.log(`     Colonnes: ${idx.columns}`);
    });

    await pool.close();
    console.log('\n✅ Optimisation terminée !');

  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

createIndexes();
