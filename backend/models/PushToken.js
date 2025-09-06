// backend/models/PushToken.js
import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const PushTokenSchema = new Schema(
  {
    // Expo Push Token (einzigartig pro Registrierung)
    token: { type: String, required: true, index: true, unique: true },

    // 'android' | 'ios' | etc.
    platform: { type: String, default: 'android' },

    // Zuordnung (optional)
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },

    // Stabiles Geräte-Merkmal (aus SecureStore)
    deviceId: { type: String, default: null, index: true },

    // Deaktiviert (z. B. nach DeviceNotRegistered)
    disabled: { type: Boolean, default: false, index: true },

    // Aktivitäts-Timestamps
    lastSeenAt: { type: Date, default: Date.now, index: true },
    lastHeartbeatAt: { type: Date, default: null, index: true },

    // Gemeldete Location (GeoJSON: [lng, lat])
    lastLocation: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: undefined },
    },

    // Zusatzinfos zur Location
    lastLocationAccuracy: { type: Number, default: null }, // Meter
    lastLocationAt: { type: Date, default: null },         // wann Position gültig war
    lastLocationSpeed: { type: Number, default: null },    // m/s (falls vorhanden)

    // Interessen für Targeting
    interests: { type: [String], default: [] },

    // Expo-Project-Scope
    projectId: { type: String, default: null, index: true },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'pushtokens',
    strict: true,
    minimize: false,
  }
);

/* ────────────────────────────────────────────────────────────
   Indizes
   ──────────────────────────────────────────────────────────── */

// 2dsphere-Index auf GeoJSON-Feld (für $near / $geoNear)
PushTokenSchema.index({ lastLocation: '2dsphere' }, { name: 'lastLocation_2dsphere' });

// Aktivität / Frische
PushTokenSchema.index({ updatedAt: -1 }, { name: 'updatedAt_desc' });
PushTokenSchema.index({ lastHeartbeatAt: -1 }, { name: 'lastHeartbeatAt_desc' });

// Häufige Filterkombis
PushTokenSchema.index(
  { projectId: 1, disabled: 1, lastSeenAt: -1, updatedAt: -1 },
  { name: 'byProject_enabled_recent' }
);
PushTokenSchema.index(
  { deviceId: 1, disabled: 1, lastSeenAt: -1, updatedAt: -1 },
  { name: 'byDevice_enabled_recent' }
);

// Für Leader-/Poller-Scans nach frischen Locations
PushTokenSchema.index(
  { 'lastLocation.coordinates': 1, lastLocationAt: -1 },
  { name: 'coords_present_lastLocationAt_desc' }
);

export default model('PushToken', PushTokenSchema);
