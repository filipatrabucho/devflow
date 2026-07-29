import { Router } from 'express';
import crypto from 'node:crypto';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadBrandingAsset } from '../middleware/upload.js';
import { supabaseAdmin } from '../supabase.js';

const router = Router();

const BRANDING_BUCKET = 'branding';
const EXT_BY_MIME = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/x-icon': '.ico',
};

const BRANDING_FIELDS = `
  app_name AS "appName", tagline, primary_color AS "primaryColor",
  primary_hover_color AS "primaryHoverColor", primary_light_color AS "primaryLightColor",
  logo_url AS "logoUrl", favicon_url AS "faviconUrl"
`;

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only Admin can view or edit branding settings' });
  }
  next();
}

// Public: the login page and every other page need branding before (and
// regardless of) authentication.
router.get('/', async (_req, res) => {
  const [rows] = await pool.query(`SELECT ${BRANDING_FIELDS} FROM branding_settings WHERE id = 1`);
  res.json({ branding: rows[0] || null });
});

router.put('/', requireAuth, requireAdmin, async (req, res) => {
  const { appName, tagline, primaryColor, primaryHoverColor, primaryLightColor } = req.body || {};

  if (appName !== undefined && (typeof appName !== 'string' || appName.trim().length < 1 || appName.length > 60)) {
    return res.status(400).json({ error: 'App name must be between 1 and 60 characters' });
  }
  if (tagline !== undefined && (typeof tagline !== 'string' || tagline.length > 160)) {
    return res.status(400).json({ error: 'Tagline must be at most 160 characters' });
  }
  const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;
  for (const [label, value] of [
    ['Primary color', primaryColor],
    ['Primary hover color', primaryHoverColor],
    ['Primary light color', primaryLightColor],
  ]) {
    if (value !== undefined && !HEX_RE.test(value)) {
      return res.status(400).json({ error: `${label} must be a valid hex color (e.g. #552f86)` });
    }
  }

  const [existingRows] = await pool.query('SELECT * FROM branding_settings WHERE id = 1');
  const existing = existingRows[0];

  await pool.execute(
    `UPDATE branding_settings SET app_name = ?, tagline = ?, primary_color = ?,
       primary_hover_color = ?, primary_light_color = ? WHERE id = 1`,
    [
      appName !== undefined ? appName.trim() : existing.app_name,
      tagline !== undefined ? tagline : existing.tagline,
      primaryColor !== undefined ? primaryColor : existing.primary_color,
      primaryHoverColor !== undefined ? primaryHoverColor : existing.primary_hover_color,
      primaryLightColor !== undefined ? primaryLightColor : existing.primary_light_color,
    ]
  );

  const [rows] = await pool.query(`SELECT ${BRANDING_FIELDS} FROM branding_settings WHERE id = 1`);
  res.json({ branding: rows[0] });
});

function registerAssetUpload(path, column) {
  router.post(path, requireAuth, requireAdmin, (req, res) => {
    uploadBrandingAsset.single('file')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message || 'Invalid file upload' });
      }
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const [existingRows] = await pool.query(`SELECT ${column} AS "prev" FROM branding_settings WHERE id = 1`);
      const previousUrl = existingRows[0]?.prev;

      const ext = EXT_BY_MIME[req.file.mimetype] || '.bin';
      const objectPath = `${column}/${crypto.randomUUID()}${ext}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from(BRANDING_BUCKET)
        .upload(objectPath, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
      if (uploadError) {
        return res.status(500).json({ error: 'Could not upload file' });
      }

      const { data } = supabaseAdmin.storage.from(BRANDING_BUCKET).getPublicUrl(objectPath);
      await pool.execute(`UPDATE branding_settings SET ${column} = ? WHERE id = 1`, [data.publicUrl]);

      if (previousUrl) {
        const previousObjectPath = previousUrl.split(`/${BRANDING_BUCKET}/`)[1];
        if (previousObjectPath) {
          supabaseAdmin.storage.from(BRANDING_BUCKET).remove([previousObjectPath]).catch(() => {});
        }
      }

      res.json({ url: data.publicUrl });
    });
  });
}

registerAssetUpload('/logo', 'logo_url');
registerAssetUpload('/favicon', 'favicon_url');

export default router;
