import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import bcrypt from 'bcrypt';

// Registrierung
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Alle Felder sind erforderlich.' });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ error: 'E-Mail bereits registriert' });
    }

    const newUser = new User({ name, email, password }); // Hashing erfolgt im Schema
    await newUser.save();

    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    res.status(201).json({
      token,
      provider: {
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
      },
    });
  } catch (error) {
    console.error('❌ Fehler bei Registrierung:', error);
    res.status(500).json({ error: 'Serverfehler bei Registrierung' });
  }
};

// Login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'E-Mail nicht gefunden' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Falsches Passwort' });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    res.json({
      token,
      provider: {
        _id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('❌ Fehler beim Login:', error);
    res.status(500).json({ error: 'Serverfehler beim Login' });
  }
};

// Onboarding-Präferenzen speichern
export const savePreferences = async (req, res) => {
  try {
    const { userId } = req.params;
    const { preferredRadius, interests } = req.body;

    if (!preferredRadius || !interests) {
      return res
        .status(400)
        .json({ error: 'Radius und Interessen sind erforderlich.' });
    }

    const updated = await User.findByIdAndUpdate(
      userId,
      { preferredRadius, interests },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Nutzer nicht gefunden' });
    }

    res.json({ message: 'Präferenzen erfolgreich gespeichert', user: updated });
  } catch (error) {
    console.error('❌ Fehler beim Speichern der Präferenzen:', error);
    res
      .status(500)
      .json({ error: 'Serverfehler beim Speichern der Präferenzen' });
  }
};
