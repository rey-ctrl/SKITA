import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/store.js';
import { User } from '../types/index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { persistUser } from '../db/postgres.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'skita_super_secret_jwt_key_2026';

function makeToken(user: User) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function safeUser(user: User) {
  return {
    id: user.id,
    nama: user.nama,
    email: user.email,
    role: user.role,
    must_change_password: user.must_change_password || false,
  };
}

// POST /api/auth/register (FR-A15)
// Role field dari klien diabaikan — pendaftar baru selalu 'pengguna'
router.post('/register', (req: Request, res: Response) => {
  const { nama, email, password } = req.body;

  if (!nama || !email || !password) {
    res.status(400).json({ success: false, message: 'Nama, email, dan password wajib diisi.' });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ success: false, message: 'Password minimal 8 karakter.' });
    return;
  }

  for (const u of db.users.values()) {
    if (u.email.toLowerCase() === email.toLowerCase().trim()) {
      res.status(409).json({ success: false, message: 'Email sudah terdaftar. Silakan login.' });
      return;
    }
  }

  const newUser: User = {
    id: `usr_${Date.now()}`,
    nama: nama.trim(),
    email: email.toLowerCase().trim(),
    password_hash: bcrypt.hashSync(password, bcrypt.genSaltSync(10)),
    role: 'pengguna', // FR-A15: role ditentukan server, bukan klien
    is_active: true,
    created_at: new Date().toISOString(),
  };

  db.users.set(newUser.id, newUser);
  persistUser(newUser);

  res.status(201).json({
    success: true,
    message: 'Registrasi berhasil. Masukkan kode sekolah untuk bergabung.',
    token: makeToken(newUser),
    user: safeUser(newUser),
  });
});

// POST /api/auth/login (FR-A15)
router.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ success: false, message: 'Email dan password wajib diisi.' });
    return;
  }

  let found: User | null = null;
  for (const u of db.users.values()) {
    if (u.email.toLowerCase() === email.toLowerCase().trim()) {
      found = u;
      break;
    }
  }

  if (!found || !bcrypt.compareSync(password, found.password_hash)) {
    res.status(401).json({ success: false, message: 'Email atau password salah.' });
    return;
  }

  if (found.is_active === false) {
    res.status(403).json({ success: false, message: 'Akun dinonaktifkan. Hubungi Admin.' });
    return;
  }

  // Jaga integritas akun Admin resmi agar tidak turun role
  if (found.id === 'usr_admin_seed' || found.email.toLowerCase() === 'admin@skita.id') {
    found.role = 'admin';
  }

  res.json({
    success: true,
    message: 'Login berhasil.',
    token: makeToken(found),
    user: safeUser(found),
  });
});

// POST /api/auth/google (FR-AUTH-GOOGLE)
// ponytail: token signature tidak diverifikasi — produksi perlu google-auth-library verifyIdToken()
router.post('/google', (req: Request, res: Response) => {
  const { nama, email } = req.body;

  if (!email || !nama) {
    res.status(400).json({ success: false, message: 'Email dan nama wajib diisi.' });
    return;
  }

  let found: User | null = null;
  for (const u of db.users.values()) {
    if (u.email.toLowerCase() === email.toLowerCase().trim()) {
      found = u;
      break;
    }
  }

  if (!found) {
    found = {
      id: `usr_${Date.now()}`,
      nama: nama.trim(),
      email: email.toLowerCase().trim(),
      password_hash: '',
      role: 'pengguna', // FR-A15
      is_active: true,
      created_at: new Date().toISOString(),
    };
    db.users.set(found.id, found);
    persistUser(found);
  }

  if (found.is_active === false) {
    res.status(403).json({ success: false, message: 'Akun dinonaktifkan. Hubungi Admin.' });
    return;
  }

  res.json({
    success: true,
    token: makeToken(found),
    user: safeUser(found),
  });
});

// GET /api/auth/me (FR-A15)
router.get('/me', authMiddleware, (req: AuthRequest, res: Response) => {
  const user = req.user?.userId ? db.users.get(req.user.userId) : null;

  if (!user) {
    res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    return;
  }

  // Jaga integritas role admin
  if (user.id === 'usr_admin_seed' || user.email.toLowerCase() === 'admin@skita.id') {
    user.role = 'admin';
  }

  res.json({ success: true, user: safeUser(user) });
});

// PATCH /api/auth/profile — Update profil (konfirmasi nama lengkap)
router.patch('/profile', authMiddleware, (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  const user = userId ? db.users.get(userId) : null;

  if (!user) {
    res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    return;
  }

  const { nama } = req.body;
  if (nama && typeof nama === 'string' && nama.trim()) {
    user.nama = nama.trim();
    user.updated_at = new Date().toISOString();
    db.users.set(user.id, user);
    persistUser(user);
  }

  res.json({ success: true, message: 'Profil berhasil diperbarui.', user: safeUser(user) });
});

// POST /api/auth/change-password (FR-A15: wajib ganti password saat login pertama)
router.post('/change-password', authMiddleware, (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  const user = userId ? db.users.get(userId) : null;

  if (!user) {
    res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    return;
  }

  const { current_password, new_password } = req.body;
  if (!new_password || new_password.length < 8) {
    res.status(400).json({ success: false, message: 'Password baru minimal 8 karakter.' });
    return;
  }

  // Kalau must_change_password, boleh skip cek current (kasus akun baru)
  if (!user.must_change_password) {
    if (!current_password || !bcrypt.compareSync(current_password, user.password_hash)) {
      res.status(401).json({ success: false, message: 'Password saat ini salah.' });
      return;
    }
  }

  user.password_hash = bcrypt.hashSync(new_password, bcrypt.genSaltSync(10));
  user.must_change_password = false;
  user.updated_at = new Date().toISOString();
  db.users.set(user.id, user);

  res.json({ success: true, message: 'Password berhasil diperbarui.' });
});

export default router;
