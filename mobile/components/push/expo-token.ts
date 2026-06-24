import { resolveExpoTokenAuthoritative } from './push-state';

export async function getScopedExpoPushTokenAsync(): Promise<string> {
  const token = await resolveExpoTokenAuthoritative();
  if (!token) throw new Error('Expo push token unavailable');
  return token;
}
