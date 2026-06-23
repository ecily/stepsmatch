const DEMO_TYPES = new Set(['demo_provider', 'demo_content']);
const CANDIDATE_TYPES = new Set(['real_provider_candidate']);
const EDITORIAL_TYPES = new Set(['editorial_public_place']);
const DEMO_VISIBILITIES = new Set(['demo_public', 'public_demo', 'pre_alpha_public']);

function cleanText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function readPolicyValue(item, key) {
  return item?.[key] ?? item?.policy?.[key] ?? item?.metadata?.[key] ?? null;
}

function normalize(value) {
  return cleanText(value).toLowerCase();
}

export function getPitchBadges(item) {
  const contentType = normalize(readPolicyValue(item, 'contentType'));
  const visibility = normalize(readPolicyValue(item, 'publicVisibility'));
  const demoLabel = cleanText(readPolicyValue(item, 'demoLabel'));
  const badges = [];

  if (demoLabel) {
    badges.push(demoLabel);
  } else if (DEMO_TYPES.has(contentType) || DEMO_VISIBILITIES.has(visibility)) {
    badges.push('Pre-Alpha Demo');
  }

  if (EDITORIAL_TYPES.has(contentType)) {
    badges.push('Lokaler Hinweis');
  }

  if (CANDIDATE_TYPES.has(contentType)) {
    badges.push('Noch kein offizieller Partner');
  }

  return Array.from(new Set(badges)).slice(0, 2);
}

export function getPartnerDisclaimer(item) {
  const contentType = normalize(readPolicyValue(item, 'contentType'));
  if (CANDIDATE_TYPES.has(contentType)) {
    return 'Dieser Ort ist fuer den Pre-Alpha-Test vorgemerkt. Das ist kein offizieller Partnerclaim.';
  }
  if (DEMO_TYPES.has(contentType) || getPitchBadges(item).length > 0) {
    return 'Demo-/Pre-Alpha-Hinweis. Keine Preise, Rabatte oder Partnerzusage werden behauptet.';
  }
  if (EDITORIAL_TYPES.has(contentType)) {
    return 'Redaktioneller lokaler Hinweis ohne Anbieter- oder Partnerclaim.';
  }
  return '';
}

export function buildMatchReasonLines(item, options = {}) {
  const explicit = cleanText(readPolicyValue(item, 'matchReason'));
  const category = cleanText(item?.category);
  const distanceMeters = Number(options.distanceMeters);
  const isActiveNow = options.isActiveNow === true;
  const badges = getPitchBadges(item);
  const lines = [];

  if (explicit) {
    lines.push(explicit);
  }

  if (category) {
    lines.push(`Passt zu deinem Interesse ${category}.`);
  }

  if (Number.isFinite(distanceMeters)) {
    lines.push('In deiner Naehe.');
  }

  if (isActiveNow) {
    lines.push('Aktuell im gueltigen Zeitfenster.');
  }

  if (badges.length > 0) {
    lines.push('Demo-Hinweis fuer den Pre-Alpha-Test.');
  }

  return Array.from(new Set(lines)).slice(0, 4);
}
