import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const AVATAR_DIR = path.join(__dirname, '..', '..', 'uploads', 'avatars');

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);
const EXT_BY_MIME = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' };

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, AVATAR_DIR),
  filename: (_req, file, cb) => {
    const ext = EXT_BY_MIME[file.mimetype] || '.bin';
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    cb(new Error('Only PNG, JPEG or WEBP images are allowed'));
    return;
  }
  cb(null, true);
}

export const uploadAvatar = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
});

const XLSX_MIME = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream', // some browsers/OSes send this for .xlsx
]);

export const uploadSpreadsheet = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (!XLSX_MIME.has(file.mimetype) && !file.originalname.toLowerCase().endsWith('.xlsx')) {
      cb(new Error('Only .xlsx files are allowed'));
      return;
    }
    cb(null, true);
  },
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
});
