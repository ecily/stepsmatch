// backend/routes/userAuth.js
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import User from '../models/User.js';
import { sendPushNotification } from '../utils/sendPushNotification.js';

const router = express.Router();

// ⏺️ Registrierung
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'E-Mail bereits vergeben' });

    const newUser = new User({ name, email, password });
    await newUser.save();

    const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: newUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registrierung fehlgeschlagen' });
  }
});

// ⏺️ Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Falsche Anmeldedaten' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Falsche Anmeldedaten' });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login fehlgeschlagen' });
  }
});

// ⏺️ 🆕 Push Token speichern (mit Logging)
router.post('/push-token/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { expoPushToken } = req.body;

    console.log('📥 Push-Token Request empfangen');
    console.log('→ User ID:', userId);
    console.log('→ Token:', expoPushToken);

    if (!expoPushToken) {
      console.warn('⚠️ Kein Token im Request Body');
      return res.status(400).json({ error: 'Kein Push-Token übergeben' });
    }

    const user = await User.findByIdAndUpdate(userId, { expoPushToken }, { new: true });
    if (!user) {
      console.warn('⚠️ User nicht gefunden:', userId);
      return res.status(404).json({ error: 'Nutzer nicht gefunden' });
    }

    console.log('✅ Token erfolgreich gespeichert für Nutzer:', user.email);
    res.json({ message: 'Push-Token gespeichert', user });
  } catch (err) {
    console.error('❌ Fehler beim Speichern des Push Tokens:', err);
    res.status(500).json({ error: 'Serverfehler beim Speichern des Push Tokens' });
  }
});

// ⏺️ 🧪 Test-Notification an User senden
router.post('/test-push/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);

    if (!user || !user.expoPushToken) {
      return res.status(404).json({ error: 'Kein gültiger Push-Token gefunden' });
    }

    const result = await sendPushNotification(user.expoPushToken, {
      title: '🎉 Push funktioniert!',
      body: 'Dies ist eine Testnachricht von StepsMatch.',
      data: { screen: 'Home' }
    });

    res.json({ message: 'Push gesendet', result });
  } catch (err) {
    console.error('❌ Fehler bei Test-Push:', err);
    res.status(500).json({ error: 'Fehler beim Senden der Push-Nachricht' });
  }
});

export default router;
