import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { apiClient } from '../services/api';

export const AuthScreen: React.FC = () => {
  const { loginWithUserData, continueAsGuest } = useApp();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [nama, setNama] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async () => {
    setErrorMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanEmail || !cleanPass) {
      setErrorMsg('Email dan password wajib diisi.');
      return;
    }

    if (mode === 'register') {
      const cleanNama = nama.trim();
      if (!cleanNama) {
        setErrorMsg('Nama lengkap wajib diisi.');
        return;
      }
      if (cleanPass.length < 8) {
        setErrorMsg('Password minimal harus 8 karakter.');
        return;
      }

      setLoading(true);
      try {
        const res = await apiClient.register({
          nama: cleanNama,
          email: cleanEmail,
          password: cleanPass,
          provinsi: 'Jawa Barat',
          kota_kab: 'Kota Bogor',
        });
        if (res.success && res.user) {
          loginWithUserData(res.user);
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Registrasi gagal. Periksa koneksi dan coba lagi.');
      } finally {
        setLoading(false);
      }
    } else {
      // Login mode
      setLoading(true);
      try {
        const res = await apiClient.login(cleanEmail, cleanPass);
        if (res.success && res.user) {
          loginWithUserData(res.user);
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Login gagal. Periksa email, password, dan koneksi.');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Header */}
        <View style={styles.brandContainer}>
          <Image
            source={require('../../assets/logos/logo-no-background.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={styles.brandTitleRow}>
            <Text style={styles.brandS}>S</Text>
            <Text style={styles.brandKITA}>KITA</Text>
          </View>
          <Text style={styles.brandSubtitle}>
            Sistem Kemudahan Informasi & Titik Akses Sekolah
          </Text>
        </View>

        {/* Tab Toggle: Masuk vs Daftar */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, mode === 'login' && styles.tabButtonActive]}
            onPress={() => {
              setMode('login');
              setErrorMsg(null);
            }}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.tabButtonText,
                mode === 'login' && styles.tabButtonTextActive,
              ]}
            >
              Masuk
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, mode === 'register' && styles.tabButtonActive]}
            onPress={() => {
              setMode('register');
              setErrorMsg(null);
            }}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.tabButtonText,
                mode === 'register' && styles.tabButtonTextActive,
              ]}
            >
              Daftar Akun
            </Text>
          </TouchableOpacity>
        </View>

        {/* Error Notification */}
        {errorMsg && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={16} color="#dc2626" />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {/* Form Inputs */}
        <View style={styles.formCard}>
          {mode === 'register' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nama Lengkap</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={18} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Misal: Ahmad Fauzi"
                  placeholderTextColor="#94a3b8"
                  value={nama}
                  onChangeText={setNama}
                  autoCapitalize="words"
                />
              </View>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={18} color="#64748b" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="nama@email.com"
                placeholderTextColor="#94a3b8"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={18} color="#64748b" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder={mode === 'register' ? 'Minimal 8 karakter' : 'Password Anda'}
                placeholderTextColor="#94a3b8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color="#64748b"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Primary Action Button */}
          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {mode === 'login' ? 'Masuk ke SKITA' : 'Daftar Sekarang'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Shortcut Akun Seed (Sekolah, Guru, Murid, Admin) */}
          {mode === 'login' && (
            <View style={styles.seedSection}>
              <View style={styles.seedHeader}>
                <Ionicons name="flash-outline" size={13} color="#047857" />
                <Text style={styles.seedSectionTitle}>Akun Seed / Demo Cepat:</Text>
              </View>

              <View style={styles.seedGrid}>
                {/* Seed Sekolah */}
                <TouchableOpacity
                  style={[styles.seedCard, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}
                  onPress={() => {
                    setEmail('sekolah@skita.id');
                    setPassword('Sekolah@2026!');
                    setErrorMsg(null);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="school" size={14} color="#047857" />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.seedRole, { color: '#065f46' }]}>Akun Sekolah</Text>
                    <Text style={styles.seedEmail} numberOfLines={1}>sekolah@skita.id</Text>
                  </View>
                </TouchableOpacity>

                {/* Seed Guru */}
                <TouchableOpacity
                  style={[styles.seedCard, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}
                  onPress={() => {
                    setEmail('guru@skita.id');
                    setPassword('Guru@2026!');
                    setErrorMsg(null);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="person" size={14} color="#1d4ed8" />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.seedRole, { color: '#1e40af' }]}>Akun Guru</Text>
                    <Text style={styles.seedEmail} numberOfLines={1}>guru@skita.id</Text>
                  </View>
                </TouchableOpacity>

                {/* Seed Murid */}
                <TouchableOpacity
                  style={[styles.seedCard, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}
                  onPress={() => {
                    setEmail('murid@skita.id');
                    setPassword('Murid@2026!');
                    setErrorMsg(null);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="book" size={14} color="#b45309" />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.seedRole, { color: '#92400e' }]}>Akun Murid</Text>
                    <Text style={styles.seedEmail} numberOfLines={1}>murid@skita.id</Text>
                  </View>
                </TouchableOpacity>

                {/* Seed Admin */}
                <TouchableOpacity
                  style={[styles.seedCard, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}
                  onPress={() => {
                    setEmail('admin@skita.id');
                    setPassword('Admin@2026!');
                    setErrorMsg(null);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="shield-checkmark" size={14} color="#dc2626" />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.seedRole, { color: '#991b1b' }]}>Admin SKITA</Text>
                    <Text style={styles.seedEmail} numberOfLines={1}>admin@skita.id</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Guest Skip Option */}
        <TouchableOpacity
          style={styles.guestButton}
          onPress={continueAsGuest}
          activeOpacity={0.7}
        >
          <Text style={styles.guestButtonText}>
            Eksplorasi dulu sebagai Tamu
          </Text>
          <Ionicons name="arrow-forward" size={14} color="#047857" />
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logo: {
    width: 68,
    height: 68,
    marginBottom: 10,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandS: {
    fontSize: 26,
    fontWeight: '900',
    color: '#047857',
    letterSpacing: 0.5,
  },
  brandKITA: {
    fontSize: 26,
    fontWeight: '900',
    color: '#2563eb',
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '500',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  tabButtonTextActive: {
    color: '#047857',
    fontWeight: '700',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '500',
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 20,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
    height: 46,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    paddingVertical: 0,
  },
  eyeBtn: {
    padding: 4,
  },
  primaryButton: {
    backgroundColor: '#047857',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  guestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
    paddingVertical: 8,
  },
  guestButtonText: {
    fontSize: 13,
    color: '#047857',
    fontWeight: '600',
  },
  seedSection: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 8,
  },
  seedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  seedSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  seedGrid: {
    gap: 6,
  },
  seedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  seedRole: {
    fontSize: 11,
    fontWeight: '700',
  },
  seedEmail: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 0.5,
  },
});
