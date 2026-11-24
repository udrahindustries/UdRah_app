#!/usr/bin/env bash
# Deployment Logs & Health Monitoring Script (Bash / Linux / Coolify)
# Streams Multi-Container Output And Runs Diagnostic Health Probes

echo "==================================================================="
echo "     AirRoute Platform — Multi-Tier Deployment Logs Stream         "
echo "==================================================================="

if command -v docker &> /dev/null && docker info &> /dev/null; then
    echo "✔ Docker Engine Detected. Streaming AirRoute Services Logs..."
    docker compose logs -f --tail=50
else
    echo "⚠ Docker Engine Not Active. Running Local Process Health Check..."
    node Deploy/Healthcheck.js
fi
