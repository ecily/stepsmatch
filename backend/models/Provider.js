import mongoose from 'mongoose';

const providerSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  category: String,
  description: String,
  contact: String,
  address: String,
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [lng, lat]
      required: true,
    },
  },
  languages: {
    type: [String],
    default: [],
  },
});

export default mongoose.model('Provider', providerSchema);



