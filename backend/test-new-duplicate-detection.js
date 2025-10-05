// test-new-duplicate-detection.js - Tester la nouvelle détection de doublons
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

    console.log('🧪 TEST DE LA NOUVELLE DÉTECTION DE DOUBLONS\n');
    console.log('═══════════════════════════════════════════════\n');

    // Cas de test: Le code RIA KM1990186727
    const testCode = 'KM1990186727';
    const testPartenaire = 'RIA';

    console.log(`📋 Code testé: ${testCode}\n`);

    const transactions = await pool.request()
      .input('code', sql.VarChar, testCode)
      .input('partenaire', sql.VarChar, testPartenaire)
      .query(`
        SELECT
          NUMERO,
          CODEENVOI,
          PARTENAIRETRANSF,
          MONTANT,
          DATEOPERATION,
          TYPEOPERATION,
          NOMPRENOMEXPEDITEUR,
          date_creation
        FROM INFOSTRANSFERTPARTENAIRES
        WHERE CODEENVOI = @code
          AND PARTENAIRETRANSF = @partenaire
        ORDER BY DATEOPERATION
      `);

    console.log(`✅ ${transactions.recordset.length} transactions trouvées:\n`);

    transactions.recordset.forEach((row, i) => {
      console.log(`   ${i + 1}. NUMERO: ${row.NUMERO}`);
      console.log(`      Type: ${row.TYPEOPERATION}`);
      console.log(`      Montant: ${row.MONTANT?.toLocaleString('fr-FR')} KMF`);
      console.log(`      Date opération: ${row.DATEOPERATION?.toLocaleString('fr-FR')}`);
      console.log(`      Expéditeur: ${row.NOMPRENOMEXPEDITEUR}`);
      console.log(`      Date import: ${row.date_creation?.toLocaleString('fr-FR')}\n`);
    });

    // Test de la logique de détection
    console.log('🔍 TEST DE LA LOGIQUE:\n');

    if (transactions.recordset.length === 2) {
      const r1 = transactions.recordset[0];
      const r2 = transactions.recordset[1];

      // Ancienne logique (CODEENVOI seul)
      const seraDetecteAvecAncienneLogique = r1.CODEENVOI === r2.CODEENVOI;

      // Nouvelle logique (CODEENVOI + PARTENAIRE + DATE)
      const seraDetecteAvecNouvelleLogique =
        r1.CODEENVOI === r2.CODEENVOI &&
        r1.PARTENAIRETRANSF === r2.PARTENAIRETRANSF &&
        r1.DATEOPERATION?.getTime() === r2.DATEOPERATION?.getTime();

      console.log(`   📌 Ancienne logique (CODEENVOI seul):`);
      console.log(`      → ${seraDetecteAvecAncienneLogique ? '🚨 DOUBLON détecté (BLOQUÉ)' : '✅ Pas de doublon (OK)'}\n`);

      console.log(`   📌 Nouvelle logique (CODEENVOI + PARTENAIRE + DATE):`);
      console.log(`      → ${seraDetecteAvecNouvelleLogique ? '🚨 DOUBLON détecté (BLOQUÉ)' : '✅ Pas de doublon (OK)'}\n`);

      console.log(`   ✨ RÉSULTAT:\n`);
      if (seraDetecteAvecAncienneLogique && !seraDetecteAvecNouvelleLogique) {
        console.log(`      ✅ SUCCÈS ! L'annulation peut maintenant être importée\n`);
        console.log(`      Raison: Même code mais dates différentes`);
        console.log(`         - Transaction 1: ${r1.DATEOPERATION?.toLocaleString('fr-FR')} (${r1.TYPEOPERATION})`);
        console.log(`         - Transaction 2: ${r2.DATEOPERATION?.toLocaleString('fr-FR')} (${r2.TYPEOPERATION})\n`);
      } else if (seraDetecteAvecNouvelleLogique) {
        console.log(`      ⚠️  DOUBLON RÉEL détecté - import bloqué (comportement attendu)\n`);
      }
    }

    // Statistiques globales
    console.log('\n═══════════════════════════════════════════════\n');
    console.log('📊 IMPACT ESTIMÉ SUR LA BASE:\n');

    const impact = await pool.request().query(`
      WITH GroupedTransactions AS (
        SELECT
          CODEENVOI,
          PARTENAIRETRANSF,
          DATEOPERATION,
          COUNT(*) as nb_meme_cle
        FROM INFOSTRANSFERTPARTENAIRES
        GROUP BY CODEENVOI, PARTENAIRETRANSF, DATEOPERATION
        HAVING COUNT(*) > 1
      )
      SELECT
        COUNT(*) as nb_vrais_doublons,
        SUM(nb_meme_cle) as nb_lignes_dupliquees
      FROM GroupedTransactions
    `);

    const stats = impact.recordset[0];
    console.log(`   Vrais doublons (avec nouvelle clé): ${stats.nb_vrais_doublons || 0}`);
    console.log(`   Lignes dupliquées: ${stats.nb_lignes_dupliquees || 0}\n`);

    // Annulations qui seraient maintenant acceptées
    const annulations = await pool.request().query(`
      WITH CodesWithMultipleDates AS (
        SELECT CODEENVOI, COUNT(DISTINCT DATEOPERATION) as nb_dates
        FROM INFOSTRANSFERTPARTENAIRES
        WHERE PARTENAIRETRANSF = 'RIA'
        GROUP BY CODEENVOI
        HAVING COUNT(DISTINCT DATEOPERATION) > 1
      )
      SELECT COUNT(*) as nb_codes_multi_dates
      FROM CodesWithMultipleDates
    `);

    console.log(`   Codes RIA avec plusieurs dates: ${annulations.recordset[0].nb_codes_multi_dates}`);
    console.log(`   → Ces annulations peuvent maintenant être importées séparément\n`);

    console.log('═══════════════════════════════════════════════\n');

    await pool.close();
  } catch(err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  }
})();
