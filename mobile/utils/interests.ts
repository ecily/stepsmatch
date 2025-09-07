// stepsmatch/mobile/utils/interests.ts

export const normalizeToken = (s: any): string =>
  String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\s+/g, ' ')
    .trim();

export function csvToSet(csv?: string | null): Set<string> {
  if (!csv) return new Set();
  return new Set(
    String(csv)
      .split(',')
      .map(normalizeToken)
      .filter(Boolean)
  );
}

/**
 * Prüft, ob ein Offer zu einer Interessenmenge passt.
 * Nutzt category, subcategory und name (teilweise Matches erlaubt).
 */
export function matchesInterests(
  offer: any,
  interestSet?: Set<string> | null
): boolean {
  if (!interestSet || interestSet.size === 0) return true;

  const cat = normalizeToken(offer?.category);
  const sub = normalizeToken(offer?.subcategory);
  const name = normalizeToken(offer?.name);

  for (const t of interestSet) {
    if (!t) continue;
    if (
      (cat && (cat === t || cat.includes(t))) ||
      (sub && (sub === t || sub.includes(t))) ||
      (name && name.includes(t))
    ) {
      return true;
    }
  }
  return false;
}
