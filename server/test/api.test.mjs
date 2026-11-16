import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.TEST_MODE = '1';

const { app } = await import('../dist/index.js');

let server;
let baseUrl;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('GET /health returns 200 and ok status', async () => {
  const res = await fetch(`${baseUrl}/health`);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.status, 'ok');
  assert.equal(json.service, 'SKITA API Backend');
});

test('GET /api/regions/cities returns Bogor for Jawa Barat', async () => {
  const res = await fetch(`${baseUrl}/api/regions/cities?province=Jawa%20Barat`);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert(json.cities.includes('Kota Bogor'));
  assert(json.cities.includes('Kabupaten Bogor'));
});

test('GET /api/schools returns 200 with empty or initial list', async () => {
  const res = await fetch(`${baseUrl}/api/schools?lat=-6.5912&lng=106.7995`);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert(Array.isArray(json.data));
});

let importedSchoolId = '';

test('POST /api/schools/search-on-the-fly searches and imports place with caching', async () => {
  // 1. Search external places
  const searchRes = await fetch(`${baseUrl}/api/schools/search-on-the-fly`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'SMPN 4' }),
  });
  assert.equal(searchRes.status, 200);
  const searchJson = await searchRes.json();
  assert(searchJson.results.length > 0);
  const targetPlace = searchJson.results[0];

  // 2. Import into SKITA database
  const importRes = await fetch(`${baseUrl}/api/schools/search-on-the-fly`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      import_place_id: targetPlace.place_id,
      jenjang_override: 'SMP',
    }),
  });
  assert.equal(importRes.status, 201);
  const importJson = await importRes.json();
  assert.equal(importJson.success, true);
  assert.equal(importJson.data.place_id, targetPlace.place_id);
  assert(importJson.data.foto_url.includes('webp'));
  importedSchoolId = importJson.data.id;

  // 3. Deduplication check: re-importing must return 409 conflict
  const duplicateRes = await fetch(`${baseUrl}/api/schools/search-on-the-fly`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      import_place_id: targetPlace.place_id,
    }),
  });
  assert.equal(duplicateRes.status, 409);
});

test('GET /api/schools filters by jenjang and calculates Haversine distance', async () => {
  const res = await fetch(`${baseUrl}/api/schools?jenjang=SMP&lat=-6.5912&lng=106.7995`);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert(json.total > 0);
  // Ensure every item is SMP and has zonasi evaluation
  for (const item of json.data) {
    assert.equal(item.jenjang, 'SMP');
    assert(item.evaluation);
    assert(typeof item.evaluation.jarak_m === 'number');
  }
});

test('GET /api/schools/:id/zonasi evaluates accurately', async () => {
  const res = await fetch(`${baseUrl}/api/schools/${importedSchoolId}/zonasi?lat=-6.5912&lng=106.7995`);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert(json.evaluation);
  assert(typeof json.evaluation.jarak_m === 'number');
});

test('POST /api/auth/register and /api/auth/login validates credentials and returns JWT', async () => {
  const testEmail = `parent_${Date.now()}@example.com`;

  // 1. Register
  const regRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nama: 'Ibu Rahmawati',
      email: testEmail,
      password: 'securepassword123',
      provinsi: 'Jawa Barat',
      kota_kab: 'Kota Bogor',
    }),
  });
  assert.equal(regRes.status, 201);
  const regJson = await regRes.json();
  assert.equal(regJson.success, true);
  assert(regJson.token);

  // 2. Login
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: 'securepassword123',
    }),
  });
  assert.equal(loginRes.status, 200);
  const loginJson = await loginRes.json();
  assert(loginJson.token);

  // 3. Authenticated endpoint /api/auth/me
  const meRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${loginJson.token}` },
  });
  assert.equal(meRes.status, 200);
  const meJson = await meRes.json();
  assert.equal(meJson.user.nama, 'Ibu Rahmawati');
});

test('GET /api/route returns distance and duration with graceful fallback', async () => {
  // Test rute antara 2 titik di Bogor: Istana Bogor ke SMPN 1 Bogor
  const originLat = -6.5971;
  const originLng = 106.7995;
  const destLat = -6.5945;
  const destLng = 106.7925;

  const res = await fetch(
    `${baseUrl}/api/route?originLat=${originLat}&originLng=${originLng}&destLat=${destLat}&destLng=${destLng}`
  );
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert(json.data);
  assert(typeof json.data.jarak_m === 'number' && json.data.jarak_m > 0);
  assert(typeof json.data.durasi_motor_menit === 'number');
  assert(typeof json.data.durasi_jalan_menit === 'number');
  assert(['osrm', 'estimasi'].includes(json.data.sumber));
});

