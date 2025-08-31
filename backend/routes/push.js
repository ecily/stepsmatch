// backend/routes/push.js
import express from 'express';
import { Expo } from 'expo-server-sdk';
import mongoose from 'mongoose';
import PushToken from '../models/PushToken.js';
import OfferVisibility, { OFFER_VISIBILITY_STATUS as VIS } from '../models/OfferVisibility.js';

const router = express.Router();

/* ───────────────────────── Helpers ───────────────────────── */

const PLATFORMS = new Set(['android', 'ios', 'web']);

function normPlatform(p) {
  const s = String(p || '').toLowerCase().trim();
  return PLATFORMS.has(s) ? s : 'android';
}
function isValidObjectId(v) {
  try { return !!v && mongoose.Types.ObjectId.isValid(String(v)); } catch { return false; }
}

/* ───────────────────────── Routes ───────────────────────── */

/**
 * POST /api/push/register
 * Body: { token: string, platform: 'android'|'ios'|'web', userId?: string, deviceId?: string }
 * - Validiert und speichert (upsert) den Expo Push Token.
 * - Verknüpft optional mit userId/deviceId.
 * - Reaktiviert zuvor deaktivierte Tokens.
 */
router.post('/register', async (req, res) => {
  try {
    const rawToken = (req.body?.token ?? '').trim();
    const platform = normPlatform(req.body?.platform);
    const userId = req.body?.userId ? String(req.body.userId).trim() : null;
    const deviceId = req.body?.deviceId ? String(req.body.deviceId).trim() : null;

    if (!rawToken || !platform) {
      return res.status(400).json({ success: false, error: 'token und platform sind erforderlich' });
    }

    // Expo-Token-Validierung (z.B. "ExponentPushToken[xxxx]")
    if (!Expo.isExpoPushToken(rawToken)) {
      return res.status(400).json({ success: false, error: 'kein gültiger Expo Push Token' });
    }

    // optionale Referenzen nur speichern, wenn plausibel
    const $set = {
      token: rawToken,
      platform,
      lastSeenAt: new Date(),
      disabled: false,
      disabledReason: null,
      disabledAt: null,
    };
    if (userId && isValidObjectId(userId)) $set.userId = new mongoose.Types.ObjectId(userId);
    else $set.userId = null;

    // deviceId darf String bleiben (z.B. Install-ID)
    $set.deviceId = deviceId || null;

    const doc = await PushToken.findOneAndUpdate(
      { token: rawToken },
      {
        $setOnInsert: { createdAt: new Date() },
        $set,
      },
      { new: true, upsert: true }
    ).lean();

    return res.json({
      success: true,
      id: String(doc?._id),
      platform: doc?.platform,
      userId: doc?.userId ? String(doc.userId) : null,
      deviceId: doc?.deviceId ?? null,
      disabled: !!doc?.disabled,
      lastSeenAt: doc?.lastSeenAt ?? null,
    });
  } catch (err) {
    console.error('Fehler bei /api/push/register:', err);
    return res.status(500).json({ success: false, error: 'Serverfehler bei push/register' });
  }
});

/**
 * POST /api/push/unregister
 * Body: { token: string }
 * - Markiert einen Token als disabled (löscht ihn nicht).
 */
router.post('/unregister', async (req, res) => {
  try {
    const rawToken = (req.body?.token ?? '').trim();
    if (!rawToken) {
      return res.status(400).json({ success: false, error: 'token erforderlich' });
    }

    const r = await PushToken.updateOne(
      { token: rawToken },
      { $set: { disabled: true, disabledReason: 'manual-unregister', disabledAt: new Date() } }
    );

    return res.json({ success: true, matched: r.matchedCount || r.n, modified: r.modifiedCount || r.nModified });
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
 *  - „go“: markNotified (damit kein weiterer Push für dieses Offer×Gerät)
 *  - „dismiss“: dismissed (nie wieder pushen)
 *  - „snooze“: snooze(minutes) → remindAt gesetzt, danach darf erneut gepusht werden
 */
router.post('/action', async (req, res) => {
  try {
    const action = String(req.body?.action || '').toLowerCase().trim();
    const offerId = String(req.body?.offerId || '').trim();
    const inlineToken = req.body?.token ? String(req.body.token).trim() : null;
    const userId = req.body?.userId ? String(req.body.userId).trim() : null;
    const minutesRaw = Number(req.body?.minutes);

    if (!['go', 'dismiss', 'snooze'].includes(action)) {
      return res.status(400).json({ success: false, error: 'Ungültige action' });
    }
    if (!offerId || !isValidObjectId(offerId)) {
      return res.status(400).json({ success: false, error: 'Ungültige offerId' });
    }

    // Device/Token auflösen
    let dev = null;
    if (inlineToken) {
      dev = await PushToken.findOne({ token: inlineToken }).lean();
    } else if (userId && isValidObjectId(userId)) {
      dev = await PushToken.findOne({ userId: new mongoose.Types.ObjectId(userId), disabled: false })
        .sort({ updatedAt: -1 })
        .lean();
    }

    if (!dev) {
      return res.status(404).json({ success: false, error: 'Kein aktives DeviceToken gefunden' });
    }
    if (dev.disabled) {
      return res.status(200).json({ success: true, applied: false, reason: 'device-token-disabled' });
    }

    const deviceTokenId = dev._id;

    // Snooze-Dauer: clamp 5–1440 Minuten
    const minutes = Number.isFinite(minutesRaw) ? minutesRaw : 60;
    const snoozeMinutes = Math.max(5, Math.min(1440, minutes));

    let resultDoc = null;
    let newStatus = null;

    if (action === 'go') {
      resultDoc = await OfferVisibility.markNotified(deviceTokenId, offerId, new Date());
      newStatus = VIS.NOTIFIED;
    } else if (action === 'dismiss') {
      resultDoc = await OfferVisibility.dismiss(deviceTokenId, offerId);
      newStatus = VIS.DISMISSED;
    } else if (action === 'snooze') {
      resultDoc = await OfferVisibility.snooze(deviceTokenId, offerId, snoozeMinutes);
      newStatus = VIS.SNOOZED;
    }

    return res.json({
      success: true,
      applied: true,
      action,
      offerId,
      deviceToken: dev.token,
      status: newStatus,
      remindAt: resultDoc?.remindAt ?? null,
      updatedAt: resultDoc?.updatedAt ?? null,
    });
  } catch (err) {
    console.error('Fehler bei /api/push/action:', err);
    return res.status(500).json({ success: false, error: 'Serverfehler bei push/action' });
  }
});

export default router;
