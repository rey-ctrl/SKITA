import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { Ionicons } from '@expo/vector-icons';

export const ProfileScreen: React.FC = () => {
  const {
    user,
    locations,
    setIsRegionModalOpen,
    setIsLocationModalOpen,
    loginUser,
    logoutUser,
  } = useApp();

  const [authMode, setAuthMode] = useState<'view' | 'login'>('view');
  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');

  const handleLogin = () => {
    if (!nameInput.trim() || !emailInput.trim()) {
      Alert.alert('Perhatian', 'Nama dan Email wajib diisi.');
      return;
    }
    loginUser(nameInput.trim(), emailInput.trim());
    setAuthMode('view');
  };

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
              <View style={styles.rolePill}>
                <Text style={styles.roleText}>Akun Orang Tua / Siswa</Text>
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
      ) : authMode === 'login' ? (
        <View style={styles.loginForm}>
          <Text style={styles.formTitle}>Masuk Akun SKITA</Text>
          <TextInput
            style={styles.input}
            placeholder="Nama Lengkap"
            placeholderTextColor="#94a3b8"
            value={nameInput}
            onChangeText={setNameInput}
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#94a3b8"
            value={emailInput}
            onChangeText={setEmailInput}
            keyboardType="email-address"
          />
          <View style={styles.formBtnRow}>
            <TouchableOpacity onPress={() => setAuthMode('view')} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLogin} style={styles.submitBtn}>
              <Text style={styles.submitBtnText}>Masuk</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity onPress={() => setAuthMode('login')} style={styles.loginBtn} activeOpacity={0.7}>
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
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  userEmail: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  rolePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: 4,
  },
  roleText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#065f46',
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
  },
  linkText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#047857',
  },
  regionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 8,
    gap: 6,
  },
  regionText: {
    fontSize: 11,
    color: '#334155',
  },
  bold: {
    fontWeight: '700',
    color: '#0f172a',
  },
  addrList: {
    gap: 4,
  },
  addrItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 8,
  },
  addrLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0f172a',
    flexShrink: 1,
  },
  addrKec: {
    fontSize: 10,
    color: '#64748b',
  },
  infoCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  infoTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1e3a8a',
  },
  infoText: {
    fontSize: 10,
    color: '#1e40af',
    lineHeight: 15,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffe4e6',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
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
    backgroundColor: '#047857',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  loginBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  loginForm: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  formTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  input: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 10,
    height: 38,
    fontSize: 11,
    color: '#0f172a',
  },
  formBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  cancelBtnText: {
    fontSize: 11,
    color: '#64748b',
  },
  submitBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#047857',
  },
  submitBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  versionFooter: {
    fontSize: 9,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 10,
  },
});
