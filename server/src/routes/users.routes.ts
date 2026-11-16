import { Router, Response } from 'express';
import { db } from '../db/store.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { UserLocation } from '../types/index.js';
import { persistUserLocation } from '../db/postgres.js';

const router = Router();

// GET /api/users/locations (FR-GEO-5)
router.get('/locations', authMiddleware, (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return;
  }

  const locations = db.userLocations.get(userId) || [];
  res.json({ success: true, data: locations });
});

// POST /api/users/locations (FR-GEO-1, FR-GEO-2)
router.post('/locations', authMiddleware, (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return;
  }

  const { label, alamat, lat, lng, kecamatan, kelurahan, is_default } = req.body;
  if (!label || !alamat || lat === undefined || lng === undefined) {
    res.status(400).json({ success: false, message: 'Label, alamat, lat, dan lng wajib diisi.' });
    return;
  }

  const newLoc: UserLocation = {
    id: `loc_${Date.now()}`,
    user_id: userId,
    label: label.trim(),
    alamat: alamat.trim(),
    lat: parseFloat(lat),
    lng: parseFloat(lng),
    kecamatan: kecamatan?.trim(),
    kelurahan: kelurahan?.trim(),
    is_default: Boolean(is_default),
  };

  const existing = db.userLocations.get(userId) || [];
  if (newLoc.is_default) {
    existing.forEach((l) => (l.is_default = false));
  }
  existing.unshift(newLoc);
  db.userLocations.set(userId, existing);
  persistUserLocation(newLoc);

  res.status(201).json({ success: true, message: 'Alamat berhasil ditambahkan.', data: newLoc });
});

export default router;
