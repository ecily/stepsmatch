import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

export function isValidObjectId(value) {
  try {
    return !!value && mongoose.Types.ObjectId.isValid(String(value));
  } catch {
    return false;
  }
}

export function normalizeInterestsInput(input) {
  if (input === undefined) return null;
  const src = Array.isArray(input) ? input : String(input || '').split(/[,\n;|]/);
  const out = src
    .map((s) =>
      String(s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter(Boolean);
  return Array.from(new Set(out));
}

function parseBearerUserId(authorizationHeader, jwtSecret) {
  const [scheme, token] = String(authorizationHeader || '').split(' ');
  if (scheme !== 'Bearer' || !token || !jwtSecret) return null;

  try {
    const decoded = jwt.verify(token, jwtSecret);
    const userId = decoded?.userId || decoded?.id || null;
    return isValidObjectId(userId) ? String(userId) : null;
  } catch {
    return null;
  }
}

export async function resolvePushTokenUserContext({
  authorizationHeader,
  bodyUserId,
  bodyInterests,
  jwtSecret = process.env.JWT_SECRET,
  UserModel,
} = {}) {
  const authUserId = parseBearerUserId(authorizationHeader, jwtSecret);
  const fallbackUserId = isValidObjectId(bodyUserId) ? String(bodyUserId) : null;
  const userId = authUserId || fallbackUserId || null;
  const payloadInterests = normalizeInterestsInput(bodyInterests);

  if (!userId || !UserModel) {
    return {
      userId,
      interests: payloadInterests,
      source: userId ? 'body-user' : 'anonymous',
    };
  }

  const user = await UserModel.findById(userId).select('interests').lean();
  if (!user) {
    return {
      userId: null,
      interests: payloadInterests,
      source: 'missing-user',
    };
  }

  return {
    userId,
    interests: Array.isArray(user.interests) ? normalizeInterestsInput(user.interests) : [],
    source: authUserId ? 'auth-user' : 'body-user',
  };
}
