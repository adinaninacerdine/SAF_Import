// reports-routes.js - Routes pour génération de rapports format contrôleur
const sql = require('mssql');
const path = require('path');
const fs = require('fs').promises;
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

function reportsRoutes(authMiddleware) {
  const express = require('express');
  const router = express.Router();

  // Fonction utilitaire pour formater les dates
  const formatDate = (date) => {
    const d = new Date(date);
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  };

  // Fonction pour formater les montants
  const formatMontant = (montant) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.round(montant));
  };

  // Générer rapport TXT (format original)
  async function generateTXTReport(part, dateDebutObj, dateFinObj, agencesPrincipales, sousAgences) {
    let rapport = '';
    rapport += `Résumé des transactions pour ${part} (${formatDate(dateDebutObj)} --- ${formatDate(dateFinObj)})         Devise: KMF\n`;
    rapport += '\n';

    // Section Agences MCTV
    rapport += 'Agences MCTV\n';
    rapport += 'Code    Nom    Usager    Envois    Paiements    Annulations    Comm.\n';

    agencesPrincipales.forEach(row => {
      rapport += `${row.Code}    ${row.Nom || ''}    ${row.Usager || ''}    ${Math.round(row.Envois)}    ${Math.round(row.Paiements)}    ${Math.round(row.Annulations)}    ${Math.round(row.Comm)}\n`;
    });

    // Section Sous Agences
    if (sousAgences.length > 0) {
      rapport += '\n';
      rapport += 'Sous Agences\n';
      rapport += 'Code    Nom    Envois    Paiements    Annulations    Comm.\n';

      sousAgences.forEach(row => {
        rapport += `${row.Code}    ${row.Nom || ''}    ${Math.round(row.Envois)}    ${Math.round(row.Paiements)}    ${Math.round(row.Annulations)}    ${Math.round(row.Comm)}\n`;
      });
    }

    rapport += '\n';

    const filename = `rapport_${part}_${formatDate(dateDebutObj).replace(/-/g, '')}_${formatDate(dateFinObj).replace(/-/g, '')}.txt`;
    const filePath = path.join(__dirname, filename);

    await fs.writeFile(filePath, rapport, 'utf8');

    return { filename, filePath };
  }

  // Générer rapport Excel
  async function generateExcelReport(part, dateDebutObj, dateFinObj, agencesPrincipales, sousAgences) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`${part} Rapport`);

    // Titre
    worksheet.mergeCells('A1:G1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `Résumé des transactions pour ${part} (${formatDate(dateDebutObj)} --- ${formatDate(dateFinObj)})`;
    titleCell.font = { size: 14, bold: true };
    titleCell.alignment = { horizontal: 'center' };

    worksheet.mergeCells('A2:G2');
    const deviseCell = worksheet.getCell('A2');
    deviseCell.value = 'Devise: KMF';
    deviseCell.font = { size: 11, bold: true };
    deviseCell.alignment = { horizontal: 'center' };

    // Agences MCTV
    let currentRow = 4;
    worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
    const agencesTitleCell = worksheet.getCell(`A${currentRow}`);
    agencesTitleCell.value = 'Agences MCTV';
    agencesTitleCell.font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    agencesTitleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    agencesTitleCell.alignment = { horizontal: 'center' };

    currentRow++;
    const headerRow = worksheet.getRow(currentRow);
    headerRow.values = ['Code', 'Nom', 'Usager', 'Envois', 'Paiements', 'Annulations', 'Comm.'];
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E1F2' }
    };
    headerRow.alignment = { horizontal: 'center' };

    currentRow++;
    agencesPrincipales.forEach(row => {
      const dataRow = worksheet.getRow(currentRow);
      dataRow.values = [
        row.Code,
        row.Nom || '',
        row.Usager || '',
        Math.round(row.Envois),
        Math.round(row.Paiements),
        Math.round(row.Annulations),
        Math.round(row.Comm)
      ];
      dataRow.alignment = { horizontal: 'left' };
      // Format numérique avec séparateurs
      for (let col = 4; col <= 7; col++) {
        dataRow.getCell(col).numFmt = '#,##0';
      }
      currentRow++;
    });

    // Sous Agences
    if (sousAgences.length > 0) {
      currentRow++; // Ligne vide
      worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
      const sousAgencesTitleCell = worksheet.getCell(`A${currentRow}`);
      sousAgencesTitleCell.value = 'Sous Agences';
      sousAgencesTitleCell.font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
      sousAgencesTitleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF70AD47' }
      };
      sousAgencesTitleCell.alignment = { horizontal: 'center' };

      currentRow++;
      const sousHeaderRow = worksheet.getRow(currentRow);
      sousHeaderRow.values = ['Code', 'Nom', 'Envois', 'Paiements', 'Annulations', 'Comm.'];
      sousHeaderRow.font = { bold: true };
      sousHeaderRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE2EFDA' }
      };
      sousHeaderRow.alignment = { horizontal: 'center' };

      currentRow++;
      sousAgences.forEach(row => {
        const dataRow = worksheet.getRow(currentRow);
        dataRow.values = [
          row.Code,
          row.Nom || '',
          Math.round(row.Envois),
          Math.round(row.Paiements),
          Math.round(row.Annulations),
          Math.round(row.Comm)
        ];
        dataRow.alignment = { horizontal: 'left' };
        // Format numérique avec séparateurs
        for (let col = 3; col <= 6; col++) {
          dataRow.getCell(col).numFmt = '#,##0';
        }
        currentRow++;
      });
    }

    // Ajuster largeur colonnes
    worksheet.getColumn(1).width = 8;  // Code
    worksheet.getColumn(2).width = 35; // Nom
    worksheet.getColumn(3).width = 30; // Usager
    worksheet.getColumn(4).width = 15; // Envois
    worksheet.getColumn(5).width = 15; // Paiements
    worksheet.getColumn(6).width = 15; // Annulations
    worksheet.getColumn(7).width = 12; // Comm.

    // Bordures pour toutes les cellules avec données
    for (let row = 4; row < currentRow; row++) {
      const r = worksheet.getRow(row);
      for (let col = 1; col <= 7; col++) {
        r.getCell(col).border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      }
    }

    const filename = `rapport_${part}_${formatDate(dateDebutObj).replace(/-/g, '')}_${formatDate(dateFinObj).replace(/-/g, '')}.xlsx`;
    const filePath = path.join(__dirname, filename);

    await workbook.xlsx.writeFile(filePath);

    return { filename, filePath };
  }

  // Générer rapport PDF
  async function generatePDFReport(part, dateDebutObj, dateFinObj, agencesPrincipales, sousAgences) {
    return new Promise((resolve, reject) => {
      const filename = `rapport_${part}_${formatDate(dateDebutObj).replace(/-/g, '')}_${formatDate(dateFinObj).replace(/-/g, '')}.pdf`;
      const filePath = path.join(__dirname, filename);

      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        layout: 'landscape'
      });
      const stream = require('fs').createWriteStream(filePath);

      doc.pipe(stream);

      // Titre
      doc.fontSize(16)
         .font('Helvetica-Bold')
         .text(`Résumé des transactions pour ${part}`, { align: 'center' });

      doc.fontSize(12)
         .text(`${formatDate(dateDebutObj)} --- ${formatDate(dateFinObj)}`, { align: 'center' });

      doc.fontSize(11)
         .text('Devise: KMF', { align: 'center' });

      doc.moveDown(1);

      // Agences MCTV
      doc.fontSize(14)
         .fillColor('#4472C4')
         .text('Agences MCTV', { underline: true });

      doc.moveDown(0.5);

      // Table header
      doc.fontSize(9).font('Helvetica-Bold').fillColor('black');
      const startX = 50;
      let y = doc.y;

      const colWidths = [40, 160, 140, 70, 80, 80, 60];
      const headers = ['Code', 'Nom', 'Usager', 'Envois', 'Paiements', 'Annulations', 'Comm.'];

      let x = startX;
      headers.forEach((header, i) => {
        doc.text(header, x, y, { width: colWidths[i], align: i === 0 ? 'left' : 'left' });
        x += colWidths[i];
      });

      y += 20;
      doc.moveTo(startX, y).lineTo(startX + colWidths.reduce((a, b) => a + b, 0), y).stroke();
      y += 5;

      // Data rows
      doc.font('Helvetica').fontSize(8);
      agencesPrincipales.forEach(row => {
        if (y > 500) { // Nouvelle page si nécessaire
          doc.addPage();
          y = 50;
        }

        x = startX;
        const rowData = [
          row.Code,
          (row.Nom || '').substring(0, 25),
          (row.Usager || '').substring(0, 22),
          formatMontant(row.Envois),
          formatMontant(row.Paiements),
          formatMontant(row.Annulations),
          formatMontant(row.Comm)
        ];

        rowData.forEach((data, i) => {
          doc.text(String(data), x, y, {
            width: colWidths[i],
            align: i >= 3 ? 'right' : 'left'
          });
          x += colWidths[i];
        });

        y += 15;
      });

      // Sous Agences
      if (sousAgences.length > 0) {
        y += 20;

        if (y > 500) {
          doc.addPage();
          y = 50;
        }

        doc.fontSize(14)
           .font('Helvetica-Bold')
           .fillColor('#70AD47')
           .text('Sous Agences', startX, y, { underline: true });

        y += 25;

        // Table header (sans colonne Usager)
        doc.fontSize(9).fillColor('black');
        x = startX;
        const sousHeaders = ['Code', 'Nom', 'Envois', 'Paiements', 'Annulations', 'Comm.'];
        const sousColWidths = [40, 300, 70, 80, 80, 60];

        sousHeaders.forEach((header, i) => {
          doc.text(header, x, y, { width: sousColWidths[i], align: 'left' });
          x += sousColWidths[i];
        });

        y += 20;
        doc.moveTo(startX, y).lineTo(startX + sousColWidths.reduce((a, b) => a + b, 0), y).stroke();
        y += 5;

        // Data rows
        doc.font('Helvetica').fontSize(8);
        sousAgences.forEach(row => {
          if (y > 500) {
            doc.addPage();
            y = 50;
          }

          x = startX;
          const rowData = [
            row.Code,
            (row.Nom || '').substring(0, 45),
            formatMontant(row.Envois),
            formatMontant(row.Paiements),
            formatMontant(row.Annulations),
            formatMontant(row.Comm)
          ];

          rowData.forEach((data, i) => {
            doc.text(String(data), x, y, {
              width: sousColWidths[i],
              align: i >= 2 ? 'right' : 'left'
            });
            x += sousColWidths[i];
          });

          y += 15;
        });
      }

      // Pied de page
      doc.fontSize(8)
         .fillColor('gray')
         .text(`Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`,
               50,
               doc.page.height - 50,
               { align: 'center' });

      doc.end();

      stream.on('finish', () => {
        resolve({ filename, filePath });
      });

      stream.on('error', reject);
    });
  }

  // Route principale de génération
  router.post('/generate', authMiddleware, async (req, res) => {
    try {
      const { dateDebut, dateFin, partenaire, format = 'txt' } = req.body;

      if (!dateDebut || !dateFin) {
        return res.status(400).json({ error: 'Dates manquantes' });
      }

      // Valider le format
      const validFormats = ['txt', 'excel', 'pdf'];
      const selectedFormat = format.toLowerCase();
      if (!validFormats.includes(selectedFormat)) {
        return res.status(400).json({ error: `Format invalide. Formats acceptés: ${validFormats.join(', ')}` });
      }

      console.log(`\n📊 Génération rapport ${selectedFormat.toUpperCase()} - ${partenaire || 'TOUS'} du ${dateDebut} au ${dateFin}`);

      // Pool SQL depuis app.locals
      const pool = req.app.locals.pool;

      const dateDebutObj = new Date(dateDebut);
      const dateFinObj = new Date(dateFin);

      // Liste des partenaires à traiter
      const partenaires = partenaire ? [partenaire] : ['RIA', 'MONEYGRAM', 'GLOBAL'];
      const rapportsGeneres = [];

      for (const part of partenaires) {
        console.log(`  📄 Génération ${part}...`);

        // Requête pour agences principales (codes 001-020)
        const agencesPrincipales = await pool.request()
          .input('partenaire', sql.VarChar, part)
          .input('dateDebut', sql.DateTime, dateDebutObj)
          .input('dateFin', sql.DateTime, dateFinObj)
          .query(`
            SELECT
              t.CODEAGENCE as Code,
              a.DES_AGENCIA as Nom,
              COALESCE(NULLIF(am.agent_nom, ''), 'NON ASSIGNÉ') as Usager,
              ISNULL(SUM(CASE
                WHEN t.TYPEOPERATION IN ('ENVOI', 'ENVOI AGENCE', 'ENVOI AGENT')
                THEN t.MONTANT ELSE 0 END), 0) as Envois,
              ISNULL(SUM(CASE
                WHEN t.TYPEOPERATION IN ('PAIEMENT', 'RECEPTION', 'RECEPTION AGENCE', 'RECEPTION AGENT', 'RECEPTIONS')
                THEN t.MONTANT ELSE 0 END), 0) as Paiements,
              ISNULL(SUM(CASE
                WHEN t.TYPEOPERATION IN ('ANNULATION', 'ANNULATION AGENCE', 'ANNULATION AGENT')
                THEN t.MONTANT ELSE 0 END), 0) as Annulations,
              ISNULL(SUM(t.COMMISSION), 0) as Comm
            FROM INFOSTRANSFERTPARTENAIRES t
            LEFT JOIN CF.CF_AGENCIAS a ON t.CODEAGENCE = a.COD_AGENCIA
            LEFT JOIN tm_agent_mapping am ON t.AGENT_UNIQUE_ID = am.agent_unique_id
            WHERE t.PARTENAIRETRANSF = @partenaire
              AND t.DATEOPERATION >= @dateDebut
              AND t.DATEOPERATION <= @dateFin
              AND TRY_CAST(t.CODEAGENCE AS INT) IS NOT NULL
              AND CAST(t.CODEAGENCE AS INT) >= 1
              AND CAST(t.CODEAGENCE AS INT) <= 20
            GROUP BY
              t.CODEAGENCE,
              a.DES_AGENCIA,
              am.agent_nom
            HAVING SUM(t.MONTANT) > 0
            ORDER BY
              CAST(t.CODEAGENCE AS INT),
              COALESCE(NULLIF(am.agent_nom, ''), 'NON ASSIGNÉ')
          `);

        // Requête pour sous-agences (codes >= 100)
        const sousAgencesResult = await pool.request()
          .input('partenaire', sql.VarChar, part)
          .input('dateDebut', sql.DateTime, dateDebutObj)
          .input('dateFin', sql.DateTime, dateFinObj)
          .query(`
            SELECT
              t.CODEAGENCE as Code,
              a.DES_AGENCIA as Nom,
              ISNULL(SUM(CASE
                WHEN t.TYPEOPERATION IN ('ENVOI', 'ENVOI AGENCE', 'ENVOI AGENT')
                THEN t.MONTANT ELSE 0 END), 0) as Envois,
              ISNULL(SUM(CASE
                WHEN t.TYPEOPERATION IN ('PAIEMENT', 'RECEPTION', 'RECEPTION AGENCE', 'RECEPTION AGENT', 'RECEPTIONS')
                THEN t.MONTANT ELSE 0 END), 0) as Paiements,
              ISNULL(SUM(CASE
                WHEN t.TYPEOPERATION IN ('ANNULATION', 'ANNULATION AGENCE', 'ANNULATION AGENT')
                THEN t.MONTANT ELSE 0 END), 0) as Annulations,
              ISNULL(SUM(t.COMMISSION), 0) as Comm
            FROM INFOSTRANSFERTPARTENAIRES t
            LEFT JOIN CF.CF_AGENCIAS a ON t.CODEAGENCE = a.COD_AGENCIA
            WHERE t.PARTENAIRETRANSF = @partenaire
              AND t.DATEOPERATION >= @dateDebut
              AND t.DATEOPERATION <= @dateFin
              AND TRY_CAST(t.CODEAGENCE AS INT) IS NOT NULL
              AND CAST(t.CODEAGENCE AS INT) >= 100
            GROUP BY
              t.CODEAGENCE,
              a.DES_AGENCIA
            HAVING SUM(t.MONTANT) > 0
            ORDER BY
              CAST(t.CODEAGENCE AS INT)
          `);

        if (agencesPrincipales.recordset.length === 0 && sousAgencesResult.recordset.length === 0) {
          console.log(`  ⚠️ Aucune donnée pour ${part}`);
          continue;
        }

        // Générer le rapport selon le format demandé
        let result;
        switch (selectedFormat) {
          case 'excel':
            result = await generateExcelReport(part, dateDebutObj, dateFinObj, agencesPrincipales.recordset, sousAgencesResult.recordset);
            break;
          case 'pdf':
            result = await generatePDFReport(part, dateDebutObj, dateFinObj, agencesPrincipales.recordset, sousAgencesResult.recordset);
            break;
          default: // txt
            result = await generateTXTReport(part, dateDebutObj, dateFinObj, agencesPrincipales.recordset, sousAgencesResult.recordset);
        }

        console.log(`  ✅ ${result.filename} créé`);
        rapportsGeneres.push({
          filename: result.filename,
          partenaire: part,
          format: selectedFormat,
          lignesAgencesPrincipales: agencesPrincipales.recordset.length,
          lignesSousAgences: sousAgencesResult.recordset.length
        });
      }

      res.json({
        success: true,
        rapports: rapportsGeneres,
        message: `${rapportsGeneres.length} rapport(s) ${selectedFormat.toUpperCase()} généré(s) avec succès`
      });

    } catch (error) {
      console.error('❌ Erreur génération rapport:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

module.exports = reportsRoutes;
