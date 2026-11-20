import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../services/api';

interface DissolutionBannerProps {
  classId: string;
  onRefresh?: () => void;
}

export const DissolutionBanner: React.FC<DissolutionBannerProps> = ({ classId, onRefresh }) => {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [banner, setBanner] = useState<{
    has_banner: boolean;
    schedule_id?: string;
    dissolution_time?: string;
    message?: string;
    can_manage?: boolean;
  } | null>(null);

  const fetchBanner = useCallback(async () => {
    if (!classId) return;
    try {
      const res = await apiClient.getDissolutionBanner(classId);
      setBanner(res);
    } catch {
      setBanner(null);
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    fetchBanner();
  }, [fetchBanner]);

  if (loading || !banner?.has_banner) return null;

  const handleCancel = () => {
    if (!banner.schedule_id) return;
    Alert.alert(
      'Urungkan Pembubaran',
      'Apakah Anda yakin ingin membatalkan pembubaran kelas ini?',
      [
        { text: 'Kembali', style: 'cancel' },
        {
          text: 'Urungkan',
          style: 'default',
          onPress: async () => {
            setActionLoading(true);
            try {
              await apiClient.cancelDissolution(banner.schedule_id!);
              Alert.alert('Sukses', 'Pembubaran kelas telah dibatalkan.');
              fetchBanner();
              onRefresh?.();
            } catch (e: any) {
              Alert.alert('Gagal', e.message || 'Gagal membatalkan pembubaran.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleExecuteNow = () => {
    if (!banner.schedule_id) return;
    Alert.alert(
      'Jalankan Pembubaran Sekarang',
      'Semua anggota kelas akan dikeluarkan dan murid ditandai selesai periode. Tindakan ini tidak bisa dibatalkan.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Jalankan Sekarang',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await apiClient.executeDissolutionNow(banner.schedule_id!);
              Alert.alert('Selesai', 'Pembubaran kelas berhasil dieksekusi.');
              fetchBanner();
              onRefresh?.();
            } catch (e: any) {
              Alert.alert('Gagal', e.message || 'Gagal mengeksekusi pembubaran.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const formattedTime = banner.dissolution_time
    ? new Date(banner.dissolution_time).toLocaleString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Ionicons name="warning" size={20} color="#b45309" />
        <Text style={styles.title}>Jadwal Pembubaran Kelas</Text>
      </View>
      <Text style={styles.message}>
        {banner.message ||
          `Kelas akan dibubarkan pada ${formattedTime || 'waktu yang ditentukan'}. Setelah itu kamu keluar dari kelas.`}
      </Text>
      {banner.can_manage && banner.schedule_id && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.btn, styles.cancelBtn]}
            onPress={handleCancel}
            disabled={actionLoading}
            activeOpacity={0.8}
          >
            <Text style={styles.cancelBtnText}>Urungkan</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.executeBtn]}
            onPress={handleExecuteNow}
            disabled={actionLoading}
            activeOpacity={0.8}
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.executeBtnText}>Jalankan Sekarang</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400e',
  },
  message: {
    fontSize: 13,
    color: '#78350f',
    lineHeight: 18,
    marginBottom: 10,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  btn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  cancelBtn: {
    backgroundColor: '#ffffff',
    borderColor: '#d97706',
    borderWidth: 1,
  },
  cancelBtnText: {
    color: '#b45309',
    fontSize: 12,
    fontWeight: '600',
  },
  executeBtn: {
    backgroundColor: '#dc2626',
  },
  executeBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
});
