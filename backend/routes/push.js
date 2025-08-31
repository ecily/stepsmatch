// stepsmatch/backend/routes/push.js
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
  try {
    return !!v && mongoose.Types.ObjectId.isValid(String(v));
  } catch {
    return false;
  }
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

    console.log('[push] register', token.slice(0, 18) + '…', 'platform=', doc.platform, 'deviceId=', doc.deviceId, 'projectId=', projectId);
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
    const { offerId, title, body } = req.body || {};

    // Neuesten aktiven Token nehmen
    const last = await PushToken.findOne({ disabled: { $ne: true } })
      .sort({ lastSeenAt: -1 })
      .lean();

    if (!last?.token) {
      return res.status(404).json({ success: false, error: 'no-token' });
    }

    const payload = {
      offerId: offerId || 'TEST',
      route: offerId ? `/offers/${offerId}` : null,
      t: Date.now(),
    };

    const resp = await sendPush({
      tokens: [last.token],
      title: title || 'StepsMatch',
      body: body || 'Test-Push (Roundtrip)',
      data: payload,
    });

    console.log('[push] roundtrip sent -> tokens=1', JSON.stringify(resp));
    res.json({ success: true, projectId: last.projectId || null, meta: resp });
  } catch (e) {
    console.error('[push] roundtrip error', e);
    res.status(500).json({ success: false, error: 'server-error' });
  }
});

export default router;
