// server/test/subjects.test.mjs
// Regresi FR-A3: Mata pelajaran berbasis checklist

import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.TEST_MODE = '1';

const { app } = await import('../dist/index.js');

let server;
let baseUrl;
let adminToken;
let sekolahToken;
let guruToken;
let muridToken;
const SCHOOL_ID = 'sch_smpn1_test';

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  // Login admin seed
  const adminRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@skita.id', password: 'Admin@2026!' }),
  });
  adminToken = (await adminRes.json()).token;

  // Admin buat akun sekolah
  await fetch(`${baseUrl}/api/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ nama: 'SMPN 1 Test', email: 'sekolah.fr3@skita.id', password: 'sekolah123', role: 'sekolah' }),
  });
  const sekolahLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'sekolah.fr3@skita.id', password: 'sekolah123' }),
  });
  sekolahToken = (await sekolahLogin.json()).token;

  // Daftar guru & murid
  const guruReg = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nama: 'Pak Guru FR3', email: 'guru.fr3@skita.id', password: 'password123' }),
  });
  guruToken = (await guruReg.json()).token;

  const muridReg = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nama: 'Murid FR3', email: 'murid.fr3@skita.id', password: 'password123' }),
  });
  muridToken = (await muridReg.json()).token;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

// GET /api/subjects/templates: semua jenjang
test('GET /api/subjects/templates — tanpa filter kembalikan semua template', async () => {
  const res = await fetch(`${baseUrl}/api/subjects/templates`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.ok(Array.isArray(json.templates));
  assert.ok(json.templates.length > 0);
  // Harus ada SMP, SMA, SMK
  const jenjangSet = new Set(json.templates.map((t) => t.jenjang));
  assert.ok(jenjangSet.has('SMP'));
  assert.ok(jenjangSet.has('SMA'));
  assert.ok(jenjangSet.has('SMK'));
});

// GET /api/subjects/templates: filter jenjang + status
test('GET /api/subjects/templates?jenjang=SMP&status=Negeri — filter benar', async () => {
  const res = await fetch(`${baseUrl}/api/subjects/templates?jenjang=SMP&status=Negeri`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const { templates } = await res.json();
  assert.ok(templates.length > 0);
  assert.ok(templates.every((t) => t.jenjang === 'SMP' && t.status === 'Negeri'));
  // FR-A3 acceptance: ganti jenjang memuat template yang sesuai
  const names = templates.map((t) => t.nama);
  assert.ok(names.includes('Matematika'));
  assert.ok(names.includes('Bahasa Indonesia'));
});

// POST /api/subjects/school/:id/generate — generate semua mapel dari template
test('POST /api/subjects/school/:id/generate — sekolah generate mapel SMP Negeri', async () => {
  const res = await fetch(`${baseUrl}/api/subjects/school/${SCHOOL_ID}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sekolahToken}` },
    body: JSON.stringify({ jenjang: 'SMP', status: 'Negeri' }),
  });
  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.ok(json.created > 0);
  assert.ok(Array.isArray(json.subjects));
  assert.ok(json.subjects.length >= json.created);
  // Semua mapel is_active true (otomatis tercentang)
  assert.ok(json.subjects.every((s) => s.is_active === true));
});

// POST generate idempoten — ulang tidak duplikat
test('POST /api/subjects/school/:id/generate — idempoten, mapel tidak duplikat', async () => {
  const res1 = await fetch(`${baseUrl}/api/subjects/school/${SCHOOL_ID}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ jenjang: 'SMP', status: 'Negeri' }),
  });
  const j1 = await res1.json();
  assert.equal(j1.created, 0, 'Generate ulang tidak boleh tambah mapel baru');
});

// Murid tidak bisa generate
test('POST /api/subjects/school/:id/generate — murid ditolak 403', async () => {
  const res = await fetch(`${baseUrl}/api/subjects/school/${SCHOOL_ID}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${muridToken}` },
    body: JSON.stringify({ jenjang: 'SMP', status: 'Negeri' }),
  });
  assert.equal(res.status, 403);
});

// FR-A3: Sekolah lepas centang mapel template
test('PATCH /api/subjects/:id/toggle — sekolah bisa lepas centang mapel', async () => {
  // Ambil daftar mapel dulu
  const listRes = await fetch(`${baseUrl}/api/subjects/school/${SCHOOL_ID}`, {
    headers: { Authorization: `Bearer ${sekolahToken}` },
  });
  const { subjects } = await listRes.json();
  const target = subjects[0];

  const toggleRes = await fetch(`${baseUrl}/api/subjects/${target.id}/toggle`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${sekolahToken}` },
  });
  assert.equal(toggleRes.status, 200);
  const { subject } = await toggleRes.json();
  assert.equal(subject.is_active, !target.is_active);

  // Toggle balik
  await fetch(`${baseUrl}/api/subjects/${target.id}/toggle`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${sekolahToken}` },
  });
});

// FR-A3: Sekolah tambah mapel manual
test('POST /api/subjects/school/:id/custom — sekolah tambah mapel manual', async () => {
  const res = await fetch(`${baseUrl}/api/subjects/school/${SCHOOL_ID}/custom`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sekolahToken}` },
    body: JSON.stringify({ nama: 'Bahasa Daerah Sunda' }),
  });
  assert.equal(res.status, 201);
  const { subject } = await res.json();
  assert.equal(subject.is_custom, true);
  assert.equal(subject.nama, 'Bahasa Daerah Sunda');
  assert.equal(subject.school_id, SCHOOL_ID);
});

// Mapel manual tidak duplikat
test('POST /api/subjects/school/:id/custom — nama duplikat ditolak 409', async () => {
  const res = await fetch(`${baseUrl}/api/subjects/school/${SCHOOL_ID}/custom`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sekolahToken}` },
    body: JSON.stringify({ nama: 'Bahasa Daerah Sunda' }),
  });
  assert.equal(res.status, 409);
});

// FR-A3: Guru pilih mapel yang dia ajar — harus anggota aktif sekolah dulu
test('POST /api/subjects/school/:id/teacher — guru belum anggota sekolah ditolak', async () => {
  // Ambil semua mapel sekolah dulu
  const listRes = await fetch(`${baseUrl}/api/subjects/school/${SCHOOL_ID}`, {
    headers: { Authorization: `Bearer ${sekolahToken}` },
  });
  const { subjects } = await listRes.json();
  const subjectIds = subjects.slice(0, 2).map((s) => s.id);

  const res = await fetch(`${baseUrl}/api/subjects/school/${SCHOOL_ID}/teacher`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${guruToken}` },
    body: JSON.stringify({ subject_ids: subjectIds }),
  });
  // Guru belum aktif di sekolah → 403
  assert.equal(res.status, 403);
});

// Admin set pilihan mapel untuk guru
test('POST /api/subjects/school/:id/teacher — admin set mapel untuk guru', async () => {
  // Dapatkan user_id guru
  const meRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${guruToken}` },
  });
  const guruId = (await meRes.json()).user.id;

  const listRes = await fetch(`${baseUrl}/api/subjects/school/${SCHOOL_ID}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const { subjects } = await listRes.json();
  const subjectIds = subjects.slice(0, 3).map((s) => s.id);

  const res = await fetch(`${baseUrl}/api/subjects/school/${SCHOOL_ID}/teacher`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ user_id: guruId, subject_ids: subjectIds }),
  });
  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.teacher_subjects.length, 3);
  assert.ok(json.teacher_subjects.every((ts) => ts.school_id === SCHOOL_ID));
});

// Admin lihat pilihan mapel guru
test('GET /api/subjects/school/:id/teacher/:uid — admin lihat pilihan mapel guru', async () => {
  const meRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${guruToken}` },
  });
  const guruId = (await meRes.json()).user.id;

  const res = await fetch(`${baseUrl}/api/subjects/school/${SCHOOL_ID}/teacher/${guruId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.ok(Array.isArray(json.teacher_subjects));
  assert.ok(json.teacher_subjects.every((ts) => ts.subject !== null));
});

// Murid tidak bisa lihat daftar mapel sekolah
test('GET /api/subjects/school/:id — murid ditolak 403', async () => {
  const res = await fetch(`${baseUrl}/api/subjects/school/${SCHOOL_ID}`, {
    headers: { Authorization: `Bearer ${muridToken}` },
  });
  assert.equal(res.status, 403);
});
