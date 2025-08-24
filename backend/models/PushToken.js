// backend/models/PushToken.js
import mongoose from 'mongoose';

const { Schema, Types } = mongoose;

/**
 * Subschema für GeoJSON-Point OHNE Defaults.
 * -> Feld existiert nur, wenn wir es explizit setzen (z. B. im /heartbeat).
 * -> Keine automatische Erzeugung von { type: 'Point' } ohne coordinates.
 */
const lastLocationSchema = new Schema(
  {
    type: { type: String, enum: ['Point'] },
    coordinates: { type: [Number] }, // [lng, lat]
  },
  { _id: false }
);

const pushTokenSchema = new Schema(
  {
    // Expo Push Token (z. B. "ExponentPushToken[xxxxxxxxxxxxxxxxxxxx]")
    token: { type: String, required: true, unique: true, index: true },

    // Plattform wird von der App beim /push/register-/heartbeat-Aufruf mitgegeben
    platform: { type: String, enum: ['android', 'ios', 'web'], required: true, index: true },

    // Optional: Zuordnung zu einem eingeloggten Nutzer (falls vorhanden)
    userId: { type: Types.ObjectId, ref: 'User', default: null, index: true },

    // Optional: Geräte-/Installations-ID (falls clientseitig geführt)
    deviceId: { type: String, default: null, index: true },

    // Token vom Server deaktiviert (z. B. Expo: DeviceNotRegistered)
    disabled: { type: Boolean, default: false, index: true },

    // Letzte Sichtung/Registrierung
    lastSeenAt: { type: Date, default: Date.now, index: true },

    /**
     * Letzte bekannte Location (für Geofencing / Poller)
     * WICHTIG:
     *  - Kein Default -> wird nur gesetzt, wenn Koordinaten vorliegen
     *  - Dadurch entsteht nie { type: 'Point' } ohne coordinates
     */
    lastLocation: { type: lastLocationSchema, default: undefined },
  },
  {
    timestamps: true,           // createdAt + updatedAt automatisch
    versionKey: false,
    collection: 'devicetoken',  // exakt deine bestehende Collection (singular)
  }
);

// Sinnvolle Kombi-Indizes
pushTokenSchema.index({ userId: 1, platform: 1 });
pushTokenSchema.index({ userId: 1, updatedAt: -1 });

// Geo-Index für $near-Abfragen im Poller
pushTokenSchema.index({ lastLocation: '2dsphere' });

export default mongoose.model('PushToken', pushTokenSchema);
