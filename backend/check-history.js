// check-history.js - Vérifier l'historique des validations
const sql = require('mssql');
require('dotenv').config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

(async () => {
  try {
    const pool = await sql.connect(config);

    console.log('📜 HISTORIQUE DES VALIDATIONS\n');
    console.log('═══════════════════════════════════════════════\n');

    // 1. Compter les transactions validées dans la table temporaire
    const validatedTemp = await pool.request().query(`
      SELECT
        COUNT(*) as total,
        SUM(MONTANT) as montant_total,
        MIN(validation_date) as premiere_validation,
        MAX(validation_date) as derniere_validation
      FROM temp_INFOSTRANSFERTPARTENAIRES
      WHERE statut_validation = 'VALIDE'
    `);

    console.log('📋 TABLE TEMPORAIRE (transactions validées):');
    if (validatedTemp.recordset[0].total > 0) {
      console.log(`   ✅ ${validatedTemp.recordset[0].total} transactions validées`);
      console.log(`   💰 Montant: ${validatedTemp.recordset[0].montant_total?.toLocaleString('fr-FR') || 0} KMF`);
      console.log(`   📅 Première: ${validatedTemp.recordset[0].premiere_validation?.toLocaleString('fr-FR') || 'N/A'}`);
      console.log(`   📅 Dernière: ${validatedTemp.recordset[0].derniere_validation?.toLocaleString('fr-FR') || 'N/A'}\n`);
    } else {
      console.log('   ⚠️ Aucune transaction validée dans la table temporaire\n');
    }

    // 2. Transactions dans la table principale (production)
    const production = await pool.request().query(`
      SELECT
        COUNT(*) as total,
        SUM(MONTANT) as montant_total,
        MIN(date_creation) as premiere,
        MAX(date_creation) as derniere
      FROM INFOSTRANSFERTPARTENAIRES
    `);

    console.log('📊 TABLE PRINCIPALE (production):');
    console.log(`   ✅ ${production.recordset[0].total} transactions au total`);
    console.log(`   💰 Montant: ${production.recordset[0].montant_total?.toLocaleString('fr-FR') || 0} KMF`);
    console.log(`   📅 Première: ${production.recordset[0].premiere?.toLocaleString('fr-FR') || 'N/A'}`);
    console.log(`   📅 Dernière: ${production.recordset[0].derniere?.toLocaleString('fr-FR') || 'N/A'}\n`);

    // 3. Transactions Western Union en production
    const westernUnion = await pool.request().query(`
      SELECT
        COUNT(*) as total,
        SUM(MONTANT) as montant_total,
        MIN(date_creation) as premiere,
        MAX(date_creation) as derniere
      FROM INFOSTRANSFERTPARTENAIRES
      WHERE PARTENAIRETRANSF = 'WESTERN_UNION'
    `);

    console.log('🌍 WESTERN UNION (production):');
    if (westernUnion.recordset[0].total > 0) {
      console.log(`   ✅ ${westernUnion.recordset[0].total} transactions`);
      console.log(`   💰 Montant: ${westernUnion.recordset[0].montant_total?.toLocaleString('fr-FR') || 0} KMF`);
      console.log(`   📅 Première: ${westernUnion.recordset[0].premiere?.toLocaleString('fr-FR') || 'N/A'}`);
      console.log(`   📅 Dernière: ${westernUnion.recordset[0].derniere?.toLocaleString('fr-FR') || 'N/A'}\n`);
    } else {
      console.log('   ⚠️ Aucune transaction Western Union en production\n');
    }

    // 4. Dernières transactions WU en production
    const lastWU = await pool.request().query(`
      SELECT TOP 10
        NUMERO,
        CODEENVOI,
        MONTANT,
        COMMISSION,
        EFFECTUEPAR,
        CODEAGENCE,
        TYPEOPERATION,
        date_creation
      FROM INFOSTRANSFERTPARTENAIRES
      WHERE PARTENAIRETRANSF = 'WESTERN_UNION'
      ORDER BY date_creation DESC
    `);

    if (lastWU.recordset.length > 0) {
      console.log('📋 DERNIÈRES TRANSACTIONS WU EN PRODUCTION:\n');
      lastWU.recordset.forEach((row, idx) => {
        console.log(`   ${idx + 1}. MTCN: ${row.CODEENVOI}`);
        console.log(`      Montant: ${row.MONTANT?.toLocaleString('fr-FR')} KMF`);
        console.log(`      Commission: ${row.COMMISSION?.toLocaleString('fr-FR')} KMF`);
        console.log(`      Agent: ${row.EFFECTUEPAR}`);
        console.log(`      Agence: ${row.CODEAGENCE}`);
        console.log(`      Type: ${row.TYPEOPERATION}`);
        console.log(`      Créé: ${row.date_creation?.toLocaleString('fr-FR')}\n`);
      });
    }

    // 5. Sessions validées dans temp
    const sessions = await pool.request().query(`
      SELECT
        import_session_id,
        validation_user_id,
        MIN(validation_date) as validation_date,
        COUNT(*) as nb_trans,
        SUM(MONTANT) as montant_total
      FROM temp_INFOSTRANSFERTPARTENAIRES
      WHERE statut_validation = 'VALIDE'
      GROUP BY import_session_id, validation_user_id
      ORDER BY MIN(validation_date) DESC
    `);

    if (sessions.recordset.length > 0) {
      console.log('\n🔄 SESSIONS VALIDÉES (historique temp):\n');
      sessions.recordset.forEach(row => {
        console.log(`   Session: ${row.import_session_id.substring(0, 8)}...`);
        console.log(`   Validé par: ${row.validation_user_id}`);
        console.log(`   Date: ${row.validation_date?.toLocaleString('fr-FR')}`);
        console.log(`   Transactions: ${row.nb_trans}`);
        console.log(`   Montant: ${row.montant_total?.toLocaleString('fr-FR')} KMF\n`);
      });
    }

    console.log('═══════════════════════════════════════════════\n');

    await pool.close();
  } catch(err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  }
})();
