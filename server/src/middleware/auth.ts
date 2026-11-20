import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { GlobalRole } from '../types/index.js';
import { db } from '../db/store.js';

const JWT_SECRET = process.env.JWT_SECRET || 'skita_super_secret_jwt_key_2026';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: GlobalRole;
  };
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Autentikasi dibutuhkan. Token tidak ditemukan.' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      email: string;
      role: GlobalRole;
    };
    // Sync role terbaru dari DB jika ada (FR-A1: role update langsung berlaku)
    const freshUser = db.users.get(decoded.userId);
    req.user = {
      ...decoded,
      role: freshUser ? freshUser.role : decoded.role,
    };
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Token tidak valid atau telah kedaluwarsa.' });
  }
}

// FR-A1, FR-A8: hak akses di-cek di server, bukan hanya di UI
// Contoh: requireRole('admin') atau requireRole('admin', 'sekolah')
export function requireRole(...roles: GlobalRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Autentikasi dibutuhkan.' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ success: false, message: 'Akses ditolak.' });
      return;
    }
    next();
  };
}
