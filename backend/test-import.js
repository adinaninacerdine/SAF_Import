// test-import.js - Script de test pour analyser et importer le fichier
const ExcelJS = require('exceljs');
const sql = require('mssql');
require('dotenv').config();

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: 'localhost',  // Utiliser localhost au lieu de sqlserver
  database: process.env.DB_NAME,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true
  }
};

async function analyzeFile(filePath) {
  console.log('📁 Analyse du fichier:', filePath);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.worksheets[0];
  console.log('\n📊 Première feuille:', worksheet.name);
  console.log('Nombre de lignes:', worksheet.rowCount);

  // Afficher les 5 premières lignes
  console.log('\n🔍 Aperçu des données:\n');

  let rowCount = 0;
  worksheet.eachRow((row, rowNumber) => {
    if (rowCount < 15) {  // Voir plus de lignes
      console.log(`Ligne ${rowNumber}:`);
      const values = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        values.push(`  Col${colNumber}: ${cell.value}`);
      });
      console.log(values.join('\n'));
      console.log('---');
      rowCount++;
    }
  });

  return { workbook, worksheet };
}

async function checkDatabase() {
  console.log('\n🔌 Connexion à la base de données...');
  const pool = await sql.connect(dbConfig);
  console.log('✅ Connecté');

  // Vérifier les agences
  const agences = await pool.request().query(`
    SELECT TOP 5 CODEAGENCE, LIBELLEAGENCE
    FROM AGENCES
    ORDER BY CODEAGENCE
  `);

  console.log('\n📍 Agences disponibles:');
  agences.recordset.forEach(a => {
    console.log(`  ${a.CODEAGENCE} - ${a.LIBELLEAGENCE}`);
  });

  // Vérifier les agents
  const agents = await pool.request().query(`
    SELECT COUNT(*) as total FROM UTILISATEURSSAF
  `);

  console.log(`\n👥 Total agents: ${agents.recordset[0].total}`);

  // Vérifier les transactions existantes
  const transactions = await pool.request().query(`
    SELECT COUNT(*) as total FROM INFOSTRANSFERTPARTENAIRES
  `);

  console.log(`💰 Total transactions: ${transactions.recordset[0].total}`);

  return pool;
}

async function main() {
  try {
    const filePath = './uploads/16-30-Avril-2025 (2).xlsx';

    // Analyser le fichier
    const { worksheet } = await analyzeFile(filePath);

    // Vérifier la base de données
    const pool = await checkDatabase();

    await pool.close();

    console.log('\n✅ Analyse terminée');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error.stack);
  }
}

main();
