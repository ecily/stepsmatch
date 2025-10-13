// backend/models/Offer.js
import mongoose from 'mongoose';

const { Schema, model } = mongoose;

/* Helpers für Geo-Validierung */
const isFiniteNum = (n) => typeof n === 'number' && Number.isFinite(n);
const inLat = (lat) => isFiniteNum(lat) && lat >= -90 && lat <= 90;
const inLng = (lng) => isFiniteNum(lng) && lng >= -180 && lng <= 180;

const OfferSchema = new Schema(
  {
    provider:    { type: Schema.Types.ObjectId, ref: 'Provider', required: true },
    name:        { type: String, required: true },
    category:    { type: String, required: true },
    subcategory: { type: String, default: null },
    description: { type: String, maxlength: 250, default: null },

    /** Radius in Metern (Hauptfeld) */
    radius:      { type: Number, default: 100, min: 1 },

    /** Optionales Interessen-Targeting (wird client-/serverseitig in Kleinbuchstaben normalisiert) */
    interestsRequired: { type: [String], default: undefined },

    /**
     * Gültige Wochentage:
     * erlaubt sind Zahlen (0..6, So..Sa) ODER Strings ("Monday", "Dienstag", ...)
     */
    validDays:   { type: [Schema.Types.Mixed], default: undefined },

    /**
     * (Legacy-Eingaben) – wird von Routern ggf. in validDays transformiert.
     * Bleibt optional für Rückwärtskompatibilität.
     */
    weekdays:    { type: [Schema.Types.Mixed], default: undefined, select: false },

    /** Gültige Uhrzeiten "HH:mm" */
    validTimes: {
      from: { type: String, default: null }, // "HH:mm"
      to:   { type: String, default: null }, // "HH:mm"
    },

    /** Gültige Daten (inklusive) */
    validDates: {
      from: { type: Date, default: null },
      to:   { type: Date, default: null },
    },

    contact:     { type: String, default: null },
    images:      { type: [String], default: undefined },

    /** GeoJSON-Point: coordinates = [lng, lat] */
    location: {
      type:        { type: String, enum: ['Point'], required: true, default: 'Point' },
      coordinates: {
        type: [Number],          // [lng, lat]
        required: true,
        validate: {
          validator: (v) => {
            if (!Array.isArray(v) || v.length !== 2) return false;
            const [lng, lat] = v.map(Number);
            return inLng(lng) && inLat(lat);
          },
          message: 'location.coordinates must be [lng, lat] within valid ranges',
        },
      },
    },

    languages:    { type: [String], default: undefined },
    foundCounter: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'offers',
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

/* ────────────────────────────────────────────────────────────
   Virtuals: radiusMeters / radiusM (Kompatibilität)
   ──────────────────────────────────────────────────────────── */
OfferSchema.virtual('radiusMeters')
  .get(function () { return this.radius; })
  .set(function (v) { this.radius = Number(v); });

OfferSchema.virtual('radiusM')
  .get(function () { return this.radius; })
  .set(function (v) { this.radius = Number(v); });

/* ────────────────────────────────────────────────────────────
   Indizes
   ──────────────────────────────────────────────────────────── */
// Für $geoNear / $near
OfferSchema.index({ location: '2dsphere' }, { name: 'location_2dsphere' });

// Nützliche Sekundärindizes
OfferSchema.index({ updatedAt: -1 }, { name: 'offer_updatedAt_desc' });
OfferSchema.index({ provider: 1, updatedAt: -1 }, { name: 'provider_updatedAt' });

// (Optionale) Filter-Indizes für Zeitfenster – günstig für Poller/Queries
OfferSchema.index({ 'validDates.from': 1, 'validDates.to': 1 }, { name: 'validDates_range' });

/* ────────────────────────────────────────────────────────────
   Normalisierung: Stelle sicher, dass type='Point' ist
   ──────────────────────────────────────────────────────────── */
OfferSchema.pre('validate', function (next) {
  if (this.location && this.location.type !== 'Point') {
    this.location.type = 'Point';
  }
  // harte Zahlkonvertierung für Koordinaten
  if (this.location && Array.isArray(this.location.coordinates)) {
    this.location.coordinates = this.location.coordinates.map((n) => Number(n));
  }
  next();
});

export default model('Offer', OfferSchema);
