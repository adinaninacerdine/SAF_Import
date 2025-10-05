const ExcelJS = require('exceljs');

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('../test-data/WESTERN_UNION_TEST.xlsx');
  const ws = wb.worksheets[0];

  console.log('=== WESTERN UNION TEST FILE ===\n');

  for (let i = 1; i <= 30; i++) {
    const row = ws.getRow(i);
    const vals = [];
    for (let j = 1; j <= 5; j++) {
      vals.push(row.getCell(j).value);
    }
    console.log(`Row ${i}: ${JSON.stringify(vals)}`);
  }
})();
