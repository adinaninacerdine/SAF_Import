// check-code-uniqueness.js - Vérifier si les codes peuvent être réutilisés
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

    console.log('🔍 VÉRIFICATION UNICITÉ DES CODES\n');
    console.log('═══════════════════════════════════════════════\n');

    // 1. Vérifier si un CODEENVOI apparaît plusieurs fois
    const duplicates = await pool.request().query(`
      SELECT
        CODEENVOI,
        COUNT(*) as nb_occurrences,
        MIN(date_creation) as premiere_date,
        MAX(date_creation) as derniere_date
      FROM INFOSTRANSFERTPARTENAIRES
      GROUP BY CODEENVOI
      HAVING COUNT(*) > 1
    `);

    if (duplicates.recordset.length > 0) {
      console.log(`⚠️  ${duplicates.recordset.length} CODES RÉUTILISÉS DÉTECTÉS:\n`);

      for (const dup of duplicates.recordset.slice(0, 10)) {
        console.log(`   Code: ${dup.CODEENVOI}`);
        console.log(`      Utilisé ${dup.nb_occurrences} fois`);
        console.log(`      Première: ${dup.premiere_date?.toLocaleString('fr-FR')}`);
        console.log(`      Dernière: ${dup.derniere_date?.toLocaleString('fr-FR')}`);

        // Détails de ce code
        const details = await pool.request()
          .input('code', sql.VarChar, dup.CODEENVOI)
          .query(`
            SELECT PARTENAIRETRANSF, MONTANT, date_creation
            FROM INFOSTRANSFERTPARTENAIRES
            WHERE CODEENVOI = @code
            ORDER BY date_creation
          `);

        details.recordset.forEach((d, i) => {
          console.log(`      ${i+1}. ${d.PARTENAIRETRANSF} - ${d.MONTANT?.toLocaleString('fr-FR')} KMF - ${d.date_creation?.toLocaleString('fr-FR')}`);
        });
        console.log('');
      }

      if (duplicates.recordset.length > 10) {
        console.log(`   ... et ${duplicates.recordset.length - 10} autres\n`);
      }
    } else {
      console.log('✅ Aucun code réutilisé détecté\n');
      console.log('   Tous les CODEENVOI (MTCN, PIN, etc.) sont UNIQUES\n');
    }

    // 2. Statistiques par partenaire
    console.log('\n📊 STATISTIQUES PAR PARTENAIRE:\n');
    const stats = await pool.request().query(`
      SELECT
        PARTENAIRETRANSF,
        COUNT(DISTINCT CODEENVOI) as codes_uniques,
        COUNT(*) as total_lignes,
        CASE
          WHEN COUNT(DISTINCT CODEENVOI) = COUNT(*) THEN 'OUI ✅'
          ELSE 'NON ⚠️'
        END as tous_uniques
      FROM INFOSTRANSFERTPARTENAIRES
      GROUP BY PARTENAIRETRANSF
    `);

    stats.recordset.forEach(row => {
      console.log(`   ${row.PARTENAIRETRANSF || 'NULL'}:`);
      console.log(`      Codes uniques: ${row.codes_uniques}`);
      console.log(`      Total lignes: ${row.total_lignes}`);
      console.log(`      Tous uniques: ${row.tous_uniques}\n`);
    });

    console.log('═══════════════════════════════════════════════\n');

    await pool.close();
  } catch(err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  }
})();
