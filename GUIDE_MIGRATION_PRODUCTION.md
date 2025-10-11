# Guide de Migration vers Production - SAF Import System

**Date**: 11/10/2025
**Version Application**: 2.0.0
**Statut**: Prêt pour migration

---

## État Actuel de l'Application

### ✅ Modifications Commitées (commit 68a05c7)

```bash
feat: Préparation migration production et amélioration rapports

- Correction port backend 3001 (cohérence docker-compose/env)
- Ajout système de rapports avec interface dédiée
- Filtrage scripts temporaires et rapports générés (.gitignore)
- Correction routes agences (CF.CF_AGENCIAS)
- Support validation automatique des imports
- Interface multi-onglets (Import/Validation/Historique/Rapports)
```

### 🚀 Fonctionnalités Opérationnelles

#### Backend (Port 3001)
- ✅ **Authentification JWT** (8h validité)
- ✅ **Déduplication agents** (401 agents unifiés)
- ✅ **Import multi-agences** avec détection automatique
- ✅ **Validation/staging** des imports
- ✅ **Système de rapports** (CSV/TXT)
- ✅ **API RESTful** complète

#### Frontend (Port 3000)
- ✅ **Interface React** compilée avec succès
- ✅ **4 onglets**: Import, Validation, Historique, Rapports
- ✅ **Drag & drop** pour upload fichiers
- ✅ **Gestion multi-agences**
- ✅ **Affichage temps réel** des résultats

#### Base de Données
- ✅ **Architecture dual database** fonctionnelle
  - `SAF_MCTV_COMORES` (7.6 GB) - Comptabilité + Référence
  - `MCTV_INTERCAISSE` (578 MB) - Opérations courantes
- ✅ **Réplication automatique** (913,668 transactions synchronisées)
- ✅ **Procédure stockée** `INSERTTRANSFERTPARTENAIRES` validée

---

## Configuration Production

### Variables d'Environnement

#### Backend (.env.production)
```env
# SQL Server Production
DB_SERVER=sqlserver
DB_NAME=SAF_MCTV_COMORES
DB_USER=sa
DB_PASSWORD=Admin@123

# Application
NODE_ENV=production
PORT=3001
JWT_SECRET=mctv-secret-key-2024-changez-moi-en-production
CORS_ORIGIN=http://localhost:3000

# Frontend
REACT_APP_API_URL=http://localhost:3001/api
```

#### Frontend (.env)
```env
REACT_APP_API_URL=http://localhost:3001/api
```

### Docker Compose (Ports Corrigés)

```yaml
services:
  sqlserver:
    ports:
      - "1433:1433"

  backend:
    ports:
      - "3001:3001"  # ✅ Corrigé (était 3003)
    environment:
      - PORT=3001

  frontend:
    ports:
      - "3000:80"
    environment:
      - REACT_APP_API_URL=http://localhost:3001/api
```

---

## Procédure de Migration

### Étape 1: Préparation Serveur Production

```bash
# 1. Installer Docker Desktop (Windows Server) ou Docker Engine (Linux)
# 2. Cloner le repository
git clone <repo-url> /opt/saf-import
cd /opt/saf-import

# 3. Vérifier la version
git log --oneline -1
# Doit afficher: 68a05c7 feat: Préparation migration production...
```

### Étape 2: Configuration Base de Données

#### Option A: Restauration Dual Database (Recommandée)

```bash
# 1. Copier les backups vers le serveur
# - SAF_MCTV_COMORES.bak (578 MB)
# - BACKUP_SAF_MCTV_COMORES_170920251005.bak (7.6 GB)

# 2. Placer dans le dossier backup/
cp *.bak /opt/saf-import/backup/

# 3. Démarrer SQL Server
docker-compose up -d sqlserver

# 4. Attendre que SQL Server soit prêt (30-60 secondes)
docker logs -f mctv-sqlserver

# 5. Restaurer les bases (méthode manuelle via SSMS ou Azure Data Studio)
# Voir RESTORE_DUAL_DATABASES.md pour les commandes SQL
```

#### Option B: Connexion à SQL Server Existant

```bash
# Modifier backend/.env
DB_SERVER=<ip-serveur-sql>
DB_NAME=SAF_MCTV_COMORES
DB_USER=<utilisateur>
DB_PASSWORD=<mot-de-passe>

# Désactiver le service sqlserver dans docker-compose.yml
# (commenter la section sqlserver)
```

### Étape 3: Variables d'Environnement Production

```bash
# 1. Créer .env.production à la racine
cat > .env.production << EOF
DB_SERVER=sqlserver
DB_NAME=SAF_MCTV_COMORES
DB_USER=sa
DB_PASSWORD=<MOT_DE_PASSE_SECURISE>
NODE_ENV=production
PORT=3001
JWT_SECRET=<GENERER_SECRET_UNIQUE>
CORS_ORIGIN=http://<IP_SERVEUR>:3000
REACT_APP_API_URL=http://<IP_SERVEUR>:3001/api
EOF

# 2. Copier vers backend/
cp .env.production backend/.env

# 3. Sécuriser les permissions
chmod 600 backend/.env
```

### Étape 4: Build et Démarrage Docker

```bash
# 1. Construire les images
docker-compose build --no-cache

# 2. Démarrer tous les services
docker-compose up -d

# 3. Vérifier les logs
docker-compose logs -f

# Attendre les messages:
# ✅ Backend: "SAF IMPORT - SERVEUR SÉCURISÉ"
# ✅ Frontend: nginx prêt
# ✅ SQL Server: "Recovery is complete"
```

### Étape 5: Vérification Post-Déploiement

```bash
# 1. Tester la connexion backend
curl http://localhost:3001
# Réponse attendue: {"message":"API SAF Import","version":"2.0.0","status":"running"}

# 2. Tester la connexion base de données
docker exec mctv-sqlserver /opt/mssql-tools/bin/sqlcmd \
  -S localhost -U sa -P Admin@123 \
  -Q "SELECT COUNT(*) FROM SAF_MCTV_COMORES.dbo.INFOSTRANSFERTPARTENAIRES"

# 3. Vérifier l'interface frontend
# Ouvrir http://<IP_SERVEUR>:3000 dans le navigateur
```

---

## Tests de Validation

### Test 1: Connexion Utilisateur

1. Ouvrir `http://<IP_SERVEUR>:3000`
2. Se connecter avec un compte test (ex: `SAF2000`)
3. Vérifier que le nom d'utilisateur s'affiche en haut à droite
4. Vérifier que le rôle ADMIN est affiché

### Test 2: Import de Transactions

1. Aller dans l'onglet **Import**
2. Sélectionner un fichier test (MoneyGram, RIA ou Western Union)
3. Choisir le mode: "Toutes les agences (détection auto)"
4. Cliquer sur **Importer**
5. Vérifier les résultats:
   - ✅ Nombre de transactions importées
   - ✅ Doublons détectés
   - ✅ Montant total
   - ✅ Répartition par agence

### Test 3: Validation des Imports (ADMIN uniquement)

1. Aller dans l'onglet **Validation**
2. Vérifier la liste des imports en attente
3. Valider ou rejeter un import
4. Vérifier que les transactions sont déplacées dans la base principale

### Test 4: Génération de Rapports (ADMIN uniquement)

1. Aller dans l'onglet **Rapports**
2. Vérifier la liste des rapports disponibles:
   - `rapport_MONEYGRAM_*.txt`
   - `rapport_RIA_*.txt`
   - `rapport_transferts_agents_agences.csv`
   - `rapport_transferts_importes_application.csv`
3. Télécharger un rapport
4. Vérifier le contenu CSV/TXT

### Test 5: Historique des Imports

1. Aller dans l'onglet **Historique**
2. Vérifier la liste des imports passés
3. Filtrer par date/partenaire
4. Exporter les statistiques

---

## Architecture Dual Database

### Fonctionnement

```
┌─────────────────────────────────┐
│   Application SAF Import        │
│   (Frontend + Backend)          │
└──────────────┬──────────────────┘
               │
               │ DB_NAME=SAF_MCTV_COMORES
               ▼
      ┌────────────────────────┐
      │  SAF_MCTV_COMORES      │  7.6 GB
      │  (Base Comptabilité)   │
      │                        │
      │  • UTILISATEURSSAF     │ ◄── Auth
      │  • CF.CF_AGENCIAS      │ ◄── Agences
      │  • INFOSTRANSFER...    │ ◄── Transactions
      └────────────────────────┘
               ▲
               │ Réplication automatique
               │ via procédure stockée
               │
      ┌────────────────────────┐
      │  MCTV_INTERCAISSE      │  578 MB
      │  (Base Opérationnelle) │
      │                        │
      │  • INFOSTRANSFER...    │ ◄── Staging
      │  • temp_INFOSTRANSFER  │
      └────────────────────────┘
```

**Note**: L'application se connecte à `SAF_MCTV_COMORES` qui contient:
- Tables de référence (utilisateurs, agences)
- Transactions synchronisées depuis `MCTV_INTERCAISSE`

---

## Système de Rapports

### Rapports Générés

#### 1. rapport_transferts_importes_application.csv
Format détaillé par agent/agence:
```csv
Code_Agence,Nom_Agence,Code_Agent,Nom_Agent_Unifie,Partenaire,
Type_Operation,Nombre_Transactions,Montant_Total_KMF,
Commission_Totale_KMF,Taxes_Totales_KMF,
Date_Premiere_Transaction,Date_Derniere_Transaction,
Date_Premier_Import,Date_Dernier_Import
```

#### 2. rapport_transferts_agents_agences.csv
Synthèse par agence

#### 3. rapport_<PARTENAIRE>_<DATE_DEBUT>_<DATE_FIN>.txt
Format contrôleur (MoneyGram, RIA, Western Union)

### Routes API

```javascript
// Liste des rapports disponibles
GET /api/reports
Authorization: Bearer <token>

// Télécharger un rapport
GET /api/reports/download/:filename
Authorization: Bearer <token>
```

---

## Dépendances Production

### Backend
```json
{
  "mssql": "10.0.4",
  "express": "4.21.2",
  "bcryptjs": "2.4.3",
  "jsonwebtoken": "9.0.2",
  "cors": "2.8.5",
  "multer": "1.4.5-lts.2"
}
```

### Frontend
```json
{
  "react": "^18.x",
  "lucide-react": "^0.x",
  "tailwindcss": "^3.x"
}
```

---

## Sécurité Production

### ⚠️ Actions Obligatoires Avant Mise en Production

1. **Changer JWT_SECRET**
   ```bash
   # Générer un secret fort
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

2. **Changer mot de passe SQL Server**
   ```env
   DB_PASSWORD=<NOUVEAU_MOT_DE_PASSE_COMPLEXE>
   ```

3. **Configurer CORS**
   ```env
   # Autoriser uniquement l'IP du frontend
   CORS_ORIGIN=http://<IP_FRONTEND>:3000
   ```

4. **Activer HTTPS** (recommandé)
   - Utiliser un reverse proxy (Nginx, Traefik)
   - Certificat SSL/TLS

5. **Limiter accès SQL Server**
   - Firewall: autoriser uniquement backend
   - Créer utilisateur dédié (pas `sa`)

---

## Monitoring et Logs

### Logs Docker

```bash
# Tous les services
docker-compose logs -f

# Backend uniquement
docker-compose logs -f backend

# SQL Server
docker-compose logs -f sqlserver

# Frontend
docker-compose logs -f frontend
```

### Fichiers de Logs

```bash
# Backend logs
docker exec mctv-backend cat /app/logs/*.log

# SQL Server error log
docker exec mctv-sqlserver cat /var/opt/mssql/log/errorlog
```

### Métriques à Surveiller

1. **Connexions SQL Server**: Max 10 simultanées (pool)
2. **Temps réponse API**: < 2 secondes
3. **Taille uploads**: Max 100 MB
4. **Espace disque**: Vérifier régulièrement `/var/opt/mssql`

---

## Troubleshooting

### Backend ne démarre pas

```bash
# Vérifier la connexion DB
docker exec mctv-backend node -e "
const sql = require('mssql');
sql.connect('mssql://sa:Admin@123@sqlserver/SAF_MCTV_COMORES')
  .then(() => console.log('✅ Connecté'))
  .catch(err => console.error('❌', err));
"
```

### Frontend erreur API

```bash
# Vérifier REACT_APP_API_URL
docker exec mctv-frontend cat /etc/nginx/conf.d/default.conf

# Tester l'API depuis le frontend
docker exec mctv-frontend wget -O- http://backend:3001
```

### SQL Server lent

```bash
# Vérifier les index
docker exec -it mctv-sqlserver /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P Admin@123 -Q "
EXEC sp_helpindex 'INFOSTRANSFERTPARTENAIRES'
"

# Reconstruire les index (si nécessaire)
docker exec -it mctv-sqlserver /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P Admin@123 -Q "
ALTER INDEX ALL ON INFOSTRANSFERTPARTENAIRES REBUILD
"
```

---

## Backup et Restauration

### Backup Automatique

```bash
# Script de backup quotidien
cat > /opt/scripts/backup-saf.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker exec mctv-sqlserver /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P Admin@123 -Q "
BACKUP DATABASE SAF_MCTV_COMORES
TO DISK = '/var/opt/mssql/backup/SAF_${DATE}.bak'
WITH COMPRESSION, STATS = 10
"
EOF

chmod +x /opt/scripts/backup-saf.sh

# Ajouter au crontab (tous les jours à 2h du matin)
echo "0 2 * * * /opt/scripts/backup-saf.sh" | crontab -
```

### Restauration

Voir `RESTORE_DUAL_DATABASES.md` pour procédure complète.

---

## Support et Contact

### Documentation Technique

- `CLAUDE.md` - Architecture et instructions développement
- `RAPPORT_ARCHITECTURE_DUAL_DATABASE.md` - Analyse dual database
- `RESTORE_DUAL_DATABASES.md` - Procédure restauration
- Ce fichier - Guide migration production

### Commandes Utiles

```bash
# Redémarrer tous les services
docker-compose restart

# Arrêter proprement
docker-compose down

# Reconstruire et redémarrer
docker-compose up -d --build --force-recreate

# Nettoyer les volumes (⚠️ PERTE DE DONNÉES)
docker-compose down -v

# Voir l'utilisation ressources
docker stats
```

---

## Checklist Finale Pré-Production

```
✅ Variables d'environnement configurées (.env.production)
✅ JWT_SECRET généré et sécurisé
✅ Mot de passe SQL Server changé
✅ CORS configuré pour IP production
✅ Backups bases de données disponibles
✅ Docker installé et fonctionnel
✅ Ports 3000, 3001, 1433 ouverts sur firewall
✅ Certificats SSL prêts (si HTTPS)
✅ Comptes utilisateurs créés dans UTILISATEURSSAF
✅ Tests de validation réussis
✅ Monitoring configuré
✅ Backup automatique configuré
✅ Documentation à jour
✅ Équipe formée sur l'interface
```

---

**Version du Guide**: 1.0
**Dernière Mise à Jour**: 11/10/2025
**Application Version**: 2.0.0
**Commit**: 68a05c7
