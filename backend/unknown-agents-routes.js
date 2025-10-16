// unknown-agents-routes.js - Routes API pour gérer les codes agents inconnus
const express = require('express');
const sql = require('mssql');

module.exports = (authMiddleware) => {
  const router = express.Router();

  /**
   * GET /api/agents/unknown
   * Liste tous les agents avec statut INCONNU
   */
  router.get('/unknown', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    const unknownAgents = await pool.request().query(`
      SELECT
        am.agent_unique_id,
        am.agent_nom,
        am.agent_nom_normalise,
        STRING_AGG(ac.code_user, ', ') as codes,
        COUNT(DISTINCT t.NUMERO) as nb_transactions,
        SUM(t.MONTANT) as montant_total
      FROM tm_agent_mapping am
      LEFT JOIN tm_agent_codes ac ON am.agent_unique_id = ac.agent_unique_id
      LEFT JOIN INFOSTRANSFERTPARTENAIRES t ON t.AGENT_UNIQUE_ID = am.agent_unique_id
      WHERE am.statut = 'INCONNU'
      GROUP BY am.agent_unique_id, am.agent_nom, am.agent_nom_normalise
      ORDER BY COUNT(DISTINCT t.NUMERO) DESC
    `);

    res.json({
      success: true,
      unknownAgents: unknownAgents.recordset
    });

  } catch (error) {
    console.error('Erreur récupération agents inconnus:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

/**
 * GET /api/agents/known
 * Liste tous les agents connus (pour dropdown de liaison)
 */
router.get('/known', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    // Solution: Limiter les codes affichés aux 10 premiers pour éviter le dépassement de 8000 bytes
    // On garde le compteur total nb_codes pour l'information
    const knownAgents = await pool.request().query(`
      SELECT
        am.agent_unique_id,
        am.agent_nom,
        (
          SELECT STRING_AGG(code_user, ', ')
          FROM (
            SELECT TOP 10 code_user
            FROM tm_agent_codes
            WHERE agent_unique_id = am.agent_unique_id
            ORDER BY code_user
          ) sub
        ) as codes_sample,
        COUNT(DISTINCT ac.code_user) as nb_codes
      FROM tm_agent_mapping am
      LEFT JOIN tm_agent_codes ac ON am.agent_unique_id = ac.agent_unique_id
      WHERE am.statut = 'ACTIF'
      GROUP BY am.agent_unique_id, am.agent_nom
      ORDER BY am.agent_nom
    `);

    res.json({
      success: true,
      knownAgents: knownAgents.recordset
    });

  } catch (error) {
    console.error('Erreur récupération agents connus:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

/**
 * POST /api/agents/link
 * Lie un code agent inconnu à un agent existant
 * Body: { codeUser: "MRAIZ00", targetAgentId: 134 }
 */
router.post('/link', authMiddleware, async (req, res) => {
  try {
    const { codeUser, targetAgentId } = req.body;

    if (!codeUser || !targetAgentId) {
      return res.status(400).json({
        success: false,
        message: 'Code agent et agent cible requis'
      });
    }

    const agentService = req.app.locals.agentService;

    if (!agentService) {
      return res.status(500).json({
        success: false,
        message: 'Service de déduplication non disponible'
      });
    }

    // Lier le code à l'agent
    await agentService.linkUnknownCodeToAgent(codeUser, targetAgentId);

    res.json({
      success: true,
      message: `Code ${codeUser} lié à l'agent ${targetAgentId}`
    });

  } catch (error) {
    console.error('Erreur liaison code agent:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la liaison',
      error: error.message
    });
  }
});

/**
 * DELETE /api/agents/unknown/:agentId
 * Supprime un agent inconnu (et ses codes)
 */
router.delete('/unknown/:agentId', authMiddleware, async (req, res) => {
  try {
    const { agentId } = req.params;
    const pool = req.app.locals.pool;

    // Supprimer les codes liés
    await pool.request()
      .input('agent_id', sql.Int, parseInt(agentId))
      .query(`DELETE FROM tm_agent_codes WHERE agent_unique_id = @agent_id`);

    // Supprimer l'agent
    await pool.request()
      .input('agent_id', sql.Int, parseInt(agentId))
      .query(`DELETE FROM tm_agent_mapping WHERE agent_unique_id = @agent_id AND statut = 'INCONNU'`);

    res.json({
      success: true,
      message: `Agent ${agentId} supprimé`
    });

  } catch (error) {
    console.error('Erreur suppression agent inconnu:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression',
      error: error.message
    });
  }
});

  return router;
};
