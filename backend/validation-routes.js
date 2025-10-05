// validation-routes.js - Routes pour le workflow de validation
const express = require('express');
const router = express.Router();
const sql = require('mssql');
const { v4: uuidv4 } = require('uuid');

module.exports = function(pool, importHandler, authMiddleware) {

  // Nouvelle route: Import en staging (table temporaire)
  router.post('/import-staging', authMiddleware, async (req, res) => {
    const { transactions, agenceId } = req.body;
    const userId = req.user.userId;

    try {
      const importSessionId = uuidv4();

      const result = await importHandler.importToStaging(
        transactions,
        agenceId,
        userId,
        importSessionId
      );

      res.json({
        success: true,
        importSessionId,
        ...result
      });

    } catch (error) {
      console.error('❌ Erreur import staging:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Liste des imports en attente de validation
  router.get('/imports/pending', authMiddleware, async (req, res) => {
    try {
      const result = await pool.request().query(`
        SELECT
          import_session_id,
          import_user_id,
          MIN(import_date) as import_date,
          COUNT(*) as nb_transactions,
          SUM(MONTANT) as montant_total,
          PARTENAIRETRANSF as partenaire,
          MIN(DATEOPERATION) as date_min,
          MAX(DATEOPERATION) as date_max
        FROM temp_INFOSTRANSFERTPARTENAIRES
        WHERE statut_validation = 'EN_ATTENTE'
        GROUP BY import_session_id, import_user_id, PARTENAIRETRANSF
        ORDER BY MIN(import_date) DESC
      `);

      res.json(result.recordset);

    } catch (error) {
      console.error('❌ Erreur récupération imports:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Détails d'un import en attente
  router.get('/imports/pending/:sessionId', authMiddleware, async (req, res) => {
    try {
      const { sessionId } = req.params;

      const result = await pool.request()
        .input('sessionId', sql.VarChar, sessionId)
        .query(`
          SELECT TOP 100
            t.*,
            am.agent_nom as agent_nom_unifie
          FROM temp_INFOSTRANSFERTPARTENAIRES t
          LEFT JOIN tm_agent_mapping am ON t.AGENT_UNIQUE_ID = am.agent_unique_id
          WHERE t.import_session_id = @sessionId
            AND t.statut_validation = 'EN_ATTENTE'
          ORDER BY t.id
        `);

      res.json(result.recordset);

    } catch (error) {
      console.error('❌ Erreur récupération détails:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Valider un import (déplacer vers table principale)
  router.post('/imports/validate/:sessionId', authMiddleware, async (req, res) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user.userId;
      const { commentaire } = req.body;

      // Vérifier que l'utilisateur est admin
      if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Seuls les administrateurs peuvent valider' });
      }

      // 1. Déplacer les transactions vers la table principale
      const insertResult = await pool.request()
        .input('sessionId', sql.VarChar, sessionId)
        .query(`
          INSERT INTO INFOSTRANSFERTPARTENAIRES
          (NUMERO, CODEENVOI, PARTENAIRETRANSF, MONTANT, COMMISSION, TAXES,
           EFFECTUEPAR, DATEOPERATION, NOMPRENOMBENEFICIAIRE, NOMPRENOMEXPEDITEUR,
           CODEAGENCE, TYPEOPERATION, MONTANTTOTAL, AGENT_UNIQUE_ID, date_creation)
          SELECT
            NUMERO, CODEENVOI, PARTENAIRETRANSF, MONTANT, COMMISSION, TAXES,
            EFFECTUEPAR, DATEOPERATION, NOMPRENOMBENEFICIAIRE, NOMPRENOMEXPEDITEUR,
            CODEAGENCE, TYPEOPERATION, MONTANTTOTAL, AGENT_UNIQUE_ID, GETDATE()
          FROM temp_INFOSTRANSFERTPARTENAIRES
          WHERE import_session_id = @sessionId
            AND statut_validation = 'EN_ATTENTE'
        `);

      // 2. Marquer comme validé dans la table temporaire
      await pool.request()
        .input('sessionId', sql.VarChar, sessionId)
        .input('userId', sql.VarChar, userId)
        .input('commentaire', sql.VarChar, commentaire)
        .query(`
          UPDATE temp_INFOSTRANSFERTPARTENAIRES
          SET statut_validation = 'VALIDE',
              validation_user_id = @userId,
              validation_date = GETDATE(),
              commentaire = @commentaire
          WHERE import_session_id = @sessionId
            AND statut_validation = 'EN_ATTENTE'
        `);

      res.json({
        success: true,
        transactionsValidees: insertResult.rowsAffected[0]
      });

    } catch (error) {
      console.error('❌ Erreur validation:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Rejeter un import
  router.post('/imports/reject/:sessionId', authMiddleware, async (req, res) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user.userId;
      const { commentaire } = req.body;

      // Vérifier que l'utilisateur est admin
      if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Seuls les administrateurs peuvent rejeter' });
      }

      const result = await pool.request()
        .input('sessionId', sql.VarChar, sessionId)
        .input('userId', sql.VarChar, userId)
        .input('commentaire', sql.VarChar, commentaire || 'Import rejeté')
        .query(`
          UPDATE temp_INFOSTRANSFERTPARTENAIRES
          SET statut_validation = 'REJETE',
              validation_user_id = @userId,
              validation_date = GETDATE(),
              commentaire = @commentaire
          WHERE import_session_id = @sessionId
            AND statut_validation = 'EN_ATTENTE'
        `);

      res.json({
        success: true,
        transactionsRejetees: result.rowsAffected[0]
      });

    } catch (error) {
      console.error('❌ Erreur rejet:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Nettoyer les imports validés/rejetés (optionnel)
  router.delete('/imports/cleanup', authMiddleware, async (req, res) => {
    try {
      // Vérifier que l'utilisateur est admin
      if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Seuls les administrateurs peuvent nettoyer' });
      }

      const result = await pool.request()
        .query(`
          DELETE FROM temp_INFOSTRANSFERTPARTENAIRES
          WHERE statut_validation IN ('VALIDE', 'REJETE')
            AND validation_date < DATEADD(DAY, -30, GETDATE())
        `);

      res.json({
        success: true,
        lignessupprimees: result.rowsAffected[0]
      });

    } catch (error) {
      console.error('❌ Erreur nettoyage:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};
