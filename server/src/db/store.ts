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
  }
}

export const db = new MemoryDatabase();
