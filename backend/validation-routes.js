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
          ORDER BY t.NUMERO
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

      // 1. Obtenir le prochain NUMERO disponible
      const maxNumeroResult = await pool.request().query(`
        SELECT ISNULL(MAX(NUMERO), 0) + 1 as next_numero
        FROM INFOSTRANSFERTPARTENAIRES
      `);
      const startNumero = maxNumeroResult.recordset[0].next_numero;

      // 2. Déplacer les transactions vers la table principale avec NUMERO généré
      const insertResult = await pool.request()
        .input('sessionId', sql.VarChar, sessionId)
        .input('startNumero', sql.Numeric, startNumero)
        .query(`
          INSERT INTO INFOSTRANSFERTPARTENAIRES
          (NUMERO, CODEENVOI, PARTENAIRETRANSF, MONTANT, COMMISSION, TAXES,
           EFFECTUEPAR, DATEOPERATION, NOMPRENOMBENEFICIAIRE, NOMPRENOMEXPEDITEUR,
           CODEAGENCE, TYPEOPERATION, MONTANTTOTAL, AGENT_UNIQUE_ID, date_creation)
          SELECT
            @startNumero + ROW_NUMBER() OVER (ORDER BY NUMERO) - 1,
            CODEENVOI, PARTENAIRETRANSF, MONTANT, COMMISSION, TAXES,
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

  // Historique des validations
  router.get('/imports/history', authMiddleware, async (req, res) => {
    try {
      const { limit = 50, status, startDate, endDate } = req.query;

      let whereClause = "WHERE statut_validation IN ('VALIDE', 'REJETE')";

      if (status) {
        whereClause += ` AND statut_validation = '${status}'`;
      }

      if (startDate) {
        whereClause += ` AND validation_date >= '${startDate}'`;
      }

      if (endDate) {
        whereClause += ` AND validation_date <= '${endDate}'`;
      }

      const result = await pool.request().query(`
        SELECT
          import_session_id,
          import_user_id,
          MIN(import_date) as import_date,
          validation_user_id,
          MIN(validation_date) as validation_date,
          statut_validation,
          MIN(commentaire) as commentaire,
          COUNT(*) as nb_transactions,
          SUM(MONTANT) as montant_total,
          PARTENAIRETRANSF as partenaire,
          MIN(DATEOPERATION) as date_min,
          MAX(DATEOPERATION) as date_max
        FROM temp_INFOSTRANSFERTPARTENAIRES
        ${whereClause}
        GROUP BY import_session_id, import_user_id, validation_user_id, statut_validation, PARTENAIRETRANSF
        ORDER BY MIN(validation_date) DESC
        OFFSET 0 ROWS FETCH NEXT ${parseInt(limit)} ROWS ONLY
      `);

      res.json(result.recordset);

    } catch (error) {
      console.error('❌ Erreur historique:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Détails des doublons pour un import
  router.get('/imports/duplicates/:sessionId', authMiddleware, async (req, res) => {
    try {
      const { sessionId } = req.params;

      const result = await pool.request()
        .input('sessionId', sql.VarChar, sessionId)
        .query(`
          SELECT
            t.CODEENVOI,
            t.PARTENAIRETRANSF,
            t.MONTANT as montant_nouveau,
            t.DATEOPERATION as date_nouveau,
            t.EFFECTUEPAR as agent_nouveau,
            t.NOMPRENOMEXPEDITEUR as expediteur_nouveau,
            t.NOMPRENOMBENEFICIAIRE as beneficiaire_nouveau,
            t.TYPEOPERATION as type_nouveau,
            p.MONTANT as montant_existant,
            p.DATEOPERATION as date_existant,
            p.EFFECTUEPAR as agent_existant,
            p.NOMPRENOMEXPEDITEUR as expediteur_existant,
            p.NOMPRENOMBENEFICIAIRE as beneficiaire_existant,
            p.TYPEOPERATION as type_existant,
            p.date_creation as date_import_existant
          FROM temp_INFOSTRANSFERTPARTENAIRES t
          INNER JOIN INFOSTRANSFERTPARTENAIRES p
            ON t.CODEENVOI = p.CODEENVOI
            AND t.PARTENAIRETRANSF = p.PARTENAIRETRANSF
            AND t.DATEOPERATION = p.DATEOPERATION
          WHERE t.import_session_id = @sessionId
          ORDER BY t.MONTANT DESC
        `);

      res.json(result.recordset);

    } catch (error) {
      console.error('❌ Erreur doublons:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};
