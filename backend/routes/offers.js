// backend/routes/offers.js
import express from 'express';
import mongoose from 'mongoose';
import { performance } from 'perf_hooks';
import Offer from '../models/Offer.js';
import Provider from '../models/Provider.js';
import haversine from 'haversine-distance';
import cloudinary from '../utils/cloudinary.js'; // (aktuell nicht genutzt, kann bleiben)

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

// Toleranter „jetzt gültig“-Check, abgestimmt auf deine Felder:
// - validDates: { from: ISO, to: ISO } (optional)
// - validDays:  [0..6] (0=So) oder ['Mon', 'Tue', ...] (optional)
// - validTimes: { from: "HH:mm", to: "HH:mm" } (optional)
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
   Query:
     - lat,lng (Float) -> optional $geoNear + distance
     - maxDistanceM (Int, default 150)
     - interests (CSV/Array) -> match auf subcategory (case-insens.)
     - activeNow (1/0)
     - withProvider (1/0)
     - page (Int, default 1), limit (Int, default 20, max 100)
     - fields (CSV) -> Projektion (schlank)
   Response:
     { page, limit, total, hasMore, tookMs, data: [...] }
   ──────────────────────────────────────────────────────────── */
router.get('/', async (req, res) => {
  const t0 = performance.now();

  // Hilfsbau: toleranter Interessen-Match (regex-basiert auf category/subcategory)
  function buildInterestsOrClause(interestsLC) {
    if (!Array.isArray(interestsLC) || interestsLC.length === 0) return null;
    const ors = [];
    for (const term of interestsLC) {
      if (!term) continue;
      // Escape einfache Regex-Sonderzeichen
      const safe = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      ors.push({ subcategory: { $regex: safe, $options: 'i' } });
      ors.push({ category:   { $regex: safe, $options: 'i' } });
    }
    return ors.length ? { $or: ors } : null;
  }

  // Baut die Aggregation-Pipeline dynamisch
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
        // harte Distanz nur, wenn gewünscht
        geo.$geoNear.maxDistance = maxDistanceM;
      }
      pipeline.push(geo);
    }

    const interestsClause = buildInterestsOrClause(interestsLC);
    if (interestsClause) {
      pipeline.push({ $match: interestsClause });
    }

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

    const maxDistanceM = toInt(req.query.maxDistanceM, 1500); // etwas großzügiger default
    const page = Math.max(1, toInt(req.query.page, 1));
    const limit = Math.min(100, Math.max(1, toInt(req.query.limit, 20)));
    const skip = (page - 1) * limit;

    // Interessen (CSV/Array) zu LC
    const interestsRaw = toArray(req.query.interests);
    const interestsLC = interestsRaw.map(s => String(s).toLowerCase()).filter(Boolean);

    const activeNow = req.query.activeNow === '1' || req.query.activeNow === 'true';
    const withProvider = req.query.withProvider === '1' || req.query.withProvider === 'true';

    const projection = parseProjection(req.query.fields);
    const providerSelect = 'name address category description contact location user';

    // 1) erste Pipeline (respektiert maxDistanceM)
    let pipeline = buildPipeline({
      hasGeo, lat, lng, maxDistanceM, interestsLC, projection, skip, limit
    });

    let agg = await Offer.aggregate(pipeline).allowDiskUse(true);
    let facet = agg[0] || { totalDocs: [], docs: [] };
    let docs = facet.docs || [];
    let total = (facet.totalDocs[0]?.count) || 0;

    // 2) Fallback: keine Treffer? Dann ohne maxDistance neu versuchen (nur wenn Geo vorhanden)
    if (hasGeo && total === 0) {
      const pipelineNoMax = buildPipeline({
        hasGeo, lat, lng, maxDistanceM: null, interestsLC, projection, skip, limit
      });
      agg = await Offer.aggregate(pipelineNoMax).allowDiskUse(true);
      facet = agg[0] || { totalDocs: [], docs: [] };
      docs = facet.docs || [];
      total = (facet.totalDocs[0]?.count) || 0;
    }

    // Optional Provider
    if (withProvider && docs.length) {
      const ids = docs.map(d => d._id);
      const populated = await Offer.find({ _id: { $in: ids } }, projection || {})
        .populate({ path: 'provider', select: providerSelect })
        .lean();
      const byId = new Map(populated.map(d => [String(d._id), d]));
      docs = docs.map(d => byId.get(String(d._id)) || d);
    }

    // activeNow-Filter (tolerant); Hinweis: falls projection gültige Felder entfernt,
    // ist das ok -> fehlende Felder bedeuten "true" in isActiveNow
    if (activeNow) {
      docs = docs.filter(o => isActiveNow(o));
      // Achtung: total/hasMore beziehen sich auf pre-filter; für Klarheit neu berechnen:
      // (Wir zählen hier nur die aktuelle Seite; für echte Total-Genauigkeit bräuchte man ein 2. Facet.)
      // Für UX reicht i.d.R. dieses Verhalten, da Pagination sowieso vom Server gesteuert wird.
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
   GEO-Abfrage mit Interessen via $geoNear (bestehend)
   ──────────────────────────────────────────────────────────── */
router.post('/nearby', async (req, res) => {
  try {
    const {
      lat,
      lng,
      interests,
      maxDistance = 5000, // Meter (anpassbar)
      limit = 30          // Anzahl Ergebnisse (anpassbar)
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

/* ────────────────────────────────────────────────────────────
   Öffentliche Nearby-Route ohne Interessen (bestehend)
   ──────────────────────────────────────────────────────────── */
router.post('/nearby-noauth', async (req, res) => {
  try {
    const {
      lat,
      lng,
      maxDistance = 5000, // Meter
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
 * Leichtgewichtige Nearby-Route für Geofencing (bestehend)
 * GET /offers/nearby-geofence?lat=..&lng=..&limit=50&maxDistance=5000
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
   CRUD & Counter (bestehend)
   ──────────────────────────────────────────────────────────── */
router.post('/', async (req, res) => {
  try {
    const offer = new Offer(req.body);
    const saved = await offer.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
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

    res.json(updatedOffer);
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Angebots:', error);
    res.status(400).json({ error: 'Fehler beim Aktualisieren des Angebots' });
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
