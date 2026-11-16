import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { guessJenjangFromName, normalizeSchoolName, buildSchoolName } from '../utils/zonasi';
import { Jenjang, School } from '../types';
import { apiClient } from '../services/api';
import { Ionicons } from '@expo/vector-icons';

export const SearchOnTheFlyModal: React.FC = () => {
  const { addSchoolFromSearch, schools, setSelectedSchool, setActiveTab } = useApp();

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Multi-selection: array of selected place objects
  const [selectedPlaces, setSelectedPlaces] = useState<any[]>([]);

  // Uniform batch Jenjang & Status for all checked schools
  const [batchJenjang, setBatchJenjang] = useState<Jenjang>('SMP');
  const [batchStatus, setBatchStatus] = useState<'Negeri' | 'Swasta'>('Negeri');

  const [isImporting, setIsImporting] = useState(false);

  const executeSearch = async (text: string) => {
    if (!text.trim()) {
      setSearchResults([]);
      setSearchError(null);
      setSelectedPlaces([]);
      return;
    }
    setIsSearching(true);
    setSearchError(null);
    try {
      const res = await apiClient.searchOnTheFly(text.trim());
      if (res.success && Array.isArray(res.results)) {
        const cleaned = res.results.map((item) => ({
          ...item,
          nama: normalizeSchoolName(item.nama),
        }));
        setSearchResults(cleaned);
      } else {
        setSearchResults([]);
      }
    } catch (err: any) {
      setSearchError(err.message || 'Gagal menghubungi server.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      executeSearch(query);
    }, 500);

    return () => clearTimeout(timer);
  }, [query]);

  // Toggle individual place checkbox
  const handleTogglePlace = (place: any) => {
    const exists = selectedPlaces.some((p) => p.place_id === place.place_id);
    let next: any[];
    if (exists) {
      next = selectedPlaces.filter((p) => p.place_id !== place.place_id);
    } else {
      next = [...selectedPlaces, place];
      // Jika baru pertama kali memilih sekolah, tebak jenjang dan status dari sekolah ini
      if (selectedPlaces.length === 0) {
        const guessedJenjang = guessJenjangFromName(place.nama);
        setBatchJenjang(guessedJenjang);
        const guessedStatus: 'Negeri' | 'Swasta' = place.nama.toLowerCase().includes('negeri')
          ? 'Negeri'
          : (place.status as 'Negeri' | 'Swasta') || 'Swasta';
        setBatchStatus(guessedStatus);
      }
    }
    setSelectedPlaces(next);
  };

  // Select all available (not already cached)
  const handleSelectAll = () => {
    const available = searchResults.filter(
      (place) => !schools.some((s) => s.place_id === place.place_id)
    );

    if (selectedPlaces.length === available.length) {
      // Unselect all
      setSelectedPlaces([]);
    } else {
      setSelectedPlaces(available);
      if (available.length > 0 && selectedPlaces.length === 0) {
        const first = available[0];
        setBatchJenjang(guessJenjangFromName(first.nama));
        setBatchStatus(
          first.nama.toLowerCase().includes('negeri')
            ? 'Negeri'
            : (first.status as 'Negeri' | 'Swasta') || 'Swasta'
        );
      }
    }
  };

  // Import all selected schools in batch
  const handleBatchImport = async () => {
    if (selectedPlaces.length === 0) return;

    setIsImporting(true);
    let successCount = 0;
    let failCount = 0;
    let lastSavedSchool: School | null = null;

    for (const place of selectedPlaces) {
      const builtName = buildSchoolName(place.nama, batchJenjang, batchStatus);
      try {
        const res = await apiClient.importPlace(place.place_id, batchJenjang, batchStatus);
        if (res.success && res.data) {
          addSchoolFromSearch({ ...res.data, nama: builtName });
          lastSavedSchool = { ...res.data, nama: builtName };
          successCount++;
          continue;
        }
      } catch {
        // Fallback local cache
      }

      const localRes = addSchoolFromSearch({
        ...place,
        nama: builtName,
        jenjang: batchJenjang,
        status: batchStatus,
      });

      if (localRes.success && localRes.school) {
        lastSavedSchool = localRes.school;
        successCount++;
      } else {
        failCount++;
      }
    }

    setIsImporting(false);
    setSelectedPlaces([]);

    if (successCount > 0) {
      Alert.alert(
        'Berhasil Menyimpan',
        `${successCount} sekolah berhasil disimpan dengan jenjang ${batchJenjang} (${batchStatus}).${
          failCount > 0 ? ` (${failCount} sekolah dilewati/sudah ada)` : ''
        }`,
        [
          {
            text: 'Lihat di Beranda',
            onPress: () => {
              if (lastSavedSchool) {
                setSelectedSchool(lastSavedSchool);
              }
              setActiveTab('beranda');
            },
          },
          { text: 'Tetap di Sini', style: 'cancel' },
        ]
      );
    } else {
      Alert.alert('Perhatian', 'Semua sekolah yang dipilih sudah terdaftar sebelumnya.');
    }
  };

  const availableResults = searchResults.filter(
    (place) => !schools.some((s) => s.place_id === place.place_id)
  );
  const isAllSelected =
    availableResults.length > 0 && selectedPlaces.length === availableResults.length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Banner */}
      <View style={styles.banner}>
        <View style={styles.bannerHeader}>
          <Ionicons name="sparkles" size={16} color="#fbbf24" />
          <Text style={styles.bannerTitle}>Search-on-the-fly Multi-Import</Text>
        </View>
        <Text style={styles.bannerText}>
          Cari dan checklist banyak sekolah sekaligus. Jenjang dan status yang Anda tentukan akan disamakan secara seragam untuk seluruh sekolah terpilih.
        </Text>
      </View>

      {/* Input */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Cari sekolah (cth: SMAN 1 Bogor, Regina Pacis)..."
          placeholderTextColor="#94a3b8"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => executeSearch(query)}
          returnKeyType="search"
        />
        {isSearching ? (
          <ActivityIndicator size="small" color="#2563eb" style={{ marginRight: 6 }} />
        ) : null}
        {query ? (
          <TouchableOpacity onPress={() => setQuery('')} style={{ marginRight: 6 }}>
            <Ionicons name="close-circle" size={16} color="#94a3b8" />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          onPress={() => executeSearch(query)}
          style={styles.searchActionBtn}
          activeOpacity={0.7}
        >
          <Text style={styles.searchActionBtnText}>Cari</Text>
        </TouchableOpacity>
      </View>

      {searchError && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={16} color="#dc2626" style={{ marginRight: 6 }} />
          <Text style={styles.errorBoxText}>{searchError}</Text>
        </View>
      )}

      {/* Results header & Select All button */}
      <View style={styles.resultsHeader}>
        <View>
          <Text style={styles.resultsTitle}>Hasil Pencarian Google Places</Text>
          <Text style={styles.resultsCount}>
            {searchResults.length} ditemukan • {selectedPlaces.length} dipilih
          </Text>
        </View>
        {availableResults.length > 0 && (
          <TouchableOpacity
            onPress={handleSelectAll}
            style={styles.selectAllBtn}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isAllSelected ? 'checkbox' : 'square-outline'}
              size={15}
              color="#047857"
            />
            <Text style={styles.selectAllBtnText}>
              {isAllSelected ? 'Batal Semua' : 'Pilih Semua'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {searchResults.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="business-outline" size={36} color="#cbd5e1" />
          <Text style={styles.emptyText}>
            {query.trim()
              ? 'Tidak ada sekolah baru yang cocok.'
              : 'Ketik nama sekolah baru (misal: "SMPN", "SMAN", "SMKN", "Pesantren", "Bogor").'}
          </Text>
        </View>
      ) : (
        <View style={styles.resultsList}>
          {searchResults.map((place) => {
            const isChecked = selectedPlaces.some((p) => p.place_id === place.place_id);
            const alreadyCached = schools.some((s) => s.place_id === place.place_id);

            return (
              <TouchableOpacity
                key={place.place_id}
                onPress={() => !alreadyCached && handleTogglePlace(place)}
                style={[
                  styles.placeCard,
                  isChecked && styles.placeCardSelected,
                  alreadyCached && styles.placeCardDisabled,
                ]}
                activeOpacity={0.7}
                disabled={alreadyCached}
              >
                {/* Checkbox */}
                <View style={styles.checkboxWrapper}>
                  {alreadyCached ? (
                    <Ionicons name="checkmark-done" size={20} color="#94a3b8" />
                  ) : (
                    <Ionicons
                      name={isChecked ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={isChecked ? '#047857' : '#94a3b8'}
                    />
                  )}
                </View>

                {/* Details */}
                <View style={{ flex: 1 }}>
                  <Text style={styles.placeName}>{place.nama}</Text>
                  <Text style={styles.placeAddr} numberOfLines={1}>
                    {place.alamat}
                  </Text>
                  <Text style={styles.placeMeta}>
                    {place.kecamatan}, {place.kota_kab} ({place.status || 'Umum'})
                  </Text>
                </View>

                {alreadyCached && (
                  <View style={styles.cachedBadge}>
                    <Text style={styles.cachedBadgeText}>Tersimpan</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Batch Configuration Card (when >= 1 school checked) */}
      {selectedPlaces.length > 0 && (
        <View style={styles.confirmBox}>
          <View style={styles.confirmHeaderRow}>
            <View style={styles.badgeCount}>
              <Text style={styles.badgeCountText}>{selectedPlaces.length}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.confirmTitle}>Pengaturan Seragam Sekolah Terpilih</Text>
              <Text style={styles.confirmSubtitle}>
                Jenjang dan status di bawah akan disamakan ke seluruh {selectedPlaces.length} sekolah yang dicentang.
              </Text>
            </View>
          </View>

          {/* List of checked schools chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            {selectedPlaces.map((p) => (
              <View key={p.place_id} style={styles.chip}>
                <Text style={styles.chipText} numberOfLines={1}>
                  {p.nama}
                </Text>
                <TouchableOpacity onPress={() => handleTogglePlace(p)} style={styles.chipRemove}>
                  <Ionicons name="close" size={12} color="#047857" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          {/* Jenjang Selector */}
          <Text style={styles.jenjangLabel}>Jenjang Seragam:</Text>
          <View style={styles.jenjangRow}>
            {(['SMP', 'MTs', 'SMA', 'SMK', 'MA'] as Jenjang[]).map((j) => (
              <TouchableOpacity
                key={j}
                onPress={() => setBatchJenjang(j)}
                style={[styles.jenjangBtn, batchJenjang === j && styles.jenjangBtnActive]}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.jenjangBtnText, batchJenjang === j && styles.jenjangBtnTextActive]}
                >
                  {j}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Status Selector */}
          <Text style={styles.jenjangLabel}>Status Seragam:</Text>
          <View style={styles.jenjangRow}>
            {(['Negeri', 'Swasta'] as const).map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => setBatchStatus(s)}
                style={[
                  styles.jenjangBtn,
                  { flex: 1, alignItems: 'center' },
                  batchStatus === s && styles.jenjangBtnActive,
                ]}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.jenjangBtnText, batchStatus === s && styles.jenjangBtnTextActive]}
                >
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            onPress={handleBatchImport}
            style={[styles.saveBtn, isImporting && styles.saveBtnDisabled]}
            activeOpacity={0.7}
            disabled={isImporting}
          >
            {isImporting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons name="save-outline" size={16} color="#ffffff" />
            )}
            <Text style={styles.saveBtnText}>
              {isImporting
                ? 'Menyimpan ke Database...'
                : `Simpan ${selectedPlaces.length} Sekolah ke Database SKITA`}
            </Text>
          </TouchableOpacity>
        </View>
      )}
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
    paddingBottom: 36,
  },
  banner: {
    backgroundColor: '#047857',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  bannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  bannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  bannerText: {
    fontSize: 11,
    color: '#d1fae5',
    lineHeight: 16,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 10,
    height: 42,
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#0f172a',
  },
  searchActionBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  searchActionBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
  },
  errorBoxText: {
    color: '#b91c1c',
    fontSize: 11,
    flex: 1,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  resultsTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  resultsCount: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 1,
  },
  selectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  selectAllBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 16,
  },
  resultsList: {
    gap: 6,
  },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  placeCardSelected: {
    borderColor: '#047857',
    backgroundColor: '#f0fdf4',
  },
  placeCardDisabled: {
    opacity: 0.6,
  },
  checkboxWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  placeAddr: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  placeMeta: {
    fontSize: 9,
    color: '#94a3b8',
    marginTop: 2,
  },
  cachedBadge: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cachedBadgeText: {
    fontSize: 9,
    color: '#475569',
    fontWeight: '600',
  },
  confirmBox: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#047857',
    padding: 14,
    marginTop: 12,
  },
  confirmHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  badgeCount: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#047857',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeCountText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  confirmTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
  },
  confirmSubtitle: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  chipsScroll: {
    flexDirection: 'row',
    marginBottom: 10,
    maxHeight: 34,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 14,
    marginRight: 6,
    maxWidth: 160,
  },
  chipText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#065f46',
  },
  chipRemove: {
    padding: 2,
  },
  jenjangLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  jenjangRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  jenjangBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  jenjangBtnActive: {
    backgroundColor: '#047857',
    borderColor: '#047857',
  },
  jenjangBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  jenjangBtnTextActive: {
    color: '#ffffff',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#047857',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});
