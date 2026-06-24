import mongoose from 'mongoose';

const { Schema } = mongoose;

const isFiniteNum = (n) => typeof n === 'number' && Number.isFinite(n);
const inLat = (lat) => isFiniteNum(lat) && lat >= -90 && lat <= 90;
const inLng = (lng) => isFiniteNum(lng) && lng >= -180 && lng <= 180;

const locationSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], required: true, default: 'Point' },
    coordinates: {
      type: [Number],
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

const daySlotsSchema = new Schema(
  {
    from: { type: String, required: true },
    to: { type: String, required: true },
  },
  { _id: false }
);

const providerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, trim: true },

    // Optional reference-based category profile field
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', default: null },

    // Legacy compatibility
    category: { type: String, trim: true },
    subcategory: { type: String, trim: true },

    description: { type: String, trim: true },
    radiusMeters: { type: Number, min: 1, default: 250 },
    demoKey: { type: String, trim: true, default: null, index: true },
    demoSeedTag: { type: String, trim: true, default: null, index: true },
    gebiet: { type: String, trim: true, default: null },
    contentType: {
      type: String,
      enum: [
        'legacy_provider',
        'real_demo_location',
        'editorial_public_place',
        'official_test_provider',
        'demo_provider',
      ],
      default: 'legacy_provider',
    },
    publicVisibility: {
      type: String,
      enum: [
        'active_public_demo',
        'in_app_only_demo',
        'silent_admin_only',
        'needs_review_before_import',
        'do_not_import_v1',
      ],
      default: 'in_app_only_demo',
      index: true,
    },
    demoLabel: { type: String, trim: true, default: null },
    sourceUrl: { type: String, trim: true, default: null },
    sourceVerifiedAt: { type: Date, default: null },
    riskNote: { type: String, trim: true, maxlength: 1000, default: null },
    contact: {
      phone: { type: String, trim: true },
      email: { type: String, trim: true },
      website: { type: String, trim: true },
    },
    openingHours: {
      timezone: { type: String, default: 'Europe/Vienna' },
      mon: { type: [daySlotsSchema], default: undefined },
      tue: { type: [daySlotsSchema], default: undefined },
      wed: { type: [daySlotsSchema], default: undefined },
      thu: { type: [daySlotsSchema], default: undefined },
      fri: { type: [daySlotsSchema], default: undefined },
      sat: { type: [daySlotsSchema], default: undefined },
      sun: { type: [daySlotsSchema], default: undefined },
    },
    location: { type: locationSchema, required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

providerSchema.index({ location: '2dsphere' });
providerSchema.index({ demoSeedTag: 1, demoKey: 1 }, { sparse: true });

providerSchema.pre('validate', function (next) {
  if (this.location && Array.isArray(this.location.coordinates)) {
    this.location.coordinates = this.location.coordinates.map((n) => Number(n));
  }
  if (this.location && this.location.type !== 'Point') {
    this.location.type = 'Point';
  }
  next();
});

const Provider = mongoose.models.Provider || mongoose.model('Provider', providerSchema);

export default Provider;
