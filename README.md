# SKITA — Sistem Kemudahan Informasi & Titik Akses Sekolah

Aplikasi mobile React Native (Expo) untuk membantu orang tua dan calon peserta didik mencari sekolah, mengecek zonasi PPDB, dan melihat profil sekolah secara interaktif.

## Fitur

- **Peta interaktif** — cari dan lihat lokasi sekolah di sekitar kamu
- **Cek zonasi** — evaluasi apakah rumahmu masuk zona suatu sekolah (radius, wilayah, atau gabungan)
- **Search On-the-Fly** — cari sekolah berdasarkan nama, kecamatan, atau jenjang secara real-time
- **Detail sekolah** — profil lengkap: kapasitas kelas, fasilitas, kuota PPDB
- **Filter & sort** — saring berdasarkan jenjang, jarak, dan kuota tersisa
- **Autentikasi** — login akun atau lanjut sebagai tamu
- **Profil pengguna** — simpan lokasi rumah dan preferensi pencarian

## Tech Stack

| Bagian | Teknologi |
|---|---|
| Mobile | React Native 0.88 + Expo 58 |
| Bahasa | TypeScript |
| Peta | WebView + OSRM (routing) |
| Backend | Express + PostgreSQL + JWT |
| Auth | bcryptjs + jsonwebtoken |

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
# Unit test zonasi (mobile)
npm test

# Unit test API (backend)
cd server && npm test
```

## Cara Kerja Zonasi

Evaluasi zonasi mendukung tiga tipe:

| Tipe | Logika |
|---|---|
| `radius` | Jarak Haversine rumah ke sekolah ≤ batas radius |
| `wilayah` | Kecamatan pengguna ada dalam daftar wilayah zonasi |
| `gabungan` | Radius OR wilayah (salah satu terpenuhi) |

> Hasil bersifat estimasi. Keputusan resmi mengikuti ketentuan dinas pendidikan / sekolah setempat.

## Environment Variables (Backend)

Lihat `server/.env.example`. Variabel yang dibutuhkan:

```
DATABASE_URL=
JWT_SECRET=
PORT=
```

## Lisensi

Private — `com.skita.app` milik `rey-ctrls-team`.
