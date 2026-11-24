# Deployment Logs & Health Monitoring Script (PowerShell)
# Displays Realtime Multi-Tier Container Logs And Health Check Diagnostics

Write-Host "===================================================================" -ForegroundColor Cyan
Write-Host "     AirRoute Platform — Multi-Tier Deployment Logs Stream         " -ForegroundColor Cyan
Write-Host "===================================================================" -ForegroundColor Cyan

# 1. Check Docker Daemon Status
try {
    docker info > $null 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✔ Docker Engine Active. Streaming AirRoute Container Logs..." -ForegroundColor Green
        docker compose logs -f --tail=50
    } else {
        Write-Host "⚠ Docker Engine Not Running In Current Environment." -ForegroundColor Yellow
        Write-Host "Checking Local Bare-Metal Process Health..." -ForegroundColor Yellow
        node Deploy/Healthcheck.js
    }
} catch {
    Write-Host "Checking Local Bare-Metal Process Health..." -ForegroundColor Yellow
    node Deploy/Healthcheck.js
}
