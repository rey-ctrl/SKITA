/**
 * AttendanceModal — FR-A13 (P1), FR-A17 (P1)
 *
 * Murid: tombol Isi Hadir (07:00–09:00 WIB), riwayat absensi bulanan.
 * Guru : daftar absensi kelas per hari, ubah status + catatan, audit koreksi.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../services/api';

type AttendanceStatus = 'hadir' | 'sakit' | 'izin' | 'alpa';

interface ClassRecord {
  murid_id: string;
  nama: string;
  tanggal: string;
  status: AttendanceStatus;
  catatan?: string;
  is_koreksi_guru: boolean;
}

interface MyRecord {
  id: string;
  class_id: string;
  class_name: string;
  tanggal: string;
  status: AttendanceStatus;
  waktu_isi: string;
  is_koreksi_guru: boolean;
}

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  hadir: 'Hadir',
  sakit: 'Sakit',
  izin: 'Izin',
  alpa: 'Alpa',
};

const STATUS_COLOR: Record<AttendanceStatus, string> = {
  hadir: '#065f46',
  sakit: '#1d4ed8',
  izin: '#7c3aed',
  alpa: '#dc2626',
};

const STATUS_BG: Record<AttendanceStatus, string> = {
  hadir: '#d1fae5',
  sakit: '#dbeafe',
  izin: '#ede9fe',
  alpa: '#fee2e2',
};

function StatusPill({ status }: { status: AttendanceStatus }) {
  return (
    <View style={[s.pill, { backgroundColor: STATUS_BG[status] }]}>
      <Text style={[s.pillText, { color: STATUS_COLOR[status] }]}>{STATUS_LABEL[status]}</Text>
    </View>
  );
}

// ─── View Murid ──────────────────────────────────────────────────────────────

function StudentView({ classId }: { classId: string }) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [history, setHistory] = useState<MyRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await apiClient.getMyAttendanceHistory(month);
      setHistory(res.records);
    } catch {
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [month]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const handleSelf = async () => {
    setSubmitting(true);
    try {
      await apiClient.submitAttendanceSelf();
      setSubmitted(true);
      Alert.alert('Berhasil', 'Absensi hari ini tercatat sebagai Hadir.');
      loadHistory();
    } catch (e: any) {
      const msg = e.message || 'Gagal mengisi absensi.';
      if (msg.includes('07.00') || msg.includes('jendela')) {
        Alert.alert('Di Luar Waktu', msg);
      } else if (msg.includes('sudah tercatat')) {
        setSubmitted(true);
        Alert.alert('Sudah Tercatat', 'Kamu sudah mengisi absensi hari ini.');
      } else {
        Alert.alert('Gagal', msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const prevMonth = () => {
    const d = new Date(`${month}-01`);
    d.setMonth(d.getMonth() - 1);
    setMonth(d.toISOString().slice(0, 7));
  };
  const nextMonth = () => {
    const d = new Date(`${month}-01`);
    d.setMonth(d.getMonth() + 1);
    if (d <= new Date()) setMonth(d.toISOString().slice(0, 7));
  };

  const monthLabel = new Date(`${month}-01`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  return (
    <ScrollView style={s.pane} contentContainerStyle={{ gap: 16 }}>
      {/* Tombol isi hadir hari ini */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Absensi Hari Ini</Text>
        <Text style={s.hint}>Waktu pengisian: Mode Demo (Bisa Absen Kapan Saja)</Text>
        <TouchableOpacity
          style={[s.primaryBtn, submitted && s.disabledBtn]}
          onPress={handleSelf}
          disabled={submitting || submitted}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Ionicons name={submitted ? 'checkmark-circle' : 'finger-print'} size={18} color="#ffffff" />
              <Text style={s.primaryBtnText}>{submitted ? 'Sudah Hadir' : 'Isi Hadir'}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Riwayat bulanan */}
      <View style={s.card}>
        <View style={s.monthNav}>
          <TouchableOpacity onPress={prevMonth} style={s.monthArrow} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={18} color="#374151" />
          </TouchableOpacity>
          <Text style={s.cardTitle}>{monthLabel}</Text>
          <TouchableOpacity onPress={nextMonth} style={s.monthArrow} activeOpacity={0.7}>
            <Ionicons name="chevron-forward" size={18} color="#374151" />
          </TouchableOpacity>
        </View>

        {loadingHistory ? (
          <ActivityIndicator style={{ marginTop: 12 }} color="#047857" />
        ) : history.length === 0 ? (
          <Text style={s.empty}>Belum ada riwayat untuk bulan ini.</Text>
        ) : (
          history.map((r) => (
            <View key={r.id} style={s.historyRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.historyDate}>
                  {new Date(r.tanggal).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
                </Text>
                {r.is_koreksi_guru && (
                  <Text style={s.koreksiBadge}>dikoreksi guru</Text>
                )}
              </View>
              <StatusPill status={r.status} />
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

// ─── View Guru ───────────────────────────────────────────────────────────────

function TeacherView({ classId }: { classId: string }) {
  const today = new Date().toLocaleDateString('en-CA');
  const [date, setDate] = useState(today);
  const [records, setRecords] = useState<ClassRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<AttendanceStatus>('hadir');
  const [editNote, setEditNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.getClassAttendance(classId, date);
      setRecords(res.records as ClassRecord[]);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [classId, date]);

  useEffect(() => { load(); }, [load]);

  const startEdit = (r: ClassRecord) => {
    setEditing(r.murid_id);
    setEditStatus(r.status);
    setEditNote(r.catatan || '');
  };

  const saveEdit = async (muridId: string) => {
    setSaving(true);
    try {
      await apiClient.submitAttendanceGuru({
        murid_id: muridId,
        class_id: classId,
        date,
        status: editStatus,
        catatan: editNote || undefined,
      });
      setEditing(null);
      load();
    } catch (e: any) {
      Alert.alert('Gagal', e.message || 'Gagal menyimpan absensi.');
    } finally {
      setSaving(false);
    }
  };

  const prevDay = () => {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    setDate(d.toISOString().slice(0, 10));
  };
  const nextDay = () => {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    if (d <= new Date()) setDate(d.toISOString().slice(0, 10));
  };

  const dateLabel = new Date(date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <ScrollView style={s.pane}>
      <View style={s.monthNav}>
        <TouchableOpacity onPress={prevDay} style={s.monthArrow} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={18} color="#374151" />
        </TouchableOpacity>
        <Text style={[s.cardTitle, { flexShrink: 1 }]}>{dateLabel}</Text>
        <TouchableOpacity onPress={nextDay} style={s.monthArrow} activeOpacity={0.7}>
          <Ionicons name="chevron-forward" size={18} color="#374151" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color="#047857" />
      ) : records.length === 0 ? (
        <Text style={s.empty}>Belum ada data absensi untuk tanggal ini.</Text>
      ) : (
        records.map((r) => (
          <View key={r.murid_id} style={[s.card, { marginBottom: 10 }]}>
            <View style={s.rowBetween}>
              <Text style={s.memberName}>{r.nama}</Text>
              <StatusPill status={r.status} />
            </View>
            {r.catatan ? <Text style={s.noteText}>Ket: {r.catatan}</Text> : null}
            {r.is_koreksi_guru && <Text style={s.koreksiBadge}>dikoreksi guru</Text>}

            {editing === r.murid_id ? (
              <View style={{ marginTop: 10, gap: 8 }}>
                {/* Pilih status */}
                <View style={s.statusRow}>
                  {(['hadir', 'sakit', 'izin', 'alpa'] as AttendanceStatus[]).map((st) => (
                    <TouchableOpacity
                      key={st}
                      style={[s.statusChip, editStatus === st && s.statusChipSelected]}
                      onPress={() => setEditStatus(st)}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.statusChipText, editStatus === st && s.statusChipTextSelected]}>
                        {STATUS_LABEL[st]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {/* Catatan (hanya untuk sakit/izin) */}
                {(editStatus === 'sakit' || editStatus === 'izin') && (
                  <TextInput
                    style={s.noteInput}
                    value={editNote}
                    onChangeText={setEditNote}
                    placeholder="Catatan singkat (opsional)"
                    maxLength={200}
                    multiline
                  />
                )}
                <View style={s.editActions}>
                  <TouchableOpacity onPress={() => setEditing(null)} style={s.cancelEditBtn} activeOpacity={0.7}>
                    <Text style={s.cancelEditBtnText}>Batal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => saveEdit(r.murid_id)} style={s.saveBtn} disabled={saving} activeOpacity={0.8}>
                    {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.saveBtnText}>Simpan</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={s.editBtn} onPress={() => startEdit(r)} activeOpacity={0.7}>
                <Ionicons name="pencil" size={12} color="#047857" />
                <Text style={s.editBtnText}>Ubah</Text>
              </TouchableOpacity>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

// ─── Main Modal ──────────────────────────────────────────────────────────────

interface AttendanceModalProps {
  visible: boolean;
  onClose: () => void;
  classId: string;
  userRole: string;
}

export const AttendanceModal: React.FC<AttendanceModalProps> = ({ visible, onClose, classId, userRole }) => {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.modalRoot}>
        <View style={s.modalHeader}>
          <Text style={s.modalTitle}>Absensi</Text>
          <TouchableOpacity onPress={onClose} style={s.closeBtn} activeOpacity={0.7}>
            <Ionicons name="close" size={22} color="#374151" />
          </TouchableOpacity>
        </View>

        {userRole === 'murid' ? (
          <StudentView classId={classId} />
        ) : (
          <TeacherView classId={classId} />
        )}
      </View>
    </Modal>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  modalRoot: { flex: 1, backgroundColor: '#f8fafc' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#1e293b' },
  closeBtn: { padding: 4 },

  pane: { flex: 1, padding: 16 },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b', textAlign: 'center' },
  hint: { fontSize: 12, color: '#64748b', marginTop: 2, marginBottom: 10, textAlign: 'center' },

  primaryBtn: {
    backgroundColor: '#047857',
    borderRadius: 8,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  disabledBtn: { backgroundColor: '#a7f3d0' },
  primaryBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },

  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    gap: 8,
  },
  monthArrow: { padding: 4 },

  empty: { color: '#94a3b8', fontSize: 13, textAlign: 'center', marginTop: 12, paddingBottom: 8 },

  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  historyDate: { fontSize: 13, color: '#374151', fontWeight: '500' },
  koreksiBadge: { fontSize: 10, color: '#7c3aed', marginTop: 2 },

  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  pillText: { fontSize: 12, fontWeight: '600' },

  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  memberName: { fontSize: 14, fontWeight: '600', color: '#1e293b', flexShrink: 1 },
  noteText: { fontSize: 12, color: '#64748b', marginTop: 4 },

  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
  },
  statusChipSelected: { backgroundColor: '#047857', borderColor: '#047857' },
  statusChipText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  statusChipTextSelected: { color: '#ffffff' },

  noteInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: '#1e293b',
    minHeight: 60,
    backgroundColor: '#ffffff',
  },

  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  cancelEditBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  cancelEditBtnText: { fontSize: 13, color: '#374151' },
  saveBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: '#047857',
  },
  saveBtnText: { fontSize: 13, fontWeight: '700', color: '#ffffff' },

  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, alignSelf: 'flex-end' },
  editBtnText: { fontSize: 12, color: '#047857', fontWeight: '600' },
});
