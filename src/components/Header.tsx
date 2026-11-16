import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useApp } from '../context/AppContext';
import { Ionicons, Feather } from '@expo/vector-icons';

export const Header: React.FC = () => {
  const { activeLocation, setIsLocationModalOpen, setIsFilterModalOpen, filters } = useApp();

  const activeFilterCount =
    (filters.jenjang !== 'SEMUA' ? 1 : 0) +
    (filters.status !== 'SEMUA' ? 1 : 0) +
    (filters.zonasiOnly ? 1 : 0) +
    (filters.maxJarakKm < 15 ? 1 : 0);

  return (
    <View style={styles.header}>
      {/* Brand row */}
      <View style={styles.topRow}>
        <View style={styles.brandGroup}>
          <View style={styles.logoBox}>
            <Image
              source={require('../../assets/logos/logo-no-background.png')}
              style={styles.logoImg}
              resizeMode="contain"
            />
          </View>
          <View>
            <View style={styles.brandTitleRow}>
              <Text style={styles.brandTitleS}>S</Text>
              <Text style={styles.brandTitleKITA}>KITA</Text>
            </View>
            <Text style={styles.brandSubtitle}>Titik Akses &amp; Zonasi Sekolah</Text>
          </View>
        </View>
      </View>

      {/* Active home location row */}
      <View style={styles.locationRow}>
        <TouchableOpacity
          onPress={() => setIsLocationModalOpen(true)}
          style={styles.locationBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="location-sharp" size={16} color="#6ee7b7" />
          <View style={styles.locationInfo}>
            <Text style={styles.locationLabel}>Titik Acuan Rumah:</Text>
            <Text style={styles.locationValue} numberOfLines={1}>
              {activeLocation
                ? `${activeLocation.label} (${activeLocation.kecamatan || 'Pusat'})`
                : 'Belum diatur (Ketuk untuk atur)'}
            </Text>
          </View>
          <Feather name="chevron-down" size={14} color="#a7f3d0" />
        </TouchableOpacity>

        {/* Filter button */}
        <TouchableOpacity
          onPress={() => setIsFilterModalOpen(true)}
          style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
          activeOpacity={0.7}
        >
          <Ionicons
            name="options-outline"
            size={18}
            color={activeFilterCount > 0 ? '#451a03' : '#ecfdf5'}
          />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#047857',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#065f46',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoBox: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
  },
  logoImg: {
    width: 32,
    height: 32,
  },
  brandTitleRow: {
    flexDirection: 'row',
  },
  brandTitleS: {
    fontSize: 17,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 1,
  },
  brandTitleKITA: {
    fontSize: 17,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cityBadge: {
    backgroundColor: '#064e3b',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#059669',
  },
  cityBadgeText: {
    color: '#a7f3d0',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  brandSubtitle: {
    fontSize: 10,
    color: '#d1fae5',
  },
  regionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#064e3b',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
    borderWidth: 0.5,
    borderColor: '#059669',
  },
  regionText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
    maxWidth: 100,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#065f46',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 6,
  },
  locationInfo: {
    flex: 1,
  },
  locationLabel: {
    color: '#a7f3d0',
    fontSize: 9,
  },
  locationValue: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  filterBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#065f46',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: {
    backgroundColor: '#fbbf24',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#e11d48',
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: 'bold',
  },
});
