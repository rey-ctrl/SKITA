export type Jenjang = 'SMP' | 'MTs' | 'SMA' | 'SMK' | 'MA';
export type StatusSekolah = 'Negeri' | 'Swasta';

export interface User {
  id: string;
  nama: string;
  email: string;
  provinsi: string;
  kota_kab: string;
  role: 'parent' | 'student' | 'school' | 'guest';
}

export interface UserLocation {
  id: string;
  label: string; // e.g., 'Rumah Utama', 'Rumah Kakek'
  alamat: string;
  lat: number;
  lng: number;
  is_default: boolean;
  kecamatan?: string;
  kelurahan?: string;
}

export interface School {
  id: string;
  place_id: string;
  npsn?: string;
  nama: string;
  jenjang: Jenjang;
  status: StatusSekolah;
  alamat: string;
  lat: number;
  lng: number;
  foto_url: string;
  kecamatan: string;
  kelurahan: string;
  kota_kab: string;
  provinsi: string;
  telepon?: string;
  website?: string;
  is_custom_added?: boolean;
}

export interface KlusterJarak {
  min_m: number;
  max_m: number;
  nama: string;
}

export interface SchoolZone {
  id: string;
  school_id: string;
  tipe: 'radius' | 'wilayah' | 'gabungan';
  radius_m: number;
  wilayah?: string[]; // daftar kecamatan/kelurahan
  kluster?: KlusterJarak[];
  jarak_terjauh_diterima_m?: number;
  daya_tampung_zonasi?: number;
  jumlah_pendaftar?: number;
  tahun_ajaran: string;
  sumber: string;
  tanggal_verifikasi: string;
}

export interface ZoneEvaluation {
  status: 'MASUK_ZONA' | 'LUAR_ZONA' | 'BELUM_TERSEDIA';
  jarak_m: number;
  jarak_rute_m: number;
  durasi_motor_menit: number;
  durasi_jalan_menit: number;
  kluster_nama?: string;
  peluang?: {
    label: 'Tinggi' | 'Sedang' | 'Rendah';
    range: string;
    percentEst: number;
  };
  alasan: string;
  disclaimer: string;
}

export interface FilterState {
  searchQuery: string;
  jenjang: Jenjang | 'SEMUA';
  status: StatusSekolah | 'SEMUA';
  maxJarakKm: number;
  zonasiOnly: boolean;
  sortBy: 'jarak' | 'nama';
}

export interface ProvinceData {
  id: string;
  name: string;
  cities: string[];
}
