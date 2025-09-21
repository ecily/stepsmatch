// stepsmatch/backend/routes/diag.js
// Minimaler Diagnostics-Ingest für StepsMatch
// Endpunkte:
//   POST /api/diag/ingest  -> speichert ein Diagnostics-JSON in Mongo (Collection: diagnostics)
//   GET  /api/diag/ping    -> einfacher Health/Ping-Check
//
// Einbindung (in server.js mit ESM):
//   import diagRoutes from './routes/diag.js';
//   app.use('/api/diag', diagRoutes);

import { Router } from 'express';
import mongoose from 'mongoose';

const router = Router();

// Helper: sichere Accessor
function safeObj(v) {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}

// Health/Ping
router.get('/ping', (_req, res) => {
  res.json({ ok: true, service: 'diag', ts: new Date().toISOString() });
});

// Optionaler Canary für schnellen Check dieser Route (unabhängig vom Push-Canary)
router.get('/canary', (_req, res) => {
  res.json({ ok: true, route: 'diag', message: 'diag canary up' });
});

// Ingest: nimmt { payload } an und speichert 1:1 in Mongo + _meta Felder
router.post('/ingest', async (req, res) => {
  try {
    const body = safeObj(req.body);
    const payload = safeObj(body.payload);

    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ ok: false, error: 'invalid payload (object required)' });
    }

    // optionales Schema-Tag (z. B. "stepsmatch.diagnostics.v1")
    const schemaTag = typeof payload._schema === 'string' ? payload._schema : 'unknown';

    // Request-Metadaten
    const ip =
      (req.headers['x-forwarded-for'] && String(req.headers['x-forwarded-for']).split(',')[0].trim()) ||
      req.socket?.remoteAddress ||
      req.ip ||
      'unknown';

    const ua = req.headers['user-agent'] || 'unknown';

    const doc = {
      ...payload,
      _meta: {
        receivedAt: new Date(),
        ip,
        ua,
        schema: schemaTag,
        app: 'stepsmatch',
        source: 'mobile.diagnostics',
      },
    };

    const coll = mongoose.connection.collection('diagnostics');
    const result = await coll.insertOne(doc);

    return res.json({ ok: true, id: String(result.insertedId) });
  } catch (err) {
    console.error('[diag.ingest] error:', err?.message || err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

export default router;
