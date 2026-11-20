/**
 * KantinScreen — Placeholder kantin sekolah
 * Menampilkan status buka/tutup dan daftar menu.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';

const MENU_SAMPLE = [
  { id: 'k1', nama: 'Nasi Goreng Ayam', harga: 12000, kategori: 'Makanan', stok: true },
  { id: 'k2', nama: 'Mie Ayam Bakso', harga: 10000, kategori: 'Makanan', stok: true },
  { id: 'k3', nama: 'Jus Alpukat', harga: 8000, kategori: 'Minuman', stok: true },
  { id: 'k4', nama: 'Es Teh Manis', harga: 4000, kategori: 'Minuman', stok: true },
  { id: 'k5', nama: 'Roti Bakar Coklat', harga: 7000, kategori: 'Snack', stok: false },
  { id: 'k6', nama: 'Bakso Kuah', harga: 10000, kategori: 'Makanan', stok: true },
];

const KATEGORI_ICON: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  Makanan: 'restaurant',
  Minuman: 'cafe',
  Snack: 'pizza',
};

export const KantinScreen: React.FC = () => {
  const { userSchool } = useApp();
  const [selectedKat, setSelectedKat] = useState<string>('Semua');
  const [loading] = useState(false);
  const kantinBuka = true;

  const categories = ['Semua', 'Makanan', 'Minuman', 'Snack'];
  const filtered = MENU_SAMPLE.filter((m) => selectedKat === 'Semua' || m.kategori === selectedKat);

  return (
    <View style={s.container}>
      {/* Banner */}
      <View style={s.banner}>
        <View style={s.bannerLeft}>
          <Ionicons name="storefront" size={22} color="#c7d2fe" />
          <View>
            <Text style={s.bannerTitle}>Kantin Sekolah</Text>
            <Text style={s.bannerSub}>{userSchool?.name || 'Sekolah Anda'}</Text>
          </View>
        </View>
        <View style={[s.statusBadge, { backgroundColor: kantinBuka ? '#a7f3d0' : '#fca5a5' }]}>
          <View style={[s.statusDot, { backgroundColor: kantinBuka ? '#047857' : '#dc2626' }]} />
          <Text style={[s.statusText, { color: kantinBuka ? '#047857' : '#dc2626' }]}>
            {kantinBuka ? 'BUKA' : 'TUTUP'}
          </Text>
        </View>
      </View>

      {/* Filter Kategori */}
      <View style={s.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 14, paddingVertical: 8 }}>
          {categories.map((kat) => {
            const isActive = selectedKat === kat;
            return (
              <TouchableOpacity
                key={kat}
                onPress={() => setSelectedKat(kat)}
                style={[s.filterChip, isActive && s.filterChipActive]}
                activeOpacity={0.7}
              >
                {kat !== 'Semua' && (
                  <Ionicons
                    name={KATEGORI_ICON[kat] || 'grid-outline'}
                    size={13}
                    color={isActive ? '#ffffff' : '#047857'}
                  />
                )}
                <Text style={[s.filterChipText, isActive && s.filterChipTextActive]}>{kat}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Menu List */}
      {loading ? (
        <View style={s.centerBox}>
          <ActivityIndicator size="small" color="#047857" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.menuList} showsVerticalScrollIndicator={false}>
          {filtered.map((item) => (
            <View key={item.id} style={[s.menuCard, !item.stok && s.menuCardHabis]}>
              <View style={[s.menuIcon, { backgroundColor: item.stok ? '#ecfdf5' : '#f1f5f9' }]}>
                <Ionicons
                  name={KATEGORI_ICON[item.kategori] || 'restaurant'}
                  size={22}
                  color={item.stok ? '#047857' : '#94a3b8'}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.menuName, !item.stok && { color: '#94a3b8' }]}>{item.nama}</Text>
                <Text style={s.menuKat}>{item.kategori}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={[s.menuHarga, !item.stok && { color: '#94a3b8' }]}>
                  Rp {item.harga.toLocaleString('id-ID')}
                </Text>
                {!item.stok && (
                  <View style={s.habisTag}>
                    <Text style={s.habisText}>Habis</Text>
                  </View>
                )}
              </View>
            </View>
          ))}
          <Text style={s.footerNote}>
            * Menu dan harga bersifat ilustrasi — integrasi kasir sekolah dalam pengembangan.
          </Text>
        </ScrollView>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#312e81',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  bannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bannerTitle: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
  bannerSub: { fontSize: 11, color: '#c7d2fe', marginTop: 1 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },

  filterRow: { backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  filterChipActive: { backgroundColor: '#047857', borderColor: '#047857' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  filterChipTextActive: { color: '#ffffff' },

  menuList: { padding: 14, gap: 10, paddingBottom: 32 },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  menuCardHabis: { opacity: 0.6 },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuName: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  menuKat: { fontSize: 11, color: '#64748b', marginTop: 1 },
  menuHarga: { fontSize: 13, fontWeight: '700', color: '#047857' },
  habisTag: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  habisText: { fontSize: 10, fontWeight: '700', color: '#dc2626' },

  footerNote: { fontSize: 10, color: '#94a3b8', textAlign: 'center', marginTop: 12, fontStyle: 'italic' },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
});
