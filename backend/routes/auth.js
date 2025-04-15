// backend/routes/auth.js
import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = express.Router();

// Registrierung
router.post('/register', async (req, res) => {
  try {
    console.log('📥 POST /register payload:', req.body);

    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      console.log('⛔ Fehlende Felder:', { name, email, password });
      return res.status(400).json({ error: 'Alle Felder sind erforderlich.' });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      console.log('⚠️ E-Mail bereits registriert:', email);
      return res.status(400).json({ error: 'E-Mail bereits registriert' });
    }

    const newUser = new User({ name, email, password }); // Hashing erfolgt im Schema
    await newUser.save();
    console.log('✅ Benutzer gespeichert:', newUser._id);

    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });

    res.status(201).json({
      token,
      provider: {
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email
      }
    });
  } catch (error) {
    console.error('❌ Fehler bei Registrierung:', error);
    res.status(500).json({ error: 'Serverfehler bei Registrierung' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      console.log('❌ Login fehlgeschlagen: E-Mail nicht gefunden');
      return res.status(400).json({ error: 'E-Mail nicht gefunden' });
    }

    const bcrypt = await import('bcrypt');
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log('❌ Login fehlgeschlagen: Falsches Passwort');
      return res.status(400).json({ error: 'Falsches Passwort' });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });

    res.json({
      token,
      provider: {
        _id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('❌ Fehler beim Login:', error);
    res.status(500).json({ error: 'Serverfehler beim Login' });
  }
});

export default router;




