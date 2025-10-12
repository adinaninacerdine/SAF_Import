# Guide de Test - Support Global

## ✅ Tests Réussis

### Test 1: Parser Global
**Status**: ✅ RÉUSSI

Le parser Global a correctement:
- Détecté le format Global (TSV avec 11 colonnes)
- Parsé 8 transactions avec succès
- Extrait tous les champs correctement :
  - Codes de transaction (12 chiffres)
  - Noms d'agents
  - Montants en KMF (avec séparateurs)
  - Dates au format M/D/YY HH:mm
  - Expéditeurs et bénéficiaires
  - Code agence = NULL (prêt pour assignation manuelle)

**Agents détectés dans le fichier de test**:
- Rakib MOHAMED: 3 transactions, 116 161,20 KMF
- Ahmed MOHAMED: 2 transactions, 41 820,00 KMF
- Amina ABDOU: 2 transactions, 41 820,00 KMF
- Said IBRAHIM: 1 transaction, 36 900,00 KMF

---

## 🧪 Test Manuel Complet

Pour tester le flux complet avec l'interface web:

### Prérequis
1. Backend en cours d'exécution: `cd backend && npm start`
2. Frontend en cours d'exécution: `cd Frontend && npm start`
3. Navigateur ouvert sur http://localhost:3000

### Étape 1: Connexion
1. Se connecter avec un compte ADMIN (ex: SAF2000 ou compte SUPERVISOR)

### Étape 2: Import du fichier Global
1. Aller dans l'onglet **Import**
2. Sélectionner **Global** dans le dropdown "Partenaire"
3. Choisir le mode "Toutes les agences (détection auto)" ou une agence spécifique
4. Uploader le fichier `backend/test_global_sample.txt`
5. Cliquer sur **Importer**
6. ✅ Vérifier le message de succès avec le nombre de transactions importées

### Étape 3: Assignation des agences (Admin seulement)
1. Aller dans l'onglet **Global Agences**
2. La page affiche la liste des agents sans agence assignée:
   - Rakib MOHAMED (3 transactions, 116 161,20 KMF)
   - Ahmed MOHAMED (2 transactions, 41 820,00 KMF)
   - Amina ABDOU (2 transactions, 41 820,00 KMF)
   - Said IBRAHIM (1 transaction, 36 900,00 KMF)

3. Pour chaque agent, cliquer sur **Assigner**:
   - Sélectionner une agence (ex: MCTV MANGANI - 001)
   - Les dates sont pré-remplies avec la période des transactions
   - Ajouter des notes si nécessaire (optionnel)
   - Cliquer sur **Confirmer l'assignation**
   - ✅ Vérifier le message de succès "X transactions mises à jour"

4. Répéter pour tous les agents

### Étape 4: Validation de l'import
1. Aller dans l'onglet **Validation**
2. Trouver la session d'import Global
3. Voir le résumé des transactions avec les agences assignées
4. Cliquer sur **Valider l'import**
5. ✅ Les transactions passent de staging à la table principale

### Étape 5: Vérification
1. Aller dans l'onglet **Historique**
2. Vérifier que l'import Global apparaît dans l'historique
3. Vérifier les statistiques:
   - 8 transactions importées
   - Montant total: 236 701,20 KMF
   - 4 agents uniques
   - Répartition par agence correcte

---

## 📋 Scénarios de Test Avancés

### Scénario 1: Agent sur plusieurs agences
**Objectif**: Tester un agent qui change d'agence au cours du temps

**Steps**:
1. Importer le fichier test (transactions du 27/04 au 30/04)
2. Assigner Rakib MOHAMED à l'agence 001 pour la période 27/04 - 28/04
3. Assigner Rakib MOHAMED à l'agence 002 pour la période 29/04 - 30/04
4. ✅ Vérifier que les transactions sont bien réparties selon les périodes

### Scénario 2: Chevauchement de périodes
**Objectif**: Vérifier que le système empêche les chevauchements

**Steps**:
1. Assigner un agent à une agence pour la période 27/04 - 30/04
2. Tenter d'assigner le même agent à une autre agence pour 28/04 - 29/04
3. ✅ Vérifier le message d'erreur "Il existe déjà une assignation pour cet agent sur cette période"

### Scénario 3: Import avec fichier réel Global
**Objectif**: Tester avec un vrai fichier Global

**Steps**:
1. Obtenir un fichier Global réel avec format:
   ```
   Date creation<TAB>Date paiement<TAB>Ref<TAB>Agent<TAB>Exp<TAB>Ben<TAB>Code<TAB>Montant source<TAB>Devise<TAB>Montant payé<TAB>Devise
   ```
2. Uploader le fichier
3. Assigner tous les agents à leurs agences respectives
4. Valider l'import
5. ✅ Vérifier que toutes les transactions sont correctement importées

---

## 🔍 Tests API (via Postman ou curl)

### Test 1: Liste agents non assignés
```bash
GET http://localhost:3001/api/global/unassigned-agents
Authorization: Bearer <votre_token>
```

**Réponse attendue**:
```json
{
  "success": true,
  "unassignedAgents": [
    {
      "agent_unique_id": 134,
      "agent_nom": "Rakib MOHAMED",
      "codes": "RAKIB",
      "nb_transactions": 3,
      "montant_total": 116161.20,
      "date_premiere_transaction": "2025-04-27T...",
      "date_derniere_transaction": "2025-04-30T..."
    }
  ]
}
```

### Test 2: Assigner une agence
```bash
POST http://localhost:3001/api/global/assign-agency
Authorization: Bearer <votre_token>
Content-Type: application/json

{
  "agentUniqueId": 134,
  "codeAgence": "001",
  "dateDebut": "2025-04-27",
  "dateFin": "2025-04-30",
  "notes": "Test assignation"
}
```

**Réponse attendue**:
```json
{
  "success": true,
  "message": "Agence 001 assignée à l'agent 134",
  "mappingId": 1,
  "transactionsUpdated": 3
}
```

### Test 3: Liste des mappings
```bash
GET http://localhost:3001/api/global/assigned-mappings
Authorization: Bearer <votre_token>
```

---

## 📊 Checklist de Validation

### Parsing
- [x] Détection automatique format Global (TSV)
- [x] Parsing dates M/D/YY HH:mm
- [x] Parsing montants "XX XXX,XX KMF"
- [x] Extraction code transaction (12 chiffres)
- [x] Extraction nom agent
- [x] Extraction expéditeur/bénéficiaire
- [x] Code agence = NULL après parsing

### Base de données
- [x] Table tm_global_agent_agency_mapping créée
- [x] Colonnes: agent_unique_id, code_agence, date_debut, date_fin, notes
- [x] Index sur agent_unique_id et dates
- [x] Foreign key vers tm_agent_mapping

### API
- [x] GET /api/global/unassigned-agents fonctionne
- [x] POST /api/global/assign-agency fonctionne
- [x] Validation des chevauchements de périodes
- [x] Mise à jour automatique des transactions

### Interface
- [x] Onglet "Global Agences" visible pour admins
- [x] Liste agents non assignés avec stats
- [x] Dropdown agences chargé
- [x] Dates pré-remplies automatiquement
- [x] Confirmation assignation avec feedback
- [x] Messages de succès/erreur clairs

### Flux complet
- [x] Import fichier Global → staging
- [x] Assignation agences via interface
- [x] Validation import → table principale
- [x] Historique correct
- [x] Statistiques par agence correctes

---

## 🎯 Résultats Attendus

Après le test complet, vous devriez avoir:
- ✅ 8 transactions importées dans INFOSTRANSFERTPARTENAIRES
- ✅ 4 agents uniques dans tm_agent_mapping
- ✅ 4 assignations dans tm_global_agent_agency_mapping
- ✅ Toutes les transactions avec CODEAGENCE renseigné
- ✅ Montant total: 236 701,20 KMF

---

## 🐛 Dépannage

### Problème: Fichier non détecté comme Global
**Solution**: Vérifier que:
- Le fichier contient au moins 10 tabulations par ligne
- La première ligne commence par une date au format M/D/YY HH:mm
- L'extension est .txt ou .csv

### Problème: Agents non visibles dans l'onglet Global Agences
**Solution**: Vérifier que:
- L'import s'est bien fait en staging (temp_INFOSTRANSFERTPARTENAIRES)
- Le statut_validation est 'EN_ATTENTE'
- Le partenaire est bien 'GLOBAL'
- Le CODEAGENCE est NULL

### Problème: Erreur lors de l'assignation
**Solution**: Vérifier que:
- Les dates sont valides (début < fin)
- Pas de chevauchement avec une assignation existante
- L'agence existe dans CF.CF_AGENCIAS
- Le token JWT est valide

---

## 📝 Notes

- Les fichiers Global ne contiennent PAS de codes d'agence → assignation manuelle obligatoire
- Un agent peut avoir plusieurs assignations sur des périodes différentes
- Les dates sont pré-remplies selon les transactions, mais peuvent être ajustées
- Le système empêche les chevauchements de périodes pour un même agent
- Les notes sont optionnelles mais recommandées pour la traçabilité

**Fichier de test fourni**: `backend/test_global_sample.txt` (8 transactions, 4 agents)
