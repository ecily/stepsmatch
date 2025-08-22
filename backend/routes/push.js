// backend/routes/push.js
import express from 'express';
import { Expo } from 'expo-server-sdk';
import mongoose from 'mongoose';
import PushToken from '../models/PushToken.js';
import OfferVisibility, { OFFER_VISIBILITY_STATUS as VIS } from '../models/OfferVisibility.js';

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
    await PushToken.updateOne(
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

    await PushToken.updateOne({ token }, { $set: { disabled: true } });
    return res.json({ success: true });
  } catch (err) {
    console.error('Fehler bei /api/push/unregister:', err);
    return res.status(500).json({ success: false, error: 'Serverfehler bei push/unregister' });
  }
});

/**
 * POST /api/push/action
 * Body:
 *  {
 *    action: 'go' | 'dismiss' | 'snooze',
 *    offerId: string (ObjectId),
 *    token?: string,      // bevorzugt
 *    userId?: string,     // Fallback, wenn token fehlt
 *    minutes?: number     // nur für snooze; Default 60
 *  }
 *
 * Zweck:
 *  - „Los“: markNotified (damit kein weiterer Push für dieses Offer×Gerät)
 *  - „Interessiert mich nicht“: dismissed (nie wieder pushen)
 *  - „Später erinnern“: snooze(minutes) → remindAt gesetzt, danach darf erneut gepusht werden
 */
router.post('/action', async (req, res) => {
  try {
    const { action, offerId, token: inlineToken, userId, minutes } = req.body || {};

    // Validierung: action
    const A = String(action || '').toLowerCase();
    if (!['go', 'dismiss', 'snooze'].includes(A)) {
      return res.status(400).json({ success: false, error: 'Ungültige action' });
    }

    // Validierung: offerId
    if (!offerId || !mongoose.Types.ObjectId.isValid(offerId)) {
      return res.status(400).json({ success: false, error: 'Ungültige offerId' });
    }

    // PushToken bestimmen (bevorzugt via token)
    let dev = null;
    if (typeof inlineToken === 'string' && inlineToken.trim()) {
      dev = await PushToken.findOne({ token: inlineToken.trim() }).lean();
    } else if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      dev = await PushToken.findOne({ userId, disabled: false }).sort({ updatedAt: -1 }).lean();
    }

    if (!dev) {
      return res.status(404).json({ success: false, error: 'Kein aktives DeviceToken gefunden' });
    }
    if (dev.disabled) {
      return res.status(200).json({ success: true, applied: false, reason: 'device-token-disabled' });
    }

    const deviceTokenId = dev._id;

    // Snooze-Dauer bereinigen
    const snoozeMinRaw = Number(minutes);
    const snoozeMin = Number.isFinite(snoozeMinRaw) ? snoozeMinRaw : 60; // Default 60
    const snoozeMinutes = Math.max(5, Math.min(1440, snoozeMin)); // 5 min – 24 h

    let resultDoc = null;
    let newStatus = null;

    if (A === 'go') {
      resultDoc = await OfferVisibility.markNotified(deviceTokenId, offerId, new Date());
      newStatus = VIS.NOTIFIED;
    } else if (A === 'dismiss') {
      resultDoc = await OfferVisibility.dismiss(deviceTokenId, offerId);
      newStatus = VIS.DISMISSED;
    } else if (A === 'snooze') {
      resultDoc = await OfferVisibility.snooze(deviceTokenId, offerId, snoozeMinutes);
      newStatus = VIS.SNOOZED;
    }

    return res.json({
      success: true,
      applied: true,
      action: A,
      offerId,
      deviceToken: dev.token,
      status: newStatus,
      remindAt: resultDoc?.remindAt ?? null,
      updatedAt: resultDoc?.updatedAt ?? null
    });
  } catch (err) {
    console.error('Fehler bei /api/push/action:', err);
    return res.status(500).json({ success: false, error: 'Serverfehler bei push/action' });
  }
});

export default router;
