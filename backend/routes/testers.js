import express from "express";
import Tester from "../models/Tester.js";
import { sendTesterKeyRequestEmail } from "../services/graphMailService.js";

const router = express.Router();
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REQUEST_WINDOW_MS = 15 * 60 * 1000;
const REQUEST_LIMIT = 3;
const requestAttempts = new Map();

const normalize = (value, maxLength) => String(value || '').trim().slice(0, maxLength);

function isRateLimited(ip) {
  const now = Date.now();
  const current = requestAttempts.get(ip) || { count: 0, resetAt: now + REQUEST_WINDOW_MS };
  if (current.resetAt <= now) {
    current.count = 0;
    current.resetAt = now + REQUEST_WINDOW_MS;
  }
  current.count += 1;
  requestAttempts.set(ip, current);
  if (requestAttempts.size > 1000) {
    for (const [key, value] of requestAttempts) {
      if (value.resetAt <= now) requestAttempts.delete(key);
    }
  }
  return current.count > REQUEST_LIMIT;
}

function buildTesterRequestMessage({ name, email, organization, role, region, message, source }) {
  return [
    'Eine neue StepsMatch Tester-Key Anfrage wurde eingereicht.',
    '',
    `Name: ${name}`,
    `E-Mail: ${email}`,
    `Organisation: ${organization || '—'}`,
    `Rolle/Interesse: ${role || '—'}`,
    `Ort/Region: ${region || '—'}`,
    `Nachricht: ${message || '—'}`,
    `Quelle: ${source || 'unknown'}`,
    `Zeitstempel: ${new Date().toISOString()}`,
    '',
    'Bestätigt: Vertraulichkeitshinweis und Kontaktverwendung wurden akzeptiert.',
  ].join('\n');
}

/** POST /api/testers/request-key — sends a request by Graph, without DB storage or auto-approval. */
router.post('/request-key', async (req, res) => {
  const website = normalize(req.body?.website, 120);
  if (website) return res.json({ ok: true });

  if (isRateLimited(req.ip || 'unknown')) {
    return res.status(429).json({ ok: false, message: 'Zu viele Anfragen. Bitte versuche es später erneut.' });
  }

  const name = normalize(req.body?.name, 120);
  const email = normalize(req.body?.email, 320).toLowerCase();
  const organization = normalize(req.body?.organization, 160);
  const role = normalize(req.body?.role, 160);
  const region = normalize(req.body?.region, 160);
  const message = normalize(req.body?.message, 2000);
  const source = normalize(req.body?.source, 80) || 'unknown';

  if (!name) return res.status(400).json({ ok: false, message: 'Bitte gib deinen Namen ein.' });
  if (!EMAIL_REGEX.test(email)) return res.status(400).json({ ok: false, message: 'Bitte gib eine gültige E-Mail-Adresse ein.' });
  if (req.body?.confidentialityAccepted !== true || req.body?.contactConsentAccepted !== true) {
    return res.status(400).json({ ok: false, message: 'Bitte bestätige Vertraulichkeit und Kontaktverwendung.' });
  }

  try {
    await sendTesterKeyRequestEmail({
      subject: 'StepsMatch Tester-Key Anfrage',
      content: buildTesterRequestMessage({ name, email, organization, role, region, message, source }),
    });
    return res.json({ ok: true });
  } catch (error) {
    console.error('[testers] request-key mail failed:', error?.message || 'unknown error');
    if (error?.code === 'GRAPH_NOT_CONFIGURED') {
      return res.status(503).json({ ok: false, message: 'Tester-Key-Anfrage ist noch nicht vollständig konfiguriert.' });
    }
    return res.status(502).json({ ok: false, message: 'Die Anfrage konnte gerade nicht gesendet werden.' });
  }
});

/**
 * POST /api/testers/validate
 * Body: { key }
 * -> Prüft, ob Key existiert, markiert validatedAt, setzt status=validated
 */
router.post("/validate", async (req, res) => {
  try {
    const { key } = req.body;
    if (!key) return res.status(400).json({ ok: false, message: "Key fehlt." });

    const tester = await Tester.findOne({ key });
    if (!tester) {
      return res.status(404).json({ ok: false, message: "Ungültiger Key." });
    }

    tester.validatedAt = new Date();
    tester.status = "validated";
    await tester.save();

    res.json({
      ok: true,
      tester: {
        key: tester.key,
        name: tester.name,
        email: tester.email,
        gateModalMessage: tester.gateModalMessage || "",
      },
    });
  } catch (err) {
    console.error("[validate] error", err);
    res.status(500).json({ ok: false, message: "Serverfehler bei Validierung." });
  }
});

/**
 * POST /api/testers/accept
 * Body: { key, ndaVersion }
 * -> Markiert acceptedAt + NDA-Version, setzt status=accepted
 */
router.post("/accept", async (req, res) => {
  try {
    const { key, ndaVersion } = req.body;
    if (!key) return res.status(400).json({ ok: false, message: "Key fehlt." });

    const tester = await Tester.findOne({ key });
    if (!tester) {
      return res.status(404).json({ ok: false, message: "Ungültiger Key." });
    }

    tester.acceptedAt = new Date();
    tester.ndaVersion = ndaVersion || "v1.0";
    tester.status = "accepted";
    await tester.save();

    res.json({ ok: true });
  } catch (err) {
    console.error("[accept] error", err);
    res.status(500).json({ ok: false, message: "Serverfehler bei Akzeptanz." });
  }
});

export default router;
