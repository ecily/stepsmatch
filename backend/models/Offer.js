import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const isFiniteNum = (n) => typeof n === 'number' && Number.isFinite(n);
const inLat = (lat) => isFiniteNum(lat) && lat >= -90 && lat <= 90;
const inLng = (lng) => isFiniteNum(lng) && lng >= -180 && lng <= 180;

const timeWindowSchema = new Schema(
  {
    from: { type: String, default: null },
    to: { type: String, default: null },
  },
  { _id: false }
);

const OfferSchema = new Schema(
  {
    provider: { type: Schema.Types.ObjectId, ref: 'Provider', required: true },

    // New reference schema (v2)
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
    subcategoryId: { type: Schema.Types.ObjectId, ref: 'Subcategory', default: null, index: true },

    // Legacy fields kept for compatibility during migration
    category: { type: String, required: true },
    subcategory: { type: String, default: null },

    name: { type: String, required: true },
    description: { type: String, maxlength: 250, default: null },
    radius: { type: Number, default: 100, min: 1 },
    interestsRequired: { type: [String], default: undefined },
    validDays: { type: [Schema.Types.Mixed], default: undefined },
    weekdays: { type: [Schema.Types.Mixed], default: undefined, select: false },
    validTimes: {
      from: { type: String, default: null },
      to: { type: String, default: null },
    },
    validDates: {
      from: { type: Date, default: null },
      to: { type: Date, default: null },
    },
    contentType: {
      type: String,
      enum: [
        'legacy_offer',
        'real_demo_location',
        'real_provider_candidate',
        'editorial_public_place',
        'official_test_provider',
        'demo_provider',
      ],
      default: 'legacy_offer',
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
    pushEligibility: {
      type: String,
      enum: ['eligible_normal', 'push_allowed', 'in_app_only', 'suppressed_for_pitch', 'silent', 'silent_admin_only'],
      default: 'in_app_only',
      index: true,
    },
    suggestedPushPriority: {
      type: String,
      enum: ['normal', 'low_or_in_app', 'silent/admin_only', 'silent_admin_only', 'high_attention'],
      default: 'low_or_in_app',
    },
    matchReason: { type: String, trim: true, maxlength: 500, default: null },
    riskNote: { type: String, trim: true, maxlength: 1000, default: null },
    sourceUrl: { type: String, trim: true, default: null },
    sourceVerifiedAt: { type: Date, default: null },
    validFrom: { type: Date, default: null },
    validTo: { type: Date, default: null },
    activeDays: { type: [Schema.Types.Mixed], default: undefined },
    activeTimeWindows: { type: [timeWindowSchema], default: undefined },
    geoValidity: {
      type: String,
      enum: ['point_radius', 'area_candidate', 'route_candidate'],
      default: 'point_radius',
      index: true,
    },
    cooldownSuggestionHours: { type: Number, min: 0, default: null },
    contact: { type: String, default: null },
    images: { type: [String], default: undefined },
    location: {
      type: { type: String, enum: ['Point'], required: true, default: 'Point' },
      coordinates: {
        type: [Number],
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
    languages: { type: [String], default: undefined },
    foundCounter: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'offers',
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

OfferSchema.virtual('radiusMeters')
  .get(function () { return this.radius; })
  .set(function (v) { this.radius = Number(v); });

OfferSchema.virtual('radiusM')
  .get(function () { return this.radius; })
  .set(function (v) { this.radius = Number(v); });

OfferSchema.index({ location: '2dsphere' }, { name: 'location_2dsphere' });
OfferSchema.index({ updatedAt: -1 }, { name: 'offer_updatedAt_desc' });
OfferSchema.index({ provider: 1, updatedAt: -1 }, { name: 'provider_updatedAt' });
OfferSchema.index({ 'validDates.from': 1, 'validDates.to': 1 }, { name: 'validDates_range' });
OfferSchema.index({ publicVisibility: 1, pushEligibility: 1, geoValidity: 1 }, { name: 'offer_pitch_policy' });

OfferSchema.pre('validate', function (next) {
  if (this.location && this.location.type !== 'Point') this.location.type = 'Point';
  if (this.location && Array.isArray(this.location.coordinates)) {
    this.location.coordinates = this.location.coordinates.map((n) => Number(n));
  }
  if (this.validFrom && !this.validDates?.from) {
    this.validDates = { ...(this.validDates || {}), from: this.validFrom };
  }
  if (this.validTo && !this.validDates?.to) {
    this.validDates = { ...(this.validDates || {}), to: this.validTo };
  }
  if (Array.isArray(this.activeDays) && this.activeDays.length && (!Array.isArray(this.validDays) || this.validDays.length === 0)) {
    this.validDays = this.activeDays;
  }
  if (Array.isArray(this.activeTimeWindows) && this.activeTimeWindows.length) {
    const first = this.activeTimeWindows.find((w) => w && (w.from || w.to));
    if (first && !this.validTimes?.from && !this.validTimes?.to) {
      this.validTimes = { from: first.from || null, to: first.to || null };
    }
  }
  next();
});

export default model('Offer', OfferSchema);
