// stepsmatch/backend/utils/push.js
// ESM, Node 22.x
import { Expo } from 'expo-server-sdk';

const accessToken = process.env.EXPO_ACCESS_TOKEN || null;
const expo = accessToken ? new Expo({ accessToken }) : new Expo();

/**
 * Sendet Push an das Expo-Gateway (mit Chunking).
 * Erzwingt channelId = "offers", sound = "default", priority = "high".
 * @param {Object} params
 * @param {string[]} params.tokens  Array Expo Push Tokens
 * @param {string} params.title
 * @param {string} params.body
 * @param {Object} [params.data]
 * @returns {Promise<{sent:number, tickets:any[], errors:string[]}>}
 */
export async function sendPush({ tokens, title, body, data = {} }) {
  const valid = (tokens || []).filter((t) => Expo.isExpoPushToken(t));
  if (!valid.length) {
    return { sent: 0, tickets: [], errors: ['no-valid-tokens'] };
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

  return { sent: messages.length, tickets, errors };
}

/**
 * Kompatibler, "sicherer" Wrapper (wird von geoPush.js importiert).
 * Gleiche Signatur wie sendPush({tokens,title,body,data}).
 */
export async function sendOffersPushSafe(args) {
  try {
    return await sendPush(args);
  } catch (e) {
    console.error('[push] sendOffersPushSafe error', e);
    return { sent: 0, tickets: [], errors: [String(e)] };
  }
}

/**
 * Alias/Wrapper für offerPoller.js (erwartet pushToTokens aus utils/push.js).
 * Identische Semantik wie sendPush.
 * @param {{tokens:string[], title:string, body:string, data?:object}} args
 */
export async function pushToTokens(args) {
  return sendPush(args);
}

// Optionaler Default-Export (falls irgendwo default import genutzt wird)
export default { sendPush, sendOffersPushSafe, pushToTokens };
