// backend/models/Offer.js
import mongoose from 'mongoose';

const OfferSchema = new mongoose.Schema(
  {
    provider:   { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', required: true },
    name:       { type: String, required: true },
    category:   { type: String, required: true },
    subcategory:{ type: String },
    description:{ type: String, maxlength: 250 },
    radius:     { type: Number, default: 100 },

    // [0..6] ODER ['Mon','Dienstag',...]
    validDays:  { type: [mongoose.Schema.Types.Mixed], default: undefined },

    // Einheitlich: from/to (Strings HH:mm). Eingehend akzeptieren wir auch start/end (Normalisierung im Router).
    validTimes: {
      from: { type: String }, // "HH:mm"
      to:   { type: String }, // "HH:mm"
    },

    // Datumsfenster (inklusive)
    validDates: {
      from: { type: Date },
      to:   { type: Date },
    },

    contact:    { type: String },
    images:     { type: [String] },

    location: {
      type:        { type: String, enum: ['Point'], required: true },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },

    languages:   { type: [String] },
    foundCounter:{ type: Number, default: 0 },
  },
  { timestamps: true }
);

// Geo-Index für $geoNear/$near
OfferSchema.index({ location: '2dsphere' });
OfferSchema.index({ updatedAt: -1 });

export default mongoose.model('Offer', OfferSchema);
