import siteTextDe from "./siteText.de";

const dictionary = {
  de: siteTextDe,
};

function normalizeLocale(locale) {
  if (!locale || typeof locale !== "string") return "de";
  const [lang] = locale.toLowerCase().split("-");
  return dictionary[lang] ? lang : "de";
}

export function getSiteText(locale) {
  const key = normalizeLocale(locale);
  return dictionary[key];
}

export function getPreferredSiteText() {
  if (typeof navigator === "undefined") return siteTextDe;
  return getSiteText(navigator.language);
}

