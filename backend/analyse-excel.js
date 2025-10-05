// analyze-excel.js - Analyser la structure exacte d'un fichier Excel
const ExcelJS = require('exceljs');
const path = require('path');

async function analyzeExcel(filename) {
  console.log('📊 ANALYSE DÉTAILLÉE DU FICHIER EXCEL');
  console.log('========================================\n');
  console.log(`Fichier: ${filename}\n`);
  
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filename);
    
    console.log(`Nombre de feuilles: ${workbook.worksheets.length}`);
    
    // Analyser chaque feuille
    workbook.worksheets.forEach((worksheet, sheetIndex) => {
      console.log(`\n📋 FEUILLE ${sheetIndex + 1}: ${worksheet.name}`);
      console.log('-'.repeat(50));
      
      // Dimensions
      const rowCount = worksheet.rowCount;
      const columnCount = worksheet.columnCount;
      console.log(`Dimensions: ${rowCount} lignes x ${columnCount} colonnes`);
      
      if (rowCount === 0) {
        console.log('⚠️  Feuille vide');
        return;
      }
      
      // Analyser les 3 premières lignes
      console.log('\n🔍 Premières lignes:');
      for (let rowNum = 1; rowNum <= Math.min(3, rowCount); rowNum++) {
        const row = worksheet.getRow(rowNum);
        console.log(`\nLigne ${rowNum}:`);
        
        row.eachCell((cell, colNumber) => {
          const value = cell.value;
          const type = cell.type;
          
          // Gérer les dates
          let displayValue = value;
          if (value instanceof Date) {
            displayValue = value.toISOString();
          } else if (typeof value === 'object') {
            displayValue = JSON.stringify(value);
          }
          
          console.log(`  Col ${colNumber}: [${type}] ${displayValue}`);
        });
      }
      
      // Identifier le type de données par colonne
      console.log('\n📊 Types de données par colonne:');
      const columnTypes = {};
      
      for (let col = 1; col <= Math.min(15, columnCount); col++) {
        const samples = [];
        for (let row = 1; row <= Math.min(10, rowCount); row++) {
          const cell = worksheet.getCell(row, col);
          if (cell.value !== null && cell.value !== undefined) {
            samples.push({
              type: cell.type,
              value: cell.value,
              isDate: cell.value instanceof Date,
              isNumber: typeof cell.value === 'number',
              isString: typeof cell.value === 'string'
            });
          }
        }
        
        if (samples.length > 0) {
          const types = [...new Set(samples.map(s => s.type))];
          const isAllDates = samples.every(s => s.isDate);
          const isAllNumbers = samples.every(s => s.isNumber);
          const isAllStrings = samples.every(s => s.isString);
          
          console.log(`Col ${col}:`);
          console.log(`  Types: ${types.join(', ')}`);
          console.log(`  Nature: ${isAllDates ? 'DATES' : isAllNumbers ? 'NOMBRES' : isAllStrings ? 'TEXTE' : 'MIXTE'}`);
          console.log(`  Exemple: ${samples[0].value}`);
        }
      }
      
      // Détecter le format probable
      console.log('\n🎯 Format détecté:');
      const firstRow = worksheet.getRow(1);
      let format = 'INCONNU';
      
      // Vérifier les patterns
      if (firstRow.getCell(1).value instanceof Date && 
          firstRow.getCell(2).value instanceof Date) {
        format = 'WESTERN_UNION (dates en colonnes A et B)';
      } else if (typeof firstRow.getCell(1).value === 'string') {
        const headerText = [];
        firstRow.eachCell((cell) => {
          if (cell.value) headerText.push(cell.value.toString().toLowerCase());
        });
        const headers = headerText.join(' ');
        
        if (headers.includes('mtcn') || headers.includes('sender')) {
          format = 'MONEYGRAM (avec en-têtes)';
        } else if (headers.includes('pin') || headers.includes('beneficiary')) {
          format = 'RIA (avec en-têtes)';
        } else {
          format = 'Format avec en-têtes personnalisés';
        }
      }
      
      console.log(`  → ${format}`);
    });
    
    console.log('\n✅ Analyse terminée');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Exécuter
const filename = process.argv[2] || 'fichier 1.xlsx';
analyzeExcel(filename);