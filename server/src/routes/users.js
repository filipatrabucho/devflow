import { Router } from 'express';
import crypto from 'node:crypto';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadAvatar } from '../middleware/upload.js';
import { requirePermission, getRoles } from '../permissions.js';
import { supabaseAdmin, supabaseAnon } from '../supabase.js';
import { isValidEmail, isStrongPassword, isUuid, normalizeEmail } from '../utils/validators.js';

const router = Router();

const PUBLIC_USER_FIELDS = `
  p.id, p.name, p.email, p.role, r.label AS "roleLabel",
  p.avatar_path AS "avatarPath", p.created_at AS "createdAt"
`;
const USER_SELECT = `SELECT ${PUBLIC_USER_FIELDS} FROM profiles p LEFT JOIN roles r ON r.key_name = p.role`;

const AVATAR_BUCKET = 'avatars';
const EXT_BY_MIME = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' };

async function isLastManager(targetId) {
  const [[{ managerCount }]] = await pool.query(
    `SELECT COUNT(*) AS "managerCount" FROM profiles p
     JOIN roles r ON r.key_name = p.role
     WHERE r.can_manage_users = TRUE AND p.id != ?`,
    [targetId]
  );
  return Number(managerCount) === 0;
}

router.get('/', requireAuth, async (_req, res) => {
  const [rows] = await pool.query(`${USER_SELECT} ORDER BY p.name ASC`);
  res.json({ users: rows });
});

router.post('/', requireAuth, requirePermission('manageUsers'), async (req, res) => {
  const { name, email, password, role } = req.body || {};

  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 120) {
    return res.status(400).json({ error: 'Name must be between 2 and 120 characters' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'A valid email address is required' });
  }
  if (!isStrongPassword(password)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const roles = await getRoles();
  const finalRole = roles.some((r) => r.key === role) ? role : 'developer';
  const normalizedEmail = normalizeEmail(email);

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
  });
  if (error) {
    const status = /already/i.test(error.message) ? 409 : 400;
    return res.status(status).json({ error: error.message });
  }

  await pool.execute(
    'INSERT INTO profiles (id, name, email, role) VALUES (?, ?, ?, ?)',
    [data.user.id, name.trim(), normalizedEmail, finalRole]
  );

  const [rows] = await pool.execute(`${USER_SELECT} WHERE p.id = ?`, [data.user.id]);
  res.status(201).json({ user: rows[0] });
});

router.put('/:id', requireAuth, requirePermission('manageUsers'), async (req, res) => {
  const targetId = req.params.id;
  if (!isUuid(targetId)) {
    return res.status(400).json({ error: 'Invalid user id' });
  }

  const { role } = req.body || {};
  const roles = await getRoles();
  const nextRole = roles.find((r) => r.key === role);
  if (!nextRole) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  const [targetRows] = await pool.execute(
    `SELECT r.can_manage_users AS "canManageUsers" FROM profiles p
     LEFT JOIN roles r ON r.key_name = p.role WHERE p.id = ? LIMIT 1`,
    [targetId]
  );
  if (!targetRows[0]) {
    return res.status(404).json({ error: 'User not found' });
  }

  const losingManageUsers = targetRows[0].canManageUsers && !nextRole.permissions.manageUsers;
  if (losingManageUsers && (await isLastManager(targetId))) {
    return res.status(400).json({ error: 'Cannot remove the last user who can manage users' });
  }

  await pool.execute('UPDATE profiles SET role = ? WHERE id = ?', [role, targetId]);
  const [rows] = await pool.execute(`${USER_SELECT} WHERE p.id = ?`, [targetId]);
  res.json({ user: rows[0] });
});

router.put('/me/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!isStrongPassword(newPassword)) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  const { error: signInError } = await supabaseAnon.auth.signInWithPassword({
    email: req.user.email,
    password: String(currentPassword || ''),
  });
  if (signInError) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(req.user.id, { password: newPassword });
  if (error) {
    return res.status(400).json({ error: error.message });
  }
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

    const [rows] = await pool.execute('SELECT avatar_path FROM profiles WHERE id = ? LIMIT 1', [req.user.id]);
    const previousPath = rows[0]?.avatar_path;

    const ext = EXT_BY_MIME[req.file.mimetype] || '.bin';
    const objectPath = `${req.user.id}/${crypto.randomUUID()}${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(AVATAR_BUCKET)
      .upload(objectPath, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
    if (uploadError) {
      return res.status(500).json({ error: 'Could not upload avatar' });
    }

    const { data } = supabaseAdmin.storage.from(AVATAR_BUCKET).getPublicUrl(objectPath);
    await pool.execute('UPDATE profiles SET avatar_path = ? WHERE id = ?', [data.publicUrl, req.user.id]);

    if (previousPath) {
      const previousObjectPath = previousPath.split(`/${AVATAR_BUCKET}/`)[1];
      if (previousObjectPath) {
        supabaseAdmin.storage.from(AVATAR_BUCKET).remove([previousObjectPath]).catch(() => {});
      }
    }

    res.json({ avatarPath: data.publicUrl });
  });
});

router.delete('/:id', requireAuth, requirePermission('manageUsers'), async (req, res) => {
  const targetId = req.params.id;
  if (!isUuid(targetId)) {
    return res.status(400).json({ error: 'Invalid user id' });
  }
  if (targetId === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }

  const [targetRows] = await pool.execute(
    `SELECT r.can_manage_users AS "canManageUsers" FROM profiles p
     LEFT JOIN roles r ON r.key_name = p.role WHERE p.id = ? LIMIT 1`,
    [targetId]
  );
  if (!targetRows[0]) {
    return res.status(404).json({ error: 'User not found' });
  }
  if (targetRows[0].canManageUsers && (await isLastManager(targetId))) {
    return res.status(400).json({ error: 'Cannot remove the last user who can manage users' });
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(targetId);
  if (error) {
    return res.status(500).json({ error: 'Could not delete user' });
  }
  res.status(204).end();
});

export default router;
