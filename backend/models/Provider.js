// backend/models/Provider.js
import mongoose from 'mongoose';

const providerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  description: { type: String },
  contact: { type: String },
  address: { type: String },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true
    },
    coordinates: {
      type: [Number],
      required: true
    }
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

providerSchema.index({ location: '2dsphere' });

const Provider = mongoose.model('Provider', providerSchema);
export default Provider;

