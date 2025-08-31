// stepsmatch/mobile/utils/isOfferActiveNow.js

/**
 * Aktiv jetzt? – strikt im Kalender "Europe/Vienna".
 * Unterstützt:
 *  - validDays / weekdays: ["Montag","Di","Wednesday","Thu", 0..6]   (Mo=0 … So=6)
 *  - validTimes: { start: "HH:mm", end: "HH:mm" } inkl. Nachtfenster (22:00–02:00)
 *  - validDates:
 *      - { from, to }  (inklusive, lokale Kalendertage)
 *      - { date } oder { on }  (Einzeltag)
 *    Fallbacks am Root: offer.validOn / offer.date
 *
 * @param {object} offer
 * @param {string} timeZone  IANA TZ, default 'Europe/Vienna'
 * @param {Date}   now       Referenzzeit (optional)
 * @return {boolean}
 */
export function isOfferActiveNow(offer, timeZone = 'Europe/Vienna', now = new Date()) {
  if (!offer || typeof offer !== 'object') return false;

  // Weekday map → 0..6 (Mo..So)
  const WD = new Map([
    ['monday',0],['mon',0],['montag',0],['mo',0],'0',
    ['tuesday',1],['tue',1],['dienstag',1],['di',1],'1',
    ['wednesday',2],['wed',2],['mittwoch',2],['mi',2],'2',
    ['thursday',3],['thu',3],['donnerstag',3],['do',3],'3',
    ['friday',4],['fri',4],['freitag',4],['fr',4],'4',
    ['saturday',5],['sat',5],['samstag',5],['sa',5],'5',
    ['sunday',6],['sun',6],['sonntag',6],['so',6],'6',
  ].map((x,i,arr) => (Array.isArray(x) ? x : [x, i]))); // defensiv

  const getLocalNowParts = (d) => {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone, weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false
      }).formatToParts(d);
      const mp = Object.fromEntries(parts.map(p => [p.type, p.value]));
      const wdIdx = WD.get(String(mp.weekday || '').toLowerCase());
      const hh = Number(mp.hour ?? 0);
      const mm = Number(mp.minute ?? 0);
      const minutes = (Number.isFinite(hh) && Number.isFinite(mm)) ? (hh * 60 + mm) : 0;
      return { weekdayIdx: wdIdx, minutes };
    } catch {
      // Fallback ohne TZ (sollte eigentlich nie passieren auf RN)
      const hh = d.getHours?.() ?? 0;
      const mm = d.getMinutes?.() ?? 0;
      return { weekdayIdx: ((d.getDay?.() ?? 1) + 6) % 7, minutes: hh * 60 + mm }; // JS: 0=So → wir wollen 0=Mo
    }
  };

  const parseHHMM = (s) => {
    if (s == null) return null;
    const str = String(s).trim();
    const m = str.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const h = Number(m[1]);
    const mi = Number(m[2]);
    if (!Number.isFinite(h) || !Number.isFinite(mi)) return null;
    return (h>=0 && h<=23 && mi>=0 && mi<=59) ? h*60+mi : null;
  };

  const parseYMDString = (s) => {
    if (s == null) return null;
    const str = String(s).trim();
    const m = str.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
    if (!m) return null;
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    if (![y,mo,d].every(Number.isFinite)) return null;
    return { y, m: mo, d };
  };

  const getYMD = (x) => {
    if (!x) return null;
    if (typeof x === 'string') {
      const pure = parseYMDString(x);
      if (pure) return pure; // „YYYY-MM-DD“ → direkt als lokaler Kalendertag
    }
    const d = x instanceof Date ? x : new Date(x);
    if (isNaN(d.getTime())) return null;
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone, year:'numeric', month:'2-digit', day:'2-digit'
      }).formatToParts(d);
      const mp = Object.fromEntries(parts.map(p => [p.type, p.value]));
      return { y: Number(mp.year), m: Number(mp.month), d: Number(mp.day) };
    } catch {
      // Fallback ohne TZ (sollte nie nötig sein)
      return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
    }
  };

  const cmpYMD = (a, b) => (a.y-b.y) || (a.m-b.m) || (a.d-b.d);

  // 1) Wochentag (validDays ODER weekdays akzeptieren)
  const { weekdayIdx, minutes } = getLocalNowParts(now);
  const dayList = Array.isArray(offer.validDays) && offer.validDays.length
    ? offer.validDays
    : (Array.isArray(offer.weekdays) ? offer.weekdays : []);

  if (dayList.length > 0) {
    const allowed = dayList
      .map((x) => {
        if (typeof x === 'number') return x;
        const nx = Number(x);
        if (Number.isFinite(nx)) return nx;
        return WD.get(String(x).toLowerCase());
      })
      .filter((v) => v != null && v >= 0 && v <= 6);
    if (allowed.length > 0 && (weekdayIdx == null || !allowed.includes(weekdayIdx))) return false;
  }

  // 2) Uhrzeit inkl. Nachtfenster
  const vt = offer.validTimes || offer.times;
  if (vt && (vt.start || vt.end)) {
    const sMin = parseHHMM(vt.start ?? '00:00');
    const eMin = parseHHMM(vt.end   ?? '23:59');
    if (sMin != null && eMin != null && sMin !== eMin) {
      if (sMin < eMin) {
        if (!(minutes >= sMin && minutes <= eMin)) return false;
      } else {
        // über Mitternacht (z. B. 22:00–02:00)
        if (!(minutes >= sMin || minutes <= eMin)) return false;
      }
    }
  }

  // 3) Datumsfenster inkl. Einzeltag
  const vd = (offer.validDates && typeof offer.validDates === 'object') ? offer.validDates : {};
  const single = vd.date ?? vd.on ?? offer.validOn ?? offer.date;
  const fromRaw = vd.from ?? vd.start ?? (single ?? null);
  const toRaw   = vd.to   ?? vd.end   ?? (single ?? null);

  if (fromRaw || toRaw) {
    const nowYMD  = getYMD(now);
    const fromYMD = getYMD(fromRaw);
    const toYMD   = getYMD(toRaw);
    if (fromYMD && cmpYMD(nowYMD, fromYMD) < 0) return false;
    if (toYMD   && cmpYMD(nowYMD, toYMD)   > 0) return false;
  }

  return true;
}

/**
 * Hilfsfunktion, um testweise eine beliebige Zeit zu prüfen.
 * @param {object} offer
 * @param {Date} when
 * @param {string} timeZone
 */
export function isOfferActiveAt(offer, when, timeZone = 'Europe/Vienna') {
  return isOfferActiveNow(offer, timeZone, when instanceof Date ? when : new Date(when));
}

export default isOfferActiveNow;
