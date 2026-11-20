import { Router, Response } from 'express';
import { db } from '../db/store.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// --------------------------------------------------------------------------
// GET /api/monitoring/scope — FR-A5 (P1)
// Cakupan monitoring berdasarkan keanggotaan server-side:
// Admin: semua sekolah & kelas
// Sekolah: semua kelas di sekolahnya
// Guru: kelas yang ia join, dikelompokkan per sekolah (FR-A6)
// Murid: kelas miliknya sendiri
// --------------------------------------------------------------------------
router.get('/scope', (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const user = db.users.get(userId);
  const role = user ? user.role : req.user!.role;

  if (role === 'admin') {
    // Sekolah yang memiliki anggota, kelas, atau diklaim oleh akun sekolah
    const schoolsWithMembers = new Set([
      ...[...db.schoolMemberships.values()].map((m) => m.school_id),
      ...[...db.classes.values()].map((c) => c.school_id),
      ...[...db.schoolConfigs.values()].map((sc) => sc.id),
    ]);

    let activeSchools = [...db.schools.values()]
      .filter((s) => schoolsWithMembers.has(s.id))
      .map((s) => ({
        id: s.id,
        nama: s.nama,
        jenjang: s.jenjang,
        member_count: [...db.schoolMemberships.values()].filter((m) => m.school_id === s.id).length,
        class_count: [...db.classes.values()].filter((c) => c.school_id === s.id).length,
      }));

    // Fallback jika belum ada sekolah dengan anggota/kelas: tampilkan semua sekolah
    if (activeSchools.length === 0) {
      activeSchools = [...db.schools.values()].map((s) => ({
        id: s.id,
        nama: s.nama,
        jenjang: s.jenjang,
        member_count: 0,
        class_count: 0,
      }));
    }

    const allClasses = [...db.classes.values()].map((c) => ({
      id: c.id,
      school_id: c.school_id,
      nama: c.nama,
      tingkat: c.tingkat,
    }));

    res.json({
      success: true,
      role: 'admin',
      school: activeSchools[0] || null,
      schools: activeSchools,
      classes: allClasses,
      scope: {
        schools: activeSchools,
        classes: allClasses,
      },
    });
    return;
  }

  if (role === 'sekolah') {
    // ponytail: scope by owner_user_id di masa depan
    // Sekolah melihat semua kelas di sekolahnya
    const allSchools = [...db.schools.values()].map((s) => ({
      id: s.id,
      nama: s.nama,
      jenjang: s.jenjang,
    }));
    const allClasses = [...db.classes.values()].map((c) => ({
      id: c.id,
      school_id: c.school_id,
      nama: c.nama,
      tingkat: c.tingkat,
    }));
    res.json({
      success: true,
      role: 'sekolah',
      scope: {
        schools: allSchools,
        classes: allClasses,
      },
    });
    return;
  }

  if (role === 'guru') {
    // Ambil semua keanggotaan sekolah yang aktif
    const activeSchools = [...db.schoolMemberships.values()]
      .filter((sm) => sm.user_id === userId && sm.role === 'guru' && sm.status === 'aktif')
      .map((sm) => db.schools.get(sm.school_id))
      .filter(Boolean);

    // Ambil kelas yang HANYA ia ikuti (FR-A6: kelas yang belum dimasukkan kodenya tidak muncul)
    const activeClassIds = new Set(
      [...db.classMemberships.values()]
        .filter((cm) => cm.user_id === userId && cm.role === 'guru' && cm.status === 'aktif')
        .map((cm) => cm.class_id)
    );

    const classes = [...db.classes.values()]
      .filter((c) => activeClassIds.has(c.id))
      .map((c) => ({
        id: c.id,
        school_id: c.school_id,
        nama: c.nama,
        tingkat: c.tingkat,
      }));

    // Kelompokkan per sekolah (FR-A6)
    const classesBySchool: Record<string, any[]> = {};
    for (const c of classes) {
      if (!classesBySchool[c.school_id]) classesBySchool[c.school_id] = [];
      classesBySchool[c.school_id].push(c);
    }

    const primarySchool = activeSchools[0]
      ? { id: activeSchools[0].id, nama: activeSchools[0].nama, jenjang: activeSchools[0].jenjang }
      : null;

    res.json({
      success: true,
      role: 'guru',
      school: primarySchool,
      classes,
      scope: {
        schools: activeSchools.map((s) => ({ id: s!.id, nama: s!.nama, jenjang: s!.jenjang })),
        classes,
        classes_by_school: classesBySchool,
      },
    });
    return;
  }

  if (role === 'murid') {
    // Murid hanya melihat kelas miliknya sendiri
    const activeCm = [...db.classMemberships.values()].find(
      (cm) => cm.user_id === userId && cm.role === 'murid' && cm.status === 'aktif'
    );

    let myClass: any = null;
    let mySchool: any = null;

    if (activeCm) {
      const cls = db.classes.get(activeCm.class_id);
      if (cls) {
        myClass = { id: cls.id, nama: cls.nama, tingkat: cls.tingkat };
        const sch = db.schools.get(cls.school_id);
        if (sch) mySchool = { id: sch.id, nama: sch.nama, jenjang: sch.jenjang };
      }
    }

    // Jika belum di kelas, cari sekolah dari school_membership
    if (!mySchool) {
      const activeSm = [...db.schoolMemberships.values()].find(
        (sm) => sm.user_id === userId && sm.role === 'murid' && sm.status === 'aktif'
      );
      if (activeSm) {
        const sch = db.schools.get(activeSm.school_id);
        if (sch) mySchool = { id: sch.id, nama: sch.nama, jenjang: sch.jenjang };
      }
    }

    res.json({
      success: true,
      role: 'murid',
      school: mySchool,
      kelas: myClass,
      scope: {
        school: mySchool,
        class: myClass,
      },
    });
    return;
  }

  // Pengguna biasa atau admin
  let userSchool: any = null;
  const anySm = [...db.schoolMemberships.values()].find(
    (sm) => sm.user_id === userId && sm.status === 'aktif'
  );
  if (anySm) {
    const sch = db.schools.get(anySm.school_id);
    if (sch) userSchool = { id: sch.id, nama: sch.nama, jenjang: sch.jenjang };
  }

  res.json({ success: true, role, school: userSchool, scope: { school: userSchool } });
});

// --------------------------------------------------------------------------
// GET /api/monitoring/school/:school_id/unassigned-students — FR-A5 (P1)
// "Murid yang sudah join sekolah tetapi belum masuk kelas muncul di daftar
// sekolah, tidak di daftar kelas mana pun."
// --------------------------------------------------------------------------
router.get('/school/:school_id/unassigned-students', (req: AuthRequest, res: Response) => {
  const schoolId = String(req.params.school_id);
  const role = req.user!.role;

  if (role !== 'admin' && role !== 'sekolah') {
    res.status(403).json({ success: false, message: 'Akses ditolak.' });
    return;
  }

  // Semua murid aktif di sekolah ini
  const schoolStudents = [...db.schoolMemberships.values()]
    .filter((sm) => sm.school_id === schoolId && sm.role === 'murid' && sm.status === 'aktif');

  // Murid yang sudah punya kelas aktif di kelas sekolah ini
  const schoolClassIds = new Set(
    [...db.classes.values()].filter((c) => c.school_id === schoolId).map((c) => c.id)
  );

  const studentsWithClass = new Set(
    [...db.classMemberships.values()]
      .filter((cm) => schoolClassIds.has(cm.class_id) && cm.status === 'aktif')
      .map((cm) => cm.user_id)
  );

  // Filter yang BELUM masuk kelas
  const unassigned = schoolStudents
    .filter((sm) => !studentsWithClass.has(sm.user_id))
    .map((sm) => {
      const u = db.users.get(sm.user_id);
      return {
        user_id: sm.user_id,
        nama: u ? u.nama : 'Anonim',
        joined_school_at: sm.joined_at,
      };
    });

  res.json({ success: true, total: unassigned.length, students: unassigned });
});

// --------------------------------------------------------------------------
// GET /api/monitoring/history — Riwayat Aktivitas & Log Audit (FR-A14)
// --------------------------------------------------------------------------
router.get('/history', (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const user = db.users.get(userId);
  const role = user?.role || req.user!.role;

  let logs = [...db.auditLog.values()];

  // Jika bukan admin, saring yang relevan dengan user / kelas / sekolahnya
  if (role !== 'admin') {
    logs = logs.filter(
      (l) =>
        l.actor_id === userId ||
        l.target_id === userId ||
        (l.details && (l.details.user_id === userId || l.details.email === user?.email))
    );
  }

  // Format menjadi history items
  const history = logs
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .map((l) => {
      let judul = 'Aktivitas Sistem';
      let tipe = 'sistem';
      let icon = 'ellipse';
      let iconColor = '#047857';
      let iconBg = '#ecfdf5';

      if (l.action === 'login') {
        judul = 'Akun Masuk (Login)';
        tipe = 'anggota';
        icon = 'log-in';
        iconColor = '#1d4ed8';
        iconBg = '#dbeafe';
      } else if (l.action.includes('class')) {
        judul = l.action === 'create_class' ? 'Pembuatan Kelas Baru' : 'Aktivitas Kelas';
        tipe = 'kelas';
        icon = 'book';
        iconColor = '#d97706';
        iconBg = '#fef3c7';
      } else if (l.action.includes('school')) {
        judul = 'Aktivitas Sekolah';
        tipe = 'sekolah';
        icon = 'school';
        iconColor = '#7c3aed';
        iconBg = '#ede9fe';
      } else if (l.action.includes('attendance')) {
        judul = 'Presensi & Kehadiran';
        tipe = 'absensi';
        icon = 'finger-print';
        iconColor = '#047857';
        iconBg = '#ecfdf5';
      }

      const actor = db.users.get(l.actor_id);
      const deskripsi =
        l.details && Object.keys(l.details).length > 0
          ? `${actor?.nama ? actor.nama + ': ' : ''}${Object.entries(l.details).map(([k, v]) => `${k}=${v}`).join(', ')}`
          : `Aktivitas dicatat untuk target: ${l.target_id}`;

      return {
        id: l.id,
        tipe,
        judul,
        deskripsi,
        waktu: new Date(l.timestamp).toLocaleString('id-ID', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
        timestamp: l.timestamp,
        icon,
        iconColor,
        iconBg,
      };
    });

  res.json({
    success: true,
    history,
  });
});

export default router;
