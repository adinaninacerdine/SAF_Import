const ExcelJS = require('exceljs');
const path = require('path');

async function generateTestFile() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('MoneyGram');

  console.log('📝 Génération du fichier de test MoneyGram...\n');

  // En-têtes du rapport MoneyGram
  worksheet.getCell('A1').value = 'Rapport de Transaction Journalier';
  worksheet.getCell('A1').font = { bold: true, size: 14 };

  worksheet.getCell('A2').value = `Succursale: MCTV-CALTEX (005)     Guichetier: TEST_USER_001`;

  // En-têtes colonnes (ligne 15 comme dans le vrai format)
  const headers = ['MTCN', 'Date Paiement', 'Bénéficiaire', 'Num Ref', 'Devise', 'Montant', 'Taxe', '', 'Commission'];
  worksheet.getRow(15).values = headers;
  worksheet.getRow(15).font = { bold: true };

  // Générer 20 transactions de test avec MTCN uniques
  const timestamp = Date.now();
  const transactions = [];

  const prenoms = ['Ahmed', 'Mohamed', 'Fatima', 'Aisha', 'Said', 'Halima', 'Ibrahim', 'Zainab', 'Hassan', 'Maryam'];
  const noms = ['Ali', 'Hassan', 'Abdou', 'Mohamed', 'Ibrahim', 'Said', 'Fatouma', 'Salim', 'Omar', 'Hamid'];

  for (let i = 0; i < 20; i++) {
    const mtcn = `TEST${timestamp}${String(i).padStart(3, '0')}`; // MTCN unique
    const beneficiaire = `${prenoms[i % prenoms.length]} ${noms[i % noms.length]}`;
    const montant = Math.floor(Math.random() * 150000) + 10000; // Entre 10k et 160k
    const commission = Math.floor(montant * 0.05); // 5%
    const taxe = Math.floor(montant * 0.02); // 2%

    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 7)); // Date dans les 7 derniers jours

    transactions.push({
      mtcn,
      date: date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' +
            date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      beneficiaire,
      numRef: i + 1,
      devise: 'KMF',
      montant,
      taxe,
      commission
    });
  }

  // Ajouter les transactions au fichier
  let rowIndex = 16;
  transactions.forEach((trans) => {
    const row = worksheet.getRow(rowIndex);
    row.values = [
      trans.mtcn,
      trans.date,
      trans.beneficiaire,
      trans.numRef,
      trans.devise,
      trans.montant,
      trans.taxe,
      '', // Colonne vide
      trans.commission
    ];
    rowIndex++;
  });

  // Ligne de total
  const totalRow = worksheet.getRow(rowIndex);
  totalRow.values = [
    'TOTAL',
    '',
    '',
    '',
    '',
    transactions.reduce((sum, t) => sum + t.montant, 0),
    transactions.reduce((sum, t) => sum + t.taxe, 0),
    '',
    transactions.reduce((sum, t) => sum + t.commission, 0)
  ];
  totalRow.font = { bold: true };

  // Sauvegarder
  const outputPath = path.join(__dirname, '../test-data/MONEYGRAM_TEST.xlsx');
  await workbook.xlsx.writeFile(outputPath);

  console.log('✅ Fichier généré avec succès!');
  console.log(`📁 Chemin: ${outputPath}`);
  console.log(`📊 Transactions: ${transactions.length}`);
  console.log(`💰 Montant total: ${transactions.reduce((sum, t) => sum + t.montant, 0).toLocaleString('fr-FR')} KMF\n`);

  console.log('🎯 MTCNs générés (exemples):');
  transactions.slice(0, 5).forEach((t, i) => {
    console.log(`   ${i + 1}. ${t.mtcn} - ${t.beneficiaire} - ${t.montant.toLocaleString('fr-FR')} KMF`);
  });

  console.log('\n🧪 Pour tester:');
  console.log('   1. Connectez-vous sur http://localhost:3000');
  console.log('   2. Uploadez: test-data/MONEYGRAM_TEST.xlsx');
  console.log('   3. Sélectionnez agence: 005 - MCTV-CALTEX');
  console.log('   4. Importez → Va en staging automatiquement');
  console.log('   5. Onglet Validation → Voir les 20 transactions');
  console.log('   6. Pas de doublons (MTCNs uniques garantis)');
  console.log('   7. Validez → Déplace vers production\n');
}

generateTestFile().catch(err => {
  console.error('❌ Erreur:', err.message);
  process.exit(1);
});
