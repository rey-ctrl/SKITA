# PRD: Role dan Akses Akun Aplikasi Sekolah

**Versi:** 1.1 (revisi analisis gap) · **Tanggal:** 20 November 2026 · **Status:** Draft

## 1. Ringkasan

Dokumen ini merangkum seluruh keputusan tentang peran akun (Admin, Sekolah, Guru, Murid), cara bergabung lewat kode, pembagian hak akses, bubarkan kelas, absensi, dan kalender libur. Semua pengecekan hak akses dilakukan di server. Menyembunyikan menu di UI saja tidak dianggap cukup.

PRD aplikasi sekolah yang asli belum dilampirkan, jadi dokumen ini berdiri sendiri. Bagian yang bergantung pada fitur lain (tugas, nilai) ditandai sebagai asumsi.

## 2. Peran

| Peran | Ringkasan |
| --- | --- |
| Admin | Mengelola semua akun dan role, membuat kode, memantau semua sekolah dan kelas. Satu-satunya yang melihat menu Cari. |
| Sekolah | Satu akun per sekolah. Membuat kode sekolah dan kode kelas, menyetujui guru, mengatur mapel, memantau semua kelas di sekolahnya, membubarkan kelas. |
| Guru | Bergabung ke satu atau lebih sekolah (setelah disetujui), lalu ke kelas lewat kode kelas. Memberi tugas dan mengelola absensi di kelasnya. |
| Murid | Bergabung dengan kode sekolah dan kode kelas, langsung masuk tanpa persetujuan. Hanya satu kelas aktif. |

**Pengguna** bukan peran dengan fitur sendiri, melainkan status akun yang belum atau tidak lagi tergabung di sekolah mana pun. Pengguna tidak punya akses ke fitur sekolah sampai memasukkan kode sekolah (menjadi Murid) atau kode sekolah khusus guru (menjadi Guru).

## 3. Registrasi, Login, dan Penetapan Role

Saat ini registrasi dan login masih polos: semua orang mendaftar dengan cara yang sama dan belum ada role. Bagian ini menetapkan siapa yang boleh membuat akun jenis apa, dan bagaimana role ditentukan.

### FR-A15 (P0) Registrasi, login, dan akun khusus Admin

| Jenis akun | Cara dibuat | Siapa yang membuat |
| --- | --- | --- |
| Murid | Registrasi publik, lalu memasukkan kode sekolah (untuk murid). Role Murid otomatis, tanpa memilih role | Pengguna sendiri |
| Guru | Registrasi publik, lalu memasukkan kode sekolah khusus guru. Role Guru otomatis | Pengguna sendiri. Akses ke sekolah perlu disetujui akun Sekolah (FR-A2), kecuali sekolah mengaktifkan setujui otomatis |
| Sekolah | Dibuat di halaman manajemen akun | Admin |
| Admin | Dibuat di halaman manajemen akun. Admin pertama lewat seed server | Admin yang sudah ada |

**Registrasi publik**

- Form registrasi tidak punya pilihan role. Pendaftar baru berstatus Pengguna dan belum punya akses ke fitur apa pun sampai memasukkan kode sekolah.
- Role ditentukan di server. Field role yang dikirim klien saat registrasi diabaikan atau ditolak, jadi mengubah request lewat alat developer tidak bisa menghasilkan akun Guru, Sekolah, atau Admin.
- Role ditentukan oleh jenis kode yang dimasukkan. Kode sekolah (untuk murid) membuat pendaftar otomatis menjadi Murid dan masuk tanpa persetujuan. Kode sekolah khusus guru membuat pendaftar otomatis menjadi Guru dengan status *pending* sampai disetujui sekolah (FR-A2), kecuali sekolah mengaktifkan setujui otomatis. Akses ke kelas tetap lewat kode kelas.
- Pengguna yang keluar atau dikeluarkan dari sekolahnya kembali berstatus Pengguna dan boleh memasukkan kode sekolah lagi. Guru yang masih punya keanggotaan di sekolah lain tetap Guru.

**Akun Sekolah dan Admin**

- Dibuat oleh Admin di halaman manajemen akun (FR-A1), dengan role yang dipilih Admin.
- Akun dibuat dengan password sementara atau tautan undangan sekali pakai. Pengguna wajib mengganti password saat login pertama.
- Admin pertama dibuat lewat seed atau skrip di server, bukan lewat endpoint publik. Tidak ada URL registrasi Admin.
- Admin tidak bisa menurunkan atau menonaktifkan Admin terakhir.

**Login dan penetapan role**

- Satu halaman login untuk semua role.
- Setelah login, role dibaca dari server (session atau token), bukan dari klien. Bottom bar dan menu menyesuaikan role (tab Cari hanya untuk Admin, FR-A8).
- Pengguna tidak bisa mengubah role sendiri. Perubahan role hanya oleh Admin, dicatat di audit log, dan sesi pengguna itu dicabut supaya role baru langsung berlaku.
- Rate limit untuk percobaan login dan registrasi.

**Acceptance**

- Request registrasi yang mengirim role apa pun tidak mengubah role. Pendaftar baru menjadi Murid hanya setelah kode sekolah valid, dan menjadi Guru hanya setelah kode sekolah khusus guru valid.
- Akun non-admin tidak bisa memanggil endpoint pembuatan akun atau perubahan role, termasuk lewat API langsung.
- Setiap pembuatan akun Sekolah atau Admin dan setiap perubahan role tercatat di audit log.

**Keputusan untuk bagian ini**

- Akun lama dari registrasi polos belum punya role. Akun yang sudah masuk memakai kode sekolah otomatis dipilih sebagai Murid. Akun lama tanpa keanggotaan sekolah tidak bisa mengakses fitur apa pun sampai Admin menetapkan role, atau sampai pemiliknya memasukkan kode sekolah. Bila ada guru yang ikut terpilih sebagai Murid, Admin bisa mengubah rolenya.
- Akun Sekolah selalu dibuat Admin, tidak mendaftar sendiri. Akun Sekolah langsung terhubung ke sekolahnya sejak dibuat dan tidak perlu memasukkan kode sekolah. Admin mengisi data sekolah (nama, jenjang, status) saat membuat akun, dan kode sekolah dibuat otomatis.
- Tidak ada verifikasi email saat registrasi publik. Karena email tidak terbukti milik pendaftar, reset password dilakukan lewat delegasi berjenjang:
  - **Admin** dapat mereset password akun apa pun (FR-A1).
  - **Akun Sekolah** dapat mereset password sementara untuk Guru dan Murid yang terdaftar aktif di sekolahnya sendiri. Ini menghindari bottleneck operasional ke Admin pusat.
  - Pengguna wajib mengganti password sementara pada login pertama berikutnya.
- Pengaman utama pendaftaran adalah kode sekolah, persetujuan sekolah untuk guru, dan rate limit.
- Pendaftar murid disarankan mengisi nomor identitas sekolah (NISN/nomor induk) saat pertama kali join sekolah sebagai verifikasi tambahan bagi pihak Sekolah.
- Murid yang sudah keluar dari sekolah dan memakai kode sekolah khusus guru menjadi Guru. Hal ini tidak dicegah.

## 4. Matriks Akses

| Kemampuan | Admin | Sekolah | Guru | Murid |
| --- | --- | --- | --- | --- |
| Kelola semua akun dan role | Ya | Tidak | Tidak | Tidak |
| Buat kode sekolah dan kode kelas | Ya | Ya (sekolah sendiri) | Tidak | Tidak |
| Bergabung dengan kode | - | - | Kode sekolah khusus guru, lalu kelas | Sekolah, lalu kelas |
| Persetujuan masuk | - | Menyetujui guru | Perlu disetujui | Langsung masuk |
| Jumlah sekolah | Semua | 1 (miliknya) | Lebih dari 1 | 1 (asumsi) |
| Jumlah kelas aktif | Semua | Semua di sekolahnya | Banyak (yang sudah di-join) | 1 |
| Monitoring | Semua sekolah dan kelas | Semua kelas di sekolahnya | Kelas yang di-join | Kelas sendiri |
| Daftar anggota | Nama | Nama | Nama | Nama |
| Menu Cari | Ya | Tidak | Tidak | Tidak |
| Bubarkan kelas, urungkan, jalankan sekarang | Ya | Ya (sekolah sendiri) | Tidak | Tidak |
| Keluarkan anggota | Ya | Murid dan guru di sekolahnya | Murid di kelas yang ia ikuti | Tidak (keluar sendiri) |
| Lihat absensi | Semua (monitoring) | Semua kelas sekolahnya | Kelas yang ia ikuti | Seluruh kelasnya |
| Isi absensi | Tidak | Tidak | Isi dan koreksi untuk kelasnya, kapan saja | Diri sendiri, 07.00 sampai 09.00 |
| Label sakit, izin, alpa | Tidak | Tidak | Ya | Tidak |
| Catatan alasan sakit atau izin | Tidak | Lihat | Lihat dan isi | Tidak |
| Riwayat tugas periode lama | Tidak (demo: data contoh) | Tidak | Tidak | Tidak |
| Penugasan dan absensi periode lama | Tidak | Tidak | Periode yang ia ikuti, tugas buatannya | Tidak |
| Kalender libur nasional | Kelola | Lihat | Lihat | Lihat |
| Libur dan jendela absensi sekolah | Ya | Kelola (sekolah sendiri) | Tidak | Tidak |
| Tandai tanggal merah sebagai hari masuk | Tidak | Ya (sekolah sendiri) | Tidak | Tidak |
| Reset password pengguna | Semua akun | Guru dan murid di sekolahnya | Tidak | Tidak |

## 5. Requirements

Prioritas: P0 wajib dulu, P1 penting, P2 menyusul.

### FR-A1 (P0) Manajemen akun oleh Admin

- Admin melihat daftar akun dengan filter role (Sekolah, Guru, dan role lain).
- Admin bisa membuat akun dan menetapkan role, mengubah role, menonaktifkan, dan mereset akun. Akun Sekolah dan Admin hanya dibuat oleh Admin, bukan lewat registrasi publik (lihat FR-A15).
- Email atau identitas login hanya terlihat di halaman ini dan di halaman manajemen sekolah (FR-A16), bukan di daftar anggota kelas.
- **Acceptance:** akun non-admin tidak bisa membuka halaman ini, termasuk lewat URL atau API langsung.

### FR-A2 (P0) Bergabung ke sekolah dan kelas

- Murid memasukkan kode sekolah dan guru memasukkan kode sekolah khusus guru, keduanya lebih dulu sebelum kode kelas. Kode kelas hanya bisa dimasukkan setelah pengguna menjadi anggota sekolah pemilik kelas itu.
- **Murid** langsung masuk begitu kode sekolah dan kode kelas benar, tanpa persetujuan.
- **Guru** harus disetujui akun Sekolah. Selama berstatus *pending*, guru belum bisa mengakses apa pun. Setelah disetujui, guru memilih mata pelajaran yang ia ajar (FR-A3), lalu masuk ke kelas lewat kode kelas. Sekolah bisa mengaktifkan opsi setujui otomatis: guru yang memakai kode sekolah khusus guru langsung aktif tanpa menunggu persetujuan. Opsi ini mati secara bawaan.
- Guru boleh tergabung di banyak sekolah. Tiap keanggotaan berdiri sendiri (satu guru, satu sekolah, satu status).
- Murid hanya punya **satu kelas aktif**. Kalau murid yang sudah punya kelas memasukkan kode kelas lain, ditolak. Ia harus keluar dulu dari kelas lamanya.
- **Acceptance:** kode kelas ditolak bila pengguna belum menjadi anggota sekolah pemilik kelas. Guru hanya bisa masuk ke sekolah yang sudah menyetujuinya.

### FR-A3 (P0) Mata pelajaran berbasis checklist

- Akun Sekolah memilih jenjang (SMP, SMA, SMK) dan status (Negeri atau Swasta).
- Sistem menampilkan template mapel bawaan sebagai checklist. Semua item otomatis tercentang dan langsung ter-generate.
- Sekolah bisa melepas centang mapel yang tidak dipakai dan menambah mapel manual yang tidak ada di template.
- Setelah guru aktif di sekolah, guru memilih sendiri mata pelajaran yang ia ajar dari daftar mapel sekolah. Sekolah bisa melihat dan mengubah pilihan itu. Pilihan mapel berlaku di level sekolah, jadi tetap ada saat kelas dibubarkan.
- **Acceptance:** mengganti jenjang atau status memuat template yang sesuai. Mapel manual tersimpan tanpa mengubah template bawaan.

### FR-A4 (P0) Kode sekolah dan kode kelas

- Hanya akun Sekolah (dan Admin) yang membuat kode sekolah (untuk murid), kode sekolah khusus guru, dan kode kelas.
- Guru hanya bisa memakai kode kelas yang tersedia di sekolahnya.
- **Acceptance:** request pembuatan kode dari akun Guru atau Murid ditolak di server, bukan hanya disembunyikan di UI.

### FR-A5 (P1) Monitoring dan daftar anggota

- Cakupan monitoring: Admin melihat semua sekolah dan kelas (filter sekolah, lalu kelas). Sekolah melihat semua kelas di sekolahnya. Guru melihat kelas yang ia join. Murid melihat kelasnya sendiri.
- Isi monitoring: daftar anggota, penugasan, dan absensi.
- Daftar anggota Sekolah: anggota yang sudah join dengan kode sekolahnya. Murid yang sudah join sekolah tetapi belum masuk kelas muncul di daftar sekolah, tidak di daftar kelas mana pun.
- Daftar anggota Guru dan Murid: per kelas, tiap kelas punya isi sendiri. Murid hanya melihat kelas yang ia join.
- **Acceptance:** query selalu di-scope di server berdasarkan keanggotaan, bukan dari parameter klien. Guru dan sekolah tidak bisa melihat data sekolah lain.

### FR-A6 (P1) Guru berpindah kelas dan multi-sekolah context

- Guru berpindah antar kelas yang kodenya sudah ia masukkan, lewat pemilih kelas yang dikelompokkan per sekolah.
- Setiap interaksi guru menyertakan konteks sekolah aktif (lewat header atau parameter sesi).
- **Acceptance:** kelas yang belum pernah dimasukkan kodenya tidak muncul. Data sekolah A tidak terlihat saat guru berada di konteks sekolah B. Permintaan API dari guru divalidasi harus cocok dengan sekolah yang aktif di sesi.

### FR-A7 (P1) Rotasi kode mingguan

- Kode sekolah, kode sekolah khusus guru, dan kode kelas berganti otomatis setiap **Senin pukul 00:00 WIB**, memakai zona waktu `Asia/Jakarta` secara eksplisit di scheduled job.
- Kode lama langsung tidak berlaku untuk pendaftar baru. Anggota yang sudah bergabung tetap punya akses.
- Sekolah bisa melihat kode aktif dan menggantinya manual bila bocor.
- Kode acak, cukup panjang, dengan rate limit percobaan.
- Bila rotasi jatuh saat masa tunggu pembubaran (FR-A11), kode tetap berganti dan pembekuan tetap berlaku.

### FR-A8 (P0) Menu Cari khusus Admin

- Tab Cari di bottom bar hanya tampil untuk Admin.
- **Acceptance:** role lain tidak melihat tab itu dan tidak bisa membuka rutenya lewat URL.

### FR-A9 (P0) Keluar dan mengeluarkan anggota

- Murid bisa keluar sendiri dari kelasnya, lalu boleh memasukkan kode kelas baru.
- Guru bisa mengeluarkan murid dari kelas yang ia ikuti. Sekolah bisa mengeluarkan murid dan guru dari sekolahnya.
- Guru yang keluar atau dikeluarkan dari sekolah kehilangan akses ke semua kelas di sekolah itu. Murid yang dikeluarkan dari sekolah otomatis keluar dari kelasnya.
- Data tidak dihapus. Status keanggotaan berubah menjadi `aktif`, `keluar`, `dikeluarkan`, atau `lulus`.
- **Acceptance:** guru tidak bisa mengeluarkan anggota kelas yang tidak ia join, dicek di server.

### FR-A10 (P0) Privasi daftar anggota

- Daftar anggota untuk **semua role**, termasuk Sekolah dan Admin, hanya menampilkan **nama** plus nomor absen sebagai pembeda.
- **Acceptance:** response API daftar anggota tidak berisi field selain nama dan pembeda, untuk role apa pun.

### FR-A11 (P0) Bubarkan kelas (pembubaran terjadwal 24 jam)

Kelas tidak ditutup karena akan dipakai angkatan di bawahnya. Yang diakhiri hanya keanggotaan.

1. Sekolah mengetik kata "BUBARKAN", lalu sistem menjadwalkan pembubaran 24 jam ke depan untuk **semua kelas sekaligus** di sekolah itu. Admin bisa melakukannya untuk sekolah mana pun.
2. **Selama 24 jam, KBM tetap berjalan normal.** Murid dan guru tetap di kelas, tugas dan absensi tetap bisa dipakai.
3. Yang dikunci hanya **pendaftar baru**. Kode kelas tidak bisa dipakai masuk. Pendaftar melihat modal pemberitahuan berisi tanggal dan jam selesai. Murid yang keluar sendiri selama masa tunggu tidak bisa masuk kelas lain sampai selesai.
4. Murid, guru, sekolah, dan admin melihat **banner** di dalam kelas: "Kelas akan dibubarkan pada \[hari, tanggal, jam\]. Setelah itu kamu keluar dari kelas." Sekolah dan admin mendapat tombol **Urungkan** dan **Jalankan pembubaran sekarang**.
5. Setelah 24 jam (atau saat dijalankan sekarang): semua murid berstatus `lulus`, semua guru keluar dari kelas (keanggotaan sekolah tetap), periode lama ditutup, dan periode baru dibuka. Kelas tetap aktif dan kodenya tetap ikut rotasi. Guru memasukkan kode kelas lagi secara manual.
6. Setelah dijalankan, Urungkan tidak tersedia lagi. Bila diurungkan, banner hilang untuk semua orang.

- Dialog konfirmasi wajib memuat jumlah kelas dan murid terdampak, kata "BUBARKAN", dan teks: *"Selama 24 jam pendaftar baru tidak bisa masuk kelas. Setelah itu semua murid dan guru dikeluarkan dari semua kelas. Murid ditandai lulus, termasuk kelas yang bukan tingkat akhir. Status ini hanya penanda keluar dari kelas, bukan kelulusan dari sekolah."*
- **Kenaikan kelas:** Status `lulus` di `class_memberships` adalah penanda akhir periode di kelas itu, bukan kelulusan sekolah. Murid yang ingin bergabung ke kelas baru (kelas berikutnya) harus memasukkan kode kelas baru secara manual setelah pembubaran selesai. Sekolah mengatur pembuatan kelas baru dan kode kelas baru untuk angkatan naik kelas. Sistem tidak mencegah murid kelas 10 masuk kelas 12 selama kodenya valid — Sekolah bertanggung jawab mendistribusikan kode kelas hanya ke angkatan yang sesuai.
- Durasi 24 jam disimpan sebagai pengaturan, bukan angka tetap di kode.
- Aksi dicatat di audit log (siapa, kapan, kelas terdampak).
- **Acceptance:** request dari Guru atau Murid ditolak di server. Banner dibaca dari status jadwal di server, jadi pembatalan langsung terlihat semua orang. Setelah pembubaran, kelas kosong dan riwayat keanggotaan lama tetap tersimpan.

### FR-A12 (P1) Penugasan dan absensi periode lama untuk Guru

- Karena tugas, nilai, dan absensi terikat ke **periode**, murid baru tidak melihat data murid lama.
- Guru melihat **penugasan yang ia buat sendiri** (judul, tanggal, kelas tujuan) dan **absensi** dari periode di mana ia tercatat sebagai anggota kelas itu. Absensi menampilkan nama dan status hadir saja.
- Tidak tampil: isi soal, jawaban murid, lampiran, nilai per tugas, dan tugas buatan guru lain.
- Sekolah dan Admin tidak mendapat akses riwayat tugas.
- **Acceptance:** query difilter di server berdasarkan pembuat tugas dan catatan keanggotaan guru.

### FR-A13 (P1) Absensi mandiri dan kalender libur

**Absensi murid**

- Murid melihat absensi seluruh kelas, tetapi hanya bisa mengisi untuk dirinya sendiri, pada **07.00 sampai 09.00 WIB** di hari sekolah. Di luar jendela, tombol nonaktif dan server menolak request.
- Jendela waktu adalah pengaturan per sekolah, default 07.00 sampai 09.00. Pengecekan memakai `Asia/Jakarta` di server, bukan jam perangkat.
- Murid tidak bisa mengisi sakit atau izin sendiri.

**Status alpa otomatis**

- Murid yang tidak mengisi absensi pada hari sekolah, dan guru belum mengubah statusnya sampai **pukul 23.59 WIB** di hari itu, secara otomatis berstatus `alpa`. Eksekusi dilakukan oleh cron job server setiap hari pukul 23.59 WIB memakai zona waktu `Asia/Jakarta`. Guru tetap bisa mengoreksi status `alpa` ini kapan saja setelah cron berjalan.
- Murid yang statusnya sudah diisi guru sebelum cron tidak tersentuh cron.
- Jika hari itu libur atau bukan hari sekolah, cron tidak berjalan untuk sekolah itu.

**Peran guru**

- Guru mengisi dan mengoreksi absensi murid di kelasnya kapan saja pada hari sekolah, dengan status **hadir, sakit, izin, alpa**. Alpa adalah status bawaan bagi yang tidak mengisi dan belum diubah guru.
- Guru bisa menambah catatan singkat pada sakit atau izin.
- Setiap pengisian atau koreksi dicatat (siapa, kapan, nilai sebelum dan sesudah) dan diberi penanda "diisi guru" atau "dikoreksi guru".
- Absensi di hari non-sekolah tidak dibuka untuk guru.

**Privasi catatan**

- Murid lain hanya melihat status sakit atau izin, tanpa alasan. Catatan alasan hanya terlihat oleh guru dan sekolah.

**Kalender libur**

- Hari sekolah = hari kerja sekolah (default Senin sampai Jumat, bisa diubah per sekolah) dikurangi tanggal merah.
- Kalender libur nasional (termasuk cuti bersama) disimpan di tabel sendiri dan diisi manual oleh Admin tiap tahun dari SKB Tiga Menteri.
- Sekolah bisa menambah libur sendiri dan menandai satu tanggal merah sebagai hari masuk, hanya untuk sekolahnya sendiri. Admin tidak bisa menandai hari masuk.
- Absensi hanya membaca tabel lokal, tidak memanggil API pihak ketiga saat murid mengisi.
- **Acceptance:** response API murid tidak mengandung field catatan. Request pengisian untuk murid lain, di luar jendela waktu, atau di hari non-sekolah ditolak server.

### FR-A14 (P2) Mode demo untuk Admin

- Akses penuh Admin ke konten tugas dan jawaban hanya berlaku di **mode demo**.
- Saran: mode demo memakai data contoh (dummy) di lingkungan terpisah, bukan membuka jawaban murid asli di produksi.

### FR-A16 (P1) Delegasi reset password ke akun Sekolah

- Akun Sekolah dapat mereset password sementara untuk Guru atau Murid yang berstatus `aktif` di sekolahnya.
- Reset menghasilkan password sementara acak dan menyetel flag `must_change_password = true`. Pengguna wajib mengganti password di login pertama berikutnya.
- Akun Sekolah tidak bisa mereset password akun Admin atau akun Sekolah lain.
- Setiap aksi reset dicatat di audit log (siapa mereset, akun siapa yang direset, kapan).
- **Acceptance:** endpoint reset dari akun Sekolah hanya berhasil bila target user memiliki `school_membership` aktif di sekolah yang sama. Dicek di server.

### FR-A17 (P1) Riwayat absensi mandiri murid

- Murid dapat melihat riwayat absensinya sendiri per bulan di kelas aktifnya: tanggal, status (hadir/sakit/izin/alpa), dan apakah ada koreksi dari guru.
- Murid tidak melihat kolom catatan alasan (tetap privasi FR-A10).
- **Acceptance:** query difilter di server hanya untuk `user_id` yang sesuai token. Murid tidak bisa melihat riwayat murid lain.

## 6. Model Data (usulan)

| Tabel | Isi utama |
| --- | --- |
| users | id, nama, email, role global (admin, sekolah, guru, murid, pengguna), password hash, wajib ganti password, status aktif |
| schools | id, nama, jenjang, status (negeri atau swasta), pengaturan jendela absensi, hari kerja, dan setujui otomatis guru |
| school\_memberships | user, school, peran (guru atau murid), status (`pending`, `aktif`, `keluar`, `dikeluarkan`), waktu masuk dan keluar |
| classes | id, school, nama, tingkat |
| periods | id, class, mulai, selesai (periode aktif satu per kelas) |
| class\_memberships | user, class, period, peran, status (`aktif`, `keluar`, `dikeluarkan`, `lulus`), waktu masuk dan keluar |
| access\_codes | scope (sekolah untuk murid, sekolah untuk guru, atau kelas), target id, kode, berlaku dari, berlaku sampai, aktif |
| dissolution\_schedules | school, dijadwalkan pada, dieksekusi pada, status (`terjadwal`, `diurungkan`, `selesai`), dibuat oleh |
| subject\_templates | jenjang, status sekolah, nama mapel |
| subjects | school, nama, asal template atau manual, aktif |
| teacher\_subjects | guru, school, subject |
| assignments | class, period, pembuat, judul, tanggal |
| attendance | murid, class, period, tanggal, status, catatan, diisi oleh, waktu isi, penanda koreksi |
| attendance\_audit | attendance id, siapa, kapan, nilai sebelum, nilai sesudah |
| holidays | tanggal, nama, jenis (libur nasional atau cuti bersama) |
| school\_calendar\_overrides | school, tanggal, hari masuk atau libur sekolah |
| audit\_log | aksi sensitif (bubarkan, kick, ganti kode, ubah role) |

**Constraint penting**

- Satu murid hanya boleh punya satu `class_memberships` berstatus `aktif`.
- Satu guru boleh punya banyak `school_memberships`, tetapi satu per sekolah.
- Kode kelas hanya bisa dipakai bila ada `school_memberships` aktif (murid) atau disetujui (guru) di sekolah pemilik kelas.

## 7. Catatan Teknis dan Keamanan

- Hak akses dicek di server (middleware atau policy). Menyembunyikan menu di UI tidak cukup.
- Data di-scope per sekolah dan per keanggotaan. Parameter klien tidak dipercaya untuk menentukan cakupan. **Fungsi `canManageSchool` untuk role `sekolah` wajib memvalidasi `owner_user_id` cocok dengan user yang sedang login; bukan `return true`.**
- Kode akses acak, cukup panjang, dengan rate limit percobaan. Karena murid langsung masuk, kode yang bocor berarti siapa pun bisa bergabung. Pengamannya adalah rotasi mingguan, ganti kode manual, kick, dan rate limit.
- Response API daftar anggota dan absensi murid hanya berisi field yang diizinkan, dicek di sisi server.
- Penjadwalan (rotasi kode, eksekusi pembubaran, cron alpa) memakai zona waktu `Asia/Jakarta`.
- Jangan hapus data keanggotaan. Pakai status supaya riwayat tetap ada.
- **Persistensi data:** tabel baru (memberships, classes, attendance, audit_log, codes, dll.) wajib di-persist ke PostgreSQL, bukan hanya in-memory. Restart server tidak boleh menghapus data kelas dan absensi.

## 8. Ditunda dan Di Luar Cakupan

- **Impor kalender libur dari API komunitas** (P2, keputusan menyusul). Beberapa API komunitas ada (misalnya api-harilibur, dayoff-api), tetapi tidak resmi dan perlu dicek dulu apakah masih aktif. Server tetap hanya membaca tabel lokal, jadi fitur ini bisa ditambah tanpa mengubah logika absensi.
- Riwayat tugas lintas periode berisi nama murid dan nilai: dibatalkan.
- Akses penuh Sekolah dan Admin ke isi tugas dan jawaban periode lama: dibatalkan, kecuali mode demo.
- Murid di lebih dari satu sekolah: tidak dibahas, diasumsikan satu sekolah.
- **Validasi tingkat/jenjang murid saat join kelas** (kelas 10 tidak bisa join kelas 12): di luar cakupan. Sekolah bertanggung jawab distribusi kode kelas per angkatan.
- **Jendela absensi per kelas atau per shift** (untuk SMK shift siang/malam): di luar cakupan saat ini. Jendela saat ini hanya per sekolah.

## 9. Asumsi yang Perlu Dicek

1. Murid hanya tergabung di satu sekolah.
2. Monitoring mencakup daftar anggota, penugasan, dan absensi. Apakah nilai aktif juga masuk monitoring belum diputuskan secara eksplisit.
3. Guru tetap bisa memberi tugas dan mengisi absensi selama masa tunggu pembubaran 24 jam.
4. Admin menjalankan aksi atas nama sekolah (bubarkan, urungkan) tanpa persetujuan tambahan.
5. Status `alpa` di-set oleh cron job server pukul 23.59 WIB setiap hari sekolah, bukan oleh query on-demand.
6. Hari kerja default Senin sampai Jumat, bisa diubah per sekolah. `isSchoolDay()` wajib membaca `school.work_days` dari DB, bukan hardcode.
7. Daftar tanggal merah mengikuti SKB Tiga Menteri tiap tahun. Perubahan mendadak ditangani admin lewat tabel.
8. Google auth tidak memverifikasi token di sisi server saat ini. Sebelum production, integrasi `google-auth-library` wajib diaktifkan.
