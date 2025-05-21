// backend/routes/uploads.js
import express from 'express';
import cloudinary from '../utils/cloudinary.js';
import multer from 'multer';
import streamifier from 'streamifier';
import cors from 'cors'; // CORS-Import

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ✅ CORS für Upload-Route
router.use(cors({
  origin: 'http://localhost:5173', // Web-Frontend lokal
  credentials: true, // Sicherstellen, dass Cookies gesendet werden
}));

// ✅ Upload eines Bildes zu Cloudinary
router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Kein Bild erhalten.' });
    }

    const streamUpload = (buffer) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { resource_type: 'image' },
          (error, result) => {
            if (result) resolve(result);
            else reject(error);
          }
        );
        streamifier.createReadStream(buffer).pipe(stream);
      });
    };

    const result = await streamUpload(req.file.buffer);
    res.json({ url: result.secure_url });
  } catch (error) {
    console.error('Fehler beim Bild-Upload:', error);
    res.status(500).json({ error: 'Serverfehler beim Upload' });
  }
});

// ✅ Löschen eines Bildes von Cloudinary
router.delete('/', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'Keine Bild-URL angegeben.' });
    }

    // Extrahiere die public_id aus der Cloudinary-URL
    const parts = url.split('/');
    const fileWithExtension = parts[parts.length - 1];
    const publicId = fileWithExtension.split('.')[0];

    const folder = parts[parts.length - 2]; // evtl. Cloudinary-Ordner, falls vorhanden
    const fullPublicId = `${folder}/${publicId}`;

    const result = await cloudinary.uploader.destroy(fullPublicId, {
      resource_type: 'image',
    });

    if (result.result === 'ok') {
      res.json({ success: true, message: 'Bild erfolgreich gelöscht.' });
    } else {
      res.status(400).json({ error: 'Bild konnte nicht gelöscht werden.' });
    }
  } catch (error) {
    console.error('Fehler beim Löschen des Bildes:', error);
    res.status(500).json({ error: 'Serverfehler beim Löschen' });
  }
});

export default router;
