import { School, SchoolZone, ZoneEvaluation, Jenjang } from '../types';
import { haversineDistanceKm, estimateRoadTravel } from './geo';

/**
 * Evaluate school zoning eligibility and chances
 */
export function evaluateSchoolZonasi(
  school: School,
  zone: SchoolZone | undefined,
  userLat: number,
  userLng: number,
  userKecamatan?: string
): ZoneEvaluation {
  const distKm = haversineDistanceKm(userLat, userLng, school.lat, school.lng);
  const distM = Math.round(distKm * 1000);
  const { roadDistanceM, motorMinutes, walkMinutes } = estimateRoadTravel(distKm);

  const disclaimer = 'Hasil bersifat estimasi, keputusan resmi mengikuti ketentuan dinas pendidikan/sekolah.';

  if (school.status === 'Swasta') {
    return {
      status: 'BELUM_TERSEDIA',
      jarak_m: distM,
      jarak_rute_m: roadDistanceM,
      durasi_motor_menit: motorMinutes,
      durasi_jalan_menit: walkMinutes,
      alasan: 'Sekolah swasta menerapkan jalur mandiri (bebas zonasi domisili).',
      disclaimer,
    };
  }

  if (!zone) {
    return {
      status: 'BELUM_TERSEDIA',
      jarak_m: distM,
      jarak_rute_m: roadDistanceM,
      durasi_motor_menit: motorMinutes,
      durasi_jalan_menit: walkMinutes,
      alasan: 'Data zonasi resmi untuk sekolah ini belum tersedia dalam sistem riset kami.',
      disclaimer,
    };
  }

  let isWithinZone = false;
  let alasan = '';

  // 1. Check Zone Type
  if (zone.tipe === 'radius') {
    isWithinZone = distM <= zone.radius_m;
    alasan = isWithinZone
      ? `Jarak ${(distM / 1000).toFixed(2)} km berada di dalam radius zonasi ${(zone.radius_m / 1000).toFixed(1)} km.`
      : `Jarak ${(distM / 1000).toFixed(2)} km berada di luar radius zonasi ${(zone.radius_m / 1000).toFixed(1)} km.`;
  } else if (zone.tipe === 'wilayah') {
    isWithinZone = Boolean(zone.wilayah && userKecamatan && zone.wilayah.includes(userKecamatan));
    alasan = isWithinZone
      ? `Kecamatan ${userKecamatan} termasuk dalam wilayah zonasi resmi sekolah.`
      : `Kecamatan ${userKecamatan || 'domisili'} di luar daftar kelurahan/kecamatan zonasi.`;
  } else if (zone.tipe === 'gabungan') {
    const radiusOk = distM <= zone.radius_m;
    const wilayahOk = Boolean(zone.wilayah && userKecamatan && zone.wilayah.includes(userKecamatan));
    isWithinZone = radiusOk || wilayahOk;
    alasan = isWithinZone
      ? `Lolos zonasi via ${radiusOk ? 'radius dekat' : 'wilayah domisili'}.`
      : 'Di luar radius dan tidak tercakup dalam wilayah administratif zonasi.';
  }

  // 2. Determine Distance Cluster (PRD 17: Kota Bogor kluster jarak bertingkat)
  let kluster = 'Kluster > 1.000 m';
  if (distM <= 150) kluster = 'Kluster 0 - 150 m (Prioritas 1)';
  else if (distM <= 500) kluster = 'Kluster 150 - 500 m (Prioritas 2)';
  else if (distM <= 1000) kluster = 'Kluster 500 - 1.000 m (Prioritas 3)';

  // 3. Estimate Odds (PRD 19: Peluang berdasarkan cut-off tahun lalu dan posisi jarak)
  let peluang: ZoneEvaluation['peluang'] = undefined;
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
    jarak_rute_m: roadDistanceM,
    durasi_motor_menit: motorMinutes,
    durasi_jalan_menit: walkMinutes,
    kluster_nama: kluster,
    peluang,
    alasan,
    disclaimer,
  };
}

/**
 * Normalize English school name from Google Places → Indonesian equivalent.
 * "State Senior High School 1 Bogor" → "SMA Negeri 1 Bogor"
 */
export function normalizeSchoolName(name: string): string {
  const replacements: [RegExp, string][] = [
    // Islamic variants (urutan sebelum generic agar tidak partial match)
    [/state\s+islamic\s+senior\s+high\s*school(\s+of)?/gi, 'MA Negeri'],
    [/state\s+islamic\s+junior\s+high\s*school(\s+of)?/gi, 'MTs Negeri'],
    // Vocational
    [/state\s+vocational\s+high\s*school(\s+of)?/gi, 'SMK Negeri'],
    [/state\s+vocational\s+school(\s+of)?/gi, 'SMK Negeri'],
    // Senior / Junior
    [/state\s+senior\s+high\s*school(\s+of)?/gi, 'SMA Negeri'],
    [/state\s+junior\s+high\s*school(\s+of)?/gi, 'SMP Negeri'],
    // Generic fallback
    [/state\s+high\s*school(\s+of)?/gi, 'SMA Negeri'],
  ];

  let result = name;
  for (const [pattern, replacement] of replacements) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Kata-kata yang membentuk frasa "jenis sekolah" dalam bahasa Inggris.
 * Token ini dibuang dari nama; sisanya adalah identitas unik sekolah.
 */
const SCHOOL_TYPE_TOKENS = new Set([
  'state', 'islamic', 'vocational', 'senior', 'junior', 'high', 'school', 'highschool',
]);

/** Kata sambung/preposisi yang selalu dibuang. */
const STOP_WORDS = new Set(['of', 'the', 'and', 'atau']);

/**
 * Pola prefiks Indonesia — menangkap:
 * "SMAN", "SMPN", "SMKN", "MAN", "MTsN"  (singkatan tergabung)
 * "SMA Negeri", "SMA Swasta", "SMA N", "SMA"  (terpisah)
 */
const ID_PREFIX_RE = /^(sman|smpn|smkn|man|mtsn|sma|smk|smp|mts|ma)(\s+(negeri|swasta|n\b))?\s*/i;

/**
 * Tokenize, hapus kata sambung + kata jenis sekolah Inggris,
 * lalu rekonstruksi nama dengan prefiks {jenjang} {status}.
 *
 * Contoh:
 *   "3 Bogor Senior High School"    → "SMA Negeri 3 Bogor"
 *   "State Senior High School 1 Bogor" → "SMA Negeri 1 Bogor"
 *   "Senior High School of Bogor"   → "SMA Swasta Bogor"
 *   "SMA Negeri 1 Bogor"            → "SMA Swasta 1 Bogor"  (jika user pilih Swasta)
 */
export function buildSchoolName(rawName: string, jenjang: Jenjang, status: 'Negeri' | 'Swasta'): string {
  // 1. Cabut prefiks Indonesia jika ada
  let working = rawName.trim().replace(ID_PREFIX_RE, '').trim();

  // 2. Tokenize (pisahkan angka dan kata)
  const tokens = working.split(/[\s\-–/]+/).filter(Boolean);

  // 3. Buang stop words, school-type tokens, dan singkatan 'n' tunggal (Negeri)
  const kept = tokens.filter((t) => {
    const lower = t.toLowerCase();
    if (STOP_WORDS.has(lower)) return false;
    if (SCHOOL_TYPE_TOKENS.has(lower)) return false;
    if (lower === 'n') return false; // tangani singkatan 'n' mandiri (misal: "SMA N 9")
    return true;
  });

  // 4. Jika tidak ada sisa (semua kata terbuang), fallback ke rawName
  const remainder = kept.join(' ').trim();
  if (!remainder) return rawName;

  return `${jenjang} ${status} ${remainder}`;
}

/**
 * Auto guess Jenjang from School Name
 */
export function guessJenjangFromName(name: string): Jenjang {
  const upper = normalizeSchoolName(name).toUpperCase();
  if (upper.includes('SMK')) return 'SMK';
  if (upper.includes('SMA')) return 'SMA';
  if (upper.includes('SMP')) return 'SMP';
  if (upper.includes('MTS')) return 'MTs';
  if (upper.includes('MA ') || upper.endsWith(' MA')) return 'MA';
  return 'SMA';
}
