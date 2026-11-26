/**
 * School Dashboard Routes — akun 'sekolah' mengelola sekolahnya sendiri.
 * FR-A2, FR-A4, FR-A7
 *
 * POST /api/school-dashboard/claim      — tautkan akun sekolah ke school_id
 * GET  /api/school-dashboard/me         — info sekolah + kode aktif + kelas + pending guru
 * POST /api/school-dashboard/classes    — buat kelas baru
 * PATCH /api/school-dashboard/settings  — ubah auto_approve_teacher
 */

import { Router, Response } from 'express';
import { db } from '../db/store.js';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth.js';
import { SchoolClass, ClassPeriod, AuditLog } from '../types/index.js';
import { generateRandomCode, getNextMondayWib } from '../utils/codes.js';
import { persistClass, persistPeriod, persistAccessCode, persistAuditLog, persistSchoolMembership } from '../db/postgres.js';
import bcrypt from 'bcryptjs';

const router = Router();
router.use(authMiddleware, requireRole('sekolah', 'admin'));

function auditEntry(actor_id: string, action: string, target_type: string, target_id: string, details?: Record<string, any>): AuditLog {
  return {
    id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    actor_id,
    action,
    target_type,
    target_id,
    details,
    timestamp: new Date().toISOString(),
  };
}

/** Ambil SchoolConfig yang dimiliki akun ini, atau null. */
function getOwnedSchool(userId: string, role: string) {
  if (role === 'admin') return null; // admin tidak punya 'sekolah milik'
  for (const cfg of db.schoolConfigs.values()) {
    if (cfg.owner_user_id === userId) return cfg;
  }
  return null;
}

// ---------------------------------------------------------------------------
// POST /api/school-dashboard/claim
// Akun 'sekolah' yang belum punya sekolah mengklaim school_id dari schools DB.
// Admin juga bisa claim (untuk setup awal).
// ---------------------------------------------------------------------------
router.post('/claim', (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const role = req.user!.role;
  const { school_id } = req.body as { school_id?: string };

  if (!school_id) {
    res.status(400).json({ success: false, message: 'school_id wajib diisi.' });
    return;
  }

  const cleanId = String(school_id).trim();

  // Dukung jika user memasukkan kode akses sekolah (8 karakter) atau ID sekolah langsung
  let targetSchoolId = cleanId;
  const accessCode = [...db.accessCodes.values()].find(
    (ac) => ac.code.toUpperCase() === cleanId.toUpperCase()
  );
  if (accessCode) {
    targetSchoolId = accessCode.target_id;
  }

  const school =
    db.schools.get(targetSchoolId) ||
    [...db.schools.values()].find(
      (s) => s.id.toLowerCase() === targetSchoolId.toLowerCase()
    );

  if (!school) {
    res.status(404).json({ success: false, message: 'Sekolah tidak ditemukan.' });
    return;
  }

  const resolvedSchoolId = school.id;

  // Cek apakah sudah ada pemilik lain
  let cfg = db.schoolConfigs.get(resolvedSchoolId);
  if (cfg?.owner_user_id && cfg.owner_user_id !== userId) {
    res.status(409).json({ success: false, message: 'Sekolah ini sudah diklaim oleh akun lain.' });
    return;
  }

  if (!cfg) {
    // Buat SchoolConfig baru dari data sekolah yang sudah ada di schools DB
    cfg = {
      id: resolvedSchoolId,
      place_id: (school as any).place_id ?? resolvedSchoolId,
      nama: school.nama,
      jenjang: school.jenjang,
      status: school.status,
      alamat: school.alamat,
      lat: school.lat,
      lng: school.lng,
      kecamatan: school.kecamatan,
      kelurahan: school.kelurahan,
      kota_kab: school.kota_kab,
      provinsi: school.provinsi,
      auto_approve_teacher: false,
      owner_user_id: userId,
      created_at: new Date().toISOString(),
    };
  } else {
    cfg.owner_user_id = userId;
  }

  db.schoolConfigs.set(resolvedSchoolId, cfg);

  const log = auditEntry(userId, 'claim_school', 'school_config', resolvedSchoolId, { school_id: resolvedSchoolId, role });
  db.auditLog.set(log.id, log);
  persistAuditLog(log);

  if (role !== 'admin') {
    res.json({ success: true, message: 'Sekolah berhasil diklaim.', school_id: resolvedSchoolId });
  } else {
    res.json({ success: true, message: `Sekolah berhasil dikaitkan ke akun ${userId}.`, school_id: resolvedSchoolId });
  }
});

// ---------------------------------------------------------------------------
// GET /api/school-dashboard/me
// Akun 'sekolah' melihat data sekolah, kode aktif, kelas, dan guru pending.
// Admin dapat melihat spesifik sekolah via query param ?school_id=...
// ---------------------------------------------------------------------------
router.get('/me', (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const role = req.user!.role;
  const querySchoolId = req.query.school_id as string | undefined;

  let schoolId: string | null = null;
  let schoolName: string = '';
  let schoolJenjang: string = '';
  let autoApprove = false;

  if (role === 'admin' && querySchoolId) {
    const s = db.schools.get(querySchoolId);
    if (!s) {
      res.status(404).json({ success: false, message: 'Sekolah tidak ditemukan.' });
      return;
    }
    schoolId = s.id;
    schoolName = s.nama;
    schoolJenjang = s.jenjang;
    const existingCfg = db.schoolConfigs.get(s.id);
    autoApprove = existingCfg?.auto_approve_teacher ?? false;
  } else {
    const cfg = getOwnedSchool(userId, role);
    if (!cfg) {
      res.status(404).json({ success: false, message: 'Belum ada sekolah yang dikaitkan ke akun ini. Lakukan klaim terlebih dahulu.' });
      return;
    }
    schoolId = cfg.id;
    schoolName = cfg.nama;
    schoolJenjang = cfg.jenjang;
    autoApprove = cfg.auto_approve_teacher ?? false;
  }

  // Kode aktif sekolah (murid + guru)
  const schoolCodes = [...db.accessCodes.values()].filter(
    (c) => c.target_id === schoolId && c.is_active &&
      (c.scope === 'school_student' || c.scope === 'school_teacher')
  );

  // Daftar kelas
  const classes = [...db.classes.values()]
    .filter((c) => c.school_id === schoolId)
    .map((c) => {
      const classCode = [...db.accessCodes.values()].find(
        (ac) => ac.target_id === c.id && ac.scope === 'class' && ac.is_active
      );
      return {
        id: c.id,
        nama: c.nama,
        tingkat: c.tingkat,
        created_at: c.created_at,
        kode_kelas: classCode ? { id: classCode.id, code: classCode.code, valid_until: classCode.valid_until } : null,
      };
    });

  // Guru pending approval (deduplikasi per user_id agar orang yang sama hanya muncul sekali)
  const seenPendingUserIds = new Set<string>();
  const pendingGuru: Array<{ membership_id: string; user_id: string; nama: string; email: string; joined_at: string }> = [];
  for (const m of db.schoolMemberships.values()) {
    if (m.school_id === schoolId && m.role === 'guru' && m.status === 'pending') {
      if (seenPendingUserIds.has(m.user_id)) continue;
      seenPendingUserIds.add(m.user_id);
      const u = db.users.get(m.user_id);
      pendingGuru.push({
        membership_id: m.id,
        user_id: m.user_id,
        nama: u?.nama ?? '?',
        email: u?.email ?? '?',
        joined_at: m.joined_at,
      });
    }
  }

  res.json({
    success: true,
    school: {
      id: schoolId,
      nama: schoolName,
      jenjang: schoolJenjang,
      auto_approve_teacher: autoApprove,
    },
    codes: schoolCodes.map((c) => ({ id: c.id, scope: c.scope, code: c.code, valid_until: c.valid_until })),
    classes,
    pending_guru: pendingGuru,
  });
});

// ---------------------------------------------------------------------------
// POST /api/school-dashboard/classes — buat kelas baru untuk sekolah ini
// ---------------------------------------------------------------------------
router.post('/classes', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const role = req.user!.role;
  let targetSchoolId: string | null = null;

  if (role === 'admin') {
    targetSchoolId = (req.body as any).school_id || null;
    if (!targetSchoolId) {
      // Fallback: jika admin belum kirim school_id, pakai sekolah pertama di db
      const firstSchool = [...db.schools.values()][0];
      if (firstSchool) targetSchoolId = firstSchool.id;
    }
  } else {
    const cfg = getOwnedSchool(userId, role);
    if (!cfg) {
      res.status(403).json({ success: false, message: 'Akun belum dikaitkan ke sekolah.' });
      return;
    }
    targetSchoolId = cfg.id;
  }

  if (!targetSchoolId) {
    res.status(400).json({ success: false, message: 'ID Sekolah tidak ditemukan.' });
    return;
  }

  const { nama, tingkat } = req.body as { nama?: string; tingkat?: string | number };
  if (!nama || !tingkat) {
    res.status(400).json({ success: false, message: 'nama dan tingkat wajib diisi.' });
    return;
  }

  const kelas: SchoolClass = {
    id: `cls_${Date.now()}`,
    school_id: targetSchoolId,
    nama: nama.trim(),
    tingkat,
    created_at: new Date().toISOString(),
  };
  db.classes.set(kelas.id, kelas);
  await persistClass(kelas);

  // Buat period aktif otomatis
  const period: ClassPeriod = {
    id: `prd_${Date.now()}`,
    class_id: kelas.id,
    start_date: new Date().toISOString(),
    is_active: true,
  };
  db.periods.set(period.id, period);
  await persistPeriod(period);

  // Auto-generate kode kelas
  let code: string;
  let tries = 0;
  do {
    code = generateRandomCode(8);
    tries++;
  } while ([...db.accessCodes.values()].some((c) => c.code === code && c.is_active) && tries < 20);

  const now = new Date();
  const accessCode = {
    id: `ac_${Date.now()}`,
    scope: 'class' as const,
    target_id: kelas.id,
    code,
    valid_from: now.toISOString(),
    valid_until: getNextMondayWib(now).toISOString(),
    is_active: true,
  };
  db.accessCodes.set(accessCode.id, accessCode);
  await persistAccessCode(accessCode);

  const log = auditEntry(userId, 'create_class', 'class', kelas.id, { school_id: targetSchoolId, nama, tingkat });
  db.auditLog.set(log.id, log);
  await persistAuditLog(log);

  res.status(201).json({
    success: true,
    class: { ...kelas, kode_kelas: { id: accessCode.id, code: accessCode.code, valid_until: accessCode.valid_until } },
    period,
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/school-dashboard/settings
// ---------------------------------------------------------------------------
router.patch('/settings', (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const role = req.user!.role;
  const { auto_approve_teacher, school_id } = req.body as { auto_approve_teacher?: boolean; school_id?: string };

  let cfg: any = null;
  if (role === 'admin' && school_id) {
    let sCfg = db.schoolConfigs.get(school_id);
    if (!sCfg) {
      const sch = db.schools.get(school_id);
      if (sch) {
        sCfg = {
          ...sch,
          owner_user_id: userId,
          auto_approve_teacher: false,
          created_at: new Date().toISOString(),
        } as any;
        db.schoolConfigs.set(sch.id, sCfg!);
      }
    }
    cfg = sCfg;
  } else {
    cfg = getOwnedSchool(userId, role);
  }

  if (!cfg) {
    res.status(403).json({ success: false, message: 'Akun belum dikaitkan ke sekolah.' });
    return;
  }

  if (typeof auto_approve_teacher === 'boolean') {
    cfg.auto_approve_teacher = auto_approve_teacher;
    db.schoolConfigs.set(cfg.id, cfg);
  }

  res.json({ success: true, auto_approve_teacher: cfg.auto_approve_teacher });
});

// ---------------------------------------------------------------------------
// PATCH /api/school-dashboard/guru/:membership_id/approve — setujui guru pending
// ---------------------------------------------------------------------------
router.patch('/guru/:membership_id/approve', (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const role = req.user!.role;

  const membershipId = String(req.params.membership_id);
  const membership = db.schoolMemberships.get(membershipId);

  if (!membership) {
    res.status(404).json({ success: false, message: 'Keanggotaan tidak ditemukan.' });
    return;
  }

  if (role !== 'admin') {
    const cfg = getOwnedSchool(userId, role);
    if (!cfg || membership.school_id !== cfg.id) {
      res.status(403).json({ success: false, message: 'Anda tidak memiliki hak akses untuk sekolah ini.' });
      return;
    }
  }

  if (membership.status !== 'pending') {
    res.status(400).json({ success: false, message: 'Keanggotaan sudah diproses.' });
    return;
  }

  // Setujui dan bersihkan semua record pending untuk user ini di sekolah ini
  for (const m of db.schoolMemberships.values()) {
    if (m.user_id === membership.user_id && m.school_id === membership.school_id && m.status === 'pending') {
      m.status = 'aktif';
      db.schoolMemberships.set(m.id, m);
      persistSchoolMembership(m);
    }
  }

  // Update user.role ke 'guru'
  const u = db.users.get(membership.user_id);
  if (u) {
    u.role = 'guru';
    u.updated_at = new Date().toISOString();
    db.users.set(u.id, u);
  }

  const log = auditEntry(userId, 'approve_guru', 'school_membership', membershipId, { school_id: membership.school_id });
  db.auditLog.set(log.id, log);
  persistAuditLog(log);

  res.json({ success: true, message: 'Guru disetujui.' });
});

// ---------------------------------------------------------------------------
// POST /api/school-dashboard/reset-password — FR-A16 (P1)
// Akun Sekolah mereset password sementara untuk Guru/Murid aktif di sekolahnya
// ---------------------------------------------------------------------------
router.post('/reset-password', (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const cfg = getOwnedSchool(userId, req.user!.role);
  if (!cfg) {
    res.status(403).json({ success: false, message: 'Akun belum dikaitkan ke sekolah.' });
    return;
  }

  const { target_user_id } = req.body as { target_user_id?: string };
  if (!target_user_id) {
    res.status(400).json({ success: false, message: 'target_user_id wajib diisi.' });
    return;
  }

  // Pastikan target adalah anggota aktif sekolah ini
  const membership = [...db.schoolMemberships.values()].find(
    (m) => m.user_id === target_user_id && m.school_id === cfg.id && m.status === 'aktif'
  );
  if (!membership) {
    res.status(403).json({ success: false, message: 'Pengguna bukan anggota aktif sekolah ini.' });
    return;
  }

  const target = db.users.get(target_user_id);
  if (!target) {
    res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    return;
  }

  // Jaga: Sekolah tidak boleh reset Admin atau akun Sekolah lain
  if (target.role === 'admin' || target.role === 'sekolah') {
    res.status(403).json({ success: false, message: 'Tidak bisa mereset password akun Admin atau Sekolah.' });
    return;
  }

  const tempPassword = generateRandomCode(10);
  const salt = bcrypt.genSaltSync(10);
  target.password_hash = bcrypt.hashSync(tempPassword, salt);
  target.must_change_password = true;
  target.updated_at = new Date().toISOString();
  db.users.set(target.id, target);

  const log = auditEntry(userId, 'reset_password_delegasi', 'user', target_user_id, { school_id: cfg.id });
  db.auditLog.set(log.id, log);

  res.json({
    success: true,
    message: 'Password sementara berhasil dibuat. Pengguna wajib mengganti saat login berikutnya.',
    temp_password: tempPassword,
  });
});

export default router;
