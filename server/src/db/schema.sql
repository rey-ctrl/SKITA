-- SKITA Database Schema (PostgreSQL) per PRD Section 6 & 7
-- Versi ini mencakup tabel lama (schools, school_zones, user_locations)
-- dan tabel baru untuk role & akses (PRD Section 2–8)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Users Table (FR-AUTH & FR-REG)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    nama VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    provinsi VARCHAR(100),
    kota_kab VARCHAR(100),
    role VARCHAR(30) NOT NULL DEFAULT 'pengguna', -- 'admin', 'sekolah', 'guru', 'murid', 'pengguna'
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. User Saved Locations (FR-GEO)
CREATE TABLE IF NOT EXISTS user_locations (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label VARCHAR(100) NOT NULL,
    alamat TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    kecamatan VARCHAR(100),
    kelurahan VARCHAR(100),
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Schools Table (FR-DASH, FR-DET, FR-SOF)
CREATE TABLE IF NOT EXISTS schools (
    id VARCHAR(64) PRIMARY KEY,
    place_id VARCHAR(255) UNIQUE NOT NULL,
    npsn VARCHAR(20),
    nama VARCHAR(255) NOT NULL,
    jenjang VARCHAR(10) NOT NULL, -- SMP, MTs, SMA, SMK, MA
    status VARCHAR(20) NOT NULL, -- Negeri, Swasta
    alamat TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    foto_url TEXT,
    kecamatan VARCHAR(100) NOT NULL,
    kelurahan VARCHAR(100),
    kota_kab VARCHAR(100) NOT NULL,
    provinsi VARCHAR(100) NOT NULL,
    telepon VARCHAR(50),
    website TEXT,
    is_custom_added BOOLEAN DEFAULT FALSE,
    attendance_window_start VARCHAR(10) DEFAULT '07:00',
    attendance_window_end VARCHAR(10) DEFAULT '09:00',
    work_days VARCHAR(50) DEFAULT '1,2,3,4,5',
    auto_approve_teacher BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. School Zones Table (FR-ZON & PRD 17 & 19)
CREATE TABLE IF NOT EXISTS school_zones (
    id VARCHAR(64) PRIMARY KEY,
    school_id VARCHAR(64) UNIQUE NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    tipe VARCHAR(20) NOT NULL, -- 'radius', 'wilayah', 'gabungan'
    radius_m INTEGER NOT NULL,
    wilayah TEXT, -- JSON array string of subdistricts: ["Bogor Tengah", "Bogor Timur"]
    jarak_terjauh_diterima_m INTEGER,
    daya_tampung_zonasi INTEGER,
    jumlah_pendaftar INTEGER,
    tahun_ajaran VARCHAR(20) NOT NULL DEFAULT '2025/2026',
    sumber VARCHAR(255),
    tanggal_verifikasi DATE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_schools_kota_jenjang ON schools(kota_kab, jenjang);
CREATE INDEX IF NOT EXISTS idx_schools_coords ON schools(lat, lng);
CREATE INDEX IF NOT EXISTS idx_school_zones_school ON school_zones(school_id);

-- ============================================================
-- PRD Section 6: Role & Akses
-- ============================================================

-- 5. School Memberships (FR-A2)
-- Satu guru boleh bergabung ke banyak sekolah, murid hanya 1 sekolah.
CREATE TABLE IF NOT EXISTS school_memberships (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id),
    school_id VARCHAR(64) NOT NULL REFERENCES schools(id),
    role VARCHAR(20) NOT NULL, -- 'guru', 'murid'
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending','aktif','keluar','dikeluarkan'
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(user_id, school_id)
);
CREATE INDEX IF NOT EXISTS idx_school_memb_user ON school_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_school_memb_school ON school_memberships(school_id);

-- 6. Classes (FR-A4)
CREATE TABLE IF NOT EXISTS classes (
    id VARCHAR(64) PRIMARY KEY,
    school_id VARCHAR(64) NOT NULL REFERENCES schools(id),
    nama VARCHAR(100) NOT NULL,
    tingkat VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_classes_school ON classes(school_id);

-- 7. Periods — satu periode aktif per kelas (FR-A11)
CREATE TABLE IF NOT EXISTS periods (
    id VARCHAR(64) PRIMARY KEY,
    class_id VARCHAR(64) NOT NULL REFERENCES classes(id),
    start_date DATE NOT NULL,
    end_date DATE,
    is_active BOOLEAN DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_periods_class ON periods(class_id);

-- 8. Class Memberships (FR-A2, constraint murid hanya 1 aktif)
-- Constraint: satu murid hanya 1 class_membership berstatus 'aktif'
CREATE TABLE IF NOT EXISTS class_memberships (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id),
    class_id VARCHAR(64) NOT NULL REFERENCES classes(id),
    period_id VARCHAR(64) NOT NULL REFERENCES periods(id),
    role VARCHAR(20) NOT NULL, -- 'guru', 'murid'
    status VARCHAR(20) NOT NULL DEFAULT 'aktif', -- 'aktif','keluar','dikeluarkan','lulus'
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP WITH TIME ZONE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_class_memb_one_active_murid
    ON class_memberships(user_id)
    WHERE role = 'murid' AND status = 'aktif';
CREATE INDEX IF NOT EXISTS idx_class_memb_class ON class_memberships(class_id);

-- 9. Access Codes — rotasi Senin 00:00 WIB (FR-A4, FR-A7)
CREATE TABLE IF NOT EXISTS access_codes (
    id VARCHAR(64) PRIMARY KEY,
    scope VARCHAR(30) NOT NULL, -- 'school_student','school_teacher','class'
    target_id VARCHAR(64) NOT NULL, -- school_id or class_id
    code VARCHAR(20) NOT NULL UNIQUE,
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
    valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_access_codes_target ON access_codes(scope, target_id);

-- 10. Dissolution Schedules (FR-A11)
CREATE TABLE IF NOT EXISTS dissolution_schedules (
    id VARCHAR(64) PRIMARY KEY,
    school_id VARCHAR(64) NOT NULL REFERENCES schools(id),
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    executed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'terjadwal', -- 'terjadwal','diurungkan','selesai'
    created_by VARCHAR(64) NOT NULL REFERENCES users(id),
    duration_hours INTEGER NOT NULL DEFAULT 24
);

-- 11. Subject Templates (FR-A3)
CREATE TABLE IF NOT EXISTS subject_templates (
    id SERIAL PRIMARY KEY,
    jenjang VARCHAR(10) NOT NULL,
    status_sekolah VARCHAR(20) NOT NULL,
    nama VARCHAR(100) NOT NULL,
    UNIQUE(jenjang, status_sekolah, nama)
);

-- 12. Subjects per sekolah (FR-A3)
CREATE TABLE IF NOT EXISTS subjects (
    id VARCHAR(64) PRIMARY KEY,
    school_id VARCHAR(64) NOT NULL REFERENCES schools(id),
    nama VARCHAR(100) NOT NULL,
    is_custom BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE
);

-- 13. Teacher → Subject mapping per sekolah (FR-A3)
CREATE TABLE IF NOT EXISTS teacher_subjects (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id),
    school_id VARCHAR(64) NOT NULL REFERENCES schools(id),
    subject_id VARCHAR(64) NOT NULL REFERENCES subjects(id),
    UNIQUE(user_id, school_id, subject_id)
);

-- 14. Holidays — diisi manual Admin per tahun dari SKB (FR-A13)
CREATE TABLE IF NOT EXISTS holidays (
    id VARCHAR(64) PRIMARY KEY,
    tanggal DATE NOT NULL UNIQUE,
    nama VARCHAR(150) NOT NULL,
    jenis VARCHAR(30) NOT NULL -- 'nasional','cuti_bersama'
);

-- 15. School Calendar Overrides — libur sekolah & hari masuk (FR-A13)
CREATE TABLE IF NOT EXISTS school_calendar_overrides (
    id VARCHAR(64) PRIMARY KEY,
    school_id VARCHAR(64) NOT NULL REFERENCES schools(id),
    tanggal DATE NOT NULL,
    override_type VARCHAR(20) NOT NULL, -- 'masuk','libur'
    UNIQUE(school_id, tanggal)
);

-- 16. Attendance (FR-A13)
CREATE TABLE IF NOT EXISTS attendance (
    id VARCHAR(64) PRIMARY KEY,
    murid_id VARCHAR(64) NOT NULL REFERENCES users(id),
    class_id VARCHAR(64) NOT NULL REFERENCES classes(id),
    period_id VARCHAR(64) NOT NULL REFERENCES periods(id),
    tanggal DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'alpa', -- 'hadir','sakit','izin','alpa'
    catatan TEXT,
    diisi_oleh VARCHAR(64) NOT NULL REFERENCES users(id),
    waktu_isi TIMESTAMP WITH TIME ZONE NOT NULL,
    is_koreksi_guru BOOLEAN DEFAULT FALSE,
    UNIQUE(murid_id, class_id, tanggal)
);
CREATE INDEX IF NOT EXISTS idx_attendance_class_tanggal ON attendance(class_id, tanggal);

-- 17. Attendance Audit (FR-A13: setiap koreksi dicatat)
CREATE TABLE IF NOT EXISTS attendance_audit (
    id VARCHAR(64) PRIMARY KEY,
    attendance_id VARCHAR(64) NOT NULL REFERENCES attendance(id),
    actor_id VARCHAR(64) NOT NULL REFERENCES users(id),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status_sebelum VARCHAR(20) NOT NULL,
    status_sesudah VARCHAR(20) NOT NULL,
    catatan_sebelum TEXT,
    catatan_sesudah TEXT
);

-- 18. Audit Log — aksi sensitif (FR-A1, FR-A11, FR-A9)
CREATE TABLE IF NOT EXISTS audit_log (
    id VARCHAR(64) PRIMARY KEY,
    actor_id VARCHAR(64) NOT NULL,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id VARCHAR(64) NOT NULL,
    details JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp DESC);

