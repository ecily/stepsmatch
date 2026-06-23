export const OFFER_POLICY_DEFAULTS = {
  contentType: "real_provider_candidate",
  publicVisibility: "in_app_only_demo",
  demoLabel: "Pre-Alpha-Hinweis - kein offizieller Partnerclaim.",
  pushEligibility: "in_app_only",
  suggestedPushPriority: "low_or_in_app",
  matchReason: "",
  riskNote: "Keine Preise, Rabatte, Oeffnungszeiten oder Partnerclaims ohne Freigabe.",
  sourceUrl: "",
  sourceVerifiedAt: "",
  geoValidity: "point_radius",
  cooldownSuggestionHours: 24,
};

export const CONTENT_TYPE_OPTIONS = [
  { value: "real_provider_candidate", label: "Anbieter-Kandidat" },
  { value: "editorial_public_place", label: "Redaktioneller Ort" },
  { value: "official_test_provider", label: "Freigegebener Testanbieter" },
  { value: "demo_provider", label: "Demo-Anbieter" },
  { value: "real_demo_location", label: "Realer Demo-Ort" },
  { value: "legacy_offer", label: "Legacy-Angebot" },
];

export const PUBLIC_VISIBILITY_OPTIONS = [
  { value: "in_app_only_demo", label: "Nur In-App Demo" },
  { value: "active_public_demo", label: "Oeffentliche Demo" },
  { value: "silent_admin_only", label: "Silent/Admin only" },
  { value: "needs_review_before_import", label: "Review noetig" },
  { value: "do_not_import_v1", label: "Nicht importieren" },
];

export const PUSH_ELIGIBILITY_OPTIONS = [
  { value: "in_app_only", label: "Nur In-App" },
  { value: "eligible_normal", label: "Normal pushfaehig" },
  { value: "push_allowed", label: "Push erlaubt" },
  { value: "suppressed_for_pitch", label: "Fuer Pitch unterdrueckt" },
  { value: "silent", label: "Silent" },
  { value: "silent_admin_only", label: "Silent/Admin only" },
];

export const PUSH_PRIORITY_OPTIONS = [
  { value: "low_or_in_app", label: "Leise / In-App" },
  { value: "normal", label: "Normal" },
  { value: "silent_admin_only", label: "Silent/Admin only" },
  { value: "silent/admin_only", label: "Silent/Admin legacy" },
  { value: "high_attention", label: "High Attention (nur Ausnahme)" },
];

export const GEO_VALIDITY_OPTIONS = [
  { value: "point_radius", label: "Punkt + Radius" },
  { value: "area_candidate", label: "Flaeche/Kandidat" },
  { value: "route_candidate", label: "Route/Kandidat" },
];

const labelFrom = (options, value) => {
  const found = options.find((option) => option.value === value);
  return found?.label || value || "-";
};

export const getContentTypeLabel = (value) => labelFrom(CONTENT_TYPE_OPTIONS, value);
export const getVisibilityLabel = (value) => labelFrom(PUBLIC_VISIBILITY_OPTIONS, value);
export const getPushEligibilityLabel = (value) => labelFrom(PUSH_ELIGIBILITY_OPTIONS, value);
export const getPushPriorityLabel = (value) => labelFrom(PUSH_PRIORITY_OPTIONS, value);
export const getGeoValidityLabel = (value) => labelFrom(GEO_VALIDITY_OPTIONS, value);

export const getPolicyBadgeClass = (kind, value) => {
  if (kind === "visibility") {
    if (value === "active_public_demo") return "border-emerald-200 bg-emerald-50 text-emerald-800";
    if (value === "in_app_only_demo") return "border-blue-200 bg-blue-50 text-blue-800";
    if (value === "silent_admin_only") return "border-slate-200 bg-slate-100 text-slate-700";
    return "border-amber-200 bg-amber-50 text-amber-900";
  }

  if (kind === "push") {
    if (value === "eligible_normal" || value === "push_allowed") return "border-emerald-200 bg-emerald-50 text-emerald-800";
    if (value === "in_app_only") return "border-blue-200 bg-blue-50 text-blue-800";
    return "border-slate-200 bg-slate-100 text-slate-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
};

export const isPushCapable = (offer) => ["eligible_normal", "push_allowed"].includes(offer?.pushEligibility);

export const normalizeActiveTimeWindows = (validTimes = {}) => {
  const from = validTimes?.start || validTimes?.from || "";
  const to = validTimes?.end || validTimes?.to || "";
  return from || to ? [{ from, to }] : [];
};
