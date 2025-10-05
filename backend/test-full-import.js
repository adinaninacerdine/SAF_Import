// Test complet du flux d'import (parsing + insert DB)
const { ImportHandler } = require('./import-handler.js');
const sql = require('mssql');
const path = require('path');
require('dotenv').config();

const dbConfig = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'Admin@123',
  server: process.env.DB_SERVER || 'sqlserver',
  database: process.env.DB_NAME || 'SAF_MCTV_COMORES',
  options: {
    encrypt: true,
    trustServerCertificate: true,
    enableArithAbort: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

async function testFullImport() {
  console.log('\n🧪 TEST COMPLET D\'IMPORT (Parsing + DB)\n');
  console.log('='.repeat(80));

  let pool;

  try {
    // Connexion DB
    console.log('\n📡 Connexion à la base de données...');
    pool = await sql.connect(dbConfig);
    console.log('✅ Connecté à SQL Server');

    // Initialiser le handler
    const handler = new ImportHandler(pool);
    await handler.initialize();

    const fileName = '16-30-Avril-2025 (2).xlsx';
    const filePath = path.join(__dirname, 'uploads', fileName);
    const agenceId = '001';

    console.log(`\n📂 Fichier: ${fileName}`);
    console.log(`📍 Agence: ${agenceId}`);

    // ÉTAPE 1: Parsing
    console.log('\n' + '='.repeat(80));
    console.log('ÉTAPE 1: PARSING DU FICHIER');
    console.log('='.repeat(80));

    const parseResult = await handler.parseFile(filePath);

    console.log(`\n✅ Parsing terminé:`);
    console.log(`   • Type: ${parseResult.type}`);
    console.log(`   • Transactions parsées: ${parseResult.count}`);

    // Calculer les montants du parsing
    const totalMontantParsing = parseResult.transactions.reduce((sum, t) => sum + (t.montant || 0), 0);
    const totalCommissionParsing = parseResult.transactions.reduce((sum, t) => sum + (t.commission || 0), 0);

    console.log(`\n📊 Statistiques du parsing:`);
    console.log(`   • Total montants: ${totalMontantParsing.toFixed(2)} KMF`);
    console.log(`   • Total commissions: ${totalCommissionParsing.toFixed(2)} KMF`);
    console.log(`   • Moyenne par transaction: ${(totalMontantParsing / parseResult.count).toFixed(2)} KMF`);

    // Afficher quelques transactions
    console.log(`\n📝 Échantillon de transactions parsées (5 premières):`);
    parseResult.transactions.slice(0, 5).forEach((trans, idx) => {
      console.log(`\n   Transaction #${idx + 1}:`);
      console.log(`     - Code: ${trans.codeEnvoi}`);
      console.log(`     - Montant: ${trans.montant} KMF`);
      console.log(`     - Commission: ${trans.commission} KMF`);
      console.log(`     - Numéro: ${trans.numero}`);
    });

    // ÉTAPE 2: Import en base
    console.log('\n' + '='.repeat(80));
    console.log('ÉTAPE 2: IMPORT EN BASE DE DONNÉES');
    console.log('='.repeat(80));

    console.log(`\n💾 Import de ${parseResult.transactions.length} transactions...`);

    const importResult = await handler.importTransactions(
      parseResult.transactions,
      agenceId,
      'TEST_USER'
    );

    console.log(`\n✅ Import terminé:`);
    console.log(`   • Succès: ${importResult.success}`);
    console.log(`   • Doublons: ${importResult.duplicates}`);
    console.log(`   • Erreurs: ${importResult.errors}`);
    console.log(`   • Total montant importé: ${importResult.totalAmount.toFixed(2)} KMF`);

    if (importResult.errorDetails && importResult.errorDetails.length > 0) {
      console.log(`\n❌ Détails des erreurs (${importResult.errorDetails.length}):`);
      importResult.errorDetails.forEach((err, idx) => {
        console.log(`   ${idx + 1}. Transaction ${err.transaction}: ${err.error}`);
      });
    }

    // ÉTAPE 3: Comparaison
    console.log('\n' + '='.repeat(80));
    console.log('ÉTAPE 3: COMPARAISON PARSING vs IMPORT');
    console.log('='.repeat(80));

    console.log(`\n📊 Transactions:`);
    console.log(`   • Parsées:     ${parseResult.count}`);
    console.log(`   • Importées:   ${importResult.success}`);
    console.log(`   • Doublons:    ${importResult.duplicates}`);
    console.log(`   • Erreurs:     ${importResult.errors}`);
    console.log(`   • Total vérifié: ${importResult.success + importResult.duplicates + importResult.errors} / ${parseResult.count}`);

    console.log(`\n💰 Montants:`);
    console.log(`   • Parsing:     ${totalMontantParsing.toFixed(2)} KMF`);
    console.log(`   • Import DB:   ${importResult.totalAmount.toFixed(2)} KMF`);
    console.log(`   • Différence:  ${(totalMontantParsing - importResult.totalAmount).toFixed(2)} KMF`);

    const pourcentage = ((importResult.totalAmount / totalMontantParsing) * 100).toFixed(2);
    console.log(`   • % importé:   ${pourcentage}%`);

    // Vérifier dans la base
    console.log('\n' + '='.repeat(80));
    console.log('ÉTAPE 4: VÉRIFICATION EN BASE DE DONNÉES');
    console.log('='.repeat(80));

    const dbCheck = await pool.request()
      .query(`
        SELECT
          COUNT(*) as total_count,
          SUM(MONTANT) as total_montant,
          SUM(COMMISSION) as total_commission,
          MIN(DATEOPERATION) as date_min,
          MAX(DATEOPERATION) as date_max
        FROM INFOSTRANSFERTPARTENAIRES
        WHERE PARTENAIRETRANSF = 'MONEYGRAM'
          AND DATEOPERATION >= '2025-04-16'
          AND DATEOPERATION < '2025-05-01'
      `);

    const dbData = dbCheck.recordset[0];
    console.log(`\n📊 Données en base (période 16-30 avril):`);
    console.log(`   • Nombre: ${dbData.total_count}`);
    console.log(`   • Montant total: ${(dbData.total_montant || 0).toFixed(2)} KMF`);
    console.log(`   • Commission totale: ${(dbData.total_commission || 0).toFixed(2)} KMF`);
    console.log(`   • Date min: ${dbData.date_min}`);
    console.log(`   • Date max: ${dbData.date_max}`);

    console.log('\n' + '='.repeat(80));
    console.log('✅ TEST TERMINÉ');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('\n❌ Erreur:', error);
    console.error('Stack:', error.stack);
  } finally {
    if (pool) {
      await pool.close();
      console.log('\n📡 Connexion fermée');
    }
  }
}

testFullImport().catch(console.error);
