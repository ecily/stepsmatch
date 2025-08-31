// stepsmatch/backend/utils/push.js
import { Expo } from 'expo-server-sdk';

const accessToken = process.env.EXPO_ACCESS_TOKEN || null;
const expo = accessToken ? new Expo({ accessToken }) : new Expo();

/**
 * Sendet Push an Expo-Gateway (chunking inklusive).
 * Ensured: channelId="offers", priority=high, sound=default.
 * @param {object} params
 * @param {string[]} params.tokens - Array Expo Push Tokens
 * @param {string} params.title
 * @param {string} params.body
 * @param {object} params.data
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
