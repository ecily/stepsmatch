// backend/utils/push.js
// ESM, Node 22.x
import { Expo } from 'expo-server-sdk';
import PushToken from '../models/PushToken.js';

const accessToken = process.env.EXPO_ACCESS_TOKEN || null;
console.log('[push] EXPO_ACCESS_TOKEN present =', Boolean(accessToken)); // Health-Log

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

/**
 * Komfort: sendet und deaktiviert Tokens mit DeviceNotRegistered.
 * Alle Optionen werden durchgereicht (channelId/sound/priority).
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
  const sent = await sendPush({ tokens, title, body, data, channelId, sound, priority });

  let receipts = { receipts: {}, errors: [], summary: { ok: 0, errors: {} } };
  if (sent.ticketIds?.length) {
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
    receipts = await checkReceipts(sent.ticketIds);

    // 👉 Token-Hygiene: DeviceNotRegistered → disabled=true
    for (const ticketId of Object.keys(receipts.receipts || {})) {
      const r = receipts.receipts[ticketId];
      if (r?.status === 'error' && (r.details?.error === 'DeviceNotRegistered' || r.message === 'DeviceNotRegistered')) {
        const token = sent.idToToken[ticketId];
        if (token) {
          await PushToken.updateOne({ token }, { $set: { disabled: true } });
          console.log('[push] disabled token due to DeviceNotRegistered:', token);
        }
      }
    }
  }

  return { sent, receipts };
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
