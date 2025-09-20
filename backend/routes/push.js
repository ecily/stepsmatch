// stepsmatch/backend/routes/push.js
import express from 'express';
import mongoose from 'mongoose';
import { Expo } from 'expo-server-sdk';
import PushToken from '../models/PushToken.js';
import { sendToDevice } from '../services/pushService.js';

const router = express.Router();

/* ────────────────────────────────────────────────────────────
   Constants & helpers
   ──────────────────────────────────────────────────────────── */
const PLATFORMS = new Set(['android', 'ios', 'web']);

const normPlatform = (p) => {
  const s = String(p || '').toLowerCase().trim();
  return PLATFORMS.has(s) ? s : 'android';
};
const isValidObjectId = (v) => {
  try { return !!v && mongoose.Types.ObjectId.isValid(String(v)); } catch { return false; }
};

console.log('[push] EXPO_ACCESS_TOKEN present =', Boolean(process.env.EXPO_ACCESS_TOKEN));

const PROJECT_ID =
  process.env.EXPO_PROJECT_ID ||
  process.env.EXPO_PROJECT ||
  process.env.PROJECT_ID ||
  null;

console.log('[push] routes projectId =', PROJECT_ID || '(none)');

function normalizePoint(input) {
  if (!input || typeof input !== 'object') return null;
  if (input.type === 'Point' && Array.isArray(input.coordinates) && input.coordinates.length === 2) {
    const [lng, lat] = input.coordinates;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { type: 'Point', coordinates: [lng, lat] };
    }
  }
  const { lat, lng } = input;
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { type: 'Point', coordinates: [lng, lat] };
  }
  return null;
}

/* prefer valid:true */
async function findLatestToken(queryBase, sort = { lastSeenAt: -1, updatedAt: -1, createdAt: -1 }) {
  const tValid = await PushToken.findOne({ ...queryBase, valid: true }).sort(sort).lean();
  if (tValid) return tValid;
  return PushToken.findOne({ ...queryBase, disabled: { $ne: true } }).sort(sort).lean();
}

async function getLatestActiveTokenPreferProject() {
  const baseSort = { lastSeenAt: -1, updatedAt: -1, createdAt: -1 };
  if (PROJECT_ID) {
    const withProject = await findLatestToken({ projectId: PROJECT_ID }, baseSort);
    if (withProject?.token) return withProject;
  }
  return findLatestToken({}, baseSort);
}

async function getLatestActiveTokenForDevice(deviceId, projectIdHint) {
  if (!deviceId) return null;
  const proj = PROJECT_ID || projectIdHint || null;
  const q = proj ? { deviceId, projectId: proj } : { deviceId };
  return findLatestToken(q);
}

async function chooseTargetToken({ token, deviceId, projectId }) {
  if (token && typeof token === 'string') {
    const trimmed = token.trim();
    if (Expo.isExpoPushToken(trimmed)) {
      const doc = await PushToken.findOne({ token: trimmed }).lean();
      return { token: trimmed, projectId: doc?.projectId ?? projectId ?? null, source: 'explicit-token' };
    }
  }
  if (deviceId) {
    const doc = await getLatestActiveTokenForDevice(deviceId, projectId);
    if (doc?.token) {
      return { token: doc.token, projectId: doc.projectId ?? projectId ?? null, source: 'device-latest' };
    }
  }
  const last = await getLatestActiveTokenPreferProject();
  if (last?.token) {
    return { token: last.token, projectId: last.projectId ?? projectId ?? null, source: 'db-prefer-project' };
  }
  return { token: null, projectId: projectId ?? null, source: 'none' };
}

/* ────────────────────────────────────────────────────────────
   Routes
   ──────────────────────────────────────────────────────────── */

router.post('/register', async (req, res) => {
  try {
    const { token, platform, userId, deviceId, projectId, lastLocation } = req.body || {};
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, error: 'token-required' });
    }

    const point = normalizePoint(lastLocation);
    const now = new Date();
    const update = {
      token,
      platform: normPlatform(platform),
      userId: isValidObjectId(userId) ? userId : null,
      deviceId: deviceId || null,
      valid: true,
      disabled: false,
      lastError: null,
      lastTriedAt: null,
      lastSeenAt: now,
      ...(projectId ? { projectId } : {}),
      ...(point ? { lastLocation: point, lastHeartbeatAt: now } : {}),
    };

    const doc = await PushToken.findOneAndUpdate({ token }, update, { new: true, upsert: true });

    if (doc.deviceId) {
      const resInvalidate = await PushToken.updateMany(
        { deviceId: doc.deviceId, token: { $ne: doc.token } },
        { $set: { valid: false, lastError: 'replaced-by-new-token' } }
      );
      if (resInvalidate.modifiedCount > 0) {
        console.log('[push] register: invalidated old tokens', doc.deviceId, resInvalidate.modifiedCount);
      }
    }

    console.log('[push] register', token.slice(0, 22) + '…', 'platform=', doc.platform, 'deviceId=', doc.deviceId);
    res.json({ success: true, id: doc._id, platform: doc.platform, deviceId: doc.deviceId, valid: doc.valid });
  } catch (e) {
    console.error('[push] register error', e);
    res.status(500).json({ success: false, error: 'server-error' });
  }
});

router.post('/roundtrip', async (req, res) => {
  try {
    const { offerId: rawOfferId, title: rawTitle, body: rawBody, token, deviceId, projectId } = req.body || {};
    const target = await chooseTargetToken({ token, deviceId, projectId });
    if (!target.token) return res.status(404).json({ success: false, error: 'no-token' });

    const offerId = rawOfferId || 'TEST';
    const payload = { offerId, route: `/offers/${offerId}`, source: 'roundtrip', t: Date.now() };
    const title = rawTitle || 'StepsMatch';
    const body = (rawBody || 'Test-Push') + ` [offerId:${offerId}]`;

    const resp = await sendToDevice({
      deviceId: deviceId,
      token: target.token,                // <─ optional: Token explizit mitgeben
      message: { title, body, data: payload },
    });

    res.json({ success: true, projectId: target.projectId || null, meta: resp, source: target.source });
  } catch (e) {
    console.error('[push] roundtrip error', e);
    res.status(500).json({ success: false, error: 'server-error' });
  }
});

router.post('/test', async (req, res) => {
  return router.handle({ ...req, url: '/roundtrip', method: 'POST' }, res, () => {});
});

router.post('/ping', async (_req, res) => {
  res.json({ success: true, projectId: PROJECT_ID || null, t: Date.now() });
});

router.post('/roundtrip-diagnose', async (req, res) => {
  try {
    const { token: explicitToken, deviceId, projectId, offerId: rawOfferId, title: rawTitle, body: rawBody } = req.body || {};
    const target = await chooseTargetToken({ token: explicitToken, deviceId, projectId });
    if (!target.token) return res.status(404).json({ success: false, error: 'no-token' });

    const offerId = rawOfferId || 'TEST_DIAG';
    const payload = { offerId, route: `/offers/${offerId}`, source: 'roundtrip', t: Date.now() };
    const title = rawTitle || 'StepsMatch';
    const body = (rawBody || 'Diagnose-Push') + ` [offerId:${offerId}]`;

    const resp = await sendToDevice({
      deviceId: deviceId,
      token: target.token,                // <─ optional
      message: { title, body, data: payload },
    });

    res.json({ success: true, projectId: target.projectId || null, diag: resp, tokenSource: target.source });
  } catch (e) {
    console.error('[push] diagnose error', e);
    res.status(500).json({ success: false, error: 'server-error' });
  }
});

/* ────────────────────────────────────────────────────────────
   Canary endpoint – nutzt (token|deviceId|projectId) aus req.body.
   Antwortschema ist { ok: true|false } um mit der App zu matchen.
   Invalide Tokens werden bei DeviceNotRegistered automatisch untauglich markiert.
   ──────────────────────────────────────────────────────────── */
router.post('/canary', async (req, res) => {
  try {
    const { token, deviceId, projectId } = req.body || {};
    const target = await chooseTargetToken({ token, deviceId, projectId });
    if (!target.token) {
      return res.status(404).json({ ok: false, error: 'no-valid-token' });
    }

    const title = 'StepsMatch Canary';
    const body  = 'Automatischer Test-Push zur Token-Validierung.';
    const payload = { route: '/canary', source: 'canary', t: Date.now() };

    const resp = await sendToDevice({
      deviceId: deviceId ?? null,
      token: target.token,
      message: { title, body, data: payload },
    });

    // DeviceNotRegistered heuristisch erkennen
    const dnrFromReceipts =
      (resp?.receipts && resp.receipts.errors && Number(resp.receipts.errors.DeviceNotRegistered || 0) > 0);
    const dnrFromTickets =
      (Array.isArray(resp?.tickets) && resp.tickets.some(t =>
        (t?.status || '').toLowerCase() === 'error' &&
        String(t?.details?.error || '').toLowerCase() === 'devicenotregistered'
      ));
    const hasDNR = Boolean(dnrFromReceipts || dnrFromTickets);

    let autoInvalidated = false;
    if (hasDNR) {
      const upd = await PushToken.updateOne(
        { token: target.token },
        { $set: { valid: false, lastError: 'DeviceNotRegistered', updatedAt: new Date() } }
      );
      autoInvalidated = upd.modifiedCount > 0;
      console.warn('[push][canary] DeviceNotRegistered – token invalidated:', target.token.slice(0, 22) + '…');
    }

    res.json({
      ok: true,
      projectId: PROJECT_ID || target.projectId || null,
      token: target.token,
      tokenSource: target.source,
      deviceId: deviceId ?? null,
      result: resp,
      autoInvalidated,
    });
  } catch (e) {
    console.error('[push][canary] error', e);
    res.status(500).json({ ok: false, error: 'server-error' });
  }
});

export default router;
