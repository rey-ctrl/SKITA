import { School, SchoolZone, ProvinceData, UserLocation } from '../types';

export const PROVINCES_DATA: ProvinceData[] = [
  {
    id: 'jabar',
    name: 'Jawa Barat',
    cities: [
      'Kota Bogor',
      'Kabupaten Bogor',
      'Kota Depok',
      'Kota Bekasi',
      'Kota Bandung',
      'Kota Sukabumi',
      'Kabupaten Sukabumi',
      'Kabupaten Cianjur',
    ],
  },
  {
    id: 'dki',
    name: 'DKI Jakarta',
    cities: [
      'Kota Administrasi Jakarta Selatan',
      'Kota Administrasi Jakarta Pusat',
      'Kota Administrasi Jakarta Timur',
      'Kota Administrasi Jakarta Barat',
      'Kota Administrasi Jakarta Utara',
    ],
  },
  {
    id: 'banten',
    name: 'Banten',
    cities: ['Kota Tangerang', 'Kota Tangerang Selatan', 'Kabupaten Tangerang', 'Kota Serang'],
  },
  {
    id: 'jateng',
    name: 'Jawa Tengah',
    cities: ['Kota Semarang', 'Kota Surakarta (Solo)', 'Kota Magelang'],
  },
  {
    id: 'jatim',
    name: 'Jawa Timur',
    cities: ['Kota Surabaya', 'Kota Malang', 'Kota Sidoarjo'],
  },
];

export const DEFAULT_LOCATIONS: UserLocation[] = [];

export const INITIAL_SCHOOLS: School[] = [];

export const INITIAL_ZONES: Record<string, SchoolZone> = {};

export const MOCK_EXTERNAL_PLACES: Array<Omit<School, 'id'> & { place_id: string }> = [];
