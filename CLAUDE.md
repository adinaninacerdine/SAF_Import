# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Système d'import de transactions pour MCTV (société de transfert d'argent aux Comores). L'application permet d'importer des fichiers de transactions provenant de partenaires internationaux (MoneyGram, RIA, Western Union) dans la base de données SQL Server, avec déduplication automatique des agents et détection des doublons.

**Stack:**
- Backend: Node.js + Express
- Frontend: React
- Database: SQL Server (SAF_MCTV_COMORES)
- Authentication: JWT (8h validity)

## Development Commands

### Backend
```bash
cd backend
npm install
node init-database.js  # Initialiser/vérifier les tables
npm start              # Mode production
npm run dev            # Mode développement avec nodemon
```

### Frontend
```bash
cd Frontend/src
npm install
npm start              # Serveur dev (port 3000)
npm run build          # Build production
npm test               # Tests
```

### Utilitaires
```bash
cd backend
node init-database.js        # Créer/vérifier schema + afficher stats
node analyse-excel.js <file> # Analyser structure d'un fichier Excel
node test.js                 # Tester connexion DB
```

## Architecture

### Backend Components

**server.js** - Serveur Express principal:
- Authentification JWT avec gestion des rôles (ADMIN: codes SAF* ou noms SUPERVISOR/ADMINISTRADOR)
- Import de transactions avec déduplication automatique des agents
- Endpoints API:
  - `/api/auth/login` - Connexion utilisateur
  - `/api/auth/verify` - Vérification token
  - `/api/agences` - Liste des agences
  - `/api/agences/:id/agents` - Agents d'une agence
  - `/api/import` - Import de fichier (POST, multipart/form-data)
  - `/api/imports/history` - Historique des imports
  - `/api/dashboard/stats` - Statistiques du jour et du mois
  - `/api/templates/:partner` - Télécharger template CSV
- Protection: middleware `authMiddleware` sur toutes les routes API
- Upload: multer, max 100MB, formats .xlsx/.xls/.csv

**agent-deduplication.js** - AgentDeduplicationService:
- Normalise les noms d'agents: uppercase, supprime chiffres finaux/parenthèses, garde seulement A-Z et espaces
- Exemple: "AMOUSSA001", "AMOUSSA002", "Amoussa (3)" → tous mappés au même `agent_unique_id`
- Tables utilisées:
  - `tm_agent_mapping` - Agents unifiés (agent_unique_id, agent_nom, agent_nom_normalise)
  - `tm_agent_codes` - Mapping codes→agents (agent_unique_id, code_user, code_agence)
- Méthode principale: `getOrCreateAgent(codeUser, nomAgent)` retourne `agent_unique_id`
- Cache en mémoire pour performance
- À l'initialisation, unifie automatiquement tous les agents de `UTILISATEURSSAF`

**import-handler.js** - ImportHandler:
- **Note: Ce fichier est actuellement vide/incomplet et nécessite implémentation**
- Devrait gérer le parsing des fichiers CSV/Excel selon le format du partenaire
- Devrait transformer les données en format standardisé
- Devrait insérer dans `INFOSTRANSFERTPARTENAIRES` avec le `agent_unique_id` approprié

**multi-agency-handler.js** - Gestion multi-agences:
- **Note: Ce fichier est actuellement vide/incomplet**

### Database Schema

**Tables existantes (utilisées par le système):**
- `UTILISATEURSSAF` - Utilisateurs du système (CODEUSER, MOTPASSE, NOM, CODEAGENCE)
- `CF.CF_AGENCIAS` - Agences MCTV (COD_AGENCIA, DES_AGENCIA)

**Table principale des transactions:**
```sql
INFOSTRANSFERTPARTENAIRES:
  ID (PK identity)
  CODETRANSACTION (varchar 50) - Numéro unique: MTCN, PIN, etc.
  PARTENAIRETRANSF (varchar 50) - MONEYGRAM, RIA, WESTERN_UNION
  MONTANT (decimal 18,2)
  COMMISSION (decimal 18,2)
  EFFECTUEPAR (varchar 50) - Code agent original du fichier
  AGENT_UNIQUE_ID (int) - FK vers tm_agent_mapping
  DATEOPERATION (datetime) - Date de la transaction
  EXPEDITEUR (nvarchar 200)
  BENEFICIAIRE (nvarchar 200)
  CODEAGENCE (varchar 20)
  STATUT (varchar 20)
  DATEIMPORT (datetime) - Date d'import dans le système
```

**Tables de déduplication:**
```sql
tm_agent_mapping:
  agent_unique_id (PK identity)
  agent_nom (nvarchar 250)
  agent_nom_normalise (nvarchar 250) - Version normalisée pour matching
  date_creation (datetime)
  statut (varchar 20) - ACTIF/INACTIF

tm_agent_codes:
  id (PK identity)
  agent_unique_id (FK → tm_agent_mapping)
  code_user (varchar 50, unique) - Code agent du fichier ou de UTILISATEURSSAF
  code_agence (varchar 50)
  date_ajout (datetime)
```

### Flux d'import de transactions

1. Upload fichier via `/api/import` (multer → dossier `uploads/`)
2. Parse fichier via `ImportHandler.parseFile(filePath)`
3. Pour chaque transaction:
   - Récupérer/créer `agent_unique_id` via `AgentDeduplicationService.getOrCreateAgent()`
   - Vérifier si doublon via `CODETRANSACTION`
   - Insérer dans `INFOSTRANSFERTPARTENAIRES` si nouveau
4. Retourner statistiques: success, duplicates, errors, agentsUnifies, totalAmount
5. Nettoyer le fichier temporaire

### Formats de partenaires supportés

**MoneyGram (CSV):**
```csv
MTCN,Sender Name,Receiver Name,Principal Amount Paid Out,Commission,Date/Time Paid,Operator
```

**RIA (CSV):**
```csv
PIN,Sender,Beneficiary,Payout Amount,Commission,Paid Date,User
```

**Western Union (Excel ou CSV):**
```
Date Creation,Date Paiement,MTCN,Agence,Expediteur,Beneficiaire,Code Agent,Montant Source,Devise,Montant Paye,Devise Paiement
```

Le système peut détecter automatiquement le format via les en-têtes ou la structure des données.

### Frontend (React)

**App.js** - Application complète avec:
- **LoginPage**: Authentification contre `UTILISATEURSSAF`
- **Interface d'import**:
  - Sélection partenaire (optionnel, auto-détection par défaut)
  - Mode: "MULTI" (toutes agences avec détection auto) ou agence spécifique
  - Upload fichier avec drag & drop
  - Affichage résultats: total, importées, doublons, montant total
  - Répartition détaillée par agence si mode MULTI activé
- **Fonctionnalités affichées**:
  - Import multi-agences avec détection automatique
  - Unification des agents (ex: AMOUSSA001 = AMOUSSA002)
  - Détection des doublons de transactions
  - Support Western Union, MoneyGram, RIA

## Configuration

**Variables d'environnement (backend/.env):**
```env
DB_SERVER=sqlserver
DB_NAME=SAF_MCTV_COMORES
DB_USER=sa
DB_PASSWORD=Admin@123
PORT=3001
JWT_SECRET=votre-secret-jwt-super-securise-2024-changez-moi
CORS_ORIGIN=http://localhost:3000
REACT_APP_API_URL=http://localhost:3001/api
```

## Points d'implémentation importants

- **Déduplication agents**: Les codes agents avec le même nom normalisé sont mappés au même `agent_unique_id` (ex: AMOUSSA001, AMOUSSA002, Amoussa (3) → même ID)
- **Détection doublons**: Basée sur l'unicité du champ `CODETRANSACTION`
- **Rôles utilisateurs**: ADMIN (codes commençant par "SAF" OU noms contenant "SUPERVISOR"/"ADMINISTRADOR") vs USER
- **Authentification legacy**: Support bcrypt ET plain text pour compatibilité
- **Connection pooling**: max 10 connexions, idle timeout 30s
- **Devise**: KMF (Franc Comorien)
- **Import multi-agences**: Le système peut détecter automatiquement le code agence dans les fichiers
- **Fichiers incomplets**: `import-handler.js` et `multi-agency-handler.js` sont actuellement vides et nécessitent implémentation complète
