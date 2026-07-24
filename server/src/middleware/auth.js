import pool from '../db.js';
import { supabaseAdmin } from '../supabase.js';

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  const [rows] = await pool.execute(
    'SELECT id, name, email, role FROM profiles WHERE id = ? LIMIT 1',
    [data.user.id]
  );
  const profile = rows[0];
  if (!profile) {
    return res.status(401).json({ error: 'No profile found for this account' });
  }

  req.user = { id: profile.id, name: profile.name, email: profile.email, role: profile.role };
  next();
}
