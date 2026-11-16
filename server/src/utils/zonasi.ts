import { School, SchoolZone, ZoneEvaluation, Jenjang } from '../types/index.js';

export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius km
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

export function estimateRoadTravel(haversineKm: number) {
  const roadFactor = 1.28;
  const roadDistanceKm = haversineKm * roadFactor;
  const roadDistanceM = Math.round(roadDistanceKm * 1000);
  const motorMinutes = Math.max(3, Math.round((roadDistanceKm / 25) * 60 + 2));
  const walkMinutes = Math.max(2, Math.round((roadDistanceKm / 4.5) * 60));

  return { roadDistanceM, motorMinutes, walkMinutes };
}

export function evaluateZonasi(
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
      alasan: 'Data zonasi resmi untuk sekolah ini belum tersedia.',
      disclaimer,
    };
  }

  let isWithinZone = false;
  let alasan = '';

  if (zone.tipe === 'radius') {
    isWithinZone = distM <= zone.radius_m;
    alasan = isWithinZone
      ? `Jarak ${(distM / 1000).toFixed(2)} km berada di dalam radius zona ${(zone.radius_m / 1000).toFixed(1)} km.`
      : `Jarak ${(distM / 1000).toFixed(2)} km berada di luar radius zona ${(zone.radius_m / 1000).toFixed(1)} km.`;
  } else if (zone.tipe === 'wilayah') {
    isWithinZone = Boolean(zone.wilayah && userKecamatan && zone.wilayah.includes(userKecamatan));
    alasan = isWithinZone
      ? `Kecamatan ${userKecamatan} termasuk dalam wilayah zonasi sekolah.`
      : `Kecamatan ${userKecamatan || 'domisili'} di luar daftar wilayah zonasi.`;
  } else if (zone.tipe === 'gabungan') {
    const radiusOk = distM <= zone.radius_m;
    const wilayahOk = Boolean(zone.wilayah && userKecamatan && zone.wilayah.includes(userKecamatan));
    isWithinZone = radiusOk || wilayahOk;
    alasan = isWithinZone
      ? `Masuk zonasi via ${radiusOk ? 'radius dekat' : 'wilayah domisili'}.`
      : 'Di luar radius dan tidak tercakup dalam wilayah administratif zonasi.';
  }

  // Kluster jarak Bogor (PRD 17 & 19)
  let kluster = 'Kluster > 1.000 m';
  if (distM <= 150) kluster = 'Kluster 0 - 150 m (Prioritas 1)';
  else if (distM <= 500) kluster = 'Kluster 150 - 500 m (Prioritas 2)';
  else if (distM <= 1000) kluster = 'Kluster 500 - 1.000 m (Prioritas 3)';

  // Estimasi peluang (PRD 19)
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

export function normalizeSchoolName(name: string): string {
  const replacements: [RegExp, string][] = [
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

export function guessJenjangFromName(name: string): Jenjang {
  const upper = normalizeSchoolName(name).toUpperCase();
  if (upper.includes('SMK')) return 'SMK';
  if (upper.includes('SMA')) return 'SMA';
  if (upper.includes('SMP')) return 'SMP';
  if (upper.includes('MTS')) return 'MTs';
  if (upper.includes('MA ') || upper.endsWith(' MA')) return 'MA';
  return 'SMA';
}
