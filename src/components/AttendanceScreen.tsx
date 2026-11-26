import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { apiClient } from '../services/api';

type AttendanceStatus = 'hadir' | 'sakit' | 'izin' | 'alpa';

interface ClassRecord {
  murid_id: string;
  nama: string;
  nomor_absen?: number;
  tanggal: string;
  status: AttendanceStatus;
  catatan?: string;
  is_koreksi_guru: boolean;
}

interface MyRecord {
  id: string;
  class_id: string;
  class_name: string;
  tanggal: string;
  status: AttendanceStatus;
  waktu_isi: string;
  is_koreksi_guru: boolean;
}

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  hadir: 'Hadir',
  sakit: 'Sakit',
  izin: 'Izin',
  alpa: 'Alpa',
};

const STATUS_COLOR: Record<AttendanceStatus, string> = {
  hadir: '#047857',
  sakit: '#1d4ed8',
  izin: '#7c3aed',
  alpa: '#dc2626',
};

const STATUS_BG: Record<AttendanceStatus, string> = {
  hadir: '#d1fae5',
  sakit: '#dbeafe',
  izin: '#ede9fe',
  alpa: '#fee2e2',
};

export const AttendanceScreen: React.FC = () => {
  const { user, userSchool, activeClass, availableClasses, lastAccessedClassId, setLastAccessedClassId } = useApp();
  const role = user?.role || 'murid';
  const isMurid = role === 'murid' || role === 'pengguna';
  const isAdminOrTeacher = role === 'guru' || role === 'admin' || role === 'sekolah';

  // Kelas yang dipilih guru/admin
  const [selectedClassId, setSelectedClassId] = useState<string>(() => {
    return lastAccessedClassId || activeClass?.id || (availableClasses.length > 0 ? availableClasses[0].id : '');
  });

  // State Murid
  const [submittingSelf, setSubmittingSelf] = useState(false);
  const [selfSubmitted, setSelfSubmitted] = useState(false);
  const [myHistory, setMyHistory] = useState<MyRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [month] = useState(() => new Date().toISOString().slice(0, 7));

  // State Guru/Admin
  const [classRecords, setClassRecords] = useState<ClassRecord[]>([]);
  const [loadingClassRecords, setLoadingClassRecords] = useState(false);
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10));
  const [editingRecord, setEditingRecord] = useState<ClassRecord | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<AttendanceStatus>('hadir');
  const [catatanKoreksi, setCatatanKoreksi] = useState('');
  const [savingKoreksi, setSavingKoreksi] = useState(false);

  // Load history murid
  const loadMyHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await apiClient.getMyAttendanceHistory(month);
      setMyHistory(res.records);
      const todayStr = new Date().toISOString().slice(0, 10);
      const todayRecord = res.records.find((r) => r.tanggal === todayStr);
      if (todayRecord) setSelfSubmitted(true);
    } catch {
      setMyHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [month]);

  useEffect(() => {
    if (isMurid) {
      loadMyHistory();
    }
  }, [isMurid, loadMyHistory]);

  // Load class records untuk Guru/Admin
  const loadClassRecords = useCallback(async (targetClassId: string) => {
    if (!targetClassId) return;
    setLoadingClassRecords(true);
    try {
      const res = await apiClient.getClassAttendance(targetClassId, tanggal);
      setClassRecords(res.records as ClassRecord[]);
    } catch {
      // Fallback jika belum ada data hari ini: load anggota kelas
      try {
        const memRes = await apiClient.getClassMembers(targetClassId);
        const dummyRecords: ClassRecord[] = memRes.members
          .filter((m) => m.role === 'murid')
          .map((m) => ({
            murid_id: m.user_id,
            nama: m.nama,
            nomor_absen: m.nomor_absen,
            tanggal,
            status: 'hadir',
            is_koreksi_guru: false,
          }));
        setClassRecords(dummyRecords);
      } catch {
        setClassRecords([]);
      }
    } finally {
      setLoadingClassRecords(false);
    }
  }, [tanggal]);

  useEffect(() => {
    if (isAdminOrTeacher && selectedClassId) {
      loadClassRecords(selectedClassId);
    }
  }, [isAdminOrTeacher, selectedClassId, loadClassRecords]);

  // Presensi Mandiri Murid
  const handleSelfAttendance = async () => {
    setSubmittingSelf(true);
    try {
      await apiClient.submitAttendanceSelf();
      setSelfSubmitted(true);
      Alert.alert('Presensi Berhasil', 'Kehadiran Anda hari ini telah tercatat.');
      loadMyHistory();
    } catch (e: any) {
      Alert.alert('Presensi Gagal', e.message || 'Presensi mandiri hanya dapat dilakukan pukul 07.00 - 09.00 WIB');
    } finally {
      setSubmittingSelf(false);
    }
  };

  // Simpan Koreksi Guru/Admin
  const handleSaveKoreksi = async () => {
    if (!editingRecord || !selectedClassId) return;
    setSavingKoreksi(true);
    try {
      await apiClient.submitAttendanceGuru({
        class_id: selectedClassId,
        murid_id: editingRecord.murid_id,
        date: tanggal,
        status: selectedStatus,
        catatan: catatanKoreksi.trim() || undefined,
      });
      Alert.alert('Tersimpan', `Status ${editingRecord.nama} diperbarui.`);
      setEditingRecord(null);
      setCatatanKoreksi('');
      loadClassRecords(selectedClassId);
    } catch (e: any) {
      Alert.alert('Gagal', e.message || 'Gagal menyimpan status kehadiran.');
    } finally {
      setSavingKoreksi(false);
    }
  };

  return (
    <View style={s.container}>
      {/* Header Info */}
      <View style={s.headerBanner}>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Presensi & Kehadiran</Text>
          <Text style={s.headerSubtitle}>
            {userSchool ? userSchool.name : 'Sekolah Anda'} · {role.toUpperCase()}
          </Text>
        </View>
        <View style={s.dateBadge}>
          <Ionicons name="calendar" size={14} color="#047857" />
          <Text style={s.dateBadgeText}>{tanggal}</Text>
        </View>
      </View>

      {/* ─── Tampilan Murid ─────────────────────────────────────────── */}
      {isMurid && (
        <ScrollView contentContainerStyle={s.contentScroll} showsVerticalScrollIndicator={false}>
          {/* Card Presensi Mandiri */}
          <View style={s.card}>
            <View style={s.cardHeader}>
              <View style={[s.iconBox, { backgroundColor: '#ecfdf5' }]}>
                <Ionicons name="finger-print" size={24} color="#047857" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>Presensi Mandiri Hari Ini</Text>
                <Text style={s.cardDesc}>
                  Kelas: {activeClass?.name || 'Kelas Terdaftar'} · Mode Demo (Bisa Absen Kapan Saja)
                </Text>
              </View>
            </View>

            {selfSubmitted ? (
              <View style={s.successStatusBox}>
                <Ionicons name="checkmark-circle" size={22} color="#047857" />
                <View style={{ flex: 1 }}>
                  <Text style={s.successStatusTitle}>Presensi Terkonfirmasi</Text>
                  <Text style={s.successStatusDesc}>Kehadiran Anda sudah tercatat oleh sistem sekolah.</Text>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                onPress={handleSelfAttendance}
                disabled={submittingSelf}
                style={s.primaryBtn}
                activeOpacity={0.8}
              >
                {submittingSelf ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                    <Text style={s.primaryBtnText}>Konfirmasi Hadir Sekarang</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Riwayat Kehadiran Bulan Ini */}
          <Text style={s.sectionTitle}>Riwayat Kehadiran ({myHistory.length})</Text>
          {loadingHistory ? (
            <ActivityIndicator size="small" color="#047857" style={{ marginTop: 16 }} />
          ) : myHistory.length === 0 ? (
            <View style={s.emptyBox}>
              <Ionicons name="calendar-outline" size={32} color="#cbd5e1" />
              <Text style={s.emptyText}>Belum ada riwayat kehadiran tercatat di bulan ini.</Text>
            </View>
          ) : (
            myHistory.map((rec) => (
              <View key={rec.id || rec.tanggal} style={s.historyRow}>
                <View style={s.historyRowLeft}>
                  <View style={[s.historyStatusIcon, { backgroundColor: STATUS_BG[rec.status] }]}>
                    <Ionicons
                      name={
                        rec.status === 'hadir'
                          ? 'checkmark-circle'
                          : rec.status === 'sakit'
                          ? 'medkit'
                          : rec.status === 'izin'
                          ? 'document-text'
                          : 'close-circle'
                      }
                      size={15}
                      color={STATUS_COLOR[rec.status]}
                    />
                  </View>
                  <View>
                    <Text style={s.historyDate}>{rec.tanggal}</Text>
                    <Text style={s.historyClass}>{rec.class_name}</Text>
                  </View>
                </View>

                <View style={[s.pill, { backgroundColor: STATUS_BG[rec.status] }]}>
                  <Text style={[s.pillText, { color: STATUS_COLOR[rec.status] }]}>
                    {STATUS_LABEL[rec.status]}
                  </Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* ─── Tampilan Guru & Admin ──────────────────────────────────── */}
      {isAdminOrTeacher && (
        <View style={{ flex: 1 }}>
          {/* Selector Kelas */}
          <View style={s.classSelectorBar}>
            <Text style={s.selectorLabel}>
              {role === 'admin' ? 'Pilih Kelas:' : 'Kelas yang Diajar:'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {availableClasses.map((cls) => {
                const isSelected = cls.id === selectedClassId;
                return (
                  <TouchableOpacity
                    key={cls.id}
                    onPress={() => {
                      setSelectedClassId(cls.id);
                      setLastAccessedClassId(cls.id);
                    }}
                    style={[s.classChip, isSelected && s.classChipActive]}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="book"
                      size={14}
                      color={isSelected ? '#ffffff' : '#047857'}
                    />
                    <Text style={[s.classChipText, isSelected && s.classChipTextActive]}>
                      {cls.nama}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Daftar Kehadiran Siswa */}
          <View style={s.recordsContainer}>
            <View style={s.recordsHeader}>
              <Text style={s.recordsTitle}>
                Daftar Absensi Siswa ({classRecords.length})
              </Text>
              <TouchableOpacity onPress={() => loadClassRecords(selectedClassId)} style={{ padding: 4 }}>
                <Ionicons name="refresh" size={16} color="#047857" />
              </TouchableOpacity>
            </View>

            {loadingClassRecords ? (
              <View style={s.centerBox}>
                <ActivityIndicator size="small" color="#047857" />
              </View>
            ) : classRecords.length === 0 ? (
              <View style={s.emptyBox}>
                <Ionicons name="people-outline" size={32} color="#cbd5e1" />
                <Text style={s.emptyText}>Tidak ada data siswa pada kelas terpilih.</Text>
              </View>
            ) : (
              <FlatList
                data={classRecords}
                keyExtractor={(item) => item.murid_id}
                contentContainerStyle={{ paddingBottom: 80, gap: 8 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={s.studentRow}
                    onPress={() => {
                      setEditingRecord(item);
                      setSelectedStatus(item.status);
                      setCatatanKoreksi(item.catatan || '');
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={s.studentNoBadge}>
                      <Text style={s.studentNoText}>{item.nomor_absen || '-'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.studentName}>{item.nama}</Text>
                      {item.catatan ? (
                        <Text style={s.studentNote} numberOfLines={1}>
                          Catatan: {item.catatan}
                        </Text>
                      ) : null}
                    </View>
                    <View style={[s.pill, { backgroundColor: STATUS_BG[item.status] }]}>
                      <Text style={[s.pillText, { color: STATUS_COLOR[item.status] }]}>
                        {STATUS_LABEL[item.status]}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      )}

      {/* Modal Edit / Koreksi Status (Guru & Admin) */}
      {editingRecord && (
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Koreksi Absensi: {editingRecord.nama}</Text>
              <TouchableOpacity onPress={() => setEditingRecord(null)}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={s.inputLabel}>Pilih Status Kehadiran:</Text>
            <View style={s.statusOptionsRow}>
              {(['hadir', 'sakit', 'izin', 'alpa'] as AttendanceStatus[]).map((st) => (
                <TouchableOpacity
                  key={st}
                  onPress={() => setSelectedStatus(st)}
                  style={[
                    s.statusOptionBtn,
                    { backgroundColor: STATUS_BG[st], borderColor: STATUS_COLOR[st] },
                    selectedStatus === st && { borderWidth: 2 },
                  ]}
                >
                  <Text style={[s.statusOptionText, { color: STATUS_COLOR[st] }]}>
                    {STATUS_LABEL[st]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[s.inputLabel, { marginTop: 10 }]}>Catatan Tambahan (Opsional):</Text>
            <TextInput
              style={s.noteInput}
              placeholder="cth: Surat dokter terlampir"
              placeholderTextColor="#94a3b8"
              value={catatanKoreksi}
              onChangeText={setCatatanKoreksi}
            />

            <TouchableOpacity
              onPress={handleSaveKoreksi}
              disabled={savingKoreksi}
              style={s.saveKoreksiBtn}
              activeOpacity={0.8}
            >
              {savingKoreksi ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={s.saveKoreksiBtnText}>Simpan Koreksi</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  headerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 10,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  headerSubtitle: { fontSize: 11, color: '#64748b', marginTop: 1 },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  dateBadgeText: { fontSize: 11, fontWeight: '700', color: '#047857' },

  contentScroll: { padding: 14, gap: 12 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  cardDesc: { fontSize: 11, color: '#64748b', marginTop: 2 },
  primaryBtn: {
    backgroundColor: '#047857',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 8,
  },
  primaryBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  successStatusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ecfdf5',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  successStatusTitle: { fontSize: 13, fontWeight: '700', color: '#047857' },
  successStatusDesc: { fontSize: 11, color: '#065f46', marginTop: 1 },

  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  historyRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  historyStatusIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyDate: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  historyClass: { fontSize: 11, color: '#64748b', marginTop: 1 },

  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  pillText: { fontSize: 11, fontWeight: '700' },

  // Guru / Admin Selector Bar
  classSelectorBar: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  selectorLabel: { fontSize: 11, fontWeight: '600', color: '#64748b', marginBottom: 4 },
  classChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  classChipActive: { backgroundColor: '#047857', borderColor: '#047857' },
  classChipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  classChipTextActive: { color: '#ffffff', fontWeight: '700' },

  recordsContainer: { flex: 1, padding: 14 },
  recordsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  recordsTitle: { fontSize: 12, fontWeight: '700', color: '#475569', textTransform: 'uppercase' },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  studentNoBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentNoText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  studentName: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
  studentNote: { fontSize: 10, color: '#64748b', marginTop: 1 },

  emptyBox: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyText: { fontSize: 12, color: '#94a3b8', textAlign: 'center' },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Modal Koreksi
  modalOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 99,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    gap: 10,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  inputLabel: { fontSize: 12, fontWeight: '600', color: '#475569' },
  statusOptionsRow: { flexDirection: 'row', gap: 6, marginVertical: 4 },
  statusOptionBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, borderWidth: 1 },
  statusOptionText: { fontSize: 12, fontWeight: '700' },
  noteInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  saveKoreksiBtn: {
    backgroundColor: '#047857',
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    marginTop: 8,
  },
  saveKoreksiBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
});
