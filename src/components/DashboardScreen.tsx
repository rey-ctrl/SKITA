import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { SchoolCard } from './SchoolCard';
import { Jenjang } from '../types';
import { Ionicons, Feather } from '@expo/vector-icons';

export const DashboardScreen: React.FC = () => {
  const { schools, filters, setFilters, getSchoolEvaluation, setActiveTab, user, refreshSchools } = useApp();
  const [refreshing, setRefreshing] = useState(false);

  const jenjangPills: (Jenjang | 'SEMUA')[] = ['SEMUA', 'SMP', 'MTs', 'SMA', 'SMK', 'MA'];

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshSchools();
    } finally {
      setRefreshing(false);
    }
  };

  const filteredSchools = useMemo(() => {
    return schools
      .map((school) => ({
        school,
        evaluation: getSchoolEvaluation(school),
      }))
      .filter(({ school, evaluation }) => {
        if (filters.searchQuery.trim()) {
          const q = filters.searchQuery.toLowerCase();
          const matchName = school.nama.toLowerCase().includes(q);
          const matchAddress = school.alamat.toLowerCase().includes(q);
          const matchKec = school.kecamatan.toLowerCase().includes(q);
          if (!matchName && !matchAddress && !matchKec) return false;
        }

        if (filters.jenjang !== 'SEMUA' && school.jenjang !== filters.jenjang) {
          return false;
        }

        if (filters.status !== 'SEMUA' && school.status !== filters.status) {
          return false;
        }

        const distKm = evaluation.jarak_m / 1000;
        if (distKm > filters.maxJarakKm) {
          return false;
        }

        if (filters.zonasiOnly && evaluation.status !== 'MASUK_ZONA') {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (filters.sortBy === 'nama') {
          return a.school.nama.localeCompare(b.school.nama);
        }
        return a.evaluation.jarak_m - b.evaluation.jarak_m;
      });
  }, [schools, filters, getSchoolEvaluation]);

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <View style={styles.searchWrapper}>
        <Ionicons name="search" size={16} color="#94a3b8" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Cari nama sekolah atau kecamatan..."
          placeholderTextColor="#94a3b8"
          value={filters.searchQuery}
          onChangeText={(text) => setFilters((prev) => ({ ...prev, searchQuery: text }))}
        />
        {filters.searchQuery ? (
          <TouchableOpacity
            onPress={() => setFilters((prev) => ({ ...prev, searchQuery: '' }))}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close-circle" size={16} color="#94a3b8" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Horizontal Jenjang Pills */}
      <View style={styles.pillsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsScroll}>
          {jenjangPills.map((j) => {
            const isSelected = filters.jenjang === j;
            return (
              <TouchableOpacity
                key={j}
                onPress={() => setFilters((prev) => ({ ...prev, jenjang: j }))}
                style={[styles.pillBtn, isSelected && styles.pillBtnActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>{j}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Sponsor / Ad Banner (PRD 12/14/16) */}
      <View style={styles.adBanner}>
        <View style={styles.adLeft}>
          <View style={styles.adBadge}>
            <Text style={styles.adBadgeText}>Mitra Edukasi</Text>
          </View>
          <Text style={styles.adTitle}>Persiapan SPMB Jalur Domisili 2026</Text>
          <Text style={styles.adSub}>Panduan & simulasi kuota zonasi Kota/Kab. Bogor</Text>
        </View>
        <Ionicons name="sparkles" size={18} color="#d97706" />
      </View>

      {/* List Header Count */}
      <View style={styles.listHeader}>
        <Text style={styles.listCountText}>
          Menampilkan <Text style={styles.boldText}>{filteredSchools.length}</Text> sekolah di{' '}
          <Text style={styles.greenText}>{user?.kota_kab || 'Bogor'}</Text>
        </Text>
        <Text style={styles.sortIndicator}>
          {filters.sortBy === 'jarak' ? 'Jarak Terdekat' : 'Nama A-Z'}
        </Text>
      </View>

      {/* Rows List */}
      <FlatList
        data={filteredSchools}
        keyExtractor={(item) => item.school.id}
        renderItem={({ item }) => (
          <SchoolCard school={item.school} evaluation={item.evaluation} />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#047857']} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="school-outline" size={44} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>Sekolah Tidak Ditemukan</Text>
            <Text style={styles.emptySub}>
              Tidak ada sekolah yang cocok dengan filter atau kata kunci saat ini.
            </Text>
            {user?.role === 'admin' ? (
              <TouchableOpacity
                onPress={() => setActiveTab('sof')}
                style={styles.emptyBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="search" size={16} color="#ffffff" />
                <Text style={styles.emptyBtnText}>Cari Sekolah Baru via Google</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    height: 40,
    marginBottom: 8,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#0f172a',
    paddingVertical: 0,
  },
  pillsContainer: {
    marginBottom: 8,
  },
  pillsScroll: {
    gap: 6,
    paddingRight: 10,
  },
  pillBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pillBtnActive: {
    backgroundColor: '#047857',
    borderColor: '#047857',
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  pillTextActive: {
    color: '#ffffff',
  },
  adBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fef3c7',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fde68a',
    padding: 10,
    marginBottom: 8,
  },
  adLeft: {
    flex: 1,
    marginRight: 8,
  },
  adBadge: {
    backgroundColor: '#f59e0b',
    alignSelf: 'flex-start',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginBottom: 2,
  },
  adBadgeText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  adTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#78350f',
  },
  adSub: {
    fontSize: 9,
    color: '#92400e',
    marginTop: 1,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  listCountText: {
    fontSize: 11,
    color: '#64748b',
  },
  boldText: {
    fontWeight: '700',
    color: '#0f172a',
  },
  greenText: {
    fontWeight: '700',
    color: '#047857',
  },
  sortIndicator: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '500',
  },
  listContent: {
    paddingBottom: 20,
  },
  emptyContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 24,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 10,
  },
  emptySub: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 14,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#047857',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  emptyBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
});
