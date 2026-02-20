import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import Category from '../models/Category.js';
import Subcategory from '../models/Subcategory.js';
import Provider from '../models/Provider.js';
import Offer from '../models/Offer.js';
import User from '../models/User.js';

const MONGO_URI = process.env.MONGO_URI;
const SEED_TAG = process.env.SEED_TAG || 'graz_seed_v1';
const PROVIDERS_TARGET = Number(process.env.SEED_PROVIDERS || 100);

if (!MONGO_URI) {
  console.error('MONGO_URI missing');
  process.exit(1);
}

const CATALOG = [
  { name: 'Gastronomie', subs: ['Restaurant', 'Cafe', 'Baeckerei', 'Bar'] },
  { name: 'Lebensmittel & Alltag', subs: ['Supermarkt', 'Drogerie', 'Apotheke', 'Kiosk'] },
  { name: 'Gesundheit', subs: ['Allgemeinmedizin', 'Zahnarzt', 'Physiotherapie', 'Optik'] },
  { name: 'Beauty & Koerperpflege', subs: ['Friseur', 'Kosmetikstudio', 'Nagelstudio', 'Massage'] },
  { name: 'Mode & Accessoires', subs: ['Damenmode', 'Herrenmode', 'Schuhe', 'Schmuck'] },
  { name: 'Wohnen & Haushalt', subs: ['Moebel', 'Haushaltswaren', 'Baumarkt', 'Elektrofachhandel'] },
  { name: 'Mobilitaet & Auto', subs: ['KFZ-Werkstatt', 'Fahrradservice', 'Autohaus', 'Reifenservice'] },
  { name: 'Sport & Freizeit', subs: ['Fitnessstudio', 'Yogastudio', 'Tanzschule', 'Schwimmbad'] },
  { name: 'Kultur & Bildung', subs: ['Buchhandlung', 'Kino', 'Nachhilfe', 'Sprachschule'] },
  { name: 'Nachtleben & Events', subs: ['Club', 'Cocktailbar', 'Pub', 'Live-Musik'] },
  { name: 'Dienstleistungen', subs: ['Reinigung', 'Schneiderei', 'Copyshop', 'Handyreparatur'] },
  { name: 'Familie & Kinder', subs: ['Spielwaren', 'Babyartikel', 'Kinderbetreuung', 'Indoor-Spielplatz'] },
];

const CLUSTERS = [
  { name: 'Innere Stadt', lat: 47.0707, lng: 15.4395, spread: 0.006 },
  { name: 'Lend', lat: 47.0769, lng: 15.4317, spread: 0.007 },
  { name: 'Gries', lat: 47.0618, lng: 15.4304, spread: 0.009 },
  { name: 'St. Leonhard', lat: 47.0729, lng: 15.4571, spread: 0.008 },
  { name: 'Geidorf', lat: 47.0838, lng: 15.4424, spread: 0.009 },
  { name: 'Eggenberg', lat: 47.0709, lng: 15.3978, spread: 0.011 },
  { name: 'Liebenau', lat: 47.0419, lng: 15.4625, spread: 0.011 },
  { name: 'Puntigam', lat: 47.0336, lng: 15.4256, spread: 0.012 },
  { name: 'Andritz', lat: 47.1125, lng: 15.4212, spread: 0.012 },
  { name: 'Mariatrost', lat: 47.0969, lng: 15.4928, spread: 0.013 },
];

const OFFER_TYPES = {
  Gastronomie: ['Mittagsmenue', 'Fruehstuecksangebot', 'After-Work-Deal'],
  'Lebensmittel & Alltag': ['Wochenaktion', '2+1 Angebot', 'Saisonaktion'],
  Gesundheit: ['Erstberatung', 'Vorsorge-Slot', 'Check-Paket'],
  'Beauty & Koerperpflege': ['Neukundenrabatt', 'Kombi-Behandlung', 'Last-Minute-Termin'],
  'Mode & Accessoires': ['Saisonrabatt', 'Abverkauf', '2. Teil reduziert'],
  'Wohnen & Haushalt': ['Set-Angebot', 'Beratungsaktion', 'Wochenend-Deal'],
  'Mobilitaet & Auto': ['Servicepaket', 'Check-Aktion', 'Inspektionsangebot'],
  'Sport & Freizeit': ['Probetraining gratis', 'Schnupperkurs', 'Abendkurs-Special'],
  'Kultur & Bildung': ['Schnupperstunde', 'Workshop-Slot', 'Kursrabatt'],
  'Nachtleben & Events': ['Happy Hour', 'Event-Special', 'Late-Night-Deal'],
  Dienstleistungen: ['Express-Service', 'Neukundenpreis', 'Kombi-Service'],
  'Familie & Kinder': ['Familienpaket', 'Geschwisterrabatt', 'Ferienaktion'],
};

function slugify(v) {
  return String(v)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function jitter(base, spread) {
  return base + (Math.random() * 2 - 1) * spread;
}

function openingHoursFor(categoryName) {
  if (categoryName === 'Nachtleben & Events') {
    return {
      timezone: 'Europe/Vienna',
      thu: [{ from: '19:00', to: '02:00' }],
      fri: [{ from: '19:00', to: '03:00' }],
      sat: [{ from: '19:00', to: '03:00' }],
    };
  }
  if (categoryName === 'Gesundheit') {
    return {
      timezone: 'Europe/Vienna',
      mon: [{ from: '08:00', to: '17:00' }],
      tue: [{ from: '08:00', to: '17:00' }],
      wed: [{ from: '08:00', to: '17:00' }],
      thu: [{ from: '08:00', to: '17:00' }],
      fri: [{ from: '08:00', to: '14:00' }],
    };
  }
  return {
    timezone: 'Europe/Vienna',
    mon: [{ from: '09:00', to: '18:00' }],
    tue: [{ from: '09:00', to: '18:00' }],
    wed: [{ from: '09:00', to: '18:00' }],
    thu: [{ from: '09:00', to: '18:00' }],
    fri: [{ from: '09:00', to: '18:00' }],
    sat: [{ from: '10:00', to: '16:00' }],
  };
}

function offerSchedule(categoryName) {
  if (categoryName === 'Nachtleben & Events') {
    return { validDays: ['Thursday', 'Friday', 'Saturday'], validTimes: { from: '20:00', to: '23:59' } };
  }
  if (categoryName === 'Gastronomie') {
    return { validDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], validTimes: { from: '11:30', to: '14:30' } };
  }
  return { validDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], validTimes: { from: '10:00', to: '18:00' } };
}

async function ensureCatalog() {
  const categoryByName = new Map();
  const subByKey = new Map();

  for (let i = 0; i < CATALOG.length; i++) {
    const c = CATALOG[i];
    const cat = await Category.findOneAndUpdate(
      { $or: [{ slug: slugify(c.name) }, { name: c.name }] },
      {
        $set: { name: c.name, slug: slugify(c.name), isActive: true, sortOrder: i, subcategories: c.subs },
      },
      { new: true, upsert: true }
    );
    categoryByName.set(c.name, cat);

    for (let j = 0; j < c.subs.length; j++) {
      const s = c.subs[j];
      const sub = await Subcategory.findOneAndUpdate(
        { category: cat._id, slug: slugify(s) },
        { $set: { name: s, slug: slugify(s), isActive: true, sortOrder: j, category: cat._id } },
        { new: true, upsert: true }
      );
      subByKey.set(`${c.name}|${s}`, sub);
    }
  }

  return { categoryByName, subByKey };
}

async function ensureSeedUser() {
  const email = `seed+${SEED_TAG}@stepsmatch.local`;
  let user = await User.findOne({ email });
  if (!user) {
    const password = await bcrypt.hash('seed-password-123', 10);
    user = await User.create({ name: `Seed User ${SEED_TAG}`, email, password, interests: [] });
  }
  return user;
}

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('[seed] connected');

  const { categoryByName, subByKey } = await ensureCatalog();
  const seedUser = await ensureSeedUser();

  await Offer.deleteMany({ contact: new RegExp(`SEED:${SEED_TAG}`) });
  await Provider.deleteMany({ address: new RegExp(`SEED:${SEED_TAG}`) });

  let providerCount = 0;
  let offerCount = 0;

  for (let i = 0; i < PROVIDERS_TARGET; i++) {
    const cluster = CLUSTERS[i % CLUSTERS.length];
    const catCfg = CATALOG[i % CATALOG.length];
    const subName = pick(catCfg.subs);
    const catDoc = categoryByName.get(catCfg.name);
    const subDoc = subByKey.get(`${catCfg.name}|${subName}`);

    const lat = jitter(cluster.lat, cluster.spread);
    const lng = jitter(cluster.lng, cluster.spread);

    const provider = await Provider.create({
      name: `${catCfg.name} ${cluster.name} ${String(i + 1).padStart(3, '0')}`,
      address: `SEED:${SEED_TAG} - ${cluster.name}, Graz`,
      category: catCfg.name,
      categoryId: catDoc?._id || null,
      subcategory: subName,
      openingHours: openingHoursFor(catCfg.name),
      contact: { phone: `+43 316 ${100000 + i}`, website: 'https://stepsmatch.local' },
      location: { type: 'Point', coordinates: [lng, lat] },
      user: seedUser._id,
      description: `Seed provider in ${cluster.name}`,
    });
    providerCount++;

    for (let k = 0; k < 2; k++) {
      const offerType = pick(OFFER_TYPES[catCfg.name] || ['Wochenaktion']);
      const sched = offerSchedule(catCfg.name);
      const from = new Date();
      const to = new Date(Date.now() + 1000 * 60 * 60 * 24 * (7 + (k * 3)));

      await Offer.create({
        provider: provider._id,
        name: `${offerType} ${k + 1}`,
        category: catCfg.name,
        subcategory: subName,
        categoryId: catDoc?._id || null,
        subcategoryId: subDoc?._id || null,
        description: `${offerType} im Bereich ${subName} (${cluster.name}).`,
        radius: catCfg.name === 'Nachtleben & Events' ? 300 : 220,
        validDays: sched.validDays,
        validTimes: sched.validTimes,
        validDates: { from, to },
        location: { type: 'Point', coordinates: [lng, lat] },
        interestsRequired: [slugify(catCfg.name), slugify(subName)],
        contact: `SEED:${SEED_TAG}`,
        images: [],
      });
      offerCount++;
    }
  }

  console.log(`[seed] done providers=${providerCount} offers=${offerCount} tag=${SEED_TAG}`);
  await mongoose.disconnect();
}

run().catch(async (e) => {
  console.error('[seed] failed', e);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
