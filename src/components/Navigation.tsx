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
    label: 'Profil',
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
    // 3. Admin saat akses modul sekolah (FR-A1)
    tabs = [
      { id: 'dashboard', label: 'Dashboard', iconActive: 'grid', iconInactive: 'grid-outline' },
      { id: 'kelas', label: 'Kelas', iconActive: 'book', iconInactive: 'book-outline' },
      { id: 'kantin', label: 'Kantin', iconActive: 'storefront', iconInactive: 'storefront-outline' },
      { id: 'history', label: 'History', iconActive: 'time', iconInactive: 'time-outline' },
      profileSekolahTab,
    ];
  } else if (isGuru) {
    // 4. Guru saat akses modul sekolah (FR-A3)
    tabs = [
      { id: 'dashboard', label: 'Dashboard', iconActive: 'grid', iconInactive: 'grid-outline' },
      { id: 'kelas', label: 'Kelas', iconActive: 'book', iconInactive: 'book-outline' },
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
    // 6. Murid sudah di dalam kelas: modul kelas, absensi, kantin, profil (Beranda di Header atas)
    tabs = [
      { id: 'kelas', label: 'Kelas', iconActive: 'book', iconInactive: 'book-outline' },
      { id: 'absensi', label: 'Absensi', iconActive: 'finger-print', iconInactive: 'finger-print' },
      { id: 'kantin', label: 'Kantin', iconActive: 'storefront', iconInactive: 'storefront-outline' },
      profileSekolahTab,
    ];
  } else if (isMurid && !activeClass) {
    // 7. Murid di sekolah, belum masuk kelas
    tabs = [
      { id: 'dashboard', label: 'Dashboard', iconActive: 'grid', iconInactive: 'grid-outline' },
      { id: 'kelas', label: 'Kelas', iconActive: 'book', iconInactive: 'book-outline' },
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
    <View style={[styles.navBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            onPress={() => setActiveTab(tab.id)}
            style={styles.tabItem}
            activeOpacity={0.7}
          >
            <View style={styles.iconContainer}>
              <Ionicons
                name={isActive ? tab.iconActive : tab.iconInactive}
                size={22}
                color={isActive ? '#047857' : '#64748b'}
              />
            </View>
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]} numberOfLines={1}>
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
    borderTopColor: '#f1f5f9',
    paddingTop: 6,
    paddingHorizontal: 8,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    paddingHorizontal: 2,
    minHeight: 46,
    minWidth: 0,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  tabLabel: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  tabLabelActive: {
    color: '#047857',
    fontWeight: '700',
  },
  activeDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: '#047857',
    marginTop: 2,
  },
});
