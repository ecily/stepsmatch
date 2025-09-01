// backend/models/PushToken.js
import mongoose from 'mongoose';

const PushTokenSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, index: true, unique: true },
    platform: { type: String, default: 'android' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deviceId: { type: String, default: null },
    disabled: { type: Boolean, default: false },
    lastSeenAt: { type: Date, default: Date.now },
    lastHeartbeatAt: { type: Date },
    lastLocation: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      // GeoJSON: [lng, lat]
      coordinates: { type: [Number], default: undefined },
    },
    interests: { type: [String], default: [] },
    projectId: { type: String, default: null },
  },
  { timestamps: true }
);

// 🔎 Indizes
PushTokenSchema.index({ lastHeartbeatAt: -1 });
PushTokenSchema.index({ updatedAt: -1 });

// ✅ WICHTIG: 2dsphere-Index auf dem GeoJSON-Feld selbst (für $geoNear)
PushTokenSchema.index({ lastLocation: '2dsphere' }, { name: 'lastLocation_2dsphere' });

export default mongoose.model('PushToken', PushTokenSchema);
