import {
  User,
  UserLocation,
  School,
  SchoolZone,
  SchoolConfig,
  SchoolMembership,
  SchoolClass,
  ClassPeriod,
  ClassMembership,
  AccessCode,
  DissolutionSchedule,
  Subject,
  TeacherSubject,
  Holiday,
  SchoolCalendarOverride,
  Attendance,
  AttendanceAudit,
  Assignment,
  AssignmentSubmission,
  AuditLog,
} from '../types/index.js';
import bcrypt from 'bcryptjs';

export const INITIAL_SCHOOLS_DB: School[] = [];
export const INITIAL_ZONES_DB: Record<string, SchoolZone> = {};
export const MOCK_PLACES_API: Array<Omit<School, 'id'> & { place_id: string }> = [];

class MemoryDatabase {
  // existing — zonasi/sekolah discovery (FR-DASH, FR-ZON, FR-SOF)
  users: Map<string, User> = new Map();
  userLocations: Map<string, UserLocation[]> = new Map();
  schools: Map<string, School> = new Map();
  zones: Map<string, SchoolZone> = new Map();

  // PRD Section 6 — role & akses
  schoolConfigs: Map<string, SchoolConfig> = new Map();
  schoolMemberships: Map<string, SchoolMembership> = new Map();
  classes: Map<string, SchoolClass> = new Map();
  periods: Map<string, ClassPeriod> = new Map();
  classMemberships: Map<string, ClassMembership> = new Map();
  accessCodes: Map<string, AccessCode> = new Map();
  dissolutionSchedules: Map<string, DissolutionSchedule> = new Map();
  subjects: Map<string, Subject> = new Map();
  teacherSubjects: Map<string, TeacherSubject> = new Map();
  holidays: Map<string, Holiday> = new Map();
  schoolCalendarOverrides: Map<string, SchoolCalendarOverride> = new Map();
  attendance: Map<string, Attendance> = new Map();
  attendanceAudit: Map<string, AttendanceAudit> = new Map();
  assignments: Map<string, Assignment> = new Map();
  assignmentSubmissions: Map<string, AssignmentSubmission> = new Map();
  auditLog: Map<string, AuditLog> = new Map();

  constructor() {
    const salt = bcrypt.genSaltSync(10);

    // Seed Admin pertama (FR-A15: Admin pertama lewat seed server)
    const adminUser: User = {
      id: 'usr_admin_seed',
      nama: 'Admin SKITA',
      email: 'admin@skita.id',
      password_hash: bcrypt.hashSync('Admin@2026!', salt),
      role: 'admin',
      is_active: true,
      must_change_password: true,
      created_at: new Date().toISOString(),
    };
    this.users.set(adminUser.id, adminUser);

    // Demo pengguna (belum punya role sekolah — status "pengguna")
    const demoUser: User = {
      id: 'usr_demo_1',
      nama: 'Budi Santoso',
      email: 'budi@skita.id',
      password_hash: bcrypt.hashSync('skita2026', salt),
      provinsi: 'Jawa Barat',
      kota_kab: 'Kota Bogor',
      role: 'pengguna',
      is_active: true,
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

    // ── Seed Demo Sekolah, Kelas & Akun Peran (untuk testing FR-A2, FR-A3) ──

    // Sekolah seed
    const seedSchool = {
      id: 'sch_seed_smp1',
      place_id: 'seed_place_smp1_bogor',
      nama: 'SMP Negeri 1 Bogor',
      jenjang: 'SMP' as const,
      status: 'Negeri' as const,
      alamat: 'Jl. Dr. Semeru No.1, Bogor Tengah, Kota Bogor',
      lat: -6.5924,
      lng: 106.7986,
      kecamatan: 'Bogor Tengah',
      kelurahan: 'Pabaton',
      kota_kab: 'Kota Bogor',
      provinsi: 'Jawa Barat',
      foto_url: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800&auto=format&fit=crop&q=80',
      is_custom_added: false,
    };
    this.schools.set(seedSchool.id, seedSchool);

    this.zones.set(seedSchool.id, {
      id: 'zone_seed_smp1',
      school_id: seedSchool.id,
      tipe: 'radius',
      radius_m: 1500,
      jarak_terjauh_diterima_m: 1350,
      daya_tampung_zonasi: 180,
      jumlah_pendaftar: 310,
      tahun_ajaran: '2025/2026',
      sumber: 'Juknis SPMB Disdik - Zonasi Radius',
      tanggal_verifikasi: '2026-05-15',
    });

    // Konfigurasi sekolah seed
    this.schoolConfigs.set(seedSchool.id, {
      school_id: seedSchool.id,
      claimed_by: 'usr_sekolah_seed',
      auto_approve_teacher: false,
    } as any);

    // Kelas seed
    const seedClass = {
      id: 'cls_seed_7a',
      school_id: seedSchool.id,
      nama: 'Kelas 7-A',
      tingkat: 7,
      created_at: new Date().toISOString(),
    };
    this.classes.set(seedClass.id, seedClass);

    const seedPeriod = {
      id: 'prd_seed_7a',
      class_id: seedClass.id,
      start_date: '2025-07-15',
      end_date: undefined as string | undefined,
      is_active: true,
    };
    this.periods.set(seedPeriod.id, seedPeriod);

    // User Sekolah seed
    const sekolahUser: User = {
      id: 'usr_sekolah_seed',
      nama: 'Kepala Sekolah SMPN 1 Bogor',
      email: 'sekolah@skita.id',
      password_hash: bcrypt.hashSync('Sekolah@2026!', salt),
      role: 'sekolah',
      is_active: true,
      must_change_password: false,
      created_at: new Date().toISOString(),
    };
    this.users.set(sekolahUser.id, sekolahUser);

    // User Guru seed
    const guruUser: User = {
      id: 'usr_guru_seed',
      nama: 'Sri Wahyuni, S.Pd.',
      email: 'guru@skita.id',
      password_hash: bcrypt.hashSync('Guru@2026!', salt),
      role: 'guru',
      is_active: true,
      must_change_password: false,
      created_at: new Date().toISOString(),
    };
    this.users.set(guruUser.id, guruUser);

    // User Murid seed
    const muridUser: User = {
      id: 'usr_murid_seed',
      nama: 'Andi Pratama',
      email: 'murid@skita.id',
      password_hash: bcrypt.hashSync('Murid@2026!', salt),
      role: 'murid',
      is_active: true,
      must_change_password: false,
      created_at: new Date().toISOString(),
    };
    this.users.set(muridUser.id, muridUser);

    // Membership: Guru join sekolah
    this.schoolMemberships.set('sm_guru_seed', {
      id: 'sm_guru_seed',
      user_id: guruUser.id,
      school_id: seedSchool.id,
      role: 'guru',
      status: 'aktif',
      joined_at: new Date().toISOString(),
    });

    // Membership: Murid join sekolah
    this.schoolMemberships.set('sm_murid_seed', {
      id: 'sm_murid_seed',
      user_id: muridUser.id,
      school_id: seedSchool.id,
      role: 'murid',
      status: 'aktif',
      joined_at: new Date().toISOString(),
    });

    // Membership: Murid join kelas seed
    this.classMemberships.set('cm_murid_seed_7a', {
      id: 'cm_murid_seed_7a',
      user_id: muridUser.id,
      class_id: seedClass.id,
      period_id: seedPeriod.id,
      role: 'murid',
      status: 'aktif',
      joined_at: new Date().toISOString(),
    });

    // Membership: Guru join kelas seed
    this.classMemberships.set('cm_guru_seed_7a', {
      id: 'cm_guru_seed_7a',
      user_id: guruUser.id,
      class_id: seedClass.id,
      period_id: seedPeriod.id,
      role: 'guru',
      status: 'aktif',
      joined_at: new Date().toISOString(),
    });

    // Mata pelajaran seed untuk sekolah
    const mapelSeed = [
      { id: 'sub_seed_mtk', nama: 'Matematika' },
      { id: 'sub_seed_ipa', nama: 'Ilmu Pengetahuan Alam (IPA)' },
      { id: 'sub_seed_ips', nama: 'Ilmu Pengetahuan Sosial (IPS)' },
      { id: 'sub_seed_bindo', nama: 'Bahasa Indonesia' },
      { id: 'sub_seed_binggris', nama: 'Bahasa Inggris' },
      { id: 'sub_seed_agama', nama: 'Pendidikan Agama & Budi Pekerti' },
      { id: 'sub_seed_pjok', nama: 'PJOK' },
      { id: 'sub_seed_informatika', nama: 'Informatika' },
    ];
    mapelSeed.forEach((m) => {
      this.subjects.set(m.id, {
        id: m.id,
        school_id: seedSchool.id,
        nama: m.nama,
        is_custom: false,
        is_active: true,
      });
    });

    // Guru seed mengampu Matematika & IPA
    this.teacherSubjects.set('ts_guru_mtk', {
      id: 'ts_guru_mtk',
      user_id: guruUser.id,
      school_id: seedSchool.id,
      subject_id: 'sub_seed_mtk',
    });
    this.teacherSubjects.set('ts_guru_ipa', {
      id: 'ts_guru_ipa',
      user_id: guruUser.id,
      school_id: seedSchool.id,
      subject_id: 'sub_seed_ipa',
    });
  }
}

export const db = new MemoryDatabase();
