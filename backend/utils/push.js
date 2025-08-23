import { Expo } from 'expo-server-sdk';
import PushToken from '../models/PushToken.js';

const expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });

// ───────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────

function normalizeTokens(input) {
  // Accepts array of strings or array of objects
  // Returns array of { token, platform, disabled }
  const arr = Array.isArray(input) ? input : [];
  return arr
    .map((t) => {
      if (typeof t === 'string') {
        return { token: t, platform: 'android', disabled: false };
      }
      if (t && typeof t === 'object') {
        return {
          token: t.token,
          platform: t.platform ?? 'android',
          disabled: !!t.disabled,
        };
      }
      return null;
    })
    .filter(Boolean);
}

export async function filterValidActiveTokens(tokens) {
  const list = normalizeTokens(tokens);
  return list.filter(
    (t) =>
      typeof t.token === 'string' &&
      Expo.isExpoPushToken(t.token) &&
      !t.disabled &&
      (t.platform === 'android' || t.platform === 'ios')
  );
}

export async function sendOffersPushAsync(tokens, message) {
  const validTokens = await filterValidActiveTokens(tokens);
  if (validTokens.length === 0) {
    return { sent: 0, tickets: [], errors: [], disabledTokens: [] };
  }

  // Build Expo messages
  const {
    title,
    body,
    sound = 'default',
    channelId = 'offers',
    data = {},
    url, // optional; we attach into data if present
    categoryId = 'offers-actions',
    priority = 'high',
  } = message || {};

  const mergedData = url ? { ...data, url } : data;

  const messages = validTokens.map((t) => ({
    to: t.token,
    title,
    body,
    sound,
    priority,
    channelId,
    data: mergedData,
    categoryId, // for action buttons
  }));

  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];
  const errors = [];

  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (err) {
      // Catch transport-level errors (network, etc.)
      errors.push(err instanceof Error ? err.message : String(err));
      console.error('Push send error:', err);
    }
  }

  const sent = tickets.filter((t) => t?.status === 'ok').length;

  return { sent, tickets, errors, disabledTokens: [] };
}

export async function sendOffersPushSafe(tokens, message) {
  const result = await sendOffersPushAsync(tokens, message);

  // Disable tokens with DeviceNotRegistered
  const disabledTokens = [];
  for (const ticket of result.tickets) {
    if (ticket?.status === 'error' && ticket?.details?.error === 'DeviceNotRegistered') {
      const tokenValue = ticket?.to;
      if (tokenValue) {
        await PushToken.findOneAndUpdate(
          { token: tokenValue },
          { disabled: true },
          { new: true }
        ).exec();
        disabledTokens.push(tokenValue);
        console.log('❌ Token disabled:', tokenValue);
      }
    }
  }

  return { ...result, disabledTokens };
}
