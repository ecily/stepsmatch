// backend/models/Offer.js

import mongoose from 'mongoose';

const OfferSchema = new mongoose.Schema({
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Provider',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  subcategory: {
    type: String  // 👈 Subkategorie hinzugefügt
  },
  description: {
    type: String,
    maxlength: 250
  },
  radius: {
    type: Number,
    default: 100
  },
  validDays: {
    type: [String]
  },
  validTimes: {
    start: String,
    end: String
  },
  validDates: {
    from: Date,
    to: Date
  },
  contact: {
    type: String
  },
  images: {
    type: [String]
  },
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
  languages: {
    type: [String]
  }
}, {
  timestamps: true
});

export default mongoose.model('Offer', OfferSchema);
