// global-agency-routes.js - Routes API pour gérer les assignations agent-agence pour Global
const express = require('express');
const sql = require('mssql');

module.exports = (authMiddleware) => {
  const router = express.Router();

  /**
   * GET /api/global/unassigned-agents
   * Liste tous les agents Global sans assignation d'agence
   * Retourne les agents avec transactions GLOBAL où CODEAGENCE IS NULL
   */
  router.get('/unassigned-agents', authMiddleware, async (req, res) => {
    try {
      const pool = req.app.locals.pool;

      // Récupérer tous les agents ayant des transactions Global sans agence assignée
      const unassignedAgents = await pool.request().query(`
        SELECT
          am.agent_unique_id,
          am.agent_nom,
          am.agent_nom_normalise,
          STUFF((
            SELECT DISTINCT ', ' + ac2.code_user
            FROM tm_agent_codes ac2
            WHERE ac2.agent_unique_id = am.agent_unique_id
            FOR XML PATH(''), TYPE
          ).value('.', 'NVARCHAR(MAX)'), 1, 2, '') as codes,
          COUNT(DISTINCT t.CODEENVOI) as nb_transactions,
          SUM(t.MONTANT) as montant_total,
          MIN(t.DATEOPERATION) as date_premiere_transaction,
          MAX(t.DATEOPERATION) as date_derniere_transaction
        FROM temp_INFOSTRANSFERTPARTENAIRES t
        INNER JOIN tm_agent_mapping am ON t.AGENT_UNIQUE_ID = am.agent_unique_id
        WHERE t.PARTENAIRETRANSF = 'GLOBAL'
          AND (t.CODEAGENCE IS NULL OR t.CODEAGENCE = '')
          AND t.statut_validation = 'EN_ATTENTE'
        GROUP BY am.agent_unique_id, am.agent_nom, am.agent_nom_normalise
        ORDER BY COUNT(DISTINCT t.CODEENVOI) DESC
      `);

      res.json({
        success: true,
        unassignedAgents: unassignedAgents.recordset
      });

    } catch (error) {
      console.error('Erreur récupération agents Global non assignés:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur',
        error: error.message
      });
    }
  });

  /**
   * GET /api/global/assigned-mappings
   * Liste tous les mappings agent-agence existants pour Global
   */
  router.get('/assigned-mappings', authMiddleware, async (req, res) => {
    try {
      const pool = req.app.locals.pool;

      const mappings = await pool.request().query(`
        SELECT
          gaa.id,
          gaa.agent_unique_id,
          am.agent_nom,
          gaa.code_agence,
          ag.DES_AGENCIA as nom_agence,
          gaa.date_debut,
          gaa.date_fin,
          gaa.notes,
          gaa.created_by,
          gaa.date_creation,
          (SELECT COUNT(DISTINCT t2.CODEENVOI)
           FROM temp_INFOSTRANSFERTPARTENAIRES t2
           WHERE t2.AGENT_UNIQUE_ID = gaa.agent_unique_id
             AND t2.PARTENAIRETRANSF = 'GLOBAL'
             AND t2.DATEOPERATION BETWEEN gaa.date_debut AND gaa.date_fin) as nb_transactions_affectees
        FROM tm_global_agent_agency_mapping gaa
        INNER JOIN tm_agent_mapping am ON gaa.agent_unique_id = am.agent_unique_id
        LEFT JOIN CF.CF_AGENCIAS ag ON gaa.code_agence = ag.COD_AGENCIA
        ORDER BY gaa.date_creation DESC
      `);

      res.json({
        success: true,
        mappings: mappings.recordset
      });

    } catch (error) {
      console.error('Erreur récupération mappings Global:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur',
        error: error.message
      });
    }
  });

  /**
   * POST /api/global/assign-agency
   * Assigne une agence à un agent pour une période donnée
   * Body: { agentUniqueId, codeAgence, dateDebut, dateFin, notes }
   */
  router.post('/assign-agency', authMiddleware, async (req, res) => {
    try {
      const { agentUniqueId, codeAgence, dateDebut, dateFin, notes } = req.body;
      const userId = req.user?.userId || 'SYSTEM';

      if (!agentUniqueId || !codeAgence || !dateDebut || !dateFin) {
        return res.status(400).json({
          success: false,
          message: 'Agent, agence, date début et date fin requis'
        });
      }

      const pool = req.app.locals.pool;

      // Vérifier que les dates sont valides
      const debut = new Date(dateDebut);
      const fin = new Date(dateFin);
      if (debut > fin) {
        return res.status(400).json({
          success: false,
          message: 'La date de début doit être antérieure à la date de fin'
        });
      }

      // Vérifier qu'il n'y a pas de chevauchement pour cet agent
      const overlap = await pool.request()
        .input('agentId', sql.Int, agentUniqueId)
        .input('debut', sql.Date, debut)
        .input('fin', sql.Date, fin)
        .query(`
          SELECT id FROM tm_global_agent_agency_mapping
          WHERE agent_unique_id = @agentId
            AND (
              (date_debut <= @fin AND date_fin >= @debut)
            )
        `);

      if (overlap.recordset.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Il existe déjà une assignation pour cet agent sur cette période'
        });
      }

      // Insérer le mapping
      const result = await pool.request()
        .input('agentId', sql.Int, agentUniqueId)
        .input('codeAgence', sql.VarChar, codeAgence)
        .input('debut', sql.Date, debut)
        .input('fin', sql.Date, fin)
        .input('notes', sql.NVarChar, notes || null)
        .input('createdBy', sql.VarChar, userId)
        .query(`
          INSERT INTO tm_global_agent_agency_mapping
          (agent_unique_id, code_agence, date_debut, date_fin, notes, created_by)
          VALUES
          (@agentId, @codeAgence, @debut, @fin, @notes, @createdBy);

          SELECT SCOPE_IDENTITY() AS mappingId;
        `);

      const mappingId = result.recordset[0].mappingId;

      // Mettre à jour les transactions dans la table temporaire
      const updateResult = await pool.request()
        .input('agentId', sql.Int, agentUniqueId)
        .input('codeAgence', sql.VarChar, codeAgence)
        .input('debut', sql.Date, debut)
        .input('fin', sql.Date, fin)
        .query(`
          UPDATE temp_INFOSTRANSFERTPARTENAIRES
          SET CODEAGENCE = @codeAgence
          WHERE AGENT_UNIQUE_ID = @agentId
            AND PARTENAIRETRANSF = 'GLOBAL'
            AND DATEOPERATION BETWEEN @debut AND @fin
            AND (CODEAGENCE IS NULL OR CODEAGENCE = '')
            AND statut_validation = 'EN_ATTENTE'
        `);

      res.json({
        success: true,
        message: `Agence ${codeAgence} assignée à l'agent ${agentUniqueId}`,
        mappingId: mappingId,
        transactionsUpdated: updateResult.rowsAffected[0]
      });

    } catch (error) {
      console.error('Erreur assignation agence Global:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'assignation',
        error: error.message
      });
    }
  });

  /**
   * DELETE /api/global/mapping/:mappingId
   * Supprime un mapping agent-agence
   */
  router.delete('/mapping/:mappingId', authMiddleware, async (req, res) => {
    try {
      const { mappingId } = req.params;
      const pool = req.app.locals.pool;

      // Récupérer les infos du mapping avant suppression
      const mapping = await pool.request()
        .input('mappingId', sql.Int, parseInt(mappingId))
        .query(`
          SELECT agent_unique_id, code_agence, date_debut, date_fin
          FROM tm_global_agent_agency_mapping
          WHERE id = @mappingId
        `);

      if (mapping.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Mapping non trouvé'
        });
      }

      const { agent_unique_id, code_agence, date_debut, date_fin } = mapping.recordset[0];

      // Réinitialiser les transactions à NULL
      await pool.request()
        .input('agentId', sql.Int, agent_unique_id)
        .input('codeAgence', sql.VarChar, code_agence)
        .input('debut', sql.Date, date_debut)
        .input('fin', sql.Date, date_fin)
        .query(`
          UPDATE temp_INFOSTRANSFERTPARTENAIRES
          SET CODEAGENCE = NULL
          WHERE AGENT_UNIQUE_ID = @agentId
            AND CODEAGENCE = @codeAgence
            AND PARTENAIRETRANSF = 'GLOBAL'
            AND DATEOPERATION BETWEEN @debut AND @fin
            AND statut_validation = 'EN_ATTENTE'
        `);

      // Supprimer le mapping
      await pool.request()
        .input('mappingId', sql.Int, parseInt(mappingId))
        .query(`
          DELETE FROM tm_global_agent_agency_mapping
          WHERE id = @mappingId
        `);

      res.json({
        success: true,
        message: `Mapping ${mappingId} supprimé`
      });

    } catch (error) {
      console.error('Erreur suppression mapping Global:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la suppression',
        error: error.message
      });
    }
  });

  /**
   * PUT /api/global/mapping/:mappingId
   * Modifie un mapping agent-agence existant
   */
  router.put('/mapping/:mappingId', authMiddleware, async (req, res) => {
    try {
      const { mappingId } = req.params;
      const { codeAgence, dateDebut, dateFin, notes } = req.body;
      const pool = req.app.locals.pool;

      // Récupérer le mapping actuel
      const current = await pool.request()
        .input('mappingId', sql.Int, parseInt(mappingId))
        .query(`
          SELECT agent_unique_id, code_agence, date_debut, date_fin
          FROM tm_global_agent_agency_mapping
          WHERE id = @mappingId
        `);

      if (current.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Mapping non trouvé'
        });
      }

      const oldMapping = current.recordset[0];

      // Mettre à jour le mapping
      await pool.request()
        .input('mappingId', sql.Int, parseInt(mappingId))
        .input('codeAgence', sql.VarChar, codeAgence)
        .input('debut', sql.Date, new Date(dateDebut))
        .input('fin', sql.Date, new Date(dateFin))
        .input('notes', sql.NVarChar, notes || null)
        .query(`
          UPDATE tm_global_agent_agency_mapping
          SET code_agence = @codeAgence,
              date_debut = @debut,
              date_fin = @fin,
              notes = @notes
          WHERE id = @mappingId
        `);

      // Réinitialiser anciennes transactions
      await pool.request()
        .input('agentId', sql.Int, oldMapping.agent_unique_id)
        .input('oldAgence', sql.VarChar, oldMapping.code_agence)
        .input('oldDebut', sql.Date, oldMapping.date_debut)
        .input('oldFin', sql.Date, oldMapping.date_fin)
        .query(`
          UPDATE temp_INFOSTRANSFERTPARTENAIRES
          SET CODEAGENCE = NULL
          WHERE AGENT_UNIQUE_ID = @agentId
            AND CODEAGENCE = @oldAgence
            AND PARTENAIRETRANSF = 'GLOBAL'
            AND DATEOPERATION BETWEEN @oldDebut AND @oldFin
            AND statut_validation = 'EN_ATTENTE'
        `);

      // Appliquer nouvelles assignations
      await pool.request()
        .input('agentId', sql.Int, oldMapping.agent_unique_id)
        .input('newAgence', sql.VarChar, codeAgence)
        .input('newDebut', sql.Date, new Date(dateDebut))
        .input('newFin', sql.Date, new Date(dateFin))
        .query(`
          UPDATE temp_INFOSTRANSFERTPARTENAIRES
          SET CODEAGENCE = @newAgence
          WHERE AGENT_UNIQUE_ID = @agentId
            AND PARTENAIRETRANSF = 'GLOBAL'
            AND DATEOPERATION BETWEEN @newDebut AND @newFin
            AND (CODEAGENCE IS NULL OR CODEAGENCE = '')
            AND statut_validation = 'EN_ATTENTE'
        `);

      res.json({
        success: true,
        message: `Mapping ${mappingId} mis à jour`
      });

    } catch (error) {
      console.error('Erreur modification mapping Global:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la modification',
        error: error.message
      });
    }
  });

  return router;
};
