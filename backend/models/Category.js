// backend/models/Category.js
import mongoose from 'mongoose';

const CategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  subcategories: {
    type: [String],
    default: [],
  }
}, { timestamps: true });

const Category = mongoose.model('Category', CategorySchema);
export default Category;
