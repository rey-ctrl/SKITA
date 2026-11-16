import test from 'node:test';
import assert from 'node:assert/strict';

// Haversine formula (km)
function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Zonasi Evaluator Logic per PRD 5.9 & 19
function evaluateZonasi({ school, zone, userLat, userLng, userKecamatan }) {
  if (!zone) {
    return {
      status: 'BELUM_TERSEDIA',
      jarak_m: Math.round(haversineDistanceKm(userLat, userLng, school.lat, school.lng) * 1000),
      alasan: 'Data zonasi resmi untuk sekolah ini belum tersedia.',
      disclaimer: 'Hasil bersifat estimasi, keputusan resmi mengikuti ketentuan dinas pendidikan/sekolah.',
    };
  }

  const distKm = haversineDistanceKm(userLat, userLng, school.lat, school.lng);
  const distM = Math.round(distKm * 1000);

  let isWithinZone = false;
  let alasan = '';

  // 1. Tipe Radius
  if (zone.tipe === 'radius') {
    isWithinZone = distM <= zone.radius_m;
    alasan = isWithinZone
      ? `Jarak rumah ${(distM / 1000).toFixed(2)} km berada di dalam radius zona ${(zone.radius_m / 1000).toFixed(1)} km.`
      : `Jarak rumah ${(distM / 1000).toFixed(2)} km melebihi batas radius zona ${(zone.radius_m / 1000).toFixed(1)} km.`;
  } else if (zone.tipe === 'wilayah') {
    // 2. Tipe Wilayah
    isWithinZone = zone.wilayah && userKecamatan ? zone.wilayah.includes(userKecamatan) : false;
    alasan = isWithinZone
      ? `Kecamatan ${userKecamatan} termasuk dalam wilayah zonasi sekolah.`
      : `Kecamatan ${userKecamatan} berada di luar wilayah zonasi sekolah.`;
  } else if (zone.tipe === 'gabungan') {
    const radiusOk = distM <= zone.radius_m;
    const wilayahOk = zone.wilayah && userKecamatan ? zone.wilayah.includes(userKecamatan) : false;
    isWithinZone = radiusOk || wilayahOk;
    alasan = isWithinZone
      ? `Masuk zona melalui jalur ${radiusOk ? 'radius terdekat' : 'wilayah domisili'}.`
      : 'Di luar radius dan tidak tercakup dalam daftar wilayah administratif.';
  }

  // Kluster jarak (PRD 17 & 19: 0-150m, 150-500m, 500-1000m, >1000m)
  let kluster = 'Kluster > 1.000 m';
  if (distM <= 150) kluster = 'Kluster 0 - 150 m (Prioritas 1)';
  else if (distM <= 500) kluster = 'Kluster 150 - 500 m (Prioritas 2)';
  else if (distM <= 1000) kluster = 'Kluster 500 - 1.000 m (Prioritas 3)';

  // Estimasi peluang (PRD 19)
  let peluang = null;
  if (zone.jarak_terjauh_diterima_m && zone.jarak_terjauh_diterima_m > 0) {
    const cutoff = zone.jarak_terjauh_diterima_m;
    const ratio = distM / cutoff;
    if (ratio <= 0.6) {
      peluang = { label: 'Tinggi', range: '70% - 90%', percentEst: 85 };
    } else if (ratio <= 1.0) {
      peluang = { label: 'Sedang', range: '40% - 70%', percentEst: 55 };
    } else {
      peluang = { label: 'Rendah', range: '< 40%', percentEst: 20 };
    }
  }

  return {
    status: isWithinZone ? 'MASUK_ZONA' : 'LUAR_ZONA',
    jarak_m: distM,
    kluster_nama: kluster,
    peluang,
    alasan,
    disclaimer: 'Hasil bersifat estimasi, keputusan resmi mengikuti ketentuan dinas pendidikan/sekolah.',
  };
}

const SCHOOL_TYPE_TOKENS = new Set([
  'state', 'islamic', 'vocational', 'senior', 'junior', 'high', 'school', 'highschool',
]);
const STOP_WORDS = new Set(['of', 'the', 'and', 'atau']);
const ID_PREFIX_RE = /^(sman|smpn|smkn|man|mtsn|sma|smk|smp|mts|ma)(\s+(negeri|swasta|n\b))?\s*/i;

function buildSchoolName(rawName, jenjang, status) {
  let working = rawName.trim().replace(ID_PREFIX_RE, '').trim();
  const tokens = working.split(/[\s\-–/]+/).filter(Boolean);
  const kept = tokens.filter((t) => {
    const lower = t.toLowerCase();
    if (STOP_WORDS.has(lower)) return false;
    if (SCHOOL_TYPE_TOKENS.has(lower)) return false;
    if (lower === 'n') return false;
    return true;
  });
  const remainder = kept.join(' ').trim();
  if (!remainder) return rawName;
  return `${jenjang} ${status} ${remainder}`;
}

function normalizeSchoolName(name) {
  const replacements = [
    [/state\s+islamic\s+senior\s+high\s*school/gi, 'MA Negeri'],
    [/state\s+islamic\s+junior\s+high\s*school/gi, 'MTs Negeri'],
    [/state\s+vocational\s+high\s*school/gi, 'SMK Negeri'],
    [/state\s+vocational\s+school/gi, 'SMK Negeri'],
    [/state\s+senior\s+high\s*school/gi, 'SMA Negeri'],
    [/state\s+junior\s+high\s*school/gi, 'SMP Negeri'],
    [/state\s+high\s*school/gi, 'SMA Negeri'],
  ];

  let result = name;
  for (const [pattern, replacement] of replacements) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

// Auto jenjang guesser (PRD 5.5)
function guessJenjangFromName(name) {
  const upper = normalizeSchoolName(name).toUpperCase();
  if (upper.includes('SMK')) return 'SMK';
  if (upper.includes('SMA')) return 'SMA';
  if (upper.includes('SMP')) return 'SMP';
  if (upper.includes('MTS')) return 'MTs';
  if (upper.includes('MA ')) return 'MA';
  return 'SMA'; // default fallback
}

// Tests
test('haversine distance calculated accurately between known Bogor landmarks', () => {
  // Tugu Kujang Bogor (-6.6009, 106.8055) to SMPN 1 Bogor (-6.5950, 106.7925)
  const distKm = haversineDistanceKm(-6.6009, 106.8055, -6.5950, 106.7925);
  assert(distKm > 1.4 && distKm < 1.7, `Distance expected ~1.55km, got ${distKm}`);
});

test('evaluateZonasi returns MASUK_ZONA when house is within radius', () => {
  const school = { lat: -6.5950, lng: 106.7925 };
  const zone = {
    tipe: 'radius',
    radius_m: 2000,
    jarak_terjauh_diterima_m: 1800
  };
  // Point ~800m away
  const result = evaluateZonasi({
    school,
    zone,
    userLat: -6.5980,
    userLng: 106.7980,
    userKecamatan: 'Bogor Tengah'
  });

  assert.equal(result.status, 'MASUK_ZONA');
  assert.equal(result.peluang?.label, 'Tinggi');
  assert(result.jarak_m <= 2000);
});

test('evaluateZonasi returns LUAR_ZONA and Rendah chance when distance exceeds cutoff', () => {
  const school = { lat: -6.5950, lng: 106.7925 };
  const zone = {
    tipe: 'radius',
    radius_m: 1000,
    jarak_terjauh_diterima_m: 1000
  };
  // Point ~5km away
  const result = evaluateZonasi({
    school,
    zone,
    userLat: -6.6400,
    userLng: 106.8200,
    userKecamatan: 'Bogor Selatan'
  });

  assert.equal(result.status, 'LUAR_ZONA');
  assert.equal(result.peluang?.label, 'Rendah');
  assert(result.jarak_m > 1000);
});

test('evaluateZonasi returns BELUM_TERSEDIA when school zone config missing', () => {
  const school = { lat: -6.5950, lng: 106.7925 };
  const result = evaluateZonasi({
    school,
    zone: null,
    userLat: -6.5980,
    userLng: 106.7980
  });

  assert.equal(result.status, 'BELUM_TERSEDIA');
  assert.match(result.alasan, /belum tersedia/i);
});

test('guessJenjangFromName detects school tiers correctly', () => {
  assert.equal(guessJenjangFromName('SMP Negeri 1 Bogor'), 'SMP');
  assert.equal(guessJenjangFromName('SMA Negeri 3 Bogor'), 'SMA');
  assert.equal(guessJenjangFromName('SMK Negeri 1 Bogor'), 'SMK');
  assert.equal(guessJenjangFromName('MTs Negeri 1 Kota Bogor'), 'MTs');
  assert.equal(guessJenjangFromName('MA Negeri 1 Bogor'), 'MA');
});

test('normalizeSchoolName converts English Google Places names to Indonesian', () => {
  assert.equal(normalizeSchoolName('State Senior High School 1 Bogor'), 'SMA Negeri 1 Bogor');
  assert.equal(normalizeSchoolName('State Senior Highschool 3 Bogor'), 'SMA Negeri 3 Bogor');
  assert.equal(normalizeSchoolName('State Junior High School 2 Bogor'), 'SMP Negeri 2 Bogor');
  assert.equal(normalizeSchoolName('State Vocational High School 1 Bogor'), 'SMK Negeri 1 Bogor');
  assert.equal(normalizeSchoolName('State Vocational School Bogor'), 'SMK Negeri Bogor');
  assert.equal(normalizeSchoolName('State Islamic Senior High School 1 Bogor'), 'MA Negeri 1 Bogor');
  assert.equal(normalizeSchoolName('State Islamic Junior High School 1 Bogor'), 'MTs Negeri 1 Bogor');
  // Nama Indonesia tidak berubah
  assert.equal(normalizeSchoolName('SMA Negeri 1 Bogor'), 'SMA Negeri 1 Bogor');
});

test('normalizeSchoolName sets correct status and jenjang via guessJenjangFromName', () => {
  const name = 'State Senior High School 5 Bogor';
  const normalized = normalizeSchoolName(name);
  assert.ok(normalized.includes('SMA Negeri'), `Expected SMA Negeri, got: ${normalized}`);
  assert.equal(guessJenjangFromName(name), 'SMA');
  assert.ok(normalized.toLowerCase().includes('negeri'));
});

test('buildSchoolName dynamically re-prefixes school names based on chosen jenjang and status', () => {
  // English "State Senior High School" di awal
  assert.equal(
    buildSchoolName('State Senior High School 1 Bogor', 'SMA', 'Negeri'),
    'SMA Negeri 1 Bogor'
  );

  // English di belakang: "3 bogor senior high school"
  assert.equal(
    buildSchoolName('3 bogor senior high school', 'SMA', 'Negeri'),
    'SMA Negeri 3 bogor'
  );

  // English di belakang dengan status Swasta: "Regina Pacis Senior High School"
  assert.equal(
    buildSchoolName('Regina Pacis Senior High School', 'SMA', 'Swasta'),
    'SMA Swasta Regina Pacis'
  );

  // "SMAN 9 Bogor" — singkatan tergabung
  assert.equal(
    buildSchoolName('SMAN 9 Bogor', 'SMA', 'Negeri'),
    'SMA Negeri 9 Bogor'
  );
  assert.equal(
    buildSchoolName('SMPN 4 Bogor', 'SMP', 'Negeri'),
    'SMP Negeri 4 Bogor'
  );
  assert.equal(
    buildSchoolName('SMKN 2 Bogor', 'SMK', 'Negeri'),
    'SMK Negeri 2 Bogor'
  );
  // "SMA N 9 Bogor" — terpisah spasi, 'N' harus dibuang
  assert.equal(
    buildSchoolName('SMA N 9 Bogor', 'SMA', 'Negeri'),
    'SMA Negeri 9 Bogor'
  );

  // Hapus kata 'of' dan duplikasi prefiks: "SMA 6 of Bogor"
  assert.equal(
    buildSchoolName('SMA 6 of Bogor', 'SMA', 'Negeri'),
    'SMA Negeri 6 Bogor'
  );

  // Hapus kata 'of': "Senior High School of Bogor"
  assert.equal(
    buildSchoolName('Senior High School of Bogor', 'SMA', 'Swasta'),
    'SMA Swasta Bogor'
  );

  // Hapus kata 'of' dan 'the': "State Senior High School of the City 1 Bogor"
  assert.equal(
    buildSchoolName('State Senior High School of the City 1 Bogor', 'SMA', 'Negeri'),
    'SMA Negeri City 1 Bogor'
  );

  // SMP variants
  assert.equal(
    buildSchoolName('Junior High School 4 Bogor', 'SMP', 'Negeri'),
    'SMP Negeri 4 Bogor'
  );
  assert.equal(
    buildSchoolName('4 Bogor Junior High School', 'SMP', 'Negeri'),
    'SMP Negeri 4 Bogor'
  );

  // Nama Indonesia yang sudah ada prefiksnya, di-override jika user ubah
  assert.equal(
    buildSchoolName('SMA Negeri 1 Bogor', 'SMA', 'Swasta'),
    'SMA Swasta 1 Bogor'
  );
});
