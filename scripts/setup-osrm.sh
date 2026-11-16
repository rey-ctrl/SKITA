#!/usr/bin/env bash
# setup-osrm.sh — Build OSRM routing graph dari indonesia-261109.osm.pbf
# Jalankan sekali di root project sebelum `docker compose --profile osrm up`
# Butuh Docker dan ~8 GB RAM. Waktu: 15-40 menit tergantung mesin.

set -e

PBF="indonesia-261109.osm.pbf"
PROFILE="/opt/car.lua"   # profil mobil/motor — gunakan /opt/bicycle.lua jika mau

if [ ! -f "$PBF" ]; then
  echo "ERROR: $PBF tidak ditemukan di direktori ini." >&2
  exit 1
fi

echo "[1/3] osrm-extract — parsing OSM data..."
docker run --rm -t \
  -v "$(pwd):/data" \
  osrm/osrm-backend:latest \
  osrm-extract -p $PROFILE /data/$PBF

echo "[2/3] osrm-partition — mempartisi graph..."
docker run --rm -t \
  -v "$(pwd):/data" \
  osrm/osrm-backend:latest \
  osrm-partition /data/indonesia-261109.osrm

echo "[3/3] osrm-customize — menghitung bobot..."
docker run --rm -t \
  -v "$(pwd):/data" \
  osrm/osrm-backend:latest \
  osrm-customize /data/indonesia-261109.osrm

echo ""
echo "SELESAI. Jalankan OSRM server:"
echo "  docker compose --profile osrm up osrm"
echo ""
echo "OSRM akan tersedia di http://localhost:5001"
