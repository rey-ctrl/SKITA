import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.TEST_MODE = '1';

const { app } = await import('../dist/index.js');

let server;
let baseUrl;

const json = (res) => res.json();
const post = (path, body, token) =>
  fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
const get = (path, token) =>
  fetch(`${baseUrl}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('GAP FIXES: canManageSchool isolation, my-history, delegasi reset-password', async (t) => {
  // Admin login
  const adminToken = (await (await post('/api/auth/login', { email: 'admin@skita.id', password: 'Admin@2026!' })).json()).token;

  // Buat 2 akun sekolah via admin
  await post('/api/admin/users', { nama: 'Kepsek Gap1', email: 'kepsek.gap1@skita.id', role: 'sekolah', password: 'pass1234' }, adminToken);
  await post('/api/admin/users', { nama: 'Kepsek Gap2', email: 'kepsek.gap2@skita.id', role: 'sekolah', password: 'pass1234' }, adminToken);

  const s1Token = (await (await post('/api/auth/login', { email: 'kepsek.gap1@skita.id', password: 'pass1234' })).json()).token;
  const s2Token = (await (await post('/api/auth/login', { email: 'kepsek.gap2@skita.id', password: 'pass1234' })).json()).token;

  // Cari & import 2 sekolah via search-on-the-fly
  const sRes = await (await post('/api/schools/search-on-the-fly', { query: 'SMP' })).json();
  const p1 = sRes.results[0];
  const p2 = sRes.results[1];

  const imp1 = await (await post('/api/schools/search-on-the-fly', { import_place_id: p1.place_id, jenjang_override: 'SMP' })).json();
  const imp2 = await (await post('/api/schools/search-on-the-fly', { import_place_id: p2.place_id, jenjang_override: 'SMP' })).json();
  const school1 = imp1.data;
  const school2 = imp2.data;

  // Claim masing-masing
  await post('/api/school-dashboard/claim', { school_id: school1.id }, s1Token);
  await post('/api/school-dashboard/claim', { school_id: school2.id }, s2Token);

  await t.test('Sekolah 1 ditolak kelola kode Sekolah 2 (canManageSchool isolation)', async () => {
    const res = await post('/api/codes/school', { school_id: school2.id, scope: 'school_student' }, s1Token);
    assert.equal(res.status, 403);
  });

  await t.test('Sekolah 1 berhasil kelola kodenya sendiri', async () => {
    const res = await post('/api/codes/school', { school_id: school1.id, scope: 'school_student' }, s1Token);
    assert.equal(res.status, 201);
    assert.ok((await res.json()).code);
  });

  // Daftarkan murid & join sekolah 1
  const codeRes = await (await post('/api/codes/school', { school_id: school1.id, scope: 'school_student' }, s1Token)).json();
  const muridKode = codeRes.code.code;
  const muridReg = await (await post('/api/auth/register', { nama: 'Murid Gap Test', email: 'murid.gap.test@skita.id', password: 'pass1234' })).json();
  const muridToken = muridReg.token;
  const muridId = muridReg.user.id;
  await post('/api/join/school', { code: muridKode }, muridToken);

  await t.test('Sekolah 2 ditolak reset password murid Sekolah 1', async () => {
    const res = await post('/api/school-dashboard/reset-password', { target_user_id: muridId }, s2Token);
    assert.equal(res.status, 403);
  });

  await t.test('Sekolah 1 berhasil delegasi reset password muridnya', async () => {
    const res = await post('/api/school-dashboard/reset-password', { target_user_id: muridId }, s1Token);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.temp_password, 'harus ada temp_password');

    const loginRes = await post('/api/auth/login', { email: 'murid.gap.test@skita.id', password: data.temp_password });
    assert.equal(loginRes.status, 200);
    const loginData = await loginRes.json();
    assert.equal(loginData.user.must_change_password, true);
  });

  await t.test('Murid dapat lihat riwayat absensi diri sendiri', async () => {
    const res = await get('/api/attendance/my-history', muridToken);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.records));
    // Pastikan response tidak ada field 'catatan'
    if (data.records.length > 0) {
      assert.equal(data.records[0].catatan, undefined, 'catatan tidak boleh ada di response murid');
    }
  });

  await t.test('Admin ditolak endpoint my-history (hanya murid)', async () => {
    const res = await get('/api/attendance/my-history', adminToken);
    assert.equal(res.status, 403);
  });

  await t.test('search-on-the-fly menyimpan nama_override persisten ke database', async () => {
    const sRes = await (await post('/api/schools/search-on-the-fly', { query: 'SMA' })).json();
    const target = sRes.results[0];
    const customName = 'SMA Negeri 99 Kota Impian';

    const imp = await (await post('/api/schools/search-on-the-fly', {
      import_place_id: target.place_id,
      jenjang_override: 'SMA',
      status_override: 'Negeri',
      nama_override: customName,
    })).json();

    assert.equal(imp.success, true);
    assert.equal(imp.data.nama, customName, 'Response harus mengembalikan nama_override');

    // Cek GET /api/schools/:id — nama harus tetap customName (persisten)
    const detail = await (await get(`/api/schools/${imp.data.id}`)).json();
    assert.equal(detail.data.nama, customName, 'Nama di database harus tetap customName');
  });

  await t.test('Join sekolah dan claim menerima kode sekolah generated dari Beranda (school.id)', async () => {
    // Cari sekolah dari database
    const allSchools = await (await get('/api/schools')).json();
    const targetSchool = allSchools.data[0];
    assert.ok(targetSchool, 'harus ada minimal satu sekolah di db');

    // Register user baru
    const regRes = await (await post('/api/auth/register', {
      nama: 'Murid Home Code',
      email: `murid.homecode.${Date.now()}@skita.id`,
      password: 'password123',
    })).json();

    // Masuk sekolah via ID sekolah langsung (seperti yang dicopy dari home)
    const joinRes = await post('/api/join/school', { code: targetSchool.id }, regRes.token);
    assert.equal(joinRes.status, 201, 'Harus sukses join sekolah pakai kode/ID sekolah dari home');
    const joinData = await joinRes.json();
    assert.equal(joinData.membership.school_id, targetSchool.id);
    assert.equal(joinData.membership.role, 'murid');
  });
});
