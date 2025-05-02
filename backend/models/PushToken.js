import mongoose from 'mongoose';

const pushTokenSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  platform: { type: String, enum: ['android', 'ios', 'web'], required: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('PushToken', pushTokenSchema);
