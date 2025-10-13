// backend/models/Provider.js
import mongoose from 'mongoose';

const { Schema } = mongoose;

/* Helpers für Geo-Validierung */
const isFiniteNum = (n) => typeof n === 'number' && Number.isFinite(n);
const inLat = (lat) => isFiniteNum(lat) && lat >= -90 && lat <= 90;
const inLng = (lng) => isFiniteNum(lng) && lng >= -180 && lng <= 180;

/** GeoJSON Point schema: [lng, lat] */
const locationSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], required: true, default: 'Point' },
    coordinates: {
      type: [Number], // [lng, lat]
      required: true,
      validate: {
        validator: (arr) => {
          if (!Array.isArray(arr) || arr.length !== 2) return false;
          const [lng, lat] = arr.map(Number);
          return inLng(lng) && inLat(lat);
        },
        message: 'coordinates must be [lng, lat] within valid ranges',
      },
    },
  },
  { _id: false }
);

const providerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    category: { type: String, trim: true },
    subcategory: { type: String, trim: true },
    description: { type: String, trim: true },
    contact: {
      phone: { type: String, trim: true },
      email: { type: String, trim: true },
      website: { type: String, trim: true },
    },
    location: { type: locationSchema, required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// 2dsphere-Index für Geo-Queries
providerSchema.index({ location: '2dsphere' });

/* Casting/Normalisierung vor Validate – verhindert String-Koordinaten */
providerSchema.pre('validate', function (next) {
  if (this.location && Array.isArray(this.location.coordinates)) {
    this.location.coordinates = this.location.coordinates.map((n) => Number(n));
  }
  if (this.location && this.location.type !== 'Point') {
    this.location.type = 'Point';
  }
  next();
});

const Provider =
  mongoose.models.Provider || mongoose.model('Provider', providerSchema);

export default Provider;
