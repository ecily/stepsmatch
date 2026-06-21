function getTimeZoneOffsetMs(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
    hour: '2-digit',
  }).formatToParts(date);
  const value = parts.find((part) => part.type === 'timeZoneName')?.value || 'GMT';
  const match = /^GMT(?:(?<sign>[+-])(?<hours>\d{1,2})(?::(?<minutes>\d{2}))?)?$/.exec(value);
  if (!match) return 0;
  const sign = match.groups.sign === '-' ? -1 : 1;
  const hours = Number(match.groups.hours || 0);
  const minutes = Number(match.groups.minutes || 0);
  return sign * ((hours * 60 + minutes) * 60 * 1000);
}

function zonedLocalTimeToUtc({ year, month, day, hour = 0, minute = 0, second = 0, ms = 0 }, timeZone) {
  const asUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, second, ms));
  const offset = getTimeZoneOffsetMs(asUtc, timeZone);
  let adjusted = new Date(asUtc.getTime() - offset);
  const adjustedOffset = getTimeZoneOffsetMs(adjusted, timeZone);
  if (adjustedOffset !== offset) {
    adjusted = new Date(asUtc.getTime() - adjustedOffset);
  }
  return adjusted;
}

function getLocalYmd(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(byType.year),
    month: Number(byType.month),
    day: Number(byType.day),
  };
}

export function getActiveDatesPrefilterWindow(now = new Date(), timeZone = 'Europe/Vienna') {
  const today = getLocalYmd(now, timeZone);
  const startOfToday = zonedLocalTimeToUtc(today, timeZone);
  const startOfTomorrow = zonedLocalTimeToUtc({ ...today, day: today.day + 1 }, timeZone);
  return {
    startOfToday,
    endOfToday: new Date(startOfTomorrow.getTime() - 1),
  };
}

export function buildActiveDatesMatch(now = new Date(), timeZone = 'Europe/Vienna') {
  const { startOfToday, endOfToday } = getActiveDatesPrefilterWindow(now, timeZone);
  return {
    $and: [
      { $or: [{ 'validDates.from': { $exists: false } }, { 'validDates.from': { $lte: endOfToday } }] },
      { $or: [{ 'validDates.to': { $exists: false } }, { 'validDates.to': { $gte: startOfToday } }] },
    ],
  };
}
