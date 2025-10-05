// test-system-e2e.js - Test end-to-end du système
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

    console.log('🧪 TEST END-TO-END DU SYSTÈME SAF IMPORT v1.0\n');
    console.log('═══════════════════════════════════════════════\n');

    let allTestsPassed = true;
    const tests = [];

    // Test 1: Connexion base de données
    console.log('✅ Test 1/6: Connexion base de données - OK\n');
    tests.push({ name: 'Connexion DB', status: 'OK' });

    // Test 2: Tables principales existent
    const requiredTables = ['INFOSTRANSFERTPARTENAIRES', 'temp_INFOSTRANSFERTPARTENAIRES'];
    let tablesOk = true;
    for (const table of requiredTables) {
      const result = await pool.request().query(`
        SELECT COUNT(*) as cnt
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_NAME = '${table}'
      `);
      if (result.recordset[0].cnt === 0) {
        console.log(`❌ Test 2/6: Table ${table} manquante\n`);
        allTestsPassed = false;
        tablesOk = false;
      }
    }
    if (tablesOk) {
      console.log('✅ Test 2/6: Toutes les tables principales existent - OK\n');
      tests.push({ name: 'Tables principales', status: 'OK' });
    } else {
      tests.push({ name: 'Tables principales', status: 'ERREUR' });
    }

    // Test 3: Données partenaires présentes
    const partners = await pool.request().query(`
      SELECT
        PARTENAIRETRANSF,
        COUNT(*) as nb_trans,
        MAX(date_creation) as derniere_import
      FROM INFOSTRANSFERTPARTENAIRES
      GROUP BY PARTENAIRETRANSF
    `);

    console.log('📊 Test 3/6: Données par partenaire:\n');
    if (partners.recordset.length === 0) {
      console.log('   ⚠️  Aucune transaction en production\n');
      tests.push({ name: 'Données partenaires', status: 'VIDE' });
    } else {
      partners.recordset.forEach(p => {
        console.log(`   ✅ ${p.PARTENAIRETRANSF}: ${p.nb_trans?.toLocaleString('fr-FR')} trans (dernier: ${p.derniere_import?.toLocaleDateString('fr-FR')})`);
      });
      console.log('');
      tests.push({ name: 'Données partenaires', status: 'OK' });
    }

    // Test 4: Détection de doublons avec clé composite
    const duplicateTest = await pool.request().query(`
      SELECT TOP 1
        CODEENVOI,
        PARTENAIRETRANSF,
        COUNT(*) as nb
      FROM INFOSTRANSFERTPARTENAIRES
      GROUP BY CODEENVOI, PARTENAIRETRANSF, DATEOPERATION
      HAVING COUNT(*) > 1
    `);

    if (duplicateTest.recordset.length > 0) {
      console.log(`⚠️  Test 4/6: ${duplicateTest.recordset.length} vrais doublons détectés (même code + même date)\n`);
      tests.push({ name: 'Détection doublons', status: 'ATTENTION' });
    } else {
      console.log('✅ Test 4/6: Pas de vrais doublons détectés - OK\n');
      tests.push({ name: 'Détection doublons', status: 'OK' });
    }

    // Test 5: Support Western Union
    const wu = await pool.request().query(`
      SELECT COUNT(*) as nb
      FROM INFOSTRANSFERTPARTENAIRES
      WHERE PARTENAIRETRANSF = 'WESTERN_UNION'
    `);

    if (wu.recordset[0].nb > 0) {
      console.log(`✅ Test 5/6: Western Union actif (${wu.recordset[0].nb} transactions) - OK\n`);
      tests.push({ name: 'Western Union', status: 'OK' });
    } else {
      console.log('⚠️  Test 5/6: Aucune transaction Western Union (normal si pas encore importé)\n');
      tests.push({ name: 'Western Union', status: 'VIDE' });
    }

    // Test 6: Workflow de validation
    const validationFlow = await pool.request().query(`
      SELECT
        statut_validation,
        COUNT(*) as nb
      FROM temp_INFOSTRANSFERTPARTENAIRES
      GROUP BY statut_validation
    `);

    console.log('📋 Test 6/6: Workflow de validation:\n');
    if (validationFlow.recordset.length === 0) {
      console.log('   ℹ️  Aucune transaction en attente de validation\n');
      tests.push({ name: 'Workflow validation', status: 'VIDE' });
    } else {
      validationFlow.recordset.forEach(v => {
        console.log(`   ${v.statut_validation}: ${v.nb} transactions`);
      });
      console.log('');
      tests.push({ name: 'Workflow validation', status: 'OK' });
    }

    // Résumé
    console.log('═══════════════════════════════════════════════\n');
    console.log('📊 RÉSUMÉ DES TESTS:\n');
    tests.forEach((t, i) => {
      const icon = t.status === 'OK' ? '✅' : t.status === 'VIDE' ? 'ℹ️' : '⚠️';
      console.log(`   ${icon} ${t.name}: ${t.status}`);
    });
    console.log('');

    const criticalErrors = tests.filter(t => t.status === 'ERREUR').length;
    if (criticalErrors > 0) {
      console.log(`❌ ${criticalErrors} erreur(s) critique(s) - Système non opérationnel\n`);
      allTestsPassed = false;
    } else {
      console.log('✅ Tous les tests critiques sont passés - Système opérationnel !\n');
    }

    console.log('═══════════════════════════════════════════════\n');

    await pool.close();
    process.exit(allTestsPassed ? 0 : 1);
  } catch(err) {
    console.error('❌ Erreur critique:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();
