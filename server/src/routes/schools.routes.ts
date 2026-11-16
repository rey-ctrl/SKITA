import { Router, Request, Response } from 'express';
import { db, MOCK_PLACES_API } from '../db/store.js';
import { evaluateZonasi, haversineDistanceKm, guessJenjangFromName, normalizeSchoolName } from '../utils/zonasi.js';
import { School, SchoolZone, Jenjang } from '../types/index.js';
import { persistSchool, persistZone, removeSchool } from '../db/postgres.js';

const router = Router();

// Helper format URL foto ke WebP
// ponytail: konversi parameter URL webp. Pasang sharp pipeline bila nanti simpan file lokal ke S3/storage.
export function toWebpUrl(url: string): string {
  if (!url) return url;
  if (url.includes('unsplash.com')) {
    const clean = url.replace(/[?&]fm=[^&]+/g, '').replace(/[?&]auto=[^&]+/g, '');
    const sep = clean.includes('?') ? '&' : '?';
    return `${clean}${sep}fm=webp&q=80`;
  }
  return url.replace(/\.(jpe?g|png)($|\?)/i, '.webp$2');
}

function parseIndonesianAddress(addr: string) {
  const kecMatch = addr.match(/Kecamatan\s+([^,]+)/i) || addr.match(/Kec\.\s*([^,]+)/i);
  const kotaMatch = addr.match(/(Kota\s+[^,]+|Kabupaten\s+[^,]+|Kab\.\s*[^,]+)/i);
  const provMatch = addr.match(/(Jawa Barat|DKI Jakarta|Banten|Jawa Tengah|Jawa Timur|DI Yogyakarta)/i);
  const kelMatch = addr.match(/Kelurahan\s+([^,]+)/i) || addr.match(/Kel\.\s*([^,]+)/i);

  return {
    kecamatan: kecMatch ? kecMatch[1].trim() : 'Bogor',
    kelurahan: kelMatch ? kelMatch[1].trim() : undefined,
    kota_kab: kotaMatch ? kotaMatch[1].trim() : 'Kota Bogor',
    provinsi: provMatch ? provMatch[1].trim() : 'Jawa Barat',
  };
}

const discoveredPlacesCache = new Map<string, any>();

// GET /api/schools (FR-DASH)
router.get('/', (req: Request, res: Response) => {
  const {
    search,
    jenjang,
    status,
    kota,
    lat,
    lng,
    max_km,
    zonasi_only,
    sort_by,
  } = req.query;

  const userLat = lat ? parseFloat(lat as string) : -6.5912;
  const userLng = lng ? parseFloat(lng as string) : 106.7995;
  const maxDistanceKm = max_km ? parseFloat(max_km as string) : 30;

  const results = Array.from(db.schools.values())
    .map((school) => {
      const zone = db.zones.get(school.id);
      const evaluation = evaluateZonasi(school, zone, userLat, userLng);
      return {
        ...school,
        zone,
        evaluation,
      };
    })
    .filter((item) => {
      if (search) {
        const q = (search as string).toLowerCase().trim();
        const match =
          item.nama.toLowerCase().includes(q) ||
          item.alamat.toLowerCase().includes(q) ||
          item.kecamatan.toLowerCase().includes(q);
        if (!match) return false;
      }

      if (jenjang && jenjang !== 'SEMUA' && item.jenjang !== jenjang) {
        return false;
      }

      if (status && status !== 'SEMUA' && item.status !== status) {
        return false;
      }

      if (kota && !item.kota_kab.toLowerCase().includes((kota as string).toLowerCase())) {
        return false;
      }

      const distKm = item.evaluation.jarak_m / 1000;
      if (distKm > maxDistanceKm) {
        return false;
      }

      if (zonasi_only === 'true' && item.evaluation.status !== 'MASUK_ZONA') {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (sort_by === 'nama') {
        return a.nama.localeCompare(b.nama);
      }
      return a.evaluation.jarak_m - b.evaluation.jarak_m;
    });

  res.json({
    success: true,
    total: results.length,
    data: results,
  });
});

// GET /api/schools/:id (FR-DET)
router.get('/:id', (req: Request, res: Response) => {
  const schoolId = String(req.params.id);
  const school = db.schools.get(schoolId);
  if (!school) {
    res.status(404).json({ success: false, message: 'Sekolah tidak ditemukan.' });
    return;
  }

  const zone = db.zones.get(school.id);
  res.json({
    success: true,
    data: {
      ...school,
      zone: zone || null,
    },
  });
});

// DELETE /api/schools/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const schoolId = String(req.params.id);
  const school = db.schools.get(schoolId);
  if (!school) {
    res.status(404).json({ success: false, message: 'Sekolah tidak ditemukan.' });
    return;
  }

  db.schools.delete(schoolId);
  db.zones.delete(schoolId);
  await removeSchool(schoolId);

  res.json({
    success: true,
    message: `Sekolah ${school.nama} berhasil dihapus dari database.`,
  });
});

// GET /api/schools/:id/zonasi (FR-ZON)
router.get('/:id/zonasi', (req: Request, res: Response) => {
  const schoolId = String(req.params.id);
  const school = db.schools.get(schoolId);
  if (!school) {
    res.status(404).json({ success: false, message: 'Sekolah tidak ditemukan.' });
    return;
  }

  const { lat, lng, kecamatan } = req.query;
  const userLat = lat ? parseFloat(lat as string) : -6.5912;
  const userLng = lng ? parseFloat(lng as string) : 106.7995;
  const zone = db.zones.get(school.id);

  const evaluation = evaluateZonasi(
    school,
    zone,
    userLat,
    userLng,
    kecamatan as string | undefined
  );

  res.json({
    success: true,
    school_id: school.id,
    school_nama: school.nama,
    evaluation,
  });
});

// POST /api/schools/search-on-the-fly (FR-SOF)
// Search Google Places proxy & deduplicate & cache
router.post('/search-on-the-fly', async (req: Request, res: Response) => {
  const { query, import_place_id, jenjang_override, status_override } = req.body;
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const hasValidKey = apiKey && apiKey !== 'YOUR_GOOGLE_MAPS_KEY_HERE';

  // 1. If import_place_id is provided, save selected place to SKITA DB (FR-SOF-3)
  if (import_place_id) {
    // Check place_id deduplication (FR-SOF-5)
    for (const existing of db.schools.values()) {
      if (existing.place_id === import_place_id) {
        res.status(409).json({
          success: false,
          message: 'Sekolah ini sudah ada di database SKITA.',
          data: existing,
        });
        return;
      }
    }

    // Find in cached places or mock places
    let found: any = discoveredPlacesCache.get(import_place_id) || MOCK_PLACES_API.find((p) => p.place_id === import_place_id);

    // If not found in memory and Google API key is available, fetch Place Details
    if (!found && hasValidKey) {
      try {
        const detailsRes = await fetch(`https://places.googleapis.com/v1/places/${import_place_id}`, {
          headers: {
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,photos,nationalPhoneNumber,websiteUri',
          },
        });
        if (detailsRes.ok) {
          const detailData = await detailsRes.json();
          const addrInfo = parseIndonesianAddress(detailData.formattedAddress || '');
          let photo = 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800&auto=format&fit=crop&q=80';
          if (detailData.photos && detailData.photos[0]?.name) {
            photo = `https://places.googleapis.com/v1/${detailData.photos[0].name}/media?maxWidthPx=800&key=${apiKey}`;
          }

          const rawDetailNama = detailData.displayName?.text || 'Sekolah';
          const normalizedDetailNama = normalizeSchoolName(rawDetailNama);

          found = {
            place_id: detailData.id,
            nama: normalizedDetailNama,
            jenjang: guessJenjangFromName(normalizedDetailNama),
            status: (normalizedDetailNama.toLowerCase().includes('negeri') ? 'Negeri' : 'Swasta') as 'Negeri' | 'Swasta',
            alamat: detailData.formattedAddress || '',
            lat: detailData.location?.latitude || -6.5912,
            lng: detailData.location?.longitude || 106.7995,
            foto_url: photo,
            kecamatan: addrInfo.kecamatan,
            kelurahan: addrInfo.kelurahan,
            kota_kab: addrInfo.kota_kab,
            provinsi: addrInfo.provinsi,
            telepon: detailData.nationalPhoneNumber || undefined,
            website: detailData.websiteUri || undefined,
          };
        }
      } catch (err) {
        console.warn('[Google Places] Gagal fetch detail tempat:', err);
      }
    }

    if (!found) {
      res.status(404).json({ success: false, message: 'Data tempat tidak ditemukan.' });
      return;
    }

    // Name & distance similarity deduplication (FR-SOF-5)
    for (const existing of db.schools.values()) {
      const dist = haversineDistanceKm(existing.lat, existing.lng, found.lat, found.lng);
      if (existing.nama.toLowerCase().trim() === found.nama.toLowerCase().trim() && dist < 0.2) {
        res.status(409).json({
          success: false,
          message: 'Sekolah serupa di koordinat yang sama sudah terdaftar.',
          data: existing,
        });
        return;
      }
    }

    const newId = `sch_custom_${Date.now()}`;
    const newSchool: School = {
      ...found,
      id: newId,
      foto_url: toWebpUrl(found.foto_url),
      jenjang: (jenjang_override as Jenjang) || guessJenjangFromName(found.nama),
      status: (status_override as 'Negeri' | 'Swasta') || found.status || 'Negeri',
      is_custom_added: true,
    };

    // Auto-generate zonasi rule per PRD & Permendikbud
    const isSwasta = newSchool.status === 'Swasta';
    const defaultRadius = newSchool.jenjang === 'SMP' ? 1500 : 2000;
    const defaultZone: SchoolZone = {
      id: `zone_${newId}`,
      school_id: newId,
      tipe: isSwasta ? 'wilayah' : 'radius',
      radius_m: defaultRadius,
      wilayah: [newSchool.kecamatan, 'Bogor Tengah', 'Bogor Timur', 'Bogor Barat', 'Bogor Selatan', 'Tanah Sareal', 'Bogor Utara'].filter(Boolean),
      jarak_terjauh_diterima_m: Math.round(defaultRadius * 0.9),
      daya_tampung_zonasi: isSwasta ? 200 : 180,
      jumlah_pendaftar: isSwasta ? 150 : 280,
      tahun_ajaran: '2025/2026',
      sumber: isSwasta ? 'Jalur Mandiri / SPMB Swasta' : 'Juknis SPMB Disdik - Zonasi Radius',
      tanggal_verifikasi: new Date().toISOString().split('T')[0],
    };

    db.schools.set(newId, newSchool);
    db.zones.set(newId, defaultZone);
    await persistSchool(newSchool);
    await persistZone(defaultZone);

    res.status(201).json({
      success: true,
      message: 'Sekolah berhasil disimpan ke database SKITA.',
      data: {
        ...newSchool,
        zone: defaultZone,
      },
    });
    return;
  }

  // 2. Otherwise, search external places (FR-SOF-1, FR-SOF-2)
  if (!query || typeof query !== 'string') {
    res.status(400).json({ success: false, message: 'Query pencarian wajib diisi.' });
    return;
  }

  const q = query.toLowerCase().trim();
  const normalizedQ = q.replace(/smpn/g, 'smp negeri').replace(/sman/g, 'sma negeri').replace(/smkn/g, 'smk negeri');
  const results: any[] = [];
  const seenPlaceIds = new Set<string>();

  // Try real Google Places API (New) first if key is present
  if (hasValidKey) {
    try {
      const googleRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.photos,places.nationalPhoneNumber,places.websiteUri',
        },
        body: JSON.stringify({
          textQuery: query.includes('sekolah') || query.includes('sma') || query.includes('smp') || query.includes('smk') ? query : `${query} sekolah`,
        }),
      });

      if (googleRes.ok) {
        const googleData = await googleRes.json();
        if (Array.isArray(googleData.places)) {
          for (const p of googleData.places) {
            const addrInfo = parseIndonesianAddress(p.formattedAddress || '');
            let photo = 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800&auto=format&fit=crop&q=80';
            if (p.photos && p.photos[0]?.name) {
              photo = `https://places.googleapis.com/v1/${p.photos[0].name}/media?maxWidthPx=800&key=${apiKey}`;
            }

            const rawNama = p.displayName?.text || 'Sekolah';
            const normalizedNama = normalizeSchoolName(rawNama);

            const item = {
              place_id: p.id,
              nama: normalizedNama,
              jenjang: guessJenjangFromName(normalizedNama),
              status: (normalizedNama.toLowerCase().includes('negeri') ? 'Negeri' : 'Swasta') as 'Negeri' | 'Swasta',
              alamat: p.formattedAddress || '',
              lat: p.location?.latitude || -6.5912,
              lng: p.location?.longitude || 106.7995,
              foto_url: toWebpUrl(photo),
              kecamatan: addrInfo.kecamatan,
              kelurahan: addrInfo.kelurahan,
              kota_kab: addrInfo.kota_kab,
              provinsi: addrInfo.provinsi,
              telepon: p.nationalPhoneNumber || undefined,
              website: p.websiteUri || undefined,
            };

            discoveredPlacesCache.set(p.id, item);
            seenPlaceIds.add(p.id);
            results.push({
              ...item,
              guessed_jenjang: item.jenjang,
              already_saved: Array.from(db.schools.values()).some((s) => s.place_id === p.id),
            });
          }
        }
      }
    } catch (err) {
      console.warn('[Google Places] Gagal request searchText:', err);
    }
  }

  // Supplement / fallback with local mock places
  const mockMatches = MOCK_PLACES_API.filter((p) => {
    if (seenPlaceIds.has(p.place_id)) return false;
    const name = p.nama.toLowerCase();
    const addr = p.alamat.toLowerCase();
    const kec = p.kecamatan.toLowerCase();
    return name.includes(q) || name.includes(normalizedQ) || addr.includes(q) || kec.includes(q);
  }).map((p) => {
    discoveredPlacesCache.set(p.place_id, p);
    return {
      ...p,
      guessed_jenjang: guessJenjangFromName(p.nama),
      already_saved: Array.from(db.schools.values()).some((s) => s.place_id === p.place_id),
    };
  });

  results.push(...mockMatches);

  res.json({
    success: true,
    query,
    total: results.length,
    results,
  });
});

export default router;
