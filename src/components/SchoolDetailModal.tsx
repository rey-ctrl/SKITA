import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useApp } from '../context/AppContext';
import { formatDistance } from '../utils/geo';
import { Jenjang } from '../types';
import { Ionicons } from '@expo/vector-icons';

const getJenjangTheme = (jenjang: Jenjang) => {
  switch (jenjang) {
    case 'SMA':
      return { bg: '#e0e7ff', text: '#3730a3', icon: 'school-outline' as const };
    case 'SMP':
      return { bg: '#dbeafe', text: '#1e40af', icon: 'book-outline' as const };
    case 'SMK':
      return { bg: '#fef3c7', text: '#92400e', icon: 'construct-outline' as const };
    case 'MTs':
    case 'MA':
      return { bg: '#dcfce7', text: '#166534', icon: 'ribbon-outline' as const };
    default:
      return { bg: '#f1f5f9', text: '#334155', icon: 'school-outline' as const };
  }
};

export const SchoolDetailModal: React.FC = () => {
  const {
    selectedSchool,
    setSelectedSchool,
    setMapTargetSchool,
    getSchoolEvaluation,
    zones,
    activeLocation,
    setActiveTab,
    deleteSchool,
    user,
  } = useApp();

  const [copiedToast, setCopiedToast] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!selectedSchool) return null;

  const isAdmin = user?.role === 'admin';
  const evaluation = getSchoolEvaluation(selectedSchool);
  const zone = zones[selectedSchool.id];
  const theme = getJenjangTheme(selectedSchool.jenjang);

  const isSwasta = selectedSchool.status === 'Swasta';

  const handleOpenMap = () => {
    setMapTargetSchool(selectedSchool);
    setSelectedSchool(null);
    setActiveTab('peta');
  };

  const handleCopySchoolId = async () => {
    await Clipboard.setStringAsync(selectedSchool.id);
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 2200);
  };

  const handleConfirmDeleteSchool = async () => {
    setDeleting(true);
    try {
      await deleteSchool(selectedSchool.id);
      setShowDeleteModal(false);
      setSelectedSchool(null);
    } catch (e: any) {
      Alert.alert('Gagal Menghapus', e.message || 'Terjadi kesalahan saat menghapus sekolah.');
    } finally {
      setDeleting(false);
    }
  };

  const handleReportWhatsApp = () => {
    const text = `Halo Admin SKITA, laporan data sekolah:\nNama: ${selectedSchool.nama}\nNPSN: ${selectedSchool.npsn || '-'}\nID: ${selectedSchool.id}\nCatatan: `;
    const url = `whatsapp://send?phone=6281234567890&text=${encodeURIComponent(text)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Info', 'Aplikasi WhatsApp tidak terdeteksi pada perangkat ini.');
    });
  };

  return (
    <Modal visible={!!selectedSchool} animationType="slide" transparent={true}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header Card */}
          <View style={styles.headerBox}>
            <View style={styles.headerTopLine}>
              <View style={styles.tagLine}>
                <View style={[styles.jenjangBadge, { backgroundColor: theme.bg }]}>
                  <Ionicons name={theme.icon} size={11} color={theme.text} style={{ marginRight: 3 }} />
                  <Text style={[styles.jenjangBadgeText, { color: theme.text }]}>{selectedSchool.jenjang}</Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    selectedSchool.status === 'Negeri' ? styles.statusNegeriBadge : styles.statusSwastaBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      selectedSchool.status === 'Negeri' ? styles.statusNegeriText : styles.statusSwastaText,
                    ]}
                  >
                    {selectedSchool.status}
                  </Text>
                </View>
                {selectedSchool.npsn ? (
                  <View style={styles.npsnBadge}>
                    <Text style={styles.npsnText}>NPSN: {selectedSchool.npsn}</Text>
                  </View>
                ) : null}

                {/* KODE SEKOLAH — HANYA ADMIN */}
                {isAdmin && (
                  <TouchableOpacity
                    onLongPress={handleCopySchoolId}
                    onPress={handleCopySchoolId}
                    style={styles.adminCodeBadge}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="key" size={10} color="#0369a1" />
                    <Text style={styles.adminCodeText} numberOfLines={1}>
                      {selectedSchool.id}
                    </Text>
                    <Ionicons name="copy-outline" size={10} color="#0284c7" />
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                onPress={() => setSelectedSchool(null)}
                style={styles.closeBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.schoolTitle}>{selectedSchool.nama}</Text>

            {/* Toast feedback salin kode */}
            {copiedToast && (
              <View style={styles.copyToast}>
                <Ionicons name="checkmark-circle" size={13} color="#047857" />
                <Text style={styles.copyToastText}>Kode sekolah disalin ke clipboard</Text>
              </View>
            )}
          </View>

          {/* Scrollable details */}
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Address */}
            <View style={styles.addressBox}>
              <Ionicons name="location" size={16} color="#047857" style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.addressTitle}>{selectedSchool.alamat}</Text>
                <Text style={styles.addressSub}>
                  Kec. {selectedSchool.kecamatan}, {selectedSchool.kota_kab}
                </Text>
              </View>
            </View>

            {/* Distance Comparison Card (FR-DIST-2, FR-DIST-5) */}
            <View style={styles.distCard}>
              <View style={styles.distHeader}>
                <Text style={styles.distCardTitle}>Perhitungan Jarak dari Rumah</Text>
                <Text style={styles.distHomeTag}>{activeLocation ? activeLocation.label : 'Rumah'}</Text>
              </View>

              <View style={styles.distGrid}>
                <View style={styles.distBox}>
                  <Text style={styles.distBoxLabel}>Garis Lurus (Haversine)</Text>
                  <Text style={styles.distBoxVal}>{formatDistance(evaluation.jarak_m)}</Text>
                  <Text style={styles.distBoxSub}>Dasar zonasi resmi</Text>
                </View>
                <View style={styles.distBox}>
                  <Text style={styles.distBoxLabel}>Estimasi Rute Jalan</Text>
                  <Text style={styles.distBoxVal}>{formatDistance(evaluation.jarak_rute_m)}</Text>
                  <Text style={styles.distBoxSub}>Jalan berliku aktual</Text>
                </View>
              </View>

              <View style={styles.travelTimesRow}>
                <Text style={styles.travelTimeText}>
                  Motor/Mobil: <Text style={styles.bold}>~{evaluation.durasi_motor_menit} mnt</Text>
                </Text>
                <Text style={styles.travelTimeText}>
                  Jalan Kaki: <Text style={styles.bold}>~{evaluation.durasi_jalan_menit} mnt</Text>
                </Text>
              </View>
            </View>

            {/* Zonasi & Peluang Card / Swasta Info */}
            {isSwasta ? (
              <View style={styles.swastaCard}>
                <View style={styles.swastaHeader}>
                  <Ionicons name="information-circle" size={20} color="#2563eb" />
                  <Text style={styles.swastaCardTitle}>Penerimaan Siswa Baru (Swasta)</Text>
                </View>

                <Text style={styles.swastaReason}>
                  Sekolah swasta tidak memberlakukan seleksi zonasi domisili PPDB. Pendaftaran dan penerimaan siswa dilakukan langsung melalui jalur mandiri / yayasan sekolah tanpa batasan radius jarak.
                </Text>

                <View style={styles.swastaBadgeRow}>
                  <View style={styles.swastaInfoPill}>
                    <Ionicons name="checkmark-circle" size={13} color="#047857" />
                    <Text style={styles.swastaInfoPillText}>Bebas Zonasi Domisili</Text>
                  </View>
                  <View style={styles.swastaInfoPill}>
                    <Ionicons name="document-text-outline" size={13} color="#2563eb" />
                    <Text style={styles.swastaInfoPillText}>Jalur Mandiri Sekolah</Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.zonasiCard}>
                <View style={styles.zonasiCardHeader}>
                  <Text style={styles.zonasiCardTitle}>Analisis Validasi Zonasi</Text>
                  <View
                    style={[
                      styles.statusPill,
                      evaluation.status === 'MASUK_ZONA'
                        ? styles.pillMasuk
                        : evaluation.status === 'LUAR_ZONA'
                        ? styles.pillLuar
                        : styles.pillBelum,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        evaluation.status === 'MASUK_ZONA'
                          ? styles.pillMasukText
                          : evaluation.status === 'LUAR_ZONA'
                          ? styles.pillLuarText
                          : styles.pillBelumText,
                      ]}
                    >
                      {evaluation.status === 'MASUK_ZONA'
                        ? 'Masuk Zona'
                        : evaluation.status === 'LUAR_ZONA'
                        ? 'Luar Zona'
                        : 'Zona Belum Ada'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.zonasiReason}>{evaluation.alasan}</Text>

                <View style={styles.metaRow}>
                  <View style={styles.metaBox}>
                    <Text style={styles.metaLabel}>Kluster Domisili (Bogor)</Text>
                    <Text style={styles.metaVal}>{evaluation.kluster_nama || '-'}</Text>
                  </View>
                  <View style={styles.metaBox}>
                    <Text style={styles.metaLabel}>Estimasi Peluang Lolos</Text>
                    <Text style={styles.metaValGreen}>
                      {evaluation.peluang ? `${evaluation.peluang.label} (${evaluation.peluang.range})` : 'Data Belum Ada'}
                    </Text>
                  </View>
                </View>

                {zone && (
                  <View style={styles.rulesBox}>
                    <Text style={styles.ruleLine}>
                      • Tipe Zonasi: <Text style={styles.bold}>{zone.tipe}</Text>
                    </Text>
                    <Text style={styles.ruleLine}>
                      • Radius Kuota: <Text style={styles.bold}>{(zone.radius_m / 1000).toFixed(1)} km ({zone.radius_m} m)</Text>
                    </Text>
                    {zone.jarak_terjauh_diterima_m && (
                      <Text style={styles.ruleLine}>
                        • Cut-off Jarak Terjauh Tahun Lalu:{' '}
                        <Text style={styles.bold}>{(zone.jarak_terjauh_diterima_m / 1000).toFixed(2)} km</Text>
                      </Text>
                    )}
                    {zone.daya_tampung_zonasi && (
                      <Text style={styles.ruleLine}>
                        • Kuota Domisili: <Text style={styles.bold}>{zone.daya_tampung_zonasi} siswa</Text> ({zone.jumlah_pendaftar || 0} pendaftar)
                      </Text>
                    )}
                    <Text style={styles.sourceText}>Sumber: {zone.sumber} ({zone.tahun_ajaran})</Text>
                  </View>
                )}

                {/* Disclaimer */}
                <View style={styles.disclaimerBox}>
                  <Ionicons name="warning" size={14} color="#b45309" />
                  <Text style={styles.disclaimerText}>
                    <Text style={styles.bold}>Disclaimer Wajib:</Text> {evaluation.disclaimer} SKITA adalah alat bantu estimasi.
                  </Text>
                </View>
              </View>
            )}

            {/* Action buttons */}
            <TouchableOpacity onPress={handleOpenMap} style={styles.mapBtn} activeOpacity={0.7}>
              <Ionicons name="map-outline" size={18} color="#ffffff" />
              <Text style={styles.mapBtnText}>Buka Rute & Radius di Peta</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleReportWhatsApp} style={styles.reportBtn} activeOpacity={0.7}>
              <Ionicons name="logo-whatsapp" size={16} color="#047857" />
              <Text style={styles.reportBtnText}>Laporkan Koreksi Data ke WhatsApp</Text>
            </TouchableOpacity>

            {/* Hapus sekolah — HANYA ADMIN */}
            {isAdmin && (
              <TouchableOpacity onPress={() => setShowDeleteModal(true)} style={styles.deleteBtn} activeOpacity={0.7}>
                <Ionicons name="trash-outline" size={16} color="#dc2626" />
                <Text style={styles.deleteBtnText}>Hapus Sekolah dari Database</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* Modal Konfirmasi Hapus Sekolah — @desainpakeai */}
          <Modal
            visible={showDeleteModal}
            transparent
            animationType="fade"
            onRequestClose={() => {
              if (!deleting) setShowDeleteModal(false);
            }}
          >
            <View style={styles.confirmModalOverlay}>
              <View style={styles.confirmModalCard}>
                <View style={styles.confirmDangerAvatar}>
                  <Ionicons name="trash-outline" size={24} color="#dc2626" />
                </View>
                <Text style={styles.confirmModalTitle}>Hapus Sekolah</Text>
                <Text style={styles.confirmModalDesc}>
                  Sekolah ini akan dihapus permanen dari sistem SKITA dan tidak dapat dipulihkan.
                </Text>

                <View style={styles.confirmTargetBox}>
                  <Text style={styles.confirmTargetTitle} numberOfLines={1}>{selectedSchool.nama}</Text>
                  <Text style={styles.confirmTargetSub}>
                    ID: {selectedSchool.id} • {selectedSchool.jenjang} ({selectedSchool.status})
                  </Text>
                </View>

                <View style={styles.confirmBtnRow}>
                  <TouchableOpacity
                    onPress={() => setShowDeleteModal(false)}
                    disabled={deleting}
                    style={styles.confirmCancelBtn}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.confirmCancelBtnText}>Batal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleConfirmDeleteSchool}
                    disabled={deleting}
                    style={styles.confirmDeleteBtn}
                    activeOpacity={0.8}
                  >
                    {deleting ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.confirmDeleteBtnText}>Hapus Sekolah</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  headerBox: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  jenjangBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  jenjangBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusNegeriBadge: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  statusSwastaBadge: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusNegeriText: {
    color: '#047857',
  },
  statusSwastaText: {
    color: '#475569',
  },
  npsnBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  npsnText: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '600',
  },
  schoolTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 24,
  },
  scrollContent: {
    padding: 14,
    gap: 12,
    paddingBottom: 30,
  },
  addressBox: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  addressTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0f172a',
  },
  addressSub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  distCard: {
    backgroundColor: '#ecfdf5',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    gap: 8,
  },
  distHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  distCardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065f46',
  },
  distHomeTag: {
    fontSize: 9,
    color: '#047857',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    fontWeight: '600',
  },
  distGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  distBox: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  distBoxLabel: {
    fontSize: 9,
    color: '#64748b',
  },
  distBoxVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  distBoxSub: {
    fontSize: 8,
    color: '#94a3b8',
  },
  travelTimesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#d1fae5',
    paddingTop: 6,
  },
  travelTimeText: {
    fontSize: 10,
    color: '#065f46',
  },
  swastaCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  swastaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  swastaCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  swastaReason: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 16,
  },
  swastaBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  swastaInfoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  swastaInfoPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#334155',
  },
  zonasiCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  zonasiCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  zonasiCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  pillMasuk: {
    backgroundColor: '#dcfce7',
  },
  pillLuar: {
    backgroundColor: '#ffe4e6',
  },
  pillBelum: {
    backgroundColor: '#f1f5f9',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  pillMasukText: {
    color: '#065f46',
  },
  pillLuarText: {
    color: '#9f1239',
  },
  pillBelumText: {
    color: '#475569',
  },
  zonasiReason: {
    fontSize: 11,
    color: '#334155',
    lineHeight: 16,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metaBox: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  metaLabel: {
    fontSize: 9,
    color: '#64748b',
  },
  metaVal: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
  },
  metaValGreen: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
    marginTop: 2,
  },
  rulesBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 8,
    gap: 2,
  },
  ruleLine: {
    fontSize: 10,
    color: '#475569',
  },
  sourceText: {
    fontSize: 8,
    color: '#94a3b8',
    marginTop: 4,
  },
  disclaimerBox: {
    flexDirection: 'row',
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    padding: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  disclaimerText: {
    flex: 1,
    fontSize: 9,
    color: '#78350f',
    lineHeight: 13,
  },
  bold: {
    fontWeight: '700',
  },
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#047857',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  mapBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#047857',
    gap: 6,
  },
  reportBtnText: {
    color: '#047857',
    fontSize: 11,
    fontWeight: '700',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff1f2',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecdd3',
    gap: 6,
  },
  deleteBtnText: {
    color: '#dc2626',
    fontSize: 11,
    fontWeight: '700',
  },

  // Admin Code Badge
  adminCodeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  adminCodeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0369a1',
    maxWidth: 120,
  },
  copyToast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  copyToastText: {
    fontSize: 11,
    color: '#065f46',
    fontWeight: '600',
  },

  // Modal Konfirmasi Hapus (@desainpakeai)
  confirmModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmModalCard: {
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
  confirmDangerAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  confirmModalDesc: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
  confirmTargetBox: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 3,
  },
  confirmTargetTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  confirmTargetSub: {
    fontSize: 11,
    color: '#64748b',
  },
  confirmBtnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 4,
  },
  confirmCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  confirmCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  confirmDeleteBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
  },
  confirmDeleteBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});
