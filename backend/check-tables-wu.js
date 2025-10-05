// check-tables-wu.js - Vérifier les tables après import WU
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

    console.log('📊 VÉRIFICATION DES TABLES APRÈS IMPORT WU\n');
    console.log('═══════════════════════════════════════════════\n');

    // 1. Table temporaire
    console.log('📋 TABLE TEMPORAIRE (temp_INFOSTRANSFERTPARTENAIRES):\n');

    const tempResult = await pool.request().query(`
      SELECT TOP 10
        NUMERO,
        CODEENVOI,
        PARTENAIRETRANSF,
        MONTANT,
        COMMISSION,
        EFFECTUEPAR,
        CODEAGENCE,
        TYPEOPERATION,
        NOMPRENOMBENEFICIAIRE,
        statut_validation,
        import_session_id
      FROM temp_INFOSTRANSFERTPARTENAIRES
      ORDER BY import_date DESC
    `);

    if (tempResult.recordset.length > 0) {
      console.log(`   ✅ ${tempResult.recordset.length} transactions en staging:\n`);
      tempResult.recordset.forEach((row, idx) => {
        console.log(`   ${idx + 1}. MTCN: ${row.CODEENVOI}`);
        console.log(`      Partenaire: ${row.PARTENAIRETRANSF}`);
        console.log(`      Montant: ${row.MONTANT.toLocaleString('fr-FR')} KMF`);
        console.log(`      Commission: ${row.COMMISSION.toLocaleString('fr-FR')} KMF`);
        console.log(`      Agent: ${row.EFFECTUEPAR}`);
        console.log(`      Agence: ${row.CODEAGENCE}`);
        console.log(`      Type: ${row.TYPEOPERATION}`);
        console.log(`      Destination: ${row.NOMPRENOMBENEFICIAIRE}`);
        console.log(`      Statut: ${row.statut_validation}`);
        console.log(`      Session: ${row.import_session_id}\n`);
      });
    } else {
      console.log('   ⚠️ Aucune transaction en staging\n');
    }

    // 2. Statistiques par agence
    console.log('\n📍 RÉPARTITION PAR AGENCE:\n');
    const agenceStats = await pool.request().query(`
      SELECT
        CODEAGENCE,
        COUNT(*) as nb_trans,
        SUM(MONTANT) as montant_total,
        TYPEOPERATION
      FROM temp_INFOSTRANSFERTPARTENAIRES
      WHERE statut_validation = 'EN_ATTENTE'
      GROUP BY CODEAGENCE, TYPEOPERATION
      ORDER BY CODEAGENCE
    `);

    if (agenceStats.recordset.length > 0) {
      agenceStats.recordset.forEach(row => {
        console.log(`   Agence ${row.CODEAGENCE} (${row.TYPEOPERATION}): ${row.nb_trans} trans, ${row.montant_total.toLocaleString('fr-FR')} KMF`);
      });
    }

    // 3. Statistiques par partenaire
    console.log('\n\n💼 RÉPARTITION PAR PARTENAIRE:\n');
    const partStats = await pool.request().query(`
      SELECT
        PARTENAIRETRANSF,
        COUNT(*) as nb_trans,
        SUM(MONTANT) as montant_total
      FROM temp_INFOSTRANSFERTPARTENAIRES
      WHERE statut_validation = 'EN_ATTENTE'
      GROUP BY PARTENAIRETRANSF
    `);

    if (partStats.recordset.length > 0) {
      partStats.recordset.forEach(row => {
        console.log(`   ${row.PARTENAIRETRANSF}: ${row.nb_trans} trans, ${row.montant_total.toLocaleString('fr-FR')} KMF`);
      });
    }

    // 4. Sessions d'import
    console.log('\n\n🔄 SESSIONS D\'IMPORT EN ATTENTE:\n');
    const sessions = await pool.request().query(`
      SELECT
        import_session_id,
        import_user_id,
        MIN(import_date) as date_import,
        COUNT(*) as nb_trans,
        SUM(MONTANT) as montant_total
      FROM temp_INFOSTRANSFERTPARTENAIRES
      WHERE statut_validation = 'EN_ATTENTE'
      GROUP BY import_session_id, import_user_id
      ORDER BY MIN(import_date) DESC
    `);

    if (sessions.recordset.length > 0) {
      sessions.recordset.forEach(row => {
        console.log(`   Session: ${row.import_session_id.substring(0, 8)}...`);
        console.log(`   Utilisateur: ${row.import_user_id}`);
        console.log(`   Date: ${row.date_import.toLocaleString('fr-FR')}`);
        console.log(`   Transactions: ${row.nb_trans}`);
        console.log(`   Montant: ${row.montant_total.toLocaleString('fr-FR')} KMF\n`);
      });
    }

    console.log('\n═══════════════════════════════════════════════\n');

    await pool.close();
  } catch(err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  }
})();
