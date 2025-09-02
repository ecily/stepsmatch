import Offer from '../models/Offer.js';
import PushToken from '../models/PushToken.js';
import OfferVisibility from '../models/OfferVisibility.js';
import { sendPushAndCheckReceipts } from '../utils/push.js'; // robust wie Diagnose
import { isOfferActiveNow } from '../utils/isOfferActiveNow.js'; // TZ-sicher

/* ───────── Helpers ───────── */
function envMs(name, def) {
  const v = process.env[name];
  if (v === undefined) return def;
  const s = String(v).trim().toLowerCase();
  if (['', '0', 'false', 'off', 'null', 'none'].includes(s)) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : def;
}

function normalizeInterests(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((s) => String(s || '').toLowerCase().normalize('NFKD').trim())
    .filter(Boolean);
}

function interestsMatch(offer, token) {
  const req = normalizeInterests(offer?.interestsRequired);
  if (req.length === 0) return true; // kein Filter
  const have = new Set(normalizeInterests(token?.interests));
  if (have.size === 0) return false;
  return req.some((r) => have.has(r));
}

/* ───────── Konfig ───────── */
// ⏱️ Polling alle 60s (via ENV überschreibbar)
const INTERVAL_MS = envMs('PUSH_POLLER_INTERVAL_MS', 60_000);

// Wie weit zurück neue/aktualisierte Offers berücksichtigt werden
const NEW_OFFER_WINDOW_MS = envMs('PUSH_NEW_OFFER_WINDOW_MS', 15 * 60_000);

// 🛰️ Freshness-Fenster für Standort radikal kürzer (Default 3 Minuten)
const LAST_LOCATION_MAX_AGE_MS = envMs('PUSH_LAST_LOCATION_MAX_AGE_MS', 3 * 60_000);

// Fallback-Radius, falls Offer keinen Radius hat
const MAX_DISTANCE_M_DEFAULT = Number(process.env.PUSH_MAX_DISTANCE_M ?? 1500);

// ➕ Accuracy-Puffer: weitet den Geofence in der Query leicht aus
// (Worst-Case-Puffer; realer Wert pro Token kann optional später berücksichtigt werden)
const ACCURACY_BUFFER_MAX = Number(process.env.PUSH_ACCURACY_BUFFER_MAX ?? 100); // Meter

const TZ = 'Europe/Vienna';

// Push-Defaults (müssen zur App passen)
const PUSH_CHANNEL_ID = process.env.PUSH_CHANNEL_ID || 'offers';
const PUSH_PRIORITY = process.env.PUSH_PRIORITY || 'high';
const PUSH_SOUND = process.env.PUSH_SOUND || 'default';

// Projekt-Scope (Filter Tokens auf dieses Projekt, falls gesetzt)
const PROJECT_ID =
  process.env.EXPO_PROJECT_ID ||
  process.env.EXPO_PROJECT ||
  process.env.PROJECT_ID ||
  null;

let timer = null;

/* ───────── Start/Stop ───────── */
export function startOfferPoller() {
  if (timer) return;

  const DEBUG = process.env.DEBUG_OFFER_POLLER === '1';

  if (DEBUG) {
    console.log(
      `[offerPoller][debug] cfg interval=${INTERVAL_MS}ms freshness=${LAST_LOCATION_MAX_AGE_MS}ms accuracyBuf=${ACCURACY_BUFFER_MAX}m`
    );
  } else {
    console.log(`[offerPoller] started — every ${INTERVAL_MS}ms`);
  }

  async function doCycle() {
    const t0 = Date.now();
    try {
      const since = new Date(Date.now() - NEW_OFFER_WINDOW_MS);

      // 1) Neu/aktualisierte Offers
      const candidateOffers = await Offer.find({
        $or: [{ createdAt: { $gte: since } }, { updatedAt: { $gte: since } }],
      })
        .select(
          '_id name location radiusMeters radius validDates validTimes validDays weekdays category subcategory interestsRequired'
        )
        .lean();

      const now = new Date();
      const activeOffers = candidateOffers.filter((o) => isOfferActiveNow(o, TZ, now));

      // 2) Tokens mit frischer Location (ggf. auf Projekt einschränken)
      const freshSince = new Date(Date.now() - LAST_LOCATION_MAX_AGE_MS);
      const tokenQuery = {
        disabled: { $ne: true },
        'lastLocation.coordinates.0': { $exists: true },
        $or: [
          { lastHeartbeatAt: { $gte: freshSince } },
          { lastSeenAt: { $gte: freshSince } },
          { updatedAt: { $gte: freshSince } },
        ],
      };
      if (PROJECT_ID) tokenQuery.projectId = PROJECT_ID;

      const tokensFresh = await PushToken.find(tokenQuery)
        .select('_id token platform interests lastLocation projectId deviceId updatedAt lastSeenAt lastHeartbeatAt lastAccuracy')
        .lean();

      if (DEBUG) {
        console.log(
          `[offerPoller][debug] candidates=${candidateOffers.length} active=${activeOffers.length} tokensFresh=${tokensFresh.length}`
        );
      }

      if (!activeOffers.length || !tokensFresh.length) {
        if (DEBUG) console.log('[offerPoller][debug] nothing to do');
        return;
      }

      // 3) Für jedes Offer → Tokens im Radius (+Accuracy-Puffer)
      for (const offer of activeOffers) {
        try {
          const coords = offer?.location?.coordinates;
          const [lng, lat] = Array.isArray(coords) ? coords : [];
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

          const baseRadiusM = Number(offer.radiusMeters ?? offer.radius ?? MAX_DISTANCE_M_DEFAULT);
          if (!Number.isFinite(baseRadiusM) || baseRadiusM <= 0) continue;

          // Puffer anwenden
          const effRadiusM = Math.max(1, baseRadiusM + ACCURACY_BUFFER_MAX);

          if (DEBUG)
            console.log(
              `[offerPoller][debug] offer=${offer._id} using radiusM=${baseRadiusM} eff=${effRadiusM} @ [${lat.toFixed(
                5
              )},${lng.toFixed(5)}]`
            );

          // Geo-Query gegen frische Tokens (mit Puffer-Radius)
          const nearQuery = {
            _id: { $in: tokensFresh.map((t) => t._id) },
            lastLocation: {
              $near: {
                $geometry: { type: 'Point', coordinates: [lng, lat] },
                $maxDistance: effRadiusM,
              },
            },
          };

          const nearTokens = await PushToken.find(nearQuery)
            .select('_id token platform interests lastLocation projectId deviceId lastAccuracy')
            .lean();

          // Interessen-Matching
          let matched = nearTokens.filter((t) => interestsMatch(offer, t));

          // Optionales Feinfilter: wenn lastAccuracy vorhanden, echte effRadius pro Token bilden
          if (matched.length) {
            matched = matched.filter((t) => {
              const acc = Number(t?.lastAccuracy);
              if (!Number.isFinite(acc) || acc <= 0) return true; // kein Wert → bereits durch Puffer abgedeckt
              // Wenn Accuracy größer als globaler Puffer ist, erlauben wir noch bis zu diesem Wert
              // (Soft-Cap über ACCURACY_BUFFER_MAX hinaus vermeiden wir hier bewusst)
              return true;
            });
          }

          if (DEBUG) {
            console.log(
              `[offerPoller][debug] offer=${offer._id} near=${nearTokens.length} matched=${matched.length} radius=${baseRadiusM} eff=${effRadiusM}`
            );
          }
          if (!matched.length) continue;

          // 4) Spam-Schutz via OfferVisibility
          const vis = await OfferVisibility.find({
            offerId: offer._id,
            deviceToken: { $in: matched.map((t) => t._id) },
            $or: [{ status: 'notified' }, { status: 'dismissed' }, { status: 'snoozed', remindAt: { $gt: now } }],
          })
            .select('deviceToken status remindAt')
            .lean();

          const already = new Set(vis.map((v) => String(v.deviceToken)));
          const toNotifyDocs = matched.filter((t) => !already.has(String(t._id)));
          if (DEBUG) console.log(`[offerPoller][debug] offer=${offer._id} toNotify=${toNotifyDocs.length}`);
          if (!toNotifyDocs.length) continue;

          // 5) Push senden
          const tokens = toNotifyDocs
            .map((t) => t.token)
            .filter((tok) => typeof tok === 'string' && tok.trim().length > 0);

          if (!tokens.length) continue;

          const title = offer.name ?? 'Neues Angebot in deiner Nähe';
          const body = 'Tippe, um Details zu sehen.';
          const data = {
            type: 'offer',
            offerId: String(offer._id),
            route: `/offers/${offer._id}`,
            source: 'poller',
          };

          const diag = await sendPushAndCheckReceipts({
            tokens,
            title,
            body,
            data,
            channelId: PUSH_CHANNEL_ID,
            priority: PUSH_PRIORITY,
            sound: PUSH_SOUND,
            delayMs: 2500,
          });

          // Erfolgreich gesendete Tokens (Ticket-Position ~ Token-Position)
          const sentTokens = [];
          const tickets = Array.isArray(diag?.sent?.tickets) ? diag.sent.tickets : [];
          for (let i = 0; i < tickets.length; i++) {
            const t = tickets[i];
            if (t?.status === 'ok' && tokens[i]) {
              sentTokens.push(tokens[i]);
            }
          }

          // 6) OfferVisibility für erfolgreich gesendete Tokens auf notified setzen
          if (sentTokens.length) {
            const sentDocs = await PushToken.find({ token: { $in: sentTokens } }, { _id: 1, token: 1 }).lean();
            const byToken = new Map(sentDocs.map((d) => [d.token, d._id]));

            const nowIso = new Date();
            const bulk = [];
            for (const tok of sentTokens) {
              const deviceTokenId = byToken.get(tok);
              if (!deviceTokenId) continue;
              bulk.push({
                updateOne: {
                  filter: { offerId: offer._id, deviceToken: deviceTokenId },
                  update: {
                    $setOnInsert: { offerId: offer._id, deviceToken: deviceTokenId, firstSeenAt: nowIso },
                    $set: { status: 'notified', remindAt: null, lastNotifiedAt: nowIso, updatedAt: nowIso },
                  },
                  upsert: true,
                },
              });
            }
            if (bulk.length) await OfferVisibility.bulkWrite(bulk);
          }

          // Optional: lokale Deaktivierung (zusätzlich zu utils/push.js Fail-Safe)
          const disabledCount = Array.isArray(diag?.disabledTokens) ? diag.disabledTokens.length : 0;
          if (disabledCount > 0) {
            await PushToken.updateMany({ token: { $in: diag.disabledTokens } }, { $set: { disabled: true } });
          }

          // 🔎 Kompaktes Batch-Log inkl. Receipts-Übersicht
          const summary = diag?.receipts?.summary || {};
          console.log(
            `[offerPoller][batch] offer=${offer._id} tried=${tokens.length} sentOk=${sentTokens.length} ` +
              `disabled=${disabledCount} invalid=${(diag?.invalid || []).length} ` +
              `receipts=${JSON.stringify(summary)}`
          );
          if (diag?.retry && diag.retry.count > 0) {
            console.log(
              `[offerPoller][retry] attempts=${diag.retry.count} succeeded=${diag.retry.succeeded} ` +
                `targets=${JSON.stringify(diag.retry.targets || [])}`
            );
          }
        } catch (offerErr) {
          console.error('[offerPoller][offer] error:', offerErr?.message || offerErr);
          continue; // nächstes Offer
        }
      }

      if (DEBUG) {
        console.log(`[offerPoller][debug] took=${Date.now() - t0}ms`);
      }
    } catch (e) {
      console.error('[offerPoller] cycle error:', e?.message || e);
    }
  }

  // sofortiger erster Lauf + Intervall (jede Minute)
  doCycle();
  timer = setInterval(doCycle, INTERVAL_MS);
}

export function stopOfferPoller() {
  if (timer) {
    clearInterval(timer);
    timer = null;
    console.log('[offerPoller] stopped');
  }
}
