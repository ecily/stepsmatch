import { isOfferActiveNow } from './isOfferActiveNow.js';

export const BLOCKED_PUBLIC_VISIBILITIES = new Set([
  'silent_admin_only',
  'needs_review_before_import',
  'do_not_import_v1',
]);

export const PUSH_ALLOWED_ELIGIBILITIES = new Set([
  'eligible_normal',
  'push_allowed',
]);

export const PUSH_BLOCKED_ELIGIBILITIES = new Set([
  'in_app_only',
  'suppressed_for_pitch',
  'silent',
  'silent_admin_only',
]);

export const PUSH_BLOCKED_PRIORITIES = new Set([
  'high_attention',
  'silent/admin_only',
  'silent_admin_only',
]);

export const POLICY_FIELDS = [
  'contentType',
  'publicVisibility',
  'demoLabel',
  'pushEligibility',
  'suggestedPushPriority',
  'matchReason',
  'riskNote',
  'sourceUrl',
  'sourceVerifiedAt',
  'validFrom',
  'validTo',
  'activeDays',
  'activeTimeWindows',
  'geoValidity',
  'cooldownSuggestionHours',
];

export function buildVisibleOfferMatch() {
  return {
    $and: [
      {
        $or: [
          { publicVisibility: { $exists: false } },
          { publicVisibility: null },
          { publicVisibility: { $nin: Array.from(BLOCKED_PUBLIC_VISIBILITIES) } },
        ],
      },
      {
        $or: [
          { geoValidity: { $exists: false } },
          { geoValidity: null },
          { geoValidity: 'point_radius' },
        ],
      },
    ],
  };
}

export function buildPushEligibleOfferMatch() {
  return {
    $and: [
      { publicVisibility: 'active_public_demo' },
      { pushEligibility: { $in: Array.from(PUSH_ALLOWED_ELIGIBILITIES) } },
      {
        $or: [
          { suggestedPushPriority: { $exists: false } },
          { suggestedPushPriority: null },
          { suggestedPushPriority: { $nin: Array.from(PUSH_BLOCKED_PRIORITIES) } },
        ],
      },
      {
        $or: [
          { geoValidity: { $exists: false } },
          { geoValidity: null },
          { geoValidity: 'point_radius' },
        ],
      },
    ],
  };
}

export function isOfferVisibleInApp(offer) {
  if (!offer || typeof offer !== 'object') return false;
  return !BLOCKED_PUBLIC_VISIBILITIES.has(String(offer.publicVisibility || '').trim());
}

export function isOfferGeoMatchable(offer) {
  const geoValidity = String(offer?.geoValidity || 'point_radius').trim();
  return geoValidity === '' || geoValidity === 'point_radius';
}

export function getOfferRadiusMeters(offer, fallback = 0) {
  const radius = Number(offer?.radius ?? offer?.radiusMeters ?? fallback);
  return Number.isFinite(radius) ? radius : fallback;
}

export function isOfferWithinRadius(offer, distanceMeters) {
  if (distanceMeters == null) return true;
  const distance = Number(distanceMeters);
  if (!Number.isFinite(distance)) return false;
  const radius = getOfferRadiusMeters(offer, 0);
  return radius > 0 && distance <= radius;
}

export function isOfferPushEligible(offer) {
  if (!offer || typeof offer !== 'object') return false;
  if (String(offer.publicVisibility || '') !== 'active_public_demo') return false;

  const eligibility = String(offer.pushEligibility || '').trim();
  if (!eligibility || PUSH_BLOCKED_ELIGIBILITIES.has(eligibility)) return false;
  if (!PUSH_ALLOWED_ELIGIBILITIES.has(eligibility)) return false;

  const priority = String(offer.suggestedPushPriority || '').trim();
  if (PUSH_BLOCKED_PRIORITIES.has(priority)) return false;

  return true;
}

export function getOfferCooldownMs(offer, fallbackMs) {
  const hours = Number(offer?.cooldownSuggestionHours);
  if (Number.isFinite(hours) && hours > 0) {
    return Math.round(hours * 60 * 60 * 1000);
  }
  return fallbackMs;
}

export function isOfferMatchableInApp(offer, { now = new Date(), timeZone = 'Europe/Vienna', distanceMeters = null } = {}) {
  if (!isOfferVisibleInApp(offer)) return false;
  if (!isOfferGeoMatchable(offer)) return false;
  if (!isOfferActiveNow(offer, timeZone, now)) return false;
  if (!isOfferWithinRadius(offer, distanceMeters)) return false;
  return true;
}

export function isOfferMatchableForPush(offer, options = {}) {
  if (!isOfferMatchableInApp(offer, options)) return false;
  return isOfferPushEligible(offer);
}
