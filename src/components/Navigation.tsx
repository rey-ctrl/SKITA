import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp, TabType } from '../context/AppContext';

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

  let tabs: TabItem[];

  const profileUmumTab: TabItem = {
    id: 'profil',
    label: 'Profil',
    iconActive: 'person',
    iconInactive: 'person-outline',
  };

  const profileSekolahTab: TabItem = {
    id: 'profil_sekolah',
    label: 'Profil Sekolah',
    iconActive: 'person-circle',
    iconInactive: 'person-circle-outline',
  };

  // 1. Saat di Beranda, Cari, atau Profil Umum:
  // Tab 'Beranda', 'Cari', dan 'Profil' (Umum) aktif di sini.
  if (activeTab === 'beranda' || activeTab === 'sof' || activeTab === 'profil') {
    tabs = [
      { id: 'beranda', label: 'Beranda', iconActive: 'home', iconInactive: 'home-outline' },
      ...(isAdmin
        ? [{ id: 'sof' as TabType, label: 'Cari', iconActive: 'search' as IconName, iconInactive: 'search-outline' as IconName }]
        : []),
      {
        id: (isAdmin || isGuru || isSekolah ? 'dashboard' : isMurid && activeClass ? 'kelas' : 'sekolah') as TabType,
        label: isMurid && activeClass ? 'Kelas' : 'Sekolah',
        iconActive: 'school',
        iconInactive: 'school-outline',
      },
      profileUmumTab,
    ];
  } else if (!user || (!userSchool && !isAdmin && !isSekolah)) {
    // 2. Belum login / belum punya sekolah (dan bukan admin/sekolah)
    tabs = [
      { id: 'beranda', label: 'Beranda', iconActive: 'home', iconInactive: 'home-outline' },
      ...(isAdmin
        ? [{ id: 'sof' as TabType, label: 'Cari', iconActive: 'search' as IconName, iconInactive: 'search-outline' as IconName }]
        : []),
      { id: 'sekolah', label: 'Sekolah', iconActive: 'school', iconInactive: 'school-outline' },
      profileUmumTab,
    ];
  } else if (isAdmin) {
    // 3. Admin saat akses modul sekolah:
    // Tab Beranda & Cari tidak ada di bottom bar sekolah (Beranda di Header atas, Cari di navigasi umum).
    tabs = [
      { id: 'dashboard', label: 'Dashboard', iconActive: 'grid', iconInactive: 'grid-outline' },
      { id: 'absensi', label: 'Absensi', iconActive: 'finger-print', iconInactive: 'finger-print' },
      { id: 'kantin', label: 'Kantin', iconActive: 'storefront', iconInactive: 'storefront-outline' },
      { id: 'history', label: 'History', iconActive: 'time', iconInactive: 'time-outline' },
      profileSekolahTab,
    ];
  } else if (isGuru) {
    // 4. Guru saat akses modul sekolah:
    // Tab Beranda tidak ada di bottom bar (ada di Header atas).
    tabs = [
      { id: 'dashboard', label: 'Dashboard', iconActive: 'grid', iconInactive: 'grid-outline' },
      { id: 'absensi', label: 'Absensi', iconActive: 'finger-print', iconInactive: 'finger-print' },
      { id: 'kantin', label: 'Kantin', iconActive: 'storefront', iconInactive: 'storefront-outline' },
      { id: 'history', label: 'History', iconActive: 'time', iconInactive: 'time-outline' },
      profileSekolahTab,
    ];
  } else if (isSekolah) {
    // 5. Akun Lembaga Sekolah
    tabs = [
      { id: 'dashboard', label: 'Dashboard', iconActive: 'grid', iconInactive: 'grid-outline' },
      { id: 'kelas', label: 'Kelas', iconActive: 'book', iconInactive: 'book-outline' },
      profileSekolahTab,
    ];
  } else if (isMurid && activeClass) {
    // 6. Murid sudah di dalam kelas: hanya modul kelas, absensi, kantin (Beranda di Header atas)
    tabs = [
      { id: 'kelas', label: 'Kelas', iconActive: 'book', iconInactive: 'book-outline' },
      { id: 'absensi', label: 'Absensi', iconActive: 'finger-print', iconInactive: 'finger-print' },
      { id: 'kantin', label: 'Kantin', iconActive: 'storefront', iconInactive: 'storefront-outline' },
    ];
  } else if (isMurid && !activeClass) {
    // 7. Murid di sekolah, belum masuk kelas
    tabs = [
      { id: 'dashboard', label: 'Dashboard', iconActive: 'grid', iconInactive: 'grid-outline' },
      { id: 'sekolah', label: 'Kelas', iconActive: 'book', iconInactive: 'book-outline' },
      profileSekolahTab,
    ];
  } else {
    tabs = [
      { id: 'beranda', label: 'Beranda', iconActive: 'home', iconInactive: 'home-outline' },
      { id: 'sekolah', label: 'Sekolah', iconActive: 'school', iconInactive: 'school-outline' },
      profileUmumTab,
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
            style={styles.tabItem}
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, isActive && styles.iconContainerActive]}>
              <Ionicons
                name={isActive ? tab.iconActive : tab.iconInactive}
                size={22}
                color={isActive ? '#047857' : '#94a3b8'}
              />
            </View>
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
              {tab.label}
            </Text>
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
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  iconContainer: {
    padding: 4,
    borderRadius: 8,
  },
  iconContainerActive: {
    backgroundColor: '#ecfdf5',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#94a3b8',
    marginTop: 2,
  },
  tabLabelActive: {
    color: '#047857',
    fontWeight: '700',
  },
});
