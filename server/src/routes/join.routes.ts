import { Router, Response } from 'express';
import { db } from '../db/store.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { SchoolMembership, ClassMembership, AuditLog } from '../types/index.js';
import { persistSchoolMembership, persistClassMembership, persistAuditLog } from '../db/postgres.js';

const router = Router();
router.use(authMiddleware);

function auditEntry(actor_id: string, action: string, target_type: string, target_id: string, details?: Record<string, any>): AuditLog {
  return {
    id: 'aud_' + Date.now(),
    actor_id,
    action,
    target_type,
    target_id,
    details,
    timestamp: new Date().toISOString(),
  };
}

// POST /api/join/school — FR-A2 (P0)
router.post('/school', (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const { code } = req.body;

  if (!code) {
    res.status(400).json({ success: false, message: 'Kode wajib diisi.' });
    return;
  }

  const cleanCode = String(code).trim();
  const now = Date.now();

  // 1. Cek kode akses (8 karakter acak)
  const accessCode = [...db.accessCodes.values()].find(
    (ac) =>
      ac.code.toUpperCase() === cleanCode.toUpperCase() &&
      ac.is_active &&
      (ac.scope === 'school_student' || ac.scope === 'school_teacher') &&
      new Date(ac.valid_until).getTime() > now,
  );

  let schoolId: string | null = null;
  let isStudent = true;
  let codeScope = 'school_student';

  if (accessCode) {
    schoolId = accessCode.target_id;
    isStudent = accessCode.scope === 'school_student';
    codeScope = accessCode.scope;
  } else {
    // 2. Cek apakah cocok dengan kode/ID sekolah resmi yang ada di home (school.id)
    const school =
      db.schools.get(cleanCode) ||
      [...db.schools.values()].find(
        (s) => s.id.toLowerCase() === cleanCode.toLowerCase()
      );

    if (school) {
      schoolId = school.id;
      isStudent = req.user!.role !== 'guru';
      codeScope = isStudent ? 'school_student' : 'school_teacher';
    }
  }

  if (!schoolId) {
    res.status(404).json({ success: false, message: 'Kode tidak valid atau sudah kedaluwarsa.' });
    return;
  }

  // Cegah duplikasi / spam keanggotaan sekolah untuk user yang sama
  const existingAny = [...db.schoolMemberships.values()].find(
    (m) => m.user_id === userId && m.school_id === schoolId,
  );

  if (existingAny) {
    if (existingAny.status === 'aktif') {
      res.status(409).json({ success: false, message: 'Sudah menjadi anggota aktif sekolah ini.' });
      return;
    }
    if (existingAny.status === 'pending') {
      res.status(409).json({
        success: false,
        message: 'Permintaan bergabung sedang menunggu persetujuan sekolah. Tidak perlu mendaftar ulang.',
      });
      return;
    }
  }

  // ponytail: schoolConfigs mungkin kosong — fallback auto_approve_teacher: false
  const schoolConfig = db.schoolConfigs.get(schoolId);
  const autoApprove = schoolConfig?.auto_approve_teacher ?? false;

  const memberRole = isStudent ? 'murid' : 'guru';
  const memberStatus = isStudent ? 'aktif' : (autoApprove ? 'aktif' : 'pending');

  // Pakai ulang ID jika sebelumnya berstatus keluar/dikeluarkan agar 1 user = 1 baris
  const membershipId = existingAny ? existingAny.id : `sm_${Date.now()}`;
  const membership: SchoolMembership = {
    id: membershipId,
    user_id: userId,
    school_id: schoolId,
    role: memberRole,
    status: memberStatus,
    joined_at: new Date().toISOString(),
    left_at: undefined,
  };

  db.schoolMemberships.set(membership.id, membership);
  persistSchoolMembership(membership);

  // Update user.role jika membership aktif (KECUALI Admin agar tidak turun jadi murid/pelajar)
  if (memberStatus === 'aktif') {
    const user = db.users.get(userId);
    if (user && user.role !== 'admin') {
      user.role = memberRole;
      user.updated_at = new Date().toISOString();
      db.users.set(userId, user);
    }
  }

  const log = auditEntry(userId, 'join_school', 'school_membership', membership.id, {
    school_id: schoolId,
    scope: codeScope,
    status: memberStatus,
  });
  db.auditLog.set(log.id, log);

  const targetSchool = db.schools.get(schoolId);

  res.status(201).json({
    success: true,
    membership,
    school_id: schoolId,
    school_name: targetSchool?.nama || 'Sekolah',
  });
});

// POST /api/join/class — FR-A2 (P0)
router.post('/class', (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const userRole = req.user!.role;
  const { code } = req.body;

  if (!code) {
    res.status(400).json({ success: false, message: 'Kode wajib diisi.' });
    return;
  }

  const cleanCode = String(code).trim();
  const now = Date.now();

  // 1. Cek accessCode untuk kelas
  const accessCode = [...db.accessCodes.values()].find(
    (ac) =>
      ac.scope === 'class' &&
      ac.code.toUpperCase() === cleanCode.toUpperCase() &&
      ac.is_active &&
      new Date(ac.valid_until).getTime() > now,
  );

  let classId: string | null = null;
  if (accessCode) {
    classId = accessCode.target_id;
  } else {
    // 2. Cek apakah cocok langsung dengan ID kelas
    const directClass =
      db.classes.get(cleanCode) ||
      [...db.classes.values()].find(
        (c) => c.id.toLowerCase() === cleanCode.toLowerCase()
      );
    if (directClass) {
      classId = directClass.id;
    }
  }

  if (!classId) {
    res.status(404).json({ success: false, message: 'Kode tidak valid atau sudah kedaluwarsa.' });
    return;
  }

  const kelas = db.classes.get(classId);
  if (!kelas) {
    res.status(404).json({ success: false, message: 'Kelas tidak ditemukan.' });
    return;
  }

  const schoolId = kelas.school_id;

  // Cek school_membership aktif
  const schoolMembership = [...db.schoolMemberships.values()].find(
    (m) => m.user_id === userId && m.school_id === schoolId,
  );

  if (!schoolMembership || schoolMembership.status !== 'aktif') {
    if (schoolMembership?.status === 'pending') {
      res.status(403).json({ success: false, message: 'Menunggu persetujuan sekolah.' });
    } else {
      res.status(403).json({ success: false, message: 'Bergabung ke sekolah dulu sebelum masuk kelas.' });
    }
    return;
  }

  // Murid: hanya boleh satu kelas aktif
  if (userRole === 'murid') {
    const activeClassMembership = [...db.classMemberships.values()].find(
      (m) => m.user_id === userId && m.status === 'aktif',
    );
    if (activeClassMembership) {
      res.status(409).json({
        success: false,
        message: 'Murid hanya boleh di satu kelas aktif. Keluar dulu dari kelas lama.',
      });
      return;
    }
  }

  // Cari period aktif untuk kelas ini
  const period = [...db.periods.values()].find(
    (p) => p.class_id === classId && p.is_active,
  );
  if (!period) {
    res.status(404).json({ success: false, message: 'Tidak ada periode aktif untuk kelas ini.' });
    return;
  }

  // Cek dissolution schedule terjadwal untuk sekolah ini
  const dissolutionActive = [...db.dissolutionSchedules.values()].find(
    (d) => d.school_id === schoolId && d.status === 'terjadwal',
  );
  if (dissolutionActive) {
    res.status(403).json({
      success: false,
      message: 'Kelas sedang dalam masa tunggu pembubaran. Pendaftar baru tidak dapat masuk.',
    });
    return;
  }

  const memberRole = userRole === 'guru' ? 'guru' : 'murid';

  const membership: ClassMembership = {
    id: `cm_${Date.now()}`,
    user_id: userId,
    class_id: classId,
    period_id: period.id,
    role: memberRole,
    status: 'aktif',
    joined_at: new Date().toISOString(),
  };

  db.classMemberships.set(membership.id, membership);
  persistClassMembership(membership);

  const log = auditEntry(userId, 'join_class', 'class_membership', membership.id, {
    class_id: classId,
    school_id: schoolId,
    period_id: period.id,
  });
  db.auditLog.set(log.id, log);
  persistAuditLog(log);

  res.status(201).json({
    success: true,
    membership,
    class_id: kelas.id,
    class_name: kelas.nama,
    tingkat: kelas.tingkat,
    school_id: kelas.school_id,
  });
});

export default router;
