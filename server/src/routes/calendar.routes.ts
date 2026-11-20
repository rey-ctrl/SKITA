import { Router, Response } from 'express';
import { db } from '../db/store.js';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth.js';
import { Holiday, SchoolCalendarOverride } from '../types/index.js';

const router = Router();
router.use(authMiddleware);

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// ==========================================================================
// 1. Libur Nasional (Admin only - SKB 3 Menteri)
// ==========================================================================

router.get('/holidays', (_req: AuthRequest, res: Response) => {
  const holidays = [...db.holidays.values()].sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  res.json({ success: true, count: holidays.length, holidays });
});

router.post('/holidays', requireRole('admin'), (req: AuthRequest, res: Response) => {
  const { tanggal, nama, jenis } = req.body as {
    tanggal: string;
    nama: string;
    jenis: 'nasional' | 'cuti_bersama';
  };

  if (!tanggal || !nama || !jenis) {
    res.status(400).json({ success: false, message: 'tanggal, nama, dan jenis wajib diisi.' });
    return;
  }

  // Cek duplikat tanggal
  const existing = [...db.holidays.values()].find((h) => h.tanggal === tanggal);
  if (existing) {
    existing.nama = nama;
    existing.jenis = jenis;
    db.holidays.set(existing.id, existing);
    res.json({ success: true, message: 'Libur berhasil diperbarui.', holiday: existing });
    return;
  }

  const holiday: Holiday = {
    id: newId('hol'),
    tanggal,
    nama,
    jenis,
  };
  db.holidays.set(holiday.id, holiday);

  res.status(201).json({ success: true, message: 'Libur berhasil ditambahkan.', holiday });
});

router.delete('/holidays/:id', requireRole('admin'), (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  if (!db.holidays.has(id)) {
    res.status(404).json({ success: false, message: 'Data libur tidak ditemukan.' });
    return;
  }
  db.holidays.delete(id);
  res.json({ success: true, message: 'Libur berhasil dihapus.' });
});

// ==========================================================================
// 2. School Calendar Overrides
// FR-A13: Sekolah bisa menambah libur sendiri dan menandai tanggal merah
// sebagai hari masuk. Admin TIDAK BISA menandai hari masuk untuk sekolah.
// ==========================================================================

router.get('/school-calendar/:school_id', (req: AuthRequest, res: Response) => {
  const schoolId = String(req.params.school_id);
  const overrides = [...db.schoolCalendarOverrides.values()]
    .filter((o) => o.school_id === schoolId)
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal));

  res.json({ success: true, school_id: schoolId, overrides });
});

router.post('/school-calendar/:school_id', (req: AuthRequest, res: Response) => {
  const schoolId = String(req.params.school_id);
  const role = req.user!.role;
  const { tanggal, override_type } = req.body as {
    tanggal: string;
    override_type: 'masuk' | 'libur';
  };

  if (!tanggal || !override_type) {
    res.status(400).json({ success: false, message: 'tanggal dan override_type wajib diisi.' });
    return;
  }

  // FR-A13: Admin TIDAK bisa menandai hari masuk
  if (role === 'admin' && override_type === 'masuk') {
    res.status(403).json({
      success: false,
      message: 'Admin tidak berwenang menandai hari masuk sekolah. Hanya pihak sekolah yang berwenang.',
    });
    return;
  }

  if (role !== 'admin' && role !== 'sekolah') {
    res.status(403).json({ success: false, message: 'Akses ditolak.' });
    return;
  }

  // Update jika sudah ada override pada tanggal tersebut
  const existing = [...db.schoolCalendarOverrides.values()].find(
    (o) => o.school_id === schoolId && o.tanggal === tanggal
  );
  if (existing) {
    existing.override_type = override_type;
    db.schoolCalendarOverrides.set(existing.id, existing);
    res.json({ success: true, message: 'Override kalender diperbarui.', override: existing });
    return;
  }

  const record: SchoolCalendarOverride = {
    id: newId('sco'),
    school_id: schoolId,
    tanggal,
    override_type,
  };
  db.schoolCalendarOverrides.set(record.id, record);

  res.status(201).json({ success: true, message: 'Override kalender disimpan.', override: record });
});

router.delete('/school-calendar/:id', (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const role = req.user!.role;
  if (role !== 'admin' && role !== 'sekolah') {
    res.status(403).json({ success: false, message: 'Akses ditolak.' });
    return;
  }

  if (!db.schoolCalendarOverrides.has(id)) {
    res.status(404).json({ success: false, message: 'Data override tidak ditemukan.' });
    return;
  }
  db.schoolCalendarOverrides.delete(id);
  res.json({ success: true, message: 'Override kalender dihapus.' });
});

export default router;
