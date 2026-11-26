// server/test/assignments.test.mjs
// Regresi FR-A12: Penugasan dan absensi periode lama untuk Guru

import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.TEST_MODE = '1';

const { app } = await import('../dist/index.js');
const { db } = await import('../dist/db/store.js');

let server;
let baseUrl;
let adminToken;
let guruToken;
let guruUserId;
let guruToken2;
let guruUserId2;
let muridToken;
let muridUserId;

const SCHOOL_ID = 'sch_asgn_test';
const CLASS_ID = 'cls_asgn_test';
const PERIOD_OLD = 'prd_asgn_old';
const PERIOD_NEW = 'prd_asgn_new';

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });

  // Setup sekolah + kelas + 2 periode (1 lama, 1 aktif)
  db.schools.set(SCHOOL_ID, {
    id: SCHOOL_ID, place_id: 'pl_asgn', nama: 'SMP Negeri Tugas', jenjang: 'SMP', status: 'Negeri',
    alamat: 'Jl Tugas', lat: -6.5, lng: 106.8, foto_url: '', kecamatan: 'X', kelurahan: 'Y', kota_kab: 'Bogor', provinsi: 'Jawa Barat',
  });
  db.classes.set(CLASS_ID, { id: CLASS_ID, school_id: SCHOOL_ID, nama: 'Kelas 7A', tingkat: 7, created_at: new Date().toISOString() });

  // Periode lama (tidak aktif)
  db.periods.set(PERIOD_OLD, { id: PERIOD_OLD, class_id: CLASS_ID, start_date: '2025-01-01', end_date: '2025-12-31', is_active: false });
  // Periode baru (aktif)
  db.periods.set(PERIOD_NEW, { id: PERIOD_NEW, class_id: CLASS_ID, start_date: '2026-01-01', is_active: true });

  // Login admin
  const aRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@skita.id', password: 'Admin@2026!' }),
  });
  adminToken = (await aRes.json()).token;

  // Register 2 guru + 1 murid
  for (const [email, varToken, varId] of [
    ['guru.asgn1@skita.id', 'guruToken', 'guruUserId'],
    ['guru.asgn2@skita.id', 'guruToken2', 'guruUserId2'],
    ['murid.asgn@skita.id', 'muridToken', 'muridUserId'],
  ]) {
    const r = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nama: email, email, password: 'password123' }),
    });
    const d = await r.json();
    if (varToken === 'guruToken') { guruToken = d.token; guruUserId = d.user.id; }
    else if (varToken === 'guruToken2') { guruToken2 = d.token; guruUserId2 = d.user.id; }
    else { muridToken = d.token; muridUserId = d.user.id; }
  }

  // Set role
  for (const [uid, role] of [[guruUserId, 'guru'], [guruUserId2, 'guru'], [muridUserId, 'murid']]) {
    const u = db.users.get(uid); if (u) { u.role = role; db.users.set(uid, u); }
  }

  // Guru 1: anggota DI PERIODE LAMA (keluar setelah pembubaran)
  db.classMemberships.set('cm_g1_old', {
    id: 'cm_g1_old', user_id: guruUserId, class_id: CLASS_ID, period_id: PERIOD_OLD,
    role: 'guru', status: 'keluar', joined_at: '2025-01-01T00:00:00.000Z', left_at: '2025-12-31T00:00:00.000Z',
  });

  // Guru 1: juga anggota aktif di periode baru
  db.classMemberships.set('cm_g1_new', {
    id: 'cm_g1_new', user_id: guruUserId, class_id: CLASS_ID, period_id: PERIOD_NEW,
    role: 'guru', status: 'aktif', joined_at: '2026-01-01T00:00:00.000Z',
  });

  // Guru 2: anggota aktif HANYA di periode baru
  db.classMemberships.set('cm_g2_new', {
    id: 'cm_g2_new', user_id: guruUserId2, class_id: CLASS_ID, period_id: PERIOD_NEW,
    role: 'guru', status: 'aktif', joined_at: '2026-01-01T00:00:00.000Z',
  });

  // Murid aktif di periode baru
  db.classMemberships.set('cm_m_new', {
    id: 'cm_m_new', user_id: muridUserId, class_id: CLASS_ID, period_id: PERIOD_NEW,
    role: 'murid', status: 'aktif', joined_at: '2026-01-01T00:00:00.000Z',
  });

  // Seed tugas guru 1 di periode lama
  db.assignments.set('asgn_g1_old', {
    id: 'asgn_g1_old', class_id: CLASS_ID, period_id: PERIOD_OLD,
    creator_id: guruUserId, judul: 'Tugas Lama Guru 1', tanggal: '2025-10-01',
  });

  // Seed absensi di periode lama
  db.attendance.set('att_old', {
    id: 'att_old', murid_id: muridUserId, class_id: CLASS_ID, period_id: PERIOD_OLD,
    tanggal: '2025-10-01', status: 'hadir', diisi_oleh: guruUserId,
    waktu_isi: '2025-10-01T07:30:00.000Z', is_koreksi_guru: true,
    catatan: 'Catatan sensitif dari periode lama',
  });
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

// FR-A12: Guru buat penugasan baru
test('POST /api/assignments — guru buat tugas di kelas aktif', async () => {
  const res = await fetch(`${baseUrl}/api/assignments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${guruToken}` },
    body: JSON.stringify({ class_id: CLASS_ID, judul: 'PR Matematika Bab 5', tanggal: '2026-11-24' }),
  });
  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(json.assignment.creator_id, guruUserId);
  assert.equal(json.assignment.judul, 'PR Matematika Bab 5');
  assert.equal(json.assignment.period_id, PERIOD_NEW);
});

// FR-A12: Murid tidak bisa buat penugasan
test('POST /api/assignments — murid ditolak 403', async () => {
  const res = await fetch(`${baseUrl}/api/assignments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${muridToken}` },
    body: JSON.stringify({ class_id: CLASS_ID, judul: 'Tugas Murid Ilegal' }),
  });
  assert.equal(res.status, 403);
});

// FR-A12: Admin tidak bisa buat penugasan
test('POST /api/assignments — admin ditolak 403', async () => {
  const res = await fetch(`${baseUrl}/api/assignments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ class_id: CLASS_ID, judul: 'Tugas Admin Ilegal' }),
  });
  assert.equal(res.status, 403);
});

// FR-A12: Guru lihat tugas MILIK SENDIRI saja
test('GET /api/assignments/my — guru hanya melihat tugas buatannya sendiri', async () => {
  // Seed tugas oleh guru 2
  db.assignments.set('asgn_g2_new', {
    id: 'asgn_g2_new', class_id: CLASS_ID, period_id: PERIOD_NEW,
    creator_id: guruUserId2, judul: 'Tugas Guru 2', tanggal: '2026-11-24',
  });

  const res = await fetch(`${baseUrl}/api/assignments/my?class_id=${CLASS_ID}`, {
    headers: { Authorization: `Bearer ${guruToken}` },
  });
  assert.equal(res.status, 200);
  const json = await res.json();

  const ids = json.assignments.map((a) => a.id);
  // Guru 1 harus lihat tugas lamanya + tugas baru yang baru dibuat di tes sebelumnya
  assert.ok(ids.includes('asgn_g1_old'), 'Tugas periode lama guru 1 harus muncul');
  // Guru 1 TIDAK boleh lihat tugas guru 2
  assert.equal(ids.includes('asgn_g2_new'), false, 'Tugas buatan guru lain tidak boleh muncul');

  // Response tidak boleh mengandung field soal/lampiran/nilai
  for (const a of json.assignments) {
    assert.equal('soal' in a, false);
    assert.equal('lampiran' in a, false);
    assert.equal('nilai' in a, false);
  }
});

// FR-A12: Admin TIDAK mendapat akses riwayat tugas
test('GET /api/assignments/my — admin ditolak 403', async () => {
  const res = await fetch(`${baseUrl}/api/assignments/my`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 403);
});

// FR-A12: Guru lihat riwayat absensi dari periode di mana ia anggota
test('GET /api/assignments/history/attendance/:class/:period — guru 1 lihat periode lama', async () => {
  const res = await fetch(`${baseUrl}/api/assignments/history/attendance/${CLASS_ID}/${PERIOD_OLD}`, {
    headers: { Authorization: `Bearer ${guruToken}` },
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.ok(json.records.length >= 1);

  // Hanya nama + status, TIDAK ada catatan (FR-A12)
  for (const r of json.records) {
    assert.ok('nama' in r);
    assert.ok('status' in r);
    assert.equal('catatan' in r, false, 'Field catatan tidak boleh ada di riwayat absensi guru');
  }
});

// FR-A12: Guru 2 TIDAK bisa lihat absensi periode lama (ia tidak tercatat sebagai anggota di periode itu)
test('GET /api/assignments/history/attendance/:class/:period — guru 2 ditolak untuk periode lama', async () => {
  const res = await fetch(`${baseUrl}/api/assignments/history/attendance/${CLASS_ID}/${PERIOD_OLD}`, {
    headers: { Authorization: `Bearer ${guruToken2}` },
  });
  assert.equal(res.status, 403);
  const json = await res.json();
  assert.ok(json.message.includes('tidak tercatat'));
});

// FR-A12: Murid baru di periode baru tidak bisa lihat absensi periode lama
test('GET /api/assignments/history/attendance/:class/:period — murid ditolak 403', async () => {
  const res = await fetch(`${baseUrl}/api/assignments/history/attendance/${CLASS_ID}/${PERIOD_OLD}`, {
    headers: { Authorization: `Bearer ${muridToken}` },
  });
  assert.equal(res.status, 403);
});

// Penugasan Kelas: Auto-seed sample tugas jika kosong
test('GET /api/assignments/class/:class_id — auto-seed sample tugas saat kelas kosong', async () => {
  const freshClassId = 'cls_seed_sample_test';
  const res = await fetch(`${baseUrl}/api/assignments/class/${freshClassId}`, {
    headers: { Authorization: `Bearer ${muridToken}` },
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.ok(json.assignments.length >= 2, 'Harus ada contoh tugas auto-seed');
  const judulList = json.assignments.map((a) => a.judul);
  assert.ok(judulList.some((j) => j.includes('Matematika')));
  assert.ok(judulList.some((j) => j.includes('Biologi')));
});

// Pengumpulan Tugas: Berkas Foto, Word, Excel, PDF dan Deadline Lock
test('POST /api/assignments/:id/submit — murid kumpul berkas dan terkunci saat deadline habis', async () => {
  // Tugas 1: Deadline masa depan (aktif)
  const activeAsgnId = 'asgn_test_active';
  db.assignments.set(activeAsgnId, {
    id: activeAsgnId,
    class_id: CLASS_ID,
    period_id: PERIOD_NEW,
    creator_id: guruUserId,
    judul: 'Tugas Aktif Lampiran',
    deadline: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    tanggal: '2026-11-22',
  });

  const submitRes = await fetch(`${baseUrl}/api/assignments/${activeAsgnId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${muridToken}` },
    body: JSON.stringify({
      catatan: 'Lampiran pengerjaan tugas lengkap',
      files: [
        { name: 'Jawaban_Foto.jpg', type: 'photo', size: 1200000 },
        { name: 'Dokumen_Analisis.docx', type: 'word', size: 350000 },
        { name: 'Tabel_Hitung.xlsx', type: 'excel', size: 210000 },
        { name: 'Berkas_Laporan.pdf', type: 'pdf', size: 2400000 },
      ],
    }),
  });
  assert.equal(submitRes.status, 201);
  const submitJson = await submitRes.json();
  assert.equal(submitJson.success, true);
  assert.equal(submitJson.submission.files.length, 4);

  // Tugas 2: Deadline sudah lewat (terkunci)
  const expiredAsgnId = 'asgn_test_expired';
  db.assignments.set(expiredAsgnId, {
    id: expiredAsgnId,
    class_id: CLASS_ID,
    period_id: PERIOD_NEW,
    creator_id: guruUserId,
    judul: 'Tugas Terkunci',
    deadline: new Date(Date.now() - 3600 * 1000).toISOString(),
    tanggal: '2026-11-22',
  });

  const lockRes = await fetch(`${baseUrl}/api/assignments/${expiredAsgnId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${muridToken}` },
    body: JSON.stringify({
      catatan: 'Coba kumpul telat',
      files: [{ name: 'Telat.pdf', type: 'pdf', size: 1000 }],
    }),
  });
  assert.equal(lockRes.status, 403);
  const lockJson = await lockRes.json();
  assert.equal(lockJson.success, false);
  assert.ok(lockJson.message.toLowerCase().includes('tenggat'));
});
