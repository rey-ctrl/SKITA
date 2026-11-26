# SKITA — Sistem Kemudahan Informasi & Titik Akses Sekolah

Aplikasi mobile React Native (Expo) untuk manajemen sekolah digital: guru, murid, kelas, absensi, dan penugasan dalam satu platform.

## Fitur

- **Manajemen Kelas** — sekolah membuat kelas, guru & murid bergabung lewat kode akses
- **Kode Akses** — kode murid, kode guru, dan kode kelas; bisa disalin (copy) dan dirotasi otomatis tiap Senin
- **Absensi Digital** — murid isi kehadiran mandiri (07.00–09.00 WIB), guru verifikasi & koreksi kapan saja
- **Penugasan** — guru buat tugas dengan batas waktu, murid kumpulkan jawaban berupa dokumen/foto
- **Riwayat Aktivitas** — log audit absensi, kelas, dan sekolah per akun
- **Multi-Role** — Admin, Sekolah, Guru, Murid; hak akses dikontrol di server
- **Peta Interaktif** — cari dan lihat lokasi sekolah (OSRM routing)
- **Profil Pengguna** — data akademik, ringkasan presensi

## Role & Hak Akses

| Role | Kemampuan Utama |
|---|---|
| **Admin** | Kelola semua akun, pantau semua sekolah & kelas |
| **Sekolah** | Buat kode akses, buat kelas, setujui guru, bubarkan kelas |
| **Guru** | Kelola absensi & penugasan di kelas yang diikuti |
| **Murid** | Isi kehadiran, kumpulkan tugas, lihat riwayat absensi |

## Tech Stack

| Bagian | Teknologi |
|---|---|
| Mobile | React Native 0.88 + Expo 58 |
| Bahasa | TypeScript |
| Peta | WebView + OSRM (routing) |
| Backend | Express + PostgreSQL + JWT |
| Auth | bcryptjs + jsonwebtoken |
| Clipboard | expo-clipboard |
| File | expo-document-picker + expo-image-picker |

## Struktur Repo

```
SKITA/
├── src/
│   ├── components/     # Semua screen & modal
│   ├── context/        # AppContext (state global)
│   ├── services/       # API client
│   ├── data/           # Data awal / seed
│   ├── types/          # TypeScript types
│   └── utils/          # Helper (zonasi, haversine, dll)
├── server/             # Backend Express REST API
│   └── src/
│       ├── routes/     # Endpoint API
│       ├── middleware/  # Auth JWT
│       ├── db/         # Koneksi & query PostgreSQL
│       └── utils/
├── test/               # Unit test (Node built-in test runner)
├── android/            # Native Android
└── app.json            # Konfigurasi Expo
```

## Menjalankan Aplikasi

### Prasyarat

- Node.js ≥ 18
- Expo CLI (`npm install -g expo-cli`)
- PostgreSQL (untuk backend)

### Mobile

```bash
npm install
npm start          # Expo Dev Server
npm run android    # Jalankan di Android
```

### Backend

```bash
cd server
cp .env.example .env   # isi konfigurasi DB & JWT secret
npm install
npm run dev            # Development dengan hot-reload
npm run build && npm start  # Production
```

### Test

```bash
# Unit test mobile
npm test

# Unit test API (backend)
cd server && npm test
```

## Alur Bergabung

1. **Murid** — masukkan kode sekolah → masukkan kode kelas → langsung aktif
2. **Guru** — masukkan kode guru sekolah → tunggu persetujuan (atau otomatis jika diaktifkan sekolah) → masukkan kode kelas
3. Kode dirotasi otomatis setiap Senin 00:00 WIB

## Pembubaran Kelas

Sekolah/Admin bisa menjadwalkan pembubaran kelas dengan masa tunggu 24 jam. Selama masa tunggu KBM tetap berjalan; setelah selesai semua murid ditandai `lulus` periode dan guru keluar dari kelas (keanggotaan sekolah tetap).

## Environment Variables (Backend)

Lihat `server/.env.example`. Variabel yang dibutuhkan:

```
DATABASE_URL=
JWT_SECRET=
PORT=
```

## Lisensi

Private — `com.skita.app` milik `rey-ctrls-team`.
