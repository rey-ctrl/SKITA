import { Router, Response } from 'express';
import { db } from '../db/store.js';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth.js';
import { Assignment, AssignmentSubmission } from '../types/index.js';
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
// FR-A12: Guru membuat penugasan (judul, matpel, deadline, deskripsi)
// --------------------------------------------------------------------------
router.post('/', requireRole('guru'), (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const { class_id, judul, deskripsi, deadline, subject_id, subject_nama, tanggal, attachments } = req.body as {
    class_id: string;
    judul: string;
    deskripsi?: string;
    deadline?: string;
    subject_id?: string;
    subject_nama?: string;
    tanggal?: string;
    attachments?: Array<{ name: string; type: string; size?: number | string; url?: string }>;
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
  let activePeriod = [...db.periods.values()].find((p) => p.class_id === class_id && p.is_active);
  if (!activePeriod) {
    activePeriod = {
      id: `prd_${Date.now()}`,
      class_id,
      start_date: new Date().toISOString(),
      is_active: true,
    };
    db.periods.set(activePeriod.id, activePeriod);
  }

  const tgl = tanggal || getJakartaTime().dateString;

  const assignment: Assignment = {
    id: newId('asgn'),
    class_id,
    period_id: activePeriod.id,
    creator_id: userId,
    judul: judul.trim(),
    deskripsi: deskripsi?.trim() || undefined,
    deadline: deadline || undefined,
    subject_id: subject_id || undefined,
    subject_nama: subject_nama || undefined,
    tanggal: tgl,
    attachments: attachments || undefined,
  };
  db.assignments.set(assignment.id, assignment);

  res.status(201).json({ success: true, assignment });
});

// --------------------------------------------------------------------------
// GET /api/assignments/class/:class_id
// Anggota kelas (murid/guru) dan admin melihat penugasan di kelas ini
// --------------------------------------------------------------------------
router.get('/class/:class_id', (req: AuthRequest, res: Response) => {
  const classId = String(req.params.class_id);
  const userId = req.user!.userId;

  let existing = [...db.assignments.values()].filter((a) => a.class_id === classId);

  // Auto-seed contoh tugas jika kelas belum memiliki penugasan
  if (existing.length === 0) {
    const now = Date.now();
    const activeDeadline = new Date(now + 24 * 60 * 60 * 1000).toISOString(); // 24 jam ke depan
    const expiredDeadline = new Date(now - 3 * 60 * 60 * 1000).toISOString(); // 3 jam lalu (terkunci)

    const sample1: Assignment = {
      id: `asgn_demo_1_${classId}`,
      class_id: classId,
      period_id: 'prd_demo',
      creator_id: 'usr_guru_demo1',
      judul: 'PR Matematika: Matriks & Sistem Persamaan',
      deskripsi: 'Kerjakan latihan soal Bab 3 no 1 - 8. Lampirkan lembar penyelesaian dalam bentuk Foto (JPG/PNG), dokumen Word, atau PDF.',
      deadline: activeDeadline,
      subject_id: 'sub_matematika',
      subject_nama: 'Matematika',
      tanggal: getJakartaTime().dateString,
      attachments: [
        { name: 'Modul_Matriks_Bab3.pdf', type: 'pdf', size: 1250000 },
      ],
    };

    const sample2: Assignment = {
      id: `asgn_demo_2_${classId}`,
      class_id: classId,
      period_id: 'prd_demo',
      creator_id: 'usr_guru_demo2',
      judul: 'Laporan Praktikum Biologi: Uji Karbohidrat',
      deskripsi: 'Buat tabel hasil pengamatan uji amilum dan simpulan praktikum. Upload berkas PDF, Word (.docx), atau lembar kerja Excel (.xlsx).',
      deadline: expiredDeadline,
      subject_id: 'sub_biologi',
      subject_nama: 'Biologi',
      tanggal: getJakartaTime().dateString,
      attachments: [
        { name: 'Panduan_Praktikum_Uji_Amilum.pdf', type: 'pdf', size: 980000 },
      ],
    };

    db.assignments.set(sample1.id, sample1);
    db.assignments.set(sample2.id, sample2);
    existing = [sample1, sample2];
  }

  const assignments = existing
    .sort((a, b) => (b.deadline || b.tanggal).localeCompare(a.deadline || a.tanggal))
    .map((a) => {
      const creator = db.users.get(a.creator_id);
      const subs = [...db.assignmentSubmissions.values()].filter((s) => s.assignment_id === a.id);
      const mySub = subs.find((s) => s.murid_id === userId);

      const creatorNama = creator?.nama || (a.id.includes('demo_1') ? 'Ibu Sri Wahyuni, S.Pd.' : a.id.includes('demo_2') ? 'Pak Bambang, M.Pd.' : 'Guru');

      return {
        id: a.id,
        class_id: a.class_id,
        period_id: a.period_id,
        judul: a.judul,
        deskripsi: a.deskripsi,
        deadline: a.deadline,
        subject_id: a.subject_id,
        subject_nama: a.subject_nama,
        tanggal: a.tanggal,
        attachments: a.attachments || [],
        guru_nama: creatorNama,
        submission_count: subs.length,
        my_submission: mySub || null,
        is_submitted: Boolean(mySub),
      };
    });

  res.json({ success: true, total: assignments.length, assignments });
});

// --------------------------------------------------------------------------
// POST /api/assignments/:id/submit
// Murid mengumpulkan tugas (upload photo, word, excel, pdf)
// Dikunci otomatis jika countdown waktu tenggat telah terlewat
// --------------------------------------------------------------------------
router.post('/:id/submit', (req: AuthRequest, res: Response) => {
  const assignmentId = String(req.params.id);
  const userId = req.user!.userId;
  const user = db.users.get(userId);

  const assignment = db.assignments.get(assignmentId);
  if (!assignment) {
    res.status(404).json({ success: false, message: 'Tugas tidak ditemukan.' });
    return;
  }

  // Cek apakah tenggat waktu telah terlewat (countdown habis)
  if (assignment.deadline) {
    const now = new Date();
    const dl = new Date(assignment.deadline);
    if (now.getTime() > dl.getTime()) {
      res.status(403).json({
        success: false,
        message: 'Tenggat waktu pengerjaan tugas telah berakhir. Tugas terkunci dan tidak dapat lagi dikumpulkan.',
        expired: true,
      });
      return;
    }
  }

  const { catatan, files } = req.body as {
    catatan?: string;
    files?: Array<{ name: string; type: string; size?: string; url?: string }>;
  };

  if (!files || files.length === 0) {
    res.status(400).json({
      success: false,
      message: 'Wajib melampirkan minimal satu file tugas (foto, word, excel, atau pdf).',
    });
    return;
  }

  // Perbarui jika sebelumnya sudah pernah mengumpulkan
  let existing = [...db.assignmentSubmissions.values()].find(
    (s) => s.assignment_id === assignmentId && s.murid_id === userId
  );

  if (existing) {
    existing.submitted_at = new Date().toISOString();
    existing.catatan = catatan?.trim() || existing.catatan;
    existing.files = files;
    db.assignmentSubmissions.set(existing.id, existing);
    res.json({ success: true, message: 'Tugas berhasil diperbarui.', submission: existing });
    return;
  }

  const submission: AssignmentSubmission = {
    id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    assignment_id: assignmentId,
    murid_id: userId,
    murid_nama: user?.nama || 'Murid',
    submitted_at: new Date().toISOString(),
    catatan: catatan?.trim(),
    files,
  };
  db.assignmentSubmissions.set(submission.id, submission);

  res.status(201).json({ success: true, message: 'Tugas berhasil dikumpulkan.', submission });
});

// --------------------------------------------------------------------------
// GET /api/assignments/:id/submissions
// Guru / Admin melihat rekap hasil pengumpulan tugas murid
// --------------------------------------------------------------------------
router.get('/:id/submissions', requireRole('guru', 'admin'), (req: AuthRequest, res: Response) => {
  const assignmentId = String(req.params.id);
  const assignment = db.assignments.get(assignmentId);
  if (!assignment) {
    res.status(404).json({ success: false, message: 'Tugas tidak ditemukan.' });
    return;
  }

  const submissions = [...db.assignmentSubmissions.values()]
    .filter((s) => s.assignment_id === assignmentId)
    .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));

  res.json({ success: true, total: submissions.length, submissions });
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
