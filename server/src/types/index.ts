export type Jenjang = 'SMP' | 'MTs' | 'SMA' | 'SMK' | 'MA';
export type StatusSekolah = 'Negeri' | 'Swasta';

// PRD Section 2 & 6: Role & Akses
export type GlobalRole = 'admin' | 'sekolah' | 'guru' | 'murid' | 'pengguna';
export type MembershipStatus = 'pending' | 'aktif' | 'keluar' | 'dikeluarkan' | 'lulus';
export type CodeScope = 'school_student' | 'school_teacher' | 'class';
export type AttendanceStatus = 'hadir' | 'sakit' | 'izin' | 'alpa';

export interface User {
  id: string;
  nama: string;
  email: string;
  password_hash: string;
  provinsi?: string;
  kota_kab?: string;
  role: GlobalRole;
  must_change_password?: boolean;
  is_active?: boolean;
  created_at: string;
  updated_at?: string;
}

// PRD 6: schools
export interface SchoolConfig {
  id: string;
  place_id: string;
  npsn?: string;
  nama: string;
  jenjang: Jenjang;
  status: StatusSekolah;
  alamat: string;
  lat: number;
  lng: number;
  foto_url?: string;
  kecamatan?: string;
  kelurahan?: string;
  kota_kab?: string;
  provinsi?: string;
  telepon?: string;
  website?: string;
  is_custom_added?: boolean;
  // PRD settings
  attendance_window_start?: string; // '07:00'
  attendance_window_end?: string;   // '09:00'
  work_days?: number[];            // [1,2,3,4,5] (Mon=1, Fri=5)
  auto_approve_teacher?: boolean;  // default false (FR-A2)
  owner_user_id?: string;          // Akun role 'sekolah' yang mengelola sekolah ini
  created_at?: string;
}

// PRD 6: school_memberships
export interface SchoolMembership {
  id: string;
  user_id: string;
  school_id: string;
  role: 'guru' | 'murid';
  status: MembershipStatus;
  joined_at: string;
  left_at?: string;
}

// PRD 6: classes
export interface SchoolClass {
  id: string;
  school_id: string;
  nama: string;
  tingkat: number | string; // e.g. 7, 8, 9 or 10, 11, 12
  created_at: string;
}

// PRD 6: periods
export interface ClassPeriod {
  id: string;
  class_id: string;
  start_date: string;
  end_date?: string;
  is_active: boolean;
}

// PRD 6: class_memberships
export interface ClassMembership {
  id: string;
  user_id: string;
  class_id: string;
  period_id: string;
  role: 'guru' | 'murid';
  status: MembershipStatus; // aktif, keluar, dikeluarkan, lulus
  joined_at: string;
  left_at?: string;
}

// PRD 6: access_codes (rotasi tiap Senin 00:00 WIB)
export interface AccessCode {
  id: string;
  scope: CodeScope;
  target_id: string; // school_id or class_id
  code: string;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
}

// PRD 6 & FR-A11: dissolution_schedules
export interface DissolutionSchedule {
  id: string;
  school_id: string;
  scheduled_at: string;
  executed_at?: string;
  status: 'terjadwal' | 'diurungkan' | 'selesai';
  created_by: string; // user id
  duration_hours: number; // default 24
}

// PRD 6 & FR-A3: subject_templates, subjects, teacher_subjects
export interface SubjectTemplate {
  jenjang: Jenjang;
  status: StatusSekolah;
  nama: string;
}

export interface Subject {
  id: string;
  school_id: string;
  nama: string;
  is_custom: boolean;
  is_active: boolean;
}

export interface TeacherSubject {
  id: string;
  user_id: string;
  school_id: string;
  subject_id: string;
}

// PRD 6 & FR-A12: assignments
export interface Assignment {
  id: string;
  class_id: string;
  period_id: string;
  creator_id: string; // guru user_id
  judul: string;
  deskripsi?: string;
  deadline?: string; // ISO datetime string
  subject_id?: string;
  subject_nama?: string;
  tanggal: string; // YYYY-MM-DD
  attachments?: Array<{
    name: string;
    type: string;
    size?: string | number;
    url?: string;
  }>;
}

export interface AssignmentSubmission {
  id: string;
  assignment_id: string;
  murid_id: string;
  murid_nama?: string;
  submitted_at: string;
  catatan?: string;
  files: Array<{
    name: string;
    type: string;
    size?: string;
    url?: string;
  }>;
}

// PRD 6 & FR-A13: holidays & school calendar overrides
export interface Holiday {
  id: string;
  tanggal: string; // YYYY-MM-DD
  nama: string;
  jenis: 'nasional' | 'cuti_bersama';
}

export interface SchoolCalendarOverride {
  id: string;
  school_id: string;
  tanggal: string; // YYYY-MM-DD
  override_type: 'masuk' | 'libur';
}

// PRD 6 & FR-A13: attendance & attendance audit
export interface Attendance {
  id: string;
  murid_id: string;
  class_id: string;
  period_id: string;
  tanggal: string; // YYYY-MM-DD
  status: AttendanceStatus;
  catatan?: string;
  diisi_oleh: string; // user_id
  waktu_isi: string;
  is_koreksi_guru?: boolean;
}

export interface AttendanceAudit {
  id: string;
  attendance_id: string;
  actor_id: string;
  timestamp: string;
  status_sebelum: AttendanceStatus;
  status_sesudah: AttendanceStatus;
  catatan_sebelum?: string;
  catatan_sesudah?: string;
}

// PRD 6: audit_log
export interface AuditLog {
  id: string;
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string;
  details?: Record<string, any>;
  timestamp: string;
}

export interface UserLocation {
  id: string;
  user_id: string;
  label: string;
  alamat: string;
  lat: number;
  lng: number;
  kecamatan?: string;
  kelurahan?: string;
  is_default: boolean;
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

export interface SchoolZone {
  id: string;
  school_id: string;
  tipe: 'radius' | 'wilayah' | 'gabungan';
  radius_m: number;
  wilayah?: string[];
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
