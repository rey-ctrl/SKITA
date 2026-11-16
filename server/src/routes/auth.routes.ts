import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/store.js';
import { User } from '../types/index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { persistUser } from '../db/postgres.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'skita_super_secret_jwt_key_2026';

// POST /api/auth/register (FR-AUTH-1)
router.post('/register', (req: Request, res: Response) => {
  const { nama, email, password, provinsi, kota_kab } = req.body;

  if (!nama || !email || !password) {
    res.status(400).json({ success: false, message: 'Nama, email, dan password wajib diisi.' });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ success: false, message: 'Password minimal harus 8 karakter (FR-AUTH-1).' });
    return;
  }

  // Check email exists
  for (const user of db.users.values()) {
    if (user.email.toLowerCase() === email.toLowerCase()) {
      res.status(409).json({ success: false, message: 'Email sudah terdaftar. Silakan login.' });
      return;
    }
  }

  const salt = bcrypt.genSaltSync(10);
  const newUser: User = {
    id: `usr_${Date.now()}`,
    nama: nama.trim(),
    email: email.toLowerCase().trim(),
    password_hash: bcrypt.hashSync(password, salt),
    provinsi: provinsi || 'Jawa Barat',
    kota_kab: kota_kab || 'Kota Bogor',
    role: 'parent',
    created_at: new Date().toISOString(),
  };

  db.users.set(newUser.id, newUser);
  persistUser(newUser);

  const token = jwt.sign(
    { userId: newUser.id, email: newUser.email, role: newUser.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.status(201).json({
    success: true,
    message: 'Registrasi berhasil.',
    token,
    user: {
      id: newUser.id,
      nama: newUser.nama,
      email: newUser.email,
      provinsi: newUser.provinsi,
      kota_kab: newUser.kota_kab,
      role: newUser.role,
    },
  });
});

// POST /api/auth/google (FR-AUTH-GOOGLE)
// ponytail: token signature not verified — production needs google-auth-library to call verifyIdToken()
router.post('/google', (req: Request, res: Response) => {
  const { google_id_token, nama, email, photo_url } = req.body;

  if (!email || !nama) {
    res.status(400).json({ success: false, message: 'Email dan nama wajib diisi.' });
    return;
  }

  let foundUser: User | null = null;
  for (const user of db.users.values()) {
    if (user.email.toLowerCase() === email.toLowerCase().trim()) {
      foundUser = user;
      break;
    }
  }

  if (!foundUser) {
    foundUser = {
      id: `usr_${Date.now()}`,
      nama: nama.trim(),
      email: email.toLowerCase().trim(),
      password_hash: '',
      provinsi: 'Jawa Barat',
      kota_kab: 'Kota Bogor',
      role: 'parent',
      created_at: new Date().toISOString(),
    };
    db.users.set(foundUser.id, foundUser);
    persistUser(foundUser);
  }

  const token = jwt.sign(
    { userId: foundUser.id, email: foundUser.email, role: foundUser.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    success: true,
    token,
    user: {
      id: foundUser.id,
      nama: foundUser.nama,
      email: foundUser.email,
      provinsi: foundUser.provinsi,
      kota_kab: foundUser.kota_kab,
      role: foundUser.role,
    },
  });
});

// POST /api/auth/login (FR-AUTH-2)
router.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ success: false, message: 'Email dan password wajib diisi.' });
    return;
  }

  let foundUser: User | null = null;
  for (const user of db.users.values()) {
    if (user.email.toLowerCase() === email.toLowerCase().trim()) {
      foundUser = user;
      break;
    }
  }

  if (!foundUser || !bcrypt.compareSync(password, foundUser.password_hash)) {
    res.status(401).json({ success: false, message: 'Email atau password salah.' });
    return;
  }

  const token = jwt.sign(
    { userId: foundUser.id, email: foundUser.email, role: foundUser.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    success: true,
    message: 'Login berhasil.',
    token,
    user: {
      id: foundUser.id,
      nama: foundUser.nama,
      email: foundUser.email,
      provinsi: foundUser.provinsi,
      kota_kab: foundUser.kota_kab,
      role: foundUser.role,
    },
  });
});

// GET /api/auth/me (FR-AUTH-3)
router.get('/me', authMiddleware, (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  const user = userId ? db.users.get(userId) : null;

  if (!user) {
    res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    return;
  }

  res.json({
    success: true,
    user: {
      id: user.id,
      nama: user.nama,
      email: user.email,
      provinsi: user.provinsi,
      kota_kab: user.kota_kab,
      role: user.role,
    },
  });
});

export default router;
