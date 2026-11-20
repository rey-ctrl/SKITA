import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { INITIAL_SCHOOLS_DB, INITIAL_ZONES_DB, db as memDb } from './store.js';
import { School, SchoolZone, User, UserLocation } from '../types/index.js';
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
