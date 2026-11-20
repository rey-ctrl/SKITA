import { Router, Response } from 'express';
import { db } from '../db/store.js';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth.js';
import { Assignment } from '../types/index.js';
import { getJakartaTime, isSchoolDay } from '../utils/calendar.js';

const router = Router();
router.use(authMiddleware);

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// --------------------------------------------------------------------------
// Helper: cek apakah guru anggota aktif suatu kelas DAN periode tertentu
// --------------------------------------------------------------------------
function isGuruInPeriod(guruId: string, classId: string, periodId: string): boolean {
  return [...db.classMemberships.values()].some(
    (cm) =>
      cm.user_id === guruId &&
      cm.class_id === classId &&
      cm.period_id === periodId &&
      cm.role === 'guru'
      // status bisa aktif atau keluar — guru tetap lihat riwayat periode lama (FR-A12)
  );
}

// --------------------------------------------------------------------------
// POST /api/assignments
// FR-A12: Guru membuat penugasan (hanya judul + tanggal, tidak ada soal/lampiran)
// --------------------------------------------------------------------------
router.post('/', requireRole('guru'), (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const { class_id, judul, tanggal } = req.body as {
    class_id: string;
    judul: string;
    tanggal?: string;
  };

  if (!class_id || !judul) {
    res.status(400).json({ success: false, message: 'class_id dan judul wajib diisi.' });
    return;
  }

  const kelas = db.classes.get(class_id);
  if (!kelas) {
    res.status(404).json({ success: false, message: 'Kelas tidak ditemukan.' });
    return;
  }

  // Guru harus anggota aktif kelas ini
  const cm = [...db.classMemberships.values()].find(
    (c) => c.user_id === userId && c.class_id === class_id && c.role === 'guru' && c.status === 'aktif'
  );
  if (!cm) {
    res.status(403).json({ success: false, message: 'Guru tidak terdaftar aktif di kelas ini.' });
    return;
  }

  // Cari periode aktif
  const activePeriod = [...db.periods.values()].find((p) => p.class_id === class_id && p.is_active);
  if (!activePeriod) {
    res.status(400).json({ success: false, message: 'Tidak ada periode aktif di kelas ini.' });
    return;
  }

  const tgl = tanggal || getJakartaTime().dateString;

  const assignment: Assignment = {
    id: newId('asgn'),
    class_id,
    period_id: activePeriod.id,
    creator_id: userId,
    judul,
    tanggal: tgl,
  };
  db.assignments.set(assignment.id, assignment);

  res.status(201).json({ success: true, assignment });
});

// --------------------------------------------------------------------------
// GET /api/assignments/my
// FR-A12: Guru melihat penugasan yang ia buat sendiri (semua periode)
// Tidak tampil: isi soal, jawaban, lampiran, nilai, tugas buatan guru lain
// Sekolah dan Admin TIDAK mendapat akses riwayat tugas
// --------------------------------------------------------------------------
router.get('/my', requireRole('guru'), (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const { class_id } = req.query as { class_id?: string };

  // Ambil semua kelas di mana guru pernah/sedang menjadi anggota
  const guruClassIds = new Set(
    [...db.classMemberships.values()]
      .filter((cm) => cm.user_id === userId && cm.role === 'guru')
      .map((cm) => cm.class_id)
  );

  let assignments = [...db.assignments.values()].filter(
    (a) => a.creator_id === userId && guruClassIds.has(a.class_id)
  );

  if (class_id) {
    assignments = assignments.filter((a) => a.class_id === class_id);
  }

  assignments.sort((a, b) => b.tanggal.localeCompare(a.tanggal));

  // Respons hanya berisi judul, tanggal, kelas tujuan — tidak ada soal/lampiran/nilai
  const data = assignments.map((a) => {
    const kelas = db.classes.get(a.class_id);
    return {
      id: a.id,
      class_id: a.class_id,
      class_nama: kelas?.nama || a.class_id,
      period_id: a.period_id,
      judul: a.judul,
      tanggal: a.tanggal,
    };
  });

  res.json({ success: true, total: data.length, assignments: data });
});

// --------------------------------------------------------------------------
// GET /api/assignments/history/attendance/:class_id/:period_id
// FR-A12: Guru melihat riwayat absensi dari periode di mana ia anggota kelas itu
// Hanya nama + status hadir (tidak ada catatan, tidak ada detail murid lain)
// Murid baru di periode baru TIDAK melihat data absensi periode lama
// --------------------------------------------------------------------------
router.get('/history/attendance/:class_id/:period_id', requireRole('guru'), (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const classId = String(req.params.class_id);
  const periodId = String(req.params.period_id);

  // FR-A12 Acceptance: guru harus tercatat sebagai anggota kelas periode ini di server
  if (!isGuruInPeriod(userId, classId, periodId)) {
    res.status(403).json({
      success: false,
      message: 'Guru tidak tercatat sebagai anggota kelas pada periode ini.',
    });
    return;
  }

  const records = [...db.attendance.values()].filter(
    (a) => a.class_id === classId && a.period_id === periodId
  );

  // Hanya nama + status hadir — TIDAK ada catatan (FR-A12)
  const data = records.map((r) => {
    const murid = db.users.get(r.murid_id);
    return {
      murid_id: r.murid_id,
      nama: murid?.nama || 'Anonim',
      tanggal: r.tanggal,
      status: r.status,
    };
  });

  res.json({ success: true, class_id: classId, period_id: periodId, records: data });
});

export default router;
