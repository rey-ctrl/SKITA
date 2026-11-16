import { Router, Request, Response } from 'express';
import { estimateRoadTravel, haversineDistanceKm } from '../utils/zonasi.js';

const router = Router();

const OSRM_URL = process.env.OSRM_URL || 'http://localhost:5001';

export interface RouteResult {
  jarak_m: number;
  durasi_motor_menit: number;
  durasi_jalan_menit: number;
  jarak_haversine_m: number;
  sumber: 'osrm' | 'estimasi';
  coordinates?: Array<[number, number]>; // [lat, lng]
}

async function fetchOsrmRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  profile: 'driving' | 'foot'
): Promise<{ distance: number; duration: number; geometry?: { coordinates: Array<[number, number]> } } | null> {
  const url = `${OSRM_URL}/route/v1/${profile}/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json() as {
      code: string;
      routes: Array<{
        distance: number;
        duration: number;
        geometry?: { coordinates: Array<[number, number]> };
      }>;
    };
    if (data.code !== 'Ok' || !data.routes?.[0]) return null;
    return data.routes[0];
  } catch {
    return null;
  }
}

/**
 * GET /api/route?originLat=&originLng=&destLat=&destLng=
 * Fallback ke estimasi 1.28x jika OSRM offline atau belum di-build.
 */
router.get('/', async (req: Request, res: Response) => {
  const originLat = parseFloat(req.query.originLat as string);
  const originLng = parseFloat(req.query.originLng as string);
  const destLat = parseFloat(req.query.destLat as string);
  const destLng = parseFloat(req.query.destLng as string);

  if ([originLat, originLng, destLat, destLng].some(isNaN)) {
    res.status(400).json({ success: false, message: 'originLat, originLng, destLat, destLng wajib ada dan valid.' });
    return;
  }

  const haversineKm = haversineDistanceKm(originLat, originLng, destLat, destLng);
  const jarak_haversine_m = Math.round(haversineKm * 1000);

  // Coba OSRM driving untuk jarak & durasi motor
  const [driving, walking] = await Promise.all([
    fetchOsrmRoute(originLat, originLng, destLat, destLng, 'driving'),
    fetchOsrmRoute(originLat, originLng, destLat, destLng, 'foot'),
  ]);

  if (driving) {
    const jarak_m = Math.round(driving.distance);
    const durasi_motor_menit = Math.max(1, Math.round(driving.duration / 60));
    const durasi_jalan_menit = walking
      ? Math.max(1, Math.round(walking.duration / 60))
      : Math.max(2, Math.round((driving.distance / 1000 / 4.5) * 60));

    // GeoJSON coordinates = [lng, lat]; balik ke [lat, lng] untuk Leaflet
    const coordinates: Array<[number, number]> = driving.geometry?.coordinates
      ? driving.geometry.coordinates.map(([lng, lat]) => [lat, lng])
      : [];

    const result: RouteResult = {
      jarak_m,
      durasi_motor_menit,
      durasi_jalan_menit,
      jarak_haversine_m,
      sumber: 'osrm',
      coordinates,
    };
    res.json({ success: true, data: result });
    return;
  }

  // Fallback: estimasi heuristik 1.28x
  const est = estimateRoadTravel(haversineKm);
  const result: RouteResult = {
    jarak_m: est.roadDistanceM,
    durasi_motor_menit: est.motorMinutes,
    durasi_jalan_menit: est.walkMinutes,
    jarak_haversine_m,
    sumber: 'estimasi',
  };
  res.json({ success: true, data: result });
});

export default router;
