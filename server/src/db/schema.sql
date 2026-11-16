-- SKITA Database Schema (PostgreSQL + PostGIS) per PRD Section 7 & 14

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
    role VARCHAR(30) DEFAULT 'parent', -- 'parent', 'student', 'school', 'admin'
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
