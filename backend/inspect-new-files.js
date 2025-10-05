// Inspecter les nouveaux fichiers en détail
const ExcelJS = require('exceljs');
const path = require('path');

async function inspectFile(fileName, maxLines = 30) {
  console.log('\n' + '='.repeat(80));
  console.log(`📂 FICHIER: ${fileName}`);
  console.log('='.repeat(80));

  const filePath = path.join(__dirname, 'uploads', fileName);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];

  console.log(`📊 Feuille: ${worksheet.name}`);
  console.log(`📏 Dimensions: ${worksheet.rowCount} lignes x ${worksheet.columnCount} colonnes\n`);

  console.log(`📝 Premières ${maxLines} lignes:\n`);

  for (let i = 1; i <= Math.min(maxLines, worksheet.rowCount); i++) {
    const row = worksheet.getRow(i);
    const values = [];

    for (let j = 1; j <= Math.min(11, worksheet.columnCount); j++) {
      const cell = row.getCell(j);
      let value = cell.value;

      if (value === null || value === undefined) {
        value = '';
      } else if (typeof value === 'object' && value.result !== undefined) {
        value = value.result;
      } else if (value instanceof Date) {
        value = value.toISOString();
      }

      values.push(value);
    }

    // Afficher si au moins une valeur non vide
    if (values.some(v => v !== '')) {
      console.log(`Ligne ${i}:`);
      values.forEach((val, idx) => {
        if (val !== '') {
          const displayVal = typeof val === 'string' && val.length > 80
            ? val.substring(0, 80) + '...'
            : val;
          console.log(`  [${idx + 1}] ${displayVal}`);
        }
      });
    }
  }
}

async function main() {
  await inspectFile('16-30-Avril-2025 (3).xlsx', 15);
  await inspectFile('16-30-Avril-2025 (4).xlsx', 20);

  console.log('\n' + '='.repeat(80));
  console.log('✅ Inspection terminée');
  console.log('='.repeat(80) + '\n');
}

main().catch(console.error);
