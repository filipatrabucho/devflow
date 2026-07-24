import { Router } from 'express';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { getPermissionsFor, getRoleByKey } from '../permissions.js';

const router = Router();

// Login/logout are handled entirely on the client via supabase-js (Supabase
// Auth issues and refreshes the session). This route just resolves the
// bearer token to our own app-level profile (name/role/permissions).
async function toPublicUser(profile) {
  const role = await getRoleByKey(profile.role);
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role: profile.role,
    roleLabel: role?.label || profile.role,
    avatarPath: profile.avatar_path,
    permissions: role?.permissions || (await getPermissionsFor(profile.role)),
  };
}

router.get('/me', requireAuth, async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT id, name, email, role, avatar_path FROM profiles WHERE id = ? LIMIT 1',
    [req.user.id]
  );
  const profile = rows[0];
  if (!profile) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({ user: await toPublicUser(profile) });
});

export default router;
