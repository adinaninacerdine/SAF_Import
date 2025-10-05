#!/bin/bash
# restore-backup.sh - Script de restauration du backup SQL Server

echo "=========================================="
echo "   RESTAURATION BACKUP SQL SERVER"
echo "=========================================="
echo ""

# Variables
BACKUP_FILE="${1:-backup/SAF_MCTV_COMORES.bak}"
DB_NAME="SAF_MCTV_COMORES"
CONTAINER_NAME="mctv-sqlserver"
SA_PASSWORD="Admin@123"

# Vérifier que le conteneur existe
if ! docker ps -a | grep -q $CONTAINER_NAME; then
    echo "L Conteneur $CONTAINER_NAME introuvable"
    echo "Démarrez d'abord le conteneur avec: docker-compose up -d sqlserver"
    exit 1
fi

# Vérifier que le conteneur est démarré
if ! docker ps | grep -q $CONTAINER_NAME; then
    echo "ó Démarrage du conteneur SQL Server..."
    docker-compose up -d sqlserver
    echo "ø  Attente 30s pour l'initialisation..."
    sleep 30
fi

# Vérifier que le fichier de backup existe
if [ ! -f "$BACKUP_FILE" ]; then
    echo "L Fichier de backup introuvable: $BACKUP_FILE"
    echo ""
    echo "Placez votre fichier .bak dans le dossier backup/"
    exit 1
fi

echo " Fichier de backup trouvé: $BACKUP_FILE"
echo "=Ê Taille: $(du -h "$BACKUP_FILE" | cut -f1)"
echo ""

# Copier le backup dans le conteneur
echo "=æ Copie du backup dans le conteneur..."
docker cp "$BACKUP_FILE" $CONTAINER_NAME:/var/opt/mssql/backup/SAF_MCTV_COMORES.bak

# Attendre que SQL Server soit prêt
echo "ó Vérification que SQL Server est prêt..."
for i in {1..30}; do
    if docker exec $CONTAINER_NAME /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P $SA_PASSWORD -Q "SELECT 1" &>/dev/null; then
        echo " SQL Server est prêt"
        break
    fi
    echo "  Tentative $i/30..."
    sleep 2
done

# Restaurer la base de données
echo ""
echo "= Restauration de la base de données..."
echo ""

docker exec $CONTAINER_NAME /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P $SA_PASSWORD -Q "
RESTORE DATABASE [$DB_NAME]
FROM DISK = '/var/opt/mssql/backup/SAF_MCTV_COMORES.bak'
WITH MOVE 'SAF_MCTV_COMORES' TO '/var/opt/mssql/data/SAF_MCTV_COMORES.mdf',
     MOVE 'SAF_MCTV_COMORES_log' TO '/var/opt/mssql/data/SAF_MCTV_COMORES_log.ldf',
     REPLACE
"

if [ $? -eq 0 ]; then
    echo ""
    echo " Base de données restaurée avec succès!"
    echo ""

    # Afficher les statistiques
    echo "=Ê STATISTIQUES DE LA BASE:"
    echo "-------------------------------------------"

    docker exec $CONTAINER_NAME /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P $SA_PASSWORD -d $DB_NAME -Q "
    SELECT
        'Utilisateurs' as Type,
        COUNT(*) as Nombre
    FROM UTILISATEURSSAF
    UNION ALL
    SELECT
        'Agences',
        COUNT(*)
    FROM CF.CF_AGENCIAS
    UNION ALL
    SELECT
        'Transactions',
        COUNT(*)
    FROM INFOSTRANSFERTPARTENAIRES
    " -h-1 -W

    echo ""
    echo " Restauration terminée!"
    echo ""
    echo "=Ý Prochaines étapes:"
    echo "1. docker-compose run --rm backend node init-database.js"
    echo "2. docker-compose up -d"
    echo ""
else
    echo ""
    echo "L Erreur lors de la restauration"
    echo ""
    echo "Vérifiez les logs avec:"
    echo "  docker logs $CONTAINER_NAME"
    exit 1
fi
