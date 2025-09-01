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
      coordinates: { type: [Number], index: '2dsphere', default: undefined }, // [lng, lat]
    },
    interests: { type: [String], default: [] },
    projectId: { type: String, default: null },
  },
  { timestamps: true }
);

PushTokenSchema.index({ lastHeartbeatAt: -1 });
PushTokenSchema.index({ updatedAt: -1 });

export default mongoose.model('PushToken', PushTokenSchema);
