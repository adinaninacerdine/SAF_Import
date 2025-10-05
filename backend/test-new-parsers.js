// Test des nouveaux parsers RIA et MoneyGram Envois
const { ImportHandler } = require('./import-handler.js');
const sql = require('mssql');
const path = require('path');
require('dotenv').config();

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: { encrypt: true, trustServerCertificate: true }
};

async function testNewParsers() {
  console.log('\n🧪 TEST DES NOUVEAUX PARSERS\n');
  console.log('='.repeat(80));

  let pool;
  try {
    pool = await sql.connect(dbConfig);
    const handler = new ImportHandler(pool);
    await handler.initialize();

    const files = [
      '16-30-Avril-2025 (3).xlsx',
      '16-30-Avril-2025 (4).xlsx'
    ];

    for (const fileName of files) {
      console.log('\n' + '-'.repeat(80));
      console.log(`\n📂 Fichier: ${fileName}`);
      console.log('-'.repeat(80));

      const filePath = path.join(__dirname, 'uploads', fileName);

      try {
        // Parsing
        const result = await handler.parseFile(filePath);

        console.log(`\n✅ Résultats:`);
        console.log(`   • Type: ${result.type}`);
        console.log(`   • Transactions: ${result.count}`);

        if (result.transactions && result.transactions.length > 0) {
          // Calcul des montants
          const totalMontant = result.transactions.reduce((sum, t) => sum + (t.montant || 0), 0);
          const totalCommission = result.transactions.reduce((sum, t) => sum + (t.commission || 0), 0);

          console.log(`\n📊 Statistiques:`);
          console.log(`   • Total montants: ${totalMontant.toFixed(2)} KMF`);
          console.log(`   • Total commissions: ${totalCommission.toFixed(2)} KMF`);
          console.log(`   • Agences: ${new Set(result.transactions.map(t => t.codeAgence)).size}`);
          console.log(`   • Agents: ${new Set(result.transactions.map(t => t.effectuePar)).size}`);

          console.log(`\n📝 Échantillon (5 premières transactions):`);
          result.transactions.slice(0, 5).forEach((t, idx) => {
            console.log(`\n   ${idx + 1}. ${t.codeEnvoi}`);
            console.log(`      Partenaire: ${t.partenaire}`);
            console.log(`      Type: ${t.typeOperation}`);
            console.log(`      Montant: ${t.montant.toFixed(2)} KMF`);
            console.log(`      Agent: ${t.effectuePar}`);
            console.log(`      Agence: ${t.codeAgence}`);
            console.log(`      Date: ${t.dateOperation}`);
            if (t.expediteur) console.log(`      Expéditeur: ${t.expediteur}`);
            if (t.beneficiaire) console.log(`      Bénéficiaire: ${t.beneficiaire}`);
          });
        }

      } catch (error) {
        console.error(`\n❌ Erreur: ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Tests terminés');
    console.log('='.repeat(80) + '\n');

    await pool.close();

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    if (pool) await pool.close();
  }
}

testNewParsers().catch(console.error);
