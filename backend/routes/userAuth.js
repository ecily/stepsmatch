// /routes/userAuth.js
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import User from '../models/User.js';
import Provider from '../models/Provider.js';
import sendPushNotification from '../utils/sendPushNotification.js';

const router = express.Router();
const DEFAULT_PROVIDER_CATEGORY = 'Dienstleistungen';
const DEFAULT_PROVIDER_LOCATION = [15.4395, 47.0707]; // Graz fallback [lng, lat]

// ⏺️ Registrierung
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    console.log('🔄 Registrierungs-Request erhalten:', email);

    const existing = await User.findOne({ email });
    if (existing) {
      console.warn('⚠️ Registrierung abgebrochen: E-Mail bereits vergeben');
      return res.status(400).json({ error: 'E-Mail bereits vergeben' });
    }

    const newUser = new User({ name, email, password });
    await newUser.save();
    console.log('✅ Neuer User gespeichert:', newUser._id);

    let provider = null;
    try {
      provider = await Provider.create({
        name: String(name || email || 'Neuer Anbieter').trim(),
        address: 'Adresse noch nicht gesetzt',
        category: DEFAULT_PROVIDER_CATEGORY,
        description: 'Automatisch bei Registrierung erstellt. Bitte Profil vervollstaendigen.',
        contact: { email },
        location: { type: 'Point', coordinates: DEFAULT_PROVIDER_LOCATION },
        user: newUser._id,
      });
      console.log('✅ Provider automatisch erstellt:', provider._id);
    } catch (providerErr) {
      console.error('❌ Provider konnte nicht erstellt werden, rolle User zurueck:', providerErr);
      await User.findByIdAndDelete(newUser._id);
      return res.status(500).json({ error: 'Registrierung fehlgeschlagen (Provider-Profil konnte nicht erstellt werden)' });
    }

    const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: newUser, provider });
  } catch (err) {
    console.error('❌ Fehler bei Registrierung:', err);
    res.status(500).json({ error: 'Registrierung fehlgeschlagen' });
  }
});

// ⏺️ Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('🔐 Login-Request:', email);

    const user = await User.findOne({ email });
    if (!user) {
      console.warn('⚠️ Kein User gefunden bei Login');
      return res.status(401).json({ error: 'Falsche Anmeldedaten' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.warn('⚠️ Passwort falsch bei Login');
      return res.status(401).json({ error: 'Falsche Anmeldedaten' });
    }

    console.log('✅ Login erfolgreich für:', user._id);

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (err) {
    console.error('❌ Fehler beim Login:', err);
    res.status(500).json({ error: 'Login fehlgeschlagen' });
  }
});

// ⏺️ Push Token speichern
router.post('/push-token/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { expoPushToken } = req.body;

    console.log('📥 Push-Token Request empfangen');
    console.log('→ User ID:', userId);
    console.log('→ expoPushToken:', expoPushToken);

    if (!expoPushToken) {
      console.warn('⚠️ Kein Push Token im Request Body');
      return res.status(400).json({ error: 'Kein Push-Token übergeben' });
    }

    const user = await User.findById(userId);
    if (!user) {
      console.warn('⚠️ User nicht gefunden:', userId);
      return res.status(404).json({ error: 'Nutzer nicht gefunden' });
    }

    user.expoPushToken = expoPushToken;
    await user.save();

    console.log('✅ Push Token erfolgreich gespeichert für:', user.email);
    res.json({ message: 'Push-Token gespeichert', userId, expoPushToken });
  } catch (err) {
    console.error('❌ Fehler beim Speichern des Push Tokens:', err);
    res.status(500).json({ error: 'Serverfehler beim Speichern des Push Tokens' });
  }
});

// ⏺️ Test-Push senden
router.post('/test-push/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);

    if (!user || !user.expoPushToken) {
      console.warn('❌ Kein gültiger Push-Token für:', userId);
      return res.status(404).json({ error: 'Kein gültiger Push-Token gefunden' });
    }

    const result = await sendPushNotification(user.expoPushToken, {
      title: '🎉 Push funktioniert!',
      body: 'Dies ist eine Testnachricht von StepsMatch.',
      data: { screen: 'Home' }
    });

    console.log('📤 Test-Push gesendet an:', user.expoPushToken);
    res.json({ message: 'Push gesendet', result });
  } catch (err) {
    console.error('❌ Fehler bei Test-Push:', err);
    res.status(500).json({ error: 'Fehler beim Senden der Push-Nachricht' });
  }
});

// 🆕 Interessen & Radius speichern
router.put('/preferences/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { preferredRadius, interests } = req.body;

    if (!preferredRadius || !interests) {
      return res.status(400).json({ error: 'Radius und Interessen sind erforderlich.' });
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
    res.status(500).json({ error: 'Serverfehler beim Speichern der Präferenzen' });
  }
});

export default router;
