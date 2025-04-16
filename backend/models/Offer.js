// backend/models/Offer.js
import mongoose from 'mongoose';

const offerSchema = new mongoose.Schema({
  name: String,
  description: String,
  category: { type: String, required: true },
  // Weitere Felder wie Standort, Anbieter, etc.
});

const Offer = mongoose.model('Offer', offerSchema);

export default Offer;

