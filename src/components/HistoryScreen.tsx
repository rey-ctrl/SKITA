/**
 * HistoryScreen — Riwayat Aktivitas & Informasi Akun Login (Guru & Admin)
 * Menampilkan:
 * 1. Informasi Akun Login saat ini (Nama, Email, Role, Status Sesi)
 * 2. Log Audit & Aktivitas riil dari server: Login, Kelas, Sekolah, Presensi
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { apiClient } from '../services/api';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface HistoryItem {
  id: string;
  tipe: 'absensi' | 'anggota' | 'kelas' | 'sekolah' | 'sistem';
  judul: string;
  deskripsi: string;
  waktu: string;
  timestamp?: string;
  icon: string;
  iconColor: string;
  iconBg: string;
}

export const HistoryScreen: React.FC = () => {
  const { user, userSchool } = useApp();
  const [filterTipe, setFilterTipe] = useState<string>('semua');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const filterOptions = [
    { id: 'semua', label: 'Semua' },
    { id: 'kelas', label: 'Kelas' },
    { id: 'absensi', label: 'Presensi' },
    { id: 'sekolah', label: 'Sekolah' },
  ];

  const loadHistory = useCallback(async () => {
    try {
      const res = await apiClient.getActivityHistory();
      if (res.history && res.history.length > 0) {
        // Exclude aktivitas login jika ada yang tersisa dari cache/server lama
        const nonLogin = (res.history as any[]).filter(
          (h) => h.icon !== 'log-in' && !h.judul?.toLowerCase().includes('login')
        );
        setHistory(nonLogin);
      } else {
        setHistory([]);
      }
    } catch {
      setHistory([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const onRefresh = () => {
    setRefreshing(true);
    loadHistory();
  };

  const filtered = history.filter(
    (item) => filterTipe === 'semua' || item.tipe === filterTipe
  );

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#047857']} />}
    >
      {/* Banner Utama */}
      <View style={s.banner}>
        <View style={s.bannerLeft}>
          <Ionicons name="time" size={20} color="#a7f3d0" />
          <View>
            <Text style={s.bannerTitle}>Aktivitas & Log Audit</Text>
            <Text style={s.bannerSub}>{userSchool?.name || 'Sistem Sekolah SKITA'}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onRefresh} style={{ padding: 4 }}>
          <Ionicons name="refresh" size={16} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={s.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 2, paddingVertical: 4 }}>
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
      <View style={s.timelineSection}>
        <Text style={s.sectionTitle}>
          Riwayat Aktivitas Tercatat ({filtered.length})
        </Text>

        {loading ? (
          <View style={s.centerBox}>
            <ActivityIndicator size="small" color="#047857" />
            <Text style={s.emptyText}>Memuat riwayat aktivitas...</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="file-tray-outline" size={32} color="#cbd5e1" />
            <Text style={s.emptyText}>Tidak ada riwayat aktivitas untuk kategori ini.</Text>
          </View>
        ) : (
          filtered.map((item) => (
            <View key={item.id} style={s.card}>
              <View style={[s.iconBox, { backgroundColor: item.iconBg || '#ecfdf5' }]}>
                <Ionicons
                  name={(item.icon as IconName) || 'ellipse'}
                  size={20}
                  color={item.iconColor || '#047857'}
                />
              </View>
              <View style={{ flex: 1 }}>
                <View style={s.cardTop}>
                  <Text style={s.cardTitle}>{item.judul}</Text>
                  <Text style={s.cardTime}>{item.waktu}</Text>
                </View>
                <Text style={s.cardDesc}>{item.deskripsi}</Text>
              </View>
            </View>
          ))
        )}
      </View>

      <Text style={s.footerNote}>
        * Log aktivitas diaudit otomatis sesuai ketentuan keamanan data UU PDP.
      </Text>
    </ScrollView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  contentContainer: { padding: 14, gap: 12, paddingBottom: 80 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#064e3b',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  bannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bannerTitle: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
  bannerSub: { fontSize: 11, color: '#a7f3d0', marginTop: 1 },

  // Card Akun Login
  accountCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  accountHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#047857',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountName: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  accountEmail: { fontSize: 11, color: '#64748b', marginTop: 2 },
  roleBadge: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  roleBadgeText: { fontSize: 9, fontWeight: '700', color: '#047857' },
  activeSessionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#16a34a' },
  activeSessionText: { fontSize: 10, fontWeight: '700', color: '#16a34a' },

  filterRow: { marginVertical: 2 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  filterChipActive: { backgroundColor: '#047857', borderColor: '#047857' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  filterChipTextActive: { color: '#ffffff' },

  timelineSection: { gap: 10 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#475569', textTransform: 'uppercase' },

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
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#1e293b', flex: 1 },
  cardTime: { fontSize: 10, color: '#94a3b8', marginLeft: 8 },
  cardDesc: { fontSize: 11, color: '#64748b', lineHeight: 16 },

  emptyBox: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyText: { fontSize: 12, color: '#94a3b8', textAlign: 'center' },
  centerBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: 8 },

  footerNote: { fontSize: 10, color: '#94a3b8', textAlign: 'center', marginTop: 8, fontStyle: 'italic' },
});
