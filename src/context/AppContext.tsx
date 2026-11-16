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

interface AppContextType {
  user: User | null;
  isGuest: boolean;
  locations: UserLocation[];
  activeLocation: UserLocation | null;
  schools: School[];
  zones: Record<string, SchoolZone>;
  filters: FilterState;
  activeTab: 'beranda' | 'peta' | 'sof' | 'profil' | 'kelas';
  selectedSchool: School | null;
  mapTargetSchool: School | null;
  isRegionModalOpen: boolean;
  isFilterModalOpen: boolean;
  isLocationModalOpen: boolean;
  isClassroomModalOpen: boolean;
  activeSchoolEvaluation: ZoneEvaluation | null;
  // Actions
  setActiveTab: (tab: 'beranda' | 'peta' | 'sof' | 'profil' | 'kelas') => void;
  setSelectedSchool: (school: School | null) => void;
  setMapTargetSchool: (school: School | null) => void;
  setIsRegionModalOpen: (open: boolean) => void;
  setIsFilterModalOpen: (open: boolean) => void;
  setIsLocationModalOpen: (open: boolean) => void;
  setIsClassroomModalOpen: (open: boolean) => void;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  saveRegion: (provinsi: string, kota_kab: string) => void;
  loginUser: (nama: string, email: string) => void;
  loginWithUserData: (user: User) => void;
  continueAsGuest: () => void;
  logoutUser: () => void;
  addLocation: (loc: Omit<UserLocation, 'id'>) => void;
  removeLocation: (id: string) => void;
  setActiveLocationId: (id: string) => void;
  addSchoolFromSearch: (newSchool: Omit<School, 'id'>) => { success: boolean; message: string; school?: School };
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

  // Sync schools with backend PostgreSQL on mount
  useEffect(() => {
    apiClient
      .getSchools({})
      .then((res: { data: Array<School & { zone?: SchoolZone }> }) => {
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
      })
      .catch(() => {});
  }, []);

  // 5. School Zones
  const [zones, setZones] = useState<Record<string, SchoolZone>>(INITIAL_ZONES);

  // 6. Navigation & Modals
  const [activeTab, setActiveTab] = useState<'beranda' | 'peta' | 'sof' | 'profil' | 'kelas'>('beranda');
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [mapTargetSchool, setMapTargetSchool] = useState<School | null>(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isClassroomModalOpen, setIsClassroomModalOpen] = useState(false);

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
      role: prev?.role || 'parent',
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
      role: 'parent',
    });
    setIsGuest(false);
  };

  const loginWithUserData = (userData: User) => {
    setUser(userData);
    setIsGuest(false);
  };

  const continueAsGuest = () => {
    setIsGuest(true);
    setUser(null);
  };

  const logoutUser = () => {
    setUser(null);
    setIsGuest(false);
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
        activeSchoolEvaluation,
        setActiveTab,
        setSelectedSchool,
        setMapTargetSchool,
        setIsRegionModalOpen,
        setIsFilterModalOpen,
        setIsLocationModalOpen,
        setIsClassroomModalOpen,
        setFilters,
        saveRegion,
        loginUser,
        loginWithUserData,
        continueAsGuest,
        logoutUser,
        addLocation,
        removeLocation,
        setActiveLocationId,
        addSchoolFromSearch,
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
