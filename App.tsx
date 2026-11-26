import React, { useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Ionicons, Feather } from '@expo/vector-icons';
import { AppProvider, useApp } from './src/context/AppContext';
import { Header } from './src/components/Header';
import { Navigation } from './src/components/Navigation';
import { DashboardScreen } from './src/components/DashboardScreen';
import { InteractiveMapNative } from './src/components/InteractiveMapNative';
import { SearchOnTheFlyModal } from './src/components/SearchOnTheFlyModal';
import { ProfileScreen } from './src/components/ProfileScreen';
import { ClassroomView, AdminKelasView } from './src/components/ClassroomModal';
import { AttendanceScreen } from './src/components/AttendanceScreen';
import { KantinScreen } from './src/components/KantinScreen';
import { HistoryScreen } from './src/components/HistoryScreen';
import { FilterModal } from './src/components/FilterModal';
import { SchoolDetailModal } from './src/components/SchoolDetailModal';
import { SetLocationModal } from './src/components/SetLocationModal';
import { AnimatedSplashScreen } from './src/components/AnimatedSplashScreen';
import { AuthScreen } from './src/components/AuthScreen';

const MainAppContent: React.FC = () => {
  const { activeTab, user, isGuest } = useApp();

  // Belum login dan bukan tamu → tampilkan AuthScreen
  if (!user && !isGuest) {
    return (
      <SafeAreaView style={styles.safeAreaAuth} edges={['top', 'left', 'right', 'bottom']}>
        <StatusBar style="dark" />
        <AuthScreen />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />

      {/* Top Header */}
      <Header />

      {/* Main View Area */}
      <View style={styles.contentArea}>
        {activeTab === 'beranda' && <DashboardScreen />}
        {activeTab === 'peta' && <InteractiveMapNative />}
        {activeTab === 'sof' && <SearchOnTheFlyModal />}
        {/* sekolah = ClassroomView dalam mode school portal / join flow */}
        {activeTab === 'sekolah' && <ClassroomView />}
        {/* dashboard = ClassroomView juga (school dashboard setelah join) */}
        {activeTab === 'dashboard' && <ClassroomView />}
        {activeTab === 'kelas' && (user?.role === 'admin' ? <AdminKelasView /> : <ClassroomView />)}
        {activeTab === 'absensi' && <AttendanceScreen />}
        {activeTab === 'kantin' && <KantinScreen />}
        {activeTab === 'history' && <HistoryScreen />}
        {activeTab === 'profil' && <ProfileScreen mode="umum" />}
        {activeTab === 'profil_sekolah' && <ProfileScreen mode="sekolah" />}
      </View>

      {/* Bottom Tabs */}
      <Navigation />

      {/* Modals & Sheets */}
      <FilterModal />
      <SchoolDetailModal />
      <SetLocationModal />
    </SafeAreaView>
  );
};

export default function App() {
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
    ...Feather.font,
  });

  const [splashDone, setSplashDone] = useState(false);

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AppProvider>
        <MainAppContent />
        {!splashDone && (
          <AnimatedSplashScreen onFinish={() => setSplashDone(true)} />
        )}
      </AppProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#047857',
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#047857',
  },
  safeAreaAuth: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  contentArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
});
