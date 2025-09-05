// backend/routes/push.js
import express from 'express';
import mongoose from 'mongoose';
import { Expo } from 'expo-server-sdk';
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

// Projekt-Kontext (muss zum Client passen)
const PROJECT_ID =
  process.env.EXPO_PROJECT_ID ||
  process.env.EXPO_PROJECT ||
  process.env.PROJECT_ID ||
  null;

console.log('[push] routes projectId =', PROJECT_ID || '(none)');

// Helper: lastLocation robust konvertieren
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

// Helper: Jüngsten aktiven Token holen – bevorzugt mit passender projectId
async function getLatestActiveTokenPreferProject() {
  const baseSort = { lastSeenAt: -1, updatedAt: -1, createdAt: -1 };

  if (PROJECT_ID) {
    const withProject = await PushToken.findOne({
      disabled: { $ne: true },
      projectId: PROJECT_ID,
    }).sort(baseSort).lean();
    if (withProject?.token) {
      return withProject;
    }
  }
  // Fallback: beliebiger aktiver Token
  const anyActive = await PushToken.findOne({
    disabled: { $ne: true },
  }).sort(baseSort).lean();
  return anyActive || null;
}

// ────────── Routes ──────────

// POST /api/push/register
router.post('/register', async (req, res) => {
  try {
    const { token, platform, userId, deviceId, projectId, lastLocation } = req.body || {};
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, error: 'token-required' });
    }

    const point = normalizePoint(lastLocation);

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
        ...(point ? { lastLocation: point } : {}),
      },
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
      projectId: projectId || null,
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

    const last = await getLatestActiveTokenPreferProject();
    if (!last?.token) return res.status(404).json({ success: false, error: 'no-token' });

    const offerId = rawOfferId || 'TEST';
    const payload = { offerId, route: `/offers/${offerId}`, source: 'roundtrip', t: Date.now() };
    const title = rawTitle || 'StepsMatch';
    const body = (rawBody || 'Test-Push (Roundtrip)') + ` [offerId:${offerId}]`;

    console.log(
      '[push] roundtrip build',
      JSON.stringify({ to: last.token.slice(0, 22) + '…', title, body, data: payload, channelId: DEFAULT_CHANNEL, projectId: last.projectId || null })
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
// Optional: req.body.token – wenn gesetzt, wird IMMER damit gesendet (auch wenn disabled).
router.post('/roundtrip-diagnose', async (req, res) => {
  try {
    const { token: explicitToken, offerId: rawOfferId, title: rawTitle, body: rawBody } = req.body || {};

    let chosenToken = null;
    let projectId = null;
    let tokenSource = 'db-prefer-project';

    if (explicitToken && typeof explicitToken === 'string') {
      const trimmed = explicitToken.trim();
      if (!Expo.isExpoPushToken(trimmed)) {
        return res.status(400).json({ success: false, error: 'invalid-expo-token-format' });
      }
      chosenToken = trimmed;
      tokenSource = 'explicit';
      // Optional: projectId aus DB nachziehen, auch wenn disabled
      const doc = await PushToken.findOne({ token: chosenToken }).lean();
      if (doc?.projectId) projectId = doc.projectId;
    } else {
      const last = await getLatestActiveTokenPreferProject();
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
        tokenSource,
        projectId: projectId || null,
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
