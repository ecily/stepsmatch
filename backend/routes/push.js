// backend/routes/push.js
import express from 'express';
import mongoose from 'mongoose';
import { sendPush } from '../utils/push.js';
import PushToken from '../models/PushToken.js';

const router = express.Router();

const PLATFORMS = new Set(['android', 'ios', 'web']);
const normPlatform = (p) => {
  const s = String(p || '').toLowerCase().trim();
  return PLATFORMS.has(s) ? s : 'android';
};
const isValidObjectId = (v) => {
  try { return !!v && mongoose.Types.ObjectId.isValid(String(v)); } catch { return false; }
};

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

    console.log('[push] register', token.slice(0, 22) + '…', 'platform=', doc.platform, 'deviceId=', doc.deviceId, 'projectId=', projectId);
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

// POST /api/push/roundtrip
router.post('/roundtrip', async (req, res) => {
  try {
    const { offerId: rawOfferId, title: rawTitle, body: rawBody } = req.body || {};

    // Letzten frischen Token nehmen
    const last = await PushToken.findOne({ disabled: { $ne: true } }).sort({ lastSeenAt: -1 }).lean();
    if (!last?.token) return res.status(404).json({ success: false, error: 'no-token' });

    const offerId = rawOfferId || 'TEST';
    const payload = {
      offerId,
      route: offerId ? `/offers/${offerId}` : null,
      source: 'roundtrip',
      t: Date.now(),
    };

    const title = rawTitle || 'StepsMatch';
    const body = (rawBody || 'Test-Push (Roundtrip)') + ` [offerId:${offerId}]`;

    // Sichtbares Server-Log des exakten Payloads
    console.log('[push] roundtrip build', JSON.stringify({ to: last.token.slice(0, 22) + '…', title, body, data: payload }));

    const resp = await sendPush({
      tokens: [last.token],
      title,
      body,
      data: payload,
    });

    console.log('[push] roundtrip sent', JSON.stringify(resp));
    res.json({ success: true, projectId: last.projectId || null, meta: resp });
  } catch (e) {
    console.error('[push] roundtrip error', e);
    res.status(500).json({ success: false, error: 'server-error' });
  }
});

export default router;
