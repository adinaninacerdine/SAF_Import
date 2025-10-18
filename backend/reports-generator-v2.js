// reports-generator-v2.js - Nouveau générateur de rapports conforme aux modèles client
const sql = require('mssql');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs').promises;
const path = require('path');

/**
 * Générateur de rapports conforme aux formats demandés par le client
 * Formats supportés: TXT, Excel, PDF
 */
class ReportsGeneratorV2 {
  constructor(pool) {
    this.pool = pool;
  }

  /**
   * Formater une date au format DD-MM-YYYY
   */
  formatDate(date) {
    const d = new Date(date);
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  }

  /**
   * Formater un montant (sans décimales, avec séparateurs pour Excel/PDF)
   */
  formatMontant(montant, withSeparator = false) {
    const rounded = Math.round(montant);
    if (withSeparator) {
      // Utiliser des espaces normaux au lieu d'espaces insécables pour compatibilité
      return new Intl.NumberFormat('fr-FR').format(rounded).replace(/\u00A0/g, ' ');
    }
    return rounded;
  }

  /**
   * Récupérer les données pour un partenaire donné
   */
  async getDonneesRapport(partenaire, dateDebut, dateFin) {
    // Requête pour agences principales (001-020) avec détail par usager
    const agencesPrincipales = await this.pool.request()
      .input('partenaire', sql.VarChar, partenaire)
      .input('dateDebut', sql.Date, dateDebut)
      .input('dateFin', sql.Date, dateFin)
      .query(`
        SELECT
          t.CODEAGENCE as Code,
          a.DES_AGENCIA as Nom,
          COALESCE(NULLIF(am.agent_nom, ''), 'NON ASSIGNÉ') as Usager,
          ISNULL(SUM(CASE
            WHEN t.TYPEOPERATION IN ('ENVOI AGENCE', 'ENVOI AGENT')
            THEN t.MONTANT ELSE 0 END), 0) as Envois,
          ISNULL(SUM(CASE
            WHEN t.TYPEOPERATION IN ('RECEPTION AGENCE', 'RECEPTION AGENT', 'RECEPTIONS', 'PAIEMENT')
            THEN t.MONTANT ELSE 0 END), 0) as Paiements,
          ISNULL(SUM(CASE
            WHEN t.TYPEOPERATION IN ('ANNULATION AGENCE', 'ANNULATION AGENT')
            THEN t.MONTANT ELSE 0 END), 0) as Annulations,
          ISNULL(SUM(t.COMMISSION), 0) as Comm
        FROM INFOSTRANSFERTPARTENAIRES t
        LEFT JOIN CF.CF_AGENCIAS a ON t.CODEAGENCE = a.COD_AGENCIA
        LEFT JOIN tm_agent_mapping am ON t.AGENT_UNIQUE_ID = am.agent_unique_id
        WHERE t.PARTENAIRETRANSF = @partenaire
          AND t.DATEOPERATION >= @dateDebut
          AND t.DATEOPERATION <= @dateFin
          AND t.statut_validation = 'VALIDEE'
          AND TRY_CAST(t.CODEAGENCE AS INT) IS NOT NULL
          AND CAST(t.CODEAGENCE AS INT) >= 1
          AND CAST(t.CODEAGENCE AS INT) <= 20
        GROUP BY
          t.CODEAGENCE,
          a.DES_AGENCIA,
          am.agent_nom
        HAVING (SUM(t.MONTANT) > 0 OR SUM(t.COMMISSION) > 0)
        ORDER BY
          CAST(t.CODEAGENCE AS INT),
          COALESCE(NULLIF(am.agent_nom, ''), 'NON ASSIGNÉ')
      `);

    // Requête pour sous-agences (>= 100) agrégées sans distinction d'usager
    const sousAgences = await this.pool.request()
      .input('partenaire', sql.VarChar, partenaire)
      .input('dateDebut', sql.Date, dateDebut)
      .input('dateFin', sql.Date, dateFin)
      .query(`
        SELECT
          t.CODEAGENCE as Code,
          a.DES_AGENCIA as Nom,
          ISNULL(SUM(CASE
            WHEN t.TYPEOPERATION IN ('ENVOI AGENCE', 'ENVOI AGENT')
            THEN t.MONTANT ELSE 0 END), 0) as Envois,
          ISNULL(SUM(CASE
            WHEN t.TYPEOPERATION IN ('RECEPTION AGENCE', 'RECEPTION AGENT', 'RECEPTIONS', 'PAIEMENT')
            THEN t.MONTANT ELSE 0 END), 0) as Paiements,
          ISNULL(SUM(CASE
            WHEN t.TYPEOPERATION IN ('ANNULATION AGENCE', 'ANNULATION AGENT')
            THEN t.MONTANT ELSE 0 END), 0) as Annulations,
          ISNULL(SUM(t.COMMISSION), 0) as Comm
        FROM INFOSTRANSFERTPARTENAIRES t
        LEFT JOIN CF.CF_AGENCIAS a ON t.CODEAGENCE = a.COD_AGENCIA
        WHERE t.PARTENAIRETRANSF = @partenaire
          AND t.DATEOPERATION >= @dateDebut
          AND t.DATEOPERATION <= @dateFin
          AND t.statut_validation = 'VALIDEE'
          AND TRY_CAST(t.CODEAGENCE AS INT) IS NOT NULL
          AND CAST(t.CODEAGENCE AS INT) >= 100
        GROUP BY
          t.CODEAGENCE,
          a.DES_AGENCIA
        HAVING (SUM(t.MONTANT) > 0 OR SUM(t.COMMISSION) > 0)
        ORDER BY
          CAST(t.CODEAGENCE AS INT)
      `);

    return {
      agencesPrincipales: agencesPrincipales.recordset,
      sousAgences: sousAgences.recordset
    };
  }

  /**
   * Générer rapport format TXT (format exact client)
   */
  async generateTXTReport(partenaire, dateDebut, dateFin, donnees) {
    const { agencesPrincipales, sousAgences } = donnees;

    // Déterminer le nom d'affichage du partenaire
    const partenaireDisplay = partenaire === 'MONEYGRAM' ? 'MoneyGram' :
                              partenaire === 'RIA' ? 'Ria' :
                              partenaire === 'GLOBAL' ? 'Global' : partenaire;

    let rapport = '';
    rapport += `Résumé des transactions pour ${partenaireDisplay} (${this.formatDate(dateDebut)} --- ${this.formatDate(dateFin)})         Devise: KMF`;

    // Espaces selon le format exact client
    if (partenaire === 'RIA') {
      rapport += '                    \n';
    } else {
      rapport += '                        \n';
    }

    // Ligne vide
    if (partenaire === 'RIA') {
      rapport += '                     \n';
    } else {
      rapport += '                         \n';
    }

    // Section Agences MCTV
    if (partenaire === 'RIA') {
      rapport += 'Agences MCTV                    \n';
    } else {
      rapport += 'Agences MCTV                        \n';
    }

    // En-têtes - RIA n'a pas de colonne Comm. pour agences principales
    if (partenaire === 'RIA') {
      rapport += 'Code    Nom    Usager    Envois    Paiements    Annulations\n';
    } else {
      rapport += 'Code    Nom    Usager    Envois    Paiements    Annulations    Comm.\n';
    }

    // Données agences principales
    agencesPrincipales.forEach(row => {
      const code = row.Code;
      const nom = row.Nom || '';
      const usager = row.Usager || '';
      const envois = this.formatMontant(row.Envois, true);
      const paiements = this.formatMontant(row.Paiements, true);
      const annulations = this.formatMontant(row.Annulations, true);

      if (partenaire === 'RIA') {
        rapport += `${code}    ${nom}    ${usager}    ${envois}    ${paiements}    ${annulations}\n`;
      } else {
        const comm = this.formatMontant(row.Comm, true);
        rapport += `${code}    ${nom}    ${usager}    ${envois}    ${paiements}    ${annulations}    ${comm}\n`;
      }
    });

    // Section Sous Agences
    if (sousAgences.length > 0) {
      // Ligne vide
      if (partenaire === 'RIA') {
        rapport += '                     \n';
      } else {
        rapport += '                         \n';
      }

      // Titre
      if (partenaire === 'RIA') {
        rapport += 'Sous Agences                    \n';
      } else {
        rapport += 'Sous Agences                        \n';
      }

      // En-têtes - Toutes les sous-agences ont la colonne Comm.
      if (partenaire === 'RIA') {
        rapport += 'Code    Nom    Envois    Paiements    Annulations    Comm.\n';
      } else {
        rapport += 'Code    Nom    Envois    Paiements    Annulations    Comm.    \n';
      }

      // Données sous-agences
      sousAgences.forEach(row => {
        const code = row.Code;
        const nom = row.Nom || '';
        const envois = this.formatMontant(row.Envois, true);
        const paiements = this.formatMontant(row.Paiements, true);
        const annulations = this.formatMontant(row.Annulations, true);
        const comm = this.formatMontant(row.Comm, true);

        if (partenaire === 'RIA') {
          rapport += `${code}    ${nom}    ${envois}    ${paiements}    ${annulations}    ${comm}\n`;
        } else {
          rapport += `${code}    ${nom}    ${envois}    ${paiements}    ${annulations}    ${comm}    \n`;
        }
      });
    }

    // Ligne finale vide
    if (partenaire === 'RIA') {
      rapport += '                     \n';
    } else {
      rapport += '                         \n';
    }

    const filename = `rapport_${partenaire}_${this.formatDate(dateDebut).replace(/-/g, '')}_${this.formatDate(dateFin).replace(/-/g, '')}.txt`;
    const filePath = path.join(__dirname, filename);

    await fs.writeFile(filePath, rapport, 'utf8');

    return { filename, filePath };
  }

  /**
   * Générer tous les rapports pour les partenaires demandés
   */
  async generateReports(dateDebut, dateFin, partenaire = null, format = 'txt') {
    const partenaires = partenaire ? [partenaire] : ['RIA', 'MONEYGRAM', 'GLOBAL'];
    const rapportsGeneres = [];

    for (const part of partenaires) {
      console.log(`📄 Génération rapport ${part} (${format})...`);

      const donnees = await this.getDonneesRapport(part, dateDebut, dateFin);

      if (donnees.agencesPrincipales.length === 0 && donnees.sousAgences.length === 0) {
        console.log(`  ⚠️ Aucune donnée pour ${part}`);
        continue;
      }

      let result;
      switch (format.toLowerCase()) {
        case 'txt':
          result = await this.generateTXTReport(part, dateDebut, dateFin, donnees);
          break;
        // TODO: Ajouter Excel et PDF dans la prochaine étape
        default:
          result = await this.generateTXTReport(part, dateDebut, dateFin, donnees);
      }

      console.log(`  ✅ ${result.filename} créé`);
      rapportsGeneres.push({
        filename: result.filename,
        partenaire: part,
        format: format,
        lignesAgencesPrincipales: donnees.agencesPrincipales.length,
        lignesSousAgences: donnees.sousAgences.length
      });
    }

    return rapportsGeneres;
  }
}

module.exports = ReportsGeneratorV2;
