import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.TEST_MODE = '1';

const { app } = await import('../dist/index.js');

let server;
let baseUrl;
let adminToken;
let sekolahToken;
let muridToken;
let testSchoolId;
let studentSchoolCode;
let testClassId;
let classCode;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  // Login admin
  const aRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@skita.id', password: 'Admin@2026!' }),
  });
  const aJson = await aRes.json();
  adminToken = aJson.token;

  // Buat sekolah di DB via search-on-the-fly
  const searchRes = await fetch(`${baseUrl}/api/schools/search-on-the-fly`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'SMA' }),
  });
  const searchJson = await searchRes.json();
  const targetPlace = searchJson.results[0];

  const importRes = await fetch(`${baseUrl}/api/schools/search-on-the-fly`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ import_place_id: targetPlace.place_id, jenjang_override: 'SMA' }),
  });
  const importJson = await importRes.json();
  testSchoolId = importJson.data.id;

  // Buat akun sekolah via admin
  const uRes = await fetch(`${baseUrl}/api/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ nama: 'SMA 8 Official', email: 'sma8official@skita.id', password: 'password123', role: 'sekolah' }),
  });
  const uJson = await uRes.json();

  // Login akun sekolah
  const lRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'sma8official@skita.id', password: 'password123' }),
  });
  const lJson = await lRes.json();
  sekolahToken = lJson.token;

  // Register & login murid biasa
  const mRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nama: 'Murid Flow Test', email: 'muridflow@skita.id', password: 'password123' }),
  });
  const mJson = await mRes.json();
  muridToken = mJson.token;
});

test('POST /api/school-dashboard/claim — akun sekolah klaim sekolahnya', async () => {
  const res = await fetch(`${baseUrl}/api/school-dashboard/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sekolahToken}` },
    body: JSON.stringify({ school_id: testSchoolId }),
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
});

test('GET /api/school-dashboard/me — akun sekolah melihat dashboard sendiri', async () => {
  const res = await fetch(`${baseUrl}/api/school-dashboard/me`, {
    headers: { Authorization: `Bearer ${sekolahToken}` },
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(json.school.id, testSchoolId);
});

test('POST /api/codes/school — akun sekolah generate kode murid', async () => {
  const res = await fetch(`${baseUrl}/api/codes/school`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sekolahToken}` },
    body: JSON.stringify({ school_id: testSchoolId, scope: 'school_student' }),
  });
  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.success, true);
  studentSchoolCode = json.code.code;
  assert.ok(studentSchoolCode);
});

test('POST /api/school-dashboard/classes — akun sekolah buat kelas baru', async () => {
  const res = await fetch(`${baseUrl}/api/school-dashboard/classes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sekolahToken}` },
    body: JSON.stringify({ nama: 'X-MIPA-1', tingkat: '10' }),
  });
  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.success, true);
  testClassId = json.class.id;
  classCode = json.class.kode_kelas.code;
  assert.ok(classCode);
});

test('POST /api/school-dashboard/classes — pengguna biasa ditolak 403', async () => {
  const res = await fetch(`${baseUrl}/api/school-dashboard/classes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${muridToken}` },
    body: JSON.stringify({ nama: 'X-MIPA-2', tingkat: '10' }),
  });
  assert.equal(res.status, 403);
});

test('FR-A2 Flow 2 Tahap: Murid coba join kelas SEBELUM join sekolah — ditolak 403', async () => {
  const res = await fetch(`${baseUrl}/api/join/class`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${muridToken}` },
    body: JSON.stringify({ code: classCode }),
  });
  assert.equal(res.status, 403, 'Harus ditolak karena belum jadi anggota sekolah');
});

test('FR-A2 Flow 2 Tahap: Murid join sekolah pakai kode sekolah — Tahap 1 sukses', async () => {
  const res = await fetch(`${baseUrl}/api/join/school`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${muridToken}` },
    body: JSON.stringify({ code: studentSchoolCode }),
  });
  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.membership.status, 'aktif');
});

test('FR-A2 Flow 2 Tahap: Murid join kelas pakai kode kelas — Tahap 2 sukses', async () => {
  const res = await fetch(`${baseUrl}/api/join/class`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${muridToken}` },
    body: JSON.stringify({ code: classCode }),
  });
  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.membership.status, 'aktif');
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});
