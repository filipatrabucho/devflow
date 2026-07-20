import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import pool from '../db.js';
import { signToken, setAuthCookie, clearAuthCookie, requireAuth } from '../middleware/auth.js';
import { getPermissionsFor, getRoleByKey } from '../permissions.js';
import { isValidCompanyEmail, normalizeEmail } from '../utils/validators.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
});

async function toPublicUser(user) {
  const role = await getRoleByKey(user.role);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    roleLabel: role?.label || user.role,
    avatarPath: user.avatar_path,
    permissions: role?.permissions || (await getPermissionsFor(user.role)),
  };
}

router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body || {};

  if (!isValidCompanyEmail(email) || typeof password !== 'string' || !password) {
    return res.status(400).json({ error: 'Invalid email or password' });
  }

  const normalizedEmail = normalizeEmail(email);
  const [rows] = await pool.execute(
    'SELECT id, name, email, password_hash, role, avatar_path FROM users WHERE email = ? LIMIT 1',
    [normalizedEmail]
  );

  const user = rows[0];
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = signToken(user);
  setAuthCookie(res, token);

  res.json({ user: await toPublicUser(user) });
});

router.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  res.status(204).end();
});

router.get('/me', requireAuth, async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT id, name, email, role, avatar_path FROM users WHERE id = ? LIMIT 1',
    [req.user.id]
  );
  const user = rows[0];
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({ user: await toPublicUser(user) });
});

export default router;
