import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Modal, FlatList, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useApp } from '../context/AppContext';
import { Ionicons, Feather } from '@expo/vector-icons';
import { apiClient } from '../services/api';

export const Header: React.FC = () => {
  const {
    activeLocation,
    setIsLocationModalOpen,
    setIsFilterModalOpen,
    setIsCreateClassModalOpen,
    filters,
    activeTab,
    setActiveTab,
    user,
    userSchool,
    activeClass,
    setActiveClass,
    availableClasses,
    teacherSubjects,
    isTeacherSubjectsLocked,
    autoApproveTeacher,
    refreshTeacherSubjects,
    saveTeacherSubjects,
    setAutoApproveTeacher,
  } = useApp();

  const [isClassPickerOpen, setIsClassPickerOpen] = useState(false);
  const [isSubjectPickerOpen, setIsSubjectPickerOpen] = useState(false);
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const [unlockCode, setUnlockCode] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [availableSubjects, setAvailableSubjects] = useState<Array<{ id: string; nama: string }>>([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [savingSubjects, setSavingSubjects] = useState(false);

  const role = user?.role;
  const isSchoolOrAdmin = role === 'sekolah' || role === 'admin';
  const isGuru = role === 'guru';
  const isMurid = role === 'murid';
  const hasSchoolContext = !!userSchool || !!activeClass;

  // Load available subjects for teacher
  const loadAvailableSubjects = async () => {
    if (!userSchool?.id) return;
    try {
      const res = await apiClient.getSchoolSubjects(userSchool.id);
      if (res.subjects && res.subjects.length > 0) {
        setAvailableSubjects(res.subjects.map((s) => ({ id: s.id, nama: s.nama })));
      } else {
        // Fallback default SMP/SMA mapel
        setAvailableSubjects([
          { id: 'sub_matematika', nama: 'Matematika' },
          { id: 'sub_ipa', nama: 'Ilmu Pengetahuan Alam (IPA)' },
          { id: 'sub_ips', nama: 'Ilmu Pengetahuan Sosial (IPS)' },
          { id: 'sub_bindo', nama: 'Bahasa Indonesia' },
          { id: 'sub_binggris', nama: 'Bahasa Inggris' },
          { id: 'sub_agama', nama: 'Pendidikan Agama & Budi Pekerti' },
          { id: 'sub_pjok', nama: 'PJOK' },
          { id: 'sub_informatika', nama: 'Informatika' },
        ]);
      }
    } catch {
      setAvailableSubjects([
        { id: 'sub_matematika', nama: 'Matematika' },
        { id: 'sub_ipa', nama: 'Ilmu Pengetahuan Alam (IPA)' },
        { id: 'sub_ips', nama: 'Ilmu Pengetahuan Sosial (IPS)' },
        { id: 'sub_bindo', nama: 'Bahasa Indonesia' },
        { id: 'sub_binggris', nama: 'Bahasa Inggris' },
      ]);
    }
    // Set currently selected
    setSelectedSubjectIds(teacherSubjects.map((s) => s.id));
  };

  const handleOpenTeacherSubjects = async () => {
    // Jika sudah ditetapkan (locked):
    // Cek apakah auto_approve_teacher nyala dari sekolah
    if (isTeacherSubjectsLocked && teacherSubjects.length > 0) {
      if (autoApproveTeacher) {
        // Langsung buka modal pilih mapel
        await loadAvailableSubjects();
        setIsSubjectPickerOpen(true);
      } else {
        // Minta kode guru terlebih dahulu
        setUnlockCode('');
        setIsUnlockModalOpen(true);
      }
    } else {
      // Belum ditetapkan: langsung buka
      await loadAvailableSubjects();
      setIsSubjectPickerOpen(true);
    }
  };

  const handleVerifyTeacherCode = async () => {
    if (!unlockCode.trim()) {
      Alert.alert('Perhatian', 'Masukkan kode guru terlebih dahulu.');
      return;
    }
    setUnlocking(true);
    try {
      // Verifikasi kode guru via join school atau verifikasi kode guru
      const res = await apiClient.joinSchool(unlockCode.trim());
      if (res.success) {
        setIsUnlockModalOpen(false);
        await loadAvailableSubjects();
        setIsSubjectPickerOpen(true);
      } else {
        Alert.alert('Gagal', 'Kode guru tidak valid atau sudah kadaluarsa.');
      }
    } catch (e: any) {
      Alert.alert('Gagal', e.message || 'Kode guru tidak valid.');
    } finally {
      setUnlocking(false);
    }
  };

  const handleSaveSubjects = async () => {
    if (selectedSubjectIds.length === 0) {
      Alert.alert('Perhatian', 'Pilih minimal satu mata pelajaran.');
      return;
    }
    setSavingSubjects(true);
    try {
      await saveTeacherSubjects(selectedSubjectIds);
      await refreshTeacherSubjects();
      setIsSubjectPickerOpen(false);
      Alert.alert('Berhasil', 'Mata pelajaran berhasil ditetapkan dan dikunci.');
    } catch (e: any) {
      Alert.alert('Gagal', e.message || 'Gagal menyimpan mata pelajaran.');
    } finally {
      setSavingSubjects(false);
    }
  };

  const toggleSubject = (id: string) => {
    setSelectedSubjectIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const teacherSubjectNames =
    teacherSubjects.length > 0
      ? teacherSubjects.map((s) => s.nama).join(', ')
      : 'Pilih mata pelajaran pengampu';

  const activeFilterCount =
    (filters.jenjang !== 'SEMUA' ? 1 : 0) +
    (filters.status !== 'SEMUA' ? 1 : 0) +
    (filters.zonasiOnly ? 1 : 0) +
    (filters.maxJarakKm < 15 ? 1 : 0);

  // Tampilkan konteks sekolah di baris kedua jika ada konteks sekolah dan bukan di beranda publik murni
  const showSchoolContext =
    hasSchoolContext &&
    activeTab !== 'beranda' &&
    activeTab !== 'profil' &&
    (activeTab !== 'sof' || role === 'sekolah');

  return (
    <View style={styles.header}>
      {/* Brand row + Shortcut Kembali ke Beranda */}
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
            <Text style={styles.brandSubtitle}>
              {showSchoolContext ? (userSchool?.name || 'Portal Sekolah') : 'Titik Akses & Zonasi Sekolah'}
            </Text>
          </View>
        </View>

        {/* Space atas: Tombol Kembali ke Beranda (tampil jika tidak di beranda) */}
        {activeTab !== 'beranda' ? (
          <TouchableOpacity
            onPress={() => setActiveTab('beranda')}
            style={styles.backHomeBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="home" size={14} color="#ffffff" />
            <Text style={styles.backHomeText}>Beranda</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Baris Kedua: Lokasi Titik Acuan Rumah ATAU Modul Sekolah (Murid/Guru/Admin) */}
      <View style={styles.locationRow}>
        {showSchoolContext ? (
          isMurid ? (
            // ── Mode Murid: Kelas Terpilih Statik (Tanpa dropdown pilih kelas, tanpa icon +) ──
            <View style={styles.locationBtn}>
              <Ionicons name="book" size={16} color="#6ee7b7" />
              <View style={styles.locationInfo}>
                <Text style={styles.locationLabel}>Kelas Terpilih:</Text>
                <Text style={styles.locationValue} numberOfLines={1}>
                  {activeClass ? activeClass.name : 'Belum masuk kelas'}
                </Text>
              </View>
            </View>
          ) : isGuru ? (
            // ── Mode Guru: Mata Pelajaran (Bisa pilih >1, lock jika sudah ditetapkan) ──
            <TouchableOpacity
              onPress={handleOpenTeacherSubjects}
              style={styles.locationBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="library" size={16} color="#6ee7b7" />
              <View style={styles.locationInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={styles.locationLabel}>Mata Pelajaran:</Text>
                  {isTeacherSubjectsLocked && teacherSubjects.length > 0 && (
                    <Ionicons name="lock-closed" size={10} color="#a7f3d0" />
                  )}
                </View>
                <Text style={styles.locationValue} numberOfLines={1}>
                  {teacherSubjectNames}
                </Text>
              </View>
              <Feather name="chevron-down" size={14} color="#a7f3d0" />
            </TouchableOpacity>
          ) : (
            // ── Mode Admin / Sekolah: Pemilihan Kelas ──
            <TouchableOpacity
              onPress={() => {
                if (availableClasses.length > 0) {
                  setIsClassPickerOpen(true);
                }
              }}
              style={styles.locationBtn}
              activeOpacity={availableClasses.length > 0 ? 0.7 : 1}
            >
              <Ionicons name="book" size={16} color="#6ee7b7" />
              <View style={styles.locationInfo}>
                <Text style={styles.locationLabel}>Kelas Terpilih:</Text>
                <Text style={styles.locationValue} numberOfLines={1}>
                  {activeClass
                    ? `${activeClass.name} (Aktif)`
                    : availableClasses.length > 0
                    ? `${availableClasses[0].nama} (Ketuk untuk ganti)`
                    : 'Belum ada kelas'}
                </Text>
              </View>
              {availableClasses.length > 1 && <Feather name="chevron-down" size={14} color="#a7f3d0" />}
            </TouchableOpacity>
          )
        ) : (
          // ── Mode Umum / Beranda / Profil: Titik Acuan Rumah ──
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
        )}

        {/* Tombol Kanan:
            - Murid: TIDAK ADA tombol + (kosong / null)
            - Guru: TIDAK ADA tombol + (kosong / null)
            - Sekolah / Admin saat showSchoolContext: Tambah Kelas (+)
            - Mode Umum / Beranda: Filter tombol
        */}
        {showSchoolContext ? (
          isSchoolOrAdmin ? (
            <TouchableOpacity
              onPress={() => setIsCreateClassModalOpen(true)}
              style={styles.plusBtn}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={20} color="#ffffff" />
            </TouchableOpacity>
          ) : null
        ) : (
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
        )}
      </View>

      {/* Modal Masukkan Kode Guru (Saat Mapel Sudah Terkunci) */}
      <Modal visible={isUnlockModalOpen} transparent animationType="fade" onRequestClose={() => setIsUnlockModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="lock-closed" size={18} color="#047857" />
                <Text style={styles.pickerTitle}>Ubah Mata Pelajaran</Text>
              </View>
              <TouchableOpacity onPress={() => setIsUnlockModalOpen(false)}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 12, lineHeight: 18 }}>
              Mata pelajaran pengampu Anda sudah ditetapkan dan terkunci. Masukkan kode guru dari sekolah untuk membuka kunci perubahan, atau minta akun sekolah menyalakan fitur &quot;Setujui Guru Otomatis&quot;.
            </Text>
            <TextInput
              style={{
                backgroundColor: '#f8fafc',
                borderWidth: 1,
                borderColor: '#cbd5e1',
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 14,
                color: '#0f172a',
                marginBottom: 14,
              }}
              placeholder="Masukkan kode guru..."
              placeholderTextColor="#94a3b8"
              value={unlockCode}
              onChangeText={setUnlockCode}
              autoCapitalize="characters"
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={() => setIsUnlockModalOpen(false)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#cbd5e1',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#64748b' }}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleVerifyTeacherCode}
                disabled={unlocking}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 8,
                  backgroundColor: '#047857',
                  alignItems: 'center',
                  opacity: unlocking ? 0.7 : 1,
                }}
              >
                {unlocking ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#ffffff' }}>Verifikasi Kode</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Pemilihan Mata Pelajaran Guru (Bisa pilih > 1) */}
      <Modal visible={isSubjectPickerOpen} transparent animationType="fade" onRequestClose={() => setIsSubjectPickerOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.pickerCard, { maxHeight: '80%' }]}>
            <View style={styles.pickerHeader}>
              <View>
                <Text style={styles.pickerTitle}>Pilih Mata Pelajaran Pengampu</Text>
                <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  Pilih satu atau lebih mata pelajaran yang Anda ajar
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsSubjectPickerOpen(false)}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={availableSubjects}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ gap: 6, paddingVertical: 8 }}
              renderItem={({ item }) => {
                const isSelected = selectedSubjectIds.includes(item.id);
                return (
                  <TouchableOpacity
                    onPress={() => toggleSubject(item.id)}
                    style={[
                      styles.classItemRow,
                      isSelected && styles.classItemRowActive,
                    ]}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={isSelected ? 'checkbox' : 'square-outline'}
                      size={18}
                      color={isSelected ? '#047857' : '#94a3b8'}
                    />
                    <Text
                      style={[
                        styles.classItemName,
                        isSelected && styles.classItemNameActive,
                      ]}
                    >
                      {item.nama}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity
                onPress={() => setIsSubjectPickerOpen(false)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#cbd5e1',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#64748b' }}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveSubjects}
                disabled={savingSubjects}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 8,
                  backgroundColor: '#047857',
                  alignItems: 'center',
                  opacity: savingSubjects ? 0.7 : 1,
                }}
              >
                {savingSubjects ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#ffffff' }}>
                    Tetapkan ({selectedSubjectIds.length}) Mapel
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Quick Class Picker */}
      <Modal visible={isClassPickerOpen} transparent animationType="fade" onRequestClose={() => setIsClassPickerOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Pilih Kelas</Text>
              <TouchableOpacity onPress={() => setIsClassPickerOpen(false)}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={availableClasses}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ gap: 8, paddingVertical: 6 }}
              renderItem={({ item }) => {
                const isSelected = activeClass?.id === item.id;
                return (
                  <TouchableOpacity
                    onPress={() => {
                      setActiveClass({
                        id: item.id,
                        name: item.nama,
                        schoolName: userSchool?.name || 'Sekolah',
                      });
                      setIsClassPickerOpen(false);
                    }}
                    style={[styles.classItemRow, isSelected && styles.classItemRowActive]}
                  >
                    <Ionicons name="book-outline" size={16} color={isSelected ? '#047857' : '#64748b'} />
                    <Text style={[styles.classItemName, isSelected && styles.classItemNameActive]}>
                      {item.nama}
                    </Text>
                    {isSelected && <Ionicons name="checkmark" size={16} color="#047857" />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
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
    color: '#34d399',
    letterSpacing: 0.5,
  },
  brandTitleKITA: {
    fontSize: 17,
    fontWeight: '900',
    color: '#38bdf8',
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    fontSize: 10,
    color: '#a7f3d0',
    fontWeight: '500',
  },

  // Tombol Kembali ke Beranda
  backHomeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#065f46',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#34d399',
  },
  backHomeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
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
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
  },
  locationInfo: {
    flex: 1,
    marginHorizontal: 8,
  },
  locationLabel: {
    fontSize: 9,
    color: '#a7f3d0',
    fontWeight: '500',
  },
  locationValue: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: '600',
  },
  filterBtn: {
    width: 36,
    height: 36,
    backgroundColor: '#065f46',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
    position: 'relative',
  },
  filterBtnActive: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#b45309',
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  filterBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: 'bold',
  },

  // Tombol Tambah Kelas (+)
  plusBtn: {
    width: 36,
    height: 36,
    backgroundColor: '#059669',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#34d399',
  },

  // Picker Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pickerCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    maxHeight: 380,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  pickerTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  classItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
  },
  classItemRowActive: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  classItemName: { fontSize: 13, fontWeight: '600', color: '#334155', flex: 1 },
  classItemNameActive: { color: '#047857', fontWeight: '700' },
});
