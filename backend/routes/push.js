import express from 'express';
import { Expo } from 'expo-server-sdk';
import DeviceToken from '../models/DeviceToken.js';

const router = express.Router();

/**
 * POST /api/push/register
 * Body: { token: string, platform: 'android'|'ios'|'web', userId?: string, deviceId?: string }
 * - Validiert und speichert (upsert) den Expo Push Token.
 * - Verknüpft optional mit userId/deviceId.
 */
router.post('/register', async (req, res) => {
  try {
    const { token, platform, userId = null, deviceId = null } = req.body || {};

    if (!token || !platform) {
      return res.status(400).json({ success: false, error: 'token und platform sind erforderlich' });
    }

    if (!Expo.isExpoPushToken(token)) {
      return res.status(400).json({ success: false, error: 'kein gültiger Expo Push Token' });
    }

    // Upsert nach token; aktualisiert Zuordnung & lastSeenAt
    await DeviceToken.updateOne(
      { token },
      {
        $set: {
          token,
          platform,
          userId: userId || null,
          deviceId: deviceId || null,
          lastSeenAt: new Date(),
          disabled: false
        }
      },
      { upsert: true }
    );

    return res.json({ success: true });
  } catch (err) {
    console.error('Fehler bei /api/push/register:', err);
    return res.status(500).json({ success: false, error: 'Serverfehler bei push/register' });
  }
});

/**
 * (Optional) POST /api/push/unregister
 * Body: { token: string }
 * - Markiert einen Token als disabled (löscht ihn nicht sofort).
 */
router.post('/unregister', async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ success: false, error: 'token erforderlich' });

    await DeviceToken.updateOne({ token }, { $set: { disabled: true } });
    return res.json({ success: true });
  } catch (err) {
    console.error('Fehler bei /api/push/unregister:', err);
    return res.status(500).json({ success: false, error: 'Serverfehler bei push/unregister' });
  }
});

export default router;
