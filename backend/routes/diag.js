import express from 'express';
import ClientDiagLog from '../models/ClientDiagLog.js';

const router = express.Router();
const READ_TOKEN = process.env.DIAG_READ_TOKEN || '';

function canRead(req) {
  if (!READ_TOKEN) return true;
  const h = req.headers['x-diag-token'] || req.headers['x-diag-read-token'];
  const q = req.query?.token;
  return String(h || q || '') === String(READ_TOKEN);
}

router.post('/log', async (req, res) => {
  try {
    const {
      deviceId,
      platform,
      appVersion,
      buildNumber,
      event,
      level,
      data,
    } = req.body || {};

    if (!event) {
      return res.status(400).json({ ok: false, error: 'event required' });
    }

    await ClientDiagLog.create({
      deviceId: deviceId || 'unknown',
      platform: platform || 'unknown',
      appVersion,
      buildNumber,
      event,
      level: level || 'info',
      data: data || {},
      receivedAt: new Date(),
    });

    console.log('[diag]', event, deviceId || 'unknown', level || 'info', JSON.stringify(data || {}));

    return res.json({ ok: true });
  } catch (e) {
    console.error('[diag] log error', e?.message || e);
    return res.status(500).json({ ok: false });
  }
});

router.get('/recent', async (req, res) => {
  try {
    if (!canRead(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });

    const deviceId = req.query?.deviceId ? String(req.query.deviceId) : null;
    const event = req.query?.event ? String(req.query.event) : null;
    const limitRaw = Number(req.query?.limit || 50);
    const limit = Math.max(1, Math.min(500, Number.isFinite(limitRaw) ? limitRaw : 50));
    const sinceMs = Number(req.query?.sinceMs || 0);

    const q = {};
    if (deviceId) q.deviceId = deviceId;
    if (event) q.event = event;
    if (sinceMs > 0) q.createdAt = { $gte: new Date(sinceMs) };

    const docs = await ClientDiagLog.find(q).sort({ createdAt: -1 }).limit(limit).lean();
    return res.json({ ok: true, count: docs.length, docs });
  } catch (e) {
    console.error('[diag] recent error', e?.message || e);
    return res.status(500).json({ ok: false });
  }
});

export default router;
