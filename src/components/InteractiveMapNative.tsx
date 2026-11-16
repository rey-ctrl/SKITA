import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useApp } from '../context/AppContext';
import { School } from '../types';
import { formatDistance } from '../utils/geo';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../services/api';

const WebViewAny = WebView as any;

interface RouteInfo {
  jarak_m: number;
  durasi_motor_menit: number;
  durasi_jalan_menit: number;
  jarak_haversine_m: number;
  sumber: 'osrm' | 'estimasi';
  coordinates?: Array<[number, number]>;
}

function buildLeafletHtml(params: {
  homeLat: number;
  homeLng: number;
  schoolLat: number;
  schoolLng: number;
  schoolName: string;
  routeCoords: Array<[number, number]>;
  zoneRadiusM: number;
  isSwasta: boolean;
}): string {
  const { homeLat, homeLng, schoolLat, schoolLng, schoolName, routeCoords, zoneRadiusM, isSwasta } = params;

  const midLat = (homeLat + schoolLat) / 2;
  const midLng = (homeLng + schoolLng) / 2;

  const routeCoordsJson = JSON.stringify(routeCoords);
  const polylineScript =
    routeCoords.length > 1
      ? `L.polyline(${routeCoordsJson}, {color:'#059669',weight:4,opacity:0.85}).addTo(map);`
      : `L.polyline([[${homeLat},${homeLng}],[${schoolLat},${schoolLng}]], {color:'#059669',weight:3,opacity:0.7,dashArray:'8,6'}).addTo(map);`;

  // Sekolah swasta TIDAK memiliki lingkaran radius zonasi
  const zoneCircleScript =
    !isSwasta && zoneRadiusM > 0
      ? `L.circle([${schoolLat},${schoolLng}],{radius:${zoneRadiusM},color:'#2563eb',fillColor:'#bfdbfe',fillOpacity:0.15,weight:2,dashArray:'6,4'}).addTo(map);`
      : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body,#map{width:100%;height:100%;background:#f1f5f9}
</style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map', {zoomControl:true, attributionControl:false}).setView([${midLat},${midLng}], 14);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
  }).addTo(map);

  var bounds = L.latLngBounds([[${homeLat},${homeLng}],[${schoolLat},${schoolLng}]]);
  map.fitBounds(bounds, {padding:[40,40]});

  ${zoneCircleScript}
  ${polylineScript}

  // Marker rumah (biru)
  var homeIcon = L.divIcon({
    html: '<div style="background:#2563eb;width:34px;height:34px;border-radius:50%;border:3px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3)"><svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'16\\' height=\\'16\\' viewBox=\\'0 0 24 24\\' fill=\\'#fff\\'><path d=\\'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z\\'/></svg></div>',
    iconSize:[34,34], iconAnchor:[17,17], className:''
  });
  L.marker([${homeLat},${homeLng}], {icon:homeIcon})
    .addTo(map)
    .bindPopup('<b>Rumah (KK)</b>');

  // Marker sekolah (hijau)
  var schoolIcon = L.divIcon({
    html: '<div style="background:#047857;width:36px;height:36px;border-radius:50%;border:3px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3)"><svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'18\\' height=\\'18\\' viewBox=\\'0 0 24 24\\' fill=\\'#fff\\'><path d=\\'M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z\\'/></svg></div>',
    iconSize:[36,36], iconAnchor:[18,18], className:''
  });
  L.marker([${schoolLat},${schoolLng}], {icon:schoolIcon})
    .addTo(map)
    .bindPopup('<b>${schoolName.replace(/'/g, "\\'")}</b>')
    .openPopup();
</script>
</body>
</html>`;
}

export const InteractiveMapNative: React.FC = () => {
  const {
    activeLocation,
    schools,
    mapTargetSchool,
    selectedSchool,
    setActiveTab,
    zones,
    getSchoolEvaluation,
  } = useApp();

  const targetSchool: School | undefined = mapTargetSchool || selectedSchool || schools[0];

  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const webviewRef = useRef<InstanceType<typeof WebView>>(null);

  const isSwasta = targetSchool?.status === 'Swasta';
  const evaluation = targetSchool ? getSchoolEvaluation(targetSchool) : null;
  const zone = targetSchool ? zones[targetSchool.id] : undefined;

  useEffect(() => {
    if (!activeLocation || !targetSchool) return;
    let cancelled = false;

    setLoadingRoute(true);
    setRoute(null);

    apiClient
      .getRoute({
        originLat: activeLocation.lat,
        originLng: activeLocation.lng,
        destLat: targetSchool.lat,
        destLng: targetSchool.lng,
      })
      .then((data) => {
        if (!cancelled) setRoute(data as RouteInfo);
      })
      .finally(() => {
        if (!cancelled) setLoadingRoute(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeLocation?.lat, activeLocation?.lng, targetSchool?.id]);

  if (!activeLocation) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="location-outline" size={48} color="#94a3b8" />
        <Text style={styles.emptyText}>Lokasi rumah belum diatur.</Text>
        <TouchableOpacity style={styles.backBtnAction} onPress={() => setActiveTab('beranda')}>
          <Text style={styles.backBtnActionText}>Kembali ke Beranda</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!targetSchool || !evaluation) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="school-outline" size={48} color="#94a3b8" />
        <Text style={styles.emptyText}>Belum ada sekolah yang dipilih.</Text>
        <TouchableOpacity style={styles.backBtnAction} onPress={() => setActiveTab('beranda')}>
          <Text style={styles.backBtnActionText}>Kembali ke Beranda</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const zoneRadiusM = zone?.radius_m ?? 0;
  const mapHtml = buildLeafletHtml({
    homeLat: activeLocation.lat,
    homeLng: activeLocation.lng,
    schoolLat: targetSchool.lat,
    schoolLng: targetSchool.lng,
    schoolName: targetSchool.nama,
    routeCoords: route?.coordinates ?? [],
    zoneRadiusM,
    isSwasta,
  });

  return (
    <View style={styles.container}>
      {/* Top Bar dengan Tombol Kembali */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => setActiveTab('beranda')}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={18} color="#047857" />
          <Text style={styles.backBtnText}>Kembali</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          Rute ke {targetSchool.nama}
        </Text>
      </View>

      {/* Map WebView */}
      <View style={styles.mapWrapper}>
        <WebViewAny
          ref={webviewRef}
          source={{ html: mapHtml }}
          style={styles.map}
          originWhitelist={['*']}
          javaScriptEnabled
          startInLoadingState
          renderLoading={() => (
            <View style={styles.mapLoader}>
              <ActivityIndicator color="#047857" size="large" />
            </View>
          )}
        />

        {/* Badge sumber rute */}
        {route && (
          <View style={[styles.sourceBadge, route.sumber === 'osrm' ? styles.badgeOsrm : styles.badgeEst]}>
            <Text style={styles.sourceBadgeText}>
              {route.sumber === 'osrm' ? 'Rute OSM' : 'Estimasi'}
            </Text>
          </View>
        )}
      </View>

      {/* Metrik rute */}
      <View style={styles.metricsCard}>
        <View style={styles.schoolNameRow}>
          <Ionicons name="school" size={14} color="#047857" />
          <Text style={styles.schoolNameText} numberOfLines={1}>
            {targetSchool.nama}
          </Text>

          {/* Untuk sekolah Swasta, tampilkan badge Swasta / Bebas Zonasi (bukan Zona?) */}
          {isSwasta ? (
            <View style={styles.swastaBadge}>
              <Text style={styles.swastaBadgeText}>Swasta • Bebas Zonasi</Text>
            </View>
          ) : (
            <View
              style={[
                styles.zonePill,
                evaluation.status === 'MASUK_ZONA'
                  ? styles.zonePillMasuk
                  : evaluation.status === 'LUAR_ZONA'
                  ? styles.zonePillLuar
                  : styles.zonePillBelum,
              ]}
            >
              <Text style={styles.zonePillText}>
                {evaluation.status === 'MASUK_ZONA'
                  ? 'Masuk Zona'
                  : evaluation.status === 'LUAR_ZONA'
                  ? 'Luar Zona'
                  : 'Zona?'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.metrics}>
          {loadingRoute ? (
            <ActivityIndicator color="#047857" size="small" style={{ marginVertical: 4 }} />
          ) : (
            <>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Garis Lurus</Text>
                <Text style={styles.metricValue}>{formatDistance(evaluation.jarak_m)}</Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Jarak Darat</Text>
                <Text style={styles.metricValue}>
                  {route ? formatDistance(route.jarak_m) : `~${formatDistance(evaluation.jarak_rute_m)}`}
                </Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Motor</Text>
                <Text style={styles.metricValue}>
                  ~{route?.durasi_motor_menit ?? evaluation.durasi_motor_menit} mnt
                </Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Jalan</Text>
                <Text style={styles.metricValue}>
                  ~{route?.durasi_jalan_menit ?? evaluation.durasi_jalan_menit} mnt
                </Text>
              </View>
            </>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#ecfdf5',
    gap: 4,
  },
  backBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
  },
  topBarTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
  },
  mapWrapper: { flex: 1, position: 'relative' },
  map: { flex: 1 },
  mapLoader: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  sourceBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeOsrm: { backgroundColor: '#dcfce7' },
  badgeEst: { backgroundColor: '#f1f5f9' },
  sourceBadgeText: { fontSize: 10, fontWeight: '700', color: '#1e293b' },
  metricsCard: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  schoolNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  schoolNameText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  swastaBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: '#cbd5e1',
  },
  swastaBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#475569',
  },
  zonePill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  zonePillMasuk: { backgroundColor: '#dcfce7' },
  zonePillLuar: { backgroundColor: '#ffe4e6' },
  zonePillBelum: { backgroundColor: '#f1f5f9' },
  zonePillText: { fontSize: 9, fontWeight: '700', color: '#0f172a' },
  metrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  metricItem: { alignItems: 'center' },
  metricLabel: { fontSize: 9, color: '#64748b' },
  metricValue: { fontSize: 11, fontWeight: '700', color: '#0f172a', marginTop: 1 },
  metricDivider: { width: 1, height: 18, backgroundColor: '#e2e8f0' },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#f8fafc',
  },
  emptyText: { fontSize: 15, fontWeight: '700', color: '#475569' },
  backBtnAction: {
    backgroundColor: '#047857',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  backBtnActionText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});
