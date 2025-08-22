import { Expo } from 'expo-server-sdk';
import PushToken from '../models/PushToken.js'; // ✅ FIX: war DeviceTokens.js
import OfferVisibility from '../models/OfferVisibility.js';

const expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });

// ───────────────────────────────────────────────
// Hilfsfunktionen
// ───────────────────────────────────────────────

export async function filterValidActiveTokens(tokens) {
  return tokens.filter(
    (t) =>
      Expo.isExpoPushToken(t.token) &&
      !t.disabled &&
      (t.platform === 'android' || t.platform === 'ios')
  );
}

export async function sendOffersPushAsync(tokens, message) {
  const validTokens = await filterValidActiveTokens(tokens);

  const messages = validTokens.map((t) => ({
    to: t.token,
    sound: 'default',
    body: message.body,
    data: message.data,
    priority: 'high',
    channelId: 'offers',
    categoryId: 'offers-actions', // für Notification-Buttons
  }));

  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];

  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (error) {
      console.error('Push send error:', error);
    }
  }

  return tickets;
}

export async function sendOffersPushSafe(tokens, message) {
  const tickets = await sendOffersPushAsync(tokens, message);

  // Prüfe auf ungültige Tokens und deaktiviere sie
  for (const ticket of tickets) {
    if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
      const tokenValue = ticket?.to;
      if (tokenValue) {
        await PushToken.findOneAndUpdate(
          { token: tokenValue },
          { disabled: true },
          { new: true }
        );
        console.log('❌ Token disabled:', tokenValue);
      }
    }
  }

  return tickets;
}
