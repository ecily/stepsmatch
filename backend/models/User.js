// backend/models/User.js
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },

    // 🆕 Onboarding-Daten
    preferredRadius: { type: Number, default: 500 }, // z. B. 500 m
    interests: { type: [String], default: [] }, // Subkategorien wie "Café", "Museum", etc.
  },
  { timestamps: true }
);

// ✅ Password Hashing Middleware
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

const User = mongoose.model('User', userSchema);
export default User;
