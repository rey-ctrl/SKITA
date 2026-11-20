// server/test/role_fondasi.test.mjs
// Regresi untuk FR-A15 (registrasi/login role), FR-A1 (admin manajemen), FR-A2 (bergabung kode)

import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.TEST_MODE = '1';

const { app } = await import('../dist/index.js');

let server;
let baseUrl;
let adminToken;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  // Login sebagai admin seed
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@skita.id', password: 'Admin@2026!' }),
  });
  const json = await res.json();
  adminToken = json.token;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

// FR-A15: registrasi publik tidak bisa set role
test('POST /api/auth/register — role field dari klien diabaikan, role jadi pengguna', async () => {
  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nama: 'Test Register', email: 'test.reg@skita.id', password: 'password123', role: 'admin' }),
  });
  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(json.user.role, 'pengguna'); // bukan 'admin' meski klien kirim 'admin'
});

// FR-A15: login seed admin ada
test('POST /api/auth/login — admin seed login berhasil', async () => {
  assert.ok(adminToken, 'adminToken harus ada');
});

// FR-A15: admin login bawa must_change_password
test('GET /api/auth/me — admin seed must_change_password true', async () => {
  const res = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.user.role, 'admin');
  assert.equal(json.user.must_change_password, true);
});

// FR-A1: non-admin tidak bisa akses /api/admin/users
test('GET /api/admin/users — ditolak tanpa token', async () => {
  const res = await fetch(`${baseUrl}/api/admin/users`);
  assert.equal(res.status, 401);
});

test('GET /api/admin/users — ditolak token pengguna biasa', async () => {
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'budi@skita.id', password: 'skita2026' }),
  });
  const { token } = await loginRes.json();
  const res = await fetch(`${baseUrl}/api/admin/users`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(res.status, 403);
});

// FR-A1: admin bisa lihat daftar user
test('GET /api/admin/users — admin bisa lihat daftar', async () => {
  const res = await fetch(`${baseUrl}/api/admin/users`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert(Array.isArray(json.users));
  // Email tidak boleh ada di endpoint lain, tapi di /admin/users memang boleh (FR-A1)
  assert.ok(json.users[0].email, 'email harus ada di response admin');
});

// FR-A1: admin buat akun sekolah
test('POST /api/admin/users — admin buat akun sekolah', async () => {
  const res = await fetch(`${baseUrl}/api/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ nama: 'SMPN 1 Test', email: 'sekolah1@skita.id', password: 'sekolah123', role: 'sekolah' }),
  });
  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.user.role, 'sekolah');
  assert.equal(json.user.must_change_password, true);
});

// FR-A1: admin tidak bisa buat akun murid/guru via POST /api/admin/users
test('POST /api/admin/users — role murid ditolak', async () => {
  const res = await fetch(`${baseUrl}/api/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ nama: 'Murid X', email: 'muridx@skita.id', password: 'murid1234', role: 'murid' }),
  });
  assert.equal(res.status, 400);
});

// FR-A1: admin tidak bisa ubah role dirinya sendiri
test('PATCH /api/admin/users/:id/role — admin tidak bisa ubah role sendiri', async () => {
  const meRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const { user } = await meRes.json();
  const res = await fetch(`${baseUrl}/api/admin/users/${user.id}/role`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ role: 'guru' }),
  });
  assert.equal(res.status, 400);
});

// DELETE /api/admin/users/:id — Hapus akun permanen
test('DELETE /api/admin/users/:id — admin tidak bisa hapus diri sendiri', async () => {
  const meRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const { user } = await meRes.json();

  const res = await fetch(`${baseUrl}/api/admin/users/${user.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 400);
});

test('DELETE /api/admin/users/:id — admin hapus akun user dan verifikasi hilang', async () => {
  // Buat user dummy
  const cRes = await fetch(`${baseUrl}/api/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ nama: 'User Dihapus', email: 'dihapus@skita.id', password: 'password123', role: 'sekolah' }),
  });
  const { user: created } = await cRes.json();

  // Hapus
  const delRes = await fetch(`${baseUrl}/api/admin/users/${created.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(delRes.status, 200);
  const delJson = await delRes.json();
  assert.equal(delJson.success, true);

  // Verifikasi sudah tidak ada di daftar
  const listRes = await fetch(`${baseUrl}/api/admin/users`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const listJson = await listRes.json();
  assert.equal(listJson.users.some((u) => u.id === created.id), false, 'User sudah tidak ada');
});

// FR-A2: bergabung kode sekolah — kode tidak valid
test('POST /api/join/school — kode tidak valid 404', async () => {
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'budi@skita.id', password: 'skita2026' }),
  });
  const { token } = await loginRes.json();

  const res = await fetch(`${baseUrl}/api/join/school`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ code: 'KODE_PALSU_XYZ' }),
  });
  assert.equal(res.status, 404);
  const json = await res.json();
  assert.equal(json.success, false);
});

// FR-A2: bergabung kelas tanpa token
test('POST /api/join/class — tanpa token 401', async () => {
  const res = await fetch(`${baseUrl}/api/join/class`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'ABC123' }),
  });
  assert.equal(res.status, 401);
});

// ==========================================
// FR-A4 (P0): Kode sekolah & kode kelas
// ==========================================

let studentCode;
let teacherCode;
let testSchoolId = 'sch_smpn1_test';

test('POST /api/codes/school — request pembuatan kode dari non-sekolah/non-admin ditolak 403', async () => {
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'budi@skita.id', password: 'skita2026' }),
  });
  const { token } = await loginRes.json();

  const res = await fetch(`${baseUrl}/api/codes/school`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ school_id: testSchoolId, scope: 'school_student' }),
  });
  assert.equal(res.status, 403, 'User biasa (pengguna/murid/guru) harus ditolak 403 di server');
});

test('POST /api/codes/school — admin buat kode sekolah untuk murid', async () => {
  const res = await fetch(`${baseUrl}/api/codes/school`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ school_id: testSchoolId, scope: 'school_student' }),
  });
  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.ok(json.code.code);
  assert.equal(json.code.scope, 'school_student');
  assert.equal(json.code.is_active, true);
  // FR-A7: Kode berlaku sampai Senin
  const validUntil = new Date(json.code.valid_until);
  assert(validUntil > new Date(), 'valid_until harus di masa depan');
  studentCode = json.code.code;
});

test('POST /api/codes/school — admin buat kode sekolah khusus guru', async () => {
  const res = await fetch(`${baseUrl}/api/codes/school`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ school_id: testSchoolId, scope: 'school_teacher' }),
  });
  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.code.scope, 'school_teacher');
  teacherCode = json.code.code;
});

// Flow hulu-ke-hilir: join pakai kode yang baru dibuat
test('POST /api/join/school — pengguna join sekolah pakai kode murid -> otomatis jadi murid', async () => {
  // Buat akun pendaftar baru
  const regRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nama: 'Siswa Baru', email: 'siswa.baru@skita.id', password: 'password123' }),
  });
  const { token } = await regRes.json();

  const joinRes = await fetch(`${baseUrl}/api/join/school`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ code: studentCode }),
  });
  assert.equal(joinRes.status, 201);
  const json = await joinRes.json();
  assert.equal(json.success, true);
  assert.equal(json.membership.role, 'murid');
  assert.equal(json.membership.status, 'aktif');

  // Cek user.role berubah jadi 'murid'
  const meRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const meJson = await meRes.json();
  assert.equal(meJson.user.role, 'murid');
});

// FR-A7: Rotasi manual kode yang bocor
test('POST /api/codes/rotate/:id — admin rotasi kode aktif', async () => {
  const listRes = await fetch(`${baseUrl}/api/codes/school/${testSchoolId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const { codes } = await listRes.json();
  const targetCode = codes[0];

  const rotRes = await fetch(`${baseUrl}/api/codes/rotate/${targetCode.id}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(rotRes.status, 201);
  const rotJson = await rotRes.json();
  assert.notEqual(rotJson.code.code, targetCode.code, 'Kode baru harus berbeda dari kode lama');
  assert.equal(rotJson.code.is_active, true);
});

