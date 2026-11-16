import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { useApp } from '../context/AppContext';
import { Jenjang, StatusSekolah } from '../types';
import { Ionicons } from '@expo/vector-icons';

export const FilterModal: React.FC = () => {
  const { isFilterModalOpen, setIsFilterModalOpen, filters, setFilters } = useApp();

  if (!isFilterModalOpen) return null;

  const jenjangList: (Jenjang | 'SEMUA')[] = ['SEMUA', 'SMP', 'MTs', 'SMA', 'SMK', 'MA'];
  const statusList: (StatusSekolah | 'SEMUA')[] = ['SEMUA', 'Negeri', 'Swasta'];

  const resetFilters = () => {
    setFilters({
      searchQuery: filters.searchQuery,
      jenjang: 'SEMUA',
      status: 'SEMUA',
      maxJarakKm: 15,
      zonasiOnly: false,
      sortBy: 'jarak',
    });
  };

  return (
    <Modal visible={isFilterModalOpen} animationType="fade" transparent={true}>
      <View style={styles.overlay}>
        <View style={styles.contentCard}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Filter Pencarian Sekolah</Text>
              <Text style={styles.subTitle}>Sesuaikan kriteria sekolah yang ditampilkan</Text>
            </View>
            <TouchableOpacity onPress={() => setIsFilterModalOpen(false)}>
              <Ionicons name="close" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollBody} contentContainerStyle={{ gap: 12 }}>
            {/* Jenjang */}
            <View>
              <Text style={styles.sectionLabel}>Jenjang Pendidikan</Text>
              <View style={styles.gridBtn}>
                {jenjangList.map((j) => (
                  <TouchableOpacity
                    key={j}
                    onPress={() => setFilters((prev) => ({ ...prev, jenjang: j }))}
                    style={[styles.choiceBtn, filters.jenjang === j && styles.choiceBtnActive]}
                  >
                    <Text
                      style={[styles.choiceText, filters.jenjang === j && styles.choiceTextActive]}
                    >
                      {j}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Status */}
            <View>
              <Text style={styles.sectionLabel}>Status Sekolah</Text>
              <View style={styles.gridBtn}>
                {statusList.map((st) => (
                  <TouchableOpacity
                    key={st}
                    onPress={() => setFilters((prev) => ({ ...prev, status: st }))}
                    style={[styles.choiceBtn, filters.status === st && styles.choiceBtnActive]}
                  >
                    <Text
                      style={[styles.choiceText, filters.status === st && styles.choiceTextActive]}
                    >
                      {st}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Switch Zonasi Only */}
            <View style={styles.switchBox}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchTitle}>Hanya Yang Masuk Zonasi</Text>
                <Text style={styles.switchSub}>Tampilkan sekolah yang masuk radius/wilayah rumah</Text>
              </View>
              <Switch
                value={filters.zonasiOnly}
                onValueChange={(val) => setFilters((prev) => ({ ...prev, zonasiOnly: val }))}
                trackColor={{ false: '#cbd5e1', true: '#86efac' }}
                thumbColor={filters.zonasiOnly ? '#047857' : '#f8fafc'}
              />
            </View>

            {/* Urutan */}
            <View>
              <Text style={styles.sectionLabel}>Urutkan Berdasarkan</Text>
              <View style={styles.sortRow}>
                <TouchableOpacity
                  onPress={() => setFilters((prev) => ({ ...prev, sortBy: 'jarak' }))}
                  style={[styles.sortBtn, filters.sortBy === 'jarak' && styles.choiceBtnActive]}
                >
                  <Text
                    style={[styles.choiceText, filters.sortBy === 'jarak' && styles.choiceTextActive]}
                  >
                    Jarak Terdekat (Default)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setFilters((prev) => ({ ...prev, sortBy: 'nama' }))}
                  style={[styles.sortBtn, filters.sortBy === 'nama' && styles.choiceBtnActive]}
                >
                  <Text
                    style={[styles.choiceText, filters.sortBy === 'nama' && styles.choiceTextActive]}
                  >
                    Nama Sekolah (A - Z)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity onPress={resetFilters} style={styles.resetBtn}>
              <Text style={styles.resetText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setIsFilterModalOpen(false)}
              style={styles.applyBtn}
            >
              <Text style={styles.applyText}>Terapkan Filter</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
    maxHeight: 340,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  gridBtn: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  choiceBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  choiceBtnActive: {
    backgroundColor: '#047857',
    borderColor: '#047857',
  },
  choiceText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '600',
  },
  choiceTextActive: {
    color: '#ffffff',
  },
  switchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  switchTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
  },
  switchSub: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 1,
  },
  sortRow: {
    gap: 6,
  },
  sortBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  resetBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
  },
  resetText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  applyBtn: {
    flex: 2,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#047857',
    alignItems: 'center',
  },
  applyText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
});
