import { Router, Response } from 'express';
import { db } from '../db/store.js';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth.js';
import { AccessCode, AuditLog } from '../types/index.js';
import { generateRandomCode, getNextMondayWib } from '../utils/codes.js';
import { persistAccessCode, persistAuditLog } from '../db/postgres.js';

const router = Router();
router.use(authMiddleware);

function auditEntry(actor_id: string, action: string, target_type: string, target_id: string, details?: Record<string, any>): AuditLog {
  return {
    id: 'aud_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    actor_id,
    action,
    target_type,
    target_id,
    details,
    timestamp: new Date().toISOString(),
  };
}

// Pastikan kode tidak bentrok dengan yang sudah aktif
function newUniqueCode(): string {
  let code: string;
  let tries = 0;
  do {
    code = generateRandomCode(8);
    tries++;
  } while ([...db.accessCodes.values()].some((c) => c.code === code && c.is_active) && tries < 20);
  return code;
}

// Cek apakah user adalah Sekolah yang memiliki school_id ini
function isOwnerSekolah(userId: string, schoolId: string): boolean {
  // Akun Sekolah ditandai dengan schoolConfig yang user_id-nya cocok
  const cfg = db.schoolConfigs.get(schoolId);
  return cfg?.id === schoolId && db.users.get(userId)?.role === 'sekolah'
    // ponytail: schoolConfig belum punya owner_user_id — tambah field itu saat FR-A3 diimplementasi
    // fallback sementara: cek apakah user role sekolah punya school_membership 'aktif' di sana
    || [...db.schoolMemberships.values()].some(
        (m) => m.user_id === userId && m.school_id === schoolId && m.role === 'murid' && false // selalu false: Sekolah tidak masuk via kode, dibuat Admin
      );
}

// Verifikasi akses: Admin boleh semua sekolah. Sekolah hanya sekolahnya (via schoolConfigs owner).
// ponytail: schoolConfig.owner_user_id belum ada — saat ini semua role 'sekolah' bisa kelola semua sekolah.
//           Tambah owner_user_id ke SchoolConfig & schoolConfigs saat FR-A3.
function canManageSchool(req: AuthRequest, schoolId: string): boolean {
  const role = req.user!.role;
  if (role === 'admin') return true;
  if (role === 'sekolah') {
    const cfg = db.schoolConfigs.get(schoolId);
    return Boolean(cfg && cfg.owner_user_id === req.user!.userId);
  }
  return false;
}

// POST /api/codes/school — FR-A4 (P0)
// Buat kode sekolah untuk murid atau guru
router.post('/school', requireRole('sekolah', 'admin'), (req: AuthRequest, res: Response) => {
  const { school_id, scope } = req.body as { school_id: string; scope: 'school_student' | 'school_teacher' };

  if (!school_id || !scope) {
    res.status(400).json({ success: false, message: 'school_id dan scope wajib diisi.' });
    return;
  }
  if (scope !== 'school_student' && scope !== 'school_teacher') {
    res.status(400).json({ success: false, message: 'scope harus school_student atau school_teacher.' });
    return;
  }
  if (!canManageSchool(req, school_id)) {
    res.status(403).json({ success: false, message: 'Akses ditolak.' });
    return;
  }

  // Nonaktifkan kode lama dengan scope yang sama
  for (const c of db.accessCodes.values()) {
    if (c.target_id === school_id && c.scope === scope && c.is_active) {
      c.is_active = false;
      db.accessCodes.set(c.id, c);
      persistAccessCode(c);
    }
  }

  const now = new Date();
  const code: AccessCode = {
    id: `ac_${Date.now()}`,
    scope,
    target_id: school_id,
    code: newUniqueCode(),
    valid_from: now.toISOString(),
    valid_until: getNextMondayWib(now).toISOString(),
    is_active: true,
  };
  db.accessCodes.set(code.id, code);
  persistAccessCode(code);

  const log = auditEntry(req.user!.userId, 'create_code', 'access_code', code.id, { school_id, scope });
  db.auditLog.set(log.id, log);
  persistAuditLog(log);

  res.status(201).json({ success: true, code });
});

// POST /api/codes/class — FR-A4 (P0)
// Buat kode kelas
router.post('/class', requireRole('sekolah', 'admin'), (req: AuthRequest, res: Response) => {
  const { class_id } = req.body as { class_id: string };

  if (!class_id) {
    res.status(400).json({ success: false, message: 'class_id wajib diisi.' });
    return;
  }

  const kelas = db.classes.get(class_id);
  if (!kelas) {
    res.status(404).json({ success: false, message: 'Kelas tidak ditemukan.' });
    return;
  }

  if (!canManageSchool(req, kelas.school_id)) {
    res.status(403).json({ success: false, message: 'Akses ditolak.' });
    return;
  }

  // Nonaktifkan kode kelas lama
  for (const c of db.accessCodes.values()) {
    if (c.target_id === class_id && c.scope === 'class' && c.is_active) {
      c.is_active = false;
      db.accessCodes.set(c.id, c);
      persistAccessCode(c);
    }
  }

  const now = new Date();
  const code: AccessCode = {
    id: `ac_${Date.now()}`,
    scope: 'class',
    target_id: class_id,
    code: newUniqueCode(),
    valid_from: now.toISOString(),
    valid_until: getNextMondayWib(now).toISOString(),
    is_active: true,
  };
  db.accessCodes.set(code.id, code);
  persistAccessCode(code);

  const log = auditEntry(req.user!.userId, 'create_code', 'access_code', code.id, { class_id, school_id: kelas.school_id });
  db.auditLog.set(log.id, log);
  persistAuditLog(log);

  res.status(201).json({ success: true, code });
});

// GET /api/codes/school/:school_id — FR-A7: lihat kode aktif sekolah
router.get('/school/:school_id', requireRole('sekolah', 'admin'), (req: AuthRequest, res: Response) => {
  const school_id = String(req.params.school_id);

  if (!canManageSchool(req, school_id)) {
    res.status(403).json({ success: false, message: 'Akses ditolak.' });
    return;
  }

  const codes = [...db.accessCodes.values()].filter(
    (c) => c.target_id === school_id && c.is_active &&
      (c.scope === 'school_student' || c.scope === 'school_teacher')
  );

  res.json({ success: true, codes });
});

// GET /api/codes/class/:class_id — lihat kode aktif kelas
router.get('/class/:class_id', requireRole('sekolah', 'admin'), (req: AuthRequest, res: Response) => {
  const class_id = String(req.params.class_id);

  const kelas = db.classes.get(class_id);
  if (!kelas) {
    res.status(404).json({ success: false, message: 'Kelas tidak ditemukan.' });
    return;
  }

  if (!canManageSchool(req, kelas.school_id)) {
    res.status(403).json({ success: false, message: 'Akses ditolak.' });
    return;
  }

  const code = [...db.accessCodes.values()].find(
    (c) => c.target_id === class_id && c.scope === 'class' && c.is_active
  );

  res.json({ success: true, code: code || null });
});

// POST /api/codes/rotate/:code_id — FR-A7: ganti manual kode yang bocor
router.post('/rotate/:code_id', requireRole('sekolah', 'admin'), (req: AuthRequest, res: Response) => {
  const code_id = String(req.params.code_id);

  const existing = db.accessCodes.get(code_id);
  if (!existing || !existing.is_active) {
    res.status(404).json({ success: false, message: 'Kode tidak ditemukan atau sudah tidak aktif.' });
    return;
  }

  // Verifikasi kepemilikan: untuk scope class, cek via kelas → sekolah
  let schoolId: string;
  if (existing.scope === 'class') {
    const kelas = db.classes.get(existing.target_id);
    if (!kelas) {
      res.status(404).json({ success: false, message: 'Kelas tidak ditemukan.' });
      return;
    }
    schoolId = kelas.school_id;
  } else {
    schoolId = existing.target_id;
  }

  if (!canManageSchool(req, schoolId)) {
    res.status(403).json({ success: false, message: 'Akses ditolak.' });
    return;
  }

  // Nonaktifkan lama
  existing.is_active = false;
  db.accessCodes.set(existing.id, existing);
  persistAccessCode(existing);

  // Buat baru dengan kode baru, valid_until tetap ikut jadwal rotasi
  const now = new Date();
  const newCode: AccessCode = {
    id: `ac_${Date.now()}`,
    scope: existing.scope,
    target_id: existing.target_id,
    code: newUniqueCode(),
    valid_from: now.toISOString(),
    valid_until: getNextMondayWib(now).toISOString(),
    is_active: true,
  };
  db.accessCodes.set(newCode.id, newCode);
  persistAccessCode(newCode);

  const log = auditEntry(req.user!.userId, 'rotate_code', 'access_code', newCode.id, {
    old_code_id: existing.id,
    scope: newCode.scope,
    target_id: newCode.target_id,
  });
  db.auditLog.set(log.id, log);
  persistAuditLog(log);

  res.status(201).json({ success: true, code: newCode });
});

export default router;
