/**
 * HistoryScreen — Riwayat Aktivitas & Log Kelas (Guru & Admin)
 * Menampilkan audit trail: absensi, pembubaran, pergantian anggota.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';

interface HistoryItem {
  id: string;
  tipe: 'absensi' | 'anggota' | 'kelas' | 'sistem';
  judul: string;
  deskripsi: string;
  waktu: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  iconBg: string;
}

const SAMPLE_HISTORY: HistoryItem[] = [
  {
    id: 'h1',
    tipe: 'absensi',
    judul: 'Presensi Harian Disinkronkan',
    deskripsi: 'Data presensi seluruh murid berhasil direkapitulasi secara otomatis.',
    waktu: 'Hari ini, 09:05 WIB',
    icon: 'calendar',
    iconColor: '#047857',
    iconBg: '#ecfdf5',
  },
  {
    id: 'h2',
    tipe: 'anggota',
    judul: 'Anggota Baru Bergabung',
    deskripsi: 'Murid baru terverifikasi masuk ke dalam daftar kelas.',
    waktu: 'Kemarin, 14:20 WIB',
    icon: 'person-add',
    iconColor: '#1d4ed8',
    iconBg: '#dbeafe',
  },
  {
    id: 'h3',
    tipe: 'kelas',
    judul: 'Kode Akses Kelas Diperbarui',
    deskripsi: 'Sistem memperbarui rotasi kode akses kelas untuk keamanan data.',
    waktu: '18 Nov 2026, 08:00 WIB',
    icon: 'key',
    iconColor: '#d97706',
    iconBg: '#fef3c7',
  },
  {
    id: 'h4',
    tipe: 'sistem',
    judul: 'Kalender Akademik Diperbarui',
    deskripsi: 'Jadwal hari libur dan kalender sekolah berhasil diselaraskan.',
    waktu: '15 Nov 2026, 10:15 WIB',
    icon: 'time',
    iconColor: '#7c3aed',
    iconBg: '#ede9fe',
  },
];

export const HistoryScreen: React.FC = () => {
  const { userSchool } = useApp();
  const [filterTipe, setFilterTipe] = useState<string>('semua');

  const filterOptions = [
    { id: 'semua', label: 'Semua' },
    { id: 'absensi', label: 'Presensi' },
    { id: 'anggota', label: 'Anggota' },
    { id: 'kelas', label: 'Kelas' },
  ];

  const filtered = SAMPLE_HISTORY.filter(
    (item) => filterTipe === 'semua' || item.tipe === filterTipe
  );

  return (
    <View style={s.container}>
      {/* Banner */}
      <View style={s.banner}>
        <View style={s.bannerLeft}>
          <Ionicons name="time" size={20} color="#c7d2fe" />
          <View>
            <Text style={s.bannerTitle}>Riwayat Aktivitas</Text>
            <Text style={s.bannerSub}>{userSchool?.name || 'Sekolah Anda'}</Text>
          </View>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={s.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 14, paddingVertical: 8 }}>
          {filterOptions.map((opt) => {
            const isActive = filterTipe === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                onPress={() => setFilterTipe(opt.id)}
                style={[s.filterChip, isActive && s.filterChipActive]}
                activeOpacity={0.7}
              >
                <Text style={[s.filterChipText, isActive && s.filterChipTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Timeline List */}
      <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
        {filtered.map((item) => (
          <View key={item.id} style={s.card}>
            <View style={[s.iconBox, { backgroundColor: item.iconBg }]}>
              <Ionicons name={item.icon} size={20} color={item.iconColor} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={s.cardTop}>
                <Text style={s.cardTitle}>{item.judul}</Text>
                <Text style={s.cardTime}>{item.waktu}</Text>
              </View>
              <Text style={s.cardDesc}>{item.deskripsi}</Text>
            </View>
          </View>
        ))}
        <Text style={s.footerNote}>
          * Log aktivitas diaudit otomatis sesuai ketentuan keamanan data UU PDP.
        </Text>
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#064e3b',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  bannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bannerTitle: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
  bannerSub: { fontSize: 11, color: '#a7f3d0', marginTop: 1 },

  filterRow: { backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  filterChipActive: { backgroundColor: '#047857', borderColor: '#047857' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  filterChipTextActive: { color: '#ffffff' },

  list: { padding: 14, gap: 10, paddingBottom: 32 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#1e293b', flex: 1 },
  cardTime: { fontSize: 10, color: '#94a3b8', marginLeft: 8 },
  cardDesc: { fontSize: 11, color: '#64748b', lineHeight: 16 },

  footerNote: { fontSize: 10, color: '#94a3b8', textAlign: 'center', marginTop: 12, fontStyle: 'italic' },
});
