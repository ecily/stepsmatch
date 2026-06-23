import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import Offer from '../models/Offer.js';
import Provider from '../models/Provider.js';
import {
  buildPushEligibleOfferMatch,
  buildVisibleOfferMatch,
  getOfferCooldownMs,
  isOfferMatchableForPush,
  isOfferMatchableInApp,
  isOfferPushEligible,
  isOfferVisibleInApp,
} from '../utils/offerPolicy.js';

const now = new Date('2026-07-06T08:00:00.000Z');

function matchableOffer(overrides = {}) {
  return {
    name: 'Policy test offer',
    publicVisibility: 'active_public_demo',
    pushEligibility: 'eligible_normal',
    suggestedPushPriority: 'normal',
    geoValidity: 'point_radius',
    radius: 250,
    validFrom: new Date('2026-07-01T00:00:00.000Z'),
    validTo: new Date('2026-09-30T00:00:00.000Z'),
    activeDays: ['Monday'],
    activeTimeWindows: [{ from: '09:00', to: '12:00' }],
    ...overrides,
  };
}

test('content outside runtime is not matched', () => {
  const offer = matchableOffer({ validTo: new Date('2026-07-01T00:00:00.000Z') });
  assert.equal(isOfferMatchableInApp(offer, { now, timeZone: 'Europe/Vienna', distanceMeters: 20 }), false);
});

test('content outside radius is not matched', () => {
  const offer = matchableOffer({ radius: 100 });
  assert.equal(isOfferMatchableInApp(offer, { now, timeZone: 'Europe/Vienna', distanceMeters: 101 }), false);
});

test('silent_admin_only is not publicly played out', () => {
  const offer = matchableOffer({ publicVisibility: 'silent_admin_only' });
  assert.equal(isOfferVisibleInApp(offer), false);
  assert.equal(isOfferMatchableInApp(offer, { now, timeZone: 'Europe/Vienna', distanceMeters: 20 }), false);
});

test('pushEligibility in_app_only never creates a push-eligible match', () => {
  const offer = matchableOffer({ pushEligibility: 'in_app_only' });
  assert.equal(isOfferMatchableInApp(offer, { now, timeZone: 'Europe/Vienna', distanceMeters: 20 }), true);
  assert.equal(isOfferPushEligible(offer), false);
  assert.equal(isOfferMatchableForPush(offer, { now, timeZone: 'Europe/Vienna', distanceMeters: 20 }), false);
});

test('missing policy fields stay visible for legacy feed compatibility but cannot push', () => {
  const offer = matchableOffer({
    publicVisibility: undefined,
    pushEligibility: undefined,
    suggestedPushPriority: undefined,
  });
  assert.equal(isOfferVisibleInApp(offer), true);
  assert.equal(isOfferPushEligible(offer), false);
  assert.equal(isOfferMatchableForPush(offer, { now, timeZone: 'Europe/Vienna', distanceMeters: 20 }), false);
});

test('route and area candidates are not matchable in v1 point-radius matching', () => {
  assert.equal(isOfferMatchableInApp(matchableOffer({ geoValidity: 'route_candidate' }), { now, timeZone: 'Europe/Vienna', distanceMeters: 20 }), false);
  assert.equal(isOfferMatchableInApp(matchableOffer({ geoValidity: 'area_candidate' }), { now, timeZone: 'Europe/Vienna', distanceMeters: 20 }), false);
});

test('cooldownSuggestionHours overrides global cooldown', () => {
  assert.equal(getOfferCooldownMs(matchableOffer({ cooldownSuggestionHours: 3 }), 120000), 10800000);
});

test('radiusMeters maps to Offer.radius and Provider.radiusMeters validates', () => {
  const providerId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();

  const offer = new Offer({
    provider: providerId,
    category: 'Essen & Trinken',
    name: 'Radius test',
    radiusMeters: 333,
    location: { type: 'Point', coordinates: [15.4, 47.1] },
  });
  assert.equal(offer.radius, 333);

  const provider = new Provider({
    name: 'Radius provider',
    category: 'Services & Lokales',
    address: 'Teststrasse 1',
    user: userId,
    radiusMeters: 777,
    location: { type: 'Point', coordinates: [15.4, 47.1] },
  });
  assert.equal(provider.validateSync(), undefined);
  assert.equal(provider.radiusMeters, 777);
});

test('query builders block review and require explicit push eligibility', () => {
  assert.deepEqual(buildVisibleOfferMatch().$and[0].$or[2].publicVisibility.$nin.includes('needs_review_before_import'), true);
  assert.deepEqual(buildPushEligibleOfferMatch().$and[0].publicVisibility, 'active_public_demo');
  assert.deepEqual(buildPushEligibleOfferMatch().$and[1].pushEligibility.$in.includes('eligible_normal'), true);
});
