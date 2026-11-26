import { Router, Response } from 'express';
import { db } from '../db/store.js';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth.js';
import { Subject, TeacherSubject } from '../types/index.js';
import { SUBJECT_TEMPLATES } from '../data/subjectTemplates.js';
import { persistSubject, persistTeacherSubject, removeSubject } from '../db/postgres.js';

const router = Router();
router.use(authMiddleware);

// ---------------------------------------------------------------
// Helper: cek apakah user bisa kelola sekolah ini
// Admin: semua. Sekolah: semua (ponytail: scope via owner_user_id FR-A3).
// ---------------------------------------------------------------
function canManage(req: AuthRequest, schoolId: string): boolean {
  const role = req.user!.role;
  if (role === 'admin') return true;
  // ponytail: bandingkan owner_user_id setelah SchoolConfig punya field itu
  if (role === 'sekolah') return true;
  return false;
}

// ---------------------------------------------------------------
// GET /api/subjects/templates?jenjang=SMP&status=Negeri
// FR-A3: template bawaan per jenjang & status (checklist sumber)
// ---------------------------------------------------------------
router.get('/templates', (req: AuthRequest, res: Response) => {
  const { jenjang, status } = req.query as { jenjang?: string; status?: string };

  let results = SUBJECT_TEMPLATES;
  if (jenjang) results = results.filter((t) => t.jenjang === jenjang);
  if (status) results = results.filter((t) => t.status === status);

  res.json({ success: true, templates: results });
});

// ---------------------------------------------------------------
// GET /api/subjects/school/:school_id
// FR-A3: daftar mapel aktif di sekolah (Sekolah, Admin, Guru anggota)
// ---------------------------------------------------------------
router.get('/school/:school_id', (req: AuthRequest, res: Response) => {
  const schoolId = String(req.params.school_id);
  const userId = req.user!.userId;
  const role = req.user!.role;

  // Guru: hanya boleh lihat kalau dia anggota sekolah itu
  if (role === 'guru') {
    const membership = [...db.schoolMemberships.values()].find(
      (m) => m.user_id === userId && m.school_id === schoolId && m.status === 'aktif'
    );
    if (!membership) {
      res.status(403).json({ success: false, message: 'Akses ditolak.' });
      return;
    }
  } else if (role === 'murid' || role === 'pengguna') {
    res.status(403).json({ success: false, message: 'Akses ditolak.' });
    return;
  }

  const subjects = [...db.subjects.values()].filter(
    (s) => s.school_id === schoolId && s.is_active
  );
  res.json({ success: true, subjects });
});

// ---------------------------------------------------------------
// POST /api/subjects/school/:school_id/generate
// FR-A3: generate semua mapel dari template sesuai jenjang + status.
//        Semua otomatis ter-generate & tercentang. Idempoten.
// Body: { jenjang: 'SMP', status: 'Negeri' }
// ---------------------------------------------------------------
router.post(
  '/school/:school_id/generate',
  requireRole('sekolah', 'admin'),
  (req: AuthRequest, res: Response) => {
    const schoolId = String(req.params.school_id);
    if (!canManage(req, schoolId)) {
      res.status(403).json({ success: false, message: 'Akses ditolak.' });
      return;
    }

    const { jenjang, status } = req.body as { jenjang?: string; status?: string };
    if (!jenjang || !status) {
      res.status(400).json({ success: false, message: 'jenjang dan status wajib diisi.' });
      return;
    }

    const templates = SUBJECT_TEMPLATES.filter(
      (t) => t.jenjang === jenjang && t.status === status
    );
    if (!templates.length) {
      res.status(400).json({ success: false, message: 'Template tidak ditemukan untuk jenjang/status ini.' });
      return;
    }

    // Existing subjects per sekolah
    const existingNames = new Set(
      [...db.subjects.values()]
        .filter((s) => s.school_id === schoolId && !s.is_custom)
        .map((s) => s.nama)
    );

    const created: Subject[] = [];
    for (const t of templates) {
      if (existingNames.has(t.nama)) continue; // idempoten: skip kalau sudah ada
      const subj: Subject = {
        id: `subj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        school_id: schoolId,
        nama: t.nama,
        is_custom: false,
        is_active: true,
      };
      db.subjects.set(subj.id, subj);
      persistSubject(subj);
      created.push(subj);
    }

    // Semua mapel template yang ada (baru + existing) dikembalikan
    const all = [...db.subjects.values()].filter(
      (s) => s.school_id === schoolId && s.is_active
    );
    res.status(201).json({ success: true, created: created.length, subjects: all });
  }
);

// ---------------------------------------------------------------
// PATCH /api/subjects/:subject_id/toggle
// FR-A3: Sekolah lepas centang / centang ulang mapel template.
//        Mapel manual bisa juga di-toggle.
// ---------------------------------------------------------------
router.patch(
  '/:subject_id/toggle',
  requireRole('sekolah', 'admin'),
  (req: AuthRequest, res: Response) => {
    const subjectId = String(req.params.subject_id);
    const subject = db.subjects.get(subjectId);
    if (!subject) {
      res.status(404).json({ success: false, message: 'Mapel tidak ditemukan.' });
      return;
    }
    if (!canManage(req, subject.school_id)) {
      res.status(403).json({ success: false, message: 'Akses ditolak.' });
      return;
    }

    subject.is_active = !subject.is_active;
    db.subjects.set(subjectId, subject);
    persistSubject(subject);

    res.json({ success: true, subject });
  }
);

// ---------------------------------------------------------------
// POST /api/subjects/school/:school_id/custom
// FR-A3: Sekolah tambah mapel manual (tidak ada di template).
//        Tersimpan tanpa mengubah template bawaan.
// Body: { nama: string }
// ---------------------------------------------------------------
router.post(
  '/school/:school_id/custom',
  requireRole('sekolah', 'admin'),
  (req: AuthRequest, res: Response) => {
    const schoolId = String(req.params.school_id);
    if (!canManage(req, schoolId)) {
      res.status(403).json({ success: false, message: 'Akses ditolak.' });
      return;
    }

    const { nama } = req.body as { nama?: string };
    if (!nama || !nama.trim()) {
      res.status(400).json({ success: false, message: 'nama wajib diisi.' });
      return;
    }

    const namaTrim = nama.trim();

    // Cegah duplikat nama di sekolah yang sama
    const dupe = [...db.subjects.values()].find(
      (s) => s.school_id === schoolId && s.nama.toLowerCase() === namaTrim.toLowerCase()
    );
    if (dupe) {
      res.status(409).json({ success: false, message: 'Mapel dengan nama ini sudah ada.' });
      return;
    }

    const subj: Subject = {
      id: `subj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      school_id: schoolId,
      nama: namaTrim,
      is_custom: true,
      is_active: true,
    };
    db.subjects.set(subj.id, subj);
    persistSubject(subj);

    res.status(201).json({ success: true, subject: subj });
  }
);

// ---------------------------------------------------------------
// GET /api/subjects/school/:school_id/teacher/:user_id
// FR-A3: Lihat pilihan mapel guru di sekolah ini.
//        Guru lihat miliknya. Sekolah & Admin lihat milik siapa saja.
// ---------------------------------------------------------------
router.get('/school/:school_id/teacher/:user_id', (req: AuthRequest, res: Response) => {
  const schoolId = String(req.params.school_id);
  const targetUserId = String(req.params.user_id);
  const requesterId = req.user!.userId;
  const role = req.user!.role;

  // Guru hanya bisa lihat miliknya sendiri
  if (role === 'guru' && requesterId !== targetUserId) {
    res.status(403).json({ success: false, message: 'Akses ditolak.' });
    return;
  }
  if (role === 'murid' || role === 'pengguna') {
    res.status(403).json({ success: false, message: 'Akses ditolak.' });
    return;
  }

  const teacherSubjects = [...db.teacherSubjects.values()].filter(
    (ts) => ts.user_id === targetUserId && ts.school_id === schoolId
  );

  // Enrich dengan nama mapel
  const enriched = teacherSubjects.map((ts) => ({
    ...ts,
    subject: db.subjects.get(ts.subject_id) || null,
  }));

  res.json({ success: true, teacher_subjects: enriched });
});

// ---------------------------------------------------------------
// POST /api/subjects/school/:school_id/teacher
// FR-A3: Guru pilih mapel yang dia ajar. Sekolah & Admin bisa set
//        untuk guru mana pun di sekolahnya.
// Body: { user_id?: string, subject_ids: string[] }
// user_id diisi Sekolah/Admin. Guru otomatis pakai userId sendiri.
// ---------------------------------------------------------------
router.post('/school/:school_id/teacher', requireRole('guru', 'sekolah', 'admin'), (req: AuthRequest, res: Response) => {
  const schoolId = String(req.params.school_id);
  const requesterId = req.user!.userId;
  const role = req.user!.role;

  let targetUserId: string;
  if (role === 'guru') {
    targetUserId = requesterId;
  } else {
    targetUserId = String(req.body.user_id || '');
    if (!targetUserId) {
      res.status(400).json({ success: false, message: 'user_id wajib diisi.' });
      return;
    }
  }

  // Guru: wajib anggota aktif sekolah
  if (role === 'guru') {
    const membership = [...db.schoolMemberships.values()].find(
      (m) => m.user_id === targetUserId && m.school_id === schoolId && m.status === 'aktif'
    );
    if (!membership) {
      res.status(403).json({ success: false, message: 'Guru belum aktif di sekolah ini.' });
      return;
    }
  } else if (!canManage(req, schoolId)) {
    res.status(403).json({ success: false, message: 'Akses ditolak.' });
    return;
  }

  const { subject_ids } = req.body as { subject_ids?: string[] };
  if (!Array.isArray(subject_ids)) {
    res.status(400).json({ success: false, message: 'subject_ids harus array.' });
    return;
  }

  // Validasi semua subject_id milik sekolah ini dan aktif
  for (const sid of subject_ids) {
    const s = db.subjects.get(sid);
    if (!s || s.school_id !== schoolId || !s.is_active) {
      res.status(400).json({ success: false, message: `Mapel ${sid} tidak valid untuk sekolah ini.` });
      return;
    }
  }

  // Hapus pilihan lama guru di sekolah ini
  for (const [id, ts] of db.teacherSubjects.entries()) {
    if (ts.user_id === targetUserId && ts.school_id === schoolId) {
      db.teacherSubjects.delete(id);
    }
  }

  // Simpan pilihan baru
  const saved: TeacherSubject[] = [];
  for (const sid of subject_ids) {
    const ts: TeacherSubject = {
      id: `ts_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      user_id: targetUserId,
      school_id: schoolId,
      subject_id: sid,
    };
    db.teacherSubjects.set(ts.id, ts);
    persistTeacherSubject(ts);
    saved.push(ts);
  }

  res.status(201).json({ success: true, teacher_subjects: saved });
});

export default router;
