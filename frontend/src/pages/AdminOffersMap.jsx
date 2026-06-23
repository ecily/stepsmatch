import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  GoogleMap,
  MarkerF,
  InfoWindowF,
  CircleF,
  useLoadScript,
} from "@react-google-maps/api";

import axiosInstance from "../api/axios";
import AdminNav from "../components/AdminNav";
import {
  CONTENT_TYPE_OPTIONS,
  PUBLIC_VISIBILITY_OPTIONS,
  PUSH_ELIGIBILITY_OPTIONS,
  getContentTypeLabel,
  getPolicyBadgeClass,
  getPushEligibilityLabel,
  getPushPriorityLabel,
  getVisibilityLabel,
  isPushCapable,
} from "../utils/offerPolicy";

const mapContainerStyle = { width: "100%", height: "440px" };

const WEEKDAYS_EN = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const WEEKDAYS_EN_3 = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DATE_FMT_AT = new Intl.DateTimeFormat("de-AT", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const pad2 = (n) => String(n).padStart(2, "0");

const coordsToLatLng = (coordinates) => {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) return null;
  const [lngRaw, latRaw] = coordinates;
  const lng = Number(lngRaw);
  const lat = Number(latRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

const parseDateFlexible = (val) => {
  if (!val) return null;
  if (val instanceof Date && !Number.isNaN(val)) return val;
  if (typeof val === "number") {
    const d = new Date(val);
    return Number.isNaN(d) ? null : d;
  }
  if (typeof val === "string") {
    const m = val.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], 0, 0, 0, 0);
    const d = new Date(val);
    return Number.isNaN(d) ? null : d;
  }
  return null;
};

const parseTimeHM = (val, fb = { h: 23, m: 59, s: 0 }) => {
  if (typeof val !== "string") return fb;
  const m1 = val.match(/^(\d{1,2}):(\d{2})$/);
  if (m1) return { h: +m1[1], m: +m1[2], s: 0 };
  const m2 = val.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (m2) return { h: +m2[1], m: +m2[2], s: +m2[3] };
  return fb;
};

const makeLocalDateTime = (dateVal, timeVal) => {
  const d = parseDateFlexible(dateVal);
  if (!d) return null;
  const { h, m, s } = parseTimeHM(timeVal);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, s, 0);
};

const fmtDate = (val) => {
  const d = parseDateFlexible(val);
  return d ? DATE_FMT_AT.format(d) : "—";
};

const fmtTime = (val) => {
  if (!val) return "—";
  const { h, m } = parseTimeHM(val, { h: 0, m: 0, s: 0 });
  return `${pad2(h)}:${pad2(m)}`;
};

const computeRemainingDHMS = (offer) => {
  try {
    const toDate = offer?.validDates?.to;
    const endTime = offer?.validTimes?.end || "23:59";
    if (!toDate) return "—";
    const end = makeLocalDateTime(toDate, endTime);
    if (!end || Number.isNaN(end)) return "—";
    const now = new Date();
    if (now > end) return "abgelaufen";
    const diffMs = end - now;
    const days = Math.floor(diffMs / 86400000);
    const hours = Math.floor((diffMs % 86400000) / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    return `${days}:${pad2(hours)}:${pad2(minutes)}`;
  } catch {
    return "—";
  }
};

const isOfferActiveNow = (offer, now = new Date()) => {
  if (!offer) return false;

  const from = parseDateFlexible(offer?.validDates?.from);
  const to = parseDateFlexible(offer?.validDates?.to);

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (from) {
    const fromStart = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0, 0);
    if (todayEnd < fromStart) return false;
  }
  if (to) {
    const toEnd = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999);
    if (todayStart > toEnd) return false;
  }

  const validDays = Array.isArray(offer?.validDays) ? offer.validDays : [];
  if (validDays.length > 0) {
    const todayIdx = now.getDay();
    const todayName = WEEKDAYS_EN[todayIdx];
    const todayName3 = WEEKDAYS_EN_3[todayIdx];

    const hasDay = validDays.includes(todayIdx) || validDays.includes(todayName3) || validDays.includes(todayName);
    if (!hasDay) return false;
  }

  const { h: sh, m: sm, s: ss } = parseTimeHM(offer?.validTimes?.start, { h: 0, m: 0, s: 0 });
  const { h: eh, m: em, s: es } = parseTimeHM(offer?.validTimes?.end, { h: 23, m: 59, s: 59 });

  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), sh, sm, ss, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), eh, em, es, 999);

  return now >= start && now <= end;
};

export default function AdminOffersMap() {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [pushFilter, setPushFilter] = useState("all");
  const [contentTypeFilter, setContentTypeFilter] = useState("all");

  const mapRef = useRef(null);
  const [selectedOfferId, setSelectedOfferId] = useState(null);

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError("");

        const res = await axiosInstance.get("offers", {
          params: { withProvider: 1, limit: 200 },
        });

        if (!mounted) return;

        const payload = res?.data;
        const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];

        setOffers(rows);
      } catch (e) {
        console.error(e);
        setError("Fehler beim Laden der Angebote.");
        setOffers([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const filteredOffers = useMemo(() => {
    return offers.filter((offer) => {
      if (visibilityFilter !== "all" && offer?.publicVisibility !== visibilityFilter) return false;
      if (pushFilter !== "all" && offer?.pushEligibility !== pushFilter) return false;
      if (contentTypeFilter !== "all" && offer?.contentType !== contentTypeFilter) return false;
      return true;
    });
  }, [contentTypeFilter, offers, pushFilter, visibilityFilter]);

  const markers = useMemo(
    () =>
      filteredOffers
        .map((offer) => {
          const latLng = coordsToLatLng(offer?.location?.coordinates);
          if (!latLng) return null;
          return { offer, latLng };
        })
        .filter(Boolean),
    [filteredOffers]
  );

  const nowActiveCount = useMemo(() => filteredOffers.filter((o) => isOfferActiveNow(o)).length, [filteredOffers]);

  const expiringNext24h = useMemo(() => {
    const now = new Date();
    const until = new Date(now.getTime() + 24 * 3600 * 1000);
    return filteredOffers.filter((o) => {
      const to = parseDateFlexible(o?.validDates?.to);
      if (!to) return false;
      const end = makeLocalDateTime(to, o?.validTimes?.end || "23:59");
      return end && end > now && end <= until;
    }).length;
  }, [filteredOffers]);

  const categoriesCount = useMemo(() => {
    const set = new Set(filteredOffers.map((o) => o?.category).filter(Boolean));
    return set.size;
  }, [filteredOffers]);

  const policyCounts = useMemo(() => {
    return filteredOffers.reduce(
      (acc, offer) => {
        if (offer?.publicVisibility === "active_public_demo") acc.publicDemo += 1;
        if (offer?.publicVisibility === "in_app_only_demo" || offer?.publicVisibility === "silent_admin_only") acc.quiet += 1;
        if (isPushCapable(offer)) acc.pushCapable += 1;
        if (["needs_review_before_import", "do_not_import_v1"].includes(offer?.publicVisibility) || offer?.riskNote) acc.review += 1;
        return acc;
      },
      { publicDemo: 0, quiet: 0, pushCapable: 0, review: 0 }
    );
  }, [filteredOffers]);

  useEffect(() => {
    if (!isLoaded || !mapRef.current || markers.length === 0) return;
    const { google } = window;
    const bounds = new google.maps.LatLngBounds();

    markers.forEach(({ offer, latLng }) => {
      const r = Number(offer?.radiusMeters ?? offer?.radius) || 0;
      if (r > 0 && google?.maps?.Circle) {
        const circle = new google.maps.Circle({ center: latLng, radius: r });
        const cb = circle.getBounds();
        if (cb) bounds.union(cb);
        else bounds.extend(latLng);
      } else {
        bounds.extend(latLng);
      }
    });

    if (markers.length === 1) {
      mapRef.current.fitBounds(bounds);
      const listener = google.maps.event.addListenerOnce(mapRef.current, "bounds_changed", () => {
        const currentZoom = mapRef.current.getZoom();
        if (currentZoom > 17) mapRef.current.setZoom(17);
      });
      return () => google.maps.event.removeListener(listener);
    }

    mapRef.current.fitBounds(bounds);
  }, [isLoaded, markers]);

  const onMarkerClick = (id) => {
    setSelectedOfferId(id);
    const row = document.querySelector(`[data-offer-row="${id}"]`);
    if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const getProviderForOffer = (o) => (o && typeof o.provider === "object" ? o.provider : null);

  if (loadError) {
    return (
      <div className="sm-page">
        <div className="sm-stack sm-shell py-8">
          <p className="sm-error">Fehler beim Laden der Karte.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sm-page">
      <div className="sm-stack">
        <AdminNav />

        <div className="sm-shell py-8 sm:py-10">
          <div className="mx-auto w-full max-w-7xl space-y-5">
            <header className="sm-card-strong p-6 sm:p-8">
              <h1 className="text-3xl font-extrabold sm:text-4xl">Admin-Dashboard Vorschau · Angebote auf Karte</h1>
              <p className="mt-3 max-w-4xl text-blue-50 sm:text-lg">
                Aktive Angebotslage, Reichweitenradien, Laufzeiten und Pitch-Policy an einem Ort. Demo-Hinweise bleiben klar von Partnerclaims getrennt.
              </p>

              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="sm-kpi-card">
                  <p className="sm-kpi-label">Aktiv jetzt</p>
                  <p className="sm-kpi-value">{nowActiveCount}</p>
                </div>
                <div className="sm-kpi-card">
                  <p className="sm-kpi-label">Gesamt-Angebote</p>
                  <p className="sm-kpi-value">{filteredOffers.length}</p>
                </div>
                <div className="sm-kpi-card">
                  <p className="sm-kpi-label">Enden ≤ 24h</p>
                  <p className="sm-kpi-value">{expiringNext24h}</p>
                </div>
                <div className="sm-kpi-card">
                  <p className="sm-kpi-label">Kategorien</p>
                  <p className="sm-kpi-value">{categoriesCount}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="sm-kpi-card">
                  <p className="sm-kpi-label">Public Demo</p>
                  <p className="sm-kpi-value">{policyCounts.publicDemo}</p>
                </div>
                <div className="sm-kpi-card">
                  <p className="sm-kpi-label">In-App/Silent</p>
                  <p className="sm-kpi-value">{policyCounts.quiet}</p>
                </div>
                <div className="sm-kpi-card">
                  <p className="sm-kpi-label">Pushfaehig</p>
                  <p className="sm-kpi-value">{policyCounts.pushCapable}</p>
                </div>
                <div className="sm-kpi-card">
                  <p className="sm-kpi-label">Review/Risiko</p>
                  <p className="sm-kpi-value">{policyCounts.review}</p>
                </div>
              </div>
            </header>

            <section className="sm-card p-5">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="sm-label" htmlFor="admin-visibility-filter">Sichtbarkeit</label>
                  <select id="admin-visibility-filter" value={visibilityFilter} onChange={(e) => setVisibilityFilter(e.target.value)} className="sm-select">
                    <option value="all">Alle Sichtbarkeiten</option>
                    {PUBLIC_VISIBILITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="sm-label" htmlFor="admin-push-filter">Push-Eignung</label>
                  <select id="admin-push-filter" value={pushFilter} onChange={(e) => setPushFilter(e.target.value)} className="sm-select">
                    <option value="all">Alle Push-Regeln</option>
                    {PUSH_ELIGIBILITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="sm-label" htmlFor="admin-content-filter">Content-Typ</label>
                  <select id="admin-content-filter" value={contentTypeFilter} onChange={(e) => setContentTypeFilter(e.target.value)} className="sm-select">
                    <option value="all">Alle Content-Typen</option>
                    {CONTENT_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-600">
                Sichere Pitch-Pruefung: oeffentlich, In-App-only, Silent, Pushfaehigkeit, Quelle und Risiko sind sichtbar, ohne echte Daten zu importieren.
              </p>
            </section>

            <section className="sm-card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-4">
                <h2 className="text-lg font-bold">Map-Vorschau</h2>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-blue-600" /> Standort</span>
                  <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-blue-300 ring-4 ring-blue-200/60" /> Radius</span>
                </div>
              </div>

              {!isLoaded ? (
                <div className="p-5 text-slate-600">Karte wird geladen...</div>
              ) : (
                <GoogleMap
                  mapContainerStyle={mapContainerStyle}
                  onLoad={(map) => (mapRef.current = map)}
                  options={{
                    streetViewControl: false,
                    fullscreenControl: false,
                    mapTypeControl: true,
                    zoomControl: true,
                  }}
                >
                  {markers.map(({ offer, latLng }) => (
                    <MarkerF key={offer._id} position={latLng} onClick={() => onMarkerClick(offer._id)} />
                  ))}

                  {markers.map(({ offer, latLng }) => {
                    const r = Number(offer?.radiusMeters ?? offer?.radius) || 0;
                    if (r <= 0) return null;
                    return (
                      <CircleF
                        key={`${offer._id}-radius`}
                        center={latLng}
                        radius={r}
                        options={{
                          strokeColor: "#3b82f6",
                          strokeOpacity: 0.7,
                          strokeWeight: 1,
                          fillColor: "#3b82f6",
                          fillOpacity: 0.12,
                          clickable: false,
                          draggable: false,
                          editable: false,
                          zIndex: 1,
                        }}
                      />
                    );
                  })}

                  {selectedOfferId &&
                    (() => {
                      const sel = markers.find((m) => m.offer._id === selectedOfferId);
                      if (!sel) return null;
                      const provider = getProviderForOffer(sel.offer);
                      const remaining = computeRemainingDHMS(sel.offer);
                      const activeNow = isOfferActiveNow(sel.offer);
                      return (
                        <InfoWindowF position={sel.latLng} onCloseClick={() => setSelectedOfferId(null)}>
                          <div className="text-sm">
                            <div className="font-semibold">{sel.offer?.name || "Angebot"}</div>
                            <div className="text-slate-700">{provider?.name || "—"}</div>
                            <div className="text-slate-500">
                              {sel.offer?.category || "—"} / {sel.offer?.subcategory || "—"}
                            </div>
                            <div className="mt-2 grid gap-1 text-xs text-slate-600">
                              <div>
                                <b>Gültig:</b> {fmtDate(sel.offer?.validDates?.from)} {fmtTime(sel.offer?.validTimes?.start)} – {fmtDate(sel.offer?.validDates?.to)} {fmtTime(sel.offer?.validTimes?.end)}
                              </div>
                              <div>
                                <b>Status heute:</b> {activeNow ? "aktiv" : "inaktiv"}
                              </div>
                              <div>
                                <b>Restlaufzeit:</b> {remaining}
                              </div>
                              {Number(sel.offer?.radiusMeters ?? sel.offer?.radius) ? (
                                <div>
                                  <b>Radius:</b> {Number(sel.offer.radiusMeters ?? sel.offer.radius)} m
                                </div>
                              ) : null}
                              <div>
                                <b>Sichtbarkeit:</b> {getVisibilityLabel(sel.offer?.publicVisibility)}
                              </div>
                              <div>
                                <b>Push:</b> {getPushEligibilityLabel(sel.offer?.pushEligibility)} / {getPushPriorityLabel(sel.offer?.suggestedPushPriority)}
                              </div>
                              <div>
                                <b>Typ:</b> {getContentTypeLabel(sel.offer?.contentType)}
                              </div>
                              {sel.offer?.demoLabel ? <div>{sel.offer.demoLabel}</div> : null}
                              {sel.offer?.riskNote ? <div className="text-amber-700">{sel.offer.riskNote}</div> : null}
                              {sel.offer?.sourceUrl ? (
                                <div>
                                  <b>Quelle:</b> {sel.offer.sourceUrl}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </InfoWindowF>
                      );
                    })()}
                </GoogleMap>
              )}
            </section>

            {error && <p className="sm-error">{error}</p>}
            {loading && <p className="rounded-xl border border-slate-200 bg-white p-4 text-slate-600">Lade Daten...</p>}

            <section className="sm-table-wrap">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-4">
                <h2 className="text-lg font-bold">Angebote (Liste)</h2>
                <p className="text-xs text-slate-500">Zeile anklicken, um den Marker auf der Karte zu öffnen.</p>
              </div>

              <table className="sm-table">
                <thead>
                  <tr>
                    <th>Anbieter</th>
                    <th>Angebot</th>
                    <th>Kategorie</th>
                    <th>Subkategorie</th>
                    <th>Gültig von</th>
                    <th>Gültig bis</th>
                    <th>Radius</th>
                    <th>Sichtbarkeit</th>
                    <th>Push</th>
                    <th>Typ</th>
                    <th>Risiko</th>
                    <th>Noch gültig</th>
                    <th>Status heute</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOffers.map((o) => {
                    const provider = getProviderForOffer(o);
                    const remaining = computeRemainingDHMS(o);
                    const activeNow = isOfferActiveNow(o);
                    const radiusMeters = Number(o.radiusMeters ?? o.radius) || 0;

                    return (
                      <tr
                        key={o._id}
                        data-offer-row={o._id}
                        className={`cursor-pointer transition ${activeNow ? "bg-emerald-50/60 hover:bg-emerald-50" : "hover:bg-slate-50"}`}
                        onClick={() => onMarkerClick(o._id)}
                        title="Marker auf der Karte anzeigen"
                      >
                        <td>{provider?.name || "—"}</td>
                        <td>{o.name || "—"}</td>
                        <td>{o.category || "—"}</td>
                        <td>{o.subcategory || "—"}</td>
                        <td>
                          {fmtDate(o?.validDates?.from)} {fmtTime(o?.validTimes?.start)}
                        </td>
                        <td>
                          {fmtDate(o?.validDates?.to)} {fmtTime(o?.validTimes?.end)}
                        </td>
                        <td>{radiusMeters ? `${radiusMeters} m` : "—"}</td>
                        <td>
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${getPolicyBadgeClass("visibility", o.publicVisibility)}`}>
                            {getVisibilityLabel(o.publicVisibility)}
                          </span>
                        </td>
                        <td>
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${getPolicyBadgeClass("push", o.pushEligibility)}`}>
                            {getPushEligibilityLabel(o.pushEligibility)}
                          </span>
                        </td>
                        <td>{getContentTypeLabel(o.contentType)}</td>
                        <td>{o.riskNote ? "ja" : "—"}</td>
                        <td>{remaining}</td>
                        <td>
                          {activeNow ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> heute gültig
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-500" /> heute nicht gültig
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {filteredOffers.length === 0 && !loading && (
                    <tr>
                      <td colSpan={13} className="px-4 py-10 text-center text-slate-500">
                        Keine Angebote gefunden.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
