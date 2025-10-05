#!/bin/bash
# start.sh - Script de démarrage complet

echo "╔════════════════════════════════════════╗"
echo "║   MCTV - Système d'Import              ║"
echo "║   Démarrage de l'environnement        ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Vérifier Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker n'est pas installé"
    echo "Installez Docker Desktop: https://www.docker.com/products/docker-desktop"
    exit 1
fi

echo "✅ Docker détecté"
echo ""

# Demander si on doit restaurer le backup
read -p "Voulez-vous restaurer le backup SQL? (o/N): " RESTORE
echo ""

if [[ $RESTORE =~ ^[Oo]$ ]]; then
    echo "🚀 Démarrage de SQL Server pour la restauration..."
    docker-compose up -d sqlserver

    echo "⏳ Attente de l'initialisation de SQL Server (30s)..."
    sleep 30

    echo ""
    echo "📦 Restauration du backup..."
    ./restore-backup.sh

    if [ $? -ne 0 ]; then
        echo "❌ Erreur lors de la restauration"
        exit 1
    fi

    echo ""
    echo "⏳ Initialisation des tables de déduplication..."
    docker-compose run --rm backend node init-database.js
    echo ""
fi

# Build et démarrage des services
echo "🏗️  Build des images Docker..."
docker-compose build

if [ $? -ne 0 ]; then
    echo "❌ Erreur lors du build"
    exit 1
fi

echo ""
echo "🚀 Démarrage des services..."
docker-compose up -d

if [ $? -ne 0 ]; then
    echo "❌ Erreur lors du démarrage"
    exit 1
fi

echo ""
echo "⏳ Attente du démarrage des services..."
sleep 5

echo ""
echo "✅ Services démarrés!"
echo ""
echo "╔════════════════════════════════════════╗"
echo "║  ACCÈS AUX SERVICES                    ║"
echo "╠════════════════════════════════════════╣"
echo "║  Frontend: http://localhost:3000       ║"
echo "║  Backend:  http://localhost:3001       ║"
echo "║  SQL:      localhost:1433              ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "📊 Statut des conteneurs:"
docker-compose ps
echo ""
echo "📝 Commandes utiles:"
echo "  - Logs:    docker-compose logs -f"
echo "  - Stop:    docker-compose stop"
echo "  - Restart: docker-compose restart"
echo "  - Down:    docker-compose down"
echo ""
