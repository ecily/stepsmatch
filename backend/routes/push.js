// backend/routes/push.js
import express from 'express';
import mongoose from 'mongoose';
import PushToken from '../models/PushToken.js';
import { sendPush, sendPushAndCheckReceipts } from '../utils/push.js';

const router = express.Router();

// ────────── Konstants & Helpers ──────────
const PLATFORMS = new Set(['android', 'ios', 'web']);
const DEFAULT_CHANNEL = 'offers'; // 🔔 Für Android-Channel-Zuordnung

const normPlatform = (p) => {
  const s = String(p || '').toLowerCase().trim();
  return PLATFORMS.has(s) ? s : 'android';
};
const isValidObjectId = (v) => {
  try { return !!v && mongoose.Types.ObjectId.isValid(String(v)); } catch { return false; }
};

// (Nur Info/Health) – nicht den Token selbst loggen
console.log('[push] EXPO_ACCESS_TOKEN present =', Boolean(process.env.EXPO_ACCESS_TOKEN));

// ────────── Routes ──────────

// POST /api/push/register
router.post('/register', async (req, res) => {
  try {
    const { token, platform, userId, deviceId, projectId, lastLocation } = req.body || {};
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, error: 'token-required' });
    }
    const doc = await PushToken.findOneAndUpdate(
      { token },
      {
        token,
        platform: normPlatform(platform),
        userId: isValidObjectId(userId) ? userId : null,
        deviceId: deviceId || null,
        disabled: false,
        lastSeenAt: new Date(),
        ...(projectId ? { projectId } : {}),
        ...(lastLocation && lastLocation.type === 'Point' ? { lastLocation } : {}),
      },
      { new: true, upsert: true }
    );
    console.log(
      '[push] register',
      token.slice(0, 22) + '…',
      'platform=', doc.platform,
      'deviceId=', doc.deviceId,
      'projectId=', projectId
    );
    res.json({
      success: true,
      id: doc._id,
      platform: doc.platform,
      userId: doc.userId,
      deviceId: doc.deviceId,
      disabled: doc.disabled,
      lastSeenAt: doc.lastSeenAt,
      projectId,
    });
  } catch (e) {
    console.error('[push] register error', e);
    res.status(500).json({ success: false, error: 'server-error' });
  }
});

// POST /api/push/roundtrip (quick send, wie gehabt)
router.post('/roundtrip', async (req, res) => {
  try {
    const { offerId: rawOfferId, title: rawTitle, body: rawBody } = req.body || {};
    const last = await PushToken.findOne({ disabled: { $ne: true } }).sort({ lastSeenAt: -1 }).lean();
    if (!last?.token) return res.status(404).json({ success: false, error: 'no-token' });

    const offerId = rawOfferId || 'TEST';
    const payload = { offerId, route: `/offers/${offerId}`, source: 'roundtrip', t: Date.now() };
    const title = rawTitle || 'StepsMatch';
    const body = (rawBody || 'Test-Push (Roundtrip)') + ` [offerId:${offerId}]`;

    console.log(
      '[push] roundtrip build',
      JSON.stringify({ to: last.token.slice(0, 22) + '…', title, body, data: payload, channelId: DEFAULT_CHANNEL })
    );

    // ➕ channelId mitschicken
    const resp = await sendPush({
      tokens: [last.token],
      title,
      body,
      data: payload,
      channelId: DEFAULT_CHANNEL,
      sound: 'default',
      priority: 'high',
    });

    console.log('[push] roundtrip sent', JSON.stringify(resp));
    res.json({ success: true, projectId: last.projectId || null, meta: resp });
  } catch (e) {
    console.error('[push] roundtrip error', e);
    res.status(500).json({ success: false, error: 'server-error' });
  }
});

// POST /api/push/roundtrip-diagnose (send + receipts)
// Neu: akzeptiert optional req.body.token und sendet IMMER damit, auch wenn dieser in der DB disabled ist.
router.post('/roundtrip-diagnose', async (req, res) => {
  try {
    const { token: explicitToken, offerId: rawOfferId, title: rawTitle, body: rawBody } = req.body || {};

    let chosenToken = null;
    let projectId = null;
    let tokenSource = 'db-latest-enabled';

    if (explicitToken && typeof explicitToken === 'string') {
      chosenToken = explicitToken.trim();
      tokenSource = 'explicit';
      // Optional: projectId aus DB nachziehen, auch wenn disabled
      const doc = await PushToken.findOne({ token: chosenToken }).lean();
      if (doc?.projectId) projectId = doc.projectId;
    } else {
      const last = await PushToken.findOne({ disabled: { $ne: true } }).sort({ lastSeenAt: -1 }).lean();
      if (!last?.token) return res.status(404).json({ success: false, error: 'no-token' });
      chosenToken = last.token;
      projectId = last.projectId || null;
    }

    const offerId = rawOfferId || 'TEST_DIAG';
    const payload = { offerId, route: `/offers/${offerId}`, source: 'roundtrip', t: Date.now() };
    const title = rawTitle || 'StepsMatch';
    const body = (rawBody || 'Diagnose-Push (Roundtrip)') + ` [offerId:${offerId}]`;

    console.log(
      '[push] diagnose build',
      JSON.stringify({
        to: chosenToken.slice(0, 22) + '…',
        title,
        body,
        data: payload,
        channelId: DEFAULT_CHANNEL,
        tokenSource
      })
    );

    // ➕ channelId mitschicken
    const diag = await sendPushAndCheckReceipts({
      tokens: [chosenToken],
      title,
      body,
      data: payload,
      channelId: DEFAULT_CHANNEL,
      sound: 'default',
      priority: 'high',
      delayMs: 3500,
      // Hinweis: Grace-Periode (DeviceNotRegistered bei frischen Tokens) wird in utils/push.js behandelt.
    });

    console.log('[push] diagnose sent', JSON.stringify(diag.sent));
    console.log('[push] diagnose receipts summary', JSON.stringify(diag.receipts.summary));
    res.json({ success: true, projectId, diag, tokenSource });
  } catch (e) {
    console.error('[push] diagnose error', e);
    res.status(500).json({ success: false, error: 'server-error' });
  }
});

export default router;
