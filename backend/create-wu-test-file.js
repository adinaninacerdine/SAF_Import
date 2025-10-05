// create-wu-test-file.js - Créer un fichier Excel WU de test
const ExcelJS = require('exceljs');
const path = require('path');

async function createWUTestFile() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('WU Report');

  console.log('📝 Génération du fichier de test Western Union...\n');

  // Titre
  worksheet.getCell('A1').value = 'Commission par direction';
  worksheet.getCell('A1').font = { bold: true, size: 14 };

  worksheet.getCell('A2').value = 'v6.0';

  // En-têtes
  worksheet.getRow(3).values = [
    'Date', 'Transaction', 'Envoyer', '', '', 'Paiement', '', '', 'Part d\'agent', '', '', 'Sous-agent', '', 'Revenus nets'
  ];

  worksheet.getRow(4).values = [
    'Envoyé MTCN', '', 'Principal', 'Charges', '', 'Principal', 'Charges', 'Change', 'Charges', 'Change', '', 'Charges', 'Change', ''
  ];

  worksheet.getRow(5).values = [
    'Payé Pays', '', '', '', '', '', '', '', '', '', '', '', '', ''
  ];

  // Section Transferts envoyés
  let rowIdx = 7;
  worksheet.getCell(`A${rowIdx}`).value = 'KMF';
  worksheet.getCell(`A${rowIdx}`).font = { bold: true };
  rowIdx++;

  worksheet.getCell(`A${rowIdx}`).value = 'Transactions hors internes';
  rowIdx++;

  worksheet.getCell(`A${rowIdx}`).value = 'Transferts envoyés';
  rowIdx++;

  worksheet.getCell(`A${rowIdx}`).value = 'Transactions settled on 12/09/2025';
  rowIdx++;

  // Site 1: MCTV GARD DU NORD
  worksheet.getCell(`A${rowIdx}`).value = 'Site: MCTV GARD DU NORD (AHO060077)';
  worksheet.getCell(`A${rowIdx}`).font = { bold: true };
  rowIdx++;

  worksheet.getCell(`A${rowIdx}`).value = 'RUE EGT, GARD DU NORD, GRANDE COMORES, MORONI,';
  rowIdx++;

  // Transactions GARD DU NORD (envoyées)
  const transGardNord = [
    { date: '12/09/2025', mtcn: 1409880028, pays: 'TURQUIE', principal: 262500, charges: 12000, commission: 4800 },
    { date: '12/09/2025', mtcn: 1464047864, pays: 'MAROC', principal: 50000, charges: 3000, commission: 1199 },
    { date: '12/09/2025', mtcn: 1726507070, pays: 'SENEGAL', principal: 30000, charges: 3000, commission: 1199 },
    { date: '12/09/2025', mtcn: 2900438315, pays: 'MADAGASCAR', principal: 980550, charges: 18523, commission: 7409 },
    { date: '12/09/2025', mtcn: 3641392529, pays: 'CAMEROUN', principal: 33750, charges: 3000, commission: 1199 }
  ];

  transGardNord.forEach(trans => {
    const row = worksheet.getRow(rowIdx);
    row.values = [
      trans.date,
      trans.mtcn,
      '', trans.principal, trans.charges,
      '', '', '',
      trans.commission, '', '',
      '', '', ''
    ];

    // Ligne pays
    rowIdx++;
    const rowPays = worksheet.getRow(rowIdx);
    rowPays.values = [
      '12/09/2025', trans.pays, 'KMF', trans.principal, trans.charges
    ];
    rowIdx++;
  });

  // Site 2: MCTV CALTEX
  worksheet.getCell(`A${rowIdx}`).value = 'Site: MCTV CALTEX (AHO060044)';
  worksheet.getCell(`A${rowIdx}`).font = { bold: true };
  rowIdx++;

  worksheet.getCell(`A${rowIdx}`).value = 'STATION CALTEX, CALTEX, GRANDE COMORES, MORONI,';
  rowIdx++;

  // Section Transferts reçus
  rowIdx += 2;
  worksheet.getCell(`A${rowIdx}`).value = 'Transferts reçus';
  worksheet.getCell(`A${rowIdx}`).font = { bold: true };
  rowIdx++;

  worksheet.getCell(`A${rowIdx}`).value = 'Transactions settled on 12/09/2025';
  rowIdx++;

  worksheet.getCell(`A${rowIdx}`).value = 'Site: MCTV CALTEX (AHO060044)';
  worksheet.getCell(`A${rowIdx}`).font = { bold: true };
  rowIdx++;

  // Transactions CALTEX (reçues)
  const transCaltex = [
    { date: '12/09/2025', mtcn: 1523103523, pays: 'FRANCE', principal: 147590, charges: 1962, commission: 309 },
    { date: '12/09/2025', mtcn: 4326652462, pays: 'FRANCE', principal: 49196, charges: 979, commission: 177 },
    { date: '12/09/2025', mtcn: 4468537523, pays: 'FRANCE', principal: 100000, charges: 1962, commission: 357 }
  ];

  transCaltex.forEach(trans => {
    const row = worksheet.getRow(rowIdx);
    row.values = [
      trans.date,
      trans.mtcn,
      '', trans.principal, trans.charges,
      '', '', '',
      trans.commission, '', '',
      '', '', ''
    ];

    rowIdx++;
    const rowPays = worksheet.getRow(rowIdx);
    rowPays.values = [
      '12/09/2025', trans.pays, 'KMF', trans.principal, trans.charges
    ];
    rowIdx++;
  });

  // Sauvegarder
  const outputPath = path.join(__dirname, '../test-data/WESTERN_UNION_TEST.xlsx');
  await workbook.xlsx.writeFile(outputPath);

  const totalTrans = transGardNord.length + transCaltex.length;
  const totalAmount = [...transGardNord, ...transCaltex].reduce((sum, t) => sum + t.principal, 0);

  console.log('✅ Fichier généré avec succès!');
  console.log(`📁 Chemin: ${outputPath}`);
  console.log(`📊 Transactions: ${totalTrans}`);
  console.log(`   - GARD DU NORD (077): ${transGardNord.length} envoyés`);
  console.log(`   - CALTEX (044): ${transCaltex.length} reçus`);
  console.log(`💰 Montant total: ${totalAmount.toLocaleString('fr-FR')} KMF\n`);

  console.log('🎯 MTCNs générés (exemples):');
  [...transGardNord, ...transCaltex].slice(0, 5).forEach((t, i) => {
    console.log(`   ${i + 1}. ${t.mtcn} - ${t.pays} - ${t.principal.toLocaleString('fr-FR')} KMF`);
  });

  console.log('\n🧪 Pour tester:');
  console.log('   1. Connectez-vous sur http://localhost:3000');
  console.log('   2. Uploadez: test-data/WESTERN_UNION_TEST.xlsx');
  console.log('   3. Le système détectera "WESTERN_UNION"');
  console.log('   4. Multi-agences automatique (077 + 044)');
  console.log('   5. Validation → Transactions réparties par agence\n');
}

createWUTestFile().catch(err => {
  console.error('❌ Erreur:', err.message);
  process.exit(1);
});
