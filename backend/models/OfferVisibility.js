// backend/models/OfferVisibility.js
import mongoose from 'mongoose';

const { Schema, model, Types } = mongoose;

/**
 * OfferVisibility
 *  - Ein Dokument pro (deviceToken × offerId)
 *  - Status steuert, ob/wan n Push gesendet werden darf
 *
 * Status:
 *  - 'seen'      → Gerät hat das Offer bereits „entdeckt“, aber (noch) keine Push gesendet
 *  - 'notified'  → Push wurde bereits gesendet (lastNotifiedAt gesetzt)
 *  - 'dismissed' → Nutzer will das Offer nicht (nie wieder pushen für dieses Pair)
 *  - 'snoozed'   → „Später erinnern“; erneute Benachrichtigung erst ab remindAt
 */
const STATUS = {
  SEEN: 'seen',
  NOTIFIED: 'notified',
  DISMISSED: 'dismissed',
  SNOOZED: 'snoozed',
};

const OfferVisibilitySchema = new Schema(
  {
    deviceToken: {
      type: Types.ObjectId,
      ref: 'DeviceToken',
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

    // Nur für Snooze: ab diesem Zeitpunkt darf wieder erinnert werden
    remindAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true, // createdAt, updatedAt
    versionKey: false,
    collection: 'offervisibility',
  }
);

// Eindeutigkeit je (deviceToken × offerId) verhindert Duplikate
OfferVisibilitySchema.index({ deviceToken: 1, offerId: 1 }, { unique: true });

// Nützliche Abfragen
OfferVisibilitySchema.index({ updatedAt: -1 });
OfferVisibilitySchema.index({ status: 1, remindAt: 1 });

/* ───────────────────────────────
 * Static Helpers
 *  Diese Helfer kapseln typische Zustandswechsel.
 *  Nutzen wir serverseitig in /location und /push/action.
 * ─────────────────────────────── */

OfferVisibilitySchema.statics.upsertSeen = async function upsertSeen(deviceTokenId, offerId) {
  // Falls noch nicht vorhanden → als 'seen' anlegen; bestehende Einträge nicht „hochdrehen“
  return this.findOneAndUpdate(
    { deviceToken: deviceTokenId, offerId },
    {
      $setOnInsert: {
        status: STATUS.SEEN,
        firstSeenAt: new Date(),
      },
    },
    { new: true, upsert: true }
  ).exec();
};

OfferVisibilitySchema.statics.markNotified = async function markNotified(deviceTokenId, offerId, at = new Date()) {
  return this.findOneAndUpdate(
    { deviceToken: deviceTokenId, offerId },
    {
      $set: {
        status: STATUS.NOTIFIED,
        lastNotifiedAt: at,
        // Snooze aufheben, wenn vorhanden
        remindAt: null,
      },
      $setOnInsert: {
        firstSeenAt: at,
      },
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
      $set: {
        status: STATUS.SNOOZED,
        remindAt,
      },
      $setOnInsert: {
        firstSeenAt: now,
      },
    },
    { new: true, upsert: true }
  ).exec();
};

OfferVisibilitySchema.statics.dismiss = async function dismiss(deviceTokenId, offerId) {
  const now = new Date();
  return this.findOneAndUpdate(
    { deviceToken: deviceTokenId, offerId },
    {
      $set: {
        status: STATUS.DISMISSED,
        remindAt: null,
      },
      $setOnInsert: {
        firstSeenAt: now,
      },
    },
    { new: true, upsert: true }
  ).exec();
};

/**
 * shouldNotify
 *  - true  → Push darf gesendet werden
 *  - false → KEIN Push (bereits bekannt, dismissed oder Snooze noch nicht fällig)
 *
 * Logik:
 *  - Kein Eintrag → neu → darf
 *  - dismissed → nein
 *  - snoozed → nur, wenn remindAt <= now
 *  - seen/notified → standardmäßig nein (es sei denn, du möchtest ein Re‑Notify nach X h – dann später erweitern)
 */
OfferVisibilitySchema.statics.shouldNotify = async function shouldNotify(deviceTokenId, offerId, now = new Date()) {
  const doc = await this.findOne({ deviceToken: deviceTokenId, offerId }).lean().exec();
  if (!doc) return true; // komplett neu

  if (doc.status === STATUS.DISMISSED) return false;
  if (doc.status === STATUS.SNOOZED) {
    if (!doc.remindAt) return false;
    return doc.remindAt <= now;
  }

  // 'seen' oder 'notified' → bereits bekannt → kein erneuter Push
  return false;
};

/**
 * loadMapForOffers
 *  Liefert eine Map<offerId, visibilityDoc> für schnellere Lookups
 */
OfferVisibilitySchema.statics.loadMapForOffers = async function loadMapForOffers(deviceTokenId, offerIds = []) {
  if (!deviceTokenId || !Array.isArray(offerIds) || offerIds.length === 0) return new Map();
  const rows = await this.find({ deviceToken: deviceTokenId, offerId: { $in: offerIds } })
    .lean()
    .exec();
  const map = new Map();
  for (const r of rows) map.set(String(r.offerId), r);
  return map;
};

const OfferVisibility = model('OfferVisibility', OfferVisibilitySchema);
export { STATUS as OFFER_VISIBILITY_STATUS };
export default OfferVisibility;
