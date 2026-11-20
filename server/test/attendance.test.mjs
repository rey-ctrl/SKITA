// server/test/attendance.test.mjs
// Regresi FR-A13: Absensi mandiri murid & kalender libur

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
let muridToken;
let muridUserId;
let muridToken2;
let muridUserId2;

const SCHOOL_ID = 'sch_att_test';
const CLASS_ID = 'cls_att_test';
const PERIOD_ID = 'prd_att_test';

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });

  // Setup data sekolah, kelas, periode
  db.schools.set(SCHOOL_ID, {
    id: SCHOOL_ID, place_id: 'pl_att', nama: 'SMP Negeri Absensi', jenjang: 'SMP', status: 'Negeri',
    alamat: 'Jl Absensi', lat: -6.5, lng: 106.8, foto_url: '', kecamatan: 'X', kelurahan: 'Y',
    kota_kab: 'Bogor', provinsi: 'Jawa Barat',
  });
  db.classes.set(CLASS_ID, { id: CLASS_ID, school_id: SCHOOL_ID, nama: 'Kelas 7A', tingkat: 7, created_at: new Date().toISOString() });
  db.periods.set(PERIOD_ID, { id: PERIOD_ID, class_id: CLASS_ID, start_date: '2026-01-01', is_active: true });

  // Login admin
  const aRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@skita.id', password: 'Admin@2026!' }),
  });
  adminToken = (await aRes.json()).token;

  // Register guru & murid
  const gRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nama: 'Guru Absensi', email: 'guru.absensi@skita.id', password: 'password123' }),
  });
  const gData = await gRes.json();
  guruToken = gData.token; guruUserId = gData.user.id;

  const mRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nama: 'Murid Absensi', email: 'murid.absensi@skita.id', password: 'password123' }),
  });
  const mData = await mRes.json();
  muridToken = mData.token; muridUserId = mData.user.id;

  const mRes2 = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nama: 'Murid Lain', email: 'murid.lain@skita.id', password: 'password123' }),
  });
  const mData2 = await mRes2.json();
  muridToken2 = mData2.token; muridUserId2 = mData2.user.id;

  // Set role
  for (const [uid, role] of [[guruUserId, 'guru'], [muridUserId, 'murid'], [muridUserId2, 'murid']]) {
    const u = db.users.get(uid); if (u) { u.role = role; db.users.set(uid, u); }
  }

  // Setup keanggotaan
  db.schoolMemberships.set('sm_g_att', { id: 'sm_g_att', user_id: guruUserId, school_id: SCHOOL_ID, role: 'guru', status: 'aktif', joined_at: new Date().toISOString() });
  db.schoolMemberships.set('sm_m_att', { id: 'sm_m_att', user_id: muridUserId, school_id: SCHOOL_ID, role: 'murid', status: 'aktif', joined_at: new Date().toISOString() });
  db.schoolMemberships.set('sm_m2_att', { id: 'sm_m2_att', user_id: muridUserId2, school_id: SCHOOL_ID, role: 'murid', status: 'aktif', joined_at: new Date().toISOString() });

  db.classMemberships.set('cm_g_att', { id: 'cm_g_att', user_id: guruUserId, class_id: CLASS_ID, period_id: PERIOD_ID, role: 'guru', status: 'aktif', joined_at: new Date().toISOString() });
  db.classMemberships.set('cm_m_att', { id: 'cm_m_att', user_id: muridUserId, class_id: CLASS_ID, period_id: PERIOD_ID, role: 'murid', status: 'aktif', joined_at: new Date().toISOString() });
  db.classMemberships.set('cm_m2_att', { id: 'cm_m2_att', user_id: muridUserId2, class_id: CLASS_ID, period_id: PERIOD_ID, role: 'murid', status: 'aktif', joined_at: new Date().toISOString() });
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

// ============================================================
// Helpers
// ============================================================

// Inject absensi langsung ke DB (bypass window, untuk persiapan tes koreksi guru)
function seedAttendance(muridId, classId, periodId, tanggal, status = 'alpa', catatanVal) {
  const rec = {
    id: `att_seed_${muridId}_${tanggal}`,
    murid_id: muridId,
    class_id: classId,
    period_id: periodId,
    tanggal,
    status,
    catatan: catatanVal,
    diisi_oleh: muridId,
    waktu_isi: new Date().toISOString(),
    is_koreksi_guru: false,
  };
  db.attendance.set(rec.id, rec);
  return rec;
}

// ============================================================
// FR-A13: Kalender Libur Nasional (Admin)
// ============================================================

test('POST /api/holidays — admin tambah libur nasional', async () => {
  const res = await fetch(`${baseUrl}/api/holidays`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ tanggal: '2026-11-20', nama: 'Hari Libur Uji', jenis: 'nasional' }),
  });
  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(json.holiday.tanggal, '2026-11-20');
});

test('POST /api/holidays — guru tidak bisa tambah libur nasional', async () => {
  const res = await fetch(`${baseUrl}/api/holidays`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${guruToken}` },
    body: JSON.stringify({ tanggal: '2026-12-01', nama: 'Libur Illegal', jenis: 'nasional' }),
  });
  assert.equal(res.status, 403);
});

test('GET /api/holidays — semua bisa lihat daftar libur', async () => {
  const res = await fetch(`${baseUrl}/api/holidays`, {
    headers: { Authorization: `Bearer ${muridToken}` },
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.ok(json.holidays.length >= 1);
});

// ============================================================
// FR-A13: Kalender Override Sekolah
// ============================================================

test('POST /api/school-calendar/:id — sekolah tambah libur khusus', async () => {
  const res = await fetch(`${baseUrl}/api/school-calendar/${SCHOOL_ID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ tanggal: '2026-11-21', override_type: 'libur' }),
  });
  // admin bisa tambah 'libur' untuk sekolah
  assert.ok([200, 201].includes(res.status));
});

test('POST /api/school-calendar/:id — admin TIDAK bisa tandai hari masuk (FR-A13)', async () => {
  const res = await fetch(`${baseUrl}/api/school-calendar/${SCHOOL_ID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ tanggal: '2026-11-20', override_type: 'masuk' }),
  });
  assert.equal(res.status, 403);
  const json = await res.json();
  assert.ok(json.message.includes('Admin tidak berwenang'));
});

// ============================================================
// FR-A13: Absensi mandiri murid (di luar jendela waktu → ditolak server)
// ============================================================

test('POST /api/attendance/self — ditolak di luar jendela 07.00-09.00 WIB', async () => {
  // Jam server test kemungkinan besar bukan 07.00-09.00 WIB → harus ditolak
  const res = await fetch(`${baseUrl}/api/attendance/self`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${muridToken}` },
    body: JSON.stringify({}),
  });
  // Harus 403 (di luar jendela) atau 403 (hari non-sekolah) — keduanya merupakan rejection server yang benar
  // Tes ini run pada hari kerja & jam test CI: rejection pasti karena salah satu kondisi
  assert.ok(
    res.status === 403 || res.status === 409,
    `Expected 403 or 409 (server gate), got ${res.status}`
  );
});

test('POST /api/attendance/self — murid bukan role murid ditolak 403', async () => {
  // Admin bukan murid, tidak bisa akses /self
  const res = await fetch(`${baseUrl}/api/attendance/self`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 403);
});

// ============================================================
// FR-A13: Guru isi absensi (hari non-sekolah → ditolak)
// ============================================================

test('POST /api/attendance/guru — guru isi absensi pada hari libur nasional ditolak', async () => {
  // 2026-11-20 sudah diset sebagai libur nasional di test sebelumnya
  const res = await fetch(`${baseUrl}/api/attendance/guru`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${guruToken}` },
    body: JSON.stringify({
      murid_id: muridUserId,
      class_id: CLASS_ID,
      date: '2026-11-20',
      status: 'hadir',
    }),
  });
  assert.equal(res.status, 403);
  const json = await res.json();
  assert.ok(json.message.includes('bukan hari sekolah'));
});

test('POST /api/attendance/guru — guru isi absensi pada Sabtu ditolak', async () => {
  // Cari tanggal Sabtu yang bukan hari libur khusus
  const res = await fetch(`${baseUrl}/api/attendance/guru`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${guruToken}` },
    body: JSON.stringify({
      murid_id: muridUserId,
      class_id: CLASS_ID,
      date: '2026-11-21',  // Sabtu (2026-11-21 adalah Sabtu + sudah override libur)
      status: 'hadir',
    }),
  });
  assert.equal(res.status, 403);
});

test('POST /api/attendance/guru — guru bukan anggota kelas ditolak 403', async () => {
  // Buat kelas lain yang tidak diikuti guru
  const otherClass = 'cls_other_att';
  db.classes.set(otherClass, { id: otherClass, school_id: SCHOOL_ID, nama: 'Kelas 8A', tingkat: 8, created_at: new Date().toISOString() });
  db.periods.set('prd_other', { id: 'prd_other', class_id: otherClass, start_date: '2026-01-01', is_active: true });
  db.classMemberships.set('cm_m_other', { id: 'cm_m_other', user_id: muridUserId, class_id: otherClass, period_id: 'prd_other', role: 'murid', status: 'aktif', joined_at: new Date().toISOString() });

  const res = await fetch(`${baseUrl}/api/attendance/guru`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${guruToken}` },
    body: JSON.stringify({
      murid_id: muridUserId,
      class_id: otherClass,
      date: '2026-11-23', // Senin hari sekolah
      status: 'hadir',
    }),
  });
  assert.equal(res.status, 403);
  const json = await res.json();
  assert.ok(json.message.includes('tidak terdaftar di kelas ini'));
});

test('POST /api/attendance/guru — guru isi absensi valid (Senin)', async () => {
  const res = await fetch(`${baseUrl}/api/attendance/guru`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${guruToken}` },
    body: JSON.stringify({
      murid_id: muridUserId,
      class_id: CLASS_ID,
      date: '2026-11-23', // Senin — hari sekolah
      status: 'sakit',
      catatan: 'Demam tinggi',
    }),
  });
  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(json.action, 'isi');
  assert.equal(json.attendance.status, 'sakit');
  assert.equal(json.attendance.catatan, 'Demam tinggi');
  assert.equal(json.attendance.is_koreksi_guru, true);
});

test('POST /api/attendance/guru — koreksi absensi yang sudah ada (audit trail disimpan)', async () => {
  // Koreksi absensi 2026-11-23 yang sudah diisi ke 'izin'
  const res = await fetch(`${baseUrl}/api/attendance/guru`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${guruToken}` },
    body: JSON.stringify({
      murid_id: muridUserId,
      class_id: CLASS_ID,
      date: '2026-11-23',
      status: 'izin',
      catatan: 'Izin keluarga',
    }),
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.action, 'koreksi');
  assert.equal(json.attendance.status, 'izin');

  // Audit trail harus ada (koreksi dari 'sakit' ke 'izin')
  const audits = [...db.attendanceAudit.values()];
  const audit = audits.find((a) => a.status_sebelum === 'sakit' && a.status_sesudah === 'izin');
  assert.ok(audit, 'Audit trail harus tersimpan');
  assert.equal(audit.actor_id, guruUserId);
});

// ============================================================
// FR-A13: Privasi catatan — murid lain tidak melihat catatan
// ============================================================

test('GET /api/attendance/class/:id — murid tidak bisa lihat catatan', async () => {
  // Seed absensi dengan catatan di hari Senin
  seedAttendance(muridUserId2, CLASS_ID, PERIOD_ID, '2026-11-23', 'sakit', 'Catatan rahasia dokter');

  const res = await fetch(`${baseUrl}/api/attendance/class/${CLASS_ID}?date=2026-11-23`, {
    headers: { Authorization: `Bearer ${muridToken2}` },
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  // Murid (role 'murid') tidak mendapat field catatan
  for (const rec of json.records) {
    assert.equal('catatan' in rec, false, `Field catatan tidak boleh ada untuk murid. Record: ${JSON.stringify(rec)}`);
  }
});

test('GET /api/attendance/class/:id — guru melihat semua termasuk catatan', async () => {
  const res = await fetch(`${baseUrl}/api/attendance/class/${CLASS_ID}?date=2026-11-23`, {
    headers: { Authorization: `Bearer ${guruToken}` },
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  // Guru bisa lihat catatan
  const withNote = json.records.find((r) => r.catatan !== undefined);
  assert.ok(withNote, 'Guru harus bisa melihat catatan');
});

test('GET /api/attendance/class/:id — murid luar kelas ditolak 403', async () => {
  const outsider = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nama: 'Outsider', email: 'outsider.att@skita.id', password: 'password123' }),
  });
  const oData = await outsider.json();

  const res = await fetch(`${baseUrl}/api/attendance/class/${CLASS_ID}`, {
    headers: { Authorization: `Bearer ${oData.token}` },
  });
  assert.equal(res.status, 403);
});
