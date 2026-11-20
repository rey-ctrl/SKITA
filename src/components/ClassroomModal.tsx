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
  const expiry = validUntil
    ? new Date(validUntil).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
    : null;

  return (
    <View style={s.codeCard}>
      <View style={s.codeCardTop}>
        <Text style={s.codeLabel}>{label}</Text>
        {code && onRotate && (
          <TouchableOpacity onPress={onRotate} disabled={loading} style={s.rotateBtn} activeOpacity={0.7}>
            <Ionicons name="refresh" size={13} color="#0369a1" />
            <Text style={s.rotateBtnText}>Rotasi</Text>
          </TouchableOpacity>
        )}
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

function SchoolDashboard({ onRefreshUser }: { onRefreshUser: () => void }) {
  const { isCreateClassModalOpen, setIsCreateClassModalOpen } = useApp();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [notClaimed, setNotClaimed] = useState(false);
  const [codeLoading, setCodeLoading] = useState<Record<string, boolean>>({});

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
      const res = await apiClient.getSchoolDashboard();
      setData(res);
      setNotClaimed(false);
    } catch (e: any) {
      if (e.message?.includes('klaim') || e.status === 404) setNotClaimed(true);
    } finally {
      setLoading(false);
    }
  }, []);

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
      await apiClient.createClass({ nama: newNama.trim(), tingkat: newTingkat.trim() });
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
      await apiClient.updateSchoolSettings({ auto_approve_teacher: next });
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

  return (
    <ScrollView style={s.container} contentContainerStyle={s.dashContent} showsVerticalScrollIndicator={false}>
      {/* Header Sekolah */}
      <View style={s.schoolBanner}>
        <Ionicons name="school" size={18} color="#c7d2fe" />
        <View style={{ flex: 1 }}>
          <Text style={s.schoolBannerName}>{data.school.nama}</Text>
          <Text style={s.schoolBannerJenjang}>{data.school.jenjang} · Dashboard Sekolah</Text>
        </View>
        <TouchableOpacity onPress={load} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ padding: 4 }}>
          <Ionicons name="refresh" size={16} color="#c7d2fe" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleLeaveSchool}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ padding: 4, backgroundColor: 'rgba(239, 68, 68, 0.25)', borderRadius: 6 }}
        >
          <Ionicons name="log-out-outline" size={16} color="#fca5a5" />
        </TouchableOpacity>
      </View>

      {/* Kode Sekolah */}
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
      {data.pending_guru.length > 0 && (
        <>
          <Text style={s.sectionTitle}>Guru Menunggu Persetujuan ({data.pending_guru.length})</Text>
          {data.pending_guru.map((g) => (
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
      )}

      {/* Daftar Kelas */}
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Daftar Kelas ({data.classes.length})</Text>
        <TouchableOpacity onPress={() => setShowNewClass(true)} style={s.newClassBtn} activeOpacity={0.8}>
          <Ionicons name="add" size={13} color="#047857" />
          <Text style={s.newClassBtnText}>Buat Kelas</Text>
        </TouchableOpacity>
      </View>

      {data.classes.length === 0 ? (
        <View style={s.emptyBox}>
          <Ionicons name="people-outline" size={28} color="#cbd5e1" />
          <Text style={s.emptyText}>Belum ada kelas. Buat kelas pertama.</Text>
        </View>
      ) : (
        data.classes.map((cls) => (
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

      <View style={{ height: 24 }} />

      {/* Tombol Bubarkan Semua Kelas (FR-A11) */}
      {data.classes.length > 0 && (
        <TouchableOpacity
          style={s.dangerBtn}
          onPress={() => { setDissolutionWord(''); setShowDissolutionModal(true); }}
          activeOpacity={0.8}
        >
          <Ionicons name="exit-outline" size={16} color="#dc2626" />
          <Text style={s.dangerBtnText}>Bubarkan Semua Kelas</Text>
        </TouchableOpacity>
      )}

      {/* Tombol Reset Password Murid/Guru (FR-A16) */}
      <TouchableOpacity
        style={s.outlineBtn}
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
  const { updateActiveLocationLabel } = useApp();
  const [classCode, setClassCode] = useState('');
  const [teacherNewClassCode, setTeacherNewClassCode] = useState('');
  const [loading, setLoading] = useState(false);

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

          {/* Row Daftar Kelas yang Sudah Ditambahkan */}
          <Text style={[s.sectionTitle, { marginTop: 8 }]}>Daftar Kelas Anda ({teacherClasses.length})</Text>
          {teacherClasses.length === 0 ? (
            <View style={s.emptyBox}>
              <Ionicons name="book-outline" size={32} color="#cbd5e1" />
              <Text style={s.emptyText}>Belum ada kelas yang diikuti. Masukkan kode kelas pada form di atas.</Text>
            </View>
          ) : (
            teacherClasses.map((cls) => (
              <TouchableOpacity
                key={cls.id}
                style={s.classItemRow}
                onPress={() => onEnterClass({ id: cls.id, name: cls.nama })}
                activeOpacity={0.7}
              >
                <View style={s.classItemIcon}>
                  <Ionicons name="book" size={18} color="#047857" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.classItemName}>{cls.nama}</Text>
                  <Text style={s.classItemTingkat}>Tingkat {cls.tingkat || '-'}</Text>
                </View>
                <View style={s.enterClassBtn}>
                  <Text style={s.enterClassBtnText}>Masuk</Text>
                  <Ionicons name="chevron-forward" size={14} color="#047857" />
                </View>
              </TouchableOpacity>
            ))
          )}
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
  onAddNewClassCode,
}: {
  classId: string;
  className: string;
  schoolName: string;
  userRole: string;
  onLeave: () => void;
  onBackToDashboard?: () => void;
  availableClasses?: Array<{ id: string; nama: string; tingkat?: string | number }>;
  onSelectClass?: (cls: { id: string; name: string }) => void;
  onAddNewClassCode?: (code: string) => Promise<void>;
}) {
  const [showAttendance, setShowAttendance] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showTeacherMenu, setShowTeacherMenu] = useState(false);
  const [newClassInput, setNewClassInput] = useState('');
  const [addingClass, setAddingClass] = useState(false);
  const [members, setMembers] = useState<Array<{ user_id: string; nama: string; nomor_absen: number; role: string }>>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const loadMembers = async () => {
    setLoadingMembers(true);
    try {
      const res = await apiClient.getClassMembers(classId);
      setMembers(res.members);
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

  const handleTeacherSubmitNewClass = async () => {
    if (!newClassInput.trim() || !onAddNewClassCode) return;
    setAddingClass(true);
    try {
      await onAddNewClassCode(newClassInput.trim());
      setNewClassInput('');
      setShowTeacherMenu(false);
    } catch (e: any) {
      Alert.alert('Gagal', e.message || 'Gagal menambah kelas.');
    } finally {
      setAddingClass(false);
    }
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.dashContent}>
      {/* Tombol kembali ke Dashboard Sekolah untuk guru */}
      {onBackToDashboard && (
        <TouchableOpacity style={s.backToDashBtn} onPress={onBackToDashboard} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={15} color="#047857" />
          <Text style={s.backToDashText}>Kembali ke Dashboard Sekolah</Text>
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
          {/* Tombol + untuk Guru menggantikan filter */}
          {userRole === 'guru' && (
            <TouchableOpacity
              style={s.teacherPlusBtn}
              onPress={() => setShowTeacherMenu(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={20} color="#ffffff" />
            </TouchableOpacity>
          )}
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

      {/* Tombol keluar kelas untuk murid */}
      {userRole === 'murid' && (
        <TouchableOpacity style={s.leaveClassBtn} onPress={handleLeaveClass} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={15} color="#dc2626" />
          <Text style={s.leaveClassBtnText}>Keluar dari Kelas</Text>
        </TouchableOpacity>
      )}

      {/* Modal Manajemen Kelas Guru (Tombol +) */}
      <Modal visible={showTeacherMenu} transparent animationType="fade" onRequestClose={() => setShowTeacherMenu(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={s.modalTitle}>Manajemen Kelas Guru</Text>
              <TouchableOpacity onPress={() => setShowTeacherMenu(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Tambah Kode Kelas Baru */}
            <Text style={[s.inputLabel, { marginTop: 8 }]}>Tambah Kode Kelas Baru</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TextInput
                style={[s.input, { flex: 1 }]}
                placeholder="Kode kelas baru"
                placeholderTextColor="#94a3b8"
                value={newClassInput}
                onChangeText={setNewClassInput}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={handleTeacherSubmitNewClass}
                disabled={addingClass || !newClassInput.trim()}
                style={[s.confirmBtn, { paddingHorizontal: 14 }]}
              >
                {addingClass ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.confirmBtnText}>Tambah</Text>}
              </TouchableOpacity>
            </View>

            {/* Beralih Kelas */}
            {availableClasses.length > 1 && (
              <>
                <Text style={[s.inputLabel, { marginTop: 12 }]}>Beralih Kelas ({availableClasses.length})</Text>
                <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled>
                  {availableClasses.map((ac) => {
                    const isSelected = ac.id === classId;
                    return (
                      <TouchableOpacity
                        key={ac.id}
                        onPress={() => {
                          if (onSelectClass && !isSelected) {
                            onSelectClass({ id: ac.id, name: ac.nama });
                            setShowTeacherMenu(false);
                          }
                        }}
                        style={[s.switchClassItem, isSelected && s.switchClassItemActive]}
                      >
                        <Ionicons
                          name={isSelected ? 'checkmark-circle' : 'book-outline'}
                          size={16}
                          color={isSelected ? '#047857' : '#64748b'}
                        />
                        <Text style={[s.switchClassText, isSelected && { fontWeight: '700', color: '#047857' }]}>
                          {ac.nama}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}

            {/* Tombol kembali ke Dashboard */}
            {onBackToDashboard && (
              <TouchableOpacity
                style={[s.outlineBtn, { marginTop: 12 }]}
                onPress={() => {
                  setShowTeacherMenu(false);
                  onBackToDashboard();
                }}
              >
                <Ionicons name="arrow-back" size={14} color="#374151" />
                <Text style={s.outlineBtnText}>Ke Dashboard Sekolah</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

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
    </ScrollView>
  );
}

// ─── Admin School Monitor View ───────────────────────────────────────────────

function AdminSchoolMonitorView() {
  const { isCreateClassModalOpen, setIsCreateClassModalOpen } = useApp();
  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState<any[]>([]);
  const [allClasses, setAllClasses] = useState<any[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<any | null>(null);

  // Buat kelas
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newNama, setNewNama] = useState('');
  const [newTingkat, setNewTingkat] = useState('');
  const [creating, setCreating] = useState(false);
  const [codeLoading, setCodeLoading] = useState<Record<string, boolean>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.getMonitoringScope();
      const schList = (res as any).schools || (res as any).scope?.schools || [];
      const clsList = (res as any).classes || (res as any).scope?.classes || [];
      setSchools(schList);
      setAllClasses(clsList);
      // Jika sebelumnya sudah pilih sekolah, sinkronkan datanya
      if (selectedSchool) {
        const found = schList.find((s: any) => s.id === selectedSchool.id);
        if (found) setSelectedSchool(found);
      }
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  }, [selectedSchool?.id]);

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateClass = async () => {
    if (!newNama.trim() || !newTingkat.trim()) {
      Alert.alert('Perhatian', 'Nama kelas dan tingkat wajib diisi.');
      return;
    }
    const targetSchoolId = selectedSchool?.id || (schools.length > 0 ? schools[0].id : null);
    if (!targetSchoolId) {
      Alert.alert('Perhatian', 'Pilih sekolah terlebih dahulu.');
      return;
    }
    setCreating(true);
    try {
      await apiClient.createClass({
        nama: newNama.trim(),
        tingkat: newTingkat.trim(),
        school_id: targetSchoolId,
      } as any);
      setShowCreateModal(false);
      setIsCreateClassModalOpen(false);
      setNewNama('');
      setNewTingkat('');
      Alert.alert('Sukses', 'Kelas baru berhasil dibuat.');
      await loadData();
    } catch (e: any) {
      Alert.alert('Gagal', e.message || 'Gagal membuat kelas.');
    } finally {
      setCreating(false);
    }
  };

  const handleGenerateClassCode = async (classId: string) => {
    setCodeLoading((prev) => ({ ...prev, [classId]: true }));
    try {
      await apiClient.generateClassCode(classId);
      await loadData();
    } catch (e: any) {
      Alert.alert('Gagal', e.message);
    } finally {
      setCodeLoading((prev) => ({ ...prev, [classId]: false }));
    }
  };

  const schoolClasses = selectedSchool
    ? allClasses.filter((c) => c.school_id === selectedSchool.id)
    : [];

  if (loading && schools.length === 0) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#047857" />
        <Text style={s.emptyText}>Memuat data sekolah & kelas...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.dashContent} showsVerticalScrollIndicator={false}>
      {/* Jika Belum Pilih Sekolah: Tampilkan Seluruh Rows Sekolah Beranggota / Ada Kelas */}
      {!selectedSchool ? (
        <>
          <View style={[s.schoolBanner, { backgroundColor: '#1e1b4b' }]}>
            <Ionicons name="shield-checkmark" size={26} color="#c7d2fe" />
            <View style={{ flex: 1 }}>
              <Text style={s.schoolBannerName}>Pengawasan Sekolah Admin</Text>
              <Text style={s.schoolBannerJenjang}>
                Daftar semua sekolah aktif yang memiliki anggota atau kelas terdaftar
              </Text>
            </View>
          </View>

          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Sekolah Terdaftar ({schools.length})</Text>
            <TouchableOpacity onPress={loadData} style={{ padding: 4 }}>
              <Ionicons name="refresh" size={16} color="#047857" />
            </TouchableOpacity>
          </View>

          {schools.length === 0 ? (
            <View style={s.emptyBox}>
              <Ionicons name="school-outline" size={36} color="#cbd5e1" />
              <Text style={s.emptyText}>Belum ada sekolah yang memiliki anggota atau kelas.</Text>
            </View>
          ) : (
            schools.map((sch) => {
              const clsCount = allClasses.filter((c) => c.school_id === sch.id).length;
              return (
                <TouchableOpacity
                  key={sch.id}
                  onPress={() => setSelectedSchool(sch)}
                  style={s.classCard}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.classCardName}>{sch.nama}</Text>
                      <Text style={s.classCardTingkat}>
                        Jenjang: {sch.jenjang || 'Sekolah'} · ID: {sch.id}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <View style={[s.roleTag, { backgroundColor: '#ecfdf5' }]}>
                      <Text style={[s.roleTagText, { color: '#047857' }]}>
                        {clsCount} Kelas Terdaftar
                      </Text>
                    </View>
                    {sch.member_count !== undefined && (
                      <View style={[s.roleTag, { backgroundColor: '#eff6ff' }]}>
                        <Text style={[s.roleTagText, { color: '#1d4ed8' }]}>
                          {sch.member_count} Anggota
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </>
      ) : (
        /* Jika Admin Sedang Memilih Sekolah: Tampilkan Seluruh Kelas Sekolah Tersebut */
        <>
          <TouchableOpacity
            onPress={() => setSelectedSchool(null)}
            style={s.backStep}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={14} color="#64748b" />
            <Text style={s.backStepText}>Kembali ke Daftar Semua Sekolah</Text>
          </TouchableOpacity>

          <View style={[s.schoolBanner, { backgroundColor: '#064e3b' }]}>
            <Ionicons name="school" size={24} color="#a7f3d0" />
            <View style={{ flex: 1 }}>
              <Text style={s.schoolBannerName}>{selectedSchool.nama}</Text>
              <Text style={s.schoolBannerJenjang}>
                Jenjang {selectedSchool.jenjang || '-'} · Mode Pengawasan & Kelas
              </Text>
            </View>
          </View>

          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>
              Daftar Kelas ({schoolClasses.length})
            </Text>
            <TouchableOpacity
              onPress={() => setShowCreateModal(true)}
              style={s.newClassBtn}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={13} color="#047857" />
              <Text style={s.newClassBtnText}>Buat Kelas</Text>
            </TouchableOpacity>
          </View>

          {schoolClasses.length === 0 ? (
            <View style={s.emptyBox}>
              <Ionicons name="people-outline" size={32} color="#cbd5e1" />
              <Text style={s.emptyText}>
                Belum ada kelas di sekolah ini. Ketuk tombol 'Buat Kelas' di atas.
              </Text>
            </View>
          ) : (
            schoolClasses.map((cls) => (
              <View key={cls.id} style={s.classCard}>
                <View style={s.classCardHeader}>
                  <Text style={s.classCardName}>{cls.nama}</Text>
                  <Text style={s.classCardTingkat}>Tingkat {cls.tingkat}</Text>
                </View>
                <CodeCard
                  label="Kode Akses Kelas"
                  code={cls.kode_kelas?.code}
                  validUntil={cls.kode_kelas?.valid_until}
                  onGenerate={() => handleGenerateClassCode(cls.id)}
                  loading={codeLoading[cls.id]}
                />
              </View>
            ))
          )}
        </>
      )}

      {/* Modal Buat Kelas Admin */}
      <Modal
        visible={showCreateModal || (isCreateClassModalOpen && !selectedSchool)}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowCreateModal(false);
          setIsCreateClassModalOpen(false);
        }}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>
              Buat Kelas Baru {selectedSchool ? `(${selectedSchool.nama})` : ''}
            </Text>
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
                onPress={() => {
                  setShowCreateModal(false);
                  setIsCreateClassModalOpen(false);
                  setNewNama('');
                  setNewTingkat('');
                }}
                style={s.cancelBtn}
                activeOpacity={0.7}
              >
                <Text style={s.cancelBtnText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateClass}
                disabled={creating}
                style={s.confirmModalBtn}
                activeOpacity={0.8}
              >
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
    setActiveTab,
    refreshMembershipScope,
  } = useApp();
  const role = user?.role;
  const [viewMode, setViewMode] = useState<'class' | 'school_dashboard'>('school_dashboard');
  const [checkingClass, setCheckingClass] = useState(false);

  const checkActiveClass = useCallback(async () => {
    if (!user || role === 'sekolah') return;
    setCheckingClass(true);
    try {
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
  }, [user, role]);

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

  if (role === 'sekolah') {
    return <SchoolDashboard onRefreshUser={refreshUser} />;
  }

  if (role === 'admin') {
    return <AdminSchoolMonitorView />;
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
        onBackToDashboard={role === 'guru' ? () => setViewMode('school_dashboard') : undefined}
        availableClasses={availableClasses}
        onSelectClass={(cls) => {
          setActiveClass({
            id: cls.id,
            name: cls.name,
            schoolName: userSchool.name,
          });
        }}
        onAddNewClassCode={async (code) => {
          await apiClient.joinClass(code);
          await refreshUser();
          await checkActiveClass();
          // Murid selesai join kelas → alihkan ke tab Kelas
          if (role === 'murid') setActiveTab('kelas');
        }}
      />
    );
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
        setViewMode('class');
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
  dashContent: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 32, gap: 8 },
  schoolBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#312e81', borderRadius: 10, padding: 12,
  },
  schoolBannerName: { fontSize: 13, fontWeight: '700', color: '#ffffff' },
  schoolBannerJenjang: { fontSize: 10, color: '#c7d2fe', marginTop: 1 },

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
  joinContent: { paddingHorizontal: 14, paddingTop: 20, paddingBottom: 32, gap: 12 },

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
    paddingVertical: 9, alignItems: 'center', backgroundColor: '#f8fafc',
  },
  cancelBtnText: { fontSize: 13, color: '#64748b', fontWeight: '600' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'center', padding: 24 },
  modalCard: {
    backgroundColor: '#ffffff', borderRadius: 14, padding: 16, gap: 8,
  },
  modalTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  modalActions: { flexDirection: 'row', gap: 8, marginTop: 4 },

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
});
