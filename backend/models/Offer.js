import mongoose from 'mongoose';

const offerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  description: String,
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Provider',
    required: true,
  },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true },
  },
  radius: { type: Number, default: 100 },
  address: String,
  languages: [String],
  validDays: [String],
  validTimes: {
    start: String,
    end: String,
  },
  contact: String,
  imageUrl: String,
});

offerSchema.index({ location: "2dsphere" });

export default mongoose.model('Offer', offerSchema);
