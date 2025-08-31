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
function chunk(arr, n = 99) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/* ───────────────────────── Expo Client (mit projectId) ───────────────────────── */

const PROJECT_ID =
  process.env.EXPO_PROJECT_ID ||
  process.env.EXPO_PROJECTID ||
  process.env.EXPO_PROJECT ||
  null;

// ⚠️ Wichtig: projectId muss mit der App übereinstimmen (getExpoPushTokenAsync({ projectId }))
const expo = new Expo(PROJECT_ID ? { projectId: PROJECT_ID } : {});

/**
 * Sendet Push-Nachrichten über Expo mit korrekten Android-Parametern.
 * - Verwendet projectId (Header) → verhindert DeviceNotRegistered bei frischen Tokens
 * - Fügt channelId, categoryId, priority, ttl, data hinzu
 * - Holt Expo-Receipts ab und deaktiviert ungültige Tokens
 */
async function sendExpoPushSafe(tokens, payload) {
  const validDocs = (tokens || []).filter(t => t && Expo.isExpoPushToken(t.token) && !t.disabled);
  if (validDocs.length === 0) {
    return { sent: 0, tickets: [], errors: ['no-valid-tokens'], disabledTokens: [] };
  }

  const base = {
    title: payload.title,
    body: payload.body,
    sound: payload.sound ?? 'default',
    priority: payload.priority ?? 'high',
    ttl: typeof payload.ttl === 'number' ? payload.ttl : 300,
    data: payload.data || {},
    channelId: payload.channelId || 'offers',    // muss mit App-Channel übereinstimmen
    categoryId: payload.categoryId || 'offer-go' // muss mit App-Category übereinstimmen
  };

  // Nachrichten bauen
  const messages = validDocs.map(d => ({ to: d.token, ...base }));

  const tickets = [];
  const errors = [];
  const disabledTokens = [];
  const idToToken = {}; // Map: receiptId -> token (via Send-Reihenfolge)

  // Tickets holen (in geordneter Reihenfolge)
  for (const batch of chunk(messages, 99)) {
    try {
      const batchTickets = await expo.sendPushNotificationsAsync(batch);
      // Mappe zurück: ticket[i] gehört zu batch[i]
      batchTickets.forEach((t, i) => {
        const msg = batch[i];
        if (t && t.id && msg && msg.to) idToToken[t.id] = msg.to;
      });
      tickets.push(...(Array.isArray(batchTickets) ? batchTickets : []));
    } catch (e) {
      errors.push(`expo-send:${e?.message || String(e)}`);
    }
  }

  // Receipts holen und Tokens ggf. deaktivieren
  const ids = tickets.map(t => t?.id).filter(Boolean);
  for (const idBatch of chunk(ids, 99)) {
    try {
      const receipts = await expo.getPushNotificationReceiptsAsync(idBatch);
      for (const [id, r] of Object.entries(receipts || {})) {
        if (!r) continue;
        if (r.status === 'ok') continue;

        if (r.status === 'error') {
          const err =
            r.details?.error ||
            r.details?.errorCode ||
            r.message ||
            'unknown';
          errors.push(`receipt:${id}:${err}`);

          // Bestimmte Fehler → Token deaktivieren
          if (/DeviceNotRegistered|MessageTooBig|MessageRateExceeded|InvalidCredentials/i.test(String(err))) {
            const token = idToToken[id];
            if (token) {
              try {
                await PushToken.updateOne(
                  { token },
                  { $set: { disabled: true, disabledReason: String(err), disabledAt: new Date(), updatedAt: new Date() } }
                );
                disabledTokens.push(token);
              } catch {
                // ignore
              }
            }
          }
        }
      }
    } catch (e) {
      errors.push(`expo-receipts:${e?.message || String(e)}`);
    }
  }

  const sent = tickets.filter(t => t?.status === 'ok').length;
  if (errors.length) console.warn('[push] errors', errors.slice(0, 6));
  return { sent, tickets, errors, disabledTokens, projectId: PROJECT_ID || null };
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

    if (!Expo.isExpoPushToken(rawToken)) {
      return res.status(400).json({ success: false, error: 'kein gültiger Expo Push Token' });
    }

    const $set = {
      token: rawToken,
      platform,
      lastSeenAt: new Date(),
      disabled: false,
      disabledReason: null,
      disabledAt: null,
      updatedAt: new Date(),
    };
    if (userId && isValidObjectId(userId)) $set.userId = new mongoose.Types.ObjectId(userId);
    else $set.userId = null;

    $set.deviceId = deviceId || null;

    const doc = await PushToken.findOneAndUpdate(
      { token: rawToken },
      { $setOnInsert: { createdAt: new Date() }, $set },
      { new: true, upsert: true }
    ).lean();

    console.log('[push] register ok for', rawToken.slice(0, 28) + '…', 'projectId=', PROJECT_ID || '—');
    return res.json({
      success: true,
      id: String(doc?._id),
      platform: doc?.platform,
      userId: doc?.userId ? String(doc.userId) : null,
      deviceId: doc?.deviceId ?? null,
      disabled: !!doc?.disabled,
      lastSeenAt: doc?.lastSeenAt ?? null,
      projectId: PROJECT_ID || null,
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
      { $set: { disabled: true, disabledReason: 'manual-unregister', disabledAt: new Date(), updatedAt: new Date() } }
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

/**
 * (Debug) POST /api/push/test
 * Body: { token?: string, userId?: string, title?: string, body?: string, data?: object }
 * - Sendet sofort einen Push (Foreground-kompatibel, falls Client NotificationHandler zeigt).
 * - Nutzt unified pipeline + projectId, wertet Receipts aus und deaktiviert ungültige Tokens.
 */
router.post('/test', async (req, res) => {
  try {
    let tok = (req.body?.token ?? '').trim();
    const userId = req.body?.userId ? String(req.body.userId).trim() : null;

    if (!tok && userId && isValidObjectId(userId)) {
      const dev = await PushToken.findOne({ userId: new mongoose.Types.ObjectId(userId), disabled: false })
        .sort({ updatedAt: -1 }).lean();
      tok = dev?.token || '';
    }
    if (!tok) return res.status(400).json({ success: false, error: 'token (oder userId) erforderlich' });
    if (!Expo.isExpoPushToken(tok)) return res.status(400).json({ success: false, error: 'kein gültiger Expo Push Token' });

    const title = req.body?.title || 'StepsMatch • Test';
    const body  = req.body?.body  || 'Foreground/Background Test';
    const data  = req.body?.data  || {};

    const meta = await sendExpoPushSafe([{ token: tok, disabled: false }], {
      title, body, data, sound: 'default', priority: 'high', ttl: 300,
      channelId: 'offers', categoryId: 'offer-go'
    });

    return res.json({ success: true, projectId: PROJECT_ID || null, meta });
  } catch (err) {
    console.error('Fehler bei /api/push/test:', err);
    return res.status(500).json({ success: false, error: 'Serverfehler bei push/test' });
  }
});

export default router;
