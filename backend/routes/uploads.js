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

const fileFilter = (req, file, cb) => {
  // Erlaubte MIME-Typen
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error('Ungültiger Dateityp. Erlaubt sind: JPEG, PNG, WEBP, GIF, HEIC/HEIF'));
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
        folder: process.env.CLOUDINARY_FOLDER || 'stepsmatch', // optional: ENV-Ordner
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
   Unterstützt Pfade, Versionen (v123), Transformationen.
   Beispiel:
   https://res.cloudinary.com/<cloud>/image/upload/v1700000000/folder/sub/name.jpg
   https://.../image/upload/c_fill,w_400,h_300/v1700000000/folder/name.webp
   ───────────────────────────────────────────────────────────── */
function extractPublicIdFromUrl(url) {
  try {
    const u = new URL(url);
    // Path ohne Query/Hash, z.B.: /<cloud>/image/upload/v123/folder/name.jpg
    const parts = u.pathname.split('/').filter(Boolean);

    // Finde Index von 'upload' Segment
    const uploadIdx = parts.findIndex((p) => p === 'upload');
    if (uploadIdx === -1 || uploadIdx === parts.length - 1) return null;

    // Segmente NACH 'upload'
    const afterUpload = parts.slice(uploadIdx + 1); // z.B. ["v123", "folder", "name.jpg"] oder ["c_fill,w_400", "v123", "folder","name.jpg"]

    // Transformationen entfernen: alle Segmente bis zum ersten, das wie 'v\d+' aussieht ODER kein Transform ist
    let i = 0;

    // Falls das erste Segment eine Transformation ist (enthält Kommas/Unterstriche/Buchstaben), überspringen
    while (i < afterUpload.length && /[,]/.test(afterUpload[i])) i++;

    // Version v123 entfernen
    if (i < afterUpload.length && /^v\d+$/.test(afterUpload[i])) i++;

    // Rest sind Ordner + Dateiname
    const pathSegments = afterUpload.slice(i);
    if (pathSegments.length === 0) return null;

    // Letztes Segment ist Dateiname mit Extension
    const fileName = pathSegments[pathSegments.length - 1];
    const withoutExt = fileName.replace(/\.[a-zA-Z0-9]+$/, ''); // entferne .jpg/.png/.webp/...

    const folderSegments = pathSegments.slice(0, -1);
    const publicId = folderSegments.length ? `${folderSegments.join('/')}/${withoutExt}` : withoutExt;

    return publicId || null;
  } catch {
    return null;
  }
}

/* ─────────────────────────────────────────────────────────────
   POST /api/uploads   (ein einzelnes Bild)
   Body: multipart/form-data  (field: "image")
   Response: { url: string }
   ───────────────────────────────────────────────────────────── */
router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Kein Bild erhalten.' });
    }

    const result = await uploadBufferToCloudinary(req.file.buffer);
    // result.secure_url enthält die öffentlich erreichbare URL
    return res.json({ url: result.secure_url });
  } catch (error) {
    console.error('Fehler beim Bild-Upload:', error?.message || error);
    if (error?.message?.includes('File size too large')) {
      return res.status(413).json({ error: `Bild zu groß. Maximal ${Math.round(MAX_FILE_SIZE / (1024 * 1024))}MB.` });
    }
    if (error?.message?.includes('Invalid image file')) {
      return res.status(400).json({ error: 'Ungültige Bilddatei.' });
    }
    return res.status(500).json({ error: 'Serverfehler beim Upload' });
  }
});

/* ─────────────────────────────────────────────────────────────
   DELETE /api/uploads    (Bild löschen)
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
      // "not found" als Erfolg behandeln: idempotentes Löschen
      return res.json({ success: true });
    }

    return res.status(400).json({ error: 'Bild konnte nicht gelöscht werden.' });
  } catch (error) {
    console.error('Fehler beim Löschen des Bildes:', error?.message || error);
    return res.status(500).json({ error: 'Serverfehler beim Löschen' });
  }
});

export default router;
