# Guide Docker - SAF Import v1.0

## Déploiement Rapide

### 1. Configuration
```bash
git clone <URL> SAF_Import && cd SAF_Import
cp .env.docker.example .env
# Éditer .env avec vos paramètres SQL
```

### 2. Démarrage
```bash
docker-compose up -d
docker exec -it saf-import-backend node init-database.js
```

### 3. Accès
- Frontend: http://localhost
- Backend API: http://localhost:3001/api

## Commandes Utiles

```bash
# Status
docker-compose ps

# Logs
docker-compose logs -f

# Restart
docker-compose restart

# Stop
docker-compose down

# Mise à jour
git pull && docker-compose up -d --build
```

## Production avec SQL Externe

Dans `docker-compose.yml`, commentez le service `sqlserver` et configurez `.env`:
```env
DB_SERVER=votre-sql-prod.com
DB_NAME=SAF_MCTV_COMORES
DB_USER=sa
DB_PASSWORD=VotreMotDePasse
```

Puis: `docker-compose up -d backend frontend`

---
**Version**: 1.0.0
