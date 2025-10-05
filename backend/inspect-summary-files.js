// Inspecter le contenu détaillé des fichiers de résumé
const ExcelJS = require('exceljs');
const path = require('path');

async function inspectFile(fileName) {
  console.log('\n' + '='.repeat(80));
  console.log(`📂 FICHIER: ${fileName}`);
  console.log('='.repeat(80));

  const filePath = path.join(__dirname, 'uploads', fileName);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];

  console.log(`\n📊 Affichage des 20 premières lignes:\n`);

  for (let i = 1; i <= Math.min(20, worksheet.rowCount); i++) {
    const row = worksheet.getRow(i);
    const values = [];

    for (let j = 1; j <= 7; j++) {
      const cell = row.getCell(j);
      let value = cell.value;

      // Formater la valeur
      if (value === null || value === undefined) {
        value = '';
      } else if (typeof value === 'object' && value.result !== undefined) {
        value = value.result; // Formule
      }

      values.push(value);
    }

    // Afficher uniquement les lignes non vides
    if (values.some(v => v !== '')) {
      console.log(`Ligne ${i}:`);
      values.forEach((val, idx) => {
        if (val !== '') {
          console.log(`  Col ${idx + 1}: ${val}`);
        }
      });
    }
  }
}

async function main() {
  const files = [
    'resume_trans_MoneyGram_11-03-2025_30-03-2025.xlsx',
    'resume_trans_Ria_11-03-2025_31-03-2025.xlsx',
    'resume_trans_Global_11-03-2025_30-03-2025.xlsx'
  ];

  for (const file of files) {
    await inspectFile(file);
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Inspection terminée');
  console.log('='.repeat(80) + '\n');
}

main().catch(console.error);
