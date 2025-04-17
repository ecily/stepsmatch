import mongoose from 'mongoose';

const offerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  radius: { type: Number, default: 100 },
  validDays: { type: [String], default: [] }, // Array of valid days (e.g., ["Monday", "Tuesday"])
  validTimes: {
    start: { type: String, default: '00:00' },
    end: { type: String, default: '23:59' },
  },
  validDates: {
    from: { type: Date, required: true },
    to: { type: Date, required: true },
  },
  contact: { type: String },
  images: { type: [String], default: [] }, // Array of image URLs (base64)
  location: {
    type: { type: String, default: 'Point' }, // GeoJSON Point
    coordinates: { type: [Number], index: '2dsphere' }, // [longitude, latitude]
  },
  provider: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', required: true },
}, {
  timestamps: true, // Automatically add createdAt and updatedAt timestamps
});

const Offer = mongoose.model('Offer', offerSchema);

export default Offer;
