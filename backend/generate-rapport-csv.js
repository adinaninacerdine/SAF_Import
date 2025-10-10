// generate-rapport-csv.js - Générer rapport CSV des transferts par agent et agence
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

    console.log('📊 Extraction des données de transferts importés via l\'application...');
    const result = await pool.request().query(`
      SELECT
        t.CODEAGENCE as Code_Agence,
        a.DES_AGENCIA as Nom_Agence,
        t.EFFECTUEPAR as Code_Agent,
        am.agent_nom as Nom_Agent_Unifie,
        t.PARTENAIRETRANSF as Partenaire,
        t.TYPEOPERATION as Type_Operation,
        COUNT(*) as Nombre_Transactions,
        SUM(t.MONTANT) as Montant_Total_KMF,
        SUM(t.COMMISSION) as Commission_Totale_KMF,
        SUM(t.TAXES) as Taxes_Totales_KMF,
        CONVERT(varchar, MIN(t.DATEOPERATION), 23) as Date_Premiere_Transaction,
        CONVERT(varchar, MAX(t.DATEOPERATION), 23) as Date_Derniere_Transaction,
        CONVERT(varchar, MIN(t.date_creation), 23) as Date_Premier_Import,
        CONVERT(varchar, MAX(t.date_creation), 23) as Date_Dernier_Import
      FROM INFOSTRANSFERTPARTENAIRES t
      LEFT JOIN CF.CF_AGENCIAS a ON t.CODEAGENCE = a.COD_AGENCIA
      LEFT JOIN tm_agent_mapping am ON t.AGENT_UNIQUE_ID = am.agent_unique_id
      WHERE t.AGENT_UNIQUE_ID IS NOT NULL  -- Seulement les transactions importées via l'application
      GROUP BY
        t.CODEAGENCE,
        a.DES_AGENCIA,
        t.EFFECTUEPAR,
        am.agent_nom,
        t.PARTENAIRETRANSF,
        t.TYPEOPERATION
      ORDER BY
        t.CODEAGENCE,
        SUM(t.MONTANT) DESC
    `);

    console.log(`✅ ${result.recordset.length} lignes récupérées`);

    if (result.recordset.length === 0) {
      console.log('⚠️ Aucune donnée trouvée');
      await pool.close();
      return;
    }

    // Créer le CSV
    const headers = Object.keys(result.recordset[0]).join(',');
    const rows = result.recordset.map(row => {
      return Object.values(row).map(val => {
        if (val === null || val === undefined) return '';
        if (typeof val === 'string') {
          // Échapper les guillemets doubles et encadrer avec des guillemets
          return '"' + val.replace(/"/g, '""') + '"';
        }
        if (val instanceof Date) {
          return val.toISOString().split('T')[0];
        }
        return val;
      }).join(',');
    });

    const csv = headers + '\n' + rows.join('\n');

    const filename = 'rapport_transferts_importes_application.csv';
    fs.writeFileSync(filename, csv, 'utf8');

    console.log('\n✅ Fichier CSV créé avec succès !');
    console.log(`📄 Fichier: ${filename}`);
    console.log('\n📊 STATISTIQUES GLOBALES:');
    console.log('   ═══════════════════════════════════');

    const stats = {
      nbLignes: result.recordset.length,
      montantTotal: result.recordset.reduce((sum, r) => sum + (r.Montant_Total_KMF || 0), 0),
      commissionTotal: result.recordset.reduce((sum, r) => sum + (r.Commission_Totale_KMF || 0), 0),
      taxesTotal: result.recordset.reduce((sum, r) => sum + (r.Taxes_Totales_KMF || 0), 0),
      nbTransactions: result.recordset.reduce((sum, r) => sum + (r.Nombre_Transactions || 0), 0)
    };

    console.log(`   Nombre de lignes: ${stats.nbLignes}`);
    console.log(`   Transactions totales: ${stats.nbTransactions.toLocaleString('fr-FR')}`);
    console.log(`   Montant total: ${stats.montantTotal.toLocaleString('fr-FR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} KMF`);
    console.log(`   Commissions totales: ${stats.commissionTotal.toLocaleString('fr-FR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} KMF`);
    console.log(`   Taxes totales: ${stats.taxesTotal.toLocaleString('fr-FR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} KMF`);

    // Statistiques par partenaire
    console.log('\n📊 PAR PARTENAIRE:');
    console.log('   ═══════════════════════════════════');
    const byPartner = {};
    result.recordset.forEach(row => {
      const partner = row.Partenaire || 'INCONNU';
      if (!byPartner[partner]) {
        byPartner[partner] = { montant: 0, transactions: 0 };
      }
      byPartner[partner].montant += row.Montant_Total_KMF || 0;
      byPartner[partner].transactions += row.Nombre_Transactions || 0;
    });

    Object.entries(byPartner).forEach(([partner, data]) => {
      console.log(`   ${partner}: ${data.transactions.toLocaleString('fr-FR')} transactions, ${data.montant.toLocaleString('fr-FR', {minimumFractionDigits: 2})} KMF`);
    });

    // Top 10 agents
    console.log('\n🏆 TOP 10 AGENTS PAR MONTANT:');
    console.log('   ═══════════════════════════════════');
    const topAgents = result.recordset
      .sort((a, b) => (b.Montant_Total_KMF || 0) - (a.Montant_Total_KMF || 0))
      .slice(0, 10);

    topAgents.forEach((agent, idx) => {
      console.log(`   ${idx + 1}. ${agent.Nom_Agent_Unifie || agent.Code_Agent} (${agent.Nom_Agence || agent.Code_Agence})`);
      console.log(`      ${agent.Nombre_Transactions} transactions, ${(agent.Montant_Total_KMF || 0).toLocaleString('fr-FR', {minimumFractionDigits: 2})} KMF`);
    });

    await pool.close();
    console.log('\n✅ Terminé !');

  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

generateRapport();
