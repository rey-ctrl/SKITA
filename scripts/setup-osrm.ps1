# setup-osrm.ps1 — Build OSRM routing graph dari indonesia-261109.osm.pbf
# Jalankan di PowerShell root project SKITA.
# Butuh Docker Desktop dan ~8 GB RAM.

$ErrorActionPreference = "Stop"
$PBF = "indonesia-261109.osm.pbf"
$CurrentDir = (Get-Location).Path

if (-not (Test-Path $PBF)) {
    Write-Error "ERROR: $PBF tidak ditemukan di folder ini ($CurrentDir)."
    exit 1
}

Write-Host "[1/3] osrm-extract — parsing OSM data..." -ForegroundColor Cyan
docker run --rm -t -v "${CurrentDir}:/data" osrm/osrm-backend:latest osrm-extract -p /opt/car.lua /data/$PBF

Write-Host "[2/3] osrm-partition — mempartisi graph..." -ForegroundColor Cyan
docker run --rm -t -v "${CurrentDir}:/data" osrm/osrm-backend:latest osrm-partition /data/indonesia-261109.osrm

Write-Host "[3/3] osrm-customize — menghitung bobot..." -ForegroundColor Cyan
docker run --rm -t -v "${CurrentDir}:/data" osrm/osrm-backend:latest osrm-customize /data/indonesia-261109.osrm

Write-Host ""
Write-Host "SELESAI. Jalankan OSRM server via:" -ForegroundColor Green
Write-Host "  docker compose --profile osrm up -d osrm"
Write-Host "OSRM akan aktif di http://localhost:5001" -ForegroundColor Yellow
