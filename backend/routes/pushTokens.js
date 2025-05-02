import express from 'express';
import PushToken from '../models/PushToken.js';

const router = express.Router();

// POST /api/push-token
router.post('/', async (req, res) => {
  try {
    const { token, platform } = req.body;

    if (!token || !platform) {
      return res.status(400).json({ message: 'Token und Plattform sind erforderlich.' });
    }

    const existing = await PushToken.findOne({ token });
    if (existing) {
      return res.status(200).json({ message: 'Token bereits gespeichert.' });
    }

    const saved = await PushToken.create({ token, platform });
    res.status(201).json(saved);
  } catch (error) {
    console.error('Fehler beim Speichern des Push Tokens:', error);
    res.status(500).json({ message: 'Serverfehler' });
  }
});

export default router;
