// backend/routes/push.js
import express from 'express';
import mongoose from 'mongoose';
import { Expo } from 'expo-server-sdk';
import PushToken from '../models/PushToken.js';
import { sendPush, sendPushAndCheckReceipts } from '../utils/push.js';

const router = express.Router();

/* ────────────────────────────────────────────────────────────
   Constants & helpers
   ──────────────────────────────────────────────────────────── */
const PLATFORMS = new Set(['android', 'ios', 'web']);
const DEFAULT_CHANNEL = 'offers'; // Android-Channel

const normPlatform = (p) => {
  const s = String(p || '').toLowerCase().trim();
  return PLATFORMS.has(s) ? s : 'android';
};
const isValidObjectId = (v) => {
  try { return !!v && mongoose.Types.ObjectId.isValid(String(v)); } catch { return false; }
};

// Nur Health-Log (Token selbst nicht loggen)
console.log('[push] EXPO_ACCESS_TOKEN present =', Boolean(process.env.EXPO_ACCESS_TOKEN));

// Projekt-Kontext (muss zum Client passen)
const PROJECT_ID =
  process.env.EXPO_PROJECT_ID ||
  process.env.EXPO_PROJECT ||
  process.env.PROJECT_ID ||
  null;

console.log('[push] routes projectId =', PROJECT_ID || '(none)');

// lastLocation robust normalisieren
function normalizePoint(input) {
  if (!input || typeof input !== 'object') return null;

  // Bereits korrektes GeoJSON?
  if (input.type === 'Point' && Array.isArray(input.coordinates) && input.coordinates.length === 2) {
    const [lng, lat] = input.coordinates;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { type: 'Point', coordinates: [lng, lat] };
    }
  }
  // Lat/Lng-Objekt?
  const { lat, lng } = input;
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { type: 'Point', coordinates: [lng, lat] };
  }
  return null;
}

/* Jüngsten aktiven Token – bevorzugt mit passender projectId */
async function getLatestActiveTokenPreferProject() {
  const baseSort = { lastSeenAt: -1, updatedAt: -1, createdAt: -1 };

  if (PROJECT_ID) {
    const withProject = await PushToken.findOne({
      disabled: { $ne: true },
      projectId: PROJECT_ID,
    }).sort(baseSort).lean();
    if (withProject?.token) return withProject;
  }
  // Fallback: beliebiger aktiver Token
  const anyActive = await PushToken.findOne({ disabled: { $ne: true } })
    .sort(baseSort)
    .lean();
  return anyActive || null;
}

/* Jüngsten aktiven Token für ein Gerät – optional auf projectId einschränken */
async function getLatestActiveTokenForDevice(deviceId, projectIdHint) {
  if (!deviceId) return null;
  const q = { deviceId, disabled: { $ne: true } };
  const proj = PROJECT_ID || projectIdHint || null;
  if (proj) q.projectId = proj;
  return PushToken.findOne(q).sort({ lastSeenAt: -1, updatedAt: -1, createdAt: -1 }).lean();
}

/* Wahl eines Ziel-Tokens in dieser Priorität:
   1) explizites Expo-token (wenn gültig),
   2) deviceId (neuester aktiver Token, projektgescoped),
   3) global: getLatestActiveTokenPreferProject() */
async function chooseTargetToken({ token, deviceId, projectId }) {
  if (token && typeof token === 'string') {
    const trimmed = token.trim();
    if (Expo.isExpoPushToken(trimmed)) {
      // projectId (Info) versuchen nachzuziehen
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

// POST /api/push/register
router.post('/register', async (req, res) => {
  try {
    const { token, platform, userId, deviceId, projectId, lastLocation } = req.body || {};
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, error: 'token-required' });
    }

    const point = normalizePoint(lastLocation);

    const update = {
      token,
      platform: normPlatform(platform),
      userId: isValidObjectId(userId) ? userId : null,
      deviceId: deviceId || null,
      disabled: false,
      lastSeenAt: new Date(),
      ...(projectId ? { projectId } : {}),
      ...(point ? { lastLocation: point } : {}),
    };

    // Wenn Koordinaten mitkommen, heartbeat-Zeit setzen (macht Tokens „frisch“)
    if (point) update.lastHeartbeatAt = new Date();

    const doc = await PushToken.findOneAndUpdate(
      { token },
      update,
      { new: true, upsert: true }
    );

    console.log(
      '[push] register',
      token.slice(0, 22) + '…',
      'platform=', doc.platform,
      'deviceId=', doc.deviceId,
      'projectId=', projectId || '(none)',
      point ? 'lastLocation=Point' : 'lastLocation=none'
    );
    res.json({
      success: true,
      id: doc._id,
      platform: doc.platform,
      userId: doc.userId,
      deviceId: doc.deviceId,
      disabled: doc.disabled,
      lastSeenAt: doc.lastSeenAt,
      projectId: doc.projectId ?? projectId ?? null,
    });
  } catch (e) {
    console.error('[push] register error', e);
    res.status(500).json({ success: false, error: 'server-error' });
  }
});

// POST /api/push/roundtrip  (bevorzugter Quick-Test)
// Respektiert optional req.body.token / req.body.deviceId
router.post('/roundtrip', async (req, res) => {
  try {
    const { offerId: rawOfferId, title: rawTitle, body: rawBody, token, deviceId, projectId } = req.body || {};

    const target = await chooseTargetToken({ token, deviceId, projectId });
    if (!target.token) return res.status(404).json({ success: false, error: 'no-token' });

    const offerId = rawOfferId || 'TEST';
    const payload = { offerId, route: `/offers/${offerId}`, source: 'roundtrip', t: Date.now() };
    const title = rawTitle || 'StepsMatch';
    const body = (rawBody || 'Test-Push (Roundtrip)') + ` [offerId:${offerId}]`;

    console.log(
      '[push] roundtrip build',
      JSON.stringify({
        to: target.token.slice(0, 22) + '…',
        title,
        body,
        data: payload,
        channelId: DEFAULT_CHANNEL,
        source: target.source,
        projectId: target.projectId || null,
      })
    );

    const resp = await sendPush({
      tokens: [target.token],
      title,
      body,
      data: payload,
      channelId: DEFAULT_CHANNEL,
      sound: 'default',
      priority: 'high',
    });

    console.log('[push] roundtrip sent', JSON.stringify(resp));
    res.json({ success: true, projectId: target.projectId || null, meta: resp, source: target.source });
  } catch (e) {
    console.error('[push] roundtrip error', e);
    res.status(500).json({ success: false, error: 'server-error' });
  }
});

// POST /api/push/test  (Alias zu roundtrip; Mobile-Fallback erwartet diesen Pfad)
router.post('/test', async (req, res) => {
  // Delegiere auf roundtrip-Logik
  return router.handle({ ...req, url: '/roundtrip', method: 'POST' }, res, () => {});
});

// POST /api/push/ping  (No-Op – für Mobile-Fallback)
router.post('/ping', async (_req, res) => {
  res.json({ success: true, projectId: PROJECT_ID || null, t: Date.now() });
});

// POST /api/push/roundtrip-diagnose (send + receipts) – optional explizites token
router.post('/roundtrip-diagnose', async (req, res) => {
  try {
    const { token: explicitToken, deviceId, projectId, offerId: rawOfferId, title: rawTitle, body: rawBody } = req.body || {};

    // gleiche Zielauswahl wie oben; explicitToken hat Priorität
    const target = await chooseTargetToken({ token: explicitToken, deviceId, projectId });
    if (!target.token) return res.status(404).json({ success: false, error: 'no-token' });

    const offerId = rawOfferId || 'TEST_DIAG';
    const payload = { offerId, route: `/offers/${offerId}`, source: 'roundtrip', t: Date.now() };
    const title = rawTitle || 'StepsMatch';
    const body = (rawBody || 'Diagnose-Push (Roundtrip)') + ` [offerId:${offerId}]`;

    console.log(
      '[push] diagnose build',
      JSON.stringify({
        to: target.token.slice(0, 22) + '…',
        title,
        body,
        data: payload,
        channelId: DEFAULT_CHANNEL,
        tokenSource: target.source,
        projectId: target.projectId || null,
      })
    );

    const diag = await sendPushAndCheckReceipts({
      tokens: [target.token],
      title,
      body,
      data: payload,
      channelId: DEFAULT_CHANNEL,
      sound: 'default',
      priority: 'high',
      delayMs: 3500, // kurze Receipt-Wartezeit
    });

    console.log('[push] diagnose sent', JSON.stringify(diag.sent));
    console.log('[push] diagnose receipts summary', JSON.stringify(diag.receipts.summary));
    res.json({ success: true, projectId: target.projectId || null, diag, tokenSource: target.source });
  } catch (e) {
    console.error('[push] diagnose error', e);
    res.status(500).json({ success: false, error: 'server-error' });
  }
});

export default router;
