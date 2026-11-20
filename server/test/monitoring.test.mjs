// server/test/monitoring.test.mjs
// Regresi FR-A5 (Monitoring & Daftar Anggota) & FR-A6 (Guru Berpindah Kelas)

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

const SCH_A = 'sch_mon_a';
const SCH_B = 'sch_mon_b';
const CLS_A1 = 'cls_mon_a1';
const CLS_A2 = 'cls_mon_a2';
const CLS_B1 = 'cls_mon_b1';

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });

  // Setup sekolah & kelas
  db.schools.set(SCH_A, {
    id: SCH_A, place_id: 'pl_mon_a', nama: 'SMP Negeri 1 Mon', jenjang: 'SMP', status: 'Negeri',
    alamat: 'Jl A', lat: -6.5, lng: 106.8, foto_url: '', kecamatan: 'Bogor', kelurahan: 'Sempur', kota_kab: 'Kota Bogor', provinsi: 'Jawa Barat'
  });
  db.schools.set(SCH_B, {
    id: SCH_B, place_id: 'pl_mon_b', nama: 'SMA Swasta 2 Mon', jenjang: 'SMA', status: 'Swasta',
    alamat: 'Jl B', lat: -6.6, lng: 106.8, foto_url: '', kecamatan: 'Bogor', kelurahan: 'Sempur', kota_kab: 'Kota Bogor', provinsi: 'Jawa Barat'
  });

  db.classes.set(CLS_A1, { id: CLS_A1, school_id: SCH_A, nama: 'Kelas 7A', tingkat: 7, created_at: new Date().toISOString() });
  db.classes.set(CLS_A2, { id: CLS_A2, school_id: SCH_A, nama: 'Kelas 7B', tingkat: 7, created_at: new Date().toISOString() });
  db.classes.set(CLS_B1, { id: CLS_B1, school_id: SCH_B, nama: 'Kelas 10 IPA', tingkat: 10, created_at: new Date().toISOString() });

  // Login admin
  const aRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@skita.id', password: 'Admin@2026!' }),
  });
  adminToken = (await aRes.json()).token;

  // Register Guru & Murid
  const gRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nama: 'Guru Multisekolah', email: 'guru.multi@skita.id', password: 'password123' }),
  });
  const gData = await gRes.json();
  guruToken = gData.token;
  guruUserId = gData.user.id;

  const mRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nama: 'Murid Mon', email: 'murid.mon@skita.id', password: 'password123' }),
  });
  const mData = await mRes.json();
  muridToken = mData.token;
  muridUserId = mData.user.id;

  // Set role di DB
  const uG = db.users.get(guruUserId);
  if (uG) { uG.role = 'guru'; db.users.set(guruUserId, uG); }
  const uM = db.users.get(muridUserId);
  if (uM) { uM.role = 'murid'; db.users.set(muridUserId, uM); }

  // Guru anggota Sekolah A dan B
  db.schoolMemberships.set('sm_g_a', { id: 'sm_g_a', user_id: guruUserId, school_id: SCH_A, role: 'guru', status: 'aktif', joined_at: new Date().toISOString() });
  db.schoolMemberships.set('sm_g_b', { id: 'sm_g_b', user_id: guruUserId, school_id: SCH_B, role: 'guru', status: 'aktif', joined_at: new Date().toISOString() });

  // Guru HANYA join Kelas 7A (di Sekolah A) dan 10 IPA (di Sekolah B)
  // Kelas 7B (CLS_A2) BELUM dimasuki kodenya
  db.classMemberships.set('cm_g_a1', { id: 'cm_g_a1', user_id: guruUserId, class_id: CLS_A1, period_id: 'prd_dummy', role: 'guru', status: 'aktif', joined_at: new Date().toISOString() });
  db.classMemberships.set('cm_g_b1', { id: 'cm_g_b1', user_id: guruUserId, class_id: CLS_B1, period_id: 'prd_dummy', role: 'guru', status: 'aktif', joined_at: new Date().toISOString() });

  // Murid: join Sekolah A tetapi BELUM masuk kelas mana pun (unassigned)
  db.schoolMemberships.set('sm_m_a', { id: 'sm_m_a', user_id: muridUserId, school_id: SCH_A, role: 'murid', status: 'aktif', joined_at: new Date().toISOString() });
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

// FR-A5: Admin melihat semua sekolah dan kelas
test('GET /api/monitoring/scope — admin melihat semua cakupan', async () => {
  const res = await fetch(`${baseUrl}/api/monitoring/scope`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.role, 'admin');
  assert.ok(json.scope.schools.length >= 2);
  assert.ok(json.scope.classes.length >= 3);
});

// FR-A6 Acceptance: Guru berpindah kelas
// "kelas yang belum pernah dimasukkan kodenya tidak muncul. Data sekolah A tidak terlihat saat berada di sekolah B"
test('GET /api/monitoring/scope — guru hanya melihat kelas yang di-join (CLS_A2 tidak muncul)', async () => {
  const res = await fetch(`${baseUrl}/api/monitoring/scope`, {
    headers: { Authorization: `Bearer ${guruToken}` },
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.role, 'guru');

  // Kelas yang belum dimasukkan kodenya (CLS_A2) TIDAK boleh muncul
  const classIds = json.scope.classes.map((c) => c.id);
  assert.ok(classIds.includes(CLS_A1), 'Kelas 7A harus ada');
  assert.ok(classIds.includes(CLS_B1), 'Kelas 10 IPA harus ada');
  assert.equal(classIds.includes(CLS_A2), false, 'Kelas 7B yang belum di-join TIDAK boleh muncul');

  // Pengelompokan per sekolah harus ada
  assert.ok(json.scope.classes_by_school[SCH_A]);
  assert.ok(json.scope.classes_by_school[SCH_B]);
  assert.equal(json.scope.classes_by_school[SCH_A].length, 1);
  assert.equal(json.scope.classes_by_school[SCH_B].length, 1);
});

// FR-A5: Murid melihat kelas miliknya sendiri
test('GET /api/monitoring/scope — murid belum punya kelas dapat scope null', async () => {
  const res = await fetch(`${baseUrl}/api/monitoring/scope`, {
    headers: { Authorization: `Bearer ${muridToken}` },
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.role, 'murid');
  assert.equal(json.scope.class, null);
});

// FR-A5: Murid yang sudah join sekolah tetapi belum masuk kelas muncul di daftar sekolah unassigned
test('GET /api/monitoring/school/:id/unassigned-students — murid unassigned muncul di sekolah', async () => {
  const res = await fetch(`${baseUrl}/api/monitoring/school/${SCH_A}/unassigned-students`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.ok(json.students.some((s) => s.user_id === muridUserId));
});
