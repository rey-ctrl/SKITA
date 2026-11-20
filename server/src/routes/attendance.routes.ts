import { Router, Response } from 'express';
import { db } from '../db/store.js';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth.js';
import { Attendance, AttendanceAudit } from '../types/index.js';
import { getJakartaTime, isSchoolDay, isWithinAttendanceWindow } from '../utils/calendar.js';

const router = Router();
router.use(authMiddleware);

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// --------------------------------------------------------------------------
// Helper: cari kelas aktif murid
// --------------------------------------------------------------------------
function getActiveClassForStudent(userId: string): string | null {
  const cm = [...db.classMemberships.values()].find(
    (c) => c.user_id === userId && c.role === 'murid' && c.status === 'aktif'
  );
  return cm ? cm.class_id : null;
}

// --------------------------------------------------------------------------
// Helper: cari period aktif kelas
// --------------------------------------------------------------------------
function getActivePeriodForClass(classId: string): string | null {
  const p = [...db.periods.values()].find((p) => p.class_id === classId && p.is_active);
  return p ? p.id : null;
}

// --------------------------------------------------------------------------
// GET /api/attendance/class/:class_id?date=YYYY-MM-DD
// FR-A13: Murid melihat absensi seluruh kelas, guru bisa melihat kapan saja
// Response murid TIDAK mengandung field catatan
// --------------------------------------------------------------------------
router.get('/class/:class_id', (req: AuthRequest, res: Response) => {
  const classId = String(req.params.class_id);
  const date = String(req.query.date || getJakartaTime().dateString);

  const userId = req.user!.userId;
  const user = db.users.get(userId);
  const role = user?.role || req.user!.role;

  // Verifikasi keanggotaan di kelas ini
  const cm = [...db.classMemberships.values()].find(
    (c) => c.user_id === userId && c.class_id === classId && c.status === 'aktif'
  );
  if (!cm && role !== 'admin' && role !== 'sekolah') {
    res.status(403).json({ success: false, message: 'Tidak terdaftar di kelas ini.' });
    return;
  }

  const records = [...db.attendance.values()].filter(
    (a) => a.class_id === classId && a.tanggal === date
  );

  // FR-A13 & FR-A10: Response murid TIDAK mengandung field catatan
  const isTeacherOrAbove = role === 'admin' || role === 'sekolah' || role === 'guru';

  const data = records.map((r) => {
    const murid = db.users.get(r.murid_id);
    const base: Record<string, any> = {
      murid_id: r.murid_id,
      nama: murid?.nama || 'Anonim',
      tanggal: r.tanggal,
      status: r.status,
      diisi_oleh: r.diisi_oleh,
      is_koreksi_guru: r.is_koreksi_guru,
    };
    if (isTeacherOrAbove) {
      base.catatan = r.catatan;
    }
    return base;
  });

  res.json({ success: true, class_id: classId, date, records: data });
});

// --------------------------------------------------------------------------
// POST /api/attendance/self
// FR-A13: Murid isi absensi sendiri (hanya 'hadir'), 07.00-09.00 WIB, hari sekolah
// Murid tidak bisa mengisi sakit atau izin sendiri
// --------------------------------------------------------------------------
router.post('/self', requireRole('murid'), (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const now = getJakartaTime();

  // Cek jendela waktu (FR-A13: harus 07.00–09.00 WIB)
  if (!isWithinAttendanceWindow({ hours: now.hours, minutes: now.minutes })) {
    res.status(403).json({
      success: false,
      message: `Absensi mandiri hanya bisa diisi pukul 07.00–09.00 WIB. Sekarang ${now.timeString} WIB.`,
    });
    return;
  }

  // Cari kelas aktif murid
  const classId = getActiveClassForStudent(userId);
  if (!classId) {
    res.status(400).json({ success: false, message: 'Belum terdaftar di kelas mana pun.' });
    return;
  }

  const kelas = db.classes.get(classId);
  if (!kelas) {
    res.status(500).json({ success: false, message: 'Data kelas tidak ditemukan.' });
    return;
  }

  // Cek hari sekolah (FR-A13)
  const schoolDayCheck = isSchoolDay(kelas.school_id, now.dateString, now.dayOfWeek);
  if (!schoolDayCheck.isSchoolDay) {
    res.status(403).json({
      success: false,
      message: `Hari ini bukan hari sekolah (${schoolDayCheck.reason || 'libur'}). Absensi tidak dibuka.`,
    });
    return;
  }

  const periodId = getActivePeriodForClass(classId);
  if (!periodId) {
    res.status(400).json({ success: false, message: 'Tidak ada periode aktif di kelas ini.' });
    return;
  }

  // Cek duplikat (satu murid satu record per tanggal per kelas)
  const existing = [...db.attendance.values()].find(
    (a) => a.murid_id === userId && a.class_id === classId && a.tanggal === now.dateString
  );
  if (existing) {
    res.status(409).json({
      success: false,
      message: 'Absensi hari ini sudah tercatat.',
      current_status: existing.status,
    });
    return;
  }

  const record: Attendance = {
    id: newId('att'),
    murid_id: userId,
    class_id: classId,
    period_id: periodId,
    tanggal: now.dateString,
    status: 'hadir', // murid mandiri hanya bisa hadir (FR-A13)
    diisi_oleh: userId,
    waktu_isi: new Date().toISOString(),
    is_koreksi_guru: false,
  };
  db.attendance.set(record.id, record);

  res.status(201).json({ success: true, message: 'Absensi berhasil dicatat.', attendance: record });
});

// --------------------------------------------------------------------------
// POST /api/attendance/guru
// FR-A13: Guru isi atau koreksi absensi murid (hadir/sakit/izin/alpa + catatan)
// Kapan saja pada hari sekolah. TIDAK bisa di hari non-sekolah.
// --------------------------------------------------------------------------
router.post('/guru', requireRole('guru'), (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const { murid_id, class_id, date, status, catatan } = req.body as {
    murid_id: string;
    class_id: string;
    date?: string;
    status: 'hadir' | 'sakit' | 'izin' | 'alpa';
    catatan?: string;
  };

  if (!murid_id || !class_id || !status) {
    res.status(400).json({ success: false, message: 'murid_id, class_id, dan status wajib diisi.' });
    return;
  }

  const validStatus = ['hadir', 'sakit', 'izin', 'alpa'];
  if (!validStatus.includes(status)) {
    res.status(400).json({ success: false, message: `Status tidak valid. Pilih: ${validStatus.join(', ')}.` });
    return;
  }

  const kelas = db.classes.get(class_id);
  if (!kelas) {
    res.status(404).json({ success: false, message: 'Kelas tidak ditemukan.' });
    return;
  }

  const targetDate = date || getJakartaTime().dateString;

  // Cek hari sekolah (FR-A13: guru tidak bisa isi di hari non-sekolah)
  const [y, m, d] = targetDate.split('-').map(Number);
  const dowTarget = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const schoolDayCheck = isSchoolDay(kelas.school_id, targetDate, dowTarget);
  if (!schoolDayCheck.isSchoolDay) {
    res.status(403).json({
      success: false,
      message: `Tanggal ${targetDate} bukan hari sekolah (${schoolDayCheck.reason || 'libur'}).`,
    });
    return;
  }

  // FR-A13: Guru hanya bisa isi kelas yang ia join (cek di server)
  const guruCm = [...db.classMemberships.values()].find(
    (c) => c.user_id === userId && c.class_id === class_id && c.role === 'guru' && c.status === 'aktif'
  );
  if (!guruCm) {
    res.status(403).json({ success: false, message: 'Guru tidak terdaftar di kelas ini.' });
    return;
  }

  // Verifikasi murid terdaftar di kelas ini
  const muridCm = [...db.classMemberships.values()].find(
    (c) => c.user_id === murid_id && c.class_id === class_id && c.role === 'murid'
  );
  if (!muridCm) {
    res.status(404).json({ success: false, message: 'Murid tidak terdaftar di kelas ini.' });
    return;
  }

  const periodId = getActivePeriodForClass(class_id);
  if (!periodId) {
    res.status(400).json({ success: false, message: 'Tidak ada periode aktif.' });
    return;
  }

  const existing = [...db.attendance.values()].find(
    (a) => a.murid_id === murid_id && a.class_id === class_id && a.tanggal === targetDate
  );

  if (existing) {
    // KOREKSI: simpan audit trail
    const audit: AttendanceAudit = {
      id: newId('aaud'),
      attendance_id: existing.id,
      actor_id: userId,
      timestamp: new Date().toISOString(),
      status_sebelum: existing.status,
      status_sesudah: status,
      catatan_sebelum: existing.catatan,
      catatan_sesudah: catatan,
    };
    db.attendanceAudit.set(audit.id, audit);

    existing.status = status;
    existing.catatan = catatan;
    existing.diisi_oleh = userId;
    existing.waktu_isi = new Date().toISOString();
    existing.is_koreksi_guru = true;
    db.attendance.set(existing.id, existing);

    res.json({
      success: true,
      message: 'Absensi berhasil dikoreksi.',
      attendance: existing,
      action: 'koreksi',
    });
    return;
  }

  // ISI BARU
  const record: Attendance = {
    id: newId('att'),
    murid_id,
    class_id,
    period_id: periodId,
    tanggal: targetDate,
    status,
    catatan,
    diisi_oleh: userId,
    waktu_isi: new Date().toISOString(),
    is_koreksi_guru: true,
  };
  db.attendance.set(record.id, record);

  res.status(201).json({
    success: true,
    message: 'Absensi berhasil diisi oleh guru.',
    attendance: record,
    action: 'isi',
  });
});

// --------------------------------------------------------------------------
// GET /api/attendance/my-history
// FR-A17 (P1): Riwayat absensi mandiri murid
// Hanya menampilkan data murid sendiri, kolom catatan dirahasiakan (FR-A10)
// --------------------------------------------------------------------------
router.get('/my-history', requireRole('murid'), (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const month = req.query.month as string | undefined; // format YYYY-MM

  const records = [...db.attendance.values()]
    .filter((a) => {
      if (a.murid_id !== userId) return false;
      if (month && !a.tanggal.startsWith(month)) return false;
      return true;
    })
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal))
    .map((r) => {
      const kelas = db.classes.get(r.class_id);
      return {
        id: r.id,
        class_id: r.class_id,
        class_name: kelas?.nama || 'Kelas',
        tanggal: r.tanggal,
        status: r.status,
        waktu_isi: r.waktu_isi,
        is_koreksi_guru: r.is_koreksi_guru,
        // catatan sengaja tidak disertakan untuk menjaga privasi
      };
    });

  res.json({ success: true, count: records.length, records });
});

export default router;
