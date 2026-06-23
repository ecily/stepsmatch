import assert from 'node:assert/strict';
import test from 'node:test';
import { buildActiveDatesMatch, getActiveDatesPrefilterWindow } from '../utils/activeDatesPrefilter.js';
import { isOfferActiveNow } from '../utils/isOfferActiveNow.js';

const TZ = 'Europe/Vienna';
const noonVienna = new Date('2026-06-21T10:00:00.000Z');

function offer(overrides = {}) {
  return {
    validDates: {
      from: new Date('2026-06-21T00:00:00.000Z'),
      to: new Date('2026-06-21T00:00:00.000Z'),
    },
    validDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    validTimes: { from: '00:00', to: '23:59' },
    ...overrides,
  };
}

function matchesActiveDatesPrefilter(candidate, match) {
  const from = candidate.validDates?.from;
  const to = candidate.validDates?.to;
  const [fromClause, toClause] = match.$and;
  const fromLimit = fromClause.$or[1]['validDates.from'].$lte;
  const toLimit = toClause.$or[1]['validDates.to'].$gte;
  return (!from || from <= fromLimit) && (!to || to >= toLimit);
}

test('date-only validDates.to today at midnight stays active throughout the valid day', () => {
  assert.equal(isOfferActiveNow(offer(), TZ, noonVienna), true);
});

test('validDates.to yesterday is inactive', () => {
  assert.equal(
    isOfferActiveNow(offer({ validDates: { from: new Date('2026-06-20T00:00:00.000Z'), to: new Date('2026-06-20T00:00:00.000Z') } }), TZ, noonVienna),
    false
  );
});

test('validTimes still restrict active offers', () => {
  assert.equal(isOfferActiveNow(offer({ validTimes: { from: '13:00', to: '14:00' } }), TZ, noonVienna), false);
});

test('activeTimeWindows alias restricts active offers', () => {
  assert.equal(isOfferActiveNow(offer({ validTimes: undefined, activeTimeWindows: [{ from: '13:00', to: '14:00' }] }), TZ, noonVienna), false);
});

test('validDays still restrict active offers', () => {
  assert.equal(isOfferActiveNow(offer({ validDays: ['Monday'] }), TZ, noonVienna), false);
});

test('activeDays alias restricts active offers', () => {
  assert.equal(isOfferActiveNow(offer({ validDays: undefined, activeDays: ['Monday'] }), TZ, noonVienna), false);
});

test('validFrom and validTo aliases restrict active offers', () => {
  assert.equal(
    isOfferActiveNow(
      offer({ validDates: {}, validFrom: new Date('2026-06-20T00:00:00.000Z'), validTo: new Date('2026-06-20T00:00:00.000Z') }),
      TZ,
      noonVienna
    ),
    false
  );
});

test('activeNow prefilter keeps date-only offers valid today', () => {
  const match = buildActiveDatesMatch(noonVienna, TZ);
  assert.equal(matchesActiveDatesPrefilter(offer(), match), true);
});

test('activeNow prefilter excludes offers that ended before today', () => {
  const match = buildActiveDatesMatch(noonVienna, TZ);
  assert.equal(
    matchesActiveDatesPrefilter(offer({ validDates: { from: new Date('2026-06-20T00:00:00.000Z'), to: new Date('2026-06-20T00:00:00.000Z') } }), match),
    false
  );
});

test('activeNow prefilter keeps offers without validDates', () => {
  const match = buildActiveDatesMatch(noonVienna, TZ);
  assert.equal(matchesActiveDatesPrefilter({ validTimes: { from: '00:00', to: '23:59' } }, match), true);
});

test('prefilter window uses the Europe/Vienna local day', () => {
  const { startOfToday, endOfToday } = getActiveDatesPrefilterWindow(noonVienna, TZ);
  assert.equal(startOfToday.toISOString(), '2026-06-20T22:00:00.000Z');
  assert.equal(endOfToday.toISOString(), '2026-06-21T21:59:59.999Z');
});
