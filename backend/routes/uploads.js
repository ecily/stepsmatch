// backend/routes/uploads.js
import express from 'express';
import cloudinary from '../utils/cloudinary.js';
import multer from 'multer';
import streamifier from 'streamifier';

const router = express.Router();

/* ─────────────────────────────────────────────────────────────
   Multer: Speicher im RAM + Validierung (nur Bilder, max 8 MB)
   ───────────────────────────────────────────────────────────── */
const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 MB

const storage = multer.memoryStorage();

const allowedMimes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
]);

const fileFilter = (req, file, cb) => {
  if (!allowedMimes.has(file.mimetype)) {
    return cb(new Error('Ungültiger Dateityp. Erlaubt: JPEG, PNG, WEBP, GIF, HEIC/HEIF'));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

/* ─────────────────────────────────────────────────────────────
   Hilfsfunktion: Upload Buffer → Cloudinary via Stream
   ───────────────────────────────────────────────────────────── */
function uploadBufferToCloudinary(buffer, opts = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',
        folder: process.env.CLOUDINARY_FOLDER || 'stepsmatch',
        ...opts,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

/* ─────────────────────────────────────────────────────────────
   Hilfsfunktion: public_id aus Cloudinary-URL extrahieren
   ───────────────────────────────────────────────────────────── */
function extractPublicIdFromUrl(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    const uploadIdx = parts.findIndex((p) => p === 'upload');
    if (uploadIdx === -1 || uploadIdx === parts.length - 1) return null;

    const afterUpload = parts.slice(uploadIdx + 1);

    // Transformationen überspringen (Segmente mit Kommas, z. B. "c_fill,w_400")
    let i = 0;
    while (i < afterUpload.length && /[,]/.test(afterUpload[i])) i++;

    // Version "v123" überspringen
    if (i < afterUpload.length && /^v\d+$/.test(afterUpload[i])) i++;

    const pathSegments = afterUpload.slice(i);
    if (pathSegments.length === 0) return null;

    const fileName = pathSegments[pathSegments.length - 1];
    const withoutExt = fileName.replace(/\.[a-zA-Z0-9]+$/, '');

    const folderSegments = pathSegments.slice(0, -1);
    const publicId = folderSegments.length
      ? `${folderSegments.join('/')}/${withoutExt}`
      : withoutExt;

    return publicId || null;
  } catch {
    return null;
  }
}

/* ─────────────────────────────────────────────────────────────
   DEV: Debug‑Ping (zeigt ob Cloudinary konfiguriert ist)
   GET /api/uploads/_debug  -> { configured: true/false }
   ───────────────────────────────────────────────────────────── */
router.get('/_debug', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }
  const cfg = cloudinary.config();
  const configured = Boolean(cfg?.cloud_name && cfg?.api_key);
  return res.json({
    configured,
    cloud_name_present: Boolean(cfg?.cloud_name),
    api_key_present: Boolean(cfg?.api_key),
  });
});

/* ─────────────────────────────────────────────────────────────
   POST /api/uploads
   Body: multipart/form-data  (field: "image")
   Response: { url: string }
   Multer-Errors werden sauber beantwortet.
   ───────────────────────────────────────────────────────────── */
router.post('/', (req, res) => {
  upload.single('image')(req, res, async (err) => {
    if (err) {
      // Multer-spezifische Fehler (z.B. LIMIT_FILE_SIZE)
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res
            .status(413)
            .json({ error: `Bild zu groß. Maximal ${Math.round(MAX_FILE_SIZE / (1024 * 1024))}MB.` });
        }
        return res.status(400).json({ error: `Upload-Fehler: ${err.code}` });
      }
      // Allgemeine Filter-/Validierungsfehler
      return res.status(400).json({ error: err.message || 'Ungültige Datei' });
    }

    try {
      if (!req.file || !req.file.buffer?.length) {
        return res.status(400).json({ error: 'Kein Bild erhalten.' });
      }

      // Optional: einfache "leere Datei"-Wache
      if (req.file.size === 0) {
        return res.status(400).json({ error: 'Leere Datei.' });
      }

      const result = await uploadBufferToCloudinary(req.file.buffer);
      return res.json({ url: result.secure_url });
    } catch (error) {
      const isDev = process.env.NODE_ENV !== 'production';
      console.error('Fehler beim Bild-Upload:', error?.message || error);
      return res
        .status(500)
        .json({ error: 'Serverfehler beim Upload', detail: isDev ? String(error?.message || error) : undefined });
    }
  });
});

/* ─────────────────────────────────────────────────────────────
   DELETE /api/uploads
   Body (JSON): { url: string }
   Response: { success: true }
   ───────────────────────────────────────────────────────────── */
router.delete('/', async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Keine Bild-URL angegeben.' });
    }

    const publicId = extractPublicIdFromUrl(url);
    if (!publicId) {
      return res.status(400).json({ error: 'public_id konnte aus der URL nicht extrahiert werden.' });
    }

    const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });

    if (result?.result === 'ok' || result?.result === 'not found') {
      return res.json({ success: true });
    }
    return res.status(400).json({ error: 'Bild konnte nicht gelöscht werden.' });
  } catch (error) {
    const isDev = process.env.NODE_ENV !== 'production';
    console.error('Fehler beim Löschen des Bildes:', error?.message || error);
    return res
      .status(500)
      .json({ error: 'Serverfehler beim Löschen', detail: isDev ? String(error?.message || error) : undefined });
  }
});

export default router;
