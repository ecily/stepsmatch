// ESM, Node 22.x
import { Expo } from 'expo-server-sdk';
import PushToken from '../models/PushToken.js';

const accessToken = process.env.EXPO_ACCESS_TOKEN || null;
console.log('[push] EXPO_ACCESS_TOKEN present =', Boolean(accessToken)); // Health-Log

// Projekt-Scope zur Auswahl/Retry (muss zu Client passen)
const PROJECT_ID =
  process.env.EXPO_PROJECT_ID ||
  process.env.EXPO_PROJECT ||
  process.env.PROJECT_ID ||
  null;

// Tipp: setze EXPO_ACCESS_TOKEN in DO, damit Requests deinem Expo-Projekt sicher zugeordnet sind.
const expo = accessToken ? new Expo({ accessToken }) : new Expo();

/**
 * Sendet Push an das Expo-Gateway (mit Chunking).
 * Default: channelId="offers", sound="default", priority="high".
 * Gibt Tickets + Mapping id->token zurück.
 */
export async function sendPush({
  tokens,
  title,
  body,
  data = {},
  channelId = 'offers',
  sound = 'default',
  priority = 'high',
}) {
  const valid = (tokens || []).filter((t) => Expo.isExpoPushToken(t));
  if (!valid.length) {
    return { sent: 0, tickets: [], errors: ['no-valid-tokens'], okCount: 0, ticketIds: [], idToToken: {} };
  }

  const messages = valid.map((to) => ({
    to,
    title,
    body,
    data,
    channelId,
    sound,
    priority,
  }));

  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];
  const errors = [];
  const idToToken = {};

  for (const chunk of chunks) {
    try {
      const res = await expo.sendPushNotificationsAsync(chunk);
      // Map Ticket IDs -> Tokens (gleiche Reihenfolge)
      res.forEach((t, i) => {
        const token = chunk[i]?.to;
        if (t?.id && token) idToToken[t.id] = token;
      });
      tickets.push(...res);
    } catch (e) {
      errors.push(String(e));
    }
  }

  const okCount = tickets.filter((t) => t?.status === 'ok').length;
  const ticketIds = tickets.map((t) => t?.id).filter(Boolean);
  return { sent: messages.length, tickets, errors, okCount, ticketIds, idToToken };
}

/** Receipts abholen (+ kompakte Summary) */
export async function checkReceipts(ticketIds = []) {
  const chunks = expo.chunkPushNotificationReceiptIds(ticketIds);
  const receipts = [];
  const errors = [];

  for (const chunk of chunks) {
    try {
      const res = await expo.getPushNotificationReceiptsAsync(chunk);
      receipts.push(res); // { [id]: { status, message, details } }
    } catch (e) {
      errors.push(String(e));
    }
  }

  // flatten
  const flat = receipts.reduce((acc, obj) => Object.assign(acc, obj), {});
  const summary = { ok: 0, errors: {} }; // errors gruppiert nach Code

  for (const id of Object.keys(flat)) {
    const r = flat[id];
    if (!r) continue;
    if (r.status === 'ok') {
      summary.ok += 1;
    } else if (r.status === 'error') {
      const code = r.details?.error || r.message || 'unknown';
      summary.errors[code] = (summary.errors[code] || 0) + 1;
    }
  }
  return { receipts: flat, errors, summary };
}

async function safeDisableToken(token) {
  try {
    await PushToken.updateOne({ token }, { $set: { disabled: true } });
  } catch {}
}

/**
 * Komfort: sendet, verarbeitet Receipts und:
 *  - markiert DeviceNotRegistered-Token als disabled,
 *  - versucht EINEN Retry mit dem neuesten aktiven Token derselben deviceId (im selben projectId),
 *  - liefert Diagnosefelder (disabledTokens, invalid, retry-Summary) zurück.
 */
export async function sendPushAndCheckReceipts({
  tokens,
  title,
  body,
  data = {},
  channelId = 'offers',
  sound = 'default',
  priority = 'high',
  delayMs = 3500,
}) {
  const result = {
    sent: null,
    receipts: { receipts: {}, errors: [], summary: { ok: 0, errors: {} } },
    disabledTokens: [],
    invalid: [],
    retry: { count: 0, succeeded: 0, targets: [] },
  };

  // 1) Initial send
  const sent = await sendPush({ tokens, title, body, data, channelId, sound, priority });
  result.sent = sent;

  // 2) Receipts einsammeln
  if (sent.ticketIds?.length) {
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
    const receipts = await checkReceipts(sent.ticketIds);
    result.receipts = receipts;

    // 3) DeviceNotRegistered behandeln
    const retryCandidates = new Set(); // neue Tokens (strings) zum Retry
    for (const ticketId of Object.keys(receipts.receipts || {})) {
      const r = receipts.receipts[ticketId];
      if (!r) continue;

      // Fehler-Mapping
      if (r.status === 'error') {
        const code = r.details?.error || r.message || 'unknown';
        if (code === 'DeviceNotRegistered') {
          const badToken = sent.idToToken[ticketId];
          if (badToken) {
            await safeDisableToken(badToken);
            result.disabledTokens.push(badToken);

            // 🔁 Falls deviceId bekannt → neuesten gültigen Token für dasselbe Gerät finden (gleiches Projekt)
            try {
              const badDoc = await PushToken.findOne({ token: badToken }).select('deviceId projectId').lean();
              const devId = badDoc?.deviceId || null;
              const proj = badDoc?.projectId || null;

              if (devId) {
                const q = {
                  deviceId: devId,
                  disabled: { $ne: true },
                };
                // auf Projekt einschränken (muss mit Client übereinstimmen)
                const projFilter = PROJECT_ID || proj || null;
                if (projFilter) q.projectId = projFilter;

                // neuesten aktiven Token holen (lastSeenAt/updatedAt)
                const newest = await PushToken.findOne(q)
                  .sort({ lastSeenAt: -1, updatedAt: -1 })
                  .select('token')
                  .lean();

                const newestToken = newest?.token;
                if (newestToken && newestToken !== badToken) {
                  retryCandidates.add(newestToken);
                }
              }
            } catch {}
          }
        } else if (code === 'MessageTooBig' || code === 'MessageRateExceeded') {
          // bekannte Fehler, aber kein Token-Problem
        } else {
          // Unbekannt → zur Info
          const tok = sent.idToToken[ticketId];
          if (tok) result.invalid.push(tok);
        }
      }
    }

    // 4) Einmaliger Retry auf aggregierte Ziel-Tokens (falls vorhanden)
    const retryTokens = Array.from(retryCandidates);
    if (retryTokens.length) {
      result.retry.count = retryTokens.length;
      result.retry.targets = retryTokens;
      try {
        const retrySend = await sendPush({
          tokens: retryTokens,
          title,
          body,
          data,
          channelId,
          sound,
          priority,
        });

        // optional: kurze Receipt-Wartezeit
        if (retrySend.ticketIds?.length) {
          const retryReceipts = await checkReceipts(retrySend.ticketIds);
          // zähle ok
          const okAfterRetry = retryReceipts.summary?.ok || 0;
          result.retry.succeeded = okAfterRetry;
          // Mische (nur Summary, um Log kompakt zu halten)
          result.receipts.summary.ok += okAfterRetry;
          for (const [k, v] of Object.entries(retryReceipts.summary?.errors || {})) {
            result.receipts.summary.errors[k] = (result.receipts.summary.errors[k] || 0) + v;
          }
        }
      } catch (e) {
        // Retry-Fehler ignorieren, bleiben im Log sichtbar
      }
    }
  }

  return result;
}

// Kompatibilität / Aliase
export async function sendOffersPushSafe(args) {
  try {
    return await sendPush(args);
  } catch (e) {
    console.error('[push] sendOffersPushSafe error', e);
    return { sent: 0, tickets: [], errors: [String(e)], okCount: 0, ticketIds: [], idToToken: {} };
  }
}
export async function pushToTokens(args) {
  return sendPush(args);
}

export default { sendPush, sendOffersPushSafe, pushToTokens, checkReceipts, sendPushAndCheckReceipts };
