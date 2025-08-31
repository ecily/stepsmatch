// backend/utils/push.js
// ESM, Node 22.x
import { Expo } from 'expo-server-sdk';

const accessToken = process.env.EXPO_ACCESS_TOKEN || null;
const expo = accessToken ? new Expo({ accessToken }) : new Expo();

/**
 * Sendet Push an das Expo-Gateway (mit Chunking).
 * Erzwingt channelId="offers", sound="default", priority="high".
 * Liefert okCount und ticketIds zurück.
 */
export async function sendPush({ tokens, title, body, data = {} }) {
  const valid = (tokens || []).filter((t) => Expo.isExpoPushToken(t));
  if (!valid.length) {
    return { sent: 0, tickets: [], errors: ['no-valid-tokens'], okCount: 0, ticketIds: [] };
  }

  const messages = valid.map((to) => ({
    to,
    title,
    body,
    data,
    channelId: 'offers',
    sound: 'default',
    priority: 'high',
  }));

  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];
  const errors = [];

  for (const chunk of chunks) {
    try {
      const res = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...res);
    } catch (e) {
      errors.push(String(e));
    }
  }

  const okCount = tickets.filter((t) => t?.status === 'ok').length;
  const ticketIds = tickets.map((t) => t?.id).filter(Boolean);
  return { sent: messages.length, tickets, errors, okCount, ticketIds };
}

/**
 * Holt nach kurzer Wartezeit die Receipts zu den Ticket-IDs ab
 * und aggregiert Fehlerursachen (z. B. DeviceNotRegistered).
 */
export async function checkReceipts(ticketIds = []) {
  const chunks = expo.chunkPushNotificationReceiptIds(ticketIds);
  const receipts = [];
  const errors = [];

  for (const chunk of chunks) {
    try {
      const res = await expo.getPushNotificationReceiptsAsync(chunk);
      receipts.push(res);
    } catch (e) {
      errors.push(String(e));
    }
  }

  // Flach zusammenführen
  const flat = receipts.reduce((acc, obj) => Object.assign(acc, obj), {});
  const summary = { ok: 0, errors: {} };
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
 * Bequemer Diagnose-Wrapper: sendet + prüft Receipts nach delayMs.
 */
export async function sendPushAndCheckReceipts({ tokens, title, body, data = {}, delayMs = 3500 }) {
  const sent = await sendPush({ tokens, title, body, data });
  let receipts = { receipts: {}, errors: [], summary: { ok: 0, errors: {} } };

  if (sent.ticketIds?.length) {
    // Kurze Wartezeit, bis Expo die Receipts bereitstellt
    await new Promise((r) => setTimeout(r, delayMs));
    receipts = await checkReceipts(sent.ticketIds);
  }
  return { sent, receipts };
}

// Kompatibilität / Aliase
export async function sendOffersPushSafe(args) {
  try {
    return await sendPush(args);
  } catch (e) {
    console.error('[push] sendOffersPushSafe error', e);
    return { sent: 0, tickets: [], errors: [String(e)], okCount: 0, ticketIds: [] };
  }
}
export async function pushToTokens(args) {
  return sendPush(args);
}

export default { sendPush, sendOffersPushSafe, pushToTokens, checkReceipts, sendPushAndCheckReceipts };
