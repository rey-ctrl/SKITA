import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User,
  UserLocation,
  School,
  SchoolZone,
  FilterState,
  ZoneEvaluation,
} from '../types';
import {
  INITIAL_SCHOOLS,
  INITIAL_ZONES,
  DEFAULT_LOCATIONS,
} from '../data/initialData';
import { evaluateSchoolZonasi, normalizeSchoolName, buildSchoolName } from '../utils/zonasi';
import { haversineDistanceKm } from '../utils/geo';
import { apiClient } from '../services/api';

export type TabType =
  | 'beranda'
  | 'peta'
  | 'sof'
  | 'sekolah'
  | 'dashboard'
  | 'kelas'
  | 'absensi'
  | 'kantin'
  | 'history'
  | 'profil';

interface AppContextType {
  user: User | null;
  isGuest: boolean;
  locations: UserLocation[];
  activeLocation: UserLocation | null;
  schools: School[];
  zones: Record<string, SchoolZone>;
  filters: FilterState;
  activeTab: TabType;
  selectedSchool: School | null;
  mapTargetSchool: School | null;
  isRegionModalOpen: boolean;
  isFilterModalOpen: boolean;
  isLocationModalOpen: boolean;
  isClassroomModalOpen: boolean;
  isCreateClassModalOpen: boolean;
  activeSchoolEvaluation: ZoneEvaluation | null;
  userSchool: { id: string; name: string; jenjang?: string } | null;
  activeClass: { id: string; name: string; schoolName: string } | null;
  availableClasses: Array<{ id: string; nama: string; tingkat?: string | number }>;
  lastAccessedClassId: string | null;
  // Actions
  setActiveTab: (tab: TabType) => void;
  setSelectedSchool: (school: School | null) => void;
  setMapTargetSchool: (school: School | null) => void;
  setIsRegionModalOpen: (open: boolean) => void;
  setIsFilterModalOpen: (open: boolean) => void;
  setIsLocationModalOpen: (open: boolean) => void;
  setIsClassroomModalOpen: (open: boolean) => void;
  setIsCreateClassModalOpen: (open: boolean) => void;
  setUserSchool: (school: { id: string; name: string; jenjang?: string } | null) => void;
  setActiveClass: (cls: { id: string; name: string; schoolName: string } | null) => void;
  setAvailableClasses: (classes: Array<{ id: string; nama: string; tingkat?: string | number }>) => void;
  setLastAccessedClassId: (id: string | null) => void;
  refreshMembershipScope: () => Promise<{ school: any; kelas: any; classes: any[] } | null>;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  saveRegion: (provinsi: string, kota_kab: string) => void;
  loginUser: (nama: string, email: string) => void;
  loginWithUserData: (user: User) => void;
  refreshUser: () => Promise<void>;
  continueAsGuest: () => void;
  logoutUser: () => void;
  addLocation: (loc: Omit<UserLocation, 'id'>) => void;
  removeLocation: (id: string) => void;
  setActiveLocationId: (id: string) => void;
  updateActiveLocationLabel: (label: string) => void;
  addSchoolFromSearch: (newSchool: Omit<School, 'id'>) => { success: boolean; message: string; school?: School };
  refreshSchools: () => Promise<void>;
  deleteSchool: (schoolId: string) => Promise<void>;
  getSchoolEvaluation: (school: School) => ZoneEvaluation;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. User state
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState<boolean>(false);

  // 2. Mandatory region modal
  const [isRegionModalOpen, setIsRegionModalOpen] = useState<boolean>(false);

  // 3. User Locations
  const [locations, setLocations] = useState<UserLocation[]>([]);
  const [activeLocationId, setActiveLocationId] = useState<string | null>(null);

  // 4. Schools Database
  const [schools, setSchools] = useState<School[]>(INITIAL_SCHOOLS);

  // Sync schools with backend PostgreSQL on mount & expose refreshSchools
  const refreshSchools = async () => {
    try {
      const res = await apiClient.getSchools({}) as { data: Array<School & { zone?: SchoolZone }> };
      if (res.data && Array.isArray(res.data)) {
        setSchools(res.data);
        const zoneMap: Record<string, SchoolZone> = {};
        res.data.forEach((s) => {
          if (s.zone) {
            zoneMap[s.id] = s.zone;
          }
        });
        setZones((prev) => ({ ...prev, ...zoneMap }));
      }
    } catch {}
  };

  useEffect(() => {
    refreshSchools();
  }, []);

  // 5. School Zones
  const [zones, setZones] = useState<Record<string, SchoolZone>>(INITIAL_ZONES);

  // 6. Navigation & Modals
  const [activeTab, setActiveTab] = useState<TabType>('beranda');
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [mapTargetSchool, setMapTargetSchool] = useState<School | null>(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isClassroomModalOpen, setIsClassroomModalOpen] = useState(false);
  const [isCreateClassModalOpen, setIsCreateClassModalOpen] = useState(false);

  // 7. Membership State (shared across nav + classroom view)
  const [userSchool, setUserSchool] = useState<{ id: string; name: string; jenjang?: string } | null>(null);
  const [activeClass, setActiveClass] = useState<{ id: string; name: string; schoolName: string } | null>(null);
  const [availableClasses, setAvailableClasses] = useState<Array<{ id: string; nama: string; tingkat?: string | number }>>([]);
  const [lastAccessedClassId, setLastAccessedClassId] = useState<string | null>(null);

  const refreshMembershipScope = async () => {
    try {
      const res = await apiClient.getMonitoringScope();
      if (res.school) {
        setUserSchool({ id: res.school.id, name: res.school.nama, jenjang: (res.school as any).jenjang });
      } else {
        setUserSchool(null);
      }
      if (res.kelas) {
        setActiveClass({
          id: res.kelas.id,
          name: res.kelas.nama,
          schoolName: res.school?.nama || '',
        });
      }
      if (res.classes) {
        setAvailableClasses(res.classes);
      }
      return { school: res.school, kelas: res.kelas, classes: res.classes || [] };
    } catch {
      return null;
    }
  };

  // 8. Filter State
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    jenjang: 'SEMUA',
    status: 'SEMUA',
    maxJarakKm: 15,
    zonasiOnly: false,
    sortBy: 'jarak',
  });

  const activeLocation: UserLocation | null =
    (activeLocationId ? locations.find((l) => l.id === activeLocationId) : null) || locations[0] || null;

  const getSchoolEvaluation = (school: School): ZoneEvaluation => {
    const zone = zones[school.id];
    const userLat = activeLocation ? activeLocation.lat : -6.5912;
    const userLng = activeLocation ? activeLocation.lng : 106.7995;
    const userKec = activeLocation ? activeLocation.kecamatan : undefined;
    return evaluateSchoolZonasi(
      school,
      zone,
      userLat,
      userLng,
      userKec
    );
  };

  const activeSchoolEvaluation = selectedSchool ? getSchoolEvaluation(selectedSchool) : null;

  const saveRegion = (provinsi: string, kota_kab: string) => {
    if (!provinsi || !kota_kab) return;
    setUser((prev) => ({
      id: prev?.id || `usr_${Date.now()}`,
      nama: prev?.nama || 'Pengguna SKITA',
      email: prev?.email || 'user@skita.id',
      role: prev?.role || 'pengguna',
      provinsi,
      kota_kab,
    }));
    setIsRegionModalOpen(false);
  };

  const loginUser = (nama: string, email: string) => {
    setUser({
      id: `usr_${Date.now()}`,
      nama,
      email,
      provinsi: 'Jawa Barat',
      kota_kab: 'Kota Bogor',
      role: 'pengguna',
    });
    setIsGuest(false);
  };

  const loginWithUserData = (userData: User) => {
    setUser(userData);
    setIsGuest(false);
  };

  const refreshUser = async () => {
    try {
      const res = await apiClient.me();
      if (res.success && res.user) setUser(res.user);
    } catch {
      // token expired atau server offline — biarkan user tetap login dengan data lama
    }
  };

  const continueAsGuest = () => {
    setIsGuest(true);
    setUser(null);
  };

  const logoutUser = () => {
    setUser(null);
    setIsGuest(false);
    apiClient.setAuthToken(null);
  };

  const addLocation = (newLoc: Omit<UserLocation, 'id'>) => {
    const id = `loc_${Date.now()}`;
    const created: UserLocation = { ...newLoc, id };
    setLocations((prev) => [created, ...prev]);
    setActiveLocationId(id);
  };

  const removeLocation = (locId: string) => {
    setLocations((prev) => prev.filter((l) => l.id !== locId));
    setActiveLocationId((prev) => (prev === locId ? null : prev));
  };

  const updateActiveLocationLabel = (newLabel: string) => {
    setLocations((prev) => {
      if (prev.length === 0) {
        const id = `loc_${Date.now()}`;
        setActiveLocationId(id);
        return [{
          id,
          label: newLabel,
          alamat: 'Titik Acuan Kelas Terdaftar',
          lat: -6.5912,
          lng: 106.7995,
          kecamatan: 'Bogor',
          is_default: true,
        }];
      }
      const targetId = activeLocationId || prev[0].id;
      return prev.map((l) => (l.id === targetId ? { ...l, label: newLabel } : l));
    });
  };

  const addSchoolFromSearch = (newSchoolData: Omit<School, 'id'>) => {
    const cleanData = {
      ...newSchoolData,
      nama: buildSchoolName(newSchoolData.nama, newSchoolData.jenjang, newSchoolData.status),
    };

    const existsByPlaceId = schools.find((s) => s.place_id === cleanData.place_id);
    if (existsByPlaceId) {
      return {
        success: false,
        message: 'Sekolah ini sudah ada di database SKITA.',
        school: existsByPlaceId,
      };
    }

    const duplicateByName = schools.find(
      (s) =>
        s.nama.toLowerCase().trim() === cleanData.nama.toLowerCase().trim() &&
        haversineDistanceKm(s.lat, s.lng, cleanData.lat, cleanData.lng) < 0.2
    );
    if (duplicateByName) {
      return {
        success: false,
        message: 'Sekolah serupa sudah terdaftar.',
        school: duplicateByName,
      };
    }

    const newId = `sch_custom_${Date.now()}`;
    const fullSchool: School = {
      ...cleanData,
      id: newId,
      is_custom_added: true,
    };

    const isSwasta = fullSchool.status === 'Swasta';
    const defaultRadius = fullSchool.jenjang === 'SMP' ? 1500 : 2000;
    const defaultZone: SchoolZone = (newSchoolData as any).zone || {
      id: `zone_${newId}`,
      school_id: newId,
      tipe: isSwasta ? 'wilayah' : 'radius',
      radius_m: defaultRadius,
      wilayah: [fullSchool.kecamatan, 'Bogor Tengah', 'Bogor Timur', 'Bogor Barat', 'Bogor Selatan', 'Tanah Sareal', 'Bogor Utara'].filter(Boolean),
      jarak_terjauh_diterima_m: Math.round(defaultRadius * 0.9),
      daya_tampung_zonasi: isSwasta ? 200 : 180,
      jumlah_pendaftar: isSwasta ? 150 : 280,
      tahun_ajaran: '2025/2026',
      sumber: isSwasta ? 'SPMB Swasta - Domisili Bebas' : 'Juknis SPMB Disdik - Zonasi Radius',
      tanggal_verifikasi: '2026-05-15',
    };

    setSchools((prev) => [fullSchool, ...prev]);
    setZones((prev) => ({ ...prev, [newId]: defaultZone, [fullSchool.id]: defaultZone }));

    return {
      success: true,
      message: 'Sekolah berhasil disimpan ke database SKITA!',
      school: fullSchool,
    };
  };

  const deleteSchool = async (schoolId: string) => {
    try {
      await apiClient.deleteSchool(schoolId);
    } catch {}
    setSchools((prev) => prev.filter((s) => s.id !== schoolId));
    setZones((prev) => {
      const next = { ...prev };
      delete next[schoolId];
      return next;
    });
    if (selectedSchool?.id === schoolId) {
      setSelectedSchool(null);
    }
  };

  return (
    <AppContext.Provider
      value={{
        user,
        isGuest,
        locations,
        activeLocation,
        schools,
        zones,
        filters,
        activeTab,
        selectedSchool,
        mapTargetSchool,
        isRegionModalOpen,
        isFilterModalOpen,
        isLocationModalOpen,
        isClassroomModalOpen,
        isCreateClassModalOpen,
        activeSchoolEvaluation,
        userSchool,
        activeClass,
        availableClasses,
        lastAccessedClassId,
        setActiveTab,
        setSelectedSchool,
        setMapTargetSchool,
        setIsRegionModalOpen,
        setIsFilterModalOpen,
        setIsLocationModalOpen,
        setIsClassroomModalOpen,
        setIsCreateClassModalOpen,
        setUserSchool,
        setActiveClass,
        setAvailableClasses,
        setLastAccessedClassId,
        refreshMembershipScope,
        setFilters,
        saveRegion,
        loginUser,
        loginWithUserData,
        refreshUser,
        continueAsGuest,
        logoutUser,
        addLocation,
        removeLocation,
        setActiveLocationId,
        updateActiveLocationLabel,
        addSchoolFromSearch,
        refreshSchools,
        deleteSchool,
        getSchoolEvaluation,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
};
