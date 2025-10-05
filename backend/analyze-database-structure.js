// Analyse de la structure de la base de données
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

async function analyzeDatabase() {
  console.log('\n📊 ANALYSE DE LA STRUCTURE DE LA BASE DE DONNÉES\n');
  console.log('='.repeat(80));

  let pool;

  try {
    pool = await sql.connect(dbConfig);
    console.log('✅ Connecté à SQL Server\n');

    // 1. Lister toutes les tables
    console.log('1️⃣ TABLES EXISTANTES:');
    console.log('-'.repeat(80));

    const tables = await pool.request().query(`
      SELECT
        TABLE_SCHEMA,
        TABLE_NAME,
        TABLE_TYPE
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `);

    tables.recordset.forEach(table => {
      console.log(`   📁 ${table.TABLE_SCHEMA}.${table.TABLE_NAME}`);
    });

    // 2. Chercher les tables de staging/validation/temporaires
    console.log('\n2️⃣ RECHERCHE DE TABLES DE STAGING/VALIDATION:');
    console.log('-'.repeat(80));

    const stagingTables = tables.recordset.filter(t =>
      t.TABLE_NAME.toLowerCase().includes('staging') ||
      t.TABLE_NAME.toLowerCase().includes('temp') ||
      t.TABLE_NAME.toLowerCase().includes('tmp') ||
      t.TABLE_NAME.toLowerCase().includes('validation') ||
      t.TABLE_NAME.toLowerCase().includes('pending') ||
      t.TABLE_NAME.toLowerCase().includes('import_temp')
    );

    if (stagingTables.length > 0) {
      console.log('   ✅ Tables de staging trouvées:');
      stagingTables.forEach(t => console.log(`      - ${t.TABLE_NAME}`));
    } else {
      console.log('   ⚠️  Aucune table de staging trouvée');
    }

    // 3. Analyser les tables de déduplication des agents
    console.log('\n3️⃣ TABLES DE DÉDUPLICATION DES AGENTS:');
    console.log('-'.repeat(80));

    const agentTables = tables.recordset.filter(t =>
      t.TABLE_NAME.toLowerCase().includes('agent') ||
      t.TABLE_NAME.toLowerCase().includes('tm_')
    );

    for (const table of agentTables) {
      console.log(`\n   📋 ${table.TABLE_NAME}:`);

      const columns = await pool.request().query(`
        SELECT
          COLUMN_NAME,
          DATA_TYPE,
          CHARACTER_MAXIMUM_LENGTH,
          IS_NULLABLE,
          COLUMN_DEFAULT
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = '${table.TABLE_NAME}'
        ORDER BY ORDINAL_POSITION
      `);

      columns.recordset.forEach(col => {
        const type = col.CHARACTER_MAXIMUM_LENGTH
          ? `${col.DATA_TYPE}(${col.CHARACTER_MAXIMUM_LENGTH})`
          : col.DATA_TYPE;
        const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
        console.log(`      - ${col.COLUMN_NAME}: ${type} ${nullable}`);
      });

      // Compter les enregistrements
      const count = await pool.request().query(`SELECT COUNT(*) as cnt FROM ${table.TABLE_NAME}`);
      console.log(`      📊 Nombre d'enregistrements: ${count.recordset[0].cnt}`);
    }

    // 4. Analyser la table principale INFOSTRANSFERTPARTENAIRES
    console.log('\n4️⃣ TABLE PRINCIPALE DES TRANSACTIONS:');
    console.log('-'.repeat(80));

    const mainTable = await pool.request().query(`
      SELECT
        COLUMN_NAME,
        DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH,
        IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'INFOSTRANSFERTPARTENAIRES'
      ORDER BY ORDINAL_POSITION
    `);

    console.log('\n   📋 INFOSTRANSFERTPARTENAIRES:');
    mainTable.recordset.forEach(col => {
      const type = col.CHARACTER_MAXIMUM_LENGTH
        ? `${col.DATA_TYPE}(${col.CHARACTER_MAXIMUM_LENGTH})`
        : col.DATA_TYPE;
      const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
      console.log(`      - ${col.COLUMN_NAME}: ${type} ${nullable}`);
    });

    // Statistiques
    const stats = await pool.request().query(`
      SELECT
        COUNT(*) as total,
        COUNT(DISTINCT PARTENAIRETRANSF) as partenaires,
        COUNT(DISTINCT CODEAGENCE) as agences,
        MIN(DATEOPERATION) as date_min,
        MAX(DATEOPERATION) as date_max
      FROM INFOSTRANSFERTPARTENAIRES
    `);

    const s = stats.recordset[0];
    console.log(`\n   📊 Statistiques:`);
    console.log(`      - Total transactions: ${s.total}`);
    console.log(`      - Partenaires: ${s.partenaires}`);
    console.log(`      - Agences: ${s.agences}`);
    console.log(`      - Période: ${s.date_min} → ${s.date_max}`);

    // 5. Vérifier les index et contraintes
    console.log('\n5️⃣ INDEX ET CONTRAINTES:');
    console.log('-'.repeat(80));

    const indexes = await pool.request().query(`
      SELECT
        i.name as index_name,
        t.name as table_name,
        c.name as column_name,
        i.is_unique,
        i.is_primary_key
      FROM sys.indexes i
      JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
      JOIN sys.tables t ON i.object_id = t.object_id
      WHERE t.name IN ('INFOSTRANSFERTPARTENAIRES', 'tm_agent_mapping', 'tm_agent_codes')
      ORDER BY t.name, i.name, ic.key_ordinal
    `);

    let currentIndex = null;
    indexes.recordset.forEach(idx => {
      if (idx.index_name !== currentIndex) {
        const unique = idx.is_unique ? '🔑 UNIQUE' : '';
        const pk = idx.is_primary_key ? '🔐 PRIMARY KEY' : '';
        console.log(`\n   📌 ${idx.table_name}.${idx.index_name} ${pk} ${unique}`);
        currentIndex = idx.index_name;
      }
      console.log(`      - ${idx.column_name}`);
    });

    // 6. Recommandations
    console.log('\n6️⃣ RECOMMANDATIONS:');
    console.log('-'.repeat(80));

    if (stagingTables.length === 0) {
      console.log('\n   ⚠️  RECOMMANDATION: Créer une table de staging pour validation');
      console.log('      Avantages:');
      console.log('      - Permet de valider les imports avant insertion définitive');
      console.log('      - Facilite la correction des erreurs');
      console.log('      - Permet un workflow d\'approbation');
    }

    // Vérifier si AGENT_UNIQUE_ID existe
    const hasAgentUniqueId = mainTable.recordset.some(col =>
      col.COLUMN_NAME === 'AGENT_UNIQUE_ID'
    );

    if (!hasAgentUniqueId) {
      console.log('\n   ⚠️  RECOMMANDATION: Ajouter la colonne AGENT_UNIQUE_ID');
      console.log('      - Permet de lier les transactions aux agents unifiés');
      console.log('      - Facilite les statistiques par agent');
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Analyse terminée');
    console.log('='.repeat(80) + '\n');

    await pool.close();

  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    if (pool) await pool.close();
  }
}

analyzeDatabase().catch(console.error);
