import { Router, Request, Response } from 'express';

const router = Router();

export const REGIONS_DATA = [
  {
    id: 'jabar',
    name: 'Jawa Barat',
    cities: [
      'Kota Bogor',
      'Kabupaten Bogor',
      'Kota Depok',
      'Kota Bekasi',
      'Kota Bandung',
      'Kota Sukabumi',
      'Kabupaten Sukabumi',
      'Kabupaten Cianjur',
    ],
  },
  {
    id: 'dki',
    name: 'DKI Jakarta',
    cities: [
      'Kota Administrasi Jakarta Selatan',
      'Kota Administrasi Jakarta Pusat',
      'Kota Administrasi Jakarta Timur',
      'Kota Administrasi Jakarta Barat',
      'Kota Administrasi Jakarta Utara',
    ],
  },
  {
    id: 'banten',
    name: 'Banten',
    cities: ['Kota Tangerang', 'Kota Tangerang Selatan', 'Kabupaten Tangerang', 'Kota Serang'],
  },
  {
    id: 'jateng',
    name: 'Jawa Tengah',
    cities: ['Kota Semarang', 'Kota Surakarta (Solo)', 'Kota Magelang'],
  },
  {
    id: 'jatim',
    name: 'Jawa Timur',
    cities: ['Kota Surabaya', 'Kota Malang', 'Kota Sidoarjo'],
  },
];

// GET /api/regions/provinces
router.get('/provinces', (_req: Request, res: Response) => {
  const provinces = REGIONS_DATA.map((p) => ({ id: p.id, name: p.name }));
  res.json({ success: true, data: provinces });
});

// GET /api/regions/cities?province=Jawa%20Barat
router.get('/cities', (req: Request, res: Response) => {
  const provinceQuery = req.query.province as string;
  if (!provinceQuery) {
    res.status(400).json({ success: false, message: 'Parameter query "province" wajib diisi.' });
    return;
  }

  const found = REGIONS_DATA.find(
    (p) => p.name.toLowerCase() === provinceQuery.toLowerCase().trim()
  );

  res.json({
    success: true,
    province: provinceQuery,
    cities: found ? found.cities : [],
  });
});

export default router;
