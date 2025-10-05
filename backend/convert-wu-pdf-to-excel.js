// convert-wu-pdf-to-excel.js - Convertir PDF Western Union vers Excel
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

/**
 * Convertit un PDF WU copié-collé en Excel
 * Usage: node convert-wu-pdf-to-excel.js RAPPORT_WU_par_Direction[1].pdf
 */

async function convertWUPdfToExcel(pdfPath) {
  console.log(`📄 Conversion du PDF WU: ${pdfPath}...`);

  // Pour l'instant, instruction à l'utilisateur
  console.log(`\n⚠️  Le PDF ne peut pas être converti automatiquement.`);
  console.log(`\n📋 **INSTRUCTIONS POUR CONVERTIR LE PDF:**\n`);
  console.log(`1. Ouvrez le fichier PDF: ${pdfPath}`);
  console.log(`2. Sélectionnez tout le contenu (Ctrl+A)`);
  console.log(`3. Copiez (Ctrl+C)`);
  console.log(`4. Ouvrez Excel`);
  console.log(`5. Collez (Ctrl+V)`);
  console.log(`6. Sauvegardez en .xlsx: RAPPORT_WU_converted.xlsx`);
  console.log(`7. Uploadez le fichier .xlsx dans l'application\n`);

  console.log(`✅ Le système détectera automatiquement le format Western Union.`);
  console.log(`✅ Toutes les agences seront détectées automatiquement.`);
  console.log(`✅ Les MTCNs et montants seront extraits.\n`);
}

const pdfPath = process.argv[2] || 'uploads/RAPPORT_WU_par_Direction[1].pdf';
convertWUPdfToExcel(pdfPath).catch(console.error);
