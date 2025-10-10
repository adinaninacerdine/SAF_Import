// generate-rapport-format-controleur.js - Générer rapport au format contrôleur
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
    trustServerCertificate: true
  },
  requestTimeout: 120000
};

async function generateRapport() {
  try {
    console.log('🔄 Connexion à la base de données...');
    const pool = await sql.connect(config);

    // Récupérer les dates min/max des imports
    console.log('📅 Récupération de la période...');
    const periodeResult = await pool.request().query(`
      SELECT
        MIN(DATEOPERATION) as date_min,
        MAX(DATEOPERATION) as date_max
      FROM INFOSTRANSFERTPARTENAIRES
      WHERE AGENT_UNIQUE_ID IS NOT NULL
    `);

    const dateMin = periodeResult.recordset[0].date_min;
    const dateMax = periodeResult.recordset[0].date_max;

    const formatDate = (date) => {
      const d = new Date(date);
      return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
    };

    console.log(`📊 Période: ${formatDate(dateMin)} --- ${formatDate(dateMax)}`);

    // Récupérer les données par partenaire
    const partenaires = ['MONEYGRAM', 'RIA'];

    for (const partenaire of partenaires) {
      console.log(`\n📄 Génération rapport ${partenaire}...`);

      const result = await pool.request()
        .input('partenaire', sql.VarChar, partenaire)
        .query(`
          SELECT
            t.CODEAGENCE as Code,
            a.DES_AGENCIA as Nom,
            am.agent_nom as Usager,
            ISNULL(SUM(CASE WHEN t.TYPEOPERATION = 'ENVOI' THEN t.MONTANT ELSE 0 END), 0) as Envois,
            ISNULL(SUM(CASE WHEN t.TYPEOPERATION = 'PAIEMENT' THEN t.MONTANT ELSE 0 END), 0) as Paiements,
            ISNULL(SUM(CASE WHEN t.TYPEOPERATION = 'ANNULATION' THEN t.MONTANT ELSE 0 END), 0) as Annulations,
            ISNULL(SUM(t.COMMISSION), 0) as Comm
          FROM INFOSTRANSFERTPARTENAIRES t
          LEFT JOIN CF.CF_AGENCIAS a ON t.CODEAGENCE = a.COD_AGENCIA
          LEFT JOIN tm_agent_mapping am ON t.AGENT_UNIQUE_ID = am.agent_unique_id
          WHERE t.AGENT_UNIQUE_ID IS NOT NULL
            AND t.PARTENAIRETRANSF = @partenaire
          GROUP BY
            t.CODEAGENCE,
            a.DES_AGENCIA,
            am.agent_nom
          ORDER BY
            t.CODEAGENCE,
            am.agent_nom
        `);

      if (result.recordset.length === 0) {
        console.log(`   ⚠️ Aucune donnée pour ${partenaire}`);
        continue;
      }

      // Séparer agences principales et sous-agences
      const agencesPrincipales = result.recordset.filter(r => {
        const code = parseInt(r.Code);
        return code >= 1 && code <= 20;
      });

      const sousAgences = result.recordset.filter(r => {
        const code = parseInt(r.Code);
        return code >= 100;
      });

      // Créer le rapport formaté
      let rapport = '';
      rapport += `Résumé des transactions pour ${partenaire} (${formatDate(dateMin)} --- ${formatDate(dateMax)})         Devise: KMF\n`;
      rapport += '\n';
      rapport += 'Agences MCTV\n';
      rapport += 'Code\tNom\tUsager\tEnvois\tPaiements\tAnnulations\tComm.\n';

      agencesPrincipales.forEach(row => {
        rapport += `${row.Code}\t${row.Nom || ''}\t${row.Usager || ''}\t${Math.round(row.Envois)}\t${Math.round(row.Paiements)}\t${Math.round(row.Annulations)}\t${Math.round(row.Comm)}\n`;
      });

      // Agréger les sous-agences (somme par agence, sans distinction d'usager)
      const sousAgencesAgregees = {};

      if (sousAgences.length > 0) {
        rapport += '\n';
        rapport += 'Sous Agences\n';
        rapport += 'Code\tNom\tEnvois\tPaiements\tAnnulations\tComm.\n';
        sousAgences.forEach(row => {
          const key = `${row.Code}|${row.Nom}`;
          if (!sousAgencesAgregees[key]) {
            sousAgencesAgregees[key] = {
              Code: row.Code,
              Nom: row.Nom,
              Envois: 0,
              Paiements: 0,
              Annulations: 0,
              Comm: 0
            };
          }
          sousAgencesAgregees[key].Envois += row.Envois;
          sousAgencesAgregees[key].Paiements += row.Paiements;
          sousAgencesAgregees[key].Annulations += row.Annulations;
          sousAgencesAgregees[key].Comm += row.Comm;
        });

        Object.values(sousAgencesAgregees).forEach(row => {
          rapport += `${row.Code}\t${row.Nom || ''}\t${Math.round(row.Envois)}\t${Math.round(row.Paiements)}\t${Math.round(row.Annulations)}\t${Math.round(row.Comm)}\n`;
        });
      }

      // Sauvegarder le rapport
      const filename = `rapport_${partenaire}_${formatDate(dateMin).replace(/-/g, '')}_${formatDate(dateMax).replace(/-/g, '')}.txt`;
      fs.writeFileSync(filename, rapport, 'utf8');

      console.log(`   ✅ ${filename} créé`);
      console.log(`   📊 ${agencesPrincipales.length} agents agences principales`);
      console.log(`   📊 ${Object.keys(sousAgencesAgregees || {}).length} sous-agences`);

      // Statistiques
      const totalEnvois = result.recordset.reduce((sum, r) => sum + r.Envois, 0);
      const totalPaiements = result.recordset.reduce((sum, r) => sum + r.Paiements, 0);
      const totalAnnulations = result.recordset.reduce((sum, r) => sum + r.Annulations, 0);
      const totalComm = result.recordset.reduce((sum, r) => sum + r.Comm, 0);

      console.log(`   💰 Envois: ${Math.round(totalEnvois).toLocaleString('fr-FR')} KMF`);
      console.log(`   💰 Paiements: ${Math.round(totalPaiements).toLocaleString('fr-FR')} KMF`);
      console.log(`   💰 Annulations: ${Math.round(totalAnnulations).toLocaleString('fr-FR')} KMF`);
      console.log(`   💰 Commissions: ${Math.round(totalComm).toLocaleString('fr-FR')} KMF`);
    }

    await pool.close();
    console.log('\n✅ Terminé !');

  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

generateRapport();
