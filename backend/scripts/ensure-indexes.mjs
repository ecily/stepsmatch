// backend/scripts/ensure-indexes.mjs
// Ensures missing geo indexes idempotently.
import { MongoClient } from 'mongodb';

const URI = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL;

if (!URI) {
  console.error('[fail] Missing MongoDB connection URI. Set MONGODB_URI, MONGO_URI, or DATABASE_URL.');
  process.exit(1);
}

const client = new MongoClient(URI);

async function run() {
  await client.connect();
  // DB aus URI ziehen; fallback 'stepsmatch'
  const path = new URL(URI).pathname || '';
  const dbName = path.startsWith('/') ? path.slice(1) : (path || 'stepsmatch');
  const db = client.db(dbName || 'stepsmatch');

  // Kandidaten-Collections (unterschiedliche Schreibweisen)
  const tokenCollections = ['pushTokens', 'pushtokens'];

  for (const coll of tokenCollections) {
    try {
      const res = await db.collection(coll).createIndex(
        { lastLocation: '2dsphere' },
        { name: 'lastLocation_2dsphere' }
      );
      console.log(`[ok] ${coll}.lastLocation 2dsphere => ${res}`);
    } catch (e) {
      console.warn(`[skip] ${coll}: ${e.message}`);
    }
  }

  // Offers / Providers
  try {
    const r1 = await db.collection('offers').createIndex(
      { location: '2dsphere' },
      { name: 'offer_location_2dsphere' }
    );
    console.log(`[ok] offers.location 2dsphere => ${r1}`);
  } catch (e) {
    console.warn(`[skip] offers: ${e.message}`);
  }

  try {
    const r2 = await db.collection('providers').createIndex(
      { location: '2dsphere' },
      { name: 'provider_location_2dsphere' }
    );
    console.log(`[ok] providers.location 2dsphere => ${r2}`);
  } catch (e) {
    console.warn(`[skip] providers: ${e.message}`);
  }

  console.log('[done] geo indexes ensured');
  await client.close();
}

run().catch(async (e) => {
  console.error('[fail]', e);
  try { await client.close(); } catch {}
  process.exit(1);
});
