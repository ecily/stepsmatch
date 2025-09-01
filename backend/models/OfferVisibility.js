// backend/models/OfferVisibility.js
import mongoose from 'mongoose';

const { Schema, model, Types } = mongoose;

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
      ref: 'PushToken',   // ⬅️ korrektes Model
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
  }
);

// Eindeutig pro (deviceToken × offerId)
OfferVisibilitySchema.index({ deviceToken: 1, offerId: 1 }, { unique: true });
// Nützliche Sekundärindizes
OfferVisibilitySchema.index({ updatedAt: -1 });
OfferVisibilitySchema.index({ status: 1, remindAt: 1 });

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

OfferVisibilitySchema.statics.shouldNotify = async function shouldNotify(deviceTokenId, offerId, now = new Date()) {
  const doc = await this.findOne({ deviceToken: deviceTokenId, offerId }).lean().exec();
  if (!doc) return true;
  if (doc.status === STATUS.DISMISSED) return false;
  if (doc.status === STATUS.SNOOZED) return !!doc.remindAt && doc.remindAt <= now;
  if (doc.status === STATUS.SEEN) return true;
  return false; // NOTIFIED
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
