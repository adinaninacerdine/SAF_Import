// multi-agency-handler.js - Gestion des imports multi-agences
const sql = require('mssql');

class MultiAgencyHandler {
  constructor(pool) {
    this.pool = pool;
    this.agenceCache = new Map();
  }

  /**
   * D�tecte l'agence depuis les donn�es de la transaction
   */
  async detectAgency(transaction, defaultAgence = null) {
    // Si agence explicite dans les donn�es
    if (transaction.agence || transaction.codeAgence) {
      const code = transaction.agence || transaction.codeAgence;
      return this.normalizeAgencyCode(code);
    }

    // Si point de vente dans les donn�es (Western Union)
    if (transaction.pointDeVente) {
      const mapping = await this.getAgencyFromPointDeVente(transaction.pointDeVente);
      if (mapping) return mapping;
    }

    // Si on a un code agent, trouver son agence
    if (transaction.codeAgent || transaction.agent) {
      const agentCode = transaction.codeAgent || transaction.agent;
      const agence = await this.getAgencyFromAgent(agentCode);
      if (agence) return agence;
    }

    // Utiliser l'agence par d�faut si fournie
    if (defaultAgence && defaultAgence !== 'MULTI') {
      return defaultAgence;
    }

    // Par d�faut, utiliser 001 (si�ge)
    return '001';
  }

  /**
   * Normalise le code agence
   */
  normalizeAgencyCode(code) {
    if (!code) return '001';

    code = code.toString().trim().toUpperCase();

    // Mapping des noms vers codes
    const nameMapping = {
      'MORONI': '001',
      'SIEGE': '001',
      'MCTV-SIEGE': '001',
      'ANJOUAN': '002',
      'MUTSAMUDU': '002',
      'MOHELI': '003',
      'FOMBONI': '003',
      'PHILIPS': '004',
      'MCTV-PHILIPS': '004',
      'CALTEX': '005',
      'DZAHANI': '006',
      'IVEMBENI': '007',
      'OASIS': '008',
      'MANDZA': '009',
      'CORNICHE': '010',
      'MKAZI': '011'
    };

    if (nameMapping[code]) {
      return nameMapping[code];
    }

    // Si c'est d�j� un code num�rique
    if (code.match(/^\d{3}$/)) {
      return code;
    }

    // Extraire le num�ro du nom
    const match = code.match(/(\d{3})/);
    if (match) {
      return match[1];
    }

    return '001';
  }

  /**
   * Trouve l'agence depuis le point de vente
   */
  async getAgencyFromPointDeVente(pointDeVente) {
    if (!pointDeVente) return null;

    const pv = pointDeVente.toString().toUpperCase();

    const pvMapping = {
      'MORONI CENTRE': '001',
      'MORONI PORT': '004',
      'MUTSAMUDU': '002',
      'FOMBONI': '003',
      'OASIS': '008',
      'CORNICHE': '010'
    };

    for (const [key, value] of Object.entries(pvMapping)) {
      if (pv.includes(key)) {
        return value;
      }
    }

    return null;
  }

  /**
   * Trouve l'agence d'un agent
   */
  async getAgencyFromAgent(agentCode) {
    if (!agentCode) return null;

    const cacheKey = `agent_${agentCode}`;
    if (this.agenceCache.has(cacheKey)) {
      return this.agenceCache.get(cacheKey);
    }

    try {
      const result = await this.pool.request()
        .input('codeAgent', sql.VarChar, agentCode)
        .query('SELECT TOP 1 CODEAGENCE FROM UTILISATEURSSAF WHERE CODEUSER = @codeAgent');

      if (result.recordset.length > 0) {
        const agence = result.recordset[0].CODEAGENCE;
        this.agenceCache.set(cacheKey, agence);
        return agence;
      }
    } catch (error) {
      console.error(`Erreur recherche agence pour agent ${agentCode}:`, error.message);
    }

    return null;
  }

  /**
   * Importe des transactions multi-agences
   */
  async importMultiAgencyTransactions(transactions, importHandler) {
    const results = {
      byAgency: {},
      total: {
        success: 0,
        duplicates: 0,
        errors: 0,
        amount: 0
      }
    };

    console.log('\n<� IMPORT MULTI-AGENCES');
    console.log('========================\n');

    for (const transaction of transactions) {
      try {
        const agenceCode = await this.detectAgency(transaction);

        if (!results.byAgency[agenceCode]) {
          results.byAgency[agenceCode] = {
            name: await this.getAgencyName(agenceCode),
            success: 0,
            duplicates: 0,
            errors: 0,
            amount: 0
          };
        }

        const importResult = await importHandler.importSingleTransaction(
          transaction,
          agenceCode
        );

        if (importResult.status === 'success') {
          results.byAgency[agenceCode].success++;
          results.byAgency[agenceCode].amount += importResult.amount || 0;
          results.total.success++;
          results.total.amount += importResult.amount || 0;
        } else if (importResult.status === 'duplicate') {
          results.byAgency[agenceCode].duplicates++;
          results.total.duplicates++;
        } else {
          results.byAgency[agenceCode].errors++;
          results.total.errors++;
        }

      } catch (error) {
        console.error('Erreur transaction:', error.message);
        results.total.errors++;
      }
    }

    console.log('\n=� R�SUM� PAR AGENCE:');
    for (const [code, stats] of Object.entries(results.byAgency)) {
      console.log(`\nAgence ${code} - ${stats.name}:`);
      console.log(`   Import�es: ${stats.success}`);
      console.log(`  � Doublons: ${stats.duplicates}`);
      console.log(`  L Erreurs: ${stats.errors}`);
      console.log(`  =� Montant: ${stats.amount.toFixed(2)} KMF`);
    }

    return results;
  }

  /**
   * Obtient le nom d'une agence
   */
  async getAgencyName(code) {
    try {
      const result = await this.pool.request()
        .input('code', sql.VarChar, code)
        .query('SELECT LIBELLEAGENCE FROM AGENCES WHERE CODEAGENCE = @code');

      if (result.recordset.length > 0) {
        return result.recordset[0].LIBELLEAGENCE;
      }
    } catch (error) {
      console.error(`Erreur recherche nom agence ${code}:`, error.message);
    }

    return `Agence ${code}`;
  }
}

module.exports = MultiAgencyHandler;
