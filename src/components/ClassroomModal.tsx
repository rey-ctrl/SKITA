import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const ClassroomView: React.FC = () => {
  const [schoolCode, setSchoolCode] = useState('');
  const [classCode, setClassCode] = useState('');
  const [joined, setJoined] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'tugas' | 'absen'>('tugas');

  const handleJoin = () => {
    if (!schoolCode.trim() || !classCode.trim()) {
      Alert.alert('Perhatian', 'Harap isi Kode Sekolah dan Kode Kelas.');
      return;
    }
    setJoined(true);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Banner */}
      <View style={styles.banner}>
        <View style={styles.bannerHeader}>
          <Ionicons name="school" size={16} color="#c7d2fe" />
          <Text style={styles.bannerTitle}>Portal Kelas & Sekolah</Text>
        </View>
        <Text style={styles.bannerText}>
          Fitur platform kelas terpadu SKITA (PRD Bagian 15): Masuk dengan kode sekolah dan kode kelas untuk mengerjakan tugas dan absensi.
        </Text>
      </View>

      {!joined ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Masuk Ruang Kelas</Text>

          <Text style={styles.inputLabel}>Kode Sekolah</Text>
          <TextInput
            style={styles.input}
            placeholder="cth: SMPN1BGR"
            placeholderTextColor="#94a3b8"
            value={schoolCode}
            onChangeText={(t) => setSchoolCode(t.toUpperCase())}
            autoCapitalize="characters"
          />

          <Text style={styles.inputLabel}>Kode Kelas (dari Guru)</Text>
          <TextInput
            style={styles.input}
            placeholder="cth: 7B-MAT"
            placeholderTextColor="#94a3b8"
            value={classCode}
            onChangeText={(t) => setClassCode(t.toUpperCase())}
            autoCapitalize="characters"
          />

          <TouchableOpacity onPress={handleJoin} style={styles.joinBtn} activeOpacity={0.7}>
            <Text style={styles.joinBtnText}>Masuk Kelas</Text>
          </TouchableOpacity>

          <View style={styles.pdpBadge}>
            <Ionicons name="shield-checkmark" size={12} color="#64748b" />
            <Text style={styles.pdpText}>Perlindungan privasi data murid sesuai UU PDP (PRD 15)</Text>
          </View>
        </View>
      ) : (
        <View style={styles.activeClassBox}>
          {/* Class banner */}
          <View style={styles.classInfoCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.classBadge}>Kelas Aktif</Text>
              <Text style={styles.className}>Kelas 7-B Matematika</Text>
              <Text style={styles.classSub}>SMPN 1 Kota Bogor • Bpk. Haryono, M.Pd</Text>
            </View>
            <TouchableOpacity onPress={() => setJoined(false)} style={styles.exitBtn}>
              <Text style={styles.exitBtnText}>Keluar</Text>
            </TouchableOpacity>
          </View>

          {/* Sub tabs */}
          <View style={styles.subTabRow}>
            <TouchableOpacity
              onPress={() => setActiveSubTab('tugas')}
              style={[styles.subTabBtn, activeSubTab === 'tugas' && styles.subTabBtnActive]}
            >
              <Text style={[styles.subTabText, activeSubTab === 'tugas' && styles.subTabTextActive]}>
                Daftar Tugas (2)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveSubTab('absen')}
              style={[styles.subTabBtn, activeSubTab === 'absen' && styles.subTabBtnActive]}
            >
              <Text style={[styles.subTabText, activeSubTab === 'absen' && styles.subTabTextActive]}>
                Presensi Harian
              </Text>
            </TouchableOpacity>
          </View>

          {activeSubTab === 'tugas' ? (
            <View style={styles.tasksList}>
              <View style={styles.taskCard}>
                <Ionicons name="document-text-outline" size={20} color="#4338ca" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.taskTitle}>Latihan Soal Aljabar Bab 3</Text>
                  <Text style={styles.taskSub}>Batas: Hari ini, 23:59 WIB</Text>
                </View>
                <View style={styles.taskPendingPill}>
                  <Text style={styles.taskPendingText}>Belum Kirim</Text>
                </View>
              </View>

              <View style={styles.taskCard}>
                <Ionicons name="checkmark-done-circle-outline" size={20} color="#047857" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.taskTitle}>Kuis Geometri Segitiga</Text>
                  <Text style={styles.taskSub}>Nilai: 95 / 100</Text>
                </View>
                <View style={styles.taskDonePill}>
                  <Text style={styles.taskDoneText}>Selesai</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.attendanceCard}>
              <Ionicons name="checkmark-circle" size={36} color="#047857" />
              <Text style={styles.attendTitle}>Presensi Hari Ini Telah Terisi</Text>
              <Text style={styles.attendSub}>Tercatat pukul 07:15 WIB (Status: Hadir)</Text>
            </View>
          )}
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
    paddingBottom: 30,
  },
  banner: {
    backgroundColor: '#3730a3',
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
    color: '#e0e7ff',
    lineHeight: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 10,
    height: 40,
    fontSize: 12,
    color: '#0f172a',
    marginBottom: 10,
    fontWeight: '700',
  },
  joinBtn: {
    backgroundColor: '#4338ca',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  joinBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  pdpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 10,
  },
  pdpText: {
    fontSize: 9,
    color: '#64748b',
  },
  activeClassBox: {
    gap: 10,
  },
  classInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#eef2ff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  classBadge: {
    fontSize: 9,
    fontWeight: '700',
    color: '#4338ca',
    textTransform: 'uppercase',
  },
  className: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e1b4b',
    marginTop: 2,
  },
  classSub: {
    fontSize: 10,
    color: '#475569',
    marginTop: 1,
  },
  exitBtn: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  exitBtnText: {
    fontSize: 10,
    color: '#4338ca',
    fontWeight: '600',
  },
  subTabRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  subTabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  subTabBtnActive: {
    backgroundColor: '#eef2ff',
    borderBottomWidth: 2,
    borderBottomColor: '#4338ca',
  },
  subTabText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  subTabTextActive: {
    color: '#4338ca',
    fontWeight: '700',
  },
  tasksList: {
    gap: 6,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  taskTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
  },
  taskSub: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 1,
  },
  taskPendingPill: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  taskPendingText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#92400e',
  },
  taskDonePill: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  taskDoneText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#065f46',
  },
  attendanceCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  attendTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 8,
  },
  attendSub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
});
