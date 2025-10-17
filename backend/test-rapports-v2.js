// test-rapports-v2.js - Script de test pour les nouveaux rapports
const sql = require('mssql');
const ReportsGeneratorV2 = require('./reports-generator-v2');
require('dotenv').config();

const config = {
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'SAF_MCTV_COMORES',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'Admin@123',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
    requestTimeout: 60000
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

async function testRapports() {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('🧪 TEST DES RAPPORTS V2 - Format Client Exact');
    console.log('='.repeat(70) + '\n');

    console.log('🔄 Connexion à la base de données...');
    const pool = await sql.connect(config);

    const generator = new ReportsGeneratorV2(pool);

    // Tester la génération pour la période donnée par le client
    const dateDebut = new Date('2025-04-16');
    const dateFin = new Date('2025-04-30');

    console.log(`📅 Période de test: ${generator.formatDate(dateDebut)} au ${generator.formatDate(dateFin)}\n`);

    // Générer tous les rapports
    console.log('📊 Génération des rapports...\n');
    const rapports = await generator.generateReports(dateDebut, dateFin, null, 'txt');

    console.log('\n' + '='.repeat(70));
    console.log('✅ RÉSULTATS');
    console.log('='.repeat(70) + '\n');

    if (rapports.length === 0) {
      console.log('⚠️ Aucun rapport généré (pas de données pour cette période)');
    } else {
      console.log(`📄 ${rapports.length} rapport(s) généré(s) :\n`);
      rapports.forEach((r, index) => {
        console.log(`${index + 1}. ${r.filename}`);
        console.log(`   Partenaire: ${r.partenaire}`);
        console.log(`   Format: ${r.format.toUpperCase()}`);
        console.log(`   Agences principales: ${r.lignesAgencesPrincipales} lignes`);
        console.log(`   Sous-agences: ${r.lignesSousAgences} lignes`);
        console.log('');
      });

      console.log('📂 Les fichiers ont été créés dans le dossier backend/');
      console.log('\n💡 Vérifiez que les rapports correspondent au format client:');
      console.log('   - RIA: Pas de colonne Comm. pour agences principales');
      console.log('   - MoneyGram & Global: Colonne Comm. partout');
      console.log('   - Format des noms: Ria, MoneyGram, Global (capitalization exacte)');
    }

    await pool.close();
    console.log('\n✅ Test terminé avec succès !\n');

  } catch (error) {
    console.error('\n❌ Erreur lors du test:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testRapports();
