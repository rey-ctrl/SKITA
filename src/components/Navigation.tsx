import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { Ionicons } from '@expo/vector-icons';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface TabItem {
  id: 'beranda' | 'peta' | 'sof' | 'profil' | 'kelas';
  label: string;
  iconActive: IconName;
  iconInactive: IconName;
  badge?: number;
}

export const Navigation: React.FC = () => {
  const { activeTab, setActiveTab } = useApp();
  const insets = useSafeAreaInsets();

  const tabs: TabItem[] = [
    { id: 'beranda', label: 'Beranda', iconActive: 'home', iconInactive: 'home-outline' },
    { id: 'sof', label: 'Cari Baru', iconActive: 'add-circle', iconInactive: 'add-circle-outline' },
    { id: 'kelas', label: 'Kelas', iconActive: 'school', iconInactive: 'school-outline' },
    { id: 'profil', label: 'Profil', iconActive: 'person', iconInactive: 'person-outline' },
  ];

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
            <View>
              <Ionicons
                name={isActive ? tab.iconActive : tab.iconInactive}
                size={22}
                color={isActive ? '#047857' : '#475569'}
              />
              {tab.badge !== undefined && tab.badge > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{tab.badge}</Text>
                </View>
              )}
            </View>
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
    fontSize: 11,
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
  badge: {
    position: 'absolute',
    top: -3,
    right: -8,
    backgroundColor: '#e11d48',
    borderRadius: 8,
    minWidth: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: 'bold',
  },
});
