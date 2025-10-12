# Migration Production - Support Global

## Résumé des changements

Ce commit ajoute le support complet pour le partenaire **Global** avec un système d'assignation manuelle des agences par période.

## Nouveautés principales

### 1. Parser Global
- Format: TSV avec 11 colonnes
- Détection automatique du format
- Parsing montants KMF (colonne 10)
- Parsing dates format M/D/YY HH:mm
- CODEAGENCE = NULL après import (assignation manuelle requise)

### 2. Système d'assignation manuelle
- Interface admin "Global Agences"
- Assignation agent → agence par période
- Support des agents mobiles (plusieurs agences/périodes)
- Prévention des chevauchements de périodes

### 3. Nouvelle table BDD
```sql
tm_global_agent_agency_mapping:
  - agent_unique_id (FK → tm_agent_mapping)
  - code_agence
  - date_debut
  - date_fin
  - notes
  - created_by
  - date_creation
```

### 4. Nouvelles routes API
- `GET /api/global/unassigned-agents` - Liste agents sans agence
- `GET /api/global/assigned-mappings` - Liste mappings existants
- `POST /api/global/assign-agency` - Assigner agence par période
- `PUT /api/global/mapping/:id` - Modifier mapping
- `DELETE /api/global/mapping/:id` - Supprimer mapping

### 5. Corrections critiques
- Fix SQL `STRING_AGG` → `STUFF + FOR XML PATH` (compatibilité SQL Server)
- Fix parser Global utilise montant KMF au lieu de EUR

## Étapes de migration en production

### 1. Backup de la base de données
```bash
# Backup complet avant migration
sqlcmd -S localhost -U sa -Q "BACKUP DATABASE SAF_MCTV_COMORES TO DISK='C:\Backups\SAF_MCTV_COMORES_avant_global.bak'"
```

### 2. Arrêt des services
```bash
# Arrêter backend
cd backend
# Ctrl+C ou kill le processus Node.js

# Arrêter frontend
cd Frontend
# Ctrl+C ou kill le processus Node.js
```

### 3. Pull des modifications
```bash
git pull origin main
```

### 4. Installation des dépendances
```bash
cd backend
npm install

cd ../Frontend
npm install
```

### 5. Création de la table Global
```bash
cd backend
node create-global-agency-mapping-table.js
```

**Sortie attendue:**
```
✅ Table tm_global_agent_agency_mapping créée
✅ Index créé sur agent_unique_id
✅ Index créé sur dates
✅ Foreign key créée vers tm_agent_mapping
```

### 6. Vérification de la structure
```sql
-- Vérifier que la table existe
SELECT * FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME = 'tm_global_agent_agency_mapping'

-- Vérifier les colonnes
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'tm_global_agent_agency_mapping'
ORDER BY ORDINAL_POSITION
```

### 7. Redémarrage des services
```bash
# Backend
cd backend
npm start

# Frontend (nouveau terminal)
cd Frontend
npm start
```

### 8. Tests de validation

#### Test 1: Import fichier Global
1. Connexion avec compte ADMIN
2. Aller dans onglet "Import"
3. Sélectionner "Global" dans le dropdown partenaire
4. Uploader un fichier Global (.txt ou .csv)
5. Cliquer sur "Importer"
6. ✅ Vérifier message de succès avec nombre de transactions

#### Test 2: Assignation manuelle
1. Aller dans onglet "Global Agences"
2. Vérifier la liste des agents sans agence s'affiche
3. Pour un agent, cliquer sur "Assigner"
4. Sélectionner une agence
5. Vérifier que les dates sont pré-remplies
6. Ajuster les dates si nécessaire
7. Cliquer sur "Confirmer l'assignation"
8. ✅ Vérifier message "X transactions mises à jour"

#### Test 3: Validation de l'import
1. Aller dans onglet "Validation"
2. ✅ Vérifier que la page charge sans erreur SQL
3. Trouver la session d'import Global
4. Vérifier le résumé des transactions
5. Cliquer sur "Valider l'import"
6. ✅ Les transactions passent en table principale

#### Test 4: Vérification historique
1. Aller dans onglet "Historique"
2. ✅ Vérifier que l'import Global apparaît
3. Vérifier les statistiques (nb transactions, montant)

## Fichiers modifiés

### Backend
- `backend/global-agency-routes.js` (nouveau)
- `backend/create-global-agency-mapping-table.js` (nouveau)
- `backend/unknown-agents-routes.js` (nouveau)
- `backend/validation-routes.js` (fix SQL)
- `backend/import-handler.js` (parser Global)
- `backend/server.js` (routes Global)

### Frontend
- `Frontend/src/GlobalAgencyLinkingPage.js` (nouveau)
- `Frontend/src/UnknownAgentsPage.js` (nouveau)
- `Frontend/src/ReportsPage.js` (nouveau)
- `Frontend/src/App.js` (onglet Global)

### Documentation
- `GUIDE_TEST_GLOBAL.md` (nouveau)
- `backend/test_global_sample.txt` (fichier de test)

## Format fichier Global attendu

**Colonnes (séparées par TAB):**
1. Date envoi (M/D/YY HH:mm)
2. Date paiement (M/D/YY HH:mm)
3. Code transaction (12 chiffres)
4. Caissier/Agent (nom)
5. Expéditeur (nom)
6. Bénéficiaire (nom)
7. Numéro téléphone
8. Montant EUR
9. Devise EUR
10. **Montant KMF** ← utilisé pour MONTANT
11. Devise KMF

**Exemple:**
```
4/30/25 14:58	4/30/25 17:22	879244097447	Rakib MOHAMED	Locke MALAMA	Chaffi Ahmed FATIMA	3433459	1,00	EUR	49200,00	KMF
```

## Rollback si problème

### Option 1: Rollback Git
```bash
git reset --hard HEAD~1
npm install  # dans backend et Frontend
```

### Option 2: Restore Database
```sql
USE master;
RESTORE DATABASE SAF_MCTV_COMORES
FROM DISK = 'C:\Backups\SAF_MCTV_COMORES_avant_global.bak'
WITH REPLACE;
```

## Support et dépannage

### Problème: Table tm_global_agent_agency_mapping n'existe pas
**Solution:** Exécuter `node backend/create-global-agency-mapping-table.js`

### Problème: Erreur SQL "Incorrect syntax near ','"
**Solution:** Vérifier que `validation-routes.js` utilise `STUFF + FOR XML PATH` et non `STRING_AGG`

### Problème: Agents Global non visibles dans l'onglet
**Solution:** Vérifier que:
- Import s'est fait avec `PARTENAIRETRANSF = 'GLOBAL'`
- `CODEAGENCE IS NULL` dans temp_INFOSTRANSFERTPARTENAIRES
- `statut_validation = 'EN_ATTENTE'`

### Problème: Montants incorrects
**Solution:** Le parser Global utilise la colonne 10 (montant KMF), pas la colonne 8 (montant EUR)

## Contacts

En cas de problème pendant la migration, contacter l'équipe technique.

---

**Date de création:** 2025-01-12
**Version:** 1.0
**Commit:** 2558f30
