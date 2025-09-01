import express from 'express';
import mongoose from 'mongoose';
import { performance } from 'perf_hooks';
import Offer from '../models/Offer.js';
import Provider from '../models/Provider.js';
import haversine from 'haversine-distance';
import cloudinary from '../utils/cloudinary.js'; // (aktuell nicht genutzt, kann bleiben)

// ⬇️ robustes Receipt-Utility (wie bei roundtrip/diagnose)
import PushToken from '../models/PushToken.js';
import OfferVisibility from '../models/OfferVisibility.js';
import { sendPushAndCheckReceipts } from '../utils/push.js';

const router = express.Router();

/* ────────────────────────────────────────────────────────────
   Utils
   ──────────────────────────────────────────────────────────── */
function toArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  if (typeof val === 'string') return val.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}
function toInt(val, def) {
  const n = parseInt(val, 10);
  return Number.isFinite(n) ? n : def;
}
function toFloat(val, def) {
  const n = parseFloat(val);
  return Number.isFinite(n) ? n : def;
}
function parseProjection(fields) {
  const arr = toArray(fields);
  if (!arr.length) return null;
  const proj = {};
  for (const f of arr) proj[f] = 1;
  return proj;
}

// Toleranter „jetzt gültig“-Check
function isActiveNow(o, now = new Date()) {
  const local = now;
  const dayIdx = local.getDay(); // 0..6
  const mins = local.getHours() * 60 + local.getMinutes();

  // Dates
  let dateOk = true;
  if (o?.validDates?.from) {
    const from = new Date(o.validDates.from);
    if (!isNaN(from)) dateOk = dateOk && local >= from;
  }
  if (o?.validDates?.to) {
    const to = new Date(o.validDates.to);
    if (!isNaN(to)) dateOk = dateOk && local <= to;
  }

  // Days
  let dayOk = true;
  if (Array.isArray(o?.validDays) && o.validDays.length) {
    if (typeof o.validDays[0] === 'number') {
      dayOk = o.validDays.includes(dayIdx);
    } else {
      const map = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      dayOk = o.validDays.includes(map[dayIdx]);
    }
  }

  // Times
  const parseHHMM = (s) => {
    if (typeof s !== 'string') return null;
    const m = s.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const h = +m[1], mm = +m[2];
    if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
    return h * 60 + mm;
  };
  let timeOk = true;
  const startMin = parseHHMM(o?.validTimes?.from);
  const endMin   = parseHHMM(o?.validTimes?.to);
  if (startMin != null && endMin != null) {
    if (endMin >= startMin) timeOk = mins >= startMin && mins <= endMin;
    else timeOk = mins >= startMin || mins <= endMin; // über Mitternacht
  } else if (startMin != null) {
    timeOk = mins >= startMin;
  } else if (endMin != null) {
    timeOk = mins <= endMin;
  }

  return dateOk && dayOk && timeOk;
}

/* ────────────────────────────────────────────────────────────
   Push-Helper: sofort Tokens im Radius benachrichtigen
   ──────────────────────────────────────────────────────────── */
const PUSH_CHANNEL_ID = process.env.PUSH_CHANNEL_ID || 'offers';
const PUSH_PRIORITY   = process.env.PUSH_PRIORITY   || 'high';
const PUSH_SOUND      = process.env.PUSH_SOUND      || 'default';
const LAST_LOCATION_MAX_AGE_MS = Number(process.env.PUSH_LAST_LOCATION_MAX_AGE_MS || 10 * 60_000);
const MAX_DISTANCE_M_DEFAULT   = Number(process.env.PUSH_MAX_DISTANCE_M || 1500);

// Projekt-Scope (wie im Poller)
const PROJECT_ID =
  process.env.EXPO_PROJECT_ID ||
  process.env.EXPO_PROJECT ||
  process.env.PROJECT_ID ||
  null;

// nutzt identisch die Receipt-Logik wie /api/push/roundtrip-diagnose
async function notifyOfferNow(offer) {
  try {
    const coords = offer?.location?.coordinates;
    const [lng, lat] = Array.isArray(coords) ? coords : [];
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { ok: false, reason: 'no_coords' };
    }

    const radiusM = Number(offer.radiusMeters ?? offer.radius ?? MAX_DISTANCE_M_DEFAULT);
    if (!Number.isFinite(radiusM) || radiusM <= 0) {
      return { ok: false, reason: 'bad_radius' };
    }

    const freshSince = new Date(Date.now() - LAST_LOCATION_MAX_AGE_MS);
    // frische Tokens mit Location
    const tokenQuery = {
      disabled: { $ne: true },
      'lastLocation.coordinates.0': { $exists: true },
      $or: [
        { lastHeartbeatAt: { $gte: freshSince } },
        { lastSeenAt: { $gte: freshSince } },
        { updatedAt: { $gte: freshSince } },
      ],
    };
    if (PROJECT_ID) tokenQuery.projectId = PROJECT_ID;

    const tokensFresh = await PushToken.find(tokenQuery)
      .select('_id token lastLocation projectId deviceId updatedAt lastSeenAt lastHeartbeatAt')
      .lean();

    if (!tokensFresh.length) {
      return { ok: false, reason: 'no_fresh_tokens' };
    }

    // Geo-Query: im Radius (implizit auf tokensFresh begrenzt)
    const near = await PushToken.find({
      _id: { $in: tokensFresh.map(t => t._id) },
      lastLocation: {
        $near: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: radiusM,
        },
      },
    }).select('_id token projectId deviceId').lean();

    if (!near.length) {
      return { ok: false, reason: 'no_near_tokens' };
    }

    // Suppression: nicht doppelt nerven
    const vis = await OfferVisibility.find({
      offerId: offer._id,
      deviceToken: { $in: near.map(t => t._id) },
      $or: [
        { status: 'notified' },
        { status: 'dismissed' },
        { status: 'snoozed', remindAt: { $gt: new Date() } }
      ],
    }).select('deviceToken').lean();

    const already = new Set(vis.map(v => String(v.deviceToken)));
    const toNotifyDocs = near.filter(t => !already.has(String(t._id)));

    const tokens = toNotifyDocs.map(t => t.token).filter(Boolean);
    if (!tokens.length) {
      return { ok: false, reason: 'nothing_to_notify' };
    }

    const title = offer.name || 'Neues Angebot in deiner Nähe';
    const body  = 'Tippe, um Details zu sehen.';

    const diag = await sendPushAndCheckReceipts({
      tokens,
      title,
      body,
      data: { type: 'offer', offerId: String(offer._id), route: `/offers/${offer._id}`, source: 'offer-create' },
      channelId: PUSH_CHANNEL_ID,
      priority: PUSH_PRIORITY,
      sound: PUSH_SOUND,
      delayMs: 2500,
    });

    // sent-ok Tokens ermitteln
    const sentTokens = [];
    const tickets = Array.isArray(diag?.sent?.tickets) ? diag.sent.tickets : [];
    for (let i = 0; i < tickets.length; i++) {
      const t = tickets[i];
      if (t?.status === 'ok' && tokens[i]) sentTokens.push(tokens[i]);
    }

    // OfferVisibility setzen
    if (sentTokens.length) {
      const sentDocs = await PushToken.find({ token: { $in: sentTokens } }, { _id: 1, token: 1 }).lean();
      const byToken = new Map(sentDocs.map(d => [d.token, d._id]));
      const nowIso = new Date();
      const bulk = sentTokens.map(tok => {
        const deviceTokenId = byToken.get(tok);
        if (!deviceTokenId) return null;
        return {
          updateOne: {
            filter: { offerId: offer._id, deviceToken: deviceTokenId },
            update: {
              $setOnInsert: { offerId: offer._id, deviceToken: deviceTokenId, firstSeenAt: nowIso },
              $set: { status: 'notified', remindAt: null, lastNotifiedAt: nowIso, updatedAt: nowIso },
            },
            upsert: true,
          }
        };
      }).filter(Boolean);
      if (bulk.length) await OfferVisibility.bulkWrite(bulk);
    }

    const summary = diag?.receipts?.summary || {};
    console.log(`[offerNotifyNow] offer=${offer._id} tried=${tokens.length} sentOk=${sentTokens.length} receipts=${JSON.stringify(summary)}`);
    if (diag?.retry && diag.retry.count > 0) {
      console.log(`[offerNotifyNow][retry] attempts=${diag.retry.count} succeeded=${diag.retry.succeeded} targets=${JSON.stringify(diag.retry.targets || [])}`);
    }
    return { ok: true, tried: tokens.length, sentOk: sentTokens.length, receipts: summary };
  } catch (e) {
    console.error('[offerNotifyNow] error', e?.message || e);
    return { ok: false, error: e?.message || 'error' };
  }
}

/* ────────────────────────────────────────────────────────────
   TEST: bis zu 3 Angebote (mit Bildern)
   ──────────────────────────────────────────────────────────── */
router.get('/test-offers', async (req, res) => {
  try {
    const offers = await Offer.find(
      {},
      'name description category subcategory location radius validDays validTimes validDates provider images'
    ).limit(3);
    res.json({ success: true, offers });
  } catch (error) {
    console.error('Fehler beim Abrufen:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ────────────────────────────────────────────────────────────
   Optimierte LISTE: GET /api/offers
   ──────────────────────────────────────────────────────────── */
router.get('/', async (req, res) => {
  const t0 = performance.now();

  function buildInterestsOrClause(interestsLC) {
    if (!Array.isArray(interestsLC) || interestsLC.length === 0) return null;
    const ors = [];
    for (const term of interestsLC) {
      if (!term) continue;
      const safe = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      ors.push({ subcategory: { $regex: safe, $options: 'i' } });
      ors.push({ category:   { $regex: safe, $options: 'i' } });
    }
    return ors.length ? { $or: ors } : null;
  }

  function buildPipeline({ hasGeo, lat, lng, maxDistanceM, interestsLC, projection, skip, limit }) {
    const pipeline = [];

    if (hasGeo) {
      const geo = {
        $geoNear: {
          near: { type: 'Point', coordinates: [lng, lat] },
          distanceField: 'distance',
          spherical: true,
        }
      };
      if (Number.isFinite(maxDistanceM) && maxDistanceM > 0) {
        geo.$geoNear.maxDistance = maxDistanceM;
      }
      pipeline.push(geo);
    }

    const interestsClause = buildInterestsOrClause(interestsLC);
    if (interestsClause) pipeline.push({ $match: interestsClause });

    if (projection) {
      pipeline.push({ $project: projection });
      if (hasGeo && !projection.distance) {
        pipeline[pipeline.length - 1].$project.distance = 1;
      }
    }

    pipeline.push({
      $facet: {
        totalDocs: [{ $count: 'count' }],
        docs: [
          { $sort: hasGeo ? { distance: 1 } : { _id: -1 } },
          { $skip: skip },
          { $limit: limit }
        ]
      }
    });

    return pipeline;
  }

  try {
    const lat = toFloat(req.query.lat, null);
    const lng = toFloat(req.query.lng, null);
    const hasGeo = Number.isFinite(lat) && Number.isFinite(lng);

    const maxDistanceM = toInt(req.query.maxDistanceM, 1500);
    const page = Math.max(1, toInt(req.query.page, 1));
    const limit = Math.min(100, Math.max(1, toInt(req.query.limit, 20)));
    const skip = (page - 1) * limit;

    const interestsRaw = toArray(req.query.interests);
    const interestsLC = interestsRaw.map(s => String(s).toLowerCase()).filter(Boolean);

    const activeNow = req.query.activeNow === '1' || req.query.activeNow === 'true';
    const withProvider = req.query.withProvider === '1' || req.query.withProvider === 'true';

    const projection = parseProjection(req.query.fields);
    const providerSelect = 'name address category description contact location user';

    let pipeline = buildPipeline({
      hasGeo, lat, lng, maxDistanceM, interestsLC, projection, skip, limit
    });

    let agg = await Offer.aggregate(pipeline).allowDiskUse(true);
    let facet = agg[0] || { totalDocs: [], docs: [] };
    let docs = facet.docs || [];
    let total = (facet.totalDocs[0]?.count) || 0;

    if (hasGeo && total === 0) {
      const pipelineNoMax = buildPipeline({
        hasGeo, lat, lng, maxDistanceM: null, interestsLC, projection, skip, limit
      });
      agg = await Offer.aggregate(pipelineNoMax).allowDiskUse(true);
      facet = agg[0] || { totalDocs: [], docs: [] };
      docs = facet.docs || [];
      total = (facet.totalDocs[0]?.count) || 0;
    }

    if (withProvider && docs.length) {
      const ids = docs.map(d => d._id);
      const populated = await Offer.find({ _id: { $in: ids } }, projection || {})
        .populate({ path: 'provider', select: providerSelect })
        .lean();
      const byId = new Map(populated.map(d => [String(d._id), d]));
      docs = docs.map(d => byId.get(String(d._id)) || d);
    }

    if (activeNow) {
      docs = docs.filter(o => isActiveNow(o));
    }

    const tookMs = Math.round(performance.now() - t0);
    return res.json({
      page,
      limit,
      total,
      hasMore: skip + docs.length < total,
      tookMs,
      data: docs
    });
  } catch (err) {
    console.error('GET /api/offers failed:', err);
    return res.status(500).json({ error: 'Failed to fetch offers', details: String(err?.message || err) });
  }
});

/* ────────────────────────────────────────────────────────────
   GEO-Abfragen (bestehend)
   ──────────────────────────────────────────────────────────── */
router.post('/nearby', async (req, res) => {
  try {
    const {
      lat,
      lng,
      interests,
      maxDistance = 5000,
      limit = 30
    } = req.body;

    const latitude = Number(lat);
    const longitude = Number(lng);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Array.isArray(interests) || interests.length === 0) {
      return res.status(400).json({ error: 'Ungültige Parameter' });
    }

    const norm = interests
      .map(i => String(i || '').toLowerCase().trim())
      .filter(Boolean);

    const docs = await Offer.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [longitude, latitude] },
          distanceField: 'distanceMeters',
          maxDistance: Number(maxDistance),
          spherical: true
        }
      },
      { $match: { radius: { $gt: 0 }, subcategory: { $exists: true, $ne: null } } },
      { $addFields: { sub_lc: { $toLower: '$subcategory' } } },
      { $match: { sub_lc: { $in: norm } } },
      {
        $project: {
          name: 1,
          description: 1,
          category: 1,
          subcategory: 1,
          location: 1,
          radius: 1,
          images: { $slice: ['$images', 3] },
          distanceMeters: { $round: ['$distanceMeters', 0] }
        }
      },
      { $sort: { distanceMeters: 1 } },
      { $limit: Number(limit) }
    ]);

    res.json(docs);
  } catch (err) {
    console.error('nearby error:', err);
    res.status(500).json({ error: 'Serverfehler bei Nearby-Abfrage' });
  }
});

router.post('/nearby-noauth', async (req, res) => {
  try {
    const {
      lat,
      lng,
      maxDistance = 5000,
      limit = 30
    } = req.body;

    const latitude = Number(lat);
    const longitude = Number(lng);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({ error: 'Ungültige Parameter' });
    }

    const docs = await Offer.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [longitude, latitude] },
          distanceField: 'distanceMeters',
          maxDistance: Number(maxDistance),
          spherical: true
        }
      },
      { $match: { radius: { $gt: 0 } } },
      {
        $project: {
          name: 1,
          description: 1,
          category: 1,
          subcategory: 1,
          location: 1,
          radius: 1,
          images: { $slice: ['$images', 3] },
          distanceMeters: { $round: ['$distanceMeters', 0] }
        }
      },
      { $sort: { distanceMeters: 1 } },
      { $limit: Number(limit) }
    ]);

    res.json(docs);
  } catch (err) {
    console.error('nearby-noauth error:', err);
    res.status(500).json({ error: 'Serverfehler bei Nearby-NoAuth' });
  }
});

/**
 * Nearby-Geofence (GET)
 */
router.get('/nearby-geofence', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
    const maxDistance = parseInt(req.query.maxDistance || '5000', 10);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ success: false, error: 'Ungültige Parameter: lat/lng erforderlich' });
    }

    // 1) Schneller Weg: $geoNear Aggregation
    try {
      const rows = await Offer.aggregate([
        {
          $geoNear: {
            near: { type: 'Point', coordinates: [lng, lat] },
            distanceField: 'distanceMeters',
            spherical: true,
            maxDistance: maxDistance
          }
        },
        {
          $project: {
            _id: 1,
            radiusMeters: '$radius',
            distanceMeters: 1,
            longitude: { $arrayElemAt: ['$location.coordinates', 0] },
            latitude:  { $arrayElemAt: ['$location.coordinates', 1] }
          }
        },
        {
          $match: {
            radiusMeters: { $gt: 0 },
            latitude: { $type: 'number' },
            longitude: { $type: 'number' }
          }
        },
        { $sort: { distanceMeters: 1 } },
        { $limit: limit }
      ]);

      const geofences = rows.map(r => ({
        offerId: String(r._id),
        latitude: r.latitude,
        longitude: r.longitude,
        radiusMeters: r.radiusMeters,
        distanceMeters: Math.round(r.distanceMeters ?? 0)
      }));

      return res.json({ success: true, geofences, count: geofences.length });
    } catch (aggErr) {
      // 2) Fallback: Node.js Haversine
      console.warn('nearby-geofence: $geoNear nicht verfügbar, Fallback auf Node-Berechnung:', aggErr?.message);
      const allOffers = await Offer.find({}, 'location radius').lean();
      const userLoc = { lat, lng };

      const filtered = allOffers
        .filter(o => Array.isArray(o?.location?.coordinates) && o.location.coordinates.length === 2 && o.radius > 0)
        .map(o => {
          const [olng, olat] = o.location.coordinates;
          const distance = haversine(userLoc, { lat: olat, lng: olng });
          return {
            offerId: String(o._id),
            latitude: olat,
            longitude: olng,
            radiusMeters: o.radius,
            distanceMeters: distance
          };
        })
        .filter(r => r.distanceMeters <= maxDistance)
        .sort((a, b) => a.distanceMeters - b.distanceMeters)
        .slice(0, limit);

      return res.json({ success: true, geofences: filtered, count: filtered.length });
    }
  } catch (err) {
    console.error('Fehler bei /offers/nearby-geofence:', err);
    res.status(500).json({ success: false, error: 'Serverfehler bei nearby-geofence' });
  }
});

/* ────────────────────────────────────────────────────────────
   CRUD & Counter
   ──────────────────────────────────────────────────────────── */
router.post('/', async (req, res) => {
  try {
    const offer = new Offer(req.body);
    const saved = await offer.save();

    // ⬇️ Sofort-Push an Tokens im Radius, wenn Offer aktuell aktiv ist
    try {
      if (isActiveNow(saved) && Array.isArray(saved?.location?.coordinates) && (saved?.radius || 0) > 0) {
        const notify = await notifyOfferNow(saved);
        console.log('[offers.create] notify summary:', notify);
        return res.status(201).json({ ok: true, offer: saved, notify });
      }
    } catch (e) {
      console.warn('[offers.create] geoPush skipped:', e?.message || e);
    }

    return res.status(201).json({ ok: true, offer: saved, notify: { ok: false, reason: 'not_active_or_no_geo' } });
  } catch (err) {
    console.error('[offers.create] error:', err?.message || err);
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Manueller Trigger für bestehende Offers
router.post('/:id/notify-now', async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id).lean();
    if (!offer) return res.status(404).json({ ok: false, error: 'offer_not_found' });
    const notify = await notifyOfferNow(offer);
    return res.json({ ok: true, notify });
  } catch (e) {
    console.error('[offers:notify-now] error', e?.message || e);
    return res.status(500).json({ ok: false, error: 'notify_failed' });
  }
});

router.get('/provider/:providerId', async (req, res) => {
  try {
    const offers = await Offer.find(
      { provider: req.params.providerId },
      'name description category subcategory location radius validDays validTimes validDates images'
    );
    res.json(offers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Laden der Angebote.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const offer = await Offer.findById(
      req.params.id,
      'name description category subcategory location radius validDays validTimes validDates provider images'
    );
    if (!offer) {
      return res.status(404).json({ error: 'Angebot nicht gefunden' });
    }
    res.json(offer);
  } catch (error) {
    console.error('Fehler beim Abrufen eines Angebots:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const updatedOffer = await Offer.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updatedOffer) {
      return res.status(404).json({ error: 'Angebot nicht gefunden' });
    }

    // ⬇️ Bei Updates ebenfalls Push triggern, wenn Offer aktuell aktiv ist
    try {
      if (isActiveNow(updatedOffer) && Array.isArray(updatedOffer?.location?.coordinates) && (updatedOffer?.radius || 0) > 0) {
        const notify = await notifyOfferNow(updatedOffer);
        console.log('[offers.update] notify summary:', notify);
        return res.json({ ok: true, offer: updatedOffer, notify });
      }
    } catch (e) {
      console.warn('[offers.update] geoPush skipped:', e?.message || e);
    }

    res.json({ ok: true, offer: updatedOffer, notify: { ok: false, reason: 'not_active_or_no_geo' } });
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Angebots:', error);
    res.status(400).json({ ok: false, error: 'Fehler beim Aktualisieren des Angebots' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Offer.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Angebot nicht gefunden' });
    }
    res.json({ message: 'Angebot gelöscht' });
  } catch (error) {
    console.error('Fehler beim Löschen:', error);
    res.status(500).json({ error: 'Serverfehler beim Löschen' });
  }
});

router.post('/found/:id', async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) {
      return res.status(404).json({ error: 'Angebot nicht gefunden' });
    }
    offer.foundCounter = (offer.foundCounter || 0) + 1;
    await offer.save();
    res.json({ success: true, foundCounter: offer.foundCounter });
  } catch (error) {
    console.error('Fehler beim Hochzählen des foundCounters:', error);
    res.status(500).json({ error: 'Serverfehler beim Hochzählen des Counters' });
  }
});

export default router;
