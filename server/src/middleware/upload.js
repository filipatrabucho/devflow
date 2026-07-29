import multer from 'multer';

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);

function fileFilter(_req, file, cb) {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    cb(new Error('Only PNG, JPEG or WEBP images are allowed'));
    return;
  }
  cb(null, true);
}

export const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
});

const BRANDING_ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/x-icon']);

export const uploadBrandingAsset = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (!BRANDING_ALLOWED_MIME.has(file.mimetype)) {
      cb(new Error('Only PNG, JPEG, WEBP, SVG or ICO images are allowed'));
      return;
    }
    cb(null, true);
  },
  limits: { fileSize: 1 * 1024 * 1024, files: 1 },
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
