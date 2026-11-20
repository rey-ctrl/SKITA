import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp, TabType } from '../context/AppContext';
import { Ionicons } from '@expo/vector-icons';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface TabItem {
  id: TabType;
  label: string;
  iconActive: IconName;
  iconInactive: IconName;
}

export const Navigation: React.FC = () => {
  const { activeTab, setActiveTab, user, userSchool, activeClass } = useApp();
  const insets = useSafeAreaInsets();

  const role = user?.role;
  const isAdmin = role === 'admin';
  const isGuru = role === 'guru';
  const isMurid = role === 'murid';
  const isSekolah = role === 'sekolah';

  // Tentukan susunan tab berdasarkan role + status keanggotaan
  //
  // Belum login / guest / belum punya sekolah:  [Beranda, Sekolah]
  // Murid belum di kelas:                        [Dashboard, Sekolah]  (beranda diganti dashboard sekolah)
  // Murid sudah di kelas:                        [Kelas, Absensi, Kantin]
  // Guru:                                        [Dashboard, Kelas, Absensi, Kantin, History]
  // Admin:                                       [Dashboard, Kelas, Absensi, Kantin, History, Cari]
  // Sekolah (akun lembaga):                      [Beranda, Kelas]

  let tabs: TabItem[];

  const profileTab: TabItem = {
    id: 'profil',
    label: 'Profil',
    iconActive: 'person',
    iconInactive: 'person-outline',
  };

  if (!user || !userSchool) {
    // Belum bergabung sekolah
    tabs = [
      { id: 'beranda', label: 'Beranda', iconActive: 'home', iconInactive: 'home-outline' },
      ...(isAdmin
        ? [{ id: 'sof' as TabType, label: 'Cari', iconActive: 'search' as IconName, iconInactive: 'search-outline' as IconName }]
        : []),
      { id: 'sekolah', label: 'Sekolah', iconActive: 'school', iconInactive: 'school-outline' },
      profileTab,
    ];
  } else if (isMurid && !activeClass) {
    // Murid sudah di sekolah, belum di dalam kelas
    tabs = [
      { id: 'dashboard', label: 'Dashboard', iconActive: 'grid', iconInactive: 'grid-outline' },
      { id: 'sekolah', label: 'Kelas', iconActive: 'book', iconInactive: 'book-outline' },
      profileTab,
    ];
  } else if (isMurid && activeClass) {
    // Di dalam bottom bar kelas murid: hanya Kelas, Absensi, Kantin (tanpa Profil)
    tabs = [
      { id: 'kelas', label: 'Kelas', iconActive: 'book', iconInactive: 'book-outline' },
      { id: 'absensi', label: 'Absensi', iconActive: 'finger-print', iconInactive: 'finger-print' },
      { id: 'kantin', label: 'Kantin', iconActive: 'storefront', iconInactive: 'storefront-outline' },
    ];
  } else if (isSekolah) {
    tabs = [
      { id: 'beranda', label: 'Beranda', iconActive: 'home', iconInactive: 'home-outline' },
      { id: 'kelas', label: 'Kelas', iconActive: 'book', iconInactive: 'book-outline' },
      profileTab,
    ];
  } else if (isGuru) {
    // Guru: Dashboard Sekolah, Absensi, Kantin, History, Profil (tanpa tab Kelas)
    tabs = [
      { id: 'dashboard', label: 'Dashboard', iconActive: 'grid', iconInactive: 'grid-outline' },
      { id: 'absensi', label: 'Absensi', iconActive: 'finger-print', iconInactive: 'finger-print' },
      { id: 'kantin', label: 'Kantin', iconActive: 'storefront', iconInactive: 'storefront-outline' },
      { id: 'history', label: 'History', iconActive: 'time', iconInactive: 'time-outline' },
      profileTab,
    ];
  } else if (isAdmin) {
    // Admin: Dashboard, Kelas, Absensi, Kantin, History, Cari, Profil
    tabs = [
      { id: 'dashboard', label: 'Dashboard', iconActive: 'grid', iconInactive: 'grid-outline' },
      { id: 'kelas', label: 'Kelas', iconActive: 'book', iconInactive: 'book-outline' },
      { id: 'absensi', label: 'Absensi', iconActive: 'finger-print', iconInactive: 'finger-print' },
      { id: 'kantin', label: 'Kantin', iconActive: 'storefront', iconInactive: 'storefront-outline' },
      { id: 'history', label: 'History', iconActive: 'time', iconInactive: 'time-outline' },
      { id: 'sof', label: 'Cari', iconActive: 'search', iconInactive: 'search-outline' },
      profileTab,
    ];
  } else {
    tabs = [
      { id: 'beranda', label: 'Beranda', iconActive: 'home', iconInactive: 'home-outline' },
      { id: 'sekolah', label: 'Sekolah', iconActive: 'school', iconInactive: 'school-outline' },
      profileTab,
    ];
  }

  // Guard: kalau activeTab tidak ada di susunan tab saat ini, pindah ke tab pertama
  useEffect(() => {
    const ids = tabs.map((t) => t.id);
    if (!ids.includes(activeTab)) {
      setActiveTab(ids[0]);
    }
  }, [role, userSchool?.id, activeClass?.id]);

  return (
    <View style={[styles.navBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            onPress={() => setActiveTab(tab.id)}
            style={styles.tabBtn}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isActive ? tab.iconActive : tab.iconInactive}
              size={22}
              color={isActive ? '#047857' : '#475569'}
            />
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
              {tab.label}
            </Text>
            {isActive && <View style={styles.activeDot} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  navBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
    paddingHorizontal: 6,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    zIndex: 40,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
  },
  tabLabel: {
    fontSize: 10,
    color: '#334155',
    marginTop: 2,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#047857',
    fontWeight: '700',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#047857',
    marginTop: 2,
  },
});
