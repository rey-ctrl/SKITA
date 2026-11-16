import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { School, ZoneEvaluation } from '../types';
import { useApp } from '../context/AppContext';
import { formatDistance } from '../utils/geo';
import { Ionicons, Feather } from '@expo/vector-icons';

interface SchoolCardProps {
  school: School;
  evaluation: ZoneEvaluation;
}

export const SchoolCard: React.FC<SchoolCardProps> = ({ school, evaluation }) => {
  const { setSelectedSchool } = useApp();
  const isSwasta = school.status === 'Swasta';

  const zonaBadge = () => {
    if (isSwasta) return <View style={styles.badgeSwasta}><Text style={styles.badgeSwastaText}>Mandiri</Text></View>;
    if (evaluation.status === 'MASUK_ZONA')
      return <View style={styles.badgeMasuk}><Ionicons name="checkmark-circle" size={10} color="#047857" /><Text style={styles.badgeMasukText}>Masuk</Text></View>;
    if (evaluation.status === 'LUAR_ZONA')
      return <View style={styles.badgeLuar}><Ionicons name="close-circle" size={10} color="#be123c" /><Text style={styles.badgeLuarText}>Luar</Text></View>;
    return <View style={styles.badgeBelum}><Ionicons name="help-circle" size={10} color="#64748b" /><Text style={styles.badgeBelumText}>Zona?</Text></View>;
  };

  const peluangLabel = !isSwasta && evaluation.peluang ? evaluation.peluang.label : null;

  return (
    <TouchableOpacity onPress={() => setSelectedSchool(school)} style={styles.card} activeOpacity={0.72}>
      <View style={styles.body}>
        {/* Baris 1: Nama + badge zona */}
        <View style={styles.row1}>
          <Text style={styles.name} numberOfLines={1}>{school.nama}</Text>
          {zonaBadge()}
        </View>

        {/* Baris 2: chips footer + chevron */}
        <View style={styles.row2}>
          <View style={styles.chips}>
            {/* Lokasi */}
            <View style={styles.chipLoc}>
              <Ionicons name="location-outline" size={9} color="#94a3b8" />
              <Text style={styles.chipLocTxt} numberOfLines={1}>{school.kecamatan}</Text>
            </View>

            {/* Jarak — hanya untuk Negeri */}
            {!isSwasta && (
              <View style={styles.chipDist}>
                <Ionicons name="navigate" size={9} color="#047857" style={{ transform: [{ rotate: '45deg' }] }} />
                <Text style={styles.chipDistTxt}>{formatDistance(evaluation.jarak_m)}</Text>
              </View>
            )}

            {/* Peluang (Negeri) atau Bebas Zonasi (Swasta) */}
            {peluangLabel ? (
              <View style={[styles.chip,
                peluangLabel === 'Tinggi' ? styles.pTinggi :
                peluangLabel === 'Sedang' ? styles.pSedang : styles.pRendah]}>
                <Text style={[styles.chipTxt,
                  peluangLabel === 'Tinggi' ? styles.pTinggiTxt :
                  peluangLabel === 'Sedang' ? styles.pSedangTxt : styles.pRendahTxt]}>
                  {peluangLabel}
                </Text>
              </View>
            ) : isSwasta ? (
              <View style={styles.chipMandiri}>
                <Text style={styles.chipMandiriTxt}>Bebas Zonasi</Text>
              </View>
            ) : null}
          </View>

          <Feather name="chevron-right" size={13} color="#cbd5e1" />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  body: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 8,
  },
  row1: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 19,
  },
  row2: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'nowrap',
    flexShrink: 1,
    overflow: 'hidden',
  },
  chip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 0.5,
  },
  chipTxt: {
    fontSize: 10,
    fontWeight: '700',
  },
  chipLoc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#f8fafc',
    borderWidth: 0.5,
    borderColor: '#e2e8f0',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    maxWidth: 120,
  },
  chipLocTxt: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '500',
  },
  chipDist: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#f0fdf4',
    borderWidth: 0.5,
    borderColor: '#bbf7d0',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  chipDistTxt: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
  },
  chipMandiri: {
    backgroundColor: '#faf5ff',
    borderWidth: 0.5,
    borderColor: '#d8b4fe',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  chipMandiriTxt: {
    fontSize: 10,
    fontWeight: '600',
    color: '#7e22ce',
  },
  // Peluang variants
  pTinggi:    { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' },
  pSedang:    { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
  pRendah:    { backgroundColor: '#fff1f2', borderColor: '#fecdd3' },
  pTinggiTxt: { color: '#047857' },
  pSedangTxt: { color: '#b45309' },
  pRendahTxt: { color: '#be123c' },
  // Zona badges
  badgeMasuk: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: '#dcfce7', borderWidth: 0.5, borderColor: '#86efac',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10,
  },
  badgeMasukText:  { fontSize: 9, fontWeight: '700', color: '#065f46' },
  badgeLuar: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: '#ffe4e6', borderWidth: 0.5, borderColor: '#fecdd3',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10,
  },
  badgeLuarText:   { fontSize: 9, fontWeight: '700', color: '#9f1239' },
  badgeBelum: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: '#f1f5f9', borderWidth: 0.5, borderColor: '#cbd5e1',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10,
  },
  badgeBelumText:  { fontSize: 9, fontWeight: '600', color: '#475569' },
  badgeSwasta: {
    backgroundColor: '#faf5ff', borderWidth: 0.5, borderColor: '#d8b4fe',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10,
  },
  badgeSwastaText: { fontSize: 9, fontWeight: '700', color: '#7e22ce' },
});
