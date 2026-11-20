import { Router, Response } from 'express';
import { db } from '../db/store.js';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth.js';
import { DissolutionSchedule, ClassPeriod, AuditLog } from '../types/index.js';

const router = Router();
router.use(authMiddleware);

const DEFAULT_DISSOLUTION_HOURS = 24;

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
// Fungsi Eksekusi Pembubaran Kelas (FR-A11)
// 1. Semua murid -> 'lulus'
// 2. Semua guru -> 'keluar' dari kelas (keanggotaan sekolah tetap)
// 3. Periode lama ditutup, periode baru dibuka
// 4. Status schedule -> 'selesai'
// --------------------------------------------------------------------------
export function executeDissolution(schedule: DissolutionSchedule, actorId: string): {
  affected_classes: number;
  affected_students: number;
  affected_teachers: number;
} {
  const schoolId = schedule.school_id;
  const nowStr = new Date().toISOString();

  // Ambil semua kelas di sekolah ini
  const schoolClasses = [...db.classes.values()].filter((c) => c.school_id === schoolId);
  const classIds = new Set(schoolClasses.map((c) => c.id));

  let affectedStudents = 0;
  let affectedTeachers = 0;

  // 1 & 2. Update keanggotaan kelas
  for (const cm of db.classMemberships.values()) {
    if (classIds.has(cm.class_id) && cm.status === 'aktif') {
      if (cm.role === 'murid') {
        cm.status = 'lulus'; // FR-A11: penanda keluar dari kelas
        cm.left_at = nowStr;
        affectedStudents++;
      } else if (cm.role === 'guru') {
        cm.status = 'keluar'; // FR-A11: guru keluar dari kelas, keanggotaan sekolah tetap
        cm.left_at = nowStr;
        affectedTeachers++;
      }
      db.classMemberships.set(cm.id, cm);
    }
  }

  // 3. Tutup periode lama, buka periode baru per kelas
  for (const kelas of schoolClasses) {
    // Tutup periode lama
    for (const p of db.periods.values()) {
      if (p.class_id === kelas.id && p.is_active) {
        p.is_active = false;
        p.end_date = nowStr.split('T')[0];
        db.periods.set(p.id, p);
      }
    }

    // Buka periode baru
    const newPeriod: ClassPeriod = {
      id: `prd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      class_id: kelas.id,
      start_date: nowStr.split('T')[0],
      is_active: true,
    };
    db.periods.set(newPeriod.id, newPeriod);
  }

  // 4. Update status jadwal
  schedule.status = 'selesai';
  schedule.executed_at = nowStr;
  db.dissolutionSchedules.set(schedule.id, schedule);

  const log = auditEntry(actorId, 'execute_dissolution', 'dissolution_schedule', schedule.id, {
    school_id: schoolId,
    affected_classes: schoolClasses.length,
    affected_students: affectedStudents,
    affected_teachers: affectedTeachers,
  });
  db.auditLog.set(log.id, log);

  return {
    affected_classes: schoolClasses.length,
    affected_students: affectedStudents,
    affected_teachers: affectedTeachers,
  };
}

// --------------------------------------------------------------------------
// GET /api/dissolution/preview/:school_id
// FR-A11: Dialog konfirmasi wajib memuat jumlah kelas & murid terdampak
// --------------------------------------------------------------------------
router.get('/preview/:school_id', requireRole('sekolah', 'admin'), (req: AuthRequest, res: Response) => {
  const schoolId = String(req.params.school_id);
  if (!canManageSchool(req, schoolId)) {
    res.status(403).json({ success: false, message: 'Akses ditolak.' });
    return;
  }

  const schoolClasses = [...db.classes.values()].filter((c) => c.school_id === schoolId);
  const classIds = new Set(schoolClasses.map((c) => c.id));

  const affectedStudents = [...db.classMemberships.values()].filter(
    (cm) => classIds.has(cm.class_id) && cm.status === 'aktif' && cm.role === 'murid'
  ).length;

  res.json({
    success: true,
    school_id: schoolId,
    total_classes: schoolClasses.length,
    total_students: affectedStudents,
    duration_hours: DEFAULT_DISSOLUTION_HOURS,
    confirmation_keyword: 'BUBARKAN',
    warning_text:
      'Selama 24 jam pendaftar baru tidak bisa masuk kelas. Setelah itu semua murid dan guru dikeluarkan dari semua kelas. Murid ditandai lulus, termasuk kelas yang bukan tingkat akhir. Status ini hanya penanda keluar dari kelas, bukan kelulusan dari sekolah.',
  });
});

// --------------------------------------------------------------------------
// POST /api/dissolution/schedule
// FR-A11: Menjadwalkan pembubaran 24 jam ke depan (Sekolah & Admin)
// Body: { school_id, confirmation_text, duration_hours? }
// --------------------------------------------------------------------------
router.post('/schedule', requireRole('sekolah', 'admin'), (req: AuthRequest, res: Response) => {
  const { school_id, confirmation_text, duration_hours } = req.body as {
    school_id: string;
    confirmation_text: string;
    duration_hours?: number;
  };

  if (!school_id) {
    res.status(400).json({ success: false, message: 'school_id wajib diisi.' });
    return;
  }

  if (confirmation_text !== 'BUBARKAN') {
    res.status(400).json({
      success: false,
      message: 'Konfirmasi tidak valid. Anda wajib mengetik BUBARKAN secara tepat.',
    });
    return;
  }

  if (!canManageSchool(req, school_id)) {
    res.status(403).json({ success: false, message: 'Akses ditolak.' });
    return;
  }

  // Cek apakah sudah ada pembubaran aktif yang terjadwal
  const activeExisting = [...db.dissolutionSchedules.values()].find(
    (d) => d.school_id === school_id && d.status === 'terjadwal'
  );
  if (activeExisting) {
    res.status(409).json({
      success: false,
      message: 'Pembubaran kelas untuk sekolah ini sudah terjadwal.',
      schedule: activeExisting,
    });
    return;
  }

  const hours = duration_hours && duration_hours > 0 ? duration_hours : DEFAULT_DISSOLUTION_HOURS;
  const now = new Date();
  const willExecuteAt = new Date(now.getTime() + hours * 60 * 60 * 1000);

  const schedule: DissolutionSchedule = {
    id: `diss_${Date.now()}`,
    school_id,
    scheduled_at: now.toISOString(),
    status: 'terjadwal',
    created_by: req.user!.userId,
    duration_hours: hours,
  };
  db.dissolutionSchedules.set(schedule.id, schedule);

  const log = auditEntry(req.user!.userId, 'schedule_dissolution', 'dissolution_schedule', schedule.id, {
    school_id,
    duration_hours: hours,
    will_execute_at: willExecuteAt.toISOString(),
  });
  db.auditLog.set(log.id, log);

  res.status(201).json({
    success: true,
    message: `Pembubaran terjadwal untuk ${hours} jam ke depan.`,
    schedule: {
      ...schedule,
      will_execute_at: willExecuteAt.toISOString(),
    },
  });
});

// --------------------------------------------------------------------------
// GET /api/dissolution/banner/:class_id
// FR-A11: Banner dibaca dari status server, tampil untuk murid, guru, sekolah, admin.
// --------------------------------------------------------------------------
router.get('/banner/:class_id', (req: AuthRequest, res: Response) => {
  const classId = String(req.params.class_id);

  const kelas = db.classes.get(classId);
  if (!kelas) {
    res.status(404).json({ success: false, message: 'Kelas tidak ditemukan.' });
    return;
  }

  const activeSchedule = [...db.dissolutionSchedules.values()].find(
    (d) => d.school_id === kelas.school_id && d.status === 'terjadwal'
  );

  if (!activeSchedule) {
    res.json({ success: true, has_banner: false });
    return;
  }

  const scheduledTime = new Date(activeSchedule.scheduled_at).getTime();
  const willExecuteTime = scheduledTime + activeSchedule.duration_hours * 60 * 60 * 1000;
  const executeDate = new Date(willExecuteTime);

  res.json({
    success: true,
    has_banner: true,
    schedule_id: activeSchedule.id,
    scheduled_at: activeSchedule.scheduled_at,
    will_execute_at: executeDate.toISOString(),
    banner_text: `Kelas akan dibubarkan pada ${executeDate.toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      dateStyle: 'full',
      timeStyle: 'short',
    })} WIB. Setelah itu kamu keluar dari kelas.`,
  });
});

// --------------------------------------------------------------------------
// POST /api/dissolution/cancel/:schedule_id
// FR-A11: Urungkan pembubaran (Sekolah & Admin)
// --------------------------------------------------------------------------
router.post('/cancel/:schedule_id', requireRole('sekolah', 'admin'), (req: AuthRequest, res: Response) => {
  const scheduleId = String(req.params.schedule_id);

  const schedule = db.dissolutionSchedules.get(scheduleId);
  if (!schedule) {
    res.status(404).json({ success: false, message: 'Jadwal pembubaran tidak ditemukan.' });
    return;
  }

  if (!canManageSchool(req, schedule.school_id)) {
    res.status(403).json({ success: false, message: 'Akses ditolak.' });
    return;
  }

  if (schedule.status === 'selesai') {
    res.status(400).json({ success: false, message: 'Pembubaran sudah dieksekusi, tidak dapat diurungkan.' });
    return;
  }

  schedule.status = 'diurungkan';
  db.dissolutionSchedules.set(scheduleId, schedule);

  const log = auditEntry(req.user!.userId, 'cancel_dissolution', 'dissolution_schedule', schedule.id, {
    school_id: schedule.school_id,
  });
  db.auditLog.set(log.id, log);

  res.json({ success: true, message: 'Pembubaran kelas berhasil diurungkan. Banner telah dicabut.' });
});

// --------------------------------------------------------------------------
// POST /api/dissolution/execute-now/:schedule_id
// FR-A11: Jalankan pembubaran sekarang (Sekolah & Admin)
// --------------------------------------------------------------------------
router.post('/execute-now/:schedule_id', requireRole('sekolah', 'admin'), (req: AuthRequest, res: Response) => {
  const scheduleId = String(req.params.schedule_id);

  const schedule = db.dissolutionSchedules.get(scheduleId);
  if (!schedule) {
    res.status(404).json({ success: false, message: 'Jadwal pembubaran tidak ditemukan.' });
    return;
  }

  if (!canManageSchool(req, schedule.school_id)) {
    res.status(403).json({ success: false, message: 'Akses ditolak.' });
    return;
  }

  if (schedule.status !== 'terjadwal') {
    res.status(400).json({ success: false, message: `Jadwal berstatus '${schedule.status}', tidak dapat dieksekusi.` });
    return;
  }

  const result = executeDissolution(schedule, req.user!.userId);

  res.json({
    success: true,
    message: 'Pembubaran kelas berhasil dieksekusi sekarang.',
    result,
  });
});

export default router;
