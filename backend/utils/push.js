// backend/utils/push.js
import { Expo } from 'expo-server-sdk';
import mongoose from 'mongoose';
import DeviceToken from '../models/DeviceTokens.js';

const expo = new Expo();

/**
 * Einfache Plausibilitätsprüfung, bevor Expo.isExpoPushToken(t) greift.
 */
function isLikelyExpoPushToken(t) {
  if (typeof t !== 'string') return false;
  const s = t.trim();
  if (!s) return false;
  // Expo-Token-Format: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
  return /^ExponentPushToken\[[A-Za-z0-9_\-]+\]$/.test(s);
}

/** /offers/<ObjectId> → <ObjectId> */
function extractOfferIdFromUrl(url) {
  if (typeof url !== 'string') return null;
  const m = url.match(/\/offers\/([a-f0-9]{24})/i);
  return m ? m[1] : null;
}

/**
 * Filter & Dedupe + deaktivierte Tokens aussortieren
 */
export async function filterValidActiveTokens(tokens = []) {
  const cleaned = tokens
    .filter((t) => typeof t === 'string')
    .map((t) => t.trim())
    .filter(Boolean);

  const deduped = Array.from(new Set(cleaned));

  const maybeValid = [];
  const invalid = [];
  for (const t of deduped) {
    if (isLikelyExpoPushToken(t) && Expo.isExpoPushToken(t)) maybeValid.push(t);
    else invalid.push(t);
  }

  if (maybeValid.length === 0) {
    return { valid: [], invalid, disabledFiltered: [] };
  }

  const dbRows = await DeviceToken.find(
    { token: { $in: maybeValid } },
    { token: 1, disabled: 1 },
  ).lean();

  const disabledSet = new Set(dbRows.filter((r) => r?.disabled === true).map((r) => r.token));

  const valid = [];
  const disabledFiltered = [];
  for (const t of maybeValid) {
    if (disabledSet.has(t)) disabledFiltered.push(t);
    else valid.push(t);
  }

  return { valid, invalid, disabledFiltered };
}

/**
 * Rückwärtskompatibel (tickets[]). Jetzt mit:
 *  - optionaler categoryId (Default 'offers-actions') → zeigt Buttons
 *  - auto data.enrichment (offerId aus url, falls erkennbar)
 */
export async function sendOffersPushAsync(
  tokens,
  {
    title,
    body,
    url,
    channelId = 'offers',
    sound = 'default',
    categoryId = 'offers-actions', // ← NEU: Buttons sichtbar machen
  }
) {
  if (!Array.isArray(tokens) || tokens.length === 0) return [];

  const { valid, invalid, disabledFiltered } = await filterValidActiveTokens(tokens);
  if (invalid.length) console.warn('[push] invalid tokens filtered:', invalid.length);
  if (disabledFiltered.length) console.info('[push] disabled tokens filtered (DB):', disabledFiltered.length);
  if (valid.length === 0) return [];

  const enrichedData = {};
  if (url) {
    enrichedData.url = url;
    const maybeId = extractOfferIdFromUrl(url);
    if (maybeId) enrichedData.offerId = maybeId;
  }

  const messages = valid.map((to) => ({
    to,
    sound,
    title,
    body,
    data: enrichedData,       // ← enthält url + ggf. offerId
    channelId,                // Android Notification Channel (App-seitig vorhanden)
    categoryId,               // ← NEU: verknüpft mit registrierter Kategorie (Buttons)
    priority: 'high',
  }));

  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];
  const receiptIds = [];

  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
      for (const t of ticketChunk) if (t?.id) receiptIds.push(t.id);
    } catch (err) {
      console.error('[push] sendPushNotificationsAsync error:', err?.message || err);
    }
  }

  if (receiptIds.length > 0) {
    try {
      const receiptChunks = expo.chunkPushNotificationReceiptIds(receiptIds);
      for (const rchunk of receiptChunks) {
        const receipts = await expo.getPushNotificationReceiptsAsync(rchunk);
        Object.entries(receipts || {}).forEach(([rid, info]) => {
          if (!info || info.status === 'ok') return;
          const errName = info?.details?.error || info?.message || 'unknown';
          console.warn('[push] receipt error:', rid, errName);
        });
      }
    } catch (err) {
      console.error('[push] getPushNotificationReceiptsAsync error:', err?.message || err);
    }
  }

  return tickets;
}

/**
 * Erweiterte Variante mit detaillierter Rückgabe & präziser Deaktivierung.
 * Jetzt ebenfalls mit categoryId + auto data.enrichment.
 */
export async function sendOffersPushSafe(
  tokens,
  {
    title,
    body,
    url,
    channelId = 'offers',
    sound = 'default',
    categoryId = 'offers-actions', // ← NEU
  }
) {
  const meta = {
    sent: 0,
    failed: 0,
    invalid: [],
    disabledFiltered: [],
    deactivated: [],
    tickets: [],
    receipts: {},
  };

  if (!Array.isArray(tokens) || tokens.length === 0) return meta;

  const { valid, invalid, disabledFiltered } = await filterValidActiveTokens(tokens);
  meta.invalid = invalid;
  meta.disabledFiltered = disabledFiltered;
  if (valid.length === 0) return meta;

  const enrichedData = {};
  if (url) {
    enrichedData.url = url;
    const maybeId = extractOfferIdFromUrl(url);
    if (maybeId) enrichedData.offerId = maybeId;
  }

  const messages = valid.map((to) => ({
    to,
    sound,
    title,
    body,
    data: enrichedData,
    channelId,
    categoryId,   // ← NEU: Buttons sichtbar
    priority: 'high',
  }));

  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];
  const ticketToToken = new Map();

  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      for (let i = 0; i < ticketChunk.length; i++) {
        const ticket = ticketChunk[i];
        tickets.push(ticket);
        const msg = chunk[i];
        if (ticket?.id && msg?.to) ticketToToken.set(ticket.id, msg.to);
        if (ticket?.status === 'ok') meta.sent += 1;
        else meta.failed += 1;
      }
    } catch (err) {
      console.error('[push:safe] send error:', err?.message || err);
      meta.failed += chunk.length;
    }
  }
  meta.tickets = tickets;

  const receiptIds = tickets.map((t) => t?.id).filter(Boolean);
  if (receiptIds.length > 0) {
    try {
      const receiptChunks = expo.chunkPushNotificationReceiptIds(receiptIds);
      for (const rchunk of receiptChunks) {
        const receipts = await expo.getPushNotificationReceiptsAsync(rchunk);
        Object.assign(meta.receipts, receipts);

        const toDisable = [];
        for (const [rid, info] of Object.entries(receipts || {})) {
          if (!info || info.status === 'ok') continue;
          const errName = info?.details?.error || info?.message || 'unknown';
          const token = ticketToToken.get(rid);
          if (!token) continue;

          if (errName === 'DeviceNotRegistered' || errName === 'InvalidCredentials') {
            toDisable.push(token);
          }
        }

        if (toDisable.length) {
          const unique = Array.from(new Set(toDisable));
          await DeviceToken.updateMany(
            { token: { $in: unique } },
            { $set: { disabled: true, updatedAt: new Date() } }
          ).exec();
          meta.deactivated.push(...unique);
          console.warn('[push:safe] tokens deactivated:', unique.length);
        }
      }
    } catch (err) {
      console.error('[push:safe] receipts error:', err?.message || err);
    }
  }

  return meta;
}

/*
Hinweise:
- Call-Sites müssen NICHT geändert werden. Wenn kein categoryId übergeben wird,
  verwenden wir automatisch 'offers-actions' → Buttons erscheinen.
- data enthält weiterhin 'url' und jetzt – falls ermittelbar – auch 'offerId'.
  Das hilft dem Client beim robusten Deeplink/Action-POST.
*/
