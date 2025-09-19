// stepsmatch/mobile/components/push/push-constants.ts
import Constants from 'expo-constants';

/** ───── Backend Base URL ───── */
export const API_BASE = 'https://lobster-app-ie9a5.ondigitalocean.app/api';
// HTTP-Schutzwerte für Fetches (kannst du später zentral nutzen)
export const HTTP_TIMEOUT_MS = 6000;
export const HTTP_RETRY_ATTEMPTS = 3;

/** ───── Tasks (IDs müssen stabil sein) ───── */
export const BG_LOCATION_TASK   = 'stepsmatch-bg-location-task';
export const GEOFENCE_TASK      = 'stepsmatch-geofence-task';

/** ───── Notification Channels & Categories ─────
 * Achtung: Diese IDs müssen 1:1 mit deinen bestehenden Android-Channel IDs matchen.
 * Aus deinem Setup:
 *  - offers-v2
 *  - stepsmatch-default-v2
 *  - com.ecily.mobile:stepsmatch-bg-location-task
 */
export const CHANNELS = {
  default: 'stepsmatch-default-v2',
  offers: 'offers-v2',
  offersLegacy: 'offers-legacy', // optionaler Legacy-Kanal; kann bleiben
  bg: 'com.ecily.mobile:stepsmatch-bg-location-task',
} as const;

export const CATEGORIES = {
  // Du nutzt "offer-go-v2" mit Actions "go" / "later"
  offerGo: 'offer-go-v2',
} as const;

/** ───── Branding / UI ───── */
export const BRAND_BLUE = '#0d4ea6';

/** ───── Zeit-/Watchdog-Parameter ───── */
export const WD_TICK_MS = 20_000;
export const LOC_STALE_MS = 120_000;
export const GF_STALE_MS  = 180_000;

/** ───── Standort / Accuracy ───── */
export const FRESH_FIX_TIMEOUT_MS = 4_000;
export const ACCURACY_TOKEN_CAP_M = 60;
export const ENTER_SANITY_BUFFER_M = 5;
export const OUTSIDE_TOLERANCE_M = 5;

/** ───── Geofence Sync/Radius (nur wenn gebraucht) ───── */
export const MAX_GEOFENCES = 20;
export const GEOFENCE_SYNC_INTERVAL_MS = 60_000;
export const DEFAULT_RADIUS_M = 120;

/** ───── Dedupe/Throttle ───── */
export const EVENT_DEDUP_WINDOW_MS = 5_000;
export const MIN_MS_BETWEEN_PUSH_SAME_OFFER = 2 * 60_000;
export const MIN_MS_BETWEEN_PUSH_GLOBAL     = 20_000;

/** ───── Grouping/Anti-Spam (nur falls benötigt) ───── */
export const GROUP_COOLDOWN_MS = 2 * 60_000;
export const SUMMARY_WINDOW_MS = 60_000;

/** ───── Expo Project ID (stabil aus deinem Status) ───── */
export const RESOLVED_PROJECT_ID =
  (Constants?.expoConfig?.extra && (Constants as any).expoConfig.extra.eas?.projectId) ||
  ((Constants as any)?.easConfig && (Constants as any).easConfig.projectId) ||
  '08559a29-b307-47e9-a130-d3b31f73b4ed';
