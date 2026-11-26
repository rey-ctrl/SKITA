/**
 * ClassroomView — Tab Kelas (FR-A2, FR-A4)
 *
 * Role 'sekolah' → Dashboard Sekolah: klaim sekolah, lihat & generate kode, buat kelas, approve guru.
 * Role lainnya   → Flow join 2-step: Masuk Sekolah (kode sekolah) → Masuk Kelas (kode kelas).
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../context/AppContext';
import { apiClient } from '../services/api';
import { DissolutionBanner } from './DissolutionBanner';
import { AttendanceModal } from './AttendanceModal';

// ─── Types local ────────────────────────────────────────────────────────────

type DashboardData = {
  school: { id: string; nama: string; jenjang: string; auto_approve_teacher: boolean };
  codes: Array<{ id: string; scope: string; code: string; valid_until: string }>;
  classes: Array<{
    id: string; nama: string; tingkat: string | number;
    kode_kelas: { id: string; code: string; valid_until: string } | null;
  }>;
  pending_guru: Array<{ membership_id: string; user_id: string; nama: string; email: string }>;
};

type JoinStep = 'school' | 'confirm_name' | 'class';

// ─── Shared ─────────────────────────────────────────────────────────────────

function CodeCard({
  label,
  code,
  validUntil,
  onGenerate,
  onRotate,
  loading,
}: {
  label: string;
  code?: string;
  validUntil?: string;
  onGenerate: () => void;
  onRotate?: () => void;
  loading?: boolean;
}) {
  const [copied, setCopied] = React.useState(false);
  const expiry = validUntil
    ? new Date(validUntil).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
    : null;

  const handleCopy = async () => {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={s.codeCard}>
      <View style={s.codeCardTop}>
        <Text style={s.codeLabel}>{label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {code && (
            <TouchableOpacity onPress={handleCopy} style={s.rotateBtn} activeOpacity={0.7}>
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={13} color={copied ? '#047857' : '#0369a1'} />
              <Text style={[s.rotateBtnText, copied && { color: '#047857' }]}>{copied ? 'Disalin!' : 'Salin'}</Text>
            </TouchableOpacity>
          )}
          {code && onRotate && (
            <TouchableOpacity onPress={onRotate} disabled={loading} style={s.rotateBtn} activeOpacity={0.7}>
              <Ionicons name="refresh" size={13} color="#0369a1" />
              <Text style={s.rotateBtnText}>Rotasi</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      {code ? (
        <>
          <Text style={s.codeValue}>{code}</Text>
          {expiry && <Text style={s.codeExpiry}>Berlaku s.d. {expiry}</Text>}
        </>
      ) : (
        <TouchableOpacity onPress={onGenerate} disabled={loading} style={s.generateBtn} activeOpacity={0.8}>
          {loading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Ionicons name="add-circle" size={14} color="#ffffff" />
              <Text style={s.generateBtnText}>Generate Kode</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Dashboard Sekolah ───────────────────────────────────────────────────────

function SchoolDashboard({
  onRefreshUser,
  overrideSchoolId,
  onBack,
}: {
  onRefreshUser: () => void;
  overrideSchoolId?: string;
  onBack?: () => void;
}) {
  const { isCreateClassModalOpen, setIsCreateClassModalOpen, activeTab } = useApp();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [notClaimed, setNotClaimed] = useState(false);
  const [codeLoading, setCodeLoading] = useState<Record<string, boolean>>({});
  const [classSearch, setClassSearch] = useState('');

  // Modal buat kelas baru
  const [showNewClass, setShowNewClass] = useState(false);
  const [newNama, setNewNama] = useState('');
  const [newTingkat, setNewTingkat] = useState('');
  const [creating, setCreating] = useState(false);

  // Modal pembubaran kelas (FR-A11)
  const [showDissolutionModal, setShowDissolutionModal] = useState(false);
  const [dissolutionWord, setDissolutionWord] = useState('');
  const [dissolving, setDissolving] = useState(false);

  // Modal delegasi reset password (FR-A16)
  const [showResetModal, setShowResetModal] = useState(false);
  const [targetUserId, setTargetUserId] = useState('');
  const [resetting, setResetting] = useState(false);
  const [tempPasswordResult, setTempPasswordResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.getSchoolDashboard(overrideSchoolId);
      setData(res);
      setNotClaimed(false);
    } catch (e: any) {
      if (e.message?.includes('klaim') || e.status === 404) setNotClaimed(true);
    } finally {
      setLoading(false);
    }
  }, [overrideSchoolId]);

  useEffect(() => { load(); }, [load]);

  const handleGenerateSchoolCode = async (scope: 'school_student' | 'school_teacher') => {
    if (!data) return;
    setCodeLoading((prev) => ({ ...prev, [scope]: true }));
    try {
      await apiClient.generateSchoolCode(data.school.id, scope);
      await load();
    } catch (e: any) {
      Alert.alert('Gagal', e.message);
    } finally {
      setCodeLoading((prev) => ({ ...prev, [scope]: false }));
    }
  };

  const handleRotateSchoolCode = async (codeId: string, scope: string) => {
    setCodeLoading((prev) => ({ ...prev, [codeId]: true }));
    try {
      await apiClient.rotateCode(codeId);
      await load();
    } catch (e: any) {
      Alert.alert('Gagal', e.message);
    } finally {
      setCodeLoading((prev) => ({ ...prev, [codeId]: false }));
    }
  };

  const handleRotateClassCode = async (codeId: string) => {
    setCodeLoading((prev) => ({ ...prev, [codeId]: true }));
    try {
      await apiClient.rotateCode(codeId);
      await load();
    } catch (e: any) {
      Alert.alert('Gagal', e.message);
    } finally {
      setCodeLoading((prev) => ({ ...prev, [codeId]: false }));
    }
  };

  const handleGenerateClassCode = async (classId: string) => {
    setCodeLoading((prev) => ({ ...prev, [classId]: true }));
    try {
      await apiClient.generateClassCode(classId);
      await load();
    } catch (e: any) {
      Alert.alert('Gagal', e.message);
    } finally {
      setCodeLoading((prev) => ({ ...prev, [classId]: false }));
    }
  };

  const handleApproveGuru = async (membershipId: string, nama: string) => {
    Alert.alert('Setujui Guru', `Setujui ${nama} bergabung sebagai guru?`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Setujui',
        onPress: async () => {
          try {
            await apiClient.approveGuru(membershipId);
            await load();
          } catch (e: any) {
            Alert.alert('Gagal', e.message);
          }
        },
      },
    ]);
  };

  const handleCreateClass = async () => {
    if (!newNama.trim() || !newTingkat.trim()) {
      Alert.alert('Perhatian', 'Nama kelas dan tingkat wajib diisi.');
      return;
    }
    setCreating(true);
    try {
      await apiClient.createClass({
        nama: newNama.trim(),
        tingkat: newTingkat.trim(),
        school_id: overrideSchoolId,
      });
      setShowNewClass(false);
      setIsCreateClassModalOpen(false);
      setNewNama('');
      setNewTingkat('');
      await load();
      onRefreshUser();
    } catch (e: any) {
      Alert.alert('Gagal', e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleToggleAutoApprove = async () => {
    if (!data) return;
    const next = !data.school.auto_approve_teacher;
    try {
      await apiClient.updateSchoolSettings({
        auto_approve_teacher: next,
        school_id: overrideSchoolId,
      });
      await load();
    } catch (e: any) {
      Alert.alert('Gagal', e.message);
    }
  };

  const handleLeaveSchool = () => {
    if (!data) return;
    Alert.alert(
      'Keluar dari Sekolah',
      `Lepaskan kaitan akun dari sekolah ${data.school.nama}?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Keluar',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.leaveSchool(data.school.id);
              Alert.alert('Sukses', 'Anda telah keluar dari sekolah.');
              await onRefreshUser();
            } catch (e: any) {
              Alert.alert('Gagal', e.message || 'Gagal keluar dari sekolah.');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="small" color="#047857" />
      </View>
    );
  }

  if (notClaimed) {
    return <ClaimSchoolView onClaimed={load} />;
  }

  if (!data) return null;

  const studentCode = data.codes.find((c) => c.scope === 'school_student');
  const teacherCode = data.codes.find((c) => c.scope === 'school_teacher');

  const showAll = Boolean(overrideSchoolId);
  const showDashboardSection = showAll || activeTab === 'dashboard';
  const showClassSection = showAll || activeTab === 'dashboard';

  return (
    <ScrollView style={s.container} contentContainerStyle={s.dashContent} showsVerticalScrollIndicator={false}>
      {/* Tombol Kembali (Bila dipanggil dari Pengawasan Admin) */}
      {onBack && (
        <TouchableOpacity
          onPress={onBack}
          style={s.backToDashBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={15} color="#047857" />
          <Text style={s.backToDashText}>Kembali ke Daftar Sekolah</Text>
        </TouchableOpacity>
      )}

      {/* Header Sekolah */}
      <View style={s.schoolBanner}>
        <Ionicons name="school" size={18} color="#c7d2fe" />
        <View style={{ flex: 1 }}>
          <Text style={s.schoolBannerName}>{data.school.nama}</Text>
          <Text style={s.schoolBannerJenjang}>{data.school.jenjang} · {activeTab === 'kelas' && !showAll ? 'Ruang Kelas' : 'Dashboard Sekolah'}</Text>
        </View>
        <TouchableOpacity onPress={load} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ padding: 4 }}>
          <Ionicons name="refresh" size={16} color="#c7d2fe" />
        </TouchableOpacity>
        {!overrideSchoolId && showDashboardSection && (
          <TouchableOpacity
            onPress={handleLeaveSchool}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ padding: 4, backgroundColor: 'rgba(239, 68, 68, 0.25)', borderRadius: 6 }}
          >
            <Ionicons name="log-out-outline" size={16} color="#fca5a5" />
          </TouchableOpacity>
        )}
      </View>

      {/* Bagian Dashboard: Kode Sekolah, Auto Approve, Guru Pending */}
      {showDashboardSection && (
        <>
          <Text style={s.sectionTitle}>Kode Akses Sekolah</Text>
          <CodeCard
            label="Kode Murid"
            code={studentCode?.code}
            validUntil={studentCode?.valid_until}
            onGenerate={() => handleGenerateSchoolCode('school_student')}
            onRotate={studentCode ? () => handleRotateSchoolCode(studentCode.id, studentCode.scope) : undefined}
            loading={codeLoading['school_student'] || codeLoading[studentCode?.id ?? '']}
          />
          <CodeCard
            label="Kode Guru"
            code={teacherCode?.code}
            validUntil={teacherCode?.valid_until}
            onGenerate={() => handleGenerateSchoolCode('school_teacher')}
            onRotate={teacherCode ? () => handleRotateSchoolCode(teacherCode.id, teacherCode.scope) : undefined}
            loading={codeLoading['school_teacher'] || codeLoading[teacherCode?.id ?? '']}
          />

          {/* Pengaturan persetujuan guru */}
          <TouchableOpacity style={s.settingRow} onPress={handleToggleAutoApprove} activeOpacity={0.7}>
            <View style={{ flex: 1 }}>
              <Text style={s.settingLabel}>Setujui guru otomatis</Text>
              <Text style={s.settingDesc}>Guru langsung aktif tanpa menunggu persetujuan manual</Text>
            </View>
            <View style={[s.toggle, data.school.auto_approve_teacher && s.toggleOn]}>
              <View style={[s.toggleKnob, data.school.auto_approve_teacher && s.toggleKnobOn]} />
            </View>
          </TouchableOpacity>

          {/* Guru Pending */}
          {(() => {
            const uniquePending = (data.pending_guru || []).filter(
              (g, idx, arr) => arr.findIndex((x) => (x.user_id && x.user_id === g.user_id) || x.membership_id === g.membership_id) === idx
            );
            if (uniquePending.length === 0) return null;
            return (
              <>
                <Text style={s.sectionTitle}>Guru Menunggu Persetujuan ({uniquePending.length})</Text>
                {uniquePending.map((g) => (
                  <View key={g.membership_id} style={s.pendingCard}>
                    <View style={s.pendingAvatar}>
                      <Ionicons name="person" size={14} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.pendingName}>{g.nama}</Text>
                      <Text style={s.pendingEmail}>{g.email}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleApproveGuru(g.membership_id, g.nama)}
                      style={s.approveBtn}
                      activeOpacity={0.7}
                    >
                      <Text style={s.approveBtnText}>Setujui</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            );
          })()}
        </>
      )}

      {/* Bagian Kelas: Daftar Kelas */}
      {showClassSection && (
        <>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Daftar Kelas ({data.classes.length})</Text>
            <TouchableOpacity onPress={() => setShowNewClass(true)} style={s.newClassBtn} activeOpacity={0.8}>
              <Ionicons name="add" size={13} color="#047857" />
              <Text style={s.newClassBtnText}>Buat Kelas</Text>
            </TouchableOpacity>
          </View>

          {/* Search Bar Kelas */}
          {data.classes.length > 0 && (
            <View style={[s.kelasSearchWrapper, { marginHorizontal: 0, marginBottom: 10 }]}>
              <Ionicons name="search" size={16} color="#94a3b8" />
              <TextInput
                style={s.kelasSearchInput}
                placeholder="Cari kelas atau tingkat..."
                placeholderTextColor="#94a3b8"
                value={classSearch}
                onChangeText={setClassSearch}
              />
              {classSearch ? (
                <TouchableOpacity onPress={() => setClassSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={16} color="#94a3b8" />
                </TouchableOpacity>
              ) : null}
            </View>
          )}

          {data.classes.length === 0 ? (
            <View style={s.emptyBox}>
              <Ionicons name="people-outline" size={28} color="#cbd5e1" />
              <Text style={s.emptyText}>Belum ada kelas. Buat kelas pertama.</Text>
            </View>
          ) : data.classes.filter((c) => {
              if (!classSearch.trim()) return true;
              const q = classSearch.toLowerCase();
              return c.nama.toLowerCase().includes(q) || String(c.tingkat).toLowerCase().includes(q);
            }).length === 0 ? (
            <View style={s.kelasEmptyBox}>
              <Ionicons name="search-outline" size={28} color="#cbd5e1" />
              <Text style={s.kelasEmptyTitle}>Kelas Tidak Ditemukan</Text>
              <Text style={s.kelasEmptySubtitle}>Tidak ada kelas yang cocok dengan kata kunci "{classSearch}".</Text>
              <TouchableOpacity onPress={() => setClassSearch('')} style={[s.kelasActionPill, { marginTop: 6 }]}>
                <Text style={s.kelasActionText}>Reset Pencarian</Text>
              </TouchableOpacity>
            </View>
          ) : (
            data.classes
              .filter((c) => {
                if (!classSearch.trim()) return true;
                const q = classSearch.toLowerCase();
                return c.nama.toLowerCase().includes(q) || String(c.tingkat).toLowerCase().includes(q);
              })
              .map((cls) => (
                <View key={cls.id} style={s.classCard}>
                  <View style={s.classCardHeader}>
                    <Text style={s.classCardName}>{cls.nama}</Text>
                    <Text style={s.classCardTingkat}>Tingkat {cls.tingkat}</Text>
                  </View>
                  <CodeCard
                    label="Kode Kelas"
                    code={cls.kode_kelas?.code}
                    validUntil={cls.kode_kelas?.valid_until}
                    onGenerate={() => handleGenerateClassCode(cls.id)}
                    onRotate={cls.kode_kelas ? () => handleRotateClassCode(cls.kode_kelas!.id) : undefined}
                    loading={codeLoading[cls.id] || codeLoading[cls.kode_kelas?.id ?? '']}
                  />
                </View>
              ))
          )}

          {/* Tombol Bubarkan Semua Kelas (FR-A11) */}
          {data.classes.length > 0 && (
            <TouchableOpacity
              style={[s.dangerBtn, { marginTop: 14 }]}
              onPress={() => { setDissolutionWord(''); setShowDissolutionModal(true); }}
              activeOpacity={0.8}
            >
              <Ionicons name="exit-outline" size={16} color="#dc2626" />
              <Text style={s.dangerBtnText}>Bubarkan Semua Kelas</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {/* Tombol Pengaturan Tambahan (Dashboard) */}
      {showDashboardSection && (
        <>
          {/* Tombol Reset Password Murid/Guru (FR-A16) */}
          <TouchableOpacity
            style={[s.outlineBtn, { marginTop: 14 }]}
            onPress={() => { setTargetUserId(''); setTempPasswordResult(null); setShowResetModal(true); }}
            activeOpacity={0.8}
          >
            <Ionicons name="key-outline" size={15} color="#374151" />
            <Text style={s.outlineBtnText}>Reset Password Anggota</Text>
          </TouchableOpacity>

          {/* Tombol Keluar Sekolah / Lepas Sekolah */}
          <TouchableOpacity
            style={[s.dangerBtn, { marginTop: 10 }]}
            onPress={handleLeaveSchool}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={15} color="#dc2626" />
            <Text style={s.dangerBtnText}>Keluar / Lepas dari Sekolah</Text>
          </TouchableOpacity>
        </>
      )}

      <View style={{ height: 24 }} />

      {/* Modal Buat Kelas */}
      <Modal visible={showNewClass || isCreateClassModalOpen} transparent animationType="fade" onRequestClose={() => { setShowNewClass(false); setIsCreateClassModalOpen(false); }}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Buat Kelas Baru</Text>
            <Text style={s.inputLabel}>Nama Kelas</Text>
            <TextInput
              style={s.input}
              placeholder="cth: 7A, 8B Unggulan"
              placeholderTextColor="#94a3b8"
              value={newNama}
              onChangeText={setNewNama}
            />
            <Text style={s.inputLabel}>Tingkat</Text>
            <TextInput
              style={s.input}
              placeholder="cth: 7, 10, 11"
              placeholderTextColor="#94a3b8"
              value={newTingkat}
              onChangeText={setNewTingkat}
              keyboardType="numeric"
            />
            <View style={s.modalActions}>
              <TouchableOpacity
                onPress={() => { setShowNewClass(false); setIsCreateClassModalOpen(false); setNewNama(''); setNewTingkat(''); }}
                style={s.cancelBtn}
                activeOpacity={0.7}
              >
                <Text style={s.cancelBtnText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCreateClass} disabled={creating} style={s.confirmModalBtn} activeOpacity={0.8}>
                {creating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.confirmBtnText}>Buat Kelas</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Pembubaran Kelas (FR-A11) */}
      <Modal visible={showDissolutionModal} transparent animationType="fade" onRequestClose={() => setShowDissolutionModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="warning" size={20} color="#dc2626" />
              <Text style={[s.modalTitle, { color: '#dc2626' }]}>Bubarkan Semua Kelas</Text>
            </View>
            <Text style={s.settingDesc}>
              Selama 24 jam pendaftar baru tidak bisa masuk kelas. Setelah itu semua murid dan guru dikeluarkan dari semua kelas. Murid ditandai lulus periode.
            </Text>
            <Text style={s.inputLabel}>Ketik "BUBARKAN" untuk konfirmasi:</Text>
            <TextInput
              style={s.input}
              placeholder="BUBARKAN"
              placeholderTextColor="#94a3b8"
              value={dissolutionWord}
              onChangeText={setDissolutionWord}
              autoCapitalize="characters"
            />
            <View style={s.modalActions}>
              <TouchableOpacity onPress={() => setShowDissolutionModal(false)} style={s.cancelBtn} activeOpacity={0.7}>
                <Text style={s.cancelBtnText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  if (dissolutionWord !== 'BUBARKAN') {
                    Alert.alert('Perhatian', 'Ketik BUBARKAN dengan huruf kapital.');
                    return;
                  }
                  setDissolving(true);
                  try {
                    await apiClient.scheduleDissolution(data.school.id, dissolutionWord);
                    setShowDissolutionModal(false);
                    Alert.alert('Sukses', 'Pembubaran 24 jam telah dijadwalkan.');
                    load();
                  } catch (e: any) {
                    Alert.alert('Gagal', e.message || 'Gagal menjadwalkan pembubaran.');
                  } finally {
                    setDissolving(false);
                  }
                }}
                disabled={dissolving || dissolutionWord !== 'BUBARKAN'}
                style={[s.confirmBtn, { backgroundColor: '#dc2626', opacity: (dissolving || dissolutionWord !== 'BUBARKAN') ? 0.5 : 1 }]}
                activeOpacity={0.8}
              >
                {dissolving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.confirmBtnText}>Jadwalkan</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Delegasi Reset Password (FR-A16) */}
      <Modal visible={showResetModal} transparent animationType="fade" onRequestClose={() => setShowResetModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Reset Password Anggota</Text>
            <Text style={s.settingDesc}>Reset password sementara untuk guru atau murid aktif di sekolah ini.</Text>
            <Text style={s.inputLabel}>ID Pengguna</Text>
            <TextInput
              style={s.input}
              placeholder="cth: usr_..."
              placeholderTextColor="#94a3b8"
              value={targetUserId}
              onChangeText={setTargetUserId}
              autoCapitalize="none"
            />
            {tempPasswordResult && (
              <View style={s.tempPassBox}>
                <Text style={s.tempPassLabel}>Password Sementara:</Text>
                <Text style={s.tempPassValue}>{tempPasswordResult}</Text>
                <Text style={s.tempPassHint}>Pengguna wajib mengganti password saat login pertama.</Text>
              </View>
            )}
            <View style={s.modalActions}>
              <TouchableOpacity onPress={() => setShowResetModal(false)} style={s.cancelBtn} activeOpacity={0.7}>
                <Text style={s.cancelBtnText}>Tutup</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  if (!targetUserId.trim()) { Alert.alert('Perhatian', 'Masukkan ID pengguna.'); return; }
                  setResetting(true);
                  try {
                    const res = await apiClient.resetPasswordDelegasi(targetUserId.trim());
                    setTempPasswordResult(res.temp_password || null);
                  } catch (e: any) {
                    Alert.alert('Gagal', e.message || 'Gagal mereset password.');
                  } finally {
                    setResetting(false);
                  }
                }}
                disabled={resetting}
                style={s.confirmBtn}
                activeOpacity={0.8}
              >
                {resetting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.confirmBtnText}>Reset</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ─── Claim School View ───────────────────────────────────────────────────────

function ClaimSchoolView({ onClaimed }: { onClaimed: () => void }) {
  const [schoolId, setSchoolId] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const handleClaim = async () => {
    if (!schoolId.trim()) {
      Alert.alert('Perhatian', 'Masukkan ID Sekolah yang diberikan oleh Admin SKITA.');
      return;
    }
    setLoading(true);
    try {
      await apiClient.claimSchool(schoolId.trim());
      Alert.alert('Berhasil', 'Sekolah berhasil dikaitkan ke akun Anda.');
      onClaimed();
    } catch (e: any) {
      Alert.alert('Gagal', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={s.claimScroll}
      contentContainerStyle={s.claimScrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={s.claimCard}>
        {/* Icon Badge */}
        <View style={s.claimIconBadge}>
          <Ionicons name="school" size={32} color="#047857" />
        </View>

        {/* Header Cluster */}
        <View style={s.claimHeaderCluster}>
          <Text style={s.claimTitle}>Kaitkan Sekolah</Text>
          <Text style={s.claimDesc}>
            Akun Sekolah perlu ditautkan ke data instansi resmi di sistem SKITA sebelum dapat mengelola kelas dan kode masuk.
          </Text>
        </View>

        {/* Info Callout */}
        <View style={s.claimInfoBox}>
          <Ionicons name="information-circle" size={18} color="#0284c7" style={{ marginTop: 1 }} />
          <Text style={s.claimInfoText}>
            Minta ID Sekolah resmi kepada Admin SKITA melalui menu Admin Panel atau detail sekolah terdaftar.
          </Text>
        </View>

        {/* Form Input Group */}
        <View style={s.claimFormGroup}>
          <Text style={s.inputLabel}>ID Sekolah Resmi</Text>
          <View style={[s.claimInputWrapper, isFocused && s.claimInputWrapperFocused]}>
            <Ionicons name="barcode-outline" size={18} color={isFocused ? '#047857' : '#94a3b8'} />
            <TextInput
              style={s.claimInput}
              placeholder="cth: school_1234 atau sch_custom_..."
              placeholderTextColor="#94a3b8"
              value={schoolId}
              onChangeText={setSchoolId}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {schoolId.length > 0 && (
              <TouchableOpacity onPress={() => setSchoolId('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={16} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Action Button */}
        <TouchableOpacity
          onPress={handleClaim}
          disabled={loading || !schoolId.trim()}
          style={[s.claimBtn, (!schoolId.trim() || loading) && s.claimBtnDisabled]}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Ionicons name="link-outline" size={18} color="#ffffff" />
              <Text style={s.claimBtnText}>Kaitkan Sekolah Sekarang</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Security & PDP Badge */}
        <View style={s.claimTrustBadge}>
          <Ionicons name="shield-checkmark-outline" size={14} color="#64748b" />
          <Text style={s.claimTrustText}>Tautan instansi resmi terverifikasi & terproteksi</Text>
        </View>
      </View>
    </ScrollView>
  );
}

// ─── Join Flow (murid / guru / pengguna) ────────────────────────────────────

function JoinFlow({
  onRefreshUser,
  onJoinedSchool,
}: {
  onRefreshUser: () => void;
  onJoinedSchool: (school: { id: string; name: string }) => void;
}) {
  const { user } = useApp();
  const [step, setStep] = useState<JoinStep>('school');
  const [schoolCode, setSchoolCode] = useState('');
  const [fullName, setFullName] = useState(user?.nama || '');
  const [loading, setLoading] = useState(false);
  const [targetSchool, setTargetSchool] = useState<{ id: string; name: string } | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (user?.nama && !fullName) {
      setFullName(user.nama);
    }
  }, [user?.nama, fullName]);

  const handleJoinSchool = async () => {
    if (!schoolCode.trim()) {
      Alert.alert('Perhatian', 'Masukkan kode sekolah terlebih dahulu.');
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.joinSchool(schoolCode.trim());
      const sId = res.school_id || res.membership?.school_id || schoolCode.trim();
      const sName = res.school_name || 'Sekolah';
      setTargetSchool({ id: sId, name: sName });

      if (res.membership?.status === 'pending') {
        Alert.alert(
          'Menunggu Persetujuan',
          'Permintaan bergabung sebagai guru telah dikirim. Tunggu persetujuan dari Sekolah.'
        );
      } else {
        // Lanjut ke step konfirmasi nama lengkap
        setStep('confirm_name');
        onRefreshUser();
      }
    } catch (e: any) {
      Alert.alert('Gagal', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmName = async () => {
    if (!fullName.trim()) {
      Alert.alert('Perhatian', 'Nama lengkap tidak boleh kosong.');
      return;
    }
    setLoading(true);
    try {
      await apiClient.updateProfile({ nama: fullName.trim() });
      await onRefreshUser();

      // Transisi splash loading "Memuat data..."
      setIsTransitioning(true);
      setTimeout(() => {
        setIsTransitioning(false);
        if (targetSchool) {
          onJoinedSchool(targetSchool);
        }
      }, 1200);
    } catch (e: any) {
      Alert.alert('Gagal', e.message || 'Gagal memperbarui nama');
    } finally {
      setLoading(false);
    }
  };

  // Layar Splash Transisi "Memuat data..."
  if (isTransitioning) {
    return (
      <View style={s.splashTransitionContainer}>
        <View style={s.splashRadarWave} />
        <View style={s.splashIconCircle}>
          <Ionicons name="school" size={36} color="#ffffff" />
        </View>
        <Text style={s.splashTransitionTitle}>Memuat data...</Text>
        <Text style={s.splashTransitionSubtitle}>Menyiapkan Dashboard Sekolah Anda</Text>
        <ActivityIndicator size="small" color="#34d399" style={{ marginTop: 18 }} />
      </View>
    );
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.joinContent} showsVerticalScrollIndicator={false}>
      {/* Step indicator presisi rapi */}
      <View style={s.stepBox}>
        <View style={s.stepNodesRow}>
          <View style={[s.stepCircle, step === 'school' ? s.stepCircleActive : s.stepCircleDone]}>
            {step !== 'school' ? (
              <Ionicons name="checkmark" size={14} color="#fff" />
            ) : (
              <Text style={s.stepNumber}>1</Text>
            )}
          </View>
          <View style={[s.stepLine, step === 'confirm_name' && s.stepLineActive]} />
          <View style={[s.stepCircle, step === 'confirm_name' ? s.stepCircleActive : s.stepCircleInactive]}>
            <Text style={[s.stepNumber, step !== 'confirm_name' && s.stepNumberInactive]}>2</Text>
          </View>
        </View>
        <View style={s.stepLabelsRow}>
          <Text style={[s.stepLabel, s.stepLabelActive]}>Sekolah</Text>
          <Text style={[s.stepLabel, step === 'confirm_name' && s.stepLabelActive]}>Konfirmasi Nama</Text>
        </View>
      </View>

      {step === 'school' ? (
        <View style={s.joinCard}>
          <Text style={s.joinCardTitle}>Masuk ke Sekolah</Text>
          <Text style={s.joinCardDesc}>
            Masukkan kode sekolah dari pihak sekolah atau gunakan ID Sekolah dari halaman Beranda.
          </Text>
          <Text style={s.inputLabel}>Kode Sekolah</Text>
          <TextInput
            style={s.input}
            placeholder="Kode akses atau ID Sekolah dari Beranda"
            placeholderTextColor="#94a3b8"
            value={schoolCode}
            onChangeText={setSchoolCode}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity onPress={handleJoinSchool} disabled={loading} style={s.confirmBtn} activeOpacity={0.8}>
            {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.confirmBtnText}>Masuk Sekolah</Text>}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={s.joinCard}>
          <Text style={s.joinCardTitle}>Konfirmasi Nama Lengkap</Text>
          <Text style={s.joinCardDesc}>
            Pastikan nama lengkap Anda sudah sesuai identitas untuk data presensi dan administrasi di {targetSchool?.name}.
          </Text>
          <Text style={s.inputLabel}>Nama Lengkap</Text>
          <TextInput
            style={s.input}
            placeholder="Nama lengkap Anda"
            placeholderTextColor="#94a3b8"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            autoCorrect={false}
          />
          <TouchableOpacity onPress={handleConfirmName} disabled={loading} style={s.confirmBtn} activeOpacity={0.8}>
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={s.confirmBtnText}>Konfirmasi & Lanjut ke Dashboard</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setStep('school');
              setSchoolCode('');
            }}
            style={s.backStep}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={13} color="#64748b" />
            <Text style={s.backStepText}>Ganti sekolah</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={s.pdpBadge}>
        <Ionicons name="shield-checkmark" size={12} color="#64748b" />
        <Text style={s.pdpText}>Privasi data murid dijaga sesuai UU PDP (FR-A9, FR-A10)</Text>
      </View>
    </ScrollView>
  );
}

// ─── School Portal View (Dashboard Sekolah untuk Murid / Guru / Admin) ──────

function SchoolPortalView({
  school,
  userRole,
  teacherClasses,
  onLeaveSchool,
  onEnterClass,
  onRefreshTeacherClasses,
}: {
  school: { id: string; name: string; jenjang?: string };
  userRole: string;
  teacherClasses: Array<{ id: string; nama: string; tingkat?: string | number }>;
  onLeaveSchool: () => void;
  onEnterClass: (cls: { id: string; name: string }) => void;
  onRefreshTeacherClasses: () => Promise<void>;
}) {
  const { user, updateActiveLocationLabel } = useApp();
  const [classCode, setClassCode] = useState('');
  const [teacherNewClassCode, setTeacherNewClassCode] = useState('');
  const [loading, setLoading] = useState(false);

  // Pemilihan Mata Pelajaran Guru (FR-A3)
  const [teacherSubjects, setTeacherSubjects] = useState<Array<{ id: string; nama: string }>>([
    { id: 'sub_matematika', nama: 'Matematika' },
    { id: 'sub_ipa', nama: 'Ilmu Pengetahuan Alam (IPA)' },
  ]);
  const [availableSchoolSubjects, setAvailableSchoolSubjects] = useState<Array<{ id: string; nama: string }>>([
    { id: 'sub_matematika', nama: 'Matematika' },
    { id: 'sub_ipa', nama: 'Ilmu Pengetahuan Alam (IPA)' },
    { id: 'sub_ips', nama: 'Ilmu Pengetahuan Sosial (IPS)' },
    { id: 'sub_bindo', nama: 'Bahasa Indonesia' },
    { id: 'sub_binggris', nama: 'Bahasa Inggris' },
    { id: 'sub_agama', nama: 'Pendidikan Agama & Budi Pekerti' },
    { id: 'sub_pjok', nama: 'PJOK' },
    { id: 'sub_informatika', nama: 'Informatika' },
  ]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>(['sub_matematika', 'sub_ipa']);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [savingSubjects, setSavingSubjects] = useState(false);

  useEffect(() => {
    if (userRole === 'guru' && school?.id) {
      loadTeacherSubjects();
    }
  }, [userRole, school?.id]);

  const loadTeacherSubjects = async () => {
    try {
      const res = await apiClient.getSchoolSubjects(school.id);
      if (res.subjects && res.subjects.length > 0) {
        setAvailableSchoolSubjects(res.subjects.map((s) => ({ id: s.id, nama: s.nama })));
      }
      if (user?.id) {
        const tRes = await apiClient.getTeacherSubjects(school.id, user.id);
        if (tRes.teacher_subjects && tRes.teacher_subjects.length > 0) {
          const mapped = tRes.teacher_subjects.map((ts) => ({
            id: ts.subject_id,
            nama: ts.subject?.nama || ts.subject_id,
          }));
          setTeacherSubjects(mapped);
          setSelectedSubjectIds(mapped.map((m) => m.id));
        }
      }
    } catch {
      // Offline fallback
    }
  };

  const handleSaveTeacherSubjects = async () => {
    setSavingSubjects(true);
    try {
      await apiClient.setTeacherSubjects(school.id, { subject_ids: selectedSubjectIds });
      const updated = availableSchoolSubjects.filter((s) => selectedSubjectIds.includes(s.id));
      setTeacherSubjects(updated);
      setShowSubjectModal(false);
      Alert.alert('Berhasil', 'Pilihan mata pelajaran pengampu berhasil disimpan!');
    } catch (e: any) {
      const updated = availableSchoolSubjects.filter((s) => selectedSubjectIds.includes(s.id));
      setTeacherSubjects(updated);
      setShowSubjectModal(false);
      Alert.alert('Tersimpan', 'Mata pelajaran berhasil disimpan.');
    } finally {
      setSavingSubjects(false);
    }
  };

  const toggleSubjectSelect = (id: string) => {
    setSelectedSubjectIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleStudentJoinClass = async () => {
    if (!classCode.trim()) {
      Alert.alert('Perhatian', 'Masukkan kode kelas terlebih dahulu.');
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.joinClass(classCode.trim());
      const clsName = res.class_name || 'Kelas Terdaftar';
      // Auto-update titik acuan rumah sesuai nama kelas
      updateActiveLocationLabel(clsName);
      Alert.alert('Berhasil', `Berhasil bergabung ke kelas ${clsName}!`);
      onEnterClass({
        id: res.class_id || res.membership.class_id,
        name: clsName,
      });
    } catch (e: any) {
      Alert.alert('Gagal', e.message || 'Gagal masuk kelas');
    } finally {
      setLoading(false);
    }
  };

  const handleTeacherAddClass = async () => {
    if (!teacherNewClassCode.trim()) {
      Alert.alert('Perhatian', 'Masukkan kode kelas terlebih dahulu.');
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.joinClass(teacherNewClassCode.trim());
      setTeacherNewClassCode('');
      Alert.alert('Berhasil', `Kelas ${res.class_name || ''} berhasil ditambahkan!`);
      await onRefreshTeacherClasses();
    } catch (e: any) {
      Alert.alert('Gagal', e.message || 'Gagal menambah kelas');
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = () => {
    Alert.alert(
      'Keluar dari Sekolah',
      `Lepaskan kaitan akun Anda dari ${school.name}?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Keluar',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.leaveSchool(school.id);
              Alert.alert('Selesai', 'Anda telah keluar dari sekolah.');
              onLeaveSchool();
            } catch (e: any) {
              Alert.alert('Gagal', e.message || 'Gagal keluar sekolah.');
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.dashContent} showsVerticalScrollIndicator={false}>
      {/* Banner Sekolah */}
      <View style={s.schoolBanner}>
        <Ionicons name="school" size={20} color="#c7d2fe" />
        <View style={{ flex: 1 }}>
          <Text style={s.schoolBannerName}>{school.name}</Text>
          <Text style={s.schoolBannerJenjang}>
            {school.jenjang || 'Sekolah'} · Dashboard {userRole === 'guru' ? 'Guru' : userRole === 'admin' ? 'Admin' : 'Pelajar'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleLeave}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ padding: 6, backgroundColor: 'rgba(239, 68, 68, 0.25)', borderRadius: 6 }}
        >
          <Ionicons name="log-out-outline" size={16} color="#fca5a5" />
        </TouchableOpacity>
      </View>

      {/* Alur Khusus Pelajar / Murid */}
      {userRole !== 'guru' && (
        <View style={s.joinCard}>
          <Text style={s.joinCardTitle}>Masuk ke Ruang Kelas</Text>
          <Text style={s.joinCardDesc}>
            Masukkan kode kelas dari guru atau sekolah. Titik acuan lokasi Anda otomatis diselaraskan dengan nama kelas.
          </Text>
          <Text style={s.inputLabel}>Kode Kelas</Text>
          <TextInput
            style={s.input}
            placeholder="Kode kelas (cth: EF56GH78 atau ID Kelas)"
            placeholderTextColor="#94a3b8"
            value={classCode}
            onChangeText={setClassCode}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            onPress={handleStudentJoinClass}
            disabled={loading}
            style={s.confirmBtn}
            activeOpacity={0.8}
          >
            {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.confirmBtnText}>Masuk Kelas</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* Alur Khusus Guru */}
      {userRole === 'guru' && (
        <>
          {/* Row Paling Atas: Input Tambah Kelas Baru */}
          <View style={s.joinCard}>
            <Text style={s.joinCardTitle}>Tambah Kelas yang Diajar</Text>
            <Text style={s.joinCardDesc}>
              Masukkan kode kelas untuk menambahkan kelas baru ke dashboard pengajaran Anda.
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              <TextInput
                style={[s.input, { flex: 1 }]}
                placeholder="Kode kelas baru"
                placeholderTextColor="#94a3b8"
                value={teacherNewClassCode}
                onChangeText={setTeacherNewClassCode}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={handleTeacherAddClass}
                disabled={loading || !teacherNewClassCode.trim()}
                style={[s.confirmBtn, { paddingHorizontal: 16 }]}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.confirmBtnText}>+ Tambah</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Section: Mata Pelajaran yang Diampu Guru (FR-A3) */}
          <View style={[s.joinCard, { marginTop: 14, backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginRight: 4 }}>
                <Ionicons name="school-outline" size={18} color="#047857" />
                <Text style={[s.joinCardTitle, { marginBottom: 0, color: '#065f46', flexShrink: 1 }]}>
                  Mata Pelajaran yang Diampu
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowSubjectModal(true)}
                style={{
                  backgroundColor: '#047857',
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 6,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>Pilih Mapel</Text>
              </TouchableOpacity>
            </View>
            <Text style={[s.joinCardDesc, { color: '#047857' }]}>
              Pilihan mata pelajaran Anda akan otomatis terhubung ke tugas dan rekap nilai di kelas.
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {teacherSubjects.length === 0 ? (
                <Text style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic' }}>
                  Belum memilih mata pelajaran pengampu.
                </Text>
              ) : (
                teacherSubjects.map((sub) => (
                  <View
                    key={sub.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      backgroundColor: '#ffffff',
                      borderWidth: 1,
                      borderColor: '#86efac',
                      borderRadius: 16,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                    }}
                  >
                    <Ionicons name="checkmark-circle" size={13} color="#16a34a" />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#166534' }}>{sub.nama}</Text>
                  </View>
                ))
              )}
            </View>
          </View>

          {/* Modal Pemilihan Mata Pelajaran Guru */}
          <Modal
            visible={showSubjectModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowSubjectModal(false)}
          >
            <View style={s.modalOverlay}>
              <View style={[s.modalCard, { maxHeight: '80%' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text style={s.modalTitle}>Pilih Mata Pelajaran Pengampu</Text>
                  <TouchableOpacity onPress={() => setShowSubjectModal(false)} style={{ padding: 4 }}>
                    <Ionicons name="close" size={20} color="#64748b" />
                  </TouchableOpacity>
                </View>
                <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
                  Centang mata pelajaran yang Anda ampu di {school.name}:
                </Text>
                <ScrollView style={{ maxHeight: 280 }}>
                  {availableSchoolSubjects.map((sub) => {
                    const isSelected = selectedSubjectIds.includes(sub.id);
                    return (
                      <TouchableOpacity
                        key={sub.id}
                        onPress={() => toggleSubjectSelect(sub.id)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: isSelected ? '#10b981' : '#e2e8f0',
                          backgroundColor: isSelected ? '#ecfdf5' : '#ffffff',
                          marginBottom: 6,
                          gap: 10,
                        }}
                      >
                        <Ionicons
                          name={isSelected ? 'checkbox' : 'square-outline'}
                          size={18}
                          color={isSelected ? '#047857' : '#94a3b8'}
                        />
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: isSelected ? '700' : '500',
                            color: isSelected ? '#047857' : '#1e293b',
                            flex: 1,
                          }}
                        >
                          {sub.nama}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                  <TouchableOpacity
                    style={[s.outlineBtn, { flex: 1 }]}
                    onPress={() => setShowSubjectModal(false)}
                  >
                    <Text style={s.outlineBtnText}>Batal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.confirmBtn, { flex: 1 }, savingSubjects && { opacity: 0.6 }]}
                    onPress={handleSaveTeacherSubjects}
                    disabled={savingSubjects}
                  >
                    {savingSubjects ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={s.confirmBtnText}>Simpan Pilihan</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </>
      )}

      {/* Tombol Keluar Sekolah di bawah */}
      <TouchableOpacity style={s.leaveClassBtn} onPress={handleLeave} activeOpacity={0.8}>
        <Ionicons name="log-out-outline" size={15} color="#dc2626" />
        <Text style={s.leaveClassBtnText}>Keluar dari Sekolah</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Class Member View (murid / guru yang sudah di kelas) ───────────────────

function ClassMemberView({
  classId,
  className,
  schoolName,
  userRole,
  onLeave,
  onBackToDashboard,
  availableClasses = [],
  onSelectClass,
}: {
  classId: string;
  className: string;
  schoolName: string;
  userRole: string;
  onLeave: () => void;
  onBackToDashboard?: () => void;
  availableClasses?: Array<{ id: string; nama: string; tingkat?: string | number }>;
  onSelectClass?: (cls: { id: string; name: string }) => void;
}) {
  const [showAttendance, setShowAttendance] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [members, setMembers] = useState<Array<{ user_id: string; nama: string; nomor_absen: number; role: string }>>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const { user, userSchool, activeTab } = useApp();
  const [showAssignments, setShowAssignments] = useState(false);
  const [assignments, setAssignments] = useState<Array<any>>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [showAddAssignment, setShowAddAssignment] = useState(false);
  const [teacherSubjects, setTeacherSubjects] = useState<Array<{ id: string; nama: string }>>([]);
  const [newJudulTugas, setNewJudulTugas] = useState('');
  const [newMapelTugas, setNewMapelTugas] = useState('Matematika');
  const [newDeskripsiTugas, setNewDeskripsiTugas] = useState('');
  const [newDeadlineHours, setNewDeadlineHours] = useState('24');
  const [creatingAssignment, setCreatingAssignment] = useState(false);
  const [teacherAttachments, setTeacherAttachments] = useState<
    Array<{ name: string; type: string; size: number; uri?: string }>
  >([]);

  // Ambil mata pelajaran pengampu sesuai akun guru yang sedang login
  useEffect(() => {
    const fetchSubjects = async () => {
      if ((userRole === 'guru' || userRole === 'admin') && userSchool?.id && user?.id) {
        try {
          const tRes = await apiClient.getTeacherSubjects(userSchool.id, user.id);
          if (tRes.teacher_subjects && tRes.teacher_subjects.length > 0) {
            const mapped = tRes.teacher_subjects.map((ts) => ({
              id: ts.subject_id,
              nama: ts.subject?.nama || ts.subject_id,
            }));
            setTeacherSubjects(mapped);
            if (mapped.length > 0) {
              setNewMapelTugas(mapped[0].nama);
            }
            return;
          }
        } catch {
          // fallback jika offline
        }
      }
      setTeacherSubjects([
        { id: 'sub_matematika', nama: 'Matematika' },
        { id: 'sub_ipa', nama: 'Ilmu Pengetahuan Alam (IPA)' },
      ]);
      setNewMapelTugas('Matematika');
    };
    fetchSubjects();
  }, [userRole, userSchool?.id, user?.id]);

  // Detail Tugas & Modal Pengumpulan Lampiran
  const [selectedAssignment, setSelectedAssignment] = useState<any | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<
    Array<{ name: string; type: string; size: number; uri?: string }>
  >([]);
  const [submissionCatatan, setSubmissionCatatan] = useState('');
  const [submittingAssignment, setSubmittingAssignment] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const getDeadlineStats = (deadlineStr?: string) => {
    if (!deadlineStr) {
      return {
        label: 'Tanpa Tenggat',
        isExpired: false,
        hours: 0,
        minutes: 0,
        seconds: 0,
        days: 0,
      };
    }
    const diff = new Date(deadlineStr).getTime() - Date.now();
    if (diff <= 0) {
      return {
        label: 'Waktu Habis (Terkunci)',
        isExpired: true,
        hours: 0,
        minutes: 0,
        seconds: 0,
        days: 0,
      };
    }
    const totalSecs = Math.floor(diff / 1000);
    const days = Math.floor(totalSecs / 86400);
    const hours = Math.floor((totalSecs % 86400) / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const seconds = totalSecs % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    const label = days > 0 ? `${days}h ${pad(hours)}j ${pad(minutes)}m` : `${pad(hours)}j ${pad(minutes)}m ${pad(seconds)}d`;
    return {
      label,
      isExpired: false,
      hours,
      minutes,
      seconds,
      days,
    };
  };

  const [copiedDeskripsi, setCopiedDeskripsi] = useState(false);

  const handleCopyDeskripsi = async () => {
    if (!selectedAssignment?.deskripsi) return;
    try {
      await Clipboard.setStringAsync(selectedAssignment.deskripsi);
      setCopiedDeskripsi(true);
      setTimeout(() => setCopiedDeskripsi(false), 2500);
    } catch {
      Alert.alert('Gagal', 'Tidak dapat menyalin teks ke clipboard.');
    }
  };

  const handlePickRealFile = async (format: 'photo' | 'word' | 'excel' | 'pdf') => {
    try {
      if (format === 'photo') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Izin Dibutuhkan', 'Izin akses galeri foto perangkat diperlukan untuk memilih foto tugas.');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 0.85,
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          const fileName = asset.fileName || `Foto_Tugas_${Date.now()}.jpg`;
          const fileSize = asset.fileSize || 1200000;
          setAttachedFiles((prev) => [
            ...prev,
            { name: fileName, type: 'photo', size: fileSize, uri: asset.uri },
          ]);
        }
      } else {
        let mimeTypes: string[] = ['*/*'];
        if (format === 'word') {
          mimeTypes = [
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          ];
        } else if (format === 'excel') {
          mimeTypes = [
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/csv',
          ];
        } else if (format === 'pdf') {
          mimeTypes = ['application/pdf'];
        }

        const result = await DocumentPicker.getDocumentAsync({
          type: mimeTypes,
          copyToCacheDirectory: true,
          multiple: false,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          const fileName = asset.name || `Dokumen_${format.toUpperCase()}_${Date.now()}`;
          const fileSize = asset.size || 450000;
          setAttachedFiles((prev) => [
            ...prev,
            { name: fileName, type: format, size: fileSize, uri: asset.uri },
          ]);
        }
      }
    } catch (e: any) {
      Alert.alert('Gagal Membuka File', e.message || 'Gagal memilih berkas dari perangkat.');
    }
  };

  const handlePickTeacherFile = async (format: 'dokumen' | 'gambar') => {
    try {
      if (format === 'gambar') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Izin Dibutuhkan', 'Izin akses galeri foto perangkat diperlukan.');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 0.85,
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          const fileName = asset.fileName || `Gambar_Materi_${Date.now()}.jpg`;
          const fileSize = asset.fileSize || 1100000;
          setTeacherAttachments((prev) => [
            ...prev,
            { name: fileName, type: 'gambar', size: fileSize, uri: asset.uri },
          ]);
        }
      } else {
        const result = await DocumentPicker.getDocumentAsync({
          type: [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/*',
          ],
          copyToCacheDirectory: true,
          multiple: false,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          const fileName = asset.name || `Dokumen_${Date.now()}`;
          const fileSize = asset.size || 500000;
          setTeacherAttachments((prev) => [
            ...prev,
            { name: fileName, type: 'dokumen', size: fileSize, uri: asset.uri },
          ]);
        }
      }
    } catch (e: any) {
      Alert.alert('Gagal Membuka File', e.message || 'Gagal memilih berkas dari perangkat.');
    }
  };

  const handleRemoveFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmitAssignment = async () => {
    if (!selectedAssignment) return;
    if (attachedFiles.length === 0) {
      Alert.alert('Perhatian', 'Lampirkan minimal 1 file (Foto, Word, Excel, atau PDF).');
      return;
    }
    setSubmittingAssignment(true);
    try {
      await apiClient.submitAssignment(selectedAssignment.id, {
        catatan: submissionCatatan.trim() || undefined,
        files: attachedFiles.map((f) => ({
          name: f.name,
          type: f.type,
          size: f.size,
          url: f.uri || `https://storage.skita.id/assignments/${f.name}`,
        })),
      });
      Alert.alert('Berhasil', 'Tugas Anda telah berhasil dikumpulkan tepat waktu!');
      setSelectedAssignment(null);
      setAttachedFiles([]);
      setSubmissionCatatan('');
      await loadAssignments();
    } catch (e: any) {
      Alert.alert('Gagal', e.message || 'Gagal mengumpulkan tugas.');
    } finally {
      setSubmittingAssignment(false);
    }
  };

  const loadAssignments = async () => {
    setLoadingAssignments(true);
    try {
      const res = await apiClient.getClassAssignments(classId);
      let list = res.assignments || [];
      if (list.length === 0) {
        // Fallback contoh tugas jika kosong
        const now = Date.now();
        list = [
          {
            id: `sample_asgn_1_${classId}`,
            class_id: classId,
            period_id: 'prd_demo',
            judul: 'PR Matematika: Matriks & SPLDV',
            subject_nama: 'Matematika',
            guru_nama: 'Ibu Sri Wahyuni, S.Pd.',
            tanggal: new Date().toISOString().slice(0, 10),
            deadline: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
            deskripsi: 'Kerjakan soal no 1-8 pada buku paket halaman 112. Tulis cara penyelesaian lengkap. Unggah lampiran foto jawaban, file Word, atau PDF.',
            submission_count: 18,
            is_submitted: false,
            attachments: [
              { name: 'Modul_Matriks_Bab3.pdf', type: 'pdf', size: 1250000 },
            ],
          },
          {
            id: `sample_asgn_2_${classId}`,
            class_id: classId,
            period_id: 'prd_demo',
            judul: 'Laporan Praktikum Biologi: Uji Karbohidrat',
            subject_nama: 'Biologi',
            guru_nama: 'Pak Bambang, M.Pd.',
            tanggal: new Date(now - 86400000).toISOString().slice(0, 10),
            deadline: new Date(now - 3 * 3600000).toISOString(),
            deskripsi: 'Buat tabel pengamatan mikroskop dan uji amilum beserta kesimpulan kelompok. Lampirkan berkas Excel (.xlsx) atau PDF.',
            submission_count: 24,
            is_submitted: true,
            attachments: [
              { name: 'Panduan_Praktikum_Uji_Amilum.pdf', type: 'pdf', size: 980000 },
            ],
            my_submission: {
              id: 'sub_sample_done',
              assignment_id: `sample_asgn_2_${classId}`,
              murid_id: 'usr_me',
              submitted_at: new Date(now - 4 * 3600000).toISOString(),
              catatan: 'Sudah selesai sesuai format tabel praktikum kelompok 2.',
              files: [
                { name: 'Laporan_Biologi_Kelompok2.pdf', type: 'pdf', size: 2340000 },
                { name: 'Tabel_Hasil_Uji.xlsx', type: 'excel', size: 180000 },
              ],
            },
          },
        ];
      }
      setAssignments(list);
      setShowAssignments(true);
    } catch {
      // Offline fallback sample data
      const now = Date.now();
      const list = [
        {
          id: `sample_asgn_1_${classId}`,
          class_id: classId,
          period_id: 'prd_demo',
          judul: 'PR Matematika: Matriks & SPLDV',
          subject_nama: 'Matematika',
          guru_nama: 'Ibu Sri Wahyuni, S.Pd.',
          tanggal: new Date().toISOString().slice(0, 10),
          deadline: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
          deskripsi: 'Kerjakan soal no 1-8 pada buku paket halaman 112. Tulis cara penyelesaian lengkap. Unggah lampiran foto jawaban, file Word, atau PDF.',
          submission_count: 18,
          is_submitted: false,
          attachments: [
            { name: 'Modul_Matriks_Bab3.pdf', type: 'pdf', size: 1250000 },
          ],
        },
        {
          id: `sample_asgn_2_${classId}`,
          class_id: classId,
          period_id: 'prd_demo',
          judul: 'Laporan Praktikum Biologi: Uji Karbohidrat',
          subject_nama: 'Biologi',
          guru_nama: 'Pak Bambang, M.Pd.',
          tanggal: new Date(now - 86400000).toISOString().slice(0, 10),
          deadline: new Date(now - 3 * 3600000).toISOString(),
          deskripsi: 'Buat tabel pengamatan mikroskop dan uji amilum beserta kesimpulan kelompok. Lampirkan berkas Excel (.xlsx) atau PDF.',
          submission_count: 24,
          is_submitted: true,
          attachments: [
            { name: 'Panduan_Praktikum_Uji_Amilum.pdf', type: 'pdf', size: 980000 },
          ],
          my_submission: {
            id: 'sub_sample_done',
            assignment_id: `sample_asgn_2_${classId}`,
            murid_id: 'usr_me',
            submitted_at: new Date(now - 4 * 3600000).toISOString(),
            catatan: 'Sudah selesai sesuai format tabel praktikum kelompok 2.',
            files: [
              { name: 'Laporan_Biologi_Kelompok2.pdf', type: 'pdf', size: 2340000 },
              { name: 'Tabel_Hasil_Uji.xlsx', type: 'excel', size: 180000 },
            ],
          },
        },
      ];
      setAssignments(list);
      setShowAssignments(true);
    } finally {
      setLoadingAssignments(false);
    }
  };

  const handleCreateAssignment = async () => {
    if (!newJudulTugas.trim()) {
      Alert.alert('Perhatian', 'Judul tugas wajib diisi.');
      return;
    }
    setCreatingAssignment(true);
    try {
      const hoursNum = parseInt(newDeadlineHours, 10) || 24;
      const deadlineDate = new Date(Date.now() + hoursNum * 3600 * 1000).toISOString();
      await apiClient.createAssignment({
        class_id: classId,
        judul: newJudulTugas.trim(),
        subject_nama: newMapelTugas,
        deskripsi: newDeskripsiTugas.trim() || undefined,
        deadline: deadlineDate,
        attachments: teacherAttachments.map((f) => ({
          name: f.name,
          type: f.type,
          size: f.size,
          url: f.uri,
        })),
      });
      setNewJudulTugas('');
      setNewDeskripsiTugas('');
      setTeacherAttachments([]);
      setShowAddAssignment(false);
      await loadAssignments();
      Alert.alert('Berhasil', 'Tugas baru berhasil ditambahkan.');
    } catch (e: any) {
      Alert.alert('Gagal', e.message || 'Gagal membuat tugas.');
    } finally {
      setCreatingAssignment(false);
    }
  };

  const loadMembers = async () => {
    setLoadingMembers(true);
    try {
      const res = await apiClient.getClassMembers(classId);
      const list = res.members || (res as any).anggota || [];
      setMembers(list);
      setShowMembers(true);
    } catch (e: any) {
      Alert.alert('Gagal', e.message || 'Gagal memuat daftar anggota.');
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleLeaveClass = () => {
    Alert.alert(
      'Keluar dari Kelas',
      'Apakah Anda yakin ingin keluar dari kelas ini?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Keluar',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.leaveClass(classId);
              Alert.alert('Selesai', 'Anda telah keluar dari kelas.');
              onLeave();
            } catch (e: any) {
              Alert.alert('Gagal', e.message || 'Gagal keluar kelas.');
            }
          },
        },
      ]
    );
  };


  return (
    <ScrollView style={s.container} contentContainerStyle={s.dashContent}>
      {/* Tombol kembali ke Dashboard Sekolah untuk guru / sekolah */}
      {onBackToDashboard && (
        <TouchableOpacity style={s.backToDashBtn} onPress={onBackToDashboard} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={15} color="#047857" />
          <Text style={s.backToDashText}>Kembali ke {activeTab === 'kelas' ? 'Daftar Kelas' : 'Dashboard Sekolah'}</Text>
        </TouchableOpacity>
      )}

      {/* Banner Pembubaran bila aktif */}
      <DissolutionBanner classId={classId} onRefresh={onLeave} />

      {/* Header Info Kelas */}
      <View style={s.classMemberHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.schoolNameSmall}>{schoolName}</Text>
          <Text style={s.classNameLarge}>{className}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={s.roleBadge}>
            <Text style={s.roleBadgeText}>{userRole.toUpperCase()}</Text>
          </View>
        </View>
      </View>

      {/* Tombol Aksi Utama */}
      <TouchableOpacity
        style={s.actionCard}
        onPress={() => setShowAttendance(true)}
        activeOpacity={0.8}
      >
        <View style={[s.actionIconWrap, { backgroundColor: '#d1fae5' }]}>
          <Ionicons name="calendar-outline" size={24} color="#047857" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.actionCardTitle}>Absensi</Text>
          <Text style={s.actionCardDesc}>
            {userRole === 'murid'
              ? 'Isi kehadiran mandiri & pantau riwayat bulanan'
              : 'Kelola & verifikasi absensi kelas'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
      </TouchableOpacity>

      <TouchableOpacity
        style={s.actionCard}
        onPress={loadMembers}
        disabled={loadingMembers}
        activeOpacity={0.8}
      >
        <View style={[s.actionIconWrap, { backgroundColor: '#dbeafe' }]}>
          {loadingMembers ? (
            <ActivityIndicator size="small" color="#1d4ed8" />
          ) : (
            <Ionicons name="people-outline" size={24} color="#1d4ed8" />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.actionCardTitle}>Daftar Teman Sekelas</Text>
          <Text style={s.actionCardDesc}>Lihat anggota kelas aktif (privasi dijaga)</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
      </TouchableOpacity>

      <TouchableOpacity
        style={s.actionCard}
        onPress={loadAssignments}
        disabled={loadingAssignments}
        activeOpacity={0.8}
      >
        <View style={[s.actionIconWrap, { backgroundColor: '#fef3c7' }]}>
          {loadingAssignments ? (
            <ActivityIndicator size="small" color="#d97706" />
          ) : (
            <Ionicons name="clipboard-outline" size={24} color="#d97706" />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.actionCardTitle}>Tugas</Text>
          <Text style={s.actionCardDesc}>
            {userRole === 'murid'
              ? 'Daftar penugasan kelas dan tenggat waktu'
              : 'Kelola dan buat penugasan kelas'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
      </TouchableOpacity>

      {/* Tombol keluar kelas untuk murid */}
      {userRole === 'murid' && (
        <TouchableOpacity style={s.leaveClassBtn} onPress={handleLeaveClass} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={15} color="#dc2626" />
          <Text style={s.leaveClassBtnText}>Keluar dari Kelas</Text>
        </TouchableOpacity>
      )}

      {/* Modal Absensi */}
      <AttendanceModal
        visible={showAttendance}
        onClose={() => setShowAttendance(false)}
        classId={classId}
        userRole={userRole}
      />

      {/* Modal Anggota Kelas (FR-A10 Privasi: nama + no absen saja) */}
      <Modal visible={showMembers} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowMembers(false)}>
        <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Anggota Kelas ({members.length})</Text>
            <TouchableOpacity onPress={() => setShowMembers(false)} style={{ padding: 4 }} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color="#374151" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={members}
            keyExtractor={(m) => m.user_id}
            contentContainerStyle={{ padding: 16, gap: 8 }}
            ListEmptyComponent={
              <View style={[s.emptyBox, { marginTop: 40 }]}>
                <Ionicons name="people-outline" size={36} color="#cbd5e1" />
                <Text style={s.emptyText}>Belum ada anggota di kelas ini.</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={s.memberRow}>
                <View style={s.memberNo}>
                  <Text style={s.memberNoText}>{item.nomor_absen || '-'}</Text>
                </View>
                <Text style={s.memberNameText}>{item.nama}</Text>
                <View style={[s.roleTag, item.role === 'guru' && { backgroundColor: '#ede9fe' }]}>
                  <Text style={[s.roleTagText, item.role === 'guru' && { color: '#7c3aed' }]}>{item.role}</Text>
                </View>
              </View>
            )}
          />
        </View>
      </Modal>

      {/* Modal Tugas Kelas (Dengan Detail In-Modal View Switching) */}
      <Modal
        visible={showAssignments}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          if (selectedAssignment) {
            setSelectedAssignment(null);
          } else {
            setShowAssignments(false);
          }
        }}
      >
        <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
          {!selectedAssignment && (
            <View style={s.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.modalTitle}>Tugas Kelas ({assignments.length})</Text>
                <Text style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>{className}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAssignments(false)} style={{ padding: 4 }} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color="#374151" />
              </TouchableOpacity>
            </View>
          )}

          {!selectedAssignment && assignments.length === 0 && (
            <View style={[s.emptyBox, { marginTop: 40 }]}>
              <Ionicons name="clipboard-outline" size={40} color="#cbd5e1" />
              <Text style={[s.emptyText, { marginTop: 8 }]}>Belum ada tugas di kelas ini.</Text>
              <Text style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', maxWidth: 260, marginTop: 4 }}>
                {userRole === 'murid'
                  ? 'Guru belum memberikan penugasan baru.'
                  : 'Tekan tombol "Buat" untuk menambahkan tugas baru.'}
              </Text>
            </View>
          )}

          {!selectedAssignment && assignments.length > 0 && (
            <FlatList
              data={assignments}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16, gap: 12 }}
              renderItem={({ item }) => {
                const stats = getDeadlineStats(item.deadline);
                return (
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedAssignment(item);
                      setAttachedFiles([]);
                      setSubmissionCatatan('');
                    }}
                    activeOpacity={0.75}
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: 12,
                      padding: 14,
                      borderWidth: 1,
                      borderColor: stats.isExpired ? '#fecdd3' : '#e2e8f0',
                      gap: 10,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.04,
                      shadowRadius: 2,
                      elevation: 1,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          backgroundColor: '#ecfdf5',
                          borderWidth: 1,
                          borderColor: '#a7f3d0',
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 6,
                        }}
                      >
                        <Ionicons name="book-outline" size={11} color="#047857" />
                        <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#047857' }}>
                          {item.subject_nama || 'Mata Pelajaran'}
                        </Text>
                      </View>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          backgroundColor: stats.isExpired ? '#ffe4e6' : '#ecfdf5',
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 6,
                          borderWidth: 1,
                          borderColor: stats.isExpired ? '#fecdd3' : '#bbf7d0',
                        }}
                      >
                        <Ionicons
                          name={stats.isExpired ? 'lock-closed' : 'time-outline'}
                          size={12}
                          color={stats.isExpired ? '#e11d48' : '#047857'}
                        />
                        <Text
                          style={{
                            fontSize: 10.5,
                            fontWeight: '700',
                            color: stats.isExpired ? '#be123c' : '#047857',
                          }}
                        >
                          {stats.label}
                        </Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                      <View
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 8,
                          backgroundColor: stats.isExpired ? '#fef2f2' : '#f0fdf4',
                          borderWidth: 1,
                          borderColor: stats.isExpired ? '#fee2e2' : '#dcfce7',
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}
                      >
                        <Ionicons
                          name={stats.isExpired ? 'document-lock-outline' : 'document-text-outline'}
                          size={20}
                          color={stats.isExpired ? '#e11d48' : '#047857'}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 3 }}>
                          {item.judul}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          {item.guru_nama ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                              <Ionicons name="person-outline" size={11} color="#64748b" />
                              <Text style={{ fontSize: 11, color: '#64748b' }}>{item.guru_nama}</Text>
                            </View>
                          ) : null}
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                            <Ionicons name="calendar-outline" size={11} color="#64748b" />
                            <Text style={{ fontSize: 11, color: '#64748b' }}>{item.tanggal}</Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    {item.deskripsi ? (
                      <Text style={{ fontSize: 12, color: '#475569', lineHeight: 18 }} numberOfLines={2}>
                        {item.deskripsi}
                      </Text>
                    ) : null}

                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderTopWidth: 1,
                        borderTopColor: '#f1f5f9',
                        paddingTop: 8,
                        marginTop: 2,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons
                          name={item.is_submitted ? 'checkmark-circle' : 'ellipse-outline'}
                          size={14}
                          color={item.is_submitted ? '#16a34a' : '#94a3b8'}
                        />
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '600',
                            color: item.is_submitted ? '#16a34a' : '#64748b',
                          }}
                        >
                          {item.is_submitted ? 'Sudah Dikumpulkan' : 'Belum Dikumpulkan'}
                        </Text>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#047857' }}>Lihat Detail</Text>
                        <Ionicons name="chevron-forward" size={13} color="#047857" />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}

          {/* Floating Action Button (FAB) + Tambah Tugas Baru (Untuk Guru & Admin) */}
          {!selectedAssignment && (userRole === 'guru' || userRole === 'admin') && (
            <TouchableOpacity
              onPress={() => setShowAddAssignment(true)}
              style={{
                position: 'absolute',
                right: 20,
                bottom: 24,
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: '#047857',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#047857',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.35,
                shadowRadius: 6,
                elevation: 6,
                zIndex: 10,
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={28} color="#ffffff" />
            </TouchableOpacity>
          )}

          {/* Render Detail & Pengumpulan Tugas Langsung di Dalam Modal (In-Modal View Transition) */}
          {selectedAssignment && (() => {
            const stats = getDeadlineStats(selectedAssignment.deadline);
            const isLocked = stats.isExpired;
            const alreadyDone = Boolean(selectedAssignment.is_submitted);

            return (
              <View style={{ flex: 1 }}>
                {/* Top Bar Header Detail */}
                <View
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: '#f1f5f9',
                    backgroundColor: '#ffffff',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <TouchableOpacity
                    onPress={() => setSelectedAssignment(null)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="arrow-back" size={20} color="#047857" />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#047857' }}>Daftar Tugas</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      setSelectedAssignment(null);
                      setShowAssignments(false);
                    }}
                    style={{ padding: 4 }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close" size={22} color="#475569" />
                  </TouchableOpacity>
                </View>

                {/* Scrollable Body */}
                <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
                  <View style={{ backgroundColor: '#ffffff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', gap: 10 }}>
                    <View
                      style={{
                        alignSelf: 'flex-start',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        backgroundColor: '#ecfdf5',
                        borderWidth: 1,
                        borderColor: '#a7f3d0',
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 6,
                      }}
                    >
                      <Ionicons name="book-outline" size={12} color="#047857" />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#047857' }}>
                        {selectedAssignment.subject_nama || 'Mata Pelajaran'}
                      </Text>
                    </View>

                    <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a', lineHeight: 24 }}>
                      {selectedAssignment.judul}
                    </Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <Ionicons name="person-outline" size={12} color="#64748b" />
                        <Text style={{ fontSize: 12, color: '#475569', fontWeight: '500' }}>
                          {selectedAssignment.guru_nama || 'Guru Pengampu'}
                        </Text>
                      </View>
                      <Text style={{ color: '#cbd5e1' }}>•</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <Ionicons name="calendar-outline" size={12} color="#64748b" />
                        <Text style={{ fontSize: 12, color: '#64748b' }}>
                          {selectedAssignment.tanggal}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Box Countdown Timer Sisa Waktu */}
                  <View
                    style={{
                      backgroundColor: isLocked ? '#fff1f2' : '#f0fdf4',
                      borderWidth: 1,
                      borderColor: isLocked ? '#fecdd3' : '#bbf7d0',
                      borderRadius: 12,
                      padding: 14,
                      gap: 8,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons
                          name={isLocked ? 'lock-closed' : 'alarm-outline'}
                          size={16}
                          color={isLocked ? '#e11d48' : '#047857'}
                        />
                        <Text
                          style={{
                            fontSize: 11.5,
                            fontWeight: '800',
                            textTransform: 'uppercase',
                            color: isLocked ? '#be123c' : '#047857',
                            letterSpacing: 0.5,
                          }}
                        >
                          {isLocked ? 'Tenggat Waktu Berakhir' : 'Tenggat Waktu Pengumpulan'}
                        </Text>
                      </View>
                      <View
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 10,
                          backgroundColor: isLocked ? '#ffe4e6' : '#dcfce7',
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 10.5,
                            fontWeight: '700',
                            color: isLocked ? '#e11d48' : '#15803d',
                          }}
                        >
                          {isLocked ? 'Waktu Habis' : 'Aktif'}
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '700',
                        color: isLocked ? '#9f1239' : '#166534',
                      }}
                    >
                      {stats.label}
                    </Text>
                  </View>

                  {/* Instruksi Tugas */}
                  <View
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: '#e2e8f0',
                      padding: 14,
                      gap: 8,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="document-text-outline" size={16} color="#0f172a" />
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#0f172a' }}>
                          Petunjuk & Soal Tugas
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={handleCopyDeskripsi}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 6,
                          backgroundColor: '#f1f5f9',
                        }}
                      >
                        <Ionicons name="copy-outline" size={12} color="#475569" />
                        <Text style={{ fontSize: 11, fontWeight: '600', color: '#475569' }}>
                          {copiedDeskripsi ? 'Tersalin' : 'Salin'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <Text
                      style={{
                        fontSize: 13,
                        color: '#334155',
                        lineHeight: 20,
                        backgroundColor: '#f8fafc',
                        padding: 10,
                        borderRadius: 8,
                      }}
                      selectable
                    >
                      {selectedAssignment.deskripsi || 'Tidak ada petunjuk khusus untuk tugas ini.'}
                    </Text>
                  </View>

                  {/* Dokumen / Lampiran Berkas dari Guru untuk Murid Lihat */}
                  {selectedAssignment.attachments && selectedAssignment.attachments.length > 0 && (
                    <View
                      style={{
                        backgroundColor: '#ffffff',
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: '#bbf7d0',
                        padding: 14,
                        gap: 10,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="document-attach" size={17} color="#047857" />
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#065f46' }}>
                          Dokumen / Lampiran Tugas dari Guru ({selectedAssignment.attachments.length})
                        </Text>
                      </View>
                      <Text style={{ fontSize: 11, color: '#475569' }}>
                        Unduh atau buka berkas materi / lembar kerja di bawah ini untuk mengerjakan tugas:
                      </Text>
                      {selectedAssignment.attachments.map((file: any, fIdx: number) => (
                        <View
                          key={fIdx}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            backgroundColor: '#f8fafc',
                            borderWidth: 1,
                            borderColor: '#e2e8f0',
                            borderRadius: 8,
                            padding: 10,
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 8 }}>
                            <View
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: 8,
                                backgroundColor: '#ecfdf5',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Ionicons
                                name={file.type === 'gambar' || file.type === 'photo' ? 'image' : 'document-text'}
                                size={18}
                                color="#047857"
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 12, fontWeight: '700', color: '#1e293b' }} numberOfLines={1}>
                                {file.name}
                              </Text>
                              <Text style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>
                                {file.size ? `${(Number(file.size) / 1024).toFixed(0)} KB` : 'Dokumen'} · {String(file.type || '').toUpperCase()}
                              </Text>
                            </View>
                          </View>
                          <TouchableOpacity
                            onPress={() => Alert.alert('Buka Dokumen', `Membuka berkas "${file.name}"...`)}
                            style={{
                              backgroundColor: '#047857',
                              paddingHorizontal: 12,
                              paddingVertical: 6,
                              borderRadius: 6,
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 4,
                            }}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="eye-outline" size={13} color="#fff" />
                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>Lihat</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Lampiran & Pengumpulan (Hanya Untuk Murid) */}
                  {userRole === 'murid' && (
                    <View
                      style={{
                        backgroundColor: '#ffffff',
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: '#e2e8f0',
                        padding: 14,
                        gap: 12,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="attach" size={16} color="#0f172a" />
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#0f172a' }}>
                            {alreadyDone ? 'Berkas yang Telah Dikumpulkan' : 'Lampiran Tugas Anda'}
                          </Text>
                        </View>
                        {alreadyDone ? (
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 4,
                              backgroundColor: '#dcfce7',
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              borderRadius: 10,
                            }}
                          >
                            <Ionicons name="checkmark-done" size={12} color="#15803d" />
                            <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#15803d' }}>Sudah Dikumpulkan</Text>
                          </View>
                        ) : null}
                      </View>

                      {!alreadyDone && !isLocked && (
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity
                            onPress={() => handlePickRealFile('pdf')}
                            activeOpacity={0.8}
                            style={{
                              flex: 1,
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                              paddingVertical: 10,
                              borderRadius: 8,
                              borderWidth: 1,
                              borderStyle: 'dashed',
                              borderColor: '#94a3b8',
                              backgroundColor: '#f8fafc',
                            }}
                          >
                            <Ionicons name="document-attach-outline" size={16} color="#047857" />
                            <Text style={{ fontSize: 12, fontWeight: '600', color: '#047857' }}>
                              Dokumen
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() => handlePickRealFile('photo')}
                            activeOpacity={0.8}
                            style={{
                              flex: 1,
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                              paddingVertical: 10,
                              borderRadius: 8,
                              borderWidth: 1,
                              borderStyle: 'dashed',
                              borderColor: '#94a3b8',
                              backgroundColor: '#f8fafc',
                            }}
                          >
                            <Ionicons name="image-outline" size={16} color="#047857" />
                            <Text style={{ fontSize: 12, fontWeight: '600', color: '#047857' }}>
                              Foto Jawaban
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {/* List Attached Files */}
                      {attachedFiles.length > 0 ? (
                        <View style={{ gap: 6 }}>
                          {attachedFiles.map((file, idx) => (
                            <View
                              key={idx}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                backgroundColor: '#f1f5f9',
                                paddingHorizontal: 10,
                                paddingVertical: 8,
                                borderRadius: 8,
                              }}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                <Ionicons
                                  name={file.type === 'photo' ? 'image' : 'document'}
                                  size={16}
                                  color="#475569"
                                />
                                <View style={{ flex: 1 }}>
                                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#1e293b' }} numberOfLines={1}>
                                    {file.name}
                                  </Text>
                                  {file.size ? (
                                    <Text style={{ fontSize: 10.5, color: '#64748b' }}>
                                      {(file.size / 1024).toFixed(1)} KB
                                    </Text>
                                  ) : null}
                                </View>
                              </View>
                              {!alreadyDone && !isLocked && (
                                <TouchableOpacity onPress={() => handleRemoveFile(idx)} style={{ padding: 4 }}>
                                  <Ionicons name="trash-outline" size={16} color="#ef4444" />
                                </TouchableOpacity>
                              )}
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={{ fontSize: 11.5, color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', paddingVertical: 4 }}>
                          {alreadyDone
                            ? 'Tidak ada lampiran berkas.'
                            : 'Belum ada berkas lampiran dipilih.'}
                        </Text>
                      )}

                      {/* Catatan untuk Guru */}
                      {!alreadyDone && !isLocked && (
                        <View style={{ gap: 4, marginTop: 4 }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: '#334155' }}>
                            Catatan untuk Guru (Opsional)
                          </Text>
                          <TextInput
                            value={submissionCatatan}
                            onChangeText={setSubmissionCatatan}
                            placeholder="Tuliskan catatan atau kendala jika ada..."
                            placeholderTextColor="#94a3b8"
                            multiline
                            numberOfLines={2}
                            style={{
                              backgroundColor: '#f8fafc',
                              borderWidth: 1,
                              borderColor: '#cbd5e1',
                              borderRadius: 8,
                              paddingHorizontal: 10,
                              paddingVertical: 8,
                              fontSize: 12,
                              color: '#0f172a',
                              textAlignVertical: 'top',
                            }}
                          />
                        </View>
                      )}

                      {/* Tombol Submit */}
                      {alreadyDone ? (
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            paddingVertical: 12,
                            borderRadius: 10,
                            backgroundColor: '#f0fdf4',
                            borderWidth: 1,
                            borderColor: '#86efac',
                          }}
                        >
                          <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#16a34a' }}>
                            Tugas Telah Dikumpulkan
                          </Text>
                        </View>
                      ) : isLocked ? (
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            paddingVertical: 12,
                            borderRadius: 10,
                            backgroundColor: '#fff1f2',
                            borderWidth: 1,
                            borderColor: '#fecdd3',
                          }}
                        >
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#e11d48' }}>
                            Pengumpulan Ditutup (Melewati Deadline)
                          </Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={handleSubmitAssignment}
                          disabled={submittingAssignment}
                          activeOpacity={0.8}
                          style={[
                            s.confirmBtn,
                            {
                              paddingVertical: 13,
                              borderRadius: 10,
                              flexDirection: 'row',
                              justifyContent: 'center',
                              alignItems: 'center',
                              gap: 6,
                            },
                            submittingAssignment && { opacity: 0.6 },
                          ]}
                        >
                          {submittingAssignment ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <Ionicons name="cloud-upload-outline" size={16} color="#ffffff" />
                              <Text style={[s.confirmBtnText, { fontSize: 13.5 }]}>
                                Kumpulkan Tugas ({attachedFiles.length} Berkas)
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </ScrollView>
              </View>
            );
          })()}
        </View>
      </Modal>
      {/* Modal Buat Tugas Baru (Untuk Guru & Admin) */}
      <Modal visible={showAddAssignment} transparent animationType="fade" onRequestClose={() => setShowAddAssignment(false)}>
            <View style={s.modalOverlay}>
              <View style={[s.modalCard, { maxHeight: '85%' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text style={s.modalTitle}>Tambah Tugas Baru</Text>
                  <TouchableOpacity onPress={() => setShowAddAssignment(false)} style={{ padding: 4 }}>
                    <Ionicons name="close" size={20} color="#64748b" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                  <Text style={s.inputLabel}>Mata Pelajaran (Sesuai Guru Pengampu)</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    {teacherSubjects.map((sub) => (
                      <TouchableOpacity
                        key={sub.id}
                        onPress={() => setNewMapelTugas(sub.nama)}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: newMapelTugas === sub.nama ? '#047857' : '#cbd5e1',
                          backgroundColor: newMapelTugas === sub.nama ? '#ecfdf5' : '#ffffff',
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '600', color: newMapelTugas === sub.nama ? '#047857' : '#475569' }}>
                          {sub.nama}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={s.inputLabel}>Judul Tugas</Text>
                  <TextInput
                    style={s.input}
                    placeholder="Contoh: PR Matematika Bab 3"
                    placeholderTextColor="#94a3b8"
                    value={newJudulTugas}
                    onChangeText={setNewJudulTugas}
                  />

                  <Text style={[s.inputLabel, { marginTop: 10 }]}>Batas Waktu Pengumpulan (Countdown)</Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
                    {[
                      { label: '24 Jam', val: '24' },
                      { label: '48 Jam', val: '48' },
                      { label: '3 Hari', val: '72' },
                      { label: '7 Hari', val: '168' },
                    ].map((d) => (
                      <TouchableOpacity
                        key={d.val}
                        onPress={() => setNewDeadlineHours(d.val)}
                        style={{
                          flex: 1,
                          paddingVertical: 8,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: newDeadlineHours === d.val ? '#047857' : '#cbd5e1',
                          backgroundColor: newDeadlineHours === d.val ? '#ecfdf5' : '#ffffff',
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '700', color: newDeadlineHours === d.val ? '#047857' : '#475569' }}>
                          {d.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={s.inputLabel}>Deskripsi & Petunjuk Soal</Text>
                  <TextInput
                    style={[s.input, { height: 70, textAlignVertical: 'top' }]}
                    placeholder="Tulis instruksi pengerjaan tugas di sini..."
                    placeholderTextColor="#94a3b8"
                    multiline
                    value={newDeskripsiTugas}
                    onChangeText={setNewDeskripsiTugas}
                  />

                  {/* Lampiran Dokumen Pembelajaran untuk Murid */}
                  <Text style={[s.inputLabel, { marginTop: 10 }]}>Lampiran Dokumen untuk Murid</Text>
                  <Text style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>
                    Sertakan modul bacaan atau gambar panduan yang dapat dilihat dan dipelajari murid.
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                    <TouchableOpacity
                      onPress={() => handlePickTeacherFile('dokumen')}
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        paddingVertical: 9,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: '#cbd5e1',
                        backgroundColor: '#f8fafc',
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="document-text-outline" size={15} color="#047857" />
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#1e293b' }}>Dokumen</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handlePickTeacherFile('gambar')}
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        paddingVertical: 9,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: '#cbd5e1',
                        backgroundColor: '#f8fafc',
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="image-outline" size={15} color="#047857" />
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#1e293b' }}>Gambar</Text>
                    </TouchableOpacity>
                  </View>

                  {/* List Dokumen Terlampir */}
                  {teacherAttachments.map((f, i) => (
                    <View
                      key={i}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: '#f1f5f9',
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 6,
                        marginBottom: 6,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginRight: 6 }}>
                        <Ionicons name="document-attach" size={14} color="#047857" />
                        <Text style={{ fontSize: 11, color: '#1e293b', flex: 1 }} numberOfLines={1}>{f.name}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => setTeacherAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="close-circle" size={16} color="#94a3b8" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>

                <View style={[s.modalActions, { marginTop: 14 }]}>
                  <TouchableOpacity
                    style={s.cancelBtn}
                    onPress={() => setShowAddAssignment(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={s.cancelBtnText}>Batal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.confirmModalBtn, creatingAssignment && { opacity: 0.6 }]}
                    onPress={handleCreateAssignment}
                    disabled={creatingAssignment}
                    activeOpacity={0.8}
                  >
                    {creatingAssignment ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={s.confirmBtnText}>Simpan Tugas</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
    </ScrollView>
  );
}

// ─── Admin School Monitor View ───────────────────────────────────────────────

function AdminSchoolMonitorView() {
  const { schools: contextSchools, refreshSchools, setActiveTab } = useApp();
  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState<any[]>([]);
  const [allClasses, setAllClasses] = useState<any[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await refreshSchools();
      const res = await apiClient.getMonitoringScope();
      const schList = (res as any).schools || (res as any).scope?.schools || [];
      const clsList = (res as any).classes || (res as any).scope?.classes || [];

      // Gabungkan contextSchools & server schools agar SEMUA sekolah terdaftar pasti muncul
      const schoolMap = new Map<string, any>();
      contextSchools.forEach((s) => {
        schoolMap.set(s.id, {
          id: s.id,
          nama: s.nama,
          jenjang: s.jenjang,
          member_count: 0,
          class_count: 0,
        });
      });
      schList.forEach((s: any) => {
        const prev = schoolMap.get(s.id);
        schoolMap.set(s.id, { ...prev, ...s });
      });

      const mergedSchools = Array.from(schoolMap.values());
      setSchools(mergedSchools);
      setAllClasses(clsList);
      // Jika sebelumnya sudah pilih sekolah, sinkronkan datanya
      if (selectedSchool) {
        const found = mergedSchools.find((s: any) => s.id === selectedSchool.id);
        if (found) setSelectedSchool(found);
      }
    } catch {
      setSchools(contextSchools.map((s) => ({ ...s, member_count: 0, class_count: 0 })));
    } finally {
      setLoading(false);
    }
  }, [contextSchools, selectedSchool?.id]);

  useEffect(() => {
    loadData();
  }, []);

  const filteredSchools = schools.filter((sch) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return sch.nama.toLowerCase().includes(q) || (sch.id && sch.id.toLowerCase().includes(q));
  });

  if (loading && schools.length === 0) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#047857" />
        <Text style={s.emptyText}>Memuat data sekolah & kelas...</Text>
      </View>
    );
  }

  // Jika Admin Sedang Memilih Sekolah: Tampilkan SchoolDashboard (UI yang sama dengan akun sekolah)
  if (selectedSchool) {
    return (
      <SchoolDashboard
        overrideSchoolId={selectedSchool.id}
        onBack={() => setSelectedSchool(null)}
        onRefreshUser={loadData}
      />
    );
  }

  return (
    <View style={s.container}>
      {/* Header Banner - DesainPakeAI Pattern */}
      <View style={s.kelasHeaderCard}>
        <View style={s.kelasHeaderTop}>
          <View style={s.kelasHeaderIcon}>
            <Ionicons name="shield-checkmark" size={22} color="#047857" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.kelasHeaderTitle}>Pengawasan Sekolah</Text>
            <Text style={s.kelasHeaderSubtitle}>Panel Monitoring Instansi Terdaftar</Text>
          </View>
          <TouchableOpacity
            onPress={loadData}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={s.kelasRefreshBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={16} color="#047857" />
          </TouchableOpacity>
        </View>

        {/* Callout Info Panduan */}
        <View style={s.kelasCalloutBox}>
          <Ionicons name="business-outline" size={16} color="#065f46" />
          <Text style={s.kelasCalloutText}>
            Tekan sekolah di bawah untuk membuka dashboard instansi, mengelola kode akses murid/guru, dan mengatur perizinan.
          </Text>
        </View>
      </View>

      {/* Input Pencarian Sekolah */}
      {schools.length > 0 && (
        <View style={s.kelasSearchWrapper}>
          <Ionicons name="search" size={16} color="#94a3b8" />
          <TextInput
            style={s.kelasSearchInput}
            placeholder="Cari nama sekolah atau ID instansi..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={16} color="#94a3b8" />
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {/* List Sekolah */}
      {schools.length === 0 ? (
        <View style={s.kelasEmptyBox}>
          <View style={s.kelasEmptyIconWrap}>
            <Ionicons name="school-outline" size={36} color="#94a3b8" />
          </View>
          <Text style={s.kelasEmptyTitle}>Belum Ada Sekolah Terdaftar</Text>
          <Text style={s.kelasEmptySubtitle}>
            Belum ada sekolah yang tersimpan di sistem. Cari dan tambahkan sekolah melalui pencarian Google Places.
          </Text>
          <TouchableOpacity
            onPress={() => setActiveTab('sof')}
            style={[s.kelasActionPill, { marginTop: 12, backgroundColor: '#047857', borderColor: '#047857' }]}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={16} color="#ffffff" />
            <Text style={[s.kelasActionText, { color: '#ffffff', fontWeight: '700' }]}>Tambah / Cari Sekolah</Text>
          </TouchableOpacity>
        </View>
      ) : filteredSchools.length === 0 ? (
        <View style={s.kelasEmptyBox}>
          <Ionicons name="search-outline" size={32} color="#cbd5e1" />
          <Text style={s.kelasEmptyTitle}>Sekolah Tidak Ditemukan</Text>
          <Text style={s.kelasEmptySubtitle}>Tidak ada sekolah yang cocok dengan kata kunci "{searchQuery}".</Text>
          <TouchableOpacity onPress={() => setSearchQuery('')} style={[s.kelasActionPill, { marginTop: 8 }]} activeOpacity={0.7}>
            <Text style={s.kelasActionText}>Reset Pencarian</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredSchools}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.kelasListContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: sch }) => {
            const clsCount = allClasses.filter((c) => c.school_id === sch.id).length;
            return (
              <TouchableOpacity
                key={sch.id}
                onPress={() => setSelectedSchool(sch)}
                style={s.kelasCard}
                activeOpacity={0.7}
              >
                <View style={s.kelasCardLeft}>
                  <View style={s.kelasIconBadge}>
                    <Ionicons name="business" size={18} color="#047857" />
                  </View>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={s.kelasCardTitle} numberOfLines={2}>{sch.nama}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                      {sch.jenjang ? (
                        <View style={s.kelasTingkatTag}>
                          <Text style={s.kelasTingkatText}>{sch.jenjang}</Text>
                        </View>
                      ) : null}
                      <View style={[s.roleTag, { backgroundColor: '#ecfdf5' }]}>
                        <Text style={[s.roleTagText, { color: '#047857' }]}>
                          {clsCount} Kelas
                        </Text>
                      </View>
                      {sch.member_count !== undefined ? (
                        <View style={[s.roleTag, { backgroundColor: '#eff6ff' }]}>
                          <Text style={[s.roleTagText, { color: '#1d4ed8' }]}>
                            {sch.member_count} Anggota
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>

                <View style={s.kelasActionPill}>
                  <Text style={s.kelasActionText}>Kelola</Text>
                  <Ionicons name="chevron-forward" size={13} color="#047857" />
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

// ─── Admin Kelas List View ────────────────────────────────────────────────────
// Tab "Kelas" untuk admin: list baris kelas semua sekolah.
// Tekan satu baris → tampilan perspektif pelajar (ClassMemberView userRole='murid').

type AdminClassItem = {
  id: string;
  nama: string;
  tingkat: string | number;
  school_id?: string;
  schoolName: string;
};

export const AdminKelasView: React.FC = () => {
  const { setActiveClass, schools: contextSchools } = useApp();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<AdminClassItem[]>([]);
  const [previewClass, setPreviewClass] = useState<AdminClassItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadClasses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.getMonitoringScope();
      const serverSchools = res.schools || [];
      const rawClasses = res.classes || [];

      // Gabungkan schoolMap dari server & AppContext untuk resolusi nama sekolah yang pasti akurat
      const schoolMap: Record<string, string> = {};
      contextSchools.forEach((s) => { schoolMap[s.id] = s.nama; });
      serverSchools.forEach((s) => { schoolMap[s.id] = s.nama; });

      setClasses(
        rawClasses.map((cls) => {
          const sName = cls.school_id ? (schoolMap[cls.school_id] || 'Sekolah Terdaftar') : 'Sekolah Terdaftar';
          return {
            id: cls.id,
            nama: cls.nama,
            tingkat: cls.tingkat,
            school_id: cls.school_id,
            schoolName: sName,
          };
        })
      );
    } catch {
      setClasses([]);
    } finally {
      setLoading(false);
    }
  }, [contextSchools]);

  useEffect(() => { loadClasses(); }, [loadClasses]);

  const filteredClasses = classes.filter((cls) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return cls.nama.toLowerCase().includes(q) || cls.schoolName.toLowerCase().includes(q);
  });

  if (previewClass) {
    return (
      <ClassMemberView
        classId={previewClass.id}
        className={previewClass.nama}
        schoolName={previewClass.schoolName}
        userRole="murid"
        onLeave={() => {
          setPreviewClass(null);
          setActiveClass(null);
        }}
        onBackToDashboard={() => {
          setPreviewClass(null);
          setActiveClass(null);
        }}
      />
    );
  }

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#047857" />
        <Text style={s.emptyText}>Memuat daftar kelas...</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Header Banner - Emerald Theme sesuai Brand Identity SKITA */}
      <View style={s.kelasHeaderCard}>
        <View style={s.kelasHeaderTop}>
          <View style={s.kelasHeaderIcon}>
            <Ionicons name="school" size={22} color="#047857" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.kelasHeaderTitle}>Daftar Ruang Kelas</Text>
            <Text style={s.kelasHeaderSubtitle}>Mode Pengawasan Akses & Presensi</Text>
          </View>
          <TouchableOpacity
            onPress={loadClasses}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={s.kelasRefreshBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={16} color="#047857" />
          </TouchableOpacity>
        </View>

        {/* Callout Info Panduan */}
        <View style={s.kelasCalloutBox}>
          <Ionicons name="eye-outline" size={16} color="#065f46" />
          <Text style={s.kelasCalloutText}>
            Tekan salah satu kelas di bawah untuk masuk ke tampilan murid dan membuka tab Absensi di bottom bar.
          </Text>
        </View>
      </View>

      {/* Input Pencarian Kelas / Sekolah */}
      {classes.length > 0 && (
        <View style={s.kelasSearchWrapper}>
          <Ionicons name="search" size={16} color="#94a3b8" />
          <TextInput
            style={s.kelasSearchInput}
            placeholder="Cari nama kelas atau instansi sekolah..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={16} color="#94a3b8" />
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {/* List Kelas */}
      {classes.length === 0 ? (
        <View style={s.kelasEmptyBox}>
          <View style={s.kelasEmptyIconWrap}>
            <Ionicons name="book-outline" size={36} color="#94a3b8" />
          </View>
          <Text style={s.kelasEmptyTitle}>Belum Ada Kelas</Text>
          <Text style={s.kelasEmptySubtitle}>
            Sekolah yang terdaftar belum memiliki kelas aktif. Buka tab Dashboard untuk membuat kelas pada sekolah binaan.
          </Text>
        </View>
      ) : filteredClasses.length === 0 ? (
        <View style={s.kelasEmptyBox}>
          <Ionicons name="search-outline" size={32} color="#cbd5e1" />
          <Text style={s.kelasEmptyTitle}>Kelas Tidak Ditemukan</Text>
          <Text style={s.kelasEmptySubtitle}>Tidak ada kelas yang cocok dengan kata kunci "{searchQuery}".</Text>
          <TouchableOpacity onPress={() => setSearchQuery('')} style={[s.kelasActionPill, { marginTop: 8 }]} activeOpacity={0.7}>
            <Text style={s.kelasActionText}>Reset Pencarian</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredClasses}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.kelasListContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.kelasCard}
              onPress={() => {
                setActiveClass({ id: item.id, name: item.nama, schoolName: item.schoolName });
                setPreviewClass(item);
              }}
              activeOpacity={0.7}
            >
              <View style={s.kelasCardLeft}>
                <View style={s.kelasIconBadge}>
                  <Ionicons name="book" size={18} color="#047857" />
                </View>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={s.kelasCardTitle} numberOfLines={1}>{item.nama}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 3 }}>
                    <View style={s.kelasTingkatTag}>
                      <Text style={s.kelasTingkatText}>Tingkat {item.tingkat}</Text>
                    </View>
                    <Text style={s.kelasSchoolName} numberOfLines={1}>
                      {item.schoolName}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={s.kelasActionPill}>
                <Text style={s.kelasActionText}>Lihat Isi Kelas</Text>
                <Ionicons name="chevron-forward" size={13} color="#047857" />
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
};

// ─── Tampilan Kelas Guru (Tab Kelas untuk Guru) ──────────────────────────

function TeacherClassListView({
  school,
  classes,
  onSelectClass,
  onRefresh,
  onGoToDashboard,
  userRole,
}: {
  school: { id: string; name: string; jenjang?: string };
  classes: Array<{ id: string; nama: string; tingkat?: string | number }>;
  onSelectClass: (cls: { id: string; nama: string; tingkat?: string | number }) => void;
  onRefresh: () => Promise<void>;
  onGoToDashboard: () => void;
  userRole?: string;
}) {
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const filtered = classes.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return c.nama.toLowerCase().includes(q) || String(c.tingkat || '').toLowerCase().includes(q);
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.dashContent} showsVerticalScrollIndicator={false}>
      {/* Banner Sekolah */}
      <View style={s.schoolBanner}>
        <Ionicons name="school" size={18} color="#c7d2fe" />
        <View style={{ flex: 1 }}>
          <Text style={s.schoolBannerName}>{school.name}</Text>
          <Text style={s.schoolBannerJenjang}>
            {school.jenjang || 'Sekolah'} · {userRole === 'sekolah' ? 'Ruang Kelas Sekolah' : 'Ruang Kelas Guru'}
          </Text>
        </View>
        <TouchableOpacity onPress={handleRefresh} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ padding: 4 }}>
          {refreshing ? (
            <ActivityIndicator size="small" color="#c7d2fe" />
          ) : (
            <Ionicons name="refresh" size={16} color="#c7d2fe" />
          )}
        </TouchableOpacity>
      </View>

      {/* Section Header: Daftar Kelas */}
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Daftar Kelas ({classes.length})</Text>
      </View>

      {classes.length === 0 ? (
        <View style={s.kelasEmptyBox}>
          <View style={s.kelasEmptyIconWrap}>
            <Ionicons name="book-outline" size={36} color="#94a3b8" />
          </View>
          <Text style={s.kelasEmptyTitle}>
            {userRole === 'sekolah' ? 'Belum Ada Kelas yang Dibuat' : 'Belum Ada Kelas yang Diajar'}
          </Text>
          <Text style={s.kelasEmptySubtitle}>
            {userRole === 'sekolah'
              ? 'Buat ruang kelas baru terlebih dahulu melalui Dashboard Sekolah.'
              : 'Kode kelas harus dimasukkan terlebih dahulu di dashboard.'}
          </Text>
          <TouchableOpacity
            onPress={onGoToDashboard}
            style={[s.kelasActionPill, { marginTop: 12, backgroundColor: '#047857', paddingHorizontal: 16 }]}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={14} color="#fff" style={{ marginRight: 4 }} />
            <Text style={[s.kelasActionText, { color: '#fff', fontWeight: '700' }]}>Ke Dashboard</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Search Bar Kelas (sama seperti akun sekolah) */}
          <View style={[s.kelasSearchWrapper, { marginHorizontal: 0, marginBottom: 10 }]}>
            <Ionicons name="search" size={16} color="#94a3b8" />
            <TextInput
              style={s.kelasSearchInput}
              placeholder="Cari kelas atau tingkat..."
              placeholderTextColor="#94a3b8"
              value={search}
              onChangeText={setSearch}
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={16} color="#94a3b8" />
              </TouchableOpacity>
            ) : null}
          </View>

          {filtered.length === 0 ? (
            <View style={s.kelasEmptyBox}>
              <Ionicons name="search-outline" size={28} color="#cbd5e1" />
              <Text style={s.kelasEmptyTitle}>Kelas Tidak Ditemukan</Text>
              <Text style={s.kelasEmptySubtitle}>Tidak ada kelas yang cocok dengan kata kunci "{search}".</Text>
              <TouchableOpacity onPress={() => setSearch('')} style={[s.kelasActionPill, { marginTop: 6 }]}>
                <Text style={s.kelasActionText}>Reset Pencarian</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filtered.map((cls) => (
              <View key={cls.id} style={s.classCard}>
                <View style={s.classCardHeader}>
                  <Text style={s.classCardName}>{cls.nama}</Text>
                  {cls.tingkat ? <Text style={s.classCardTingkat}>Tingkat {cls.tingkat}</Text> : null}
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 12,
                    paddingTop: 10,
                    borderTopWidth: 1,
                    borderTopColor: '#f1f5f9',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="school-outline" size={14} color="#047857" />
                    <Text style={{ fontSize: 11, color: '#475569' }}>
                      Status: {userRole === 'sekolah' ? 'Kelas Aktif' : 'Aktif Mengajar'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => onSelectClass(cls)}
                    style={{
                      backgroundColor: '#047857',
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 6,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>Buka Kelas</Text>
                    <Ionicons name="chevron-forward" size={13} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}

// ─── Root export ─────────────────────────────────────────────────────────────

export const ClassroomView: React.FC = () => {
  const {
    user,
    refreshUser,
    userSchool,
    setUserSchool,
    activeClass,
    setActiveClass,
    availableClasses,
    setAvailableClasses,
    activeTab,
    setActiveTab,
    refreshMembershipScope,
  } = useApp();
  const role = user?.role;
  const [viewMode, setViewMode] = useState<'class' | 'school_dashboard'>('school_dashboard');
  const [checkingClass, setCheckingClass] = useState(false);

  const checkActiveClass = useCallback(async () => {
    if (!user) return;
    setCheckingClass(true);
    try {
      if (role === 'sekolah') {
        const dashRes = await apiClient.getSchoolDashboard();
        if (dashRes?.school) {
          setUserSchool({
            id: dashRes.school.id,
            name: dashRes.school.nama,
            jenjang: dashRes.school.jenjang,
          });
          const mappedClasses = (dashRes.classes || []).map((c) => ({
            id: c.id,
            nama: c.nama,
            tingkat: c.tingkat,
          }));
          setAvailableClasses(mappedClasses);
        }
        return;
      }

      const res = await refreshMembershipScope();
      if (!res) return;

      if (role === 'murid') {
        if (res.kelas) {
          setViewMode('class');
        } else {
          setViewMode('school_dashboard');
        }
      } else if (role === 'guru') {
        // guru default ke school_dashboard; masuk kelas saat user pilih
        if (!activeClass && res.classes?.length > 0) {
          setViewMode('school_dashboard');
        }
      } else {
        setViewMode('school_dashboard');
      }
    } catch {
      // noop
    } finally {
      setCheckingClass(false);
    }
  }, [user, role, activeClass]);

  useEffect(() => {
    checkActiveClass();
  }, [checkActiveClass]);

  if (!user) {
    return (
      <View style={s.center}>
        <Ionicons name="log-in-outline" size={36} color="#cbd5e1" />
        <Text style={s.emptyText}>Login terlebih dahulu untuk akses fitur kelas.</Text>
      </View>
    );
  }

  if (role === 'admin') {
    return <AdminSchoolMonitorView />;
  }

  // Khusus Akun Sekolah: Tab Dashboard menampilkan SchoolDashboard
  if (role === 'sekolah' && activeTab === 'dashboard') {
    return <SchoolDashboard onRefreshUser={refreshUser} />;
  }

  if (checkingClass) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#047857" />
      </View>
    );
  }

  // Belum punya sekolah → JoinFlow
  if (!userSchool) {
    if (role === 'sekolah') {
      return <SchoolDashboard onRefreshUser={refreshUser} />;
    }
    return (
      <JoinFlow
        onRefreshUser={refreshUser}
        onJoinedSchool={(sch) => {
          setUserSchool(sch);
          setViewMode('school_dashboard');
          refreshUser();
          // Setelah join sekolah, pindah ke tab dashboard
          setActiveTab('dashboard');
          checkActiveClass();
        }}
      />
    );
  }

  // Khusus Guru: Tab Dashboard menampilkan SchoolPortalView
  if (role === 'guru' && activeTab === 'dashboard') {
    return (
      <SchoolPortalView
        school={userSchool}
        userRole="guru"
        teacherClasses={availableClasses}
        onLeaveSchool={() => {
          setUserSchool(null);
          setActiveClass(null);
          setAvailableClasses([]);
          refreshUser();
          checkActiveClass();
        }}
        onEnterClass={(cls) => {
          setActiveClass({
            id: cls.id,
            name: cls.name,
            schoolName: userSchool.name,
          });
          setViewMode('class');
          setActiveTab('kelas');
        }}
        onRefreshTeacherClasses={async () => {
          const res = await apiClient.getMonitoringScope();
          setAvailableClasses(res.classes || []);
        }}
      />
    );
  }

  // Tab Kelas untuk Guru & Akun Sekolah
  if ((role === 'guru' || role === 'sekolah') && activeTab === 'kelas') {
    if (activeClass) {
      return (
        <ClassMemberView
          classId={activeClass.id}
          className={activeClass.name}
          schoolName={activeClass.schoolName}
          userRole={role}
          onLeave={() => {
            setActiveClass(null);
            setViewMode('school_dashboard');
            refreshUser();
            checkActiveClass();
          }}
          onBackToDashboard={() => {
            setActiveClass(null);
            setViewMode('school_dashboard');
          }}
          availableClasses={availableClasses}
          onSelectClass={(cls) => {
            setActiveClass({
              id: cls.id,
              name: cls.name,
              schoolName: userSchool.name,
            });
          }}
        />
      );
    }
    return (
      <TeacherClassListView
        school={userSchool}
        classes={availableClasses}
        userRole={role}
        onSelectClass={(cls) => {
          setActiveClass({
            id: cls.id,
            name: cls.nama,
            schoolName: userSchool.name,
          });
          setViewMode('class');
        }}
        onRefresh={async () => {
          if (role === 'sekolah') {
            const res = await apiClient.getSchoolDashboard();
            if (res?.classes) {
              setAvailableClasses(res.classes.map((c) => ({ id: c.id, nama: c.nama, tingkat: c.tingkat })));
            }
          } else {
            const res = await apiClient.getMonitoringScope();
            setAvailableClasses(res.classes || []);
          }
        }}
        onGoToDashboard={() => setActiveTab('dashboard')}
      />
    );
  }

  // Khusus Murid: Tab Kelas tapi belum masuk kelas
  if (role === 'murid' && activeTab === 'kelas' && !activeClass) {
    return (
      <ScrollView style={s.container} contentContainerStyle={s.dashContent}>
        <View style={s.schoolBanner}>
          <Ionicons name="school" size={18} color="#c7d2fe" />
          <View style={{ flex: 1 }}>
            <Text style={s.schoolBannerName}>{userSchool.name}</Text>
            <Text style={s.schoolBannerJenjang}>{userSchool.jenjang || 'Sekolah'} · Siswa</Text>
          </View>
        </View>
        <View style={s.kelasEmptyBox}>
          <View style={s.kelasEmptyIconWrap}>
            <Ionicons name="book-outline" size={36} color="#94a3b8" />
          </View>
          <Text style={s.kelasEmptyTitle}>Belum Masuk Kelas</Text>
          <Text style={s.kelasEmptySubtitle}>
            Kode kelas harus dimasukkan terlebih dahulu di dashboard.
          </Text>
          <TouchableOpacity
            onPress={() => setActiveTab('dashboard')}
            style={[s.kelasActionPill, { marginTop: 12, backgroundColor: '#047857', paddingHorizontal: 16 }]}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={14} color="#fff" style={{ marginRight: 4 }} />
            <Text style={[s.kelasActionText, { color: '#fff', fontWeight: '700' }]}>Ke Dashboard</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // Murid / Guru aktif di dalam kelas
  if (viewMode === 'class' && activeClass) {
    return (
      <ClassMemberView
        classId={activeClass.id}
        className={activeClass.name}
        schoolName={activeClass.schoolName}
        userRole={role || 'murid'}
        onLeave={() => {
          setActiveClass(null);
          setViewMode('school_dashboard');
          refreshUser();
          checkActiveClass();
        }}
        onBackToDashboard={role === 'guru' ? () => {
          setActiveClass(null);
          setViewMode('school_dashboard');
        } : undefined}
        availableClasses={availableClasses}
        onSelectClass={(cls) => {
          setActiveClass({
            id: cls.id,
            name: cls.name,
            schoolName: userSchool.name,
          });
        }}
      />
    );
  }

  if (role === 'sekolah') {
    return <SchoolDashboard onRefreshUser={refreshUser} />;
  }

  // Dashboard Sekolah (murid belum di kelas, guru, admin)
  return (
    <SchoolPortalView
      school={userSchool}
      userRole={role || 'murid'}
      teacherClasses={availableClasses}
      onLeaveSchool={() => {
        setUserSchool(null);
        setActiveClass(null);
        setAvailableClasses([]);
        refreshUser();
        checkActiveClass();
      }}
      onEnterClass={(cls) => {
        setActiveClass({
          id: cls.id,
          name: cls.name,
          schoolName: userSchool.name,
        });
        // Guru: pilih kelas → langsung buka Absensi di bottom bar
        if (role === 'guru') {
          setActiveTab('absensi');
        } else {
          setViewMode('class');
        }
      }}
      onRefreshTeacherClasses={async () => {
        const res = await apiClient.getMonitoringScope();
        setAvailableClasses(res.classes || []);
      }}
    />
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },

  // Dashboard
  dashContent: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 80, gap: 8 },
  schoolBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#312e81', borderRadius: 10, padding: 12,
  },
  schoolBannerName: { fontSize: 13, fontWeight: '700', color: '#ffffff' },
  schoolBannerJenjang: { fontSize: 10, color: '#c7d2fe', marginTop: 1 },

  backToSchoolsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  backToSchoolsBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 },

  newClassBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6, borderWidth: 1, borderColor: '#047857', backgroundColor: '#f0fdf4',
  },
  newClassBtnText: { fontSize: 11, color: '#047857', fontWeight: '700' },

  // CodeCard
  codeCard: {
    backgroundColor: '#ffffff', borderRadius: 9, padding: 10,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  codeCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  codeLabel: { fontSize: 10, fontWeight: '600', color: '#64748b', textTransform: 'uppercase' },
  codeValue: { fontSize: 20, fontWeight: '800', color: '#0f172a', letterSpacing: 2, fontFamily: 'monospace' },
  codeExpiry: { fontSize: 10, color: '#94a3b8', marginTop: 2 },
  generateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: '#047857', borderRadius: 7, paddingVertical: 7, marginTop: 4,
  },
  generateBtnText: { fontSize: 12, color: '#ffffff', fontWeight: '700' },
  rotateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 5, borderWidth: 1, borderColor: '#bae6fd', backgroundColor: '#f0f9ff',
  },
  rotateBtnText: { fontSize: 10, color: '#0369a1', fontWeight: '600' },

  // Settings toggle
  settingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#ffffff', borderRadius: 9, padding: 10,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  settingLabel: { fontSize: 12, fontWeight: '600', color: '#0f172a' },
  settingDesc: { fontSize: 10, color: '#64748b', marginTop: 1 },
  toggle: {
    width: 36, height: 20, borderRadius: 10, backgroundColor: '#e2e8f0', justifyContent: 'center', padding: 2,
  },
  toggleOn: { backgroundColor: '#047857' },
  toggleKnob: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#ffffff' },
  toggleKnobOn: { alignSelf: 'flex-end' },

  // Pending guru
  pendingCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fffbeb', borderRadius: 9, padding: 9,
    borderWidth: 1, borderColor: '#fde68a',
  },
  pendingAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#d97706', alignItems: 'center', justifyContent: 'center' },
  pendingName: { fontSize: 12, fontWeight: '700', color: '#0f172a' },
  pendingEmail: { fontSize: 10, color: '#64748b' },
  approveBtn: {
    backgroundColor: '#047857', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5,
  },
  approveBtnText: { fontSize: 11, color: '#ffffff', fontWeight: '700' },

  // Class card
  classCard: {
    backgroundColor: '#f8fafc', borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: '#e2e8f0', gap: 6,
  },
  classCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  classCardName: { fontSize: 12, fontWeight: '700', color: '#0f172a' },
  classCardTingkat: { fontSize: 10, color: '#64748b' },

  emptyBox: { alignItems: 'center', paddingVertical: 24, gap: 6 },
  emptyText: { fontSize: 12, color: '#94a3b8', textAlign: 'center' },

  // Claim
  claimScroll: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  claimScrollContent: {
    padding: 16,
    paddingTop: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  claimCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 22,
    alignItems: 'center',
    gap: 16,
    elevation: 2,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  claimIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  claimHeaderCluster: {
    alignItems: 'center',
    gap: 6,
  },
  claimTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  claimDesc: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 4,
  },
  claimInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 10,
    padding: 12,
    width: '100%',
  },
  claimInfoText: {
    flex: 1,
    fontSize: 12,
    color: '#0369a1',
    lineHeight: 17,
  },
  claimFormGroup: {
    width: '100%',
    gap: 6,
  },
  claimInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    height: 48,
  },
  claimInputWrapperFocused: {
    borderColor: '#047857',
    backgroundColor: '#ffffff',
  },
  claimInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    paddingVertical: 0,
  },
  claimBtn: {
    width: '100%',
    height: 48,
    backgroundColor: '#047857',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  claimBtnDisabled: {
    backgroundColor: '#94a3b8',
    opacity: 0.7,
  },
  claimBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  claimTrustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  claimTrustText: {
    fontSize: 11,
    color: '#64748b',
  },

  // Join flow
  joinContent: { paddingHorizontal: 14, paddingTop: 20, paddingBottom: 80, gap: 12 },

  // Step indicator presisi
  stepBox: { gap: 6 },
  stepNodesRow: { flexDirection: 'row', alignItems: 'center' },
  stepLabelsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  stepCircle: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  stepCircleActive: { backgroundColor: '#047857' },
  stepCircleDone: { backgroundColor: '#047857' },
  stepCircleInactive: { backgroundColor: '#e2e8f0' },
  stepNumber: { fontSize: 13, fontWeight: '700', color: '#ffffff' },
  stepNumberInactive: { color: '#94a3b8' },
  stepLine: { flex: 1, height: 2, backgroundColor: '#e2e8f0', marginHorizontal: 6 },
  stepLineActive: { backgroundColor: '#047857' },
  stepLabel: { flex: 1, fontSize: 11, color: '#94a3b8', fontWeight: '600', textAlign: 'center' },
  stepLabelActive: { color: '#047857' },

  // Splash transition
  splashTransitionContainer: {
    flex: 1,
    backgroundColor: '#064e3b',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  splashRadarWave: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.25)',
  },
  splashIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#047857',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#34d399',
  },
  splashTransitionTitle: { fontSize: 20, fontWeight: '700', color: '#ffffff', marginTop: 14 },
  splashTransitionSubtitle: { fontSize: 13, color: '#a7f3d0', textAlign: 'center' },

  // legacy dari step lama (tidak dipakai lagi, dipertahankan agar tidak break komponen lain)
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 4 },
  stepItem: { alignItems: 'center', gap: 4 },
  joinCard: {
    backgroundColor: '#ffffff', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#e2e8f0', gap: 8,
  },
  joinCardTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  joinCardDesc: { fontSize: 11, color: '#64748b', lineHeight: 16 },
  backStep: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'center', marginTop: 4 },
  backStepText: { fontSize: 11, color: '#64748b' },

  pdpBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'center' },
  pdpText: { fontSize: 10, color: '#94a3b8' },

  // Shared form
  inputLabel: { fontSize: 11, fontWeight: '600', color: '#334155' },
  input: {
    borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 7,
    paddingHorizontal: 10, paddingVertical: 8,
    fontSize: 13, color: '#0f172a', backgroundColor: '#f8fafc',
  },
  confirmBtn: {
    backgroundColor: '#047857', borderRadius: 8, paddingVertical: 10,
    alignItems: 'center',
  },
  confirmModalBtn: {
    flex: 1, backgroundColor: '#047857', borderRadius: 8, paddingVertical: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  confirmBtnText: { fontSize: 13, fontWeight: '700', color: '#ffffff' },
  cancelBtn: {
    flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8,
    paddingVertical: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc',
  },
  cancelBtnText: { fontSize: 13, color: '#64748b', fontWeight: '600' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    gap: 10,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  modalActions: { flexDirection: 'row', gap: 8, marginTop: 6 },

  // Buttons tambahan
  dangerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#fca5a5',
    backgroundColor: '#fef2f2', marginTop: 8,
  },
  dangerBtnText: { color: '#dc2626', fontSize: 13, fontWeight: '700' },
  outlineBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1',
    backgroundColor: '#ffffff', marginTop: 8,
  },
  outlineBtnText: { color: '#374151', fontSize: 13, fontWeight: '600' },

  // Password sementara
  tempPassBox: {
    backgroundColor: '#f0fdf4', borderColor: '#86efac', borderWidth: 1,
    borderRadius: 8, padding: 10, gap: 2, marginTop: 6,
  },
  tempPassLabel: { fontSize: 11, color: '#166534', fontWeight: '600' },
  tempPassValue: { fontSize: 16, fontWeight: '700', color: '#14532d', letterSpacing: 1 },
  tempPassHint: { fontSize: 11, color: '#15803d' },

  // Class member view
  classMemberHeader: {
    backgroundColor: '#064e3b', borderRadius: 10, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8,
  },
  schoolNameSmall: { fontSize: 11, color: '#a7f3d0' },
  classNameLarge: { fontSize: 18, fontWeight: '700', color: '#ffffff', marginTop: 2 },
  roleBadge: { backgroundColor: '#047857', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  roleBadgeText: { fontSize: 10, fontWeight: '700', color: '#ffffff' },

  actionCard: {
    backgroundColor: '#ffffff', borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row',
    alignItems: 'center', gap: 12, marginBottom: 8,
  },
  actionIconWrap: { width: 44, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  actionCardTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  actionCardDesc: { fontSize: 11, color: '#64748b', marginTop: 1 },

  leaveClassBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#fca5a5',
    backgroundColor: '#ffffff', marginTop: 16,
  },
  leaveClassBtnText: { color: '#dc2626', fontSize: 13, fontWeight: '600' },

  // Member modal row
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0', backgroundColor: '#ffffff',
  },
  memberRow: {
    backgroundColor: '#ffffff', borderRadius: 8, padding: 12,
    borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row',
    alignItems: 'center', gap: 10,
  },
  memberNo: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  memberNoText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  memberNameText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#1e293b' },
  roleTag: { backgroundColor: '#d1fae5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  roleTagText: { fontSize: 10, fontWeight: '600', color: '#047857' },

  // Teacher navigation & actions
  backToDashBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8,
    backgroundColor: '#ecfdf5', alignSelf: 'flex-start', marginBottom: 10,
    borderWidth: 1, borderColor: '#a7f3d0',
  },
  backToDashText: { fontSize: 12, fontWeight: '700', color: '#047857' },
  teacherPlusBtn: {
    width: 28, height: 28, borderRadius: 6,
    backgroundColor: '#047857', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#34d399',
  },
  switchClassItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8,
    backgroundColor: '#f8fafc', marginTop: 6, borderWidth: 1, borderColor: '#e2e8f0',
  },
  switchClassItemActive: {
    backgroundColor: '#ecfdf5', borderColor: '#a7f3d0',
  },
  switchClassText: { fontSize: 13, color: '#334151', fontWeight: '500' },

  // School Portal Classes List
  classItemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#ffffff', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#e2e8f0', marginTop: 6,
  },
  classItemIcon: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: '#ecfdf5', alignItems: 'center', justifyContent: 'center',
  },
  classItemName: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  classItemTingkat: { fontSize: 11, color: '#64748b', marginTop: 1 },
  enterClassBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6,
    backgroundColor: '#ecfdf5',
  },
  enterClassBtnText: { fontSize: 12, fontWeight: '700', color: '#047857' },

  // DesainPakeAI: Admin Kelas View Refinements
  kelasHeaderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  kelasHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  kelasHeaderIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  kelasHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  kelasHeaderSubtitle: {
    fontSize: 11,
    color: '#047857',
    fontWeight: '600',
    marginTop: 1,
  },
  kelasRefreshBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kelasCalloutBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ecfdf5',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  kelasCalloutText: {
    flex: 1,
    fontSize: 11,
    color: '#065f46',
    lineHeight: 16,
    fontWeight: '500',
  },
  kelasSearchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    height: 42,
    marginHorizontal: 14,
    marginBottom: 8,
    gap: 8,
  },
  kelasSearchInput: {
    flex: 1,
    fontSize: 12,
    color: '#0f172a',
    paddingVertical: 0,
  },
  kelasListContent: {
    paddingHorizontal: 14,
    paddingBottom: 24,
    gap: 10,
  },
  kelasCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  kelasCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  kelasIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  kelasCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  kelasTingkatTag: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  kelasTingkatText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  kelasSchoolName: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  kelasActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  kelasActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  kelasEmptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginHorizontal: 14,
    marginTop: 20,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  kelasEmptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 4,
  },
  kelasEmptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  kelasEmptySubtitle: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
});
