import { Router } from 'express';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadAvatar, AVATAR_DIR } from '../middleware/upload.js';
import { requirePermission, getRoles } from '../permissions.js';
import { isValidCompanyEmail, isStrongPassword, normalizeEmail } from '../utils/validators.js';

const router = Router();

const PUBLIC_USER_FIELDS = `
  u.id, u.name, u.email, u.role, r.label AS roleLabel,
  u.avatar_path AS avatarPath, u.created_at AS createdAt
`;
const USER_SELECT = `SELECT ${PUBLIC_USER_FIELDS} FROM users u LEFT JOIN roles r ON r.key_name = u.role`;

router.get('/', requireAuth, async (_req, res) => {
  const [rows] = await pool.query(`${USER_SELECT} ORDER BY u.name ASC`);
  res.json({ users: rows });
});

router.post('/', requireAuth, requirePermission('manageUsers'), async (req, res) => {
  const { name, email, password, role } = req.body || {};

  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 120) {
    return res.status(400).json({ error: 'Name must be between 2 and 120 characters' });
  }
  if (!isValidCompanyEmail(email)) {
    return res.status(400).json({ error: 'Email must be a valid @pkf.pt address' });
  }
  if (!isStrongPassword(password)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const roles = await getRoles();
  const finalRole = roles.some((r) => r.key === role) ? role : 'developer';

  const normalizedEmail = normalizeEmail(email);
  const [existing] = await pool.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [normalizedEmail]);
  if (existing.length > 0) {
    return res.status(409).json({ error: 'A user with this email already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [result] = await pool.execute(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    [name.trim(), normalizedEmail, passwordHash, finalRole]
  );

  const [rows] = await pool.execute(`${USER_SELECT} WHERE u.id = ?`, [result.insertId]);
  res.status(201).json({ user: rows[0] });
});

router.put('/me/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!isStrongPassword(newPassword)) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  const [rows] = await pool.execute('SELECT password_hash FROM users WHERE id = ? LIMIT 1', [req.user.id]);
  const user = rows[0];
  if (!user) return res.status(404).json({ error: 'User not found' });

  const matches = await bcrypt.compare(String(currentPassword || ''), user.password_hash);
  if (!matches) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, req.user.id]);
  res.status(204).end();
});

router.post('/me/avatar', requireAuth, (req, res) => {
  uploadAvatar.single('avatar')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Invalid file upload' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const [rows] = await pool.execute('SELECT avatar_path FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    const previousPath = rows[0]?.avatar_path;

    const relativePath = `/uploads/avatars/${req.file.filename}`;
    await pool.execute('UPDATE users SET avatar_path = ? WHERE id = ?', [relativePath, req.user.id]);

    if (previousPath) {
      const previousFile = path.join(AVATAR_DIR, path.basename(previousPath));
      fs.unlink(previousFile, () => {});
    }

    res.json({ avatarPath: relativePath });
  });
});

router.delete('/:id', requireAuth, requirePermission('manageUsers'), async (req, res) => {
  const targetId = Number(req.params.id);
  if (!Number.isInteger(targetId)) {
    return res.status(400).json({ error: 'Invalid user id' });
  }
  if (targetId === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }

  const [targetRows] = await pool.execute(
    `SELECT r.can_manage_users AS canManageUsers FROM users u
     LEFT JOIN roles r ON r.key_name = u.role WHERE u.id = ? LIMIT 1`,
    [targetId]
  );
  if (!targetRows[0]) {
    return res.status(404).json({ error: 'User not found' });
  }
  if (targetRows[0].canManageUsers) {
    const [[{ managerCount }]] = await pool.query(
      `SELECT COUNT(*) AS managerCount FROM users u
       JOIN roles r ON r.key_name = u.role
       WHERE r.can_manage_users = 1 AND u.id != ?`,
      [targetId]
    );
    if (managerCount === 0) {
      return res.status(400).json({ error: 'Cannot remove the last user who can manage users' });
    }
  }

  await pool.execute('DELETE FROM users WHERE id = ?', [targetId]);
  res.status(204).end();
});

export default router;
