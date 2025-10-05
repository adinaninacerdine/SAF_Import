# MCTV - Système d'Import de Transactions

Système d'import de transactions de transfert d'argent (MoneyGram, RIA, Western Union) pour MCTV Comores.

## 🚀 Démarrage Rapide

### Prérequis
- Docker Desktop installé
- Fichier de backup `SAF_MCTV_COMORES.bak` (placé dans le dossier `backup/`)

### Installation

```bash
# 1. Cloner/télécharger le projet
cd SAF_Import

# 2. Placer votre backup SQL
cp /chemin/vers/SAF_MCTV_COMORES.bak backup/

# 3. Rendre les scripts exécutables (Linux/Mac)
chmod +x start.sh restore-backup.sh

# 4. Lancer l'application
./start.sh
```

Le script vous demandera si vous voulez restaurer le backup. Répondez `o` (oui) la première fois.

### Accès à l'application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **SQL Server**: localhost:1433

### Connexion

Utilisez vos identifiants de la table `UTILISATEURSSAF`:
- **Code utilisateur**: Votre CODEUSER (ex: SAF2000)
- **Mot de passe**: Votre mot de passe

## 📁 Structure du Projet

```
SAF_Import/
├── backend/                    # API Node.js + Express
│   ├── server.js              # Serveur principal
│   ├── import-handler.js      # Parsing Excel/CSV
│   ├── multi-agency-handler.js # Gestion multi-agences
│   ├── agent-deduplication.js # Déduplication agents
│   ├── init-database.js       # Initialisation DB
│   └── Dockerfile             # Image Docker backend
│
├── Frontend/                   # Application React
│   ├── src/
│   │   ├── App.js            # Interface principale
│   │   ├── index.js          # Point d'entrée
│   │   ├── index.css         # Styles Tailwind
│   │   └── package.json      # Dépendances frontend
│   ├── Dockerfile             # Image Docker frontend
│   └── nginx.conf            # Configuration Nginx
│
├── backup/                     # Fichiers de backup SQL
├── docker-compose.yml          # Orchestration des services
├── restore-backup.sh          # Script de restauration
├── start.sh                   # Script de démarrage
└── README.md                  # Ce fichier
```

## 🎯 Fonctionnalités

### Import de Transactions
- **Multi-formats**: MoneyGram, RIA, Western Union
- **Auto-détection**: Format détecté automatiquement
- **Multi-agences**: Import avec détection automatique de l'agence
- **Déduplication**: Unification automatique des agents (AMOUSSA001 = AMOUSSA002)
- **Anti-doublons**: Détection des transactions déjà importées

### Sécurité
- Authentification JWT (8h de validité)
- Validation des fichiers (type, taille)
- Nettoyage automatique des fichiers temporaires
- Rôles utilisateurs (ADMIN/USER)

### Formats Supportés

**MoneyGram (CSV)**:
```csv
MTCN,Sender Name,Receiver Name,Principal Amount Paid Out,Commission,Date/Time Paid,Operator
```

**RIA (CSV)**:
```csv
PIN,Sender,Beneficiary,Payout Amount,Commission,Paid Date,User
```

**Western Union (Excel)**:
Colonnes: Date Creation, Date Paiement, MTCN, Agence, Expediteur, Beneficiaire, Code Agent, Montant

## 🔧 Commandes Docker

```bash
# Démarrer tous les services
docker-compose up -d

# Voir les logs
docker-compose logs -f

# Logs d'un service spécifique
docker-compose logs -f backend
docker-compose logs -f frontend

# Arrêter les services
docker-compose stop

# Redémarrer les services
docker-compose restart

# Arrêter et supprimer les conteneurs
docker-compose down

# Rebuild les images
docker-compose build

# Rebuild et redémarrer
docker-compose up -d --build
```

## 🛠️ Développement

### Backend

```bash
# Installer les dépendances
cd backend
npm install

# Lancer en mode développement (hors Docker)
npm run dev

# Initialiser la base de données
node init-database.js

# Analyser un fichier Excel
node analyse-excel.js fichier.xlsx
```

### Frontend

```bash
# Installer les dépendances
cd Frontend/src
npm install

# Lancer en mode développement (hors Docker)
npm start

# Build production
npm run build
```

## 📊 Base de Données

### Tables Principales

- **UTILISATEURSSAF**: Utilisateurs du système
- **CF.CF_AGENCIAS**: Agences MCTV
- **INFOSTRANSFERTPARTENAIRES**: Transactions importées
- **tm_agent_mapping**: Agents unifiés
- **tm_agent_codes**: Mapping codes agents

### Connexion SQL Server

```
Server: localhost,1433
Database: SAF_MCTV_COMORES
User: sa
Password: Admin@123
```

## 🐛 Dépannage

### Les conteneurs ne démarrent pas

```bash
# Vérifier les logs
docker-compose logs

# Vérifier Docker Desktop
docker ps -a
```

### Erreur de connexion à la base de données

```bash
# Vérifier que SQL Server est démarré
docker-compose ps sqlserver

# Redémarrer SQL Server
docker-compose restart sqlserver

# Attendre 30s pour l'initialisation
```

### Erreur lors de l'import de fichier

```bash
# Vérifier les logs du backend
docker-compose logs -f backend

# Vérifier que le dossier uploads existe
docker-compose exec backend ls -la uploads/
```

### Le frontend ne se connecte pas au backend

```bash
# Vérifier que le backend est accessible
curl http://localhost:3001/

# Vérifier les logs du backend
docker-compose logs backend
```

## 🔐 Sécurité en Production

Avant de déployer en production, modifiez:

1. **Mot de passe SQL Server** dans `docker-compose.yml` et `.env`
2. **JWT_SECRET** dans `.env`
3. **CORS_ORIGIN** pour autoriser seulement votre domaine
4. Activez HTTPS avec un reverse proxy (nginx, traefik)

```yaml
# Exemple docker-compose.yml production
environment:
  - SA_PASSWORD=VotreMotDePasseSecurise123!
  - JWT_SECRET=votre-secret-jwt-vraiment-long-et-securise
  - CORS_ORIGIN=https://votre-domaine.com
```

## 📝 Notes

- Le système unifie automatiquement les agents ayant des noms similaires
- Les transactions en double (même MTCN/PIN) sont automatiquement ignorées
- Mode multi-agences: le système détecte l'agence depuis les données du fichier
- Maximum 100MB par fichier d'import

## 🆘 Support

Pour toute question ou problème:
1. Consultez les logs: `docker-compose logs -f`
2. Vérifiez le fichier CLAUDE.md pour l'architecture
3. Consultez les tables de la base de données

## 📄 Licence

Usage interne MCTV Comores.
