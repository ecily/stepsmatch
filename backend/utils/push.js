// backend/utils/push.js
import { Expo } from 'expo-server-sdk';

const expo = new Expo();

/**
 * sendOffersPushAsync
 * @param {string[]} tokens - Expo Push Tokens (ExponentPushToken[...])
 * @param {{ title:string, body:string, url?:string, channelId?:string, sound?:'default'|string }} payload
 * @returns {Promise<any[]>} Expo tickets
 */
export async function sendOffersPushAsync(tokens, { title, body, url, channelId = 'offers', sound = 'default' }) {
  if (!Array.isArray(tokens) || tokens.length === 0) return [];

  const messages = tokens
    .filter((t) => Expo.isExpoPushToken(t))
    .map((to) => ({
      to,
      sound,
      title,
      body,
      data: url ? { url } : {},
      channelId, // Android Notification Channel (muss in der App existieren)
      priority: 'high'
    }));

  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];
  for (const chunk of chunks) {
    const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
    tickets.push(...ticketChunk);
  }
  return tickets;
}

/**
 * Optionale Helper-Funktion: Tickets später gegen Receipts prüfen.
 * Kann später per Cron/Queue genutzt werden.
 */
export async function checkReceiptsAsync(receiptIds = []) {
  if (!receiptIds.length) return {};
  const chunks = expo.chunkPushNotificationReceiptIds(receiptIds);
  const results = {};
  for (const chunk of chunks) {
    const receipts = await expo.getPushNotificationReceiptsAsync(chunk);
    Object.assign(results, receipts);
  }
  return results;
}
