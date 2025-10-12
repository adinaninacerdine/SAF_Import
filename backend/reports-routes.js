// reports-routes.js - Routes pour génération de rapports format contrôleur
const sql = require('mssql');
const path = require('path');
const fs = require('fs').promises;

function reportsRoutes(authMiddleware) {
  const express = require('express');
  const router = express.Router();

  // Générer rapport au format contrôleur
  router.post('/generate', authMiddleware, async (req, res) => {
    try {
      const { dateDebut, dateFin, partenaire, format } = req.body;

      if (!dateDebut || !dateFin) {
        return res.status(400).json({ error: 'Dates manquantes' });
      }

      console.log(`\n📊 Génération rapport ${partenaire || 'TOUS'} du ${dateDebut} au ${dateFin}`);

      // Pool SQL depuis app.locals
      const pool = req.app.locals.pool;

      const formatDate = (date) => {
        const d = new Date(date);
        return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
      };

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
              COALESCE(am.agent_nom, 'NON ASSIGNÉ') as Usager,
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
              COALESCE(am.agent_nom, 'NON ASSIGNÉ')
          `);

        // Requête pour sous-agences (codes >= 100) - agrégé sans distinction d'usager
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

        // Créer le rapport formaté
        let rapport = '';
        rapport += `Résumé des transactions pour ${part} (${formatDate(dateDebutObj)} --- ${formatDate(dateFinObj)})         Devise: KMF                            \n`;
        rapport += '                             \n';

        // Section Agences MCTV
        rapport += 'Agences MCTV                            \n';
        rapport += 'Code    Nom    Usager    Envois    Paiements    Annulations    Comm.    \n';

        agencesPrincipales.recordset.forEach(row => {
          rapport += `${row.Code}    ${row.Nom || ''}    ${row.Usager || ''}    ${Math.round(row.Envois)}    ${Math.round(row.Paiements)}    ${Math.round(row.Annulations)}    ${Math.round(row.Comm)}    \n`;
        });

        // Section Sous Agences
        if (sousAgencesResult.recordset.length > 0) {
          rapport += '                             \n';
          rapport += 'Sous Agences                            \n';
          rapport += 'Code    Nom    Envois    Paiements    Annulations    Comm.        \n';

          sousAgencesResult.recordset.forEach(row => {
            rapport += `${row.Code}    ${row.Nom || ''}    ${Math.round(row.Envois)}    ${Math.round(row.Paiements)}    ${Math.round(row.Annulations)}    ${Math.round(row.Comm)}        \n`;
          });
        }

        rapport += '                            \n';

        // Sauvegarder le rapport
        const filename = `rapport_${part}_${formatDate(dateDebutObj).replace(/-/g, '')}_${formatDate(dateFinObj).replace(/-/g, '')}.txt`;
        const filePath = path.join(__dirname, filename);

        await fs.writeFile(filePath, rapport, 'utf8');

        console.log(`  ✅ ${filename} créé`);
        rapportsGeneres.push({
          filename,
          partenaire: part,
          lignesAgencesPrincipales: agencesPrincipales.recordset.length,
          lignesSousAgences: sousAgencesResult.recordset.length
        });
      }

      res.json({
        success: true,
        rapports: rapportsGeneres,
        message: `${rapportsGeneres.length} rapport(s) généré(s) avec succès`
      });

    } catch (error) {
      console.error('❌ Erreur génération rapport:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

module.exports = reportsRoutes;
