// generate-rapport-correct.js - Générer rapports au format exact contrôleur
const sql = require('mssql');
const fs = require('fs');
require('dotenv').config();

const config = {
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'SAF_MCTV_COMORES',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'Admin@123',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

async function generateRapportControleur(dateDebut, dateFin, partenaire = null) {
  try {
    console.log('🔄 Connexion à la base de données...');
    const pool = await sql.connect(config);

    const formatDate = (date) => {
      const d = new Date(date);
      return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
    };

    console.log(`📊 Période: ${formatDate(dateDebut)} --- ${formatDate(dateFin)}`);

    // Liste des partenaires à traiter
    const partenaires = partenaire ? [partenaire] : ['RIA', 'MONEYGRAM', 'GLOBAL'];

    for (const part of partenaires) {
      console.log(`\n📄 Génération rapport ${part}...`);

      // Requête pour agences principales (codes 001-020)
      const agencesPrincipales = await pool.request()
        .input('partenaire', sql.VarChar, part)
        .input('dateDebut', sql.DateTime, dateDebut)
        .input('dateFin', sql.DateTime, dateFin)
        .query(`
          SELECT
            t.CODEAGENCE as Code,
            a.DES_AGENCIA as Nom,
            am.agent_nom as Usager,
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
            AND CAST(t.CODEAGENCE AS INT) >= 1
            AND CAST(t.CODEAGENCE AS INT) <= 20
          GROUP BY
            t.CODEAGENCE,
            a.DES_AGENCIA,
            am.agent_nom
          ORDER BY
            CAST(t.CODEAGENCE AS INT),
            am.agent_nom
        `);

      // Requête pour sous-agences (codes >= 100) - agrégé sans distinction d'usager
      const sousAgencesResult = await pool.request()
        .input('partenaire', sql.VarChar, part)
        .input('dateDebut', sql.DateTime, dateDebut)
        .input('dateFin', sql.DateTime, dateFin)
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
            AND CAST(t.CODEAGENCE AS INT) >= 100
          GROUP BY
            t.CODEAGENCE,
            a.DES_AGENCIA
          ORDER BY
            CAST(t.CODEAGENCE AS INT)
        `);

      if (agencesPrincipales.recordset.length === 0 && sousAgencesResult.recordset.length === 0) {
        console.log(`   ⚠️ Aucune donnée pour ${part}`);
        continue;
      }

      // Créer le rapport formaté
      let rapport = '';
      rapport += `Résumé des transactions pour ${part} (${formatDate(dateDebut)} --- ${formatDate(dateFin)})         Devise: KMF                            \n`;
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
      const filename = `rapport_${part}_${formatDate(dateDebut).replace(/-/g, '')}_${formatDate(dateFin).replace(/-/g, '')}.txt`;
      fs.writeFileSync(filename, rapport, 'utf8');

      console.log(`   ✅ ${filename} créé`);
      console.log(`   📊 ${agencesPrincipales.recordset.length} lignes agences principales`);
      console.log(`   📊 ${sousAgencesResult.recordset.length} sous-agences`);

      // Statistiques globales
      const totalEnvois =
        agencesPrincipales.recordset.reduce((sum, r) => sum + r.Envois, 0) +
        sousAgencesResult.recordset.reduce((sum, r) => sum + r.Envois, 0);

      const totalPaiements =
        agencesPrincipales.recordset.reduce((sum, r) => sum + r.Paiements, 0) +
        sousAgencesResult.recordset.reduce((sum, r) => sum + r.Paiements, 0);

      const totalAnnulations =
        agencesPrincipales.recordset.reduce((sum, r) => sum + r.Annulations, 0) +
        sousAgencesResult.recordset.reduce((sum, r) => sum + r.Annulations, 0);

      const totalComm =
        agencesPrincipales.recordset.reduce((sum, r) => sum + r.Comm, 0) +
        sousAgencesResult.recordset.reduce((sum, r) => sum + r.Comm, 0);

      console.log(`   💰 Envois: ${Math.round(totalEnvois).toLocaleString('fr-FR')} KMF`);
      console.log(`   💰 Paiements: ${Math.round(totalPaiements).toLocaleString('fr-FR')} KMF`);
      console.log(`   💰 Annulations: ${Math.round(totalAnnulations).toLocaleString('fr-FR')} KMF`);
      console.log(`   💰 Commissions: ${Math.round(totalComm).toLocaleString('fr-FR')} KMF`);
    }

    await pool.close();
    console.log('\n✅ Tous les rapports générés !');

  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Exemple d'utilisation:
// Période du 16 avril au 30 avril 2025
const dateDebut = new Date('2025-04-16');
const dateFin = new Date('2025-04-30');

// Générer tous les rapports (RIA, MONEYGRAM, GLOBAL)
generateRapportControleur(dateDebut, dateFin);

// Pour un seul partenaire:
// generateRapportControleur(dateDebut, dateFin, 'RIA');
