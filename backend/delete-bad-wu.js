// delete-bad-wu.js - Supprimer les 8 transactions WU avec mauvais montants
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

    console.log('🗑️  SUPPRESSION DES 8 TRANSACTIONS WU INCORRECTES\n');
    console.log('═══════════════════════════════════════════════\n');

    // 1. Afficher les transactions à supprimer
    const toDelete = await pool.request().query(`
      SELECT
        NUMERO,
        CODEENVOI,
        MONTANT,
        COMMISSION,
        EFFECTUEPAR,
        CODEAGENCE,
        date_creation
      FROM INFOSTRANSFERTPARTENAIRES
      WHERE PARTENAIRETRANSF = 'WESTERN_UNION'
        AND MONTANT > 100000000
      ORDER BY date_creation DESC
    `);

    if (toDelete.recordset.length === 0) {
      console.log('✅ Aucune transaction WU incorrecte à supprimer\n');
      await pool.close();
      return;
    }

    console.log(`⚠️  ${toDelete.recordset.length} transactions WU incorrectes à supprimer:\n`);
    toDelete.recordset.forEach((row, idx) => {
      console.log(`   ${idx + 1}. MTCN: ${row.CODEENVOI}`);
      console.log(`      Montant INCORRECT: ${row.MONTANT?.toLocaleString('fr-FR')} KMF`);
      console.log(`      NUMERO: ${row.NUMERO}`);
      console.log(`      Agence: ${row.CODEAGENCE}`);
      console.log(`      Agent: ${row.EFFECTUEPAR}\n`);
    });

    console.log('🔄 Suppression en cours...\n');

    // 2. Supprimer les transactions avec montants anormaux
    const result = await pool.request().query(`
      DELETE FROM INFOSTRANSFERTPARTENAIRES
      WHERE PARTENAIRETRANSF = 'WESTERN_UNION'
        AND MONTANT > 100000000
    `);

    console.log(`✅ ${result.rowsAffected[0]} transactions supprimées de la production\n`);

    // 3. Vérification
    const remaining = await pool.request().query(`
      SELECT COUNT(*) as total
      FROM INFOSTRANSFERTPARTENAIRES
      WHERE PARTENAIRETRANSF = 'WESTERN_UNION'
    `);

    console.log(`📊 Transactions Western Union restantes: ${remaining.recordset[0].total}\n`);
    console.log('✅ Nettoyage terminé !\n');
    console.log('🎯 Prochaine étape:');
    console.log('   - Uploadez à nouveau WESTERN_UNION_TEST.xlsx');
    console.log('   - Le parser corrigé utilisera les bons montants');
    console.log('   - Validez les transactions\n');
    console.log('═══════════════════════════════════════════════\n');

    await pool.close();
  } catch(err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  }
})();
