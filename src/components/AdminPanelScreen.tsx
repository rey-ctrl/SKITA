import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../services/api';
import { User } from '../types';

type RoleFilter = 'SEMUA' | 'admin' | 'sekolah' | 'guru' | 'murid' | 'pengguna';
const ROLE_FILTERS: RoleFilter[] = ['SEMUA', 'admin', 'sekolah', 'guru', 'murid', 'pengguna'];
const CREATABLE_ROLES = ['sekolah', 'guru', 'admin'] as const;

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  sekolah: 'Sekolah',
  guru: 'Guru',
  murid: 'Murid',
  pengguna: 'Pengguna',
};

const ROLE_COLOR: Record<string, string> = {
  admin: '#dc2626',
  sekolah: '#7c3aed',
  guru: '#0369a1',
  murid: '#047857',
  pengguna: '#475569',
};

const ROLE_DESC: Record<string, string> = {
  admin: 'Hak akses penuh ke seluruh pengaturan sistem dan data sekolah',
  sekolah: 'Mengelola instansi, kelas, dan verifikasi anggota sekolah',
  guru: 'Mengelola mata pelajaran, absensi, dan materi kelas',
  murid: 'Mengikuti kelas, tugas, materi, dan rekap absensi',
  pengguna: 'Akses publik pencarian sekolah dan simulasi zonasi',
};

interface AdminPanelScreenProps {
  onClose: () => void;
}

export const AdminPanelScreen: React.FC<AdminPanelScreenProps> = ({ onClose }) => {
  const insets = useSafeAreaInsets();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('SEMUA');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal buat akun baru
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newNama, setNewNama] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<typeof CREATABLE_ROLES[number]>('sekolah');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Modal Ubah Role (@desainpakeai)
  const [roleModalUser, setRoleModalUser] = useState<User | null>(null);
  const [selectedNewRole, setSelectedNewRole] = useState<User['role']>('pengguna');
  const [savingRole, setSavingRole] = useState(false);
  const [roleModalError, setRoleModalError] = useState<string | null>(null);

  // Modal Konfirmasi Hapus Akun (@desainpakeai)
  const [deleteModalUser, setDeleteModalUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);
  const [deleteModalError, setDeleteModalError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiClient.getAdminUsers(roleFilter === 'SEMUA' ? undefined : roleFilter);
      setUsers(res.users);
    } catch (e: any) {
      setErrorMsg(e.message || 'Gagal memuat daftar pengguna.');
    } finally {
      setLoading(false);
    }
  }, [roleFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleChangeRole = (u: User) => {
    setRoleModalUser(u);
    setSelectedNewRole(u.role);
    setRoleModalError(null);
  };

  const handleConfirmRoleChange = async () => {
    if (!roleModalUser) return;
    setSavingRole(true);
    setRoleModalError(null);
    try {
      await apiClient.updateAdminUserRole(roleModalUser.id, selectedNewRole);
      setRoleModalUser(null);
      await fetchUsers();
    } catch (e: any) {
      setRoleModalError(e.message || 'Gagal mengubah role pengguna.');
    } finally {
      setSavingRole(false);
    }
  };

  const handleDeleteUser = (u: User) => {
    setDeleteModalUser(u);
    setDeleteModalError(null);
  };

  const handleConfirmDeleteUser = async () => {
    if (!deleteModalUser) return;
    setDeletingUser(true);
    setDeleteModalError(null);
    try {
      await apiClient.deleteAdminUser(deleteModalUser.id);
      setDeleteModalUser(null);
      await fetchUsers();
    } catch (e: any) {
      setDeleteModalError(e.message || 'Gagal menghapus pengguna.');
    } finally {
      setDeletingUser(false);
    }
  };

  const handleCreate = async () => {
    setCreateError(null);
    if (!newNama.trim() || !newEmail.trim() || !newPassword.trim()) {
      setCreateError('Nama, email, dan password wajib diisi.');
      return;
    }
    if (newPassword.length < 8) {
      setCreateError('Password minimal 8 karakter.');
      return;
    }
    setCreating(true);
    try {
      await apiClient.createAdminUser({
        nama: newNama.trim(),
        email: newEmail.trim().toLowerCase(),
        password: newPassword,
        role: newRole,
      });
      setShowCreateModal(false);
      setNewNama('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('sekolah');
      await fetchUsers();
    } catch (e: any) {
      setCreateError(e.message || 'Gagal membuat akun.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header — padding top adaptif terhadap safe area status bar */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity onPress={onClose} style={styles.backBtn} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={20} color="#047857" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Manajemen Pengguna</Text>
          <Text style={styles.headerSub}>Admin Panel · FR-A1</Text>
        </View>
        <TouchableOpacity onPress={() => setShowCreateModal(true)} style={styles.addBtn} activeOpacity={0.8}>
          <Ionicons name="person-add" size={14} color="#ffffff" />
          <Text style={styles.addBtnText}>Buat Akun</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Role Bar — kompak & rapat dengan divider bawah */}
      <View style={styles.filterBarWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterBarContent}>
          {ROLE_FILTERS.map((r) => {
            const isActive = roleFilter === r;
            return (
              <TouchableOpacity
                key={r}
                onPress={() => setRoleFilter(r)}
                style={[styles.filterPill, isActive && styles.filterPillActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                  {r === 'SEMUA' ? 'Semua' : ROLE_LABEL[r] || r}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Error Banner */}
      {errorMsg && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={14} color="#dc2626" />
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      {/* User List */}
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="small" color="#047857" /></View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={[styles.listContent, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}
          showsVerticalScrollIndicator={false}
        >
          {users.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={32} color="#cbd5e1" />
              <Text style={styles.emptyText}>Tidak ada pengguna pada kategori ini.</Text>
            </View>
          ) : (
            users.map((u) => {
              const roleCol = ROLE_COLOR[u.role] || '#475569';
              return (
                <View key={u.id} style={styles.userCard}>
                  <View style={[styles.userAvatar, { backgroundColor: roleCol }]}>
                    <Ionicons name="person" size={15} color="#ffffff" />
                  </View>
                  <View style={styles.userMain}>
                    <Text style={styles.userName} numberOfLines={1}>{u.nama}</Text>
                    <Text style={styles.userEmail} numberOfLines={1}>{u.email}</Text>
                    <View style={styles.pillRow}>
                      <View style={[styles.rolePill, { backgroundColor: roleCol + '14' }]}>
                        <Text style={[styles.roleText, { color: roleCol }]}>
                          {ROLE_LABEL[u.role] || u.role}
                        </Text>
                      </View>
                      {(u as any).must_change_password && (
                        <View style={styles.warnPill}>
                          <Text style={styles.warnText}>Wajib ganti password</Text>
                        </View>
                      )}
                      {(u as any).is_active === false && (
                        <View style={styles.inactivePill}>
                          <Text style={styles.inactiveText}>Nonaktif</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.actionCol}>
                    <TouchableOpacity onPress={() => handleChangeRole(u)} style={styles.roleBtn} activeOpacity={0.7}>
                      <Ionicons name="swap-horizontal" size={12} color="#0369a1" />
                      <Text style={styles.roleBtnText}>Role</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteUser(u)} style={styles.deleteBtn} activeOpacity={0.7}>
                      <Ionicons name="trash-outline" size={12} color="#dc2626" />
                      <Text style={styles.deleteBtnText}>Hapus</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Modal Buat Akun Baru */}
      <Modal visible={showCreateModal} animationType="fade" transparent onRequestClose={() => setShowCreateModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: Math.max(insets.bottom + 12, 20) }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Buat Akun Baru</Text>
                <Text style={styles.modalSub}>Admin menambahkan akun resmi SKITA</Text>
              </View>
              <TouchableOpacity
                onPress={() => { setShowCreateModal(false); setCreateError(null); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {createError && (
              <View style={styles.modalError}>
                <Ionicons name="alert-circle" size={13} color="#dc2626" />
                <Text style={styles.modalErrorText}>{createError}</Text>
              </View>
            )}

            <View style={styles.formStack}>
              <View>
                <Text style={styles.label}>Nama Lengkap</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Nama sekolah atau pengguna"
                  placeholderTextColor="#94a3b8"
                  value={newNama}
                  onChangeText={setNewNama}
                  autoCapitalize="words"
                />
              </View>

              <View>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="admin@sekolah.id"
                  placeholderTextColor="#94a3b8"
                  value={newEmail}
                  onChangeText={setNewEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View>
                <Text style={styles.label}>Password Sementara (min 8 karakter)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Password akun"
                  placeholderTextColor="#94a3b8"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                />
              </View>

              <View>
                <Text style={styles.label}>Tingkat Role</Text>
                <View style={styles.roleSelector}>
                  {CREATABLE_ROLES.map((r) => {
                    const isSelected = newRole === r;
                    const c = ROLE_COLOR[r];
                    return (
                      <TouchableOpacity
                        key={r}
                        onPress={() => setNewRole(r)}
                        style={[
                          styles.roleOption,
                          isSelected && { backgroundColor: c + '14', borderColor: c },
                        ]}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.roleOptionText, isSelected && { color: c, fontWeight: '700' }]}>
                          {ROLE_LABEL[r]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.createBtn, creating && styles.createBtnDisabled]}
              onPress={handleCreate}
              disabled={creating}
              activeOpacity={0.85}
            >
              {creating ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.createBtnText}>Simpan Akun</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Pemilihan Role (@desainpakeai) */}
      <Modal
        visible={roleModalUser !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!savingRole) setRoleModalUser(null);
        }}
      >
        <View style={styles.centerModalOverlay}>
          <View style={styles.roleModalCard}>
            <View style={styles.modalHeaderCluster}>
              <View style={styles.roleAvatarBadge}>
                <Ionicons name="swap-horizontal" size={22} color="#0369a1" />
              </View>
              <Text style={styles.customModalTitle}>Pilih Role Pengguna</Text>
              <Text style={styles.customModalDesc} numberOfLines={1}>
                {roleModalUser?.nama} ({roleModalUser?.email})
              </Text>
            </View>

            {roleModalError && (
              <View style={styles.modalError}>
                <Ionicons name="alert-circle" size={13} color="#dc2626" />
                <Text style={styles.modalErrorText}>{roleModalError}</Text>
              </View>
            )}

            <View style={styles.roleListWrap}>
              {(['admin', 'sekolah', 'guru', 'murid', 'pengguna'] as const).map((r) => {
                const isSelected = selectedNewRole === r;
                const c = ROLE_COLOR[r];
                return (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setSelectedNewRole(r)}
                    style={[
                      styles.roleItemCard,
                      isSelected && { borderColor: c, backgroundColor: c + '0a' },
                    ]}
                    activeOpacity={0.7}
                  >
                    <View style={styles.roleItemLeft}>
                      <View style={[styles.roleDot, { backgroundColor: c }]} />
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.roleItemLabel, isSelected && { color: c, fontWeight: '700' }]}>
                            {ROLE_LABEL[r]}
                          </Text>
                          {roleModalUser?.role === r && (
                            <View style={styles.currentRoleTag}>
                              <Text style={styles.currentRoleTagText}>Saat Ini</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.roleItemDesc}>{ROLE_DESC[r]}</Text>
                      </View>
                    </View>
                    <Ionicons
                      name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={isSelected ? c : '#cbd5e1'}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                onPress={() => setRoleModalUser(null)}
                disabled={savingRole}
                style={styles.modalCancelBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelBtnText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmRoleChange}
                disabled={savingRole || selectedNewRole === roleModalUser?.role}
                style={[
                  styles.modalSaveBtn,
                  (savingRole || selectedNewRole === roleModalUser?.role) && styles.modalSaveBtnDisabled,
                ]}
                activeOpacity={0.8}
              >
                {savingRole ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>Terapkan Role</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Konfirmasi Hapus Pengguna (@desainpakeai) */}
      <Modal
        visible={deleteModalUser !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!deletingUser) setDeleteModalUser(null);
        }}
      >
        <View style={styles.centerModalOverlay}>
          <View style={styles.deleteModalCard}>
            <View style={styles.deleteAvatarBadge}>
              <Ionicons name="trash-outline" size={24} color="#dc2626" />
            </View>

            <Text style={styles.customModalTitle}>Hapus Akun Pengguna</Text>
            <Text style={styles.customModalDesc}>
              Akun pengguna akan dihapus permanen dari sistem SKITA. Akses kelas dan catatan pengguna akan terhapus.
            </Text>

            {deleteModalError && (
              <View style={styles.modalError}>
                <Ionicons name="alert-circle" size={13} color="#dc2626" />
                <Text style={styles.modalErrorText}>{deleteModalError}</Text>
              </View>
            )}

            {deleteModalUser && (
              <View style={styles.deleteTargetBox}>
                <Text style={styles.deleteTargetNama} numberOfLines={1}>{deleteModalUser.nama}</Text>
                <Text style={styles.deleteTargetEmail}>{deleteModalUser.email}</Text>
                <View style={styles.deleteTargetMetaRow}>
                  <View style={[styles.rolePill, { backgroundColor: (ROLE_COLOR[deleteModalUser.role] || '#475569') + '15' }]}>
                    <Text style={[styles.roleText, { color: ROLE_COLOR[deleteModalUser.role] || '#475569' }]}>
                      {ROLE_LABEL[deleteModalUser.role] || deleteModalUser.role}
                    </Text>
                  </View>
                  <Text style={styles.deleteTargetSubText}>ID: {deleteModalUser.id}</Text>
                </View>
              </View>
            )}

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                onPress={() => setDeleteModalUser(null)}
                disabled={deletingUser}
                style={styles.modalCancelBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelBtnText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmDeleteUser}
                disabled={deletingUser}
                style={styles.modalDeleteBtn}
                activeOpacity={0.8}
              >
                {deletingUser ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalDeleteBtnText}>Hapus Akun</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    padding: 2,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  headerSub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#047857',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
  },
  addBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  filterBarWrapper: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  filterBarContent: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  filterPillActive: {
    backgroundColor: '#047857',
    borderColor: '#047857',
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  filterPillTextActive: {
    color: '#ffffff',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    marginHorizontal: 14,
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 11,
    color: '#dc2626',
    fontWeight: '500',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 14,
    paddingTop: 8,
    gap: 6,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 48,
    gap: 8,
  },
  emptyText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userMain: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  userEmail: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
    flexWrap: 'wrap',
  },
  rolePill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  roleText: {
    fontSize: 9,
    fontWeight: '700',
  },
  warnPill: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  warnText: {
    fontSize: 9,
    color: '#92400e',
    fontWeight: '600',
  },
  inactivePill: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  inactiveText: {
    fontSize: 9,
    color: '#475569',
    fontWeight: '600',
  },
  actionCol: {
    gap: 5,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  roleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    width: 68,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bae6fd',
    backgroundColor: '#f0f9ff',
  },
  roleBtnText: {
    fontSize: 10,
    color: '#0369a1',
    fontWeight: '600',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    width: 68,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  deleteBtnText: {
    fontSize: 10,
    color: '#dc2626',
    fontWeight: '600',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalSub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  modalError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 7,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 10,
  },
  modalErrorText: {
    fontSize: 11,
    color: '#dc2626',
    flex: 1,
  },
  formStack: {
    gap: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 3,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  roleSelector: {
    flexDirection: 'row',
    gap: 6,
  },
  roleOption: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  roleOptionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  createBtn: {
    backgroundColor: '#047857',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 14,
  },
  createBtnDisabled: {
    opacity: 0.6,
  },
  createBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },

  // Modal Custom Role & Hapus (@desainpakeai)
  centerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  roleModalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 20,
    gap: 14,
    elevation: 6,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  deleteModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    gap: 12,
    elevation: 6,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  modalHeaderCluster: {
    alignItems: 'center',
    gap: 4,
  },
  roleAvatarBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e0f2fe',
    borderWidth: 1,
    borderColor: '#bae6fd',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  deleteAvatarBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  customModalDesc: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 17,
  },
  roleListWrap: {
    gap: 8,
  },
  roleItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  roleItemLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flex: 1,
  },
  roleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
  },
  roleItemLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
  },
  roleItemDesc: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
    lineHeight: 14,
  },
  currentRoleTag: {
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  currentRoleTagText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#64748b',
  },
  deleteTargetBox: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 4,
  },
  deleteTargetNama: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  deleteTargetEmail: {
    fontSize: 11,
    color: '#64748b',
  },
  deleteTargetMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  deleteTargetSubText: {
    fontSize: 10,
    color: '#94a3b8',
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 6,
  },
  modalCancelBtn: {
    flex: 1,
    height: 42,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  modalCancelBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  modalSaveBtn: {
    flex: 1,
    height: 42,
    borderRadius: 9,
    backgroundColor: '#047857',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveBtnDisabled: {
    backgroundColor: '#94a3b8',
    opacity: 0.6,
  },
  modalSaveBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  modalDeleteBtn: {
    flex: 1,
    height: 42,
    borderRadius: 9,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDeleteBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
});
