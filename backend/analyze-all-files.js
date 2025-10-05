// analyze-all-files.js - Analyser tous les formats de fichiers
const ExcelJS = require('exceljs');
const fs = require('fs').promises;

async function analyzeExcelFile(filePath) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📁 ${filePath}`);
  console.log('='.repeat(80));

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.worksheets[0];
    console.log(`📊 Feuille: ${worksheet.name}`);
    console.log(`📏 Lignes: ${worksheet.rowCount}`);

    console.log('\n🔍 Premières 20 lignes:\n');

    let rowCount = 0;
    worksheet.eachRow((row, rowNumber) => {
      if (rowCount < 20) {
        const cells = [];
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          if (colNumber <= 12) {  // Voir jusqu'à 12 colonnes
            const value = cell.value;
            if (value !== null && value !== undefined && value !== '') {
              cells.push(`Col${colNumber}: ${value}`);
            }
          }
        });

        if (cells.length > 0) {
          console.log(`Ligne ${rowNumber}:`);
          cells.forEach(c => console.log(`  ${c}`));
          console.log('---');
        }
        rowCount++;
      }
    });

  } catch (error) {
    console.error(`❌ Erreur: ${error.message}`);
  }
}

async function main() {
  const files = [
    './uploads/16-30-Avril-2025 (2).xlsx',
    './uploads/resume_trans_Global_11-03-2025_30-03-2025.xlsx',
    './uploads/resume_trans_MoneyGram_11-03-2025_30-03-2025.xlsx',
    './uploads/resume_trans_Ria_11-03-2025_31-03-2025.xlsx'
  ];

  for (const file of files) {
    try {
      await analyzeExcelFile(file);
    } catch (e) {
      console.log(`\n❌ Impossible d'ouvrir: ${file}`);
    }
  }

  console.log('\n\n📋 FICHIERS PDF (non analysés):');
  console.log('  - RAPPORT WU Agent de réseau.pdf');
  console.log('  - RAPPORT WU par Direction.pdf');
  console.log('  → Les PDF nécessitent un traitement spécial');
}

main().catch(console.error);
