# Guide d'Installation - SAF Import v1.0

## 📋 Prérequis

### Serveur de Production
- **OS**: Windows Server 2016+ ou Linux (Ubuntu 20.04+)
- **Node.js**: v18.x ou supérieur
- **SQL Server**: 2016 ou supérieur
- **RAM**: 4GB minimum, 8GB recommandé
- **Disque**: 10GB minimum

### Logiciels Requis
```bash
# Node.js 18.x
node --version  # devrait afficher v18.x.x ou supérieur

# npm (inclus avec Node.js)
npm --version

# Git
git --version
```

## 🚀 Installation sur Serveur de Production

### 1. Cloner le Repository

```bash
# Se placer dans le répertoire souhaité
cd /var/www  # Linux
# ou
cd C:\inetpub\wwwroot  # Windows

# Cloner le projet
git clone <URL_DU_REPOSITORY> SAF_Import
cd SAF_Import
```

### 2. Configuration Backend

```bash
cd backend

# Installer les dépendances
npm install --production

# Copier le fichier d'environnement
cp .env.example .env

# Éditer le fichier .env avec vos paramètres
nano .env  # Linux
# ou
notepad .env  # Windows
```

**Paramètres `.env` à configurer:**

```env
# Database SQL Server
DB_SERVER=votre-serveur-sql.com
DB_NAME=SAF_MCTV_COMORES
DB_USER=votre_utilisateur_sql
DB_PASSWORD=votre_mot_de_passe_sql

# Server
PORT=3001

# JWT
JWT_SECRET=changez-moi-par-une-chaine-aleatoire-tres-securisee

# CORS
CORS_ORIGIN=http://votre-domaine.com

# Frontend URL (pour les liens)
REACT_APP_API_URL=http://votre-domaine.com:3001/api
```

**Générer un JWT_SECRET sécurisé:**
```bash
# Linux/Mac
openssl rand -base64 64

# Windows PowerShell
[Convert]::ToBase64String((1..64|%{Get-Random -Max 256}))
```

### 3. Initialiser la Base de Données

```bash
# Depuis le dossier backend/
node init-database.js
```

**Sortie attendue:**
```
✅ Tables vérifiées avec succès
📊 Statistiques: ...
```

### 4. Tester le Backend

```bash
# Test de connexion
node test.js

# Test end-to-end complet
node test-system-e2e.js
```

**Résultat attendu:**
```
✅ Tous les tests critiques sont passés - Système opérationnel !
```

### 5. Configuration Frontend

```bash
cd ../Frontend

# Installer les dépendances
npm install --production

# Créer le fichier .env
echo "REACT_APP_API_URL=http://votre-domaine.com:3001/api" > .env

# Build pour production
npm run build
```

Cela génère un dossier `build/` prêt à être déployé.

## 🔧 Déploiement

### Option 1: PM2 (Recommandé pour Node.js)

```bash
# Installer PM2 globalement
npm install -g pm2

# Démarrer le backend
cd backend
pm2 start server.js --name saf-import-backend

# Sauvegarder la configuration PM2
pm2 save

# Configurer le démarrage automatique
pm2 startup
```

**Commandes PM2 utiles:**
```bash
pm2 status              # Voir l'état des applications
pm2 logs saf-import-backend  # Voir les logs
pm2 restart saf-import-backend  # Redémarrer
pm2 stop saf-import-backend     # Arrêter
```

### Option 2: Service Windows

Créer un service Windows avec `node-windows`:

```bash
npm install -g node-windows
```

Créer `install-service.js`:
```javascript
var Service = require('node-windows').Service;

var svc = new Service({
  name:'SAF Import Backend',
  description: 'Serveur backend SAF Import',
  script: 'C:\SAF_Import\backend\server.js'
});

svc.on('install',function(){
  svc.start();
});

svc.install();
```

Exécuter:
```bash
node install-service.js
```

### Option 3: Serveur Web (Nginx/Apache) pour Frontend

**Nginx:**
```nginx
server {
    listen 80;
    server_name votre-domaine.com;
    
    root /var/www/SAF_Import/Frontend/build;
    index index.html;
    
    location / {
        try_files $uri /index.html;
    }
    
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Apache (.htaccess):**
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

## 🔐 Sécurité

### Firewall
```bash
# Linux (UFW)
sudo ufw allow 3001/tcp  # Backend
sudo ufw allow 80/tcp    # Frontend
sudo ufw allow 443/tcp   # HTTPS

# Windows Firewall
New-NetFirewallRule -DisplayName "SAF Import Backend" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow
```

### HTTPS (Recommandé pour Production)

**Avec Let's Encrypt + Certbot:**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d votre-domaine.com
```

### Permissions Fichiers

```bash
# Linux
chmod 600 backend/.env  # Lecture seule par propriétaire
chown www-data:www-data -R Frontend/build  # Nginx/Apache
chown node:node -R backend  # Si utilise utilisateur 'node'
```

## ✅ Vérification Post-Installation

### 1. Backend
```bash
curl http://localhost:3001/api/health
```
**Réponse attendue:** `{"status":"ok"}`

### 2. Frontend
Ouvrir dans le navigateur: `http://votre-domaine.com`

### 3. Test Complet
1. Se connecter avec un compte utilisateur
2. Importer un fichier test (MoneyGram/RIA/Western Union)
3. Valider l'import
4. Vérifier les données dans SQL Server

## 📊 Monitoring

### Logs Backend
```bash
# Avec PM2
pm2 logs saf-import-backend

# Ou fichiers logs
tail -f backend/logs/app.log
```

### Logs SQL Server
```sql
-- Vérifier les imports récents
SELECT TOP 100 *
FROM INFOSTRANSFERTPARTENAIRES
ORDER BY date_creation DESC;

-- Statistiques par partenaire
SELECT
    PARTENAIRETRANSF,
    COUNT(*) as nb_transactions,
    SUM(MONTANT) as total_montant
FROM INFOSTRANSFERTPARTENAIRES
WHERE date_creation >= DATEADD(day, -7, GETDATE())
GROUP BY PARTENAIRETRANSF;
```

## 🔄 Mise à Jour

```bash
cd /var/www/SAF_Import

# Sauvegarder la base
# (Faire backup SQL Server)

# Récupérer les mises à jour
git pull origin main

# Backend
cd backend
npm install --production
pm2 restart saf-import-backend

# Frontend
cd ../Frontend
npm install --production
npm run build
```

## 🐛 Troubleshooting

### Erreur de connexion SQL Server
```bash
# Tester la connexion
node backend/test.js
```
Vérifier:
- Serveur SQL accessible
- Firewall autorise port 1433
- Credentials corrects dans `.env`

### Port 3001 déjà utilisé
```bash
# Linux
sudo lsof -i :3001

# Windows
netstat -ano | findstr :3001
```
Changer `PORT` dans `.env`

### Frontend ne se connecte pas au Backend
Vérifier `REACT_APP_API_URL` dans `Frontend/.env` et rebuilder:
```bash
cd Frontend
npm run build
```

## 📞 Support

- **Documentation**: `/CLAUDE.md`
- **Issues**: Créer une issue sur le repository Git
- **Tests**: `node backend/test-system-e2e.js`

---

**Version**: 1.0.0  
**Date**: Octobre 2025  
**Testé sur**: Windows Server 2019, Ubuntu 20.04 LTS
