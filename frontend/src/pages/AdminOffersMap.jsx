import React, { useEffect, useMemo, useRef, useState } from "react";
import axiosInstance from "../api/axios";
import { GoogleMap, MarkerF, InfoWindowF, useLoadScript } from "@react-google-maps/api";

const mapContainerStyle = { width: "100%", height: "380px" };

// Konstanten
const WEEKDAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DATE_FMT_AT = new Intl.DateTimeFormat("de-AT", { year: "numeric", month: "2-digit", day: "2-digit" });

// ---- helpers ----
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
  if (typeof val === "number") { const d = new Date(val); return isNaN(d) ? null : d; }
  if (typeof val === "string") {
    const m = val.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], 0, 0, 0, 0);
    const d = new Date(val); return isNaN(d) ? null : d;
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
  const d = parseDateFlexible(dateVal); if (!d) return null;
  const { h, m, s } = parseTimeHM(timeVal);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, s, 0);
};
const fmtDate = (val) => {
  const d = parseDateFlexible(val);
  return d ? DATE_FMT_AT.format(d) : "—";
};
const fmtTime = (val) => { if (!val) return "—"; const { h, m } = parseTimeHM(val, { h: 0, m: 0, s: 0 }); return `${pad2(h)}:${pad2(m)}`; };
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
  } catch { return "—"; }
};

/** Prüft, ob das Angebot JETZT aktiv ist (Datum, Wochentag, Tageszeit). */
const isOfferActiveNow = (offer, now = new Date()) => {
  if (!offer) return false;

  // 1) Datumsspanne (inklusive Tagesgrenzen)
  const from = parseDateFlexible(offer?.validDates?.from);
  const to   = parseDateFlexible(offer?.validDates?.to);

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (from) {
    const fromStart = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0, 0);
    if (todayEnd < fromStart) return false; // noch zu früh
  }
  if (to) {
    const toEnd = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999);
    if (todayStart > toEnd) return false; // bereits vorbei
  }

  // 2) Wochentag
  const validDays = Array.isArray(offer?.validDays) ? offer.validDays : [];
  if (validDays.length > 0) {
    const todayName = WEEKDAYS_EN[now.getDay()];
    if (!validDays.includes(todayName)) return false;
  }

  // 3) Tageszeitfenster (standard: 00:00–23:59)
  const { h: sh, m: sm, s: ss } = parseTimeHM(offer?.validTimes?.start, { h: 0, m: 0, s: 0 });
  const { h: eh, m: em, s: es } = parseTimeHM(offer?.validTimes?.end,   { h: 23, m: 59, s: 59 });

  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), sh, sm, ss, 0);
  const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), eh, em, es, 999);

  return now >= start && now <= end;
};

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
        // nur noch Offers inkl. embedded provider laden
        const res = await axiosInstance.get("/offers", { params: { withProvider: 1 } });
        if (!mounted) return;
        setOffers(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        console.error(e);
        setError("Fehler beim Laden der Angebote.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const markers = useMemo(() => {
    return offers
      .map((offer) => {
        const latLng = coordsToLatLng(offer?.location?.coordinates);
        if (!latLng) return null;
        return { offer, latLng };
      })
      .filter(Boolean);
  }, [offers]);

  useEffect(() => {
    if (!isLoaded || !mapRef.current || markers.length === 0) return;
    const bounds = new window.google.maps.LatLngBounds();
    markers.forEach((m) => bounds.extend(m.latLng));
    if (markers.length === 1) {
      mapRef.current.setCenter(markers[0].latLng);
      mapRef.current.setZoom(15);
    } else {
      mapRef.current.fitBounds(bounds);
    }
  }, [isLoaded, markers]);

  const onMarkerClick = (id) => {
    setSelectedOfferId(id);
    const row = document.querySelector(`[data-offer-row="${id}"]`);
    if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  if (loadError) return <div className="p-4 text-red-600">Fehler beim Laden der Karte.</div>;

  const getProviderForOffer = (o) => (o && typeof o.provider === "object" ? o.provider : null);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Admin · Angebote (Karte & Liste)</h1>

      <div className="bg-white rounded-lg shadow mb-6">
        {!isLoaded ? (
          <div className="p-4">Karte wird geladen…</div>
        ) : (
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            onLoad={(map) => (mapRef.current = map)}
            options={{ streetViewControl: false, fullscreenControl: false, mapTypeControl: true, zoomControl: true }}
          >
            {markers.map(({ offer, latLng }) => (
              <MarkerF key={offer._id} position={latLng} onClick={() => onMarkerClick(offer._id)} />
            ))}

            {selectedOfferId && (() => {
              const sel = markers.find((m) => m.offer._id === selectedOfferId);
              if (!sel) return null;
              const provider = getProviderForOffer(sel.offer);
              return (
                <InfoWindowF position={sel.latLng} onCloseClick={() => setSelectedOfferId(null)}>
                  <div className="text-sm">
                    <div className="font-semibold">{sel.offer?.name || "Angebot"}</div>
                    <div className="text-gray-700">{provider?.name || "—"}</div>
                    <div className="text-gray-500">
                      {(sel.offer?.category || "—")} / {(sel.offer?.subcategory || "—")}
                    </div>
                  </div>
                </InfoWindowF>
              );
            })()}
          </GoogleMap>
        )}
      </div>

      {error && <div className="text-red-600 mb-3">{error}</div>}
      {loading && <div className="mb-3">Lade Daten…</div>}

      <div className="bg-white rounded-lg shadow overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-4 py-2">Anbieter</th>
              <th className="px-4 py-2">Angebot</th>
              <th className="px-4 py-2">Kategorie</th>
              <th className="px-4 py-2">Subkategorie</th>
              <th className="px-4 py-2">Gültig von</th>
              <th className="px-4 py-2">Gültig bis</th>
              <th className="px-4 py-2">noch gültig</th>
              <th className="px-4 py-2">Status (heute)</th>
            </tr>
          </thead>
          <tbody>
            {offers.map((o) => {
              const provider = getProviderForOffer(o);
              const remaining = computeRemainingDHMS(o);
              const activeNow = isOfferActiveNow(o);

              return (
                <tr key={o._id} data-offer-row={o._id} className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => onMarkerClick(o._id)}>
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
                    {activeNow
                      ? <span className="inline-block px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">heute gültig</span>
                      : <span className="inline-block px-2 py-0.5 rounded bg-gray-200 text-gray-700">heute nicht gültig</span>}
                  </td>
                </tr>
              );
            })}
            {offers.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-gray-500">Keine Angebote gefunden.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
