import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { INITIAL_SCHOOLS_DB, INITIAL_ZONES_DB, db as memDb } from './store.js';
import {
  School,
  SchoolZone,
  User,
  UserLocation,
  SchoolClass,
  ClassPeriod,
  SchoolMembership,
  ClassMembership,
  AccessCode,
  Attendance,
  AttendanceAudit,
  AuditLog,
  Subject,
  TeacherSubject,
} from '../types/index.js';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export let pool: pg.Pool | null = null;
export let isPostgresConnected = false;

export async function connectPostgres(): Promise<boolean> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log('[PostgreSQL] DATABASE_URL tidak ditemukan. Menggunakan in-memory store.');
    return false;
  }

  try {
    pool = new Pool({
      connectionString: databaseUrl,
      connectionTimeoutMillis: 3000,
      idleTimeoutMillis: 10000,
    });

    const client = await pool.connect();
    console.log('[PostgreSQL] Terhubung ke database PostgreSQL.');

    // 1. Inisialisasi skema DDL jika belum ada
    const possibleSchemaPaths = [
      path.resolve(__dirname, 'schema.sql'),
      path.resolve(__dirname, '../../src/db/schema.sql'),
      path.resolve(process.cwd(), 'src/db/schema.sql'),
      path.resolve(process.cwd(), 'server/src/db/schema.sql'),
    ];
    const schemaPath = possibleSchemaPaths.find((p) => fs.existsSync(p));
    if (schemaPath) {
      const sql = fs.readFileSync(schemaPath, 'utf-8');
      await client.query(sql);
      // Auto-migrate kolom yang mungkin belum ada di database lama
      await client.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
      `);
      console.log(`[PostgreSQL] Skema database berhasil dieksekusi.`);
    } else {
      console.warn('[PostgreSQL] File schema.sql tidak ditemukan.');
    }

    client.release();
    isPostgresConnected = true;

    // Sinkronkan data PostgreSQL ke cache in-memory agar query cepat
    await syncFromPostgresToMemory();

    return true;
  } catch (err: any) {
    console.warn('[PostgreSQL] Gagal tersambung ke PostgreSQL:', err.message);
    console.log('[PostgreSQL] Berjalan dalam mode fallback memory store.');
    isPostgresConnected = false;
    return false;
  }
}

export async function syncFromPostgresToMemory() {
  if (!pool || !isPostgresConnected) return;
  try {
    const schoolRes = await pool.query('SELECT * FROM schools');
    for (const row of schoolRes.rows) {
      memDb.schools.set(row.id, {
        id: row.id,
        place_id: row.place_id,
        npsn: row.npsn || undefined,
        nama: row.nama,
        jenjang: row.jenjang,
        status: row.status,
        alamat: row.alamat,
        lat: parseFloat(row.lat),
        lng: parseFloat(row.lng),
        foto_url: row.foto_url,
        kecamatan: row.kecamatan,
        kelurahan: row.kelurahan,
        kota_kab: row.kota_kab,
        provinsi: row.provinsi,
        telepon: row.telepon || undefined,
        website: row.website || undefined,
        is_custom_added: row.is_custom_added,
      });
    }

    const zoneRes = await pool.query('SELECT * FROM school_zones');
    for (const row of zoneRes.rows) {
      memDb.zones.set(row.school_id, {
        id: row.id,
        school_id: row.school_id,
        tipe: row.tipe,
        radius_m: parseInt(row.radius_m, 10),
        wilayah: row.wilayah ? (typeof row.wilayah === 'string' ? JSON.parse(row.wilayah) : row.wilayah) : undefined,
        jarak_terjauh_diterima_m: row.jarak_terjauh_diterima_m ? parseInt(row.jarak_terjauh_diterima_m, 10) : undefined,
        daya_tampung_zonasi: row.daya_tampung_zonasi ? parseInt(row.daya_tampung_zonasi, 10) : undefined,
        jumlah_pendaftar: row.jumlah_pendaftar ? parseInt(row.jumlah_pendaftar, 10) : undefined,
        tahun_ajaran: row.tahun_ajaran,
        sumber: row.sumber,
        tanggal_verifikasi: row.tanggal_verifikasi,
      });
    }

    // Pastikan user bawaan (admin, demo, seed roles) ada di DB agar foreign key valid
    for (const u of memDb.users.values()) {
      await pool.query(
        `INSERT INTO users (id, nama, email, password_hash, provinsi, kota_kab, role, must_change_password, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO NOTHING`,
        [u.id, u.nama, u.email, u.password_hash, u.provinsi || null, u.kota_kab || null, u.role, u.must_change_password ?? false, u.is_active ?? true]
      );
    }

    // Pastikan seed sekolah ada di DB
    for (const sch of memDb.schools.values()) {
      await pool.query(
        `INSERT INTO schools (id, place_id, npsn, nama, jenjang, status, alamat, lat, lng, foto_url, kecamatan, kelurahan, kota_kab, provinsi, telepon, website, is_custom_added)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         ON CONFLICT (id) DO NOTHING`,
        [sch.id, sch.place_id || null, sch.npsn || null, sch.nama, sch.jenjang, sch.status, sch.alamat, sch.lat, sch.lng, sch.foto_url, sch.kecamatan || 'Bogor', sch.kelurahan || null, sch.kota_kab || 'Kota Bogor', sch.provinsi || 'Jawa Barat', sch.telepon || null, sch.website || null, Boolean(sch.is_custom_added)]
      );
    }

    // Pastikan seed school_memberships ada di DB
    for (const sm of memDb.schoolMemberships.values()) {
      await pool.query(
        `INSERT INTO school_memberships (id, user_id, school_id, role, status, joined_at, left_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (user_id, school_id) DO NOTHING`,
        [sm.id, sm.user_id, sm.school_id, sm.role, sm.status, sm.joined_at, sm.left_at || null]
      );
    }

    // Pastikan seed classes, periods, dan class_memberships ada di DB
    for (const cls of memDb.classes.values()) {
      await pool.query(
        `INSERT INTO classes (id, school_id, nama, tingkat, created_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
        [cls.id, cls.school_id, cls.nama, String(cls.tingkat), cls.created_at]
      );
    }
    for (const p of memDb.periods.values()) {
      await pool.query(
        `INSERT INTO periods (id, class_id, start_date, end_date, is_active) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
        [p.id, p.class_id, p.start_date, p.end_date || null, p.is_active]
      );
    }
    for (const cm of memDb.classMemberships.values()) {
      await pool.query(
        `INSERT INTO class_memberships (id, user_id, class_id, period_id, role, status, joined_at, left_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO NOTHING`,
        [cm.id, cm.user_id, cm.class_id, cm.period_id, cm.role, cm.status, cm.joined_at, cm.left_at || null]
      );
    }

    // Pastikan seed subjects & teacher_subjects ada di DB
    for (const sub of memDb.subjects.values()) {
      await pool.query(
        `INSERT INTO subjects (id, school_id, nama, is_custom, is_active) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
        [sub.id, sub.school_id, sub.nama, sub.is_custom, sub.is_active]
      );
    }
    for (const ts of memDb.teacherSubjects.values()) {
      await pool.query(
        `INSERT INTO teacher_subjects (id, user_id, school_id, subject_id) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, school_id, subject_id) DO NOTHING`,
        [ts.id, ts.user_id, ts.school_id, ts.subject_id]
      );
    }

    const userRes = await pool.query('SELECT * FROM users');
    for (const row of userRes.rows) {
      memDb.users.set(row.id, {
        id: row.id,
        nama: row.nama,
        email: row.email,
        password_hash: row.password_hash,
        provinsi: row.provinsi,
        kota_kab: row.kota_kab,
        role: row.role,
        must_change_password: row.must_change_password,
        is_active: row.is_active,
        created_at: row.created_at,
        updated_at: row.updated_at,
      });
    }

    const locRes = await pool.query('SELECT * FROM user_locations');
    const locMap = new Map<string, UserLocation[]>();
    for (const row of locRes.rows) {
      const loc: UserLocation = {
        id: row.id,
        user_id: row.user_id,
        label: row.label,
        alamat: row.alamat,
        lat: parseFloat(row.lat),
        lng: parseFloat(row.lng),
        kecamatan: row.kecamatan || undefined,
        kelurahan: row.kelurahan || undefined,
        is_default: row.is_default,
      };
      const arr = locMap.get(row.user_id) || [];
      arr.push(loc);
      locMap.set(row.user_id, arr);
    }
    locMap.forEach((locs, uId) => memDb.userLocations.set(uId, locs));

    // 5. Classes & Periods (1)
    const classesRes = await pool.query('SELECT * FROM classes');
    for (const row of classesRes.rows) {
      memDb.classes.set(row.id, {
        id: row.id,
        school_id: row.school_id,
        nama: row.nama,
        tingkat: row.tingkat,
        created_at: row.created_at?.toISOString?.() || String(row.created_at),
      });
    }

    const periodsRes = await pool.query('SELECT * FROM periods');
    for (const row of periodsRes.rows) {
      memDb.periods.set(row.id, {
        id: row.id,
        class_id: row.class_id,
        start_date: row.start_date?.toISOString?.()?.slice(0, 10) || String(row.start_date).slice(0, 10),
        end_date: row.end_date ? (row.end_date?.toISOString?.()?.slice(0, 10) || String(row.end_date).slice(0, 10)) : undefined,
        is_active: Boolean(row.is_active),
      });
    }

    // 6. School Memberships & Class Memberships (2 & 3)
    const smRes = await pool.query('SELECT * FROM school_memberships');
    for (const row of smRes.rows) {
      memDb.schoolMemberships.set(row.id, {
        id: row.id,
        user_id: row.user_id,
        school_id: row.school_id,
        role: row.role,
        status: row.status,
        joined_at: row.joined_at?.toISOString?.() || String(row.joined_at),
        left_at: row.left_at ? (row.left_at?.toISOString?.() || String(row.left_at)) : undefined,
      });
    }

    const cmRes = await pool.query('SELECT * FROM class_memberships');
    for (const row of cmRes.rows) {
      memDb.classMemberships.set(row.id, {
        id: row.id,
        user_id: row.user_id,
        class_id: row.class_id,
        period_id: row.period_id,
        role: row.role,
        status: row.status,
        joined_at: row.joined_at?.toISOString?.() || String(row.joined_at),
        left_at: row.left_at ? (row.left_at?.toISOString?.() || String(row.left_at)) : undefined,
      });
    }

    // 7. Access Codes (4)
    const acRes = await pool.query('SELECT * FROM access_codes');
    for (const row of acRes.rows) {
      memDb.accessCodes.set(row.id, {
        id: row.id,
        scope: row.scope,
        target_id: row.target_id,
        code: row.code,
        valid_from: row.valid_from?.toISOString?.() || String(row.valid_from),
        valid_until: row.valid_until?.toISOString?.() || String(row.valid_until),
        is_active: Boolean(row.is_active),
      });
    }

    // 8. Attendance & Attendance Audit (5 & 6)
    const attRes = await pool.query('SELECT * FROM attendance');
    for (const row of attRes.rows) {
      memDb.attendance.set(row.id, {
        id: row.id,
        murid_id: row.murid_id,
        class_id: row.class_id,
        period_id: row.period_id,
        tanggal: row.tanggal?.toISOString?.()?.slice(0, 10) || String(row.tanggal).slice(0, 10),
        status: row.status,
        catatan: row.catatan || undefined,
        diisi_oleh: row.diisi_oleh,
        waktu_isi: row.waktu_isi?.toISOString?.() || String(row.waktu_isi),
        is_koreksi_guru: Boolean(row.is_koreksi_guru),
      });
    }

    const audRes = await pool.query('SELECT * FROM attendance_audit');
    for (const row of audRes.rows) {
      memDb.attendanceAudit.set(row.id, {
        id: row.id,
        attendance_id: row.attendance_id,
        actor_id: row.actor_id,
        timestamp: row.timestamp?.toISOString?.() || String(row.timestamp),
        status_sebelum: row.status_sebelum,
        status_sesudah: row.status_sesudah,
        catatan_sebelum: row.catatan_sebelum || undefined,
        catatan_sesudah: row.catatan_sesudah || undefined,
      });
    }

    // 9. Audit Log (7)
    const logRes = await pool.query('SELECT * FROM audit_log');
    for (const row of logRes.rows) {
      memDb.auditLog.set(row.id, {
        id: row.id,
        actor_id: row.actor_id,
        action: row.action,
        target_type: row.target_type,
        target_id: row.target_id,
        details: row.details ? (typeof row.details === 'string' ? JSON.parse(row.details) : row.details) : undefined,
        timestamp: row.timestamp?.toISOString?.() || String(row.timestamp),
      });
    }

    // 10. Subjects & Teacher Subjects (9)
    const subRes = await pool.query('SELECT * FROM subjects');
    for (const row of subRes.rows) {
      memDb.subjects.set(row.id, {
        id: row.id,
        school_id: row.school_id,
        nama: row.nama,
        is_custom: Boolean(row.is_custom),
        is_active: Boolean(row.is_active),
      });
    }

    const tsRes = await pool.query('SELECT * FROM teacher_subjects');
    for (const row of tsRes.rows) {
      memDb.teacherSubjects.set(row.id, {
        id: row.id,
        user_id: row.user_id,
        school_id: row.school_id,
        subject_id: row.subject_id,
      });
    }
  } catch (err) {
    console.error('[PostgreSQL] Gagal sinkronisasi data ke memory cache:', err);
  }
}

// Helper untuk simpan sekolah baru ke PostgreSQL
export async function persistSchool(s: School) {
  if (pool && isPostgresConnected) {
    try {
      await pool.query(
        `INSERT INTO schools (id, place_id, npsn, nama, jenjang, status, alamat, lat, lng, foto_url, kecamatan, kelurahan, kota_kab, provinsi, telepon, website, is_custom_added)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         ON CONFLICT (id) DO NOTHING`,
        [
          s.id,
          s.place_id,
          s.npsn || null,
          s.nama,
          s.jenjang,
          s.status,
          s.alamat,
          s.lat,
          s.lng,
          s.foto_url,
          s.kecamatan || 'Bogor',
          s.kelurahan || null,
          s.kota_kab || 'Kota Bogor',
          s.provinsi || 'Jawa Barat',
          s.telepon || null,
          s.website || null,
          Boolean(s.is_custom_added),
        ]
      );
    } catch (err) {
      console.error('[PostgreSQL] Gagal menyimpan sekolah ke database:', err);
    }
  }
}

// Helper untuk simpan user baru ke PostgreSQL
export async function persistUser(u: User) {
  if (pool && isPostgresConnected) {
    try {
      await pool.query(
        `INSERT INTO users (id, nama, email, password_hash, provinsi, kota_kab, role, must_change_password, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO NOTHING`,
        [u.id, u.nama, u.email, u.password_hash, u.provinsi || null, u.kota_kab || null,
         u.role, u.must_change_password ?? false, u.is_active ?? true]
      );
    } catch (err) {
      console.error('[PostgreSQL] Gagal menyimpan user ke database:', err);
    }
  }
}

// Helper untuk simpan zonasi sekolah ke PostgreSQL
export async function persistZone(z: SchoolZone) {
  if (pool && isPostgresConnected) {
    try {
      await pool.query(
        `INSERT INTO school_zones (id, school_id, tipe, radius_m, wilayah, jarak_terjauh_diterima_m, daya_tampung_zonasi, jumlah_pendaftar, tahun_ajaran, sumber, tanggal_verifikasi)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (school_id) DO UPDATE SET
           tipe = EXCLUDED.tipe,
           radius_m = EXCLUDED.radius_m,
           wilayah = EXCLUDED.wilayah,
           jarak_terjauh_diterima_m = EXCLUDED.jarak_terjauh_diterima_m,
           daya_tampung_zonasi = EXCLUDED.daya_tampung_zonasi`,
        [
          z.id,
          z.school_id,
          z.tipe,
          z.radius_m,
          z.wilayah ? JSON.stringify(z.wilayah) : null,
          z.jarak_terjauh_diterima_m || null,
          z.daya_tampung_zonasi || null,
          z.jumlah_pendaftar || null,
          z.tahun_ajaran,
          z.sumber,
          z.tanggal_verifikasi,
        ]
      );
    } catch (err) {
      console.error('[PostgreSQL] Gagal menyimpan zonasi sekolah:', err);
    }
  }
}
export async function removeSchool(schoolId: string) {
  if (pool && isPostgresConnected) {
    try {
      await pool.query('DELETE FROM schools WHERE id = $1', [schoolId]);
    } catch (err) {
      console.error('[PostgreSQL] Gagal menghapus sekolah:', err);
    }
  }
}

export async function persistUserLocation(loc: UserLocation) {
  if (pool && isPostgresConnected) {
    try {
      if (loc.is_default) {
        await pool.query('UPDATE user_locations SET is_default = false WHERE user_id = $1', [loc.user_id]);
      }
      await pool.query(
        `INSERT INTO user_locations (id, user_id, label, alamat, lat, lng, kecamatan, kelurahan, is_default)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          loc.id,
          loc.user_id,
          loc.label,
          loc.alamat,
          loc.lat,
          loc.lng,
          loc.kecamatan || null,
          loc.kelurahan || null,
          loc.is_default,
        ]
      );
    } catch (err) {
      console.error('[PostgreSQL] Gagal menyimpan alamat ke database:', err);
    }
  }
}

// --------------------------------------------------------------------------
// 1. Classes & Periods
// --------------------------------------------------------------------------
export async function persistClass(c: SchoolClass) {
  if (pool && isPostgresConnected) {
    try {
      await pool.query(
        `INSERT INTO classes (id, school_id, nama, tingkat, created_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET
           nama = EXCLUDED.nama,
           tingkat = EXCLUDED.tingkat`,
        [c.id, c.school_id, c.nama, String(c.tingkat), c.created_at]
      );
    } catch (err) {
      console.error('[PostgreSQL] Gagal menyimpan kelas:', err);
    }
  }
}

export async function removeClass(classId: string) {
  if (pool && isPostgresConnected) {
    try {
      await pool.query('DELETE FROM class_memberships WHERE class_id = $1', [classId]);
      await pool.query('DELETE FROM periods WHERE class_id = $1', [classId]);
      await pool.query('DELETE FROM access_codes WHERE target_id = $1', [classId]);
      await pool.query('DELETE FROM attendance WHERE class_id = $1', [classId]);
      await pool.query('DELETE FROM classes WHERE id = $1', [classId]);
    } catch (err) {
      console.error('[PostgreSQL] Gagal menghapus kelas:', err);
    }
  }
}

export async function persistPeriod(p: ClassPeriod) {
  if (pool && isPostgresConnected) {
    try {
      await pool.query(
        `INSERT INTO periods (id, class_id, start_date, end_date, is_active)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET
           end_date = EXCLUDED.end_date,
           is_active = EXCLUDED.is_active`,
        [p.id, p.class_id, p.start_date.slice(0, 10), p.end_date ? p.end_date.slice(0, 10) : null, p.is_active]
      );
    } catch (err) {
      console.error('[PostgreSQL] Gagal menyimpan periode:', err);
    }
  }
}

// --------------------------------------------------------------------------
// 2. Class Memberships
// --------------------------------------------------------------------------
export async function persistClassMembership(m: ClassMembership) {
  if (pool && isPostgresConnected) {
    try {
      await pool.query(
        `INSERT INTO class_memberships (id, user_id, class_id, period_id, role, status, joined_at, left_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           left_at = EXCLUDED.left_at`,
        [m.id, m.user_id, m.class_id, m.period_id, m.role, m.status, m.joined_at, m.left_at || null]
      );
    } catch (err) {
      console.error('[PostgreSQL] Gagal menyimpan class membership:', err);
    }
  }
}

// --------------------------------------------------------------------------
// 3. School Memberships
// --------------------------------------------------------------------------
export async function persistSchoolMembership(m: SchoolMembership) {
  if (pool && isPostgresConnected) {
    try {
      await pool.query(
        `INSERT INTO school_memberships (id, user_id, school_id, role, status, joined_at, left_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (user_id, school_id) DO UPDATE SET
           status = EXCLUDED.status,
           role = EXCLUDED.role,
           left_at = EXCLUDED.left_at`,
        [m.id, m.user_id, m.school_id, m.role, m.status, m.joined_at, m.left_at || null]
      );
    } catch (err) {
      console.error('[PostgreSQL] Gagal menyimpan school membership:', err);
    }
  }
}

// --------------------------------------------------------------------------
// 4. Access Codes
// --------------------------------------------------------------------------
export async function persistAccessCode(ac: AccessCode) {
  if (pool && isPostgresConnected) {
    try {
      await pool.query(
        `INSERT INTO access_codes (id, scope, target_id, code, valid_from, valid_until, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           code = EXCLUDED.code,
           valid_from = EXCLUDED.valid_from,
           valid_until = EXCLUDED.valid_until,
           is_active = EXCLUDED.is_active`,
        [ac.id, ac.scope, ac.target_id, ac.code, ac.valid_from, ac.valid_until, ac.is_active]
      );
    } catch (err) {
      console.error('[PostgreSQL] Gagal menyimpan access code:', err);
    }
  }
}

// --------------------------------------------------------------------------
// 5. Attendance
// --------------------------------------------------------------------------
export async function persistAttendance(a: Attendance) {
  if (pool && isPostgresConnected) {
    try {
      await pool.query(
        `INSERT INTO attendance (id, murid_id, class_id, period_id, tanggal, status, catatan, diisi_oleh, waktu_isi, is_koreksi_guru)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (murid_id, class_id, tanggal) DO UPDATE SET
           status = EXCLUDED.status,
           catatan = EXCLUDED.catatan,
           diisi_oleh = EXCLUDED.diisi_oleh,
           waktu_isi = EXCLUDED.waktu_isi,
           is_koreksi_guru = EXCLUDED.is_koreksi_guru`,
        [
          a.id,
          a.murid_id,
          a.class_id,
          a.period_id,
          a.tanggal.slice(0, 10),
          a.status,
          a.catatan || null,
          a.diisi_oleh,
          a.waktu_isi,
          Boolean(a.is_koreksi_guru),
        ]
      );
    } catch (err) {
      console.error('[PostgreSQL] Gagal menyimpan absensi:', err);
    }
  }
}

// --------------------------------------------------------------------------
// 6. Attendance Audit
// --------------------------------------------------------------------------
export async function persistAttendanceAudit(aud: AttendanceAudit) {
  if (pool && isPostgresConnected) {
    try {
      await pool.query(
        `INSERT INTO attendance_audit (id, attendance_id, actor_id, timestamp, status_sebelum, status_sesudah, catatan_sebelum, catatan_sesudah)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [
          aud.id,
          aud.attendance_id,
          aud.actor_id,
          aud.timestamp,
          aud.status_sebelum,
          aud.status_sesudah,
          aud.catatan_sebelum || null,
          aud.catatan_sesudah || null,
        ]
      );
    } catch (err) {
      console.error('[PostgreSQL] Gagal menyimpan attendance audit:', err);
    }
  }
}

// --------------------------------------------------------------------------
// 7. Audit Log
// --------------------------------------------------------------------------
export async function persistAuditLog(log: AuditLog) {
  if (pool && isPostgresConnected) {
    try {
      await pool.query(
        `INSERT INTO audit_log (id, actor_id, action, target_type, target_id, details, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [
          log.id,
          log.actor_id,
          log.action,
          log.target_type,
          log.target_id,
          log.details ? JSON.stringify(log.details) : null,
          log.timestamp,
        ]
      );
    } catch (err) {
      console.error('[PostgreSQL] Gagal menyimpan audit log:', err);
    }
  }
}

// --------------------------------------------------------------------------
// 9. Subjects & Teacher Subjects
// --------------------------------------------------------------------------
export async function persistSubject(s: Subject) {
  if (pool && isPostgresConnected) {
    try {
      await pool.query(
        `INSERT INTO subjects (id, school_id, nama, is_custom, is_active)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET
           nama = EXCLUDED.nama,
           is_active = EXCLUDED.is_active`,
        [s.id, s.school_id, s.nama, s.is_custom, s.is_active]
      );
    } catch (err) {
      console.error('[PostgreSQL] Gagal menyimpan mapel:', err);
    }
  }
}

export async function removeSubject(subjectId: string) {
  if (pool && isPostgresConnected) {
    try {
      await pool.query('DELETE FROM teacher_subjects WHERE subject_id = $1', [subjectId]);
      await pool.query('DELETE FROM subjects WHERE id = $1', [subjectId]);
    } catch (err) {
      console.error('[PostgreSQL] Gagal menghapus mapel:', err);
    }
  }
}

export async function persistTeacherSubject(ts: TeacherSubject) {
  if (pool && isPostgresConnected) {
    try {
      await pool.query(
        `INSERT INTO teacher_subjects (id, user_id, school_id, subject_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, school_id, subject_id) DO NOTHING`,
        [ts.id, ts.user_id, ts.school_id, ts.subject_id]
      );
    } catch (err) {
      console.error('[PostgreSQL] Gagal menyimpan teacher subject:', err);
    }
  }
}
