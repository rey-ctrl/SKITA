// server/test/dissolution.test.mjs
// Regresi FR-A11: Bubarkan kelas (pembubaran terjadwal 24 jam)

import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.TEST_MODE = '1';

const { app } = await import('../dist/index.js');
const { db } = await import('../dist/db/store.js');

let server;
let baseUrl;
let adminToken;
let sekolahToken;
let guruToken;
let muridToken;

const SCHOOL_ID = 'sch_smpn_diss_test';
const CLASS_1_ID = 'cls_8a_test';
const CLASS_2_ID = 'cls_8b_test';
const PERIOD_1_ID = 'prd_8a_test';
const PERIOD_2_ID = 'prd_8b_test';

let muridUserId;
let guruUserId;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });

  // Setup 2 kelas & periode aktif
  db.classes.set(CLASS_1_ID, {
    id: CLASS_1_ID,
    school_id: SCHOOL_ID,
    nama: 'Kelas 8A',
    tingkat: 8,
    created_at: new Date().toISOString(),
  });
  db.periods.set(PERIOD_1_ID, {
    id: PERIOD_1_ID,
    class_id: CLASS_1_ID,
    start_date: '2026-07-01',
    is_active: true,
  });

  db.classes.set(CLASS_2_ID, {
    id: CLASS_2_ID,
    school_id: SCHOOL_ID,
    nama: 'Kelas 8B',
    tingkat: 8,
    created_at: new Date().toISOString(),
  });
  db.periods.set(PERIOD_2_ID, {
    id: PERIOD_2_ID,
    class_id: CLASS_2_ID,
    start_date: '2026-07-01',
    is_active: true,
  });

  // Login admin seed
  const aRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@skita.id', password: 'Admin@2026!' }),
  });
  adminToken = (await aRes.json()).token;

  // Akun sekolah
  await fetch(`${baseUrl}/api/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ nama: 'Sekolah Dissolution', email: 'sek.diss@skita.id', password: 'password123', role: 'sekolah' }),
  });
  const sLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'sek.diss@skita.id', password: 'password123' }),
  });
  const sData = await sLogin.json();
  sekolahToken = sData.token;
  db.schoolConfigs.set(SCHOOL_ID, {
    id: SCHOOL_ID,
    nama: 'SMPN Diss Test',
    owner_user_id: sData.user.id,
    created_at: new Date().toISOString(),
  });

  // Guru
  const gRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nama: 'Guru Diss', email: 'guru.diss@skita.id', password: 'password123' }),
  });
  const gData = await gRes.json();
  guruToken = gData.token;
  guruUserId = gData.user.id;

  // Murid
  const mRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nama: 'Murid Diss', email: 'murid.diss@skita.id', password: 'password123' }),
  });
  const mData = await mRes.json();
  muridToken = mData.token;
  muridUserId = mData.user.id;

  // Setup memberships
  db.schoolMemberships.set(`sm_m_diss`, {
    id: 'sm_m_diss',
    user_id: muridUserId,
    school_id: SCHOOL_ID,
    role: 'murid',
    status: 'aktif',
    joined_at: new Date().toISOString(),
  });
  db.schoolMemberships.set(`sm_g_diss`, {
    id: 'sm_g_diss',
    user_id: guruUserId,
    school_id: SCHOOL_ID,
    role: 'guru',
    status: 'aktif',
    joined_at: new Date().toISOString(),
  });

  db.classMemberships.set(`cm_m_diss`, {
    id: 'cm_m_diss',
    user_id: muridUserId,
    class_id: CLASS_1_ID,
    period_id: PERIOD_1_ID,
    role: 'murid',
    status: 'aktif',
    joined_at: new Date().toISOString(),
  });
  db.classMemberships.set(`cm_g_diss`, {
    id: 'cm_g_diss',
    user_id: guruUserId,
    class_id: CLASS_1_ID,
    period_id: PERIOD_1_ID,
    role: 'guru',
    status: 'aktif',
    joined_at: new Date().toISOString(),
  });

  const uM = db.users.get(muridUserId);
  if (uM) { uM.role = 'murid'; db.users.set(muridUserId, uM); }
  const uG = db.users.get(guruUserId);
  if (uG) { uG.role = 'guru'; db.users.set(guruUserId, uG); }
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

// FR-A11: Preview dialog memuat jumlah kelas, murid terdampak, kata BUBARKAN
test('GET /api/dissolution/preview/:id — memuat data pratinjau wajib', async () => {
  const res = await fetch(`${baseUrl}/api/dissolution/preview/${SCHOOL_ID}`, {
    headers: { Authorization: `Bearer ${sekolahToken}` },
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(json.total_classes, 2);
  assert.equal(json.total_students, 1);
  assert.equal(json.confirmation_keyword, 'BUBARKAN');
  assert.ok(json.warning_text.includes('BUBARKAN') || json.warning_text.includes('lulus'));
});

// FR-A11 Acceptance: Request dari Guru atau Murid ditolak 403 di server
test('POST /api/dissolution/schedule — murid ditolak 403', async () => {
  const res = await fetch(`${baseUrl}/api/dissolution/schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${muridToken}` },
    body: JSON.stringify({ school_id: SCHOOL_ID, confirmation_text: 'BUBARKAN' }),
  });
  assert.equal(res.status, 403);
});

test('POST /api/dissolution/schedule — guru ditolak 403', async () => {
  const res = await fetch(`${baseUrl}/api/dissolution/schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${guruToken}` },
    body: JSON.stringify({ school_id: SCHOOL_ID, confirmation_text: 'BUBARKAN' }),
  });
  assert.equal(res.status, 403);
});

// Konfirmasi salah ditolak
test('POST /api/dissolution/schedule — tanpa kata BUBARKAN ditolak 400', async () => {
  const res = await fetch(`${baseUrl}/api/dissolution/schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sekolahToken}` },
    body: JSON.stringify({ school_id: SCHOOL_ID, confirmation_text: 'bubar aja deh' }),
  });
  assert.equal(res.status, 400);
});

// FR-A11: Menjadwalkan pembubaran 24 jam ke depan
let activeScheduleId;
test('POST /api/dissolution/schedule — sekolah jadwalkan pembubaran', async () => {
  const res = await fetch(`${baseUrl}/api/dissolution/schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sekolahToken}` },
    body: JSON.stringify({ school_id: SCHOOL_ID, confirmation_text: 'BUBARKAN', duration_hours: 24 }),
  });
  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(json.schedule.status, 'terjadwal');
  assert.ok(json.schedule.will_execute_at);
  activeScheduleId = json.schedule.id;
});

// FR-A11: Banner muncul di kelas
test('GET /api/dissolution/banner/:class_id — banner tampil untuk murid', async () => {
  const res = await fetch(`${baseUrl}/api/dissolution/banner/${CLASS_1_ID}`, {
    headers: { Authorization: `Bearer ${muridToken}` },
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.has_banner, true);
  assert.ok(json.banner_text.includes('Kelas akan dibubarkan pada'));
});

// FR-A11: Selama masa tunggu, pendaftar baru tidak bisa masuk kelas (FR-A2 check)
test('POST /api/join/class — pendaftar baru diblokir selama masa pembubaran', async () => {
  // Buat kode kelas dulu
  const codeRes = await fetch(`${baseUrl}/api/codes/class`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ class_id: CLASS_2_ID }),
  });
  const { code } = await codeRes.json();

  // Akun murid baru yang sudah join sekolah
  const newM = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nama: 'Murid Telat', email: 'murid.telat@skita.id', password: 'password123' }),
  });
  const newMData = await newM.json();

  // Masukkan murid ini ke sekolah (aktif)
  db.schoolMemberships.set(`sm_telat_${Date.now()}`, {
    id: `sm_telat_${Date.now()}`,
    user_id: newMData.user.id,
    school_id: SCHOOL_ID,
    role: 'murid',
    status: 'aktif',
    joined_at: new Date().toISOString(),
  });
  const uTelat = db.users.get(newMData.user.id);
  if (uTelat) { uTelat.role = 'murid'; db.users.set(newMData.user.id, uTelat); }

  // Coba masuk kelas 8B yang sedang dalam masa tunggu
  const joinRes = await fetch(`${baseUrl}/api/join/class`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${newMData.token}` },
    body: JSON.stringify({ code: code.code }),
  });
  assert.equal(joinRes.status, 403);
  const joinJson = await joinRes.json();
  assert.ok(joinJson.message.includes('masa tunggu pembubaran'));
});

// FR-A11: Tombol Urungkan membatalkan jadwal
test('POST /api/dissolution/cancel/:id — sekolah urungkan pembubaran', async () => {
  const res = await fetch(`${baseUrl}/api/dissolution/cancel/${activeScheduleId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${sekolahToken}` },
  });
  assert.equal(res.status, 200);

  // Banner harus hilang untuk semua orang
  const bRes = await fetch(`${baseUrl}/api/dissolution/banner/${CLASS_1_ID}`, {
    headers: { Authorization: `Bearer ${muridToken}` },
  });
  const bJson = await bRes.json();
  assert.equal(bJson.has_banner, false);
});

// FR-A11: Jalankan Sekarang ("execute-now")
test('POST /api/dissolution/execute-now/:id — eksekusi langsung pembubaran', async () => {
  // Jadwalkan ulang dulu
  const sRes = await fetch(`${baseUrl}/api/dissolution/schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ school_id: SCHOOL_ID, confirmation_text: 'BUBARKAN' }),
  });
  const { schedule } = await sRes.json();

  const execRes = await fetch(`${baseUrl}/api/dissolution/execute-now/${schedule.id}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(execRes.status, 200);
  const execJson = await execRes.json();
  assert.equal(execJson.success, true);
  assert.equal(execJson.result.affected_classes, 2);
  assert.equal(execJson.result.affected_students, 1);
  assert.equal(execJson.result.affected_teachers, 1);

  // Verifikasi efek eksekusi di DB:
  // 1. Murid status 'lulus'
  const cmM = db.classMemberships.get('cm_m_diss');
  assert.equal(cmM.status, 'lulus');

  // 2. Guru status 'keluar' (tapi keanggotaan sekolah guru tetap 'aktif')
  const cmG = db.classMemberships.get('cm_g_diss');
  assert.equal(cmG.status, 'keluar');
  const smG = db.schoolMemberships.get('sm_g_diss');
  assert.equal(smG.status, 'aktif', 'Keanggotaan sekolah guru harus tetap aktif');

  // 3. Periode lama ditutup, periode baru dibuka
  const oldP1 = db.periods.get(PERIOD_1_ID);
  assert.equal(oldP1.is_active, false);
  const newP1 = [...db.periods.values()].find((p) => p.class_id === CLASS_1_ID && p.is_active);
  assert.ok(newP1, 'Periode baru untuk kelas 8A harus aktif');

  // 4. Setelah dieksekusi, tombol Urungkan sudah tidak tersedia (400)
  const cancelRes = await fetch(`${baseUrl}/api/dissolution/cancel/${schedule.id}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(cancelRes.status, 400);
});
