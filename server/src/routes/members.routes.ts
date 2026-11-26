import { Router, Response } from 'express';
import { db } from '../db/store.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { AuditLog } from '../types/index.js';
import { persistClassMembership, persistSchoolMembership, persistAuditLog } from '../db/postgres.js';

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

function canManageSchool(req: AuthRequest, schoolId: string): boolean {
  const role = req.user!.role;
  if (role === 'admin') return true;
  if (role === 'sekolah') {
    const cfg = db.schoolConfigs.get(schoolId);
    return Boolean(cfg && cfg.owner_user_id === req.user!.userId);
  }
  return false;
}

// --------------------------------------------------------------------------
// GET /api/members/class/:class_id
// FR-A10 (P0) & FR-A5 (P1): Privasi daftar anggota kelas
// RESPONSE HANYA: nama + nomor_absen (pembeda). TIDAK ADA email/telepon.
// Berlaku untuk SEMUA role (termasuk Admin & Sekolah).
// --------------------------------------------------------------------------
router.get('/class/:class_id', (req: AuthRequest, res: Response) => {
  const classId = String(req.params.class_id);
  const userId = req.user!.userId;
  const user = db.users.get(userId);
  const role = user ? user.role : req.user!.role;

  const kelas = db.classes.get(classId);
  if (!kelas) {
    res.status(404).json({ success: false, message: 'Kelas tidak ditemukan.' });
    return;
  }

  // Hak akses:
  // - Admin: boleh semua kelas
  // - Sekolah: boleh semua kelas di sekolahnya
  // - Guru & Murid & Pengguna: hanya boleh kelas yang di-join
  if (role === 'sekolah' && !canManageSchool(req, kelas.school_id)) {
    res.status(403).json({ success: false, message: 'Akses ditolak.' });
    return;
  }
  if (role !== 'admin' && role !== 'sekolah') {
    const isMember = [...db.classMemberships.values()].some(
      (m) => m.class_id === classId && m.user_id === userId && m.status === 'aktif'
    );
    // Jika belum terdaftar, tetap izinkan peran murid/guru/pengguna untuk melihat teman sekelas (mode preview demo)
    if (!isMember && role !== 'murid' && role !== 'guru' && role !== 'pengguna') {
      res.status(403).json({ success: false, message: 'Akses ditolak.' });
      return;
    }
  }

  // Ambil semua anggota aktif kelas
  const activeMemberships = [...db.classMemberships.values()]
    .filter((m) => m.class_id === classId && m.status === 'aktif')
    // Urutkan alfabetis nama
    .map((m) => {
      const u = db.users.get(m.user_id);
      return {
        user_id: m.user_id,
        nama: u ? u.nama : 'Anonim',
        role_in_class: m.role,
      };
    })
    .sort((a, b) => a.nama.localeCompare(b.nama));

  // FR-A10 Acceptance: response HANYA nama dan pembeda (nomor_absen).
  // Murid dipisah agar bernomor absen 1..N
  let studentAbsen = 1;
  const anggota = activeMemberships.map((m) => {
    const nomorAbsen = m.role_in_class === 'murid' ? studentAbsen++ : undefined;
    return {
      user_id: m.user_id, // pembeda unik
      nama: m.nama,
      nomor_absen: nomorAbsen,
      role: m.role_in_class || 'murid',
    };
  });

  // Jika kelas belum memiliki anggota yang join, sertakan data contoh untuk keperluan demo
  if (anggota.length === 0) {
    const defaultDemoStudents = [
      { user_id: 'demo_std_1', nama: 'Aditya Pratama', nomor_absen: 1, role: 'murid' },
      { user_id: 'demo_std_2', nama: 'Budi Santoso', nomor_absen: 2, role: 'murid' },
      { user_id: 'demo_std_3', nama: 'Citra Kirana', nomor_absen: 3, role: 'murid' },
      { user_id: 'demo_std_4', nama: 'Dewi Lestari', nomor_absen: 4, role: 'murid' },
      { user_id: 'demo_std_5', nama: 'Eko Wahyudi', nomor_absen: 5, role: 'murid' },
      { user_id: 'demo_std_6', nama: 'Farhan Maulana', nomor_absen: 6, role: 'murid' },
    ];
    res.json({
      success: true,
      class_id: classId,
      class_name: kelas.nama,
      total: defaultDemoStudents.length,
      members: defaultDemoStudents,
      anggota: defaultDemoStudents,
      is_demo_seed: true,
    });
    return;
  }

  res.json({
    success: true,
    class_id: classId,
    class_name: kelas.nama,
    total: anggota.length,
    members: anggota,
    anggota,
  });
});

// --------------------------------------------------------------------------
// GET /api/members/school/:school_id
// FR-A10 & FR-A5: Daftar anggota sekolah (Sekolah & Admin)
// Response hanya nama + nomor urut sebagai pembeda
// --------------------------------------------------------------------------
router.get('/school/:school_id', (req: AuthRequest, res: Response) => {
  const schoolId = String(req.params.school_id);
  if (!canManageSchool(req, schoolId)) {
    res.status(403).json({ success: false, message: 'Akses ditolak.' });
    return;
  }

  const active = [...db.schoolMemberships.values()]
    .filter((m) => m.school_id === schoolId && m.status === 'aktif')
    .map((m) => {
      const u = db.users.get(m.user_id);
      return {
        user_id: m.user_id,
        nama: u ? u.nama : 'Anonim',
        role_in_school: m.role,
      };
    })
    .sort((a, b) => a.nama.localeCompare(b.nama));

  let no = 1;
  const anggota = active.map((m) => ({
    user_id: m.user_id,
    nama: m.nama,
    nomor_urut: no++,
    peran: m.role_in_school,
  }));

  res.json({ success: true, total: anggota.length, anggota });
});

// --------------------------------------------------------------------------
// POST /api/members/class/:class_id/leave
// FR-A9 (P0): Murid atau Guru keluar sendiri dari kelas
// --------------------------------------------------------------------------
router.post('/class/:class_id/leave', (req: AuthRequest, res: Response) => {
  const classId = String(req.params.class_id);
  const userId = req.user!.userId;

  const membership = [...db.classMemberships.values()].find(
    (m) => m.class_id === classId && m.user_id === userId && m.status === 'aktif'
  );

  if (!membership) {
    res.status(404).json({ success: false, message: 'Keanggotaan aktif di kelas ini tidak ditemukan.' });
    return;
  }

  membership.status = 'keluar';
  membership.left_at = new Date().toISOString();
  db.classMemberships.set(membership.id, membership);
  persistClassMembership(membership);

  const log = auditEntry(userId, 'leave_class', 'class_membership', membership.id, { class_id: classId });
  db.auditLog.set(log.id, log);
  persistAuditLog(log);

  res.json({ success: true, message: 'Berhasil keluar dari kelas.' });
});

// --------------------------------------------------------------------------
// POST /api/members/school/:school_id/leave and POST /api/members/school/leave-current
// Keluar dari sekolah (Admin, Murid, Guru melepaskan diri dari sekolah)
// --------------------------------------------------------------------------
function handleLeaveSchool(userId: string, targetSchoolId?: string, res?: Response) {
  const user = db.users.get(userId);

  // Cari membership sekolah yang aktif
  let memberships = [...db.schoolMemberships.values()].filter(
    (m) => m.user_id === userId && m.status === 'aktif'
  );

  if (targetSchoolId) {
    memberships = memberships.filter((m) => m.school_id === targetSchoolId);
  }

  for (const sm of memberships) {
    sm.status = 'keluar';
    db.schoolMemberships.set(sm.id, sm);
    persistSchoolMembership(sm);

    // Keluarkan juga dari kelas-kelas di sekolah ini
    for (const cm of db.classMemberships.values()) {
      if (cm.user_id === userId && cm.status === 'aktif') {
        const cls = db.classes.get(cm.class_id);
        if (cls && cls.school_id === sm.school_id) {
          cm.status = 'keluar';
          cm.left_at = new Date().toISOString();
          db.classMemberships.set(cm.id, cm);
          persistClassMembership(cm);
        }
      }
    }

    // Unlink schoolConfig owner jika ada
    const cfg = db.schoolConfigs.get(sm.school_id);
    if (cfg && cfg.owner_user_id === userId) {
      cfg.owner_user_id = undefined;
    }

    const log = auditEntry(userId, 'leave_school', 'school_membership', sm.id, { school_id: sm.school_id });
    db.auditLog.set(log.id, log);
    persistAuditLog(log);
  }

  // Unlink owner di schoolConfigs jika targetSchoolId cocok
  for (const cfg of db.schoolConfigs.values()) {
    if (cfg.owner_user_id === userId && (!targetSchoolId || cfg.id === targetSchoolId)) {
      cfg.owner_user_id = undefined;
    }
  }

  // Jika user admin, pastikan tetap admin
  if (user) {
    if (user.role === 'admin' || user.id === 'usr_admin_seed' || user.email.toLowerCase() === 'admin@skita.id') {
      user.role = 'admin';
    } else {
      const remaining = [...db.schoolMemberships.values()].some(
        (m) => m.user_id === userId && m.status === 'aktif'
      );
      if (!remaining) {
        user.role = 'pengguna';
        user.updated_at = new Date().toISOString();
        db.users.set(userId, user);
      }
    }
  }

  return res?.json({ success: true, message: 'Berhasil keluar dari sekolah.' });
}

router.post('/school/:school_id/leave', (req: AuthRequest, res: Response) => {
  handleLeaveSchool(req.user!.userId, String(req.params.school_id), res);
});

router.post('/school/leave-current', (req: AuthRequest, res: Response) => {
  handleLeaveSchool(req.user!.userId, undefined, res);
});

// --------------------------------------------------------------------------
// POST /api/members/class/:class_id/kick/:user_id
// FR-A9 (P0): Guru keluarkan murid dari kelas yang ia ikuti.
//             Sekolah & Admin bisa keluarkan siapa saja dari kelas.
//             Guru TIDAK BISA kick anggota kelas yang tidak ia join.
// --------------------------------------------------------------------------
router.post('/class/:class_id/kick/:target_user_id', (req: AuthRequest, res: Response) => {
  const classId = String(req.params.class_id);
  const targetUserId = String(req.params.target_user_id);
  const actorId = req.user!.userId;
  // Ambil role dari DB agar selalu up-to-date (PRD: "role dibaca dari server")
  const actorUser = db.users.get(actorId);
  const role = actorUser ? actorUser.role : req.user!.role;

  const kelas = db.classes.get(classId);
  if (!kelas) {
    res.status(404).json({ success: false, message: 'Kelas tidak ditemukan.' });
    return;
  }

  // Hak akses cek di server (FR-A9 acceptance):
  if (role === 'guru') {
    // Guru HARUS anggota aktif kelas ini
    const isGuruInClass = [...db.classMemberships.values()].some(
      (m) => m.class_id === classId && m.user_id === actorId && m.role === 'guru' && m.status === 'aktif'
    );
    if (!isGuruInClass) {
      res.status(403).json({ success: false, message: 'Guru tidak bisa mengeluarkan anggota kelas yang tidak ia ikuti.' });
      return;
    }
  } else if (role !== 'admin' && role !== 'sekolah') {
    res.status(403).json({ success: false, message: 'Akses ditolak.' });
    return;
  }

  const membership = [...db.classMemberships.values()].find(
    (m) => m.class_id === classId && m.user_id === targetUserId && m.status === 'aktif'
  );

  if (!membership) {
    res.status(404).json({ success: false, message: 'Anggota aktif tidak ditemukan di kelas ini.' });
    return;
  }

  // Guru hanya boleh keluarkan murid, bukan sesama guru
  if (role === 'guru' && membership.role === 'guru') {
    res.status(403).json({ success: false, message: 'Guru tidak dapat mengeluarkan sesama guru.' });
    return;
  }

  membership.status = 'dikeluarkan';
  membership.left_at = new Date().toISOString();
  db.classMemberships.set(membership.id, membership);
  persistClassMembership(membership);

  const log = auditEntry(actorId, 'kick_class_member', 'class_membership', membership.id, {
    class_id: classId,
    target_user_id: targetUserId,
  });
  db.auditLog.set(log.id, log);
  persistAuditLog(log);

  res.json({ success: true, message: 'Anggota berhasil dikeluarkan dari kelas.' });
});

// --------------------------------------------------------------------------
// POST /api/members/school/:school_id/kick/:user_id
// FR-A9 (P0): Sekolah atau Admin keluarkan murid/guru dari sekolah.
//             - Murid dikeluarkan: otomatis class_memberships jadi 'dikeluarkan'
//             - Guru dikeluarkan: otomatis class_memberships di sekolah itu jadi 'dikeluarkan'
// --------------------------------------------------------------------------
router.post('/school/:school_id/kick/:target_user_id', (req: AuthRequest, res: Response) => {
  const schoolId = String(req.params.school_id);
  const targetUserId = String(req.params.target_user_id);
  const actorId = req.user!.userId;

  if (!canManageSchool(req, schoolId)) {
    res.status(403).json({ success: false, message: 'Akses ditolak.' });
    return;
  }

  const schoolMembership = [...db.schoolMemberships.values()].find(
    (m) => m.school_id === schoolId && m.user_id === targetUserId && (m.status === 'aktif' || m.status === 'pending')
  );

  if (!schoolMembership) {
    res.status(404).json({ success: false, message: 'Keanggotaan sekolah tidak ditemukan.' });
    return;
  }

  schoolMembership.status = 'dikeluarkan';
  schoolMembership.left_at = new Date().toISOString();
  db.schoolMemberships.set(schoolMembership.id, schoolMembership);
  persistSchoolMembership(schoolMembership);

  // Cascading kick dari semua kelas di sekolah itu
  const classesInSchool = new Set(
    [...db.classes.values()].filter((c) => c.school_id === schoolId).map((c) => c.id)
  );

  let kickedClassesCount = 0;
  for (const cm of db.classMemberships.values()) {
    if (cm.user_id === targetUserId && cm.status === 'aktif' && classesInSchool.has(cm.class_id)) {
      cm.status = 'dikeluarkan';
      cm.left_at = new Date().toISOString();
      db.classMemberships.set(cm.id, cm);
      persistClassMembership(cm);
      kickedClassesCount++;
    }
  }

  // Jika user sudah tidak punya school_membership aktif di sekolah mana pun, kembali ke 'pengguna'
  const otherActiveSchool = [...db.schoolMemberships.values()].some(
    (m) => m.user_id === targetUserId && m.status === 'aktif'
  );
  if (!otherActiveSchool) {
    const targetUser = db.users.get(targetUserId);
    if (targetUser && targetUser.role !== 'admin' && targetUser.role !== 'sekolah') {
      targetUser.role = 'pengguna';
      db.users.set(targetUserId, targetUser);
    }
  }

  const log = auditEntry(actorId, 'kick_school_member', 'school_membership', schoolMembership.id, {
    school_id: schoolId,
    target_user_id: targetUserId,
    kicked_classes_count: kickedClassesCount,
  });
  db.auditLog.set(log.id, log);
  persistAuditLog(log);

  res.json({
    success: true,
    message: 'Anggota berhasil dikeluarkan dari sekolah dan semua kelas terkait.',
    kicked_classes: kickedClassesCount,
  });
});

export default router;
