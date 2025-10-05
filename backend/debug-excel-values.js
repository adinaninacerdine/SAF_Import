const ExcelJS = require('exceljs');

async function debugExcel() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('./uploads/16-30-Avril-2025 (2).xlsx');
  const worksheet = workbook.worksheets[0];

  console.log('🔍 Vérification des valeurs brutes Excel:\n');

  // Ligne 15 (première transaction)
  const row15 = worksheet.getRow(15);
  console.log('Ligne 15:');
  console.log(`  Col6 (Montant) - Type: ${typeof row15.getCell(6).value}, Valeur: ${row15.getCell(6).value}`);
  console.log(`  Col6 - Text: "${row15.getCell(6).text}"`);
  console.log(`  Col6 - parseFloat: ${parseFloat(row15.getCell(6).value)}`);
  console.log(`  Col6 - Math.abs: ${Math.abs(parseFloat(row15.getCell(6).value))}`);

  console.log(`  Col7 (Taxe) - Type: ${typeof row15.getCell(7).value}, Valeur: ${row15.getCell(7).value}`);
  console.log(`  Col9 (Commission) - Type: ${typeof row15.getCell(9).value}, Valeur: ${row15.getCell(9).value}`);

  // Ligne 17 (gros montant)
  const row17 = worksheet.getRow(17);
  console.log('\nLigne 17 (gros montant):');
  console.log(`  Col6 (Montant) - Type: ${typeof row17.getCell(6).value}, Valeur: ${row17.getCell(6).value}`);
  console.log(`  Col6 - Text: "${row17.getCell(6).text}"`);
  console.log(`  Col6 - parseFloat: ${parseFloat(row17.getCell(6).value)}`);
  console.log(`  Col6 - Math.abs: ${Math.abs(parseFloat(row17.getCell(6).value))}`);
}

debugExcel().catch(console.error);
