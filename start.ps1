# start.ps1 - Script de démarrage pour Windows
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   MCTV - Système d'Import" -ForegroundColor Cyan
Write-Host "   Démarrage de l'environnement" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier Docker
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Docker n'est pas installé" -ForegroundColor Red
    Write-Host "Installez Docker Desktop: https://www.docker.com/products/docker-desktop"
    exit 1
}

Write-Host "✅ Docker détecté" -ForegroundColor Green
Write-Host ""

# Demander si on doit restaurer le backup
$restore = Read-Host "Voulez-vous restaurer le backup SQL? (o/N)"
Write-Host ""

if ($restore -eq "o" -or $restore -eq "O") {
    Write-Host "🚀 Démarrage de SQL Server..." -ForegroundColor Yellow
    docker-compose up -d sqlserver

    Write-Host "⏳ Attente de l'initialisation de SQL Server (60s)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 60

    # Vérifier les logs
    Write-Host ""
    Write-Host "📋 Logs SQL Server:" -ForegroundColor Cyan
    docker logs mctv-sqlserver --tail 20

    Write-Host ""
    Write-Host "📦 Restauration du backup..." -ForegroundColor Yellow

    # Vérifier que le fichier existe
    $backupFile = "backup\SAF_MCTV_COMORES.bak"
    if (-not (Test-Path $backupFile)) {
        Write-Host "❌ Fichier de backup introuvable: $backupFile" -ForegroundColor Red
        Write-Host "Placez votre fichier .bak dans le dossier backup\" -ForegroundColor Yellow
        exit 1
    }

    Write-Host "✅ Fichier trouvé: $backupFile" -ForegroundColor Green
    $fileSize = [math]::Round((Get-Item $backupFile).Length / 1MB, 2)
    Write-Host "📊 Taille: $fileSize MB" -ForegroundColor Cyan

    # Créer le dossier backup dans le conteneur
    Write-Host ""
    Write-Host "📁 Création du dossier backup dans le conteneur..." -ForegroundColor Yellow
    docker exec mctv-sqlserver mkdir -p /var/opt/mssql/backup

    # Copier le backup
    Write-Host "📤 Copie du backup dans le conteneur..." -ForegroundColor Yellow
    docker cp $backupFile mctv-sqlserver:/var/opt/mssql/backup/SAF_MCTV_COMORES.bak

    # Vérifier la copie
    docker exec mctv-sqlserver ls -lh /var/opt/mssql/backup/

    # Attendre que SQL Server soit prêt
    Write-Host ""
    Write-Host "⏳ Vérification que SQL Server est prêt..." -ForegroundColor Yellow
    $maxAttempts = 30
    $attempt = 0
    $ready = $false

    while ($attempt -lt $maxAttempts -and -not $ready) {
        $attempt++
        Write-Host "  Tentative $attempt/$maxAttempts..." -ForegroundColor Gray

        $result = docker exec mctv-sqlserver /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P "Admin@123" -Q "SELECT 1" 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ SQL Server est prêt!" -ForegroundColor Green
            $ready = $true
        }
        else {
            Start-Sleep -Seconds 2
        }
    }

    if (-not $ready) {
        Write-Host "❌ SQL Server n'a pas démarré correctement" -ForegroundColor Red
        Write-Host "Vérifiez les logs: docker logs mctv-sqlserver" -ForegroundColor Yellow
        exit 1
    }

    # Restaurer la base de données
    Write-Host ""
    Write-Host "🔄 Restauration de la base de données..." -ForegroundColor Yellow
    Write-Host ""

    $restoreCommand = @"
RESTORE DATABASE [SAF_MCTV_COMORES]
FROM DISK = '/var/opt/mssql/backup/SAF_MCTV_COMORES.bak'
WITH MOVE 'SAF_MCTV_COMORES' TO '/var/opt/mssql/data/SAF_MCTV_COMORES.mdf',
     MOVE 'SAF_MCTV_COMORES_log' TO '/var/opt/mssql/data/SAF_MCTV_COMORES_log.ldf',
     REPLACE
"@

    docker exec mctv-sqlserver /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P "Admin@123" -Q $restoreCommand

    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Base de données restaurée avec succès!" -ForegroundColor Green
        Write-Host ""

        # Statistiques
        Write-Host "📊 STATISTIQUES DE LA BASE:" -ForegroundColor Cyan
        Write-Host "-------------------------------------------" -ForegroundColor Cyan

        $statsQuery = @"
SELECT 'Utilisateurs' as Type, COUNT(*) as Nombre FROM UTILISATEURSSAF
UNION ALL
SELECT 'Agences', COUNT(*) FROM CF.CF_AGENCIAS
UNION ALL
SELECT 'Transactions', COUNT(*) FROM INFOSTRANSFERTPARTENAIRES
"@

        docker exec mctv-sqlserver /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P "Admin@123" -d SAF_MCTV_COMORES -Q $statsQuery

        Write-Host ""
        Write-Host "⏳ Initialisation des tables de déduplication..." -ForegroundColor Yellow
        docker-compose run --rm backend node init-database.js
    }
    else {
        Write-Host ""
        Write-Host "❌ Erreur lors de la restauration" -ForegroundColor Red
        Write-Host "Vérifiez les logs: docker logs mctv-sqlserver" -ForegroundColor Yellow
        exit 1
    }
}

# Build des images
Write-Host ""
Write-Host "🏗️  Build des images Docker..." -ForegroundColor Yellow
docker-compose build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors du build" -ForegroundColor Red
    exit 1
}

# Démarrage des services
Write-Host ""
Write-Host "🚀 Démarrage de tous les services..." -ForegroundColor Yellow
docker-compose up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors du démarrage" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "⏳ Attente du démarrage des services (10s)..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

Write-Host ""
Write-Host "✅ Services démarrés!" -ForegroundColor Green
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ACCÈS AUX SERVICES" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor White
Write-Host "  Backend:  http://localhost:3001" -ForegroundColor White
Write-Host "  SQL:      localhost:1433" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📊 Statut des conteneurs:" -ForegroundColor Cyan
docker-compose ps
Write-Host ""
Write-Host "📝 Commandes utiles:" -ForegroundColor Cyan
Write-Host "  - Logs:    docker-compose logs -f" -ForegroundColor Gray
Write-Host "  - Stop:    docker-compose stop" -ForegroundColor Gray
Write-Host "  - Restart: docker-compose restart" -ForegroundColor Gray
Write-Host "  - Down:    docker-compose down" -ForegroundColor Gray
Write-Host ""
