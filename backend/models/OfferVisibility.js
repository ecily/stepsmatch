// backend/models/OfferVisibility.js
import mongoose from 'mongoose';

const { Schema, model, Types } = mongoose;

/* ────────────────────────────────────────────────────────────
   Status-Konstanten
   ──────────────────────────────────────────────────────────── */
const STATUS = {
  SEEN: 'seen',
  NOTIFIED: 'notified',
  DISMISSED: 'dismissed',
  SNOOZED: 'snoozed',
};

/* ────────────────────────────────────────────────────────────
   ENV helper
   ──────────────────────────────────────────────────────────── */
function envMs(name, def) {
  const v = process.env[name];
  if (v === undefined) return def;
  const s = String(v).trim().toLowerCase();
  if (['', '0', 'false', 'off', 'null', 'none'].includes(s)) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : def;
}

/** Wie lange nach einer NOTIFIED-Meldung darf erneut gepusht werden (Geofence-Enter)? */
const RENOTIFY_COOLDOWN_MS = envMs('GEOFENCE_RENOTIFY_COOLDOWN_MS', 2 * 60 * 60 * 1000); // 2h

/* ────────────────────────────────────────────────────────────
   Schema
   ──────────────────────────────────────────────────────────── */
const OfferVisibilitySchema = new Schema(
  {
    deviceToken: {
      type: Types.ObjectId,
      ref: 'PushToken',
      required: true,
      index: true,
    },
    offerId: {
      type: Types.ObjectId,
      ref: 'Offer',
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: Object.values(STATUS),
      required: true,
      default: STATUS.SEEN,
      index: true,
    },

    firstSeenAt: { type: Date, default: Date.now, index: true },
    lastNotifiedAt: { type: Date, default: null, index: true },
    remindAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'offervisibility',
    strict: true,
    minimize: false,
  }
);

// Eindeutig pro (deviceToken × offerId)
OfferVisibilitySchema.index({ deviceToken: 1, offerId: 1 }, { unique: true });
// Nützliche Sekundärindizes
OfferVisibilitySchema.index({ updatedAt: -1 });
OfferVisibilitySchema.index({ status: 1, remindAt: 1 });
OfferVisibilitySchema.index({ offerId: 1, status: 1, updatedAt: -1 });

/* ────────────────────────────────────────────────────────────
   Statics
   ──────────────────────────────────────────────────────────── */
OfferVisibilitySchema.statics.upsertSeen = async function upsertSeen(deviceTokenId, offerId) {
  return this.findOneAndUpdate(
    { deviceToken: deviceTokenId, offerId },
    { $setOnInsert: { status: STATUS.SEEN, firstSeenAt: new Date() } },
    { new: true, upsert: true }
  ).exec();
};

OfferVisibilitySchema.statics.markNotified = async function markNotified(deviceTokenId, offerId, at = new Date()) {
  return this.findOneAndUpdate(
    { deviceToken: deviceTokenId, offerId },
    {
      $set: { status: STATUS.NOTIFIED, lastNotifiedAt: at, remindAt: null },
      $setOnInsert: { firstSeenAt: at },
    },
    { new: true, upsert: true }
  ).exec();
};

OfferVisibilitySchema.statics.snooze = async function snooze(deviceTokenId, offerId, minutes = 30) {
  const now = new Date();
  const remindAt = new Date(now.getTime() + Math.max(1, minutes) * 60 * 1000);
  return this.findOneAndUpdate(
    { deviceToken: deviceTokenId, offerId },
    {
      $set: { status: STATUS.SNOOZED, remindAt },
      $setOnInsert: { firstSeenAt: now },
    },
    { new: true, upsert: true }
  ).exec();
};

OfferVisibilitySchema.statics.dismiss = async function dismiss(deviceTokenId, offerId) {
  const now = new Date();
  return this.findOneAndUpdate(
    { deviceToken: deviceTokenId, offerId },
    {
      $set: { status: STATUS.DISMISSED, remindAt: null },
      $setOnInsert: { firstSeenAt: now },
    },
    { new: true, upsert: true }
  ).exec();
};

/**
 * shouldNotify:
 * - DISMISSED → nie
 * - SNOOZED  → erst ab remindAt
 * - SEEN     → ja
 * - NOTIFIED → nur wenn Cooldown seit lastNotifiedAt abgelaufen
 */
OfferVisibilitySchema.statics.shouldNotify = async function shouldNotify(
  deviceTokenId,
  offerId,
  now = new Date()
) {
  const doc = await this.findOne({ deviceToken: deviceTokenId, offerId }).lean().exec();
  if (!doc) return true;
  if (doc.status === STATUS.DISMISSED) return false;
  if (doc.status === STATUS.SNOOZED) return !!doc.remindAt && doc.remindAt <= now;
  if (doc.status === STATUS.SEEN) return true;
  // NOTIFIED
  if (!doc.lastNotifiedAt) return false;
  try {
    const t = new Date(doc.lastNotifiedAt).getTime();
    return Number.isFinite(t) && now.getTime() - t >= RENOTIFY_COOLDOWN_MS;
  } catch {
    return false;
  }
};

OfferVisibilitySchema.statics.loadMapForOffers = async function loadMapForOffers(deviceTokenId, offerIds = []) {
  if (!deviceTokenId || !Array.isArray(offerIds) || offerIds.length === 0) return new Map();
  const rows = await this.find({ deviceToken: deviceTokenId, offerId: { $in: offerIds } }).lean().exec();
  const map = new Map();
  for (const r of rows) map.set(String(r.offerId), r);
  return map;
};

const OfferVisibility = model('OfferVisibility', OfferVisibilitySchema);
export { STATUS as OFFER_VISIBILITY_STATUS };
export default OfferVisibility;
