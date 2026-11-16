import { User, UserLocation, School, SchoolZone } from '../types/index.js';
import bcrypt from 'bcryptjs';

export const INITIAL_SCHOOLS_DB: School[] = [];

export const INITIAL_ZONES_DB: Record<string, SchoolZone> = {};

export const MOCK_PLACES_API: Array<Omit<School, 'id'> & { place_id: string }> = [];

class MemoryDatabase {
  users: Map<string, User> = new Map();
  userLocations: Map<string, UserLocation[]> = new Map();
  schools: Map<string, School> = new Map();
  zones: Map<string, SchoolZone> = new Map();

  constructor() {
    // Database starts completely clean (dummy schools removed per user request)

    // Default demo user for test login
    const salt = bcrypt.genSaltSync(10);
    const demoUser: User = {
      id: 'usr_demo_1',
      nama: 'Budi Santoso',
      email: 'budi@skita.id',
      password_hash: bcrypt.hashSync('skita2026', salt),
      provinsi: 'Jawa Barat',
      kota_kab: 'Kota Bogor',
      role: 'parent',
      created_at: new Date().toISOString(),
    };
    this.users.set(demoUser.id, demoUser);

    this.userLocations.set(demoUser.id, [
      {
        id: 'loc_home_1',
        user_id: demoUser.id,
        label: 'Rumah Utama (Sempur)',
        alamat: 'Jl. Sempur Kaler No. 12, Sempur, Bogor Tengah',
        lat: -6.5912,
        lng: 106.7995,
        kecamatan: 'Bogor Tengah',
        kelurahan: 'Sempur',
        is_default: true,
      },
    ]);
  }
}

export const db = new MemoryDatabase();
