const ExcelJS = require('exceljs');

async function analyzeStructure() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('./uploads/16-30-Avril-2025 (2).xlsx');

  const worksheet = workbook.worksheets[0];

  console.log('Analyse détaillée des colonnes:\n');

  // Chercher la ligne d'en-têtes
  let headerRow = null;
  let headerRowNum = 0;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 20) {
      const cells = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (colNumber <= 10) {
          cells.push(cell.value);
        }
      });

      // Chercher "Numéro" dans les en-têtes
      const hasNumero = cells.some(c => c && c.toString().toLowerCase().includes('numéro'));
      const hasDate = cells.some(c => c && c.toString().toLowerCase().includes('date'));

      if (hasNumero || hasDate) {
        console.log(`\nLigne ${rowNumber} (possibles en-têtes):`);
        cells.forEach((c, i) => {
          if (c) console.log(`  Col${i + 1}: ${c}`);
        });

        if (!headerRow && hasNumero && hasDate) {
          headerRow = row;
          headerRowNum = rowNumber;
        }
      }
    }
  });

  if (headerRow) {
    console.log(`\n\n✅ En-têtes trouvés à la ligne ${headerRowNum}`);
    console.log('\nPremières données:\n');

    let dataCount = 0;
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > headerRowNum && dataCount < 5) {
        console.log(`Ligne ${rowNumber}:`);
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          if (colNumber <= 10) {
            console.log(`  Col${colNumber}: ${cell.value}`);
          }
        });
        console.log('---');
        dataCount++;
      }
    });
  }
}

analyzeStructure().catch(console.error);
