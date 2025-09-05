// backend/routes/offers.js
import express from 'express';
import mongoose from 'mongoose';
import { performance } from 'perf_hooks';
import Offer from '../models/Offer.js';
import Provider from '../models/Provider.js';
import haversine from 'haversine-distance';
import cloudinary from '../utils/cloudinary.js';

import { isOfferActiveNow } from '../utils/isOfferActiveNow.js';
import { sendPushToNearbyTokensForOffer } from '../utils/geoPush.js';

const router = express.Router();

/* ────────────────────────────────────────────────────────────
   Helpers
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

function isHHMM(s) {
  return typeof s === 'string' && /^(\d{1,2}):(\d{2})$/.test(s);
}

// Normalisiert eingehende Offer-Payload sanft (mutiert obj)
function normalizeOfferPayload(obj = {}) {
  // validTimes: akzeptiere start/end → from/to
  const vt = obj.validTimes || obj.times || {};
  const from = vt.from ?? vt.start ?? null;
  const to   = vt.to   ?? vt.end   ?? null;

  if (from || to) {
    obj.validTimes = {};
    if (from && isHHMM(from)) obj.validTimes.from = from;
    if (to   && isHHMM(to))   obj.validTimes.to   = to;
  } else if ('validTimes' in obj && !obj.validTimes) {
    delete obj.validTimes;
  }

  // validDates: akzeptiere start/end/on/date → from/to
  const vd = obj.validDates || {};
  const single = vd.on ?? vd.date ?? obj.validOn ?? obj.date;
  const fromD = vd.from ?? vd.start ?? (single ?? null);
  const toD   = vd.to   ?? vd.end   ?? (single ?? null);

  if (fromD || toD) {
    obj.validDates = {};
    if (fromD) obj.validDates.from = new Date(fromD);
    if (toD)   obj.validDates.to   = new Date(toD);
  } else if ('validDates' in obj && !obj.validDates) {
    delete obj.validDates;
  }

  // validDays: Strings/Nummern beibehalten (Interpretation in isOfferActiveNow)
  if (Array.isArray(obj.validDays) && obj.validDays.length === 0) {
    delete obj.validDays;
  }

  // location: stelle sicher, dass Zahlen sind
  if (obj.location && Array.isArray(obj.location.coordinates)) {
    obj.location.coordinates = obj.location.coordinates.map((n) => Number(n));
  }
  return obj;
}

/* ────────────────────────────────────────────────────────────
   Push-Helper: sofort Tokens im Radius benachrichtigen
   ──────────────────────────────────────────────────────────── */
async function notifyOfferNow(offer) {
  try {
    // Delegation an gehärtete Geo-Push-Logik (Sanity-Puffer, Project-Scope, ActiveNow, usw.)
    const now = new Date();
    return await sendPushToNearbyTokensForOffer(offer, { now });
  } catch (e) {
    console.error('[offerNotifyNow] error', e?.message || e);
    return { ok: false, error: e?.message || 'error' };
  }
}

/* ────────────────────────────────────────────────────────────
   TEST: bis zu 3 Angebote (mit Bildern)
   ──────────────────────────────────────────────────────────── */
router.get('/test-offers', async (_req, res) => {
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
      // zentrale Logik verwenden (Europe/Vienna)
      docs = docs.filter(o => isOfferActiveNow(o, 'Europe/Vienna'));
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

    // 1) $geoNear
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
    normalizeOfferPayload(req.body);

    const offer = new Offer(req.body);
    const saved = await offer.save();

    // Sofort-Push wenn aktuell aktiv
    try {
      if (isOfferActiveNow(saved, 'Europe/Vienna') && Array.isArray(saved?.location?.coordinates) && (saved?.radius || 0) > 0) {
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

// Manueller Trigger
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
    normalizeOfferPayload(req.body);

    const updatedOffer = await Offer.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updatedOffer) {
      return res.status(404).json({ error: 'Angebot nicht gefunden' });
    }

    // Bei Updates: Push triggern, wenn aktuell aktiv
    try {
      if (isOfferActiveNow(updatedOffer, 'Europe/Vienna') && Array.isArray(updatedOffer?.location?.coordinates) && (updatedOffer?.radius || 0) > 0) {
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
