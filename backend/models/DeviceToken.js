import mongoose from 'mongoose';

const { Schema, Types } = mongoose;

const DeviceTokenSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', default: null, index: true },
    token: { type: String, required: true, unique: true, index: true }, // Expo Push Token
    platform: { type: String, enum: ['android', 'ios', 'web'], required: true, index: true },
    deviceId: { type: String, default: null, index: true }, // optional: z.B. Installation-ID
    lastSeenAt: { type: Date, default: Date.now },
    disabled: { type: Boolean, default: false }
  },
  { timestamps: true }
);

// zusätzliche sinnvolle Indizes
DeviceTokenSchema.index({ userId: 1, platform: 1 });
DeviceTokenSchema.index({ deviceId: 1 });

export default mongoose.model('DeviceToken', DeviceTokenSchema);
