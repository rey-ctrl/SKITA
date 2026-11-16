import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useApp } from '../context/AppContext';
import { PROVINCES_DATA } from '../data/initialData';
import { Ionicons } from '@expo/vector-icons';

export const MandatoryRegionModal: React.FC = () => {
  const { isRegionModalOpen, user, saveRegion } = useApp();

  const [selectedProv, setSelectedProv] = useState<string>(user?.provinsi || 'Jawa Barat');
  const [selectedCity, setSelectedCity] = useState<string>(user?.kota_kab || 'Kota Bogor');

  const currentProvData = PROVINCES_DATA.find((p) => p.name === selectedProv);
  const cities = currentProvData ? currentProvData.cities : [];

  const handleSelectProv = (provName: string) => {
    setSelectedProv(provName);
    const pData = PROVINCES_DATA.find((p) => p.name === provName);
    if (pData && pData.cities.length > 0) {
      const preferred = pData.cities.find((c) => c.includes('Bogor')) || pData.cities[0];
      setSelectedCity(preferred);
    } else {
      setSelectedCity('');
    }
  };

  const isFormValid = Boolean(selectedProv && selectedCity);

  const handleSubmit = () => {
    if (!isFormValid) {
      Alert.alert('Perhatian', 'Pilih Provinsi dan Kota/Kabupaten terlebih dahulu.');
      return;
    }
    saveRegion(selectedProv, selectedCity);
  };

  if (!isRegionModalOpen) return null;

  return (
    <Modal visible={isRegionModalOpen} animationType="slide" transparent={true}>
      <View style={styles.overlay}>
        <View style={styles.contentCard}>
          {/* Header Banner */}
          <View style={styles.banner}>
            <Ionicons name="location" size={24} color="#ffffff" />
            <Text style={styles.bannerTitle}>Pilih Wilayah Domisili</Text>
            <Text style={styles.bannerSub}>
              Wajib diatur untuk menyaring sekolah terdekat dan menghitung akurasi zonasi (FR-REG).
            </Text>
          </View>

          <ScrollView style={styles.scrollBody} contentContainerStyle={{ gap: 12 }}>
            {/* Provinsi Picker */}
            <View>
              <Text style={styles.label}>1. Pilih Provinsi:</Text>
              <View style={styles.chipsWrap}>
                {PROVINCES_DATA.map((prov) => {
                  const isSelected = selectedProv === prov.name;
                  return (
                    <TouchableOpacity
                      key={prov.id}
                      onPress={() => handleSelectProv(prov.name)}
                      style={[styles.chip, isSelected && styles.chipActive]}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                        {prov.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Kota / Kabupaten (Cascading) */}
            <View>
              <Text style={styles.label}>2. Pilih Kota / Kabupaten:</Text>
              <View style={styles.chipsWrap}>
                {cities.map((city) => {
                  const isSelected = selectedCity === city;
                  return (
                    <TouchableOpacity
                      key={city}
                      onPress={() => setSelectedCity(city)}
                      style={[styles.chip, isSelected && styles.chipActive]}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                        {city}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Submit */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!isFormValid}
            style={[styles.submitBtn, !isFormValid && styles.submitBtnDisabled]}
            activeOpacity={0.7}
          >
            <Text style={styles.submitBtnText}>Simpan Wilayah & Lanjut</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    padding: 16,
  },
  contentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    maxHeight: '85%',
  },
  banner: {
    backgroundColor: '#047857',
    padding: 16,
    alignItems: 'center',
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 4,
  },
  bannerSub: {
    fontSize: 10,
    color: '#d1fae5',
    textAlign: 'center',
    marginTop: 2,
    lineHeight: 14,
  },
  scrollBody: {
    padding: 14,
    maxHeight: 320,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipActive: {
    backgroundColor: '#047857',
    borderColor: '#047857',
  },
  chipText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  submitBtn: {
    backgroundColor: '#047857',
    margin: 14,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: '#cbd5e1',
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
