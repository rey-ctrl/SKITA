import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useApp } from '../context/AppContext';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

const WebViewAny = WebView as any;

// Default center: Bogor
const DEFAULT_LAT = -6.5950;
const DEFAULT_LNG = 106.7925;

function buildPickerHtml(initLat: number, initLng: number): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>*{margin:0;padding:0;box-sizing:border-box}html,body,#map{width:100%;height:100%}</style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map',{zoomControl:true,attributionControl:false}).setView([${initLat},${initLng}],16);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);

  var marker = L.marker([${initLat},${initLng}],{draggable:true}).addTo(map);
  marker.bindPopup('Geser pin ke posisi rumah Anda').openPopup();

  function sendCoord(lat,lng){
    var msg = JSON.stringify({lat:lat,lng:lng});
    if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(msg);
  }

  marker.on('dragend', function(e){
    var ll = e.target.getLatLng();
    sendCoord(ll.lat, ll.lng);
  });

  map.on('click', function(e){
    marker.setLatLng(e.latlng);
    sendCoord(e.latlng.lat, e.latlng.lng);
  });
</script>
</body>
</html>`;
}

export const SetLocationModal: React.FC = () => {
  const {
    isLocationModalOpen,
    setIsLocationModalOpen,
    locations,
    activeLocation,
    setActiveLocationId,
    addLocation,
    removeLocation,
  } = useApp();

  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [label, setLabel] = useState('');
  const [alamat, setAlamat] = useState('');
  const [kecamatan, setKecamatan] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [successData, setSuccessData] = useState<{
    alamat: string;
    kecamatan: string;
    lat: number;
    lng: number;
  } | null>(null);

  if (!isLocationModalOpen) return null;

  const handleAksesLokasiSaya = async () => {
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Izin Lokasi Ditolak',
          'Mohon izinkan akses lokasi perangkat agar titik acuan rumah dapat terdeteksi otomatis.'
        );
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      let alamatDitemukan = 'Lokasi GPS Saya';
      let kecamatanDitemukan = 'Bogor Tengah';
      let kelurahanDitemukan = 'Pusat';

      try {
        const [geo] = await Location.reverseGeocodeAsync({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });

        if (geo) {
          const streetInfo = [geo.street, geo.streetNumber].filter(Boolean).join(' No. ');
          alamatDitemukan = streetInfo || geo.name || `Koordinat (${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)})`;
          kecamatanDitemukan = geo.district || geo.subregion || 'Bogor Tengah';
          kelurahanDitemukan = geo.name || 'Pusat';
        }
      } catch {
        // Fallback jika offline
      }

      addLocation({
        label: 'Rumah (GPS)',
        alamat: alamatDitemukan,
        kecamatan: kecamatanDitemukan,
        kelurahan: kelurahanDitemukan,
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        is_default: true,
      });

      setSuccessData({
        alamat: alamatDitemukan,
        kecamatan: kecamatanDitemukan,
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
    } catch (err: any) {
      Alert.alert('Gagal Akses Lokasi', err?.message || 'Pastikan GPS pada ponsel Anda telah aktif.');
    } finally {
      setIsLocating(false);
    }
  };

  const updateCoordAndAddress = async (latitude: number, longitude: number) => {
    setLat(latitude.toFixed(6));
    setLng(longitude.toFixed(6));
    setIsReverseGeocoding(true);

    try {
      const [geo] = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (geo) {
        const parts = [geo.street, geo.streetNumber].filter(Boolean);
        const streetStr = parts.join(' No. ');
        const resolvedAlamat = streetStr || geo.name || `Titik (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
        setAlamat(resolvedAlamat);
        setKecamatan(geo.district || geo.subregion || 'Bogor Tengah');
      } else {
        setAlamat(`Titik (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
        setKecamatan('Bogor Tengah');
      }
    } catch {
      setAlamat(`Titik (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
      setKecamatan('Bogor Tengah');
    } finally {
      setIsReverseGeocoding(false);
    }
  };

  const handleSaveNew = () => {
    const finalLat = parseFloat(lat) || DEFAULT_LAT;
    const finalLng = parseFloat(lng) || DEFAULT_LNG;
    const finalAlamat = alamat.trim() || `Titik (${finalLat.toFixed(4)}, ${finalLng.toFixed(4)})`;
    const finalLabel = label.trim() || 'Rumah';

    addLocation({
      label: finalLabel,
      alamat: finalAlamat,
      kecamatan: kecamatan.trim() || 'Bogor Tengah',
      kelurahan: 'Pusat',
      lat: finalLat,
      lng: finalLng,
      is_default: false,
    });

    setIsAddingNew(false);
    setLabel('');
    setAlamat('');
    setLat('');
    setLng('');
  };

  return (
    <Modal visible={isLocationModalOpen} animationType="slide" transparent={true}>
      <View style={styles.overlay}>
        <View style={styles.contentCard}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Titik Acuan Rumah</Text>
              <Text style={styles.subTitle}>Acuan perhitungan jarak dan peluang zonasi</Text>
            </View>
            <TouchableOpacity onPress={() => setIsLocationModalOpen(false)}>
              <Ionicons name="close" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollBody} contentContainerStyle={{ gap: 10 }}>
            {!isAddingNew ? (
              <>
                <Text style={styles.sectionLabel}>Daftar Alamat Tersimpan:</Text>
                {locations.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Ionicons name="home-outline" size={36} color="#cbd5e1" />
                    <Text style={styles.emptyTitle}>Belum Ada Titik Acuan Rumah</Text>
                    <Text style={styles.emptySub}>
                      Tekan tombol di bawah untuk mendeteksi posisi GPS rumah Anda secara otomatis.
                    </Text>
                  </View>
                ) : (
                  locations.map((loc) => {
                    const isActive = activeLocation ? loc.id === activeLocation.id : false;
                    return (
                      <TouchableOpacity
                        key={loc.id}
                        onPress={() => {
                          setActiveLocationId(loc.id);
                          setIsLocationModalOpen(false);
                        }}
                        style={[styles.addrCard, isActive && styles.addrCardActive]}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.homeIcon, isActive && styles.homeIconActive]}>
                          <Ionicons name="home" size={16} color={isActive ? '#ffffff' : '#047857'} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.addrTitle}>{loc.label}</Text>
                          <Text style={styles.addrText} numberOfLines={1}>
                            {loc.alamat}
                          </Text>
                          <Text style={styles.addrMeta}>Kec. {loc.kecamatan || '-'}</Text>
                        </View>
                        {isActive && <Ionicons name="checkmark-circle" size={18} color="#047857" />}
                        <TouchableOpacity
                          onPress={() => removeLocation(loc.id)}
                          style={styles.delIconBtn}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="trash-outline" size={16} color="#94a3b8" />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    );
                  })
                )}

                {/* Tombol Akses Lokasi Saya */}
                <TouchableOpacity
                  onPress={handleAksesLokasiSaya}
                  disabled={isLocating}
                  style={styles.gpsBtn}
                  activeOpacity={0.7}
                >
                  {isLocating ? (
                    <ActivityIndicator size="small" color="#047857" style={{ marginRight: 6 }} />
                  ) : (
                    <Ionicons name="navigate" size={18} color="#047857" />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.gpsBtnText}>Akses Lokasi Saya (GPS Otomatis)</Text>
                    <Text style={styles.gpsBtnSub}>Deteksi posisi rumah langsung tanpa perlu mengisi</Text>
                  </View>
                </TouchableOpacity>

                {/* Tombol Tambah Alamat Baru */}
                <TouchableOpacity
                  onPress={() => setIsAddingNew(true)}
                  style={styles.addBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add-circle-outline" size={18} color="#475569" />
                  <Text style={styles.addBtnText}>Tambah Alamat Baru Manual</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.formContainer}>
                <Text style={styles.pinHint}>Geser pin atau tap peta untuk memilih titik rumah:</Text>
                <View style={styles.pickerMapWrapper}>
                  <WebViewAny
                    source={{
                      html: buildPickerHtml(
                        parseFloat(lat) || DEFAULT_LAT,
                        parseFloat(lng) || DEFAULT_LNG
                      ),
                    }}
                    style={styles.pickerMap}
                    originWhitelist={['*']}
                    javaScriptEnabled
                    onMessage={(event: any) => {
                      try {
                        const data = JSON.parse(event.nativeEvent.data);
                        if (data.lat && data.lng) {
                          updateCoordAndAddress(data.lat, data.lng);
                        }
                      } catch {}
                    }}
                  />
                </View>

                {/* Preview alamat hasil reverse geocode */}
                <View style={styles.addrPreview}>
                  {isReverseGeocoding ? (
                    <ActivityIndicator size="small" color="#047857" />
                  ) : (
                    <Ionicons name="location" size={14} color="#047857" />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.addrPreviewText} numberOfLines={2}>
                      {isReverseGeocoding
                        ? 'Mendeteksi alamat...'
                        : alamat || 'Belum ada titik dipilih'}
                    </Text>
                    {kecamatan ? (
                      <Text style={styles.addrPreviewMeta}>Kec. {kecamatan}</Text>
                    ) : null}
                  </View>
                </View>

                <Text style={styles.inputLabel}>Nama Label (cth: Rumah, Rumah Nenek)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Rumah"
                  placeholderTextColor="#94a3b8"
                  value={label}
                  onChangeText={setLabel}
                />

                <View style={styles.btnRow}>
                  <TouchableOpacity
                    onPress={() => {
                      setIsAddingNew(false);
                      setLabel('');
                      setAlamat('');
                      setLat('');
                      setLng('');
                    }}
                    style={styles.cancelBtn}
                  >
                    <Text style={styles.cancelText}>Batal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSaveNew} style={styles.saveBtn}>
                    <Text style={styles.saveText}>Simpan</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>

      {/* Modal Sukses Deteksi Lokasi — @desainpakeai */}
      <Modal
        visible={successData !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setSuccessData(null);
          setIsLocationModalOpen(false);
        }}
      >
        <View style={styles.successModalOverlay}>
          <View style={styles.successModalCard}>
            <View style={styles.successAvatar}>
              <Ionicons name="location" size={28} color="#047857" />
            </View>

            <Text style={styles.successModalTitle}>Lokasi Berhasil Dideteksi</Text>
            <Text style={styles.successModalDesc}>
              Titik acuan rumah telah diperbarui dan langsung dijadikan patokan zonasi serta perhitungan jarak sekolah.
            </Text>

            {successData && (
              <View style={styles.successTargetBox}>
                <View style={styles.successTargetRow}>
                  <Ionicons name="pin" size={15} color="#047857" style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.successAddressText}>{successData.alamat}</Text>
                    <Text style={styles.successMetaText}>
                      Kecamatan {successData.kecamatan} • ({successData.lat.toFixed(5)}, {successData.lng.toFixed(5)})
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <TouchableOpacity
              onPress={() => {
                setSuccessData(null);
                setIsLocationModalOpen(false);
              }}
              style={styles.successActionBtn}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-sharp" size={18} color="#ffffff" />
              <Text style={styles.successActionBtnText}>Gunakan Titik Ini</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    padding: 16,
  },
  contentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 10,
    marginBottom: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  subTitle: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  scrollBody: {
    maxHeight: 480,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  addrCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
    marginBottom: 6,
  },
  addrCardActive: {
    borderColor: '#047857',
    backgroundColor: '#f0fdf4',
  },
  homeIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeIconActive: {
    backgroundColor: '#047857',
  },
  addrTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  addrText: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  addrMeta: {
    fontSize: 9,
    color: '#94a3b8',
    marginTop: 1,
  },
  delIconBtn: {
    padding: 6,
    marginLeft: 4,
  },
  emptyCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 20,
    alignItems: 'center',
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginTop: 8,
  },
  emptySub: {
    fontSize: 10,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 14,
  },
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    backgroundColor: '#ecfdf5',
    gap: 10,
    marginTop: 6,
  },
  gpsBtnText: {
    color: '#047857',
    fontSize: 12,
    fontWeight: '700',
  },
  gpsBtnSub: {
    color: '#059669',
    fontSize: 9,
    marginTop: 1,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    gap: 6,
    marginTop: 6,
  },
  addBtnText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '600',
  },
  formContainer: {
    gap: 8,
  },
  pinHint: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  addrPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ecfdf5',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  addrPreviewText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065f46',
  },
  addrPreviewMeta: {
    fontSize: 10,
    color: '#047857',
    marginTop: 1,
  },
  pickerMapWrapper: {
    height: 220,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  pickerMap: {
    flex: 1,
  },
  presetsWrap: {
    gap: 4,
  },
  presetChip: {
    backgroundColor: '#f1f5f9',
    padding: 6,
    borderRadius: 6,
  },
  presetChipText: {
    fontSize: 10,
    color: '#334155',
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#334155',
  },
  input: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 10,
    height: 38,
    fontSize: 11,
    color: '#0f172a',
  },
  formRow: {
    flexDirection: 'row',
    gap: 8,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 11,
    color: '#64748b',
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#047857',
    alignItems: 'center',
  },
  saveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },

  // Modal Sukses Lokasi (@desainpakeai)
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  successModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
    gap: 12,
    elevation: 6,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  successAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ecfdf5',
    borderWidth: 1.5,
    borderColor: '#a7f3d0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  successModalDesc: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 6,
  },
  successTargetBox: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
  },
  successTargetRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  successAddressText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 18,
  },
  successMetaText: {
    fontSize: 11,
    color: '#047857',
    marginTop: 3,
    fontWeight: '500',
  },
  successActionBtn: {
    width: '100%',
    height: 46,
    borderRadius: 10,
    backgroundColor: '#047857',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  successActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});
