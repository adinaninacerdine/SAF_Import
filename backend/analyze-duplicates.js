// analyze-duplicates.js - Analyser les doublons en détail
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

    console.log('🔍 ANALYSE DÉTAILLÉE DES DOUBLONS\n');
    console.log('═══════════════════════════════════════════════\n');

    // Analyser les 2 cas suspects
    const cases = ['KM1990186727', 'KM603138913'];

    for (const code of cases) {
      console.log(`\n📋 Code: ${code}\n`);

      const details = await pool.request()
        .input('code', sql.VarChar, code)
        .query(`
          SELECT
            NUMERO,
            CODEENVOI,
            PARTENAIRETRANSF,
            MONTANT,
            COMMISSION,
            DATEOPERATION,
            date_creation,
            EFFECTUEPAR,
            CODEAGENCE,
            NOMPRENOMEXPEDITEUR,
            NOMPRENOMBENEFICIAIRE,
            TYPEOPERATION
          FROM INFOSTRANSFERTPARTENAIRES
          WHERE CODEENVOI = @code
          ORDER BY date_creation
        `);

      details.recordset.forEach((row, i) => {
        console.log(`   Occurrence ${i + 1}:`);
        console.log(`      NUMERO: ${row.NUMERO}`);
        console.log(`      Montant: ${row.MONTANT?.toLocaleString('fr-FR')} KMF`);
        console.log(`      Commission: ${row.COMMISSION?.toLocaleString('fr-FR')} KMF`);
        console.log(`      Date opération: ${row.DATEOPERATION?.toLocaleString('fr-FR')}`);
        console.log(`      Date import: ${row.date_creation?.toLocaleString('fr-FR')}`);
        console.log(`      Agent: ${row.EFFECTUEPAR}`);
        console.log(`      Agence: ${row.CODEAGENCE}`);
        console.log(`      Type: ${row.TYPEOPERATION}`);
        console.log(`      Expéditeur: ${row.NOMPRENOMEXPEDITEUR}`);
        console.log(`      Bénéficiaire: ${row.NOMPRENOMBENEFICIAIRE}\n`);
      });

      // Comparer les 2 occurrences
      if (details.recordset.length === 2) {
        const r1 = details.recordset[0];
        const r2 = details.recordset[1];

        console.log(`   🔍 Comparaison:`);
        console.log(`      Même montant: ${r1.MONTANT === r2.MONTANT ? 'OUI ✅' : 'NON ❌'}`);
        console.log(`      Même commission: ${r1.COMMISSION === r2.COMMISSION ? 'OUI ✅' : 'NON ❌'}`);
        console.log(`      Même date opération: ${r1.DATEOPERATION?.getTime() === r2.DATEOPERATION?.getTime() ? 'OUI ✅' : 'NON ❌'}`);
        console.log(`      Même agent: ${r1.EFFECTUEPAR === r2.EFFECTUEPAR ? 'OUI ✅' : 'NON ❌'}`);
        console.log(`      Même agence: ${r1.CODEAGENCE === r2.CODEAGENCE ? 'OUI ✅' : 'NON ❌'}`);
        console.log(`      Même expéditeur: ${r1.NOMPRENOMEXPEDITEUR === r2.NOMPRENOMEXPEDITEUR ? 'OUI ✅' : 'NON ❌'}`);
        console.log(`      Même bénéficiaire: ${r1.NOMPRENOMBENEFICIAIRE === r2.NOMPRENOMBENEFICIAIRE ? 'OUI ✅' : 'NON ❌'}`);

        const diffJours = Math.abs((r2.date_creation - r1.date_creation) / (1000 * 60 * 60 * 24));
        console.log(`      Délai entre imports: ${diffJours.toFixed(1)} jours`);

        // Conclusion
        const toutIdentique =
          r1.MONTANT === r2.MONTANT &&
          r1.COMMISSION === r2.COMMISSION &&
          r1.DATEOPERATION?.getTime() === r2.DATEOPERATION?.getTime() &&
          r1.EFFECTUEPAR === r2.EFFECTUEPAR &&
          r1.NOMPRENOMEXPEDITEUR === r2.NOMPRENOMEXPEDITEUR &&
          r1.NOMPRENOMBENEFICIAIRE === r2.NOMPRENOMBENEFICIAIRE;

        console.log(`\n      ⚖️ Verdict: ${toutIdentique ? '🚨 VRAI DOUBLON (même fichier importé 2x)' : '⚠️ TRANSACTION DIFFÉRENTE (même code réutilisé)'}\n`);
      }
    }

    // Statistiques globales
    console.log('\n═══════════════════════════════════════════════\n');
    console.log('📊 STATISTIQUES DES DOUBLONS RIA:\n');

    const stats = await pool.request().query(`
      WITH Doublons AS (
        SELECT CODEENVOI, COUNT(*) as nb
        FROM INFOSTRANSFERTPARTENAIRES
        WHERE PARTENAIRETRANSF = 'RIA'
        GROUP BY CODEENVOI
        HAVING COUNT(*) > 1
      )
      SELECT
        COUNT(*) as nb_codes_doubles,
        SUM(nb) as nb_total_lignes,
        SUM(nb) - COUNT(*) as nb_lignes_en_trop
      FROM Doublons
    `);

    const s = stats.recordset[0];
    console.log(`   Codes RIA en doublon: ${s.nb_codes_doubles?.toLocaleString('fr-FR')}`);
    console.log(`   Total de lignes: ${s.nb_total_lignes?.toLocaleString('fr-FR')}`);
    console.log(`   Lignes en trop: ${s.nb_lignes_en_trop?.toLocaleString('fr-FR')}`);

    console.log('\n═══════════════════════════════════════════════\n');

    await pool.close();
  } catch(err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  }
})();
