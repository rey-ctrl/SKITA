import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/store.js';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth.js';
import { User, GlobalRole, AuditLog } from '../types/index.js';

const router = Router();
router.use(authMiddleware, requireRole('admin'));

function auditEntry(actor_id: string, action: string, target_type: string, target_id: string, details?: Record<string, any>): AuditLog {
  return {
    id: 'aud_' + Date.now(),
    actor_id,
    action,
    target_type,
    target_id,
    details,
    timestamp: new Date().toISOString(),
  };
}

function safeUser(u: User) {
  return {
    id: u.id,
    nama: u.nama,
    email: u.email,
    role: u.role,
    is_active: u.is_active,
    must_change_password: u.must_change_password,
    created_at: u.created_at,
  };
}

function countAdmins(): number {
  let count = 0;
  for (const u of db.users.values()) {
    if (u.role === 'admin' && u.is_active !== false) count++;
  }
  return count;
}

// GET /api/admin/users — FR-A8 (P0)
router.get('/users', (req: AuthRequest, res: Response) => {
  const { role, search } = req.query as { role?: string; search?: string };

  let users = [...db.users.values()];

  if (role) {
    users = users.filter((u) => u.role === role);
  }

  if (search) {
    const q = search.toLowerCase();
    users = users.filter(
      (u) => u.nama.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }

  res.json({ success: true, users: users.map(safeUser) });
});

// POST /api/admin/users — FR-A1 (P0)
router.post('/users', (req: AuthRequest, res: Response) => {
  const actorId = req.user!.userId;
  const { nama, email, password, role } = req.body;

  if (!nama || !email || !password || !role) {
    res.status(400).json({ success: false, message: 'nama, email, password, role wajib diisi.' });
    return;
  }

  if (role !== 'sekolah' && role !== 'admin') {
    res.status(400).json({ success: false, message: 'Admin hanya dapat membuat akun sekolah atau admin.' });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ success: false, message: 'Password minimal 8 karakter.' });
    return;
  }

  for (const u of db.users.values()) {
    if (u.email.toLowerCase() === email.toLowerCase().trim()) {
      res.status(409).json({ success: false, message: 'Email sudah terdaftar.' });
      return;
    }
  }

  const newUser: User = {
    id: `usr_${Date.now()}`,
    nama: nama.trim(),
    email: email.toLowerCase().trim(),
    password_hash: bcrypt.hashSync(password, bcrypt.genSaltSync(10)),
    role: role as GlobalRole,
    is_active: true,
    must_change_password: true,
    created_at: new Date().toISOString(),
  };

  db.users.set(newUser.id, newUser);

  const log = auditEntry(actorId, 'admin_create_user', 'user', newUser.id, { role, email: newUser.email });
  db.auditLog.set(log.id, log);

  res.status(201).json({ success: true, user: safeUser(newUser) });
});

// PATCH /api/admin/users/:id/role — FR-A1 (P0)
router.patch('/users/:id/role', (req: AuthRequest, res: Response) => {
  const actorId = req.user!.userId;
  const targetId = req.params.id as string;
  const { role } = req.body as { role: GlobalRole };

  if (!role) {
    res.status(400).json({ success: false, message: 'role wajib diisi.' });
    return;
  }

  if (actorId === targetId) {
    res.status(400).json({ success: false, message: 'Admin tidak dapat mengubah role diri sendiri.' });
    return;
  }

  const target = db.users.get(targetId);
  if (!target) {
    res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    return;
  }

  if (target.role === 'admin' && countAdmins() <= 1) {
    res.status(400).json({ success: false, message: 'Tidak dapat mengubah role admin terakhir.' });
    return;
  }

  const oldRole = target.role;
  target.role = role;
  target.updated_at = new Date().toISOString();
  db.users.set(targetId, target);

  const log = auditEntry(actorId, 'admin_change_role', 'user', targetId, { from: oldRole, to: role });
  db.auditLog.set(log.id, log);

  res.json({ success: true, user: safeUser(target) });
});

// PATCH /api/admin/users/:id/deactivate — FR-A9 (P0)
router.patch('/users/:id/deactivate', (req: AuthRequest, res: Response) => {
  const actorId = req.user!.userId;
  const targetId = req.params.id as string;

  if (actorId === targetId) {
    res.status(400).json({ success: false, message: 'Admin tidak dapat menonaktifkan diri sendiri.' });
    return;
  }

  const target = db.users.get(targetId);
  if (!target) {
    res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    return;
  }

  if (target.role === 'admin' && countAdmins() <= 1) {
    res.status(400).json({ success: false, message: 'Tidak dapat menonaktifkan admin terakhir.' });
    return;
  }

  target.is_active = false;
  target.updated_at = new Date().toISOString();
  db.users.set(targetId, target);

  const log = auditEntry(actorId, 'admin_deactivate_user', 'user', targetId);
  db.auditLog.set(log.id, log);

  res.json({ success: true, message: 'Akun berhasil dinonaktifkan.' });
});

// PATCH /api/admin/users/:id/reset-password — FR-A1 (P0)
router.patch('/users/:id/reset-password', (req: AuthRequest, res: Response) => {
  const actorId = req.user!.userId;
  const targetId = req.params.id as string;

  const target = db.users.get(targetId);
  if (!target) {
    res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    return;
  }

  let newPassword: string = req.body.new_password;
  let generated = false;

  if (!newPassword) {
    // Generate random 8-char alphanumeric
    newPassword = Math.random().toString(36).slice(2, 10);
    generated = true;
  }

  if (newPassword.length < 8) {
    res.status(400).json({ success: false, message: 'Password minimal 8 karakter.' });
    return;
  }

  target.password_hash = bcrypt.hashSync(newPassword, bcrypt.genSaltSync(10));
  target.must_change_password = true;
  target.updated_at = new Date().toISOString();
  db.users.set(targetId, target);

  const log = auditEntry(actorId, 'admin_reset_password', 'user', targetId);
  db.auditLog.set(log.id, log);

  const payload: Record<string, any> = { success: true, message: 'Password berhasil direset.' };
  if (generated) payload.temp_password = newPassword;

  res.json(payload);
});

// DELETE /api/admin/users/:id — Hapus akun permanen oleh Admin
router.delete('/users/:id', (req: AuthRequest, res: Response) => {
  const actorId = req.user!.userId;
  const targetId = req.params.id as string;

  if (actorId === targetId) {
    res.status(400).json({ success: false, message: 'Admin tidak dapat menghapus akun diri sendiri.' });
    return;
  }

  const target = db.users.get(targetId);
  if (!target) {
    res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    return;
  }

  if (target.role === 'admin' && countAdmins() <= 1) {
    res.status(400).json({ success: false, message: 'Tidak dapat menghapus admin terakhir.' });
    return;
  }

  // Hapus keanggotaan sekolah & kelas user
  for (const [id, sm] of db.schoolMemberships.entries()) {
    if (sm.user_id === targetId) db.schoolMemberships.delete(id);
  }
  for (const [id, cm] of db.classMemberships.entries()) {
    if (cm.user_id === targetId) db.classMemberships.delete(id);
  }

  // Hapus akun user
  db.users.delete(targetId);

  const log = auditEntry(actorId, 'admin_delete_user', 'user', targetId, {
    deleted_user: { nama: target.nama, email: target.email, role: target.role },
  });
  db.auditLog.set(log.id, log);

  res.json({ success: true, message: `Akun ${target.nama} berhasil dihapus permanen.` });
});

export default router;
