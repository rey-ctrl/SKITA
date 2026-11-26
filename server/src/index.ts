import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes.js';
import schoolRoutes from './routes/schools.routes.js';
import regionRoutes from './routes/regions.routes.js';
import userRoutes from './routes/users.routes.js';
import routingRoutes from './routes/routing.routes.js';
import joinRoutes from './routes/join.routes.js';
import adminRoutes from './routes/admin.routes.js';
import codeRoutes from './routes/codes.routes.js';
import subjectRoutes from './routes/subjects.routes.js';
import memberRoutes from './routes/members.routes.js';
import dissolutionRoutes, { executeDissolution } from './routes/dissolution.routes.js';
import monitoringRoutes from './routes/monitoring.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import calendarRoutes from './routes/calendar.routes.js';
import assignmentRoutes from './routes/assignments.routes.js';
import schoolDashboardRoutes from './routes/school-dashboard.routes.js';
import { db } from './db/store.js';
import { connectPostgres, isPostgresConnected } from './db/postgres.js';
import { getJakartaTime, isSchoolDay } from './utils/calendar.js';
import { Attendance } from './types/index.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'SKITA API Backend',
    version: '1.0.0',
    database: isPostgresConnected ? 'PostgreSQL' : 'in-memory (fallback)',
    timestamp: new Date().toISOString(),
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/regions', regionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/route', routingRoutes);
app.use('/api/join', joinRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/codes', codeRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/dissolution', dissolutionRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api', calendarRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/school-dashboard', schoolDashboardRoutes);

// 404 Handler
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint tidak ditemukan.' });
});

export { app };

if (process.env.NODE_ENV !== 'test' && !process.env.TEST_MODE) {
  // Scheduled job: periksa apakah ada pembubaran kelas yang waktunya tiba (FR-A11)
  setInterval(() => {
    const now = Date.now();
    for (const d of db.dissolutionSchedules.values()) {
      if (d.status === 'terjadwal') {
        const schedTime = new Date(d.scheduled_at).getTime();
        const due = schedTime + d.duration_hours * 60 * 60 * 1000;
        if (now >= due) {
          console.log(`[Dissolution] Menjalankan pembubaran terjadwal untuk sekolah ${d.school_id}`);
          executeDissolution(d, 'system_scheduler');
        }
      }
    }
  }, 60 * 1000);

  // Scheduled job: tandai Alpa otomatis (FR-A13) tiap 23:59 WIB pada hari sekolah
  let lastAlpaRunDate = '';
  setInterval(() => {
    const nowJkt = getJakartaTime();
    if (nowJkt.hours === 23 && nowJkt.minutes >= 55 && lastAlpaRunDate !== nowJkt.dateString) {
      lastAlpaRunDate = nowJkt.dateString;
      console.log(`[Attendance Cron] Memulai sweep alpa otomatis untuk tanggal ${nowJkt.dateString}...`);
      for (const kelas of db.classes.values()) {
        const schoolCheck = isSchoolDay(kelas.school_id, nowJkt.dateString, nowJkt.dayOfWeek);
        if (!schoolCheck.isSchoolDay) continue;

        const activePeriod = [...db.periods.values()].find((p) => p.class_id === kelas.id && p.is_active);
        if (!activePeriod) continue;

        const activeStudents = [...db.classMemberships.values()].filter(
          (cm) => cm.class_id === kelas.id && cm.role === 'murid' && cm.status === 'aktif'
        );

        for (const st of activeStudents) {
          const already = [...db.attendance.values()].some(
            (a) => a.murid_id === st.user_id && a.class_id === kelas.id && a.tanggal === nowJkt.dateString
          );
          if (!already) {
            const att: Attendance = {
              id: `att_auto_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              murid_id: st.user_id,
              class_id: kelas.id,
              period_id: activePeriod.id,
              tanggal: nowJkt.dateString,
              status: 'alpa',
              diisi_oleh: 'system_scheduler',
              waktu_isi: new Date().toISOString(),
              is_koreksi_guru: false,
            };
            db.attendance.set(att.id, att);
          }
        }
      }
      console.log(`[Attendance Cron] Selesai sweep alpa untuk ${nowJkt.dateString}`);
    }
  }, 60 * 1000);

  connectPostgres().finally(() => {
    const server = app.listen(PORT, () => {
      console.log(`[SKITA Backend] Server berjalan di http://localhost:${PORT}`);
    });

    const shutdown = () => {
      server.close(() => {
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  });
}
