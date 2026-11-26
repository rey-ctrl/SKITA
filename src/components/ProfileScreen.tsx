import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../services/api';
import { AdminPanelScreen } from './AdminPanelScreen';

interface ProfileScreenProps {
  mode?: 'umum' | 'sekolah';
}

type AttendanceStatus = 'hadir' | 'sakit' | 'izin' | 'alpa';

const STATUS_CONFIG: Record<
  AttendanceStatus,
  { label: string; color: string; bg: string; border: string; icon: any }
> = {
  hadir: { label: 'Hadir', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0', icon: 'checkmark-circle' },
  sakit: { label: 'Sakit', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', icon: 'medkit' },
  izin: { label: 'Izin', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', icon: 'document-text' },
  alpa: { label: 'Alpa', color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: 'close-circle' },
};

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ mode = 'umum' }) => {
  const {
    user,
    userSchool,
    activeClass,
    locations,
    setIsRegionModalOpen,
    setIsLocationModalOpen,
    logoutUser,
    refreshUser,
    setActiveTab,
  } = useApp();

  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  // Sinkronisasi data user dari server setiap masuk ke tab Profil
  useEffect(() => {
    refreshUser();
    // Murid dibatasi dari akses riwayat presensi & absensi pada profil (FR-A10 Privasi & UU PDP)
    if (mode === 'sekolah' && user && user.role !== 'murid') {
      setLoadingAttendance(true);
      apiClient
        .getMyAttendanceHistory()
        .then((res) => {
          if (res.records) setAttendanceRecords(res.records);
        })
        .catch(() => setAttendanceRecords([]))
        .finally(() => setLoadingAttendance(false));
    }
  }, [mode, user?.id, user?.role]);

  const hadirCount = attendanceRecords.filter((r) => r.status === 'hadir').length;
  const sakitCount = attendanceRecords.filter((r) => r.status === 'sakit').length;
  const izinCount = attendanceRecords.filter((r) => r.status === 'izin').length;
  const alpaCount = attendanceRecords.filter((r) => r.status === 'alpa').length;

  if (isAdminPanelOpen) {
    return <AdminPanelScreen onClose={() => setIsAdminPanelOpen(false)} />;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TAMPILAN 1: PROFIL DI BOTTOM BAR SEKOLAH (Akademik & Warga Sekolah)
  // ─────────────────────────────────────────────────────────────────────────────
  if (mode === 'sekolah') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Banner Sekolah Aktif */}
        <View style={styles.schoolHeaderBanner}>
          <View style={styles.schoolHeaderIcon}>
            <Ionicons name="school" size={24} color="#047857" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.schoolHeaderTitle}>Profil</Text>
            <Text style={styles.schoolHeaderSubtitle}>
              {userSchool?.name || 'Sistem Terpadu SKITA'}
            </Text>
          </View>
          <View style={styles.activePill}>
            <View style={styles.greenDot} />
            <Text style={styles.activePillText}>Terverifikasi</Text>
          </View>
        </View>

        {/* Card Identitas Pengguna di Lingkungan Sekolah */}
        <View style={styles.userCard}>
          <View style={[styles.avatar, { backgroundColor: '#065f46' }]}>
            <Ionicons name="person" size={24} color="#ffffff" />
          </View>
          <View style={{ flex: 1 }}>
            {user ? (
              <>
                <Text style={styles.userName}>{user.nama}</Text>
                <Text style={styles.userEmail}>{user.email}</Text>
                <View style={[styles.rolePill, { backgroundColor: '#ecfdf5' }]}>
                  <Text style={[styles.roleText, { color: '#047857' }]}>
                    {user.role === 'admin'
                      ? 'Administrator Pengawas'
                      : user.role === 'sekolah'
                      ? 'Pengelola Lembaga Sekolah'
                      : user.role === 'guru'
                      ? 'Tenaga Pendidik / Guru'
                      : user.role === 'murid'
                      ? 'Peserta Didik / Murid'
                      : 'Pengguna'}
                  </Text>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.userName}>Sesi Anonim</Text>
                <Text style={styles.userEmail}>Belum terdaftar di sekolah</Text>
              </>
            )}
          </View>
        </View>

        {/* Data Akademik & Penempatan */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Status Akademik Sekolah</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="business-outline" size={16} color="#047857" />
            <Text style={styles.infoRowLabel}>Sekolah Terdaftar:</Text>
            <Text style={styles.infoRowValue} numberOfLines={1}>
              {userSchool?.name || 'Belum terikat'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="book-outline" size={16} color="#047857" />
            <Text style={styles.infoRowLabel}>Kelas Aktif:</Text>
            <Text style={styles.infoRowValue} numberOfLines={1}>
              {activeClass ? activeClass.name : user?.role === 'admin' || user?.role === 'guru' ? 'Seluruh Kelas Terdaftar' : 'Belum memilih kelas'}
            </Text>
          </View>

        </View>

        {/* Riwayat Absensi & Ringkasan Presensi (Hanya guru/admin yang berwenang, murid tidak bisa akses) */}
        {user?.role !== 'murid' && (
          <View style={styles.attendanceSectionCard}>
            <View style={styles.attendanceSectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={styles.attendanceIconBadge}>
                  <Ionicons name="finger-print" size={20} color="#047857" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.attendanceSectionTitle}>Riwayat Presensi & Absensi</Text>
                  <Text style={styles.attendanceSectionSubtitle}>Rekapitulasi kehadiran bulan ini</Text>
                </View>
              </View>
              {activeClass && (
                <TouchableOpacity
                  onPress={() => setActiveTab('absensi')}
                  style={styles.openAttendanceBtn}
                  activeOpacity={0.7}
                >
                  <Text style={styles.openAttendanceText}>Tab Absensi</Text>
                  <Ionicons name="chevron-forward" size={12} color="#047857" />
                </TouchableOpacity>
              )}
            </View>

            {/* 4-Stat Grid: Hadir, Sakit, Izin, Alpa */}
            <View style={styles.statsGrid}>
              <View style={[styles.statBox, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
                <View style={styles.statBoxHeader}>
                  <Ionicons name="checkmark-circle" size={13} color="#047857" />
                  <Text style={[styles.statBoxLabel, { color: '#065f46' }]}>Hadir</Text>
                </View>
                <Text style={[styles.statBoxValue, { color: '#047857' }]}>{hadirCount}</Text>
              </View>

              <View style={[styles.statBox, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
                <View style={styles.statBoxHeader}>
                  <Ionicons name="medkit" size={13} color="#1d4ed8" />
                  <Text style={[styles.statBoxLabel, { color: '#1e40af' }]}>Sakit</Text>
                </View>
                <Text style={[styles.statBoxValue, { color: '#1d4ed8' }]}>{sakitCount}</Text>
              </View>

              <View style={[styles.statBox, { backgroundColor: '#f5f3ff', borderColor: '#ddd6fe' }]}>
                <View style={styles.statBoxHeader}>
                  <Ionicons name="document-text" size={13} color="#7c3aed" />
                  <Text style={[styles.statBoxLabel, { color: '#5b21b6' }]}>Izin</Text>
                </View>
                <Text style={[styles.statBoxValue, { color: '#7c3aed' }]}>{izinCount}</Text>
              </View>

              <View style={[styles.statBox, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
                <View style={styles.statBoxHeader}>
                  <Ionicons name="close-circle" size={13} color="#dc2626" />
                  <Text style={[styles.statBoxLabel, { color: '#991b1b' }]}>Alpa</Text>
                </View>
                <Text style={[styles.statBoxValue, { color: '#dc2626' }]}>{alpaCount}</Text>
              </View>
            </View>

            {/* List Riwayat Presensi Terakhir */}
            {loadingAttendance ? (
              <View style={{ paddingVertical: 18, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#047857" />
                <Text style={[styles.emptySubtext, { marginTop: 6 }]}>Memuat riwayat kehadiran...</Text>
              </View>
            ) : attendanceRecords.length === 0 ? (
              <View style={styles.emptyAttendanceBox}>
                <Ionicons name="calendar-outline" size={28} color="#94a3b8" />
                <Text style={styles.emptyAttendanceTitle}>Belum Ada Riwayat Absensi</Text>
                <Text style={styles.emptySubtext}>
                  Kehadiran yang diisi akan tercatat secara otomatis di sini dan dapat dipantau oleh sekolah.
                </Text>
                {activeClass && (
                  <TouchableOpacity
                    onPress={() => setActiveTab('absensi')}
                    style={styles.fillAttendanceShortcut}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="finger-print" size={14} color="#047857" />
                    <Text style={styles.fillAttendanceShortcutText}>Isi Kehadiran Sekarang</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={{ gap: 8, marginTop: 4 }}>
                {attendanceRecords.slice(0, 5).map((rec) => {
                  const cfg = STATUS_CONFIG[rec.status as AttendanceStatus] || STATUS_CONFIG.hadir;
                  return (
                    <View key={rec.id || rec.tanggal} style={styles.attendanceRecordRow}>
                      <View style={styles.attendanceRecordLeft}>
                        <View style={[styles.attendanceRecordIcon, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
                          <Ionicons name={cfg.icon} size={15} color={cfg.color} />
                        </View>
                        <View>
                          <Text style={styles.attendanceRecordDate}>{rec.tanggal}</Text>
                          <Text style={styles.attendanceRecordClass}>{rec.class_name || activeClass?.name || 'Kelas'}</Text>
                        </View>
                      </View>

                      <View style={{ alignItems: 'flex-end', gap: 2 }}>
                        <View style={[styles.statusPill, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
                          <Text style={[styles.statusPillText, { color: cfg.color }]}>{cfg.label}</Text>
                        </View>
                        {rec.is_koreksi_guru && (
                          <Text style={styles.verifiedText}>Diverifikasi Guru</Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Perlindungan Privasi Akademik (UU PDP) */}
        <View style={styles.pdpCard}>
          <View style={styles.infoHeader}>
            <Ionicons name="lock-closed" size={16} color="#047857" />
            <Text style={[styles.infoTitle, { color: '#047857' }]}>
              Privasi Data Akademik (UU PDP No. 27/2022)
            </Text>
          </View>
          <Text style={styles.infoText}>
            Data absensi kehadiran, riwayat presensi harian, dan mutasi kelas bersifat rahasia dan hanya dapat diakses oleh dewan guru dan pihak berwenang sekolah.
          </Text>
        </View>

        {/* Tombol Navigasi Cepat Kembali ke Beranda */}
        <TouchableOpacity
          onPress={() => setActiveTab('beranda')}
          style={styles.switchHomeBtn}
          activeOpacity={0.8}
        >
          <Ionicons name="home-outline" size={16} color="#047857" />
          <Text style={styles.switchHomeBtnText}>Beralih ke Profil Umum & Zonasi</Text>
        </TouchableOpacity>

        {/* Keluar Akun */}
        <TouchableOpacity onPress={logoutUser} style={styles.logoutBtn} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={16} color="#e11d48" />
          <Text style={styles.logoutText}>Keluar Akun</Text>
        </TouchableOpacity>

        <Text style={styles.versionFooter}>SKITA Modul Sekolah v1.0.0</Text>
      </ScrollView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TAMPILAN 2: PROFIL DI BERANDA (Domisili, Titik Acuan Rumah, Zonasi SPMB)
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* User Card */}
      <View style={styles.userCard}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={24} color="#ffffff" />
        </View>
        <View style={{ flex: 1 }}>
          {user ? (
            <>
              <Text style={styles.userName}>{user.nama}</Text>
              <Text style={styles.userEmail}>{user.email}</Text>
              <View style={[styles.rolePill, user.role === 'admin' && { backgroundColor: '#dc262618' }]}>
                <Text style={[styles.roleText, user.role === 'admin' && { color: '#dc2626' }]}>
                  {user.role === 'admin' ? 'Administrator SKITA' : user.role === 'sekolah' ? 'Akun Sekolah' : user.role === 'guru' ? 'Guru' : user.role === 'murid' ? 'Murid' : 'Pengguna'}
                </Text>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.userName}>Mode Tamu (Guest)</Text>
              <Text style={styles.userEmail}>Masuk untuk sinkronisasi akun</Text>
            </>
          )}
        </View>
      </View>

      {/* Admin Quick Action Card (HANYA UNTUK ROLE ADMIN) */}
      {user?.role === 'admin' && (
        <View style={styles.adminCard}>
          <View style={styles.adminHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="shield-checkmark" size={18} color="#dc2626" />
              <Text style={styles.adminTitle}>Admin Control Panel</Text>
            </View>
            <View style={styles.adminBadge}>
              <Text style={styles.adminBadgeText}>FR-A1</Text>
            </View>
          </View>
          <Text style={styles.adminDesc}>
            Kelola akun pengguna, tetapkan role sekolah/guru, dan pantau status sistem.
          </Text>
          <TouchableOpacity
            style={styles.adminBtn}
            onPress={() => setIsAdminPanelOpen(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="people" size={16} color="#ffffff" />
            <Text style={styles.adminBtnText}>Buka Manajemen Pengguna</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Region Card */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Wilayah Pemilihan Sekolah (FR-REG-4)</Text>
          <TouchableOpacity onPress={() => setIsRegionModalOpen(true)}>
            <Text style={styles.linkText}>Ubah</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.regionRow}>
          <Ionicons name="map-outline" size={16} color="#047857" />
          <Text style={styles.regionText}>
            <Text style={styles.bold}>{user?.kota_kab || 'Belum diatur'}</Text> ({user?.provinsi || '-'})
          </Text>
        </View>
      </View>

      {/* Address Card */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Titik Acuan Rumah ({locations.length})</Text>
          <TouchableOpacity onPress={() => setIsLocationModalOpen(true)}>
            <Text style={styles.linkText}>Kelola</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.addrList}>
          {locations.slice(0, 2).map((loc) => (
            <View key={loc.id} style={styles.addrItem}>
              <Text style={styles.addrLabel} numberOfLines={1}>
                {loc.label}
              </Text>
              <Text style={styles.addrKec}>Kec. {loc.kecamatan || '-'}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* SPMB Bogor Info */}
      <View style={styles.infoCard}>
        <View style={styles.infoHeader}>
          <Ionicons name="information-circle" size={16} color="#1d4ed8" />
          <Text style={styles.infoTitle}>Aturan Jalur Domisili & Zonasi Bogor</Text>
        </View>
        <Text style={styles.infoText}>
          • <Text style={styles.bold}>Sistem Kluster:</Text> Kota Bogor menerapkan zonasi kluster 0-150 m (Prioritas 1), 150-500 m (Prioritas 2), dan 500-1000 m (Prioritas 3).{'\n'}
          • <Text style={styles.bold}>Estimasi Peluang:</Text> Dihitung dari rasio jarak rumah terhadap batas cut-off pendaftar terjauh tahun ajaran sebelumnya.{'\n'}
          • <Text style={styles.bold}>Disclaimer:</Text> Perhitungan SKITA bersifat alat bantu estimasi. Keputusan resmi mutlak milik Dinas Pendidikan daerah.
        </Text>
      </View>

      {/* Auth */}
      {user ? (
        <TouchableOpacity onPress={logoutUser} style={styles.logoutBtn} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={16} color="#e11d48" />
          <Text style={styles.logoutText}>Keluar Akun</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity onPress={logoutUser} style={styles.loginBtn} activeOpacity={0.7}>
          <Ionicons name="log-in-outline" size={16} color="#ffffff" />
          <Text style={styles.loginBtnText}>Masuk / Daftar Akun</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.versionFooter}>SKITA React Native (Expo) v1.0.0</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 12,
    paddingBottom: 30,
    gap: 10,
  },

  // Banner Profil Sekolah
  schoolHeaderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  schoolHeaderIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  schoolHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  schoolHeaderSubtitle: {
    fontSize: 11,
    color: '#047857',
    fontWeight: '600',
    marginTop: 1,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16a34a',
  },
  activePillText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#16a34a',
  },

  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#047857',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  userEmail: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  rolePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },

  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    textTransform: 'uppercase',
  },
  linkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#047857',
  },
  regionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  regionText: {
    fontSize: 13,
    color: '#334155',
  },
  bold: {
    fontWeight: '700',
  },
  addrList: {
    gap: 6,
  },
  addrItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  addrLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
    flex: 1,
  },
  addrKec: {
    fontSize: 11,
    color: '#64748b',
  },

  // Info Row untuk Profil Sekolah
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  infoRowLabel: {
    fontSize: 12,
    color: '#64748b',
    width: 110,
  },
  infoRowValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
    flex: 1,
  },

  infoCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    gap: 6,
  },
  pdpCard: {
    backgroundColor: '#ecfdf5',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    gap: 6,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  infoText: {
    fontSize: 11,
    color: '#334155',
    lineHeight: 16,
  },

  adminCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#fca5a5',
    gap: 8,
  },
  adminHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  adminTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991b1b',
  },
  adminBadge: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#f87171',
  },
  adminBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#dc2626',
  },
  adminDesc: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 15,
  },
  adminBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#dc2626',
    borderRadius: 8,
    paddingVertical: 9,
    marginTop: 2,
  },
  adminBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },

  switchHomeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#047857',
    borderRadius: 10,
    paddingVertical: 10,
  },
  switchHomeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
  },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 4,
  },
  logoutText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e11d48',
  },
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#047857',
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 4,
  },
  loginBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  // DesainPakeAI: Attendance Section Refinements in Profile
  attendanceSectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 14,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  attendanceSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  attendanceIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  attendanceSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  attendanceSectionSubtitle: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 1,
  },
  openAttendanceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  openAttendanceText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  statBox: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 3,
  },
  statBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statBoxLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  statBoxValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  attendanceRecordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  attendanceRecordLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  attendanceRecordIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attendanceRecordDate: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  attendanceRecordClass: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  verifiedText: {
    fontSize: 9,
    color: '#047857',
    fontWeight: '600',
  },
  emptyAttendanceBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  emptyAttendanceTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  emptySubtext: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 16,
  },
  fillAttendanceShortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 6,
  },
  fillAttendanceShortcutText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },

  versionFooter: {
    fontSize: 10,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 6,
  },
});
