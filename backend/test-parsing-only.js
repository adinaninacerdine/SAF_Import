// Test uniquement le parsing pour identifier le problème de montant
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
  }
};

async function testParsingOnly() {
  console.log('\n🔍 TEST PARSING UNIQUEMENT (sans import DB)\n');
  console.log('='.repeat(80));

  let pool;

  try {
    pool = await sql.connect(dbConfig);
    const handler = new ImportHandler(pool);
    await handler.initialize();

    const filePath = path.join(__dirname, 'uploads', '16-30-Avril-2025 (2).xlsx');

    console.log('📂 Parsing du fichier...\n');
    const parseResult = await handler.parseFile(filePath);

    console.log(`✅ Transactions parsées: ${parseResult.transactions.length}`);

    // Analyser les montants
    let totalMontant = 0;
    let montantsNuls = 0;
    let montantsValides = 0;

    console.log('\n📝 Échantillon de 20 transactions:');
    parseResult.transactions.slice(0, 20).forEach((t, idx) => {
      const montant = t.montant || 0;
      totalMontant += montant;

      if (montant === 0) montantsNuls++;
      else montantsValides++;

      console.log(`${idx + 1}. ${t.codeEnvoi} → ${montant.toFixed(2)} KMF`);
    });

    // Calculer le total complet
    const totalComplet = parseResult.transactions.reduce((sum, t) => sum + (t.montant || 0), 0);

    console.log('\n' + '='.repeat(80));
    console.log('📊 STATISTIQUES DES MONTANTS');
    console.log('='.repeat(80));
    console.log(`Total transactions: ${parseResult.transactions.length}`);
    console.log(`Montants valides: ${montantsValides}`);
    console.log(`Montants nuls: ${montantsNuls}`);
    console.log(`\n💰 TOTAL DU FICHIER: ${totalComplet.toFixed(2)} KMF`);
    console.log(`💰 TOTAL FORMATÉ: ${new Intl.NumberFormat('fr-FR').format(totalComplet)} KMF`);
    console.log('='.repeat(80) + '\n');

    await pool.close();

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    if (pool) await pool.close();
  }
}

testParsingOnly().catch(console.error);
