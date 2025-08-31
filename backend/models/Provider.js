// backend/models/Provider.js
import mongoose from 'mongoose';

const { Schema } = mongoose;

/** GeoJSON Point schema: [lng, lat] */
const locationSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], required: true, default: 'Point' },
    coordinates: {
      type: [Number], // [lng, lat]
      required: true,
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length === 2,
        message: 'coordinates must be [lng, lat]',
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
    // optional: radiusMeters o.ä. kann später ergänzt werden
  },
  { timestamps: true }
);

// 2dsphere-Index für Geo-Queries
providerSchema.index({ location: '2dsphere' });

const Provider =
  mongoose.models.Provider || mongoose.model('Provider', providerSchema);

export default Provider;
