import assert from 'node:assert/strict';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import {
  normalizeInterestsInput,
  resolvePushTokenUserContext,
} from '../utils/pushTokenUserContext.js';

function userModelWith(users) {
  return {
    findById(id) {
      return {
        select() {
          return {
            async lean() {
              return users.get(String(id)) || null;
            },
          };
        },
      };
    },
  };
}

test('normalizes interest arrays and csv payloads', () => {
  assert.deepEqual(normalizeInterestsInput([' Cafe ', 'cafe', 'Essen & Trinken']), [
    'cafe',
    'essen & trinken',
  ]);
  assert.deepEqual(normalizeInterestsInput('Restaurant; Bar|Cafe'), ['restaurant', 'bar', 'cafe']);
  assert.equal(normalizeInterestsInput(undefined), null);
});

test('anonymous push token context keeps payload interests without userId', async () => {
  const ctx = await resolvePushTokenUserContext({
    bodyInterests: ['Restaurant'],
    UserModel: userModelWith(new Map()),
    jwtSecret: 'test-secret',
  });

  assert.equal(ctx.userId, null);
  assert.deepEqual(ctx.interests, ['restaurant']);
  assert.equal(ctx.source, 'anonymous');
});

test('body user context links token and uses backend user interests', async () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const users = new Map([[userId, { interests: ['Essen & Trinken', 'Services & Lokales'] }]]);

  const ctx = await resolvePushTokenUserContext({
    bodyUserId: userId,
    bodyInterests: ['stale-local-interest'],
    UserModel: userModelWith(users),
    jwtSecret: 'test-secret',
  });

  assert.equal(ctx.userId, userId);
  assert.deepEqual(ctx.interests, ['essen & trinken', 'services & lokales']);
  assert.equal(ctx.source, 'body-user');
});

test('bearer auth user overrides mismatched body user', async () => {
  const authUserId = new mongoose.Types.ObjectId().toString();
  const bodyUserId = new mongoose.Types.ObjectId().toString();
  const secret = 'test-secret';
  const token = jwt.sign({ userId: authUserId }, secret);
  const users = new Map([[authUserId, { interests: ['Freizeit & Bewegung'] }]]);

  const ctx = await resolvePushTokenUserContext({
    authorizationHeader: `Bearer ${token}`,
    bodyUserId,
    bodyInterests: ['Restaurant'],
    UserModel: userModelWith(users),
    jwtSecret: secret,
  });

  assert.equal(ctx.userId, authUserId);
  assert.deepEqual(ctx.interests, ['freizeit & bewegung']);
  assert.equal(ctx.source, 'auth-user');
});

test('missing user does not link stale ids and falls back to payload interests', async () => {
  const missingUserId = new mongoose.Types.ObjectId().toString();

  const ctx = await resolvePushTokenUserContext({
    bodyUserId: missingUserId,
    bodyInterests: ['Restaurant'],
    UserModel: userModelWith(new Map()),
    jwtSecret: 'test-secret',
  });

  assert.equal(ctx.userId, null);
  assert.deepEqual(ctx.interests, ['restaurant']);
  assert.equal(ctx.source, 'missing-user');
});
