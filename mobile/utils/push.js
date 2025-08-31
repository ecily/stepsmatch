// backend/utils/push.js
import { Expo } from 'expo-server-sdk';
import PushToken from '../models/PushToken.js';

/**
 * Centralized Expo push client
 * - Uses projectId header (VERY IMPORTANT) so tokens from this project are valid
 * - Sends in chunks, collects tickets & receipts
 * - Auto-disables tokens on DeviceNotRegistered
 */

const PROJECT_ID =
  process.env.EXPO_PROJECT_ID ||
  process.env.EXPO_PROJECTID || // fallback naming
  process.env.EXPO_PROJECT ||   // last resort
  null;

// Create Expo client; attach projectId if available
const expo = new Expo(PROJECT_ID ? { projectId: PROJECT_ID } : {});

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
 * pushToTokens(tokens, { title, body, data, sound, priority, channelId })
 * - tokens: string|string[]
 * - returns: { tickets: [], receipts: {}, disabledTokens: [] }
 */
export async function pushToTokens(tokens, message = {}) {
  const tokenList = asArray(tokens)
    .map(t => String(t || '').trim())
    .filter(Boolean);

  // Filter only valid Expo tokens; log invalids
  const valid = [];
  const invalid = [];
  for (const t of tokenList) {
    if (isExpoToken(t)) valid.push(t);
    else invalid.push(t);
  }

  if (invalid.length) {
    console.warn('[push] invalid tokens filtered:', invalid.length);
  }
  if (!valid.length) {
    return { tickets: [], receipts: {}, disabledTokens: [], invalid };
  }

  // Default sound/channel for Android
  const baseMsg = {
    title: message.title || 'StepsMatch',
    body: message.body || '',
    data: message.data || {},
    sound: message.sound ?? 'default',
    channelId: message.channelId ?? 'stepsmatch-default-v2',
    priority: message.priority ?? 'default',
  };

  // Build messages
  const messages = valid.map(to => ({ to, ...baseMsg }));

  // Chunk & send
  const tickets = [];
  const chunks = expo.chunkPushNotifications(messages);

  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (err) {
      console.error('[push] send error:', err);
    }
  }

  // Collect receipt IDs
  const receiptIds = tickets
    .map(t => t?.id)
    .filter(Boolean);

  const receipts = {};
  const disabledTokens = [];

  if (receiptIds.length) {
    const receiptChunks = expo.chunkPushNotificationReceiptIds(receiptIds);
    for (const rc of receiptChunks) {
      try {
        const rec = await expo.getPushNotificationReceiptsAsync(rc);
        Object.assign(receipts, rec);

        // Inspect receipts → disable DeviceNotRegistered
        for (const [id, info] of Object.entries(rec || {})) {
          if (info?.status === 'error') {
            const err = info?.details?.error || info?.details?.errorCode || info?.message;
            if (err === 'DeviceNotRegistered') {
              // Map back ticket id -> token(s) in that chunk
              // We don't get direct token per receipt; we fallback to disabling tokens that were part of the send and had this ticket id.
              const idx = tickets.findIndex(t => t?.id === id);
              if (idx >= 0) {
                const tok = messages[idx]?.to;
                if (tok) {
                  disabledTokens.push(tok);
                }
              }
            }
          }
        }
      } catch (err) {
        console.error('[push] receipts error:', err);
      }
    }
  }

  // Persist disable in DB (best-effort)
  if (disabledTokens.length) {
    try {
      await PushToken.updateMany(
        { token: { $in: disabledTokens } },
        { $set: { disabled: true, updatedAt: new Date() } }
      );
      console.log('[push] disabled tokens:', disabledTokens.length);
    } catch (err) {
      console.error('[push] disable DB update error:', err);
    }
  }

  return { tickets, receipts, disabledTokens, invalid };
}

/**
 * Convenience: push to many tokens from DB query (e.g., by user or by area)
 * selector can be { disabled: false, platform: 'android', ... }
 */
export async function pushByQuery(selector, message = {}) {
  const docs = await PushToken.find(selector, { token: 1 }).lean();
  const tokens = docs.map(d => d.token).filter(Boolean);
  return pushToTokens(tokens, message);
}
