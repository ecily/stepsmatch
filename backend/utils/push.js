// backend/utils/push.js
import { Expo } from 'expo-server-sdk';
import PushToken from '../models/PushToken.js';

/**
 * Zentrale Expo-Push Utility
 * - Nutzt projectId-Header (EXPO_PROJECT_ID) → verhindert DeviceNotRegistered bei frischen Tokens
 * - Sendet in Chunks, sammelt Tickets & Receipts
 * - Deaktiviert Tokens automatisch bei DeviceNotRegistered
 * - Stellt kompatible Alias-API `sendOffersPushSafe()` bereit
 */

/* ───────── Konfig aus ENV ───────── */

const PROJECT_ID =
  process.env.EXPO_PROJECT_ID ||
  process.env.EXPO_PROJECTID ||
  process.env.EXPO_PROJECT ||
  null;

const PUSH_CHANNEL_ID = process.env.PUSH_CHANNEL_ID || 'stepsmatch-default-v2';
const PUSH_CATEGORY_ID = process.env.PUSH_CATEGORY_ID || 'offer-go';
const DEFAULT_PRIORITY = process.env.PUSH_PRIORITY || 'high';
const DEFAULT_SOUND = process.env.PUSH_SOUND || 'default';
const DEFAULT_TTL = Number.isFinite(Number(process.env.PUSH_TTL)) ? Number(process.env.PUSH_TTL) : 300;

/* ───────── Expo Client ───────── */

const expo = new Expo(PROJECT_ID ? { projectId: PROJECT_ID } : {});

/* ───────── Helpers ───────── */

function asArray(x) {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

export function isExpoToken(str) {
  try {
    return Expo.isExpoPushToken(String(str || '').trim());
  } catch {
    return false;
  }
}

/**
 * pushToTokens(tokens, message)
 *  - tokens: string | string[] | Array<{token:string}>
 *  - message: { title, body, data?, sound?, priority?, ttl?, channelId?, categoryId? }
 * returns: { tickets, receipts, disabledTokens, invalid, projectId, channelId }
 */
export async function pushToTokens(tokens, message = {}) {
  // Eingabe normalisieren
  const tokenList = asArray(tokens)
    .map((t) => (t && typeof t === 'object' ? t.token : t))
    .map((t) => String(t || '').trim())
    .filter(Boolean);

  // Valid/Invalid splitten
  const valid = [];
  const invalid = [];
  for (const t of tokenList) {
    if (isExpoToken(t)) valid.push(t);
    else invalid.push(t);
  }

  if (!valid.length) {
    if (invalid.length) console.warn('[push] invalid tokens filtered:', invalid.length);
    return { tickets: [], receipts: {}, disabledTokens: [], invalid, projectId: PROJECT_ID || null, channelId: message.channelId || PUSH_CHANNEL_ID };
  }

  // Basis-Payload
  const baseMsg = {
    title: message.title || 'StepsMatch',
    body: message.body || '',
    data: message.data || {},
    sound: message.sound ?? DEFAULT_SOUND,
    priority: message.priority ?? DEFAULT_PRIORITY,
    ttl: typeof message.ttl === 'number' ? message.ttl : DEFAULT_TTL,
    channelId: message.channelId || PUSH_CHANNEL_ID,
    categoryId: message.categoryId || PUSH_CATEGORY_ID,
  };

  // Messages bauen
  const messages = valid.map((to) => ({ to, ...baseMsg }));

  // Senden (Chunked) + Ticket→Token-Mapping
  const tickets = [];
  const idToToken = {}; // receiptId -> token (per Reihenfolge im Chunk)

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      ticketChunk.forEach((t, i) => {
        const msg = chunk[i];
        if (t && t.id && msg && msg.to) idToToken[t.id] = msg.to;
      });
      tickets.push(...(Array.isArray(ticketChunk) ? ticketChunk : []));
    } catch (err) {
      console.error('[push] send error:', err?.message || err);
    }
  }

  // Receipts abholen
  const receipts = {};
  const disabledTokens = [];
  const receiptIds = tickets.map((t) => t?.id).filter(Boolean);

  if (receiptIds.length) {
    const rChunks = expo.chunkPushNotificationReceiptIds(receiptIds);
    for (const rc of rChunks) {
      try {
        const rec = await expo.getPushNotificationReceiptsAsync(rc);
        Object.assign(receipts, rec);

        for (const [id, info] of Object.entries(rec || {})) {
          if (!info) continue;
          if (info.status === 'error') {
            const err =
              info?.details?.error ||
              info?.details?.errorCode ||
              info?.message ||
              'unknown';

            // Token bei bestimmten Fehlern deaktivieren
            if (/DeviceNotRegistered|InvalidCredentials/i.test(String(err))) {
              const tok = idToToken[id];
              if (tok) {
                try {
                  await PushToken.updateOne(
                    { token: tok },
                    { $set: { disabled: true, disabledReason: String(err), disabledAt: new Date(), updatedAt: new Date() } }
                  );
                  disabledTokens.push(tok);
                } catch (e) {
                  console.warn('[push] disable DB update error:', e?.message || e);
                }
              }
            }
          }
        }
      } catch (err) {
        console.error('[push] receipts error:', err?.message || err);
      }
    }
  }

  if (disabledTokens.length) {
    console.log('[push] disabled tokens:', disabledTokens.length);
  }
  if (invalid.length) {
    console.warn('[push] invalid tokens filtered:', invalid.length);
  }

  return {
    tickets,
    receipts,
    disabledTokens,
    invalid,
    projectId: PROJECT_ID || null,
    channelId: baseMsg.channelId,
  };
}

/**
 * Kompatibilitäts-Alias für bestehende Aufrufer:
 * sendOffersPushSafe([{ token }], payload) -> nutzt pushToTokens(strings[], payload)
 * Rückgabe enthält zusätzlich `sent` (Anzahl Tickets mit status 'ok')
 */
export async function sendOffersPushSafe(tokensWithPlatform, payload = {}) {
  const tokens = asArray(tokensWithPlatform)
    .map((x) => (x && typeof x === 'object' ? x.token : x))
    .filter(Boolean);

  const res = await pushToTokens(tokens, payload);
  const sent = (res?.tickets || []).filter((t) => t?.status === 'ok').length;
  return { sent, ...res };
}

// Optionaler Default-Export (falls irgendwo `import push from '../utils/push.js'` verwendet wird)
export default pushToTokens;
