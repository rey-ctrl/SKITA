// server/test/members.test.mjs
// Regresi FR-A10 (Privasi Daftar Anggota) & FR-A9 (Keluar dan Mengeluarkan Anggota)

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
let guruInClassToken;
let guruOutsideToken;
let muridToken;

const SCHOOL_ID = 'sch_smpn_kick_test';
const CLASS_ID = 'cls_7a_test';
const PERIOD_ID = 'prd_2026_test';

let muridUserId;
let guruInClassUserId;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });

  // Setup data kelas & periode di memory
  db.classes.set(CLASS_ID, {
    id: CLASS_ID,
    school_id: SCHOOL_ID,
    nama: 'Kelas 7A',
    tingkat: 7,
    created_at: new Date().toISOString(),
  });
  db.periods.set(PERIOD_ID, {
    id: PERIOD_ID,
    class_id: CLASS_ID,
    start_date: '2026-07-01',
    is_active: true,
  });

  // Admin login
  const adminRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@skita.id', password: 'Admin@2026!' }),
  });
  adminToken = (await adminRes.json()).token;

  // Sekolah akun
  await fetch(`${baseUrl}/api/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ nama: 'Admin Sekolah Kick', email: 'sek.kick@skita.id', password: 'password123', role: 'sekolah' }),
  });
  const sekLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'sek.kick@skita.id', password: 'password123' }),
  });
  const sekData = await sekLogin.json();
  sekolahToken = sekData.token;
  db.schoolConfigs.set(SCHOOL_ID, {
    id: SCHOOL_ID,
    nama: 'SMPN Kick Test',
    owner_user_id: sekData.user.id,
    created_at: new Date().toISOString(),
  });

  // Guru 1 (join kelas)
  const g1Res = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nama: 'Pak Guru Budi', email: 'guru.budi@skita.id', password: 'password123' }),
  });
  const g1Data = await g1Res.json();
  guruInClassToken = g1Data.token;
  guruInClassUserId = g1Data.user.id;

  // Guru 2 (tidak join kelas)
  const g2Res = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nama: 'Bu Guru Siti', email: 'guru.siti@skita.id', password: 'password123' }),
  });
  guruOutsideToken = (await g2Res.json()).token;

  // Murid
  const mRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nama: 'Siswa Rahasia', email: 'siswa.secret@skita.id', password: 'password123' }),
  });
  const mData = await mRes.json();
  muridToken = mData.token;
  muridUserId = mData.user.id;

  // Setup membership sekolah & kelas secara eksplisit
  db.schoolMemberships.set(`sm_m_${Date.now()}`, {
    id: `sm_m_${Date.now()}`,
    user_id: muridUserId,
    school_id: SCHOOL_ID,
    role: 'murid',
    status: 'aktif',
    joined_at: new Date().toISOString(),
  });
  db.schoolMemberships.set(`sm_g1_${Date.now()}`, {
    id: `sm_g1_${Date.now()}`,
    user_id: guruInClassUserId,
    school_id: SCHOOL_ID,
    role: 'guru',
    status: 'aktif',
    joined_at: new Date().toISOString(),
  });

  // Update role di DB agar konsisten dengan membership
  // (token lama masih 'pengguna', tapi server selalu baca dari DB)
  const guruInUser = db.users.get(guruInClassUserId);
  if (guruInUser) { guruInUser.role = 'guru'; db.users.set(guruInClassUserId, guruInUser); }

  const muridUser = db.users.get(muridUserId);
  if (muridUser) { muridUser.role = 'murid'; db.users.set(muridUserId, muridUser); }

  // Class memberships
  db.classMemberships.set(`cm_m_${Date.now()}`, {
    id: `cm_m_${Date.now()}`,
    user_id: muridUserId,
    class_id: CLASS_ID,
    period_id: PERIOD_ID,
    role: 'murid',
    status: 'aktif',
    joined_at: new Date().toISOString(),
  });
  db.classMemberships.set(`cm_g1_${Date.now()}`, {
    id: `cm_g1_${Date.now()}`,
    user_id: guruInClassUserId,
    class_id: CLASS_ID,
    period_id: PERIOD_ID,
    role: 'guru',
    status: 'aktif',
    joined_at: new Date().toISOString(),
  });
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

// ==============================================================
// FR-A10 (P0) Acceptance Test: PRIVASI DAFTAR ANGGOTA
// "Daftar anggota untuk semua role HANYA menampilkan nama plus pembeda"
// Response API tidak boleh berisi email / password / role internal
// ==============================================================

test('GET /api/members/class/:id — response HANYA nama dan pembeda (Admin check)', async () => {
  const res = await fetch(`${baseUrl}/api/members/class/${CLASS_ID}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.ok(json.anggota.length >= 2);

  for (const item of json.anggota) {
    assert.ok(item.nama, 'Harus ada nama');
    assert.ok(item.user_id, 'Harus ada pembeda');
    // FR-A10 PRIVACY ASSERTION:
    assert.strictEqual(item.email, undefined, 'Email TIDAK BOLEH bocor di response');
    assert.strictEqual(item.telepon, undefined, 'Telepon TIDAK BOLEH bocor');
    assert.strictEqual(item.password_hash, undefined, 'Password TIDAK BOLEH bocor');
  }
});

test('GET /api/members/class/:id — murid di kelas bisa lihat nama teman sekelas tanpa email', async () => {
  const res = await fetch(`${baseUrl}/api/members/class/${CLASS_ID}`, {
    headers: { Authorization: `Bearer ${muridToken}` },
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.ok(json.anggota.every((a) => a.email === undefined));
});

test('GET /api/members/class/:id — guru di luar kelas ditolak 403', async () => {
  const res = await fetch(`${baseUrl}/api/members/class/${CLASS_ID}`, {
    headers: { Authorization: `Bearer ${guruOutsideToken}` },
  });
  assert.equal(res.status, 403);
});

// ==============================================================
// FR-A9 (P0) Acceptance Test: KICK ANGGOTA
// "guru tidak bisa mengeluarkan anggota kelas yang tidak ia join"
// ==============================================================

test('POST /api/members/class/:id/kick/:uid — guru luar kelas ditolak 403', async () => {
  const res = await fetch(`${baseUrl}/api/members/class/${CLASS_ID}/kick/${muridUserId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${guruOutsideToken}` },
  });
  assert.equal(res.status, 403, 'Guru di luar kelas harus ditolak 403 di server');
});

test('POST /api/members/class/:id/kick/:uid — guru dalam kelas berhasil kick murid', async () => {
  const res = await fetch(`${baseUrl}/api/members/class/${CLASS_ID}/kick/${muridUserId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${guruInClassToken}` },
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);

  // Verifikasi status keanggotaan kelas berubah jadi 'dikeluarkan' (data tidak terhapus)
  const membership = [...db.classMemberships.values()].find(
    (m) => m.class_id === CLASS_ID && m.user_id === muridUserId
  );
  assert.equal(membership.status, 'dikeluarkan');
});

// FR-A9: Murid keluar sendiri dari kelas
test('POST /api/members/class/:id/leave — anggota kelas bisa keluar sendiri', async () => {
  // Masukkan lagi murid sementara untuk tes leave
  const tempMembership = {
    id: `cm_temp_${Date.now()}`,
    user_id: muridUserId,
    class_id: CLASS_ID,
    period_id: PERIOD_ID,
    role: 'murid',
    status: 'aktif',
    joined_at: new Date().toISOString(),
  };
  db.classMemberships.set(tempMembership.id, tempMembership);

  const res = await fetch(`${baseUrl}/api/members/class/${CLASS_ID}/leave`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${muridToken}` },
  });
  assert.equal(res.status, 200);

  const updated = db.classMemberships.get(tempMembership.id);
  assert.equal(updated.status, 'keluar');
});

// FR-A9: Sekolah kick murid dari sekolah -> cascade kick dari semua kelas
test('POST /api/members/school/:id/kick/:uid — sekolah kick murid & cascade class kick', async () => {
  // Pastikan ada class membership aktif
  const cmId = `cm_casc_${Date.now()}`;
  db.classMemberships.set(cmId, {
    id: cmId,
    user_id: muridUserId,
    class_id: CLASS_ID,
    period_id: PERIOD_ID,
    role: 'murid',
    status: 'aktif',
    joined_at: new Date().toISOString(),
  });

  const res = await fetch(`${baseUrl}/api/members/school/${SCHOOL_ID}/kick/${muridUserId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${sekolahToken}` },
  });
  assert.equal(res.status, 200);

  // Class membership harus otomatis ikut jadi 'dikeluarkan'
  const cm = db.classMemberships.get(cmId);
  assert.equal(cm.status, 'dikeluarkan', 'Cascading kick ke class_memberships harus berjalan');

  // School membership jadi 'dikeluarkan'
  const sm = [...db.schoolMemberships.values()].find(
    (m) => m.school_id === SCHOOL_ID && m.user_id === muridUserId
  );
  assert.equal(sm.status, 'dikeluarkan');
});

test('POST /api/members/school/:id/leave — anggota dan admin bisa keluar dari sekolah', async () => {
  const smId = `sm_leave_${Date.now()}`;
  db.schoolMemberships.set(smId, {
    id: smId,
    user_id: muridUserId,
    school_id: SCHOOL_ID,
    role: 'murid',
    status: 'aktif',
    joined_at: new Date().toISOString(),
  });

  const res = await fetch(`${baseUrl}/api/members/school/${SCHOOL_ID}/leave`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${muridToken}` },
  });
  assert.equal(res.status, 200);
  const sm = db.schoolMemberships.get(smId);
  assert.equal(sm.status, 'keluar');
});

test('PATCH /api/auth/profile — update konfirmasi nama lengkap', async () => {
  const res = await fetch(`${baseUrl}/api/auth/profile`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${muridToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ nama: 'Murid Terverifikasi Baru' }),
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.user.nama, 'Murid Terverifikasi Baru');
});
