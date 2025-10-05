// frontend/src/pages/AdminOffersMap.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import axiosInstance from "../api/axios";
import {
  GoogleMap,
  MarkerF,
  InfoWindowF,
  CircleF,
  useLoadScript,
} from "@react-google-maps/api";
import AdminNav from "../components/AdminNav";

/* ───────────────── Map Container ───────────────── */
const mapContainerStyle = { width: "100%", height: "420px" };

/* ───────────────── Constants ───────────────── */
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

/* ───────────────── Helpers ───────────────── */
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
  if (val instanceof Date && !isNaN(val)) return val;
  if (typeof val === "number") {
    const d = new Date(val);
    return isNaN(d) ? null : d;
  }
  if (typeof val === "string") {
    const m = val.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], 0, 0, 0, 0);
    const d = new Date(val);
    return isNaN(d) ? null : d;
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
    if (!end || isNaN(end)) return "—";
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

/** Prüft, ob das Angebot JETZT aktiv ist (Datum, Wochentag, Tageszeit). */
const isOfferActiveNow = (offer, now = new Date()) => {
  if (!offer) return false;

  // 1) Datumsspanne
  const from = parseDateFlexible(offer?.validDates?.from);
  const to = parseDateFlexible(offer?.validDates?.to);

  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0
  );
  const todayEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999
  );

  if (from) {
    const fromStart = new Date(
      from.getFullYear(),
      from.getMonth(),
      from.getDate(),
      0,
      0,
      0,
      0
    );
    if (todayEnd < fromStart) return false; // noch zu früh
  }
  if (to) {
    const toEnd = new Date(
      to.getFullYear(),
      to.getMonth(),
      to.getDate(),
      23,
      59,
      59,
      999
    );
    if (todayStart > toEnd) return false; // bereits vorbei
  }

  // 2) Wochentag
  const validDays = Array.isArray(offer?.validDays) ? offer.validDays : [];
  if (validDays.length > 0) {
    const todayIdx = now.getDay(); // 0..6
    const todayName = WEEKDAYS_EN[todayIdx];
    const todayName3 = WEEKDAYS_EN_3[todayIdx];

    const hasDay =
      validDays.includes(todayIdx) ||
      validDays.includes(todayName3) ||
      validDays.includes(todayName);

    if (!hasDay) return false;
  }

  // 3) Tageszeitfenster
  const { h: sh, m: sm, s: ss } = parseTimeHM(offer?.validTimes?.start, {
    h: 0,
    m: 0,
    s: 0,
  });
  const { h: eh, m: em, s: es } = parseTimeHM(offer?.validTimes?.end, {
    h: 23,
    m: 59,
    s: 59,
  });

  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    sh,
    sm,
    ss,
    0
  );
  const end = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    eh,
    em,
    es,
    999
  );

  return now >= start && now <= end;
};

/* ───────────────── Page ───────────────── */
export default function AdminOffersMap() {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

        // Offers inkl. embedded provider laden
        const res = await axiosInstance.get("offers", {
          params: { withProvider: 1, limit: 200 },
        });

        if (!mounted) return;

        const payload = res?.data;
        const rows = Array.isArray(payload?.data)
          ? payload.data // paginiert
          : Array.isArray(payload)
          ? payload // Fallback: rohes Array
          : [];

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

  /* ───────── Derived UI data ───────── */
  const markers = useMemo(() => {
    return offers
      .map((offer) => {
        const latLng = coordsToLatLng(offer?.location?.coordinates);
        if (!latLng) return null;
        return { offer, latLng };
      })
      .filter(Boolean);
  }, [offers]);

  const nowActiveCount = useMemo(
    () => offers.filter((o) => isOfferActiveNow(o)).length,
    [offers]
  );

  const expiringNext24h = useMemo(() => {
    const now = new Date();
    const until = new Date(now.getTime() + 24 * 3600 * 1000);
    return offers.filter((o) => {
      const to = parseDateFlexible(o?.validDates?.to);
      if (!to) return false;
      const end = makeLocalDateTime(to, o?.validTimes?.end || "23:59");
      return end && end > now && end <= until;
    }).length;
  }, [offers]);

  const categoriesCount = useMemo(() => {
    const set = new Set(offers.map((o) => o?.category).filter(Boolean));
    return set.size;
  }, [offers]);

  // Fit-Bounds inkl. Radius
  useEffect(() => {
    if (!isLoaded || !mapRef.current || markers.length === 0) return;
    const { google } = window;
    const bounds = new google.maps.LatLngBounds();

    markers.forEach(({ offer, latLng }) => {
      const r = Number(offer?.radius) || 0; // Meter
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
      const listener = google.maps.event.addListenerOnce(
        mapRef.current,
        "bounds_changed",
        () => {
          const currentZoom = mapRef.current.getZoom();
          if (currentZoom > 17) mapRef.current.setZoom(17);
        }
      );
      return () => google.maps.event.removeListener(listener);
    } else {
      mapRef.current.fitBounds(bounds);
    }
  }, [isLoaded, markers]);

  const onMarkerClick = (id) => {
    setSelectedOfferId(id);
    const row = document.querySelector(`[data-offer-row="${id}"]`);
    if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const getProviderForOffer = (o) =>
    o && typeof o.provider === "object" ? o.provider : null;

  if (loadError)
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          Fehler beim Laden der Karte.
        </div>
      </div>
    );

  /* ───────── Render ───────── */
  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Intro / Marketing */}
      <header className="relative overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 md:p-8">
        <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-blue-200/30 blur-3xl" />
        <div className="relative">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-blue-900">
            Admin-Demo · Angebote auf der Karte
          </h1>
          <p className="mt-2 text-gray-700 max-w-3xl">
            Diese Seite ist eine <b>Vorschau</b> auf das kommende{" "}
            <b>professionelle Dashboard</b> von StepsMatch. Im Endausbau sehen
            Administrator:innen hier <b>alle relevanten Informationen</b> an
            einem Ort – inklusive <b>Stammdatenwartung</b> (Anbieter,
            Kategorien, Kampagnen), <b>MongoDB-Verwaltung</b> (Sammlungen,
            Index-Health) und klaren <b>KPI-Übersichten</b>. Beispiele:
            <span className="whitespace-nowrap"> Push-Reichweite heute</span>,
            <span className="whitespace-nowrap"> Enter→Push P95-Latenz</span>,
            Conversion je Kategorie u. v. m.
          </p>

          {/* Preview Notice */}
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-800 ring-1 ring-blue-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Vorschau-Modus: Karte + Liste – alle Links/Funktionen bereits aktiv.
          </div>

          {/* KPI Mini Cards (client-seitig berechnet, keine neuen Calls) */}
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-500">Aktiv (jetzt)</p>
              <p className="text-2xl font-bold text-blue-700">{nowActiveCount}</p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-500">Gesamt-Angebote</p>
              <p className="text-2xl font-bold text-blue-700">{offers.length}</p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-500">Enden ≤ 24 h</p>
              <p className="text-2xl font-bold text-blue-700">
                {expiringNext24h}
              </p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-500">Kategorien</p>
              <p className="text-2xl font-bold text-blue-700">
                {categoriesCount}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Admin-Menü */}
      <div className="mb-6 mt-6 -mx-6 md:mx-0">
        <AdminNav />
      </div>

      {/* Karte */}
      <div className="bg-white rounded-2xl shadow border border-gray-100 mb-6">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold">Map-Vorschau</h2>
          <div className="flex items-center gap-4 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-600/80 inline-block" />
              Standort des Angebots
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-300 inline-block ring-[3px] ring-blue-300/40" />
              Radius (Reichweite)
            </div>
          </div>
        </div>

        {!isLoaded ? (
          <div className="p-6 text-gray-600">Karte wird geladen…</div>
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
            {/* Marker */}
            {markers.map(({ offer, latLng }) => (
              <MarkerF
                key={offer._id}
                position={latLng}
                onClick={() => onMarkerClick(offer._id)}
              />
            ))}

            {/* Radius-Kreise */}
            {markers.map(({ offer, latLng }) => {
              const r = Number(offer?.radius) || 0; // Meter
              if (r <= 0) return null;
              return (
                <CircleF
                  key={`${offer._id}-radius`}
                  center={latLng}
                  radius={r}
                  options={{
                    strokeColor: "#3b82f6", // blue-500
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

            {/* InfoWindow */}
            {selectedOfferId &&
              (() => {
                const sel = markers.find((m) => m.offer._id === selectedOfferId);
                if (!sel) return null;
                const provider = getProviderForOffer(sel.offer);
                const remaining = computeRemainingDHMS(sel.offer);
                const activeNow = isOfferActiveNow(sel.offer);
                return (
                  <InfoWindowF
                    position={sel.latLng}
                    onCloseClick={() => setSelectedOfferId(null)}
                  >
                    <div className="text-sm">
                      <div className="font-semibold">
                        {sel.offer?.name || "Angebot"}
                      </div>
                      <div className="text-gray-700">
                        {provider?.name || "—"}
                      </div>
                      <div className="text-gray-500">
                        {(sel.offer?.category || "—")} /{" "}
                        {(sel.offer?.subcategory || "—")}
                      </div>
                      <div className="mt-2 grid gap-1 text-xs text-gray-600">
                        <div>
                          <b>Gültig:</b> {fmtDate(sel.offer?.validDates?.from)}{" "}
                          {fmtTime(sel.offer?.validTimes?.start)} –{" "}
                          {fmtDate(sel.offer?.validDates?.to)}{" "}
                          {fmtTime(sel.offer?.validTimes?.end)}
                        </div>
                        <div>
                          <b>Status heute:</b>{" "}
                          {activeNow ? "aktiv" : "inaktiv"}
                        </div>
                        <div>
                          <b>Restlaufzeit:</b> {remaining}
                        </div>
                        {Number(sel.offer?.radius) ? (
                          <div>
                            <b>Radius:</b> {Number(sel.offer.radius)} m
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </InfoWindowF>
                );
              })()}
          </GoogleMap>
        )}
      </div>

      {/* Fehler/Loading */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 mb-4">
          {error}
        </div>
      )}
      {loading && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-gray-700 mb-4">
          Lade Daten…
        </div>
      )}

      {/* Tabelle */}
      <div className="bg-white rounded-2xl shadow border border-gray-100 overflow-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold">Angebote (Liste)</h2>
          <p className="text-xs text-gray-500">
            Tipp: Eine Zeile anklicken, um den Marker zu öffnen.
          </p>
        </div>
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr className="text-left">
              <th className="px-4 py-2">Anbieter</th>
              <th className="px-4 py-2">Angebot</th>
              <th className="px-4 py-2">Kategorie</th>
              <th className="px-4 py-2">Subkategorie</th>
              <th className="px-4 py-2">Gültig von</th>
              <th className="px-4 py-2">Gültig bis</th>
              <th className="px-4 py-2 whitespace-nowrap">noch gültig</th>
              <th className="px-4 py-2">Status (heute)</th>
            </tr>
          </thead>
          <tbody>
            {offers.map((o) => {
              const provider = getProviderForOffer(o);
              const remaining = computeRemainingDHMS(o);
              const activeNow = isOfferActiveNow(o);

              return (
                <tr
                  key={o._id}
                  data-offer-row={o._id}
                  className={`border-t cursor-pointer transition ${
                    activeNow
                      ? "bg-emerald-50/40 hover:bg-emerald-50"
                      : "hover:bg-gray-50"
                  }`}
                  onClick={() => onMarkerClick(o._id)}
                  title="Marker auf der Karte anzeigen"
                >
                  <td className="px-4 py-2">{provider?.name || "—"}</td>
                  <td className="px-4 py-2">{o.name || "—"}</td>
                  <td className="px-4 py-2">{o.category || "—"}</td>
                  <td className="px-4 py-2">{o.subcategory || "—"}</td>
                  <td className="px-4 py-2">
                    {fmtDate(o?.validDates?.from)} {fmtTime(o?.validTimes?.start)}
                  </td>
                  <td className="px-4 py-2">
                    {fmtDate(o?.validDates?.to)} {fmtTime(o?.validTimes?.end)}
                  </td>
                  <td className="px-4 py-2">{remaining}</td>
                  <td className="px-4 py-2">
                    {activeNow ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        heute gültig
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-gray-500" />
                        heute nicht gültig
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {offers.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-gray-500"
                >
                  Keine Angebote gefunden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer hint */}
      <div className="mt-6 text-xs text-gray-500">
        Vorschau: In der finalen Version folgen Karten-Filter, KPI-Drilldowns,
        CSV-Exporte, mehrstufige Rollen & Rechte, sowie integrierte
        Stammdaten- und MongoDB-Werkzeuge – alles im StepsMatch-Look.
      </div>
    </div>
  );
}
