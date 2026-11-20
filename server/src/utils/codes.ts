import crypto from 'crypto';

// Karakter acak tanpa ambigu (drop 0, O, 1, I, L)
const CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function generateRandomCode(length = 8): string {
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += CHARS[bytes[i] % CHARS.length];
  }
  return result;
}

// Menghitung Senin depan pukul 00:00:00 WIB (Asia/Jakarta = UTC+7)
// FR-A7: Kode aktif berlaku sampai Senin 00:00 WIB berikutnya
export function getNextMondayWib(from = new Date()): Date {
  // Hitung waktu sekarang di WIB (UTC + 7 jam)
  const offsetMs = 7 * 60 * 60 * 1000;
  const wibTime = new Date(from.getTime() + offsetMs);

  // Hari dalam seminggu di WIB: 0 = Minggu, 1 = Senin, ..., 6 = Sabtu
  const day = wibTime.getUTCDay();
  // Berapa hari ke Senin depan:
  // Jika hari ini Senin (day === 1), tetap ambil Senin minggu depan (+7)
  const daysUntilMonday = day === 0 ? 1 : 8 - day;

  // Set ke Senin 00:00:00 UTC di waktu WIB
  const targetWib = new Date(wibTime);
  targetWib.setUTCDate(targetWib.getUTCDate() + daysUntilMonday);
  targetWib.setUTCHours(0, 0, 0, 0);

  // Konversi balik ke UTC murni
  return new Date(targetWib.getTime() - offsetMs);
}
