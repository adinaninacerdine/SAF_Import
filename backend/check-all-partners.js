// check-all-partners.js - Vérifier les montants de tous les partenaires
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

    console.log('📊 VÉRIFICATION DES MONTANTS PAR PARTENAIRE\n');
    console.log('═══════════════════════════════════════════════\n');

    // 1. Statistiques par partenaire
    const stats = await pool.request().query(`
      SELECT
        PARTENAIRETRANSF,
        COUNT(*) as nb_trans,
        MIN(MONTANT) as montant_min,
        MAX(MONTANT) as montant_max,
        AVG(MONTANT) as montant_moy,
        SUM(MONTANT) as montant_total
      FROM INFOSTRANSFERTPARTENAIRES
      GROUP BY PARTENAIRETRANSF
      ORDER BY PARTENAIRETRANSF
    `);

    console.log('📈 STATISTIQUES PAR PARTENAIRE:\n');
    stats.recordset.forEach(row => {
      console.log(`🔹 ${row.PARTENAIRETRANSF || 'NULL'}:`);
      console.log(`   Transactions: ${row.nb_trans}`);
      console.log(`   Min: ${row.montant_min?.toLocaleString('fr-FR')} KMF`);
      console.log(`   Max: ${row.montant_max?.toLocaleString('fr-FR')} KMF`);
      console.log(`   Moyenne: ${row.montant_moy?.toLocaleString('fr-FR')} KMF`);
      console.log(`   Total: ${row.montant_total?.toLocaleString('fr-FR')} KMF\n`);
    });

    // 2. Transactions suspectes (montant > 100 millions)
    const suspect = await pool.request().query(`
      SELECT
        NUMERO,
        CODEENVOI,
        PARTENAIRETRANSF,
        MONTANT,
        COMMISSION,
        EFFECTUEPAR,
        CODEAGENCE,
        TYPEOPERATION,
        date_creation
      FROM INFOSTRANSFERTPARTENAIRES
      WHERE MONTANT > 100000000
      ORDER BY MONTANT DESC
    `);

    if (suspect.recordset.length > 0) {
      console.log('⚠️  TRANSACTIONS SUSPECTES (montant > 100 millions KMF):\n');
      suspect.recordset.forEach((row, idx) => {
        console.log(`   ${idx + 1}. 🚨 MONTANT ANORMAL: ${row.MONTANT?.toLocaleString('fr-FR')} KMF`);
        console.log(`      MTCN/Code: ${row.CODEENVOI}`);
        console.log(`      Partenaire: ${row.PARTENAIRETRANSF}`);
        console.log(`      Agent: ${row.EFFECTUEPAR}`);
        console.log(`      Agence: ${row.CODEAGENCE}`);
        console.log(`      Type: ${row.TYPEOPERATION}`);
        console.log(`      Date: ${row.date_creation?.toLocaleString('fr-FR')}\n`);
      });
    } else {
      console.log('✅ Aucune transaction suspecte (montant > 100 millions)\n');
    }

    // 3. MoneyGram récent
    const mg = await pool.request().query(`
      SELECT TOP 10
        NUMERO,
        CODEENVOI,
        MONTANT,
        COMMISSION,
        EFFECTUEPAR,
        CODEAGENCE,
        date_creation
      FROM INFOSTRANSFERTPARTENAIRES
      WHERE PARTENAIRETRANSF = 'MONEYGRAM'
      ORDER BY date_creation DESC
    `);

    console.log('\n📋 DERNIÈRES TRANSACTIONS MONEYGRAM:\n');
    mg.recordset.forEach((row, idx) => {
      const isNormal = row.MONTANT < 10000000; // < 10 millions = normal
      const indicator = isNormal ? '✅' : '🚨';
      console.log(`   ${idx + 1}. ${indicator} MTCN: ${row.CODEENVOI}`);
      console.log(`      Montant: ${row.MONTANT?.toLocaleString('fr-FR')} KMF`);
      console.log(`      Commission: ${row.COMMISSION?.toLocaleString('fr-FR')} KMF`);
      console.log(`      Agent: ${row.EFFECTUEPAR}`);
      console.log(`      Date: ${row.date_creation?.toLocaleString('fr-FR')}\n`);
    });

    // 4. RIA récent
    const ria = await pool.request().query(`
      SELECT TOP 10
        NUMERO,
        CODEENVOI,
        MONTANT,
        COMMISSION,
        EFFECTUEPAR,
        CODEAGENCE,
        date_creation
      FROM INFOSTRANSFERTPARTENAIRES
      WHERE PARTENAIRETRANSF = 'RIA'
      ORDER BY date_creation DESC
    `);

    if (ria.recordset.length > 0) {
      console.log('\n📋 DERNIÈRES TRANSACTIONS RIA:\n');
      ria.recordset.forEach((row, idx) => {
        const isNormal = row.MONTANT < 10000000;
        const indicator = isNormal ? '✅' : '🚨';
        console.log(`   ${idx + 1}. ${indicator} PIN: ${row.CODEENVOI}`);
        console.log(`      Montant: ${row.MONTANT?.toLocaleString('fr-FR')} KMF`);
        console.log(`      Commission: ${row.COMMISSION?.toLocaleString('fr-FR')} KMF`);
        console.log(`      Agent: ${row.EFFECTUEPAR}`);
        console.log(`      Date: ${row.date_creation?.toLocaleString('fr-FR')}\n`);
      });
    } else {
      console.log('\n⚠️  Aucune transaction RIA trouvée\n');
    }

    console.log('═══════════════════════════════════════════════\n');

    await pool.close();
  } catch(err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  }
})();
