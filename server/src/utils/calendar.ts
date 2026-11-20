import { db } from '../db/store.js';

// Ambil info tanggal & waktu saat ini di zona Asia/Jakarta (WIB)
export function getJakartaTime(d: Date = new Date()): {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  dayOfWeek: number; // 0 = Minggu, 1 = Senin, ..., 6 = Sabtu
  dateString: string; // YYYY-MM-DD
  timeString: string; // HH:mm
} {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(d);
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }

  const year = parseInt(partMap.year, 10);
  const month = parseInt(partMap.month, 10);
  const day = parseInt(partMap.day, 10);
  const hours = parseInt(partMap.hour, 10);
  const minutes = parseInt(partMap.minute, 10);

  // Hitung day of week WIB
  const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes));
  const dayOfWeek = utcDate.getUTCDay();

  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const hh = String(hours).padStart(2, '0');
  const min = String(minutes).padStart(2, '0');

  return {
    year,
    month,
    day,
    hours,
    minutes,
    dayOfWeek,
    dateString: `${year}-${mm}-${dd}`,
    timeString: `${hh}:${min}`,
  };
}

// Cek apakah tanggal tertentu merupakan hari sekolah untuk sekolah tersebut (FR-A13)
// Hari sekolah = hari kerja sekolah (default Senin-Jumat) dikurangi libur nasional & cuti bersama,
// ditambah / dikurangi override kalender sekolah
export function isSchoolDay(
  schoolId: string,
  dateString: string,
  customDayOfWeek?: number
): { isSchoolDay: boolean; reason?: string } {
  // 1. Cek School Calendar Override dulu (Sekolah bisa menandai satu tanggal merah sebagai hari masuk / sebaliknya)
  const override = [...db.schoolCalendarOverrides.values()].find(
    (o) => o.school_id === schoolId && o.tanggal === dateString
  );

  if (override) {
    if (override.override_type === 'masuk') {
      return { isSchoolDay: true };
    }
    if (override.override_type === 'libur') {
      return { isSchoolDay: false, reason: 'Libur khusus sekolah' };
    }
  }

  // 2. Cek libur nasional atau cuti bersama
  const holiday = [...db.holidays.values()].find((h) => h.tanggal === dateString);
  if (holiday) {
    return { isSchoolDay: false, reason: holiday.nama };
  }

  // 3. Cek hari kerja sekolah (default Senin s.d. Jumat: 1 s.d. 5)
  const schoolCfg = db.schoolConfigs.get(schoolId);
  const workDays: number[] = schoolCfg?.work_days && schoolCfg.work_days.length > 0
    ? schoolCfg.work_days
    : [1, 2, 3, 4, 5];

  let dow = customDayOfWeek;
  if (dow === undefined) {
    const [y, m, d] = dateString.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    dow = date.getUTCDay();
  }

  if (!workDays.includes(dow)) {
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    return { isSchoolDay: false, reason: `Hari non-sekolah (${dayNames[dow]})` };
  }

  return { isSchoolDay: true };
}

// Cek apakah waktu WIB sekarang berada di dalam jendela absensi mandiri murid
// Default: 07.00 - 09.00 WIB
export function isWithinAttendanceWindow(
  nowTime: { hours: number; minutes: number },
  windowStart: string = '07:00',
  windowEnd: string = '09:00'
): boolean {
  const [sH, sM] = windowStart.split(':').map(Number);
  const [eH, eM] = windowEnd.split(':').map(Number);

  const currentMin = nowTime.hours * 60 + nowTime.minutes;
  const startMin = sH * 60 + sM;
  const endMin = eH * 60 + eM;

  return currentMin >= startMin && currentMin < endMin;
}
