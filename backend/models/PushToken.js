// stepsmatch/backend/models/PushToken.js
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

    // ── NEU: Gültigkeitsflag für Self-Heal
    valid: { type: Boolean, default: true, index: true },

    // (Alt, nur für Rückwärtskompatibilität)
    disabled: { type: Boolean, default: false, index: true },

    // ── NEU: Fehler-/Retry-Metadaten
    lastError: { type: String, default: null },   // z. B. 'DeviceNotRegistered'
    lastTriedAt: { type: Date, default: null },

    // Aktivitäts-Timestamps
    lastSeenAt: { type: Date, default: Date.now, index: true },
    lastHeartbeatAt: { type: Date, default: null, index: true },

    // Letzte bekannte Location (GeoJSON: [lng, lat])
    lastLocation: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: undefined },
    },
    lastLocationAccuracy: { type: Number, default: null },
    lastLocationAt: { type: Date, default: null },
    lastLocationSpeed: { type: Number, default: null },

    // Interessen
    interests: { type: [String], default: [] },

    // Expo Project Scope
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

/* Indizes */
// Geo
PushTokenSchema.index({ lastLocation: '2dsphere' }, { name: 'lastLocation_2dsphere' });

// Aktivität
PushTokenSchema.index({ updatedAt: -1 }, { name: 'updatedAt_desc' });
PushTokenSchema.index({ lastHeartbeatAt: -1 }, { name: 'lastHeartbeatAt_desc' });

// Häufige Filterkombis (Self-Heal nutzt "valid:true")
PushTokenSchema.index(
  { projectId: 1, valid: 1, lastSeenAt: -1, updatedAt: -1 },
  { name: 'byProject_valid_recent' }
);
PushTokenSchema.index(
  { deviceId: 1, valid: 1, lastSeenAt: -1, updatedAt: -1 },
  { name: 'byDevice_valid_recent' }
);

// Altkompatibel für disabled
PushTokenSchema.index(
  { projectId: 1, disabled: 1, lastSeenAt: -1, updatedAt: -1 },
  { name: 'byProject_disabled_recent' }
);
PushTokenSchema.index(
  { deviceId: 1, disabled: 1, lastSeenAt: -1, updatedAt: -1 },
  { name: 'byDevice_disabled_recent' }
);

// Für Location-Scans
PushTokenSchema.index(
  { 'lastLocation.coordinates': 1, lastLocationAt: -1 },
  { name: 'coords_present_lastLocationAt_desc' }
);

export default model('PushToken', PushTokenSchema);
