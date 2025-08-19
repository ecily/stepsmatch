import React, { useEffect, useMemo, useRef, useState } from "react";
import axiosInstance from "../api/axios";
import { GoogleMap, MarkerF, InfoWindowF, useLoadScript } from "@react-google-maps/api";

const mapContainerStyle = { width: "100%", height: "380px" };

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
const fmtDate = (val) => { const d = parseDateFlexible(val); return d ? d.toLocaleDateString("de-AT") : "—"; };
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

const isObjectIdString = (v) => typeof v === "string" && /^[a-f\d]{24}$/i.test(v);
const providerIsEmbedded = (p) => p && typeof p === "object" && (p.name || p._id);

// sammelt alle potenziellen Provider-IDs aus einem Offer
const collectProviderCandidateIds = (offer) => {
  const candidates = new Set();

  // direkt bekannte Felder
  const direct = [offer?.provider, offer?.providerId, offer?.provider_id, offer?.user, offer?.owner, offer?.createdBy, offer?.created_by];
  direct.forEach((v) => { if (typeof v === "string" && v) candidates.add(v); });

  // eingebetteter Provider
  if (offer?.provider && typeof offer.provider === "object") {
    const p = offer.provider;
    if (p._id) candidates.add(String(p._id));
    if (p.id) candidates.add(String(p.id));
    if (p.user) candidates.add(String(p.user));
  }

  // manche APIs liefern { provider: { _id: "..."} } ODER { user: { _id: "..." } }
  const maybeNested = [offer?.user, offer?.owner, offer?.createdBy];
  maybeNested.forEach((obj) => {
    if (obj && typeof obj === "object") {
      if (obj._id) candidates.add(String(obj._id));
      if (obj.id) candidates.add(String(obj.id));
    }
  });

  // nur plausible 24-hex Strings zulassen
  return [...candidates].filter(isObjectIdString);
};

// Provider sowohl unter Provider-_id als auch unter user-ID indexieren
const indexProviderIntoMap = (map, p) => {
  if (!p || typeof p !== "object") return;
  const pid = p._id || p.id;
  if (pid) map[String(pid)] = p;
  const userId = p.user;
  if (userId) map[String(userId)] = p;
};

const normalizeProviderResponse = (raw) => {
  if (!raw) return null;
  if (raw._id || raw.id || raw.name) return raw;
  if (raw.provider && (raw.provider._id || raw.provider.name)) return raw.provider;
  if (raw.data && (raw.data._id || raw.data.name)) return raw.data;
  if (Array.isArray(raw) && raw.length && (raw[0]?._id || raw[0]?.name)) return raw[0];
  return raw;
};

export default function AdminOffersMap() {
  const [offers, setOffers] = useState([]);
  const [providersById, setProvidersById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const mapRef = useRef(null);
  const [selectedOfferId, setSelectedOfferId] = useState(null);

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  useEffect(() => {
    let mounted = true;

    const buildMapFromArray = (arr) => {
      const map = {};
      for (const p of Array.isArray(arr) ? arr : []) indexProviderIntoMap(map, p);
      return map;
    };

    async function fetchProvidersBatch(ids) {
      try {
        const r = await axiosInstance.get("/providers", { params: { ids: ids.join(",") } });
        const data = r?.data;
        if (Array.isArray(data)) return buildMapFromArray(data);
        const normalized = normalizeProviderResponse(data);
        if (Array.isArray(normalized)) return buildMapFromArray(normalized);
      } catch {}

      try {
        const rAll = await axiosInstance.get("/providers");
        const dataAll = rAll?.data;
        if (Array.isArray(dataAll)) return buildMapFromArray(dataAll);
      } catch {}

      const perId = {};
      await Promise.all(ids.map(async (pid) => {
        try {
          const r1 = await axiosInstance.get(`/providers/${pid}`);
          const p1 = normalizeProviderResponse(r1?.data);
          if (p1) { indexProviderIntoMap(perId, p1); return; }
        } catch {}
        try {
          const r2 = await axiosInstance.get(`/provider/${pid}`);
          const p2 = normalizeProviderResponse(r2?.data);
          if (p2) { indexProviderIntoMap(perId, p2); return; }
        } catch { perId[String(pid)] = null; }
      }));
      return perId;
    }

    async function load() {
      try {
        setLoading(true);
        setError("");

        const offersRes = await axiosInstance.get("/offers");
        const offersData = Array.isArray(offersRes.data) ? offersRes.data : [];
        if (!mounted) return;
        setOffers(offersData);

        // Kandidaten-IDs aus ALLEN Offers einsammeln
        const ids = new Set();
        const embedded = {};
        for (const o of offersData) {
          // embedded provider direkt eintragen
          if (providerIsEmbedded(o?.provider)) indexProviderIntoMap(embedded, o.provider);

          // IDs sammeln (egal aus welchem Feld)
          for (const id of collectProviderCandidateIds(o)) ids.add(id);
        }

        const fetched = ids.size ? await fetchProvidersBatch(Array.from(ids)) : {};
        if (!mounted) return;

        const finalMap = { ...embedded, ...fetched };
        setProvidersById(finalMap);

        // DEBUG — zeigt dir exakt was passiert
        console.debug("🌐 axios base:", axiosInstance.defaults.baseURL);
        console.debug("📊 offers:", offersData.length);
        console.debug("🔎 collected candidate IDs:", Array.from(ids));
        console.debug("🗺️ providersById keys:", Object.keys(finalMap));
      } catch (e) {
        console.error(e);
        setError("Fehler beim Laden der Angebote/Anbieter.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
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

  const todayName = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date().getDay()];
  const resolveProviderForOffer = (o) => {
    // 1) eingebettet
    if (providerIsEmbedded(o?.provider)) return o.provider;

    // 2) beliebige Kandidaten-IDs gegeneinander prüfen
    const candidates = collectProviderCandidateIds(o);
    for (const id of candidates) {
      const hit = providersById[String(id)];
      if (hit) return hit;
    }
    return null;
  };

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
              const provider = resolveProviderForOffer(sel.offer);
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
              const provider = resolveProviderForOffer(o);
              const remaining = computeRemainingDHMS(o);
              const todayValid = Array.isArray(o.validDays) && o.validDays.length > 0
                ? o.validDays.includes(todayName)
                : true;

              return (
                <tr key={o._id} data-offer-row={o._id} className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => onMarkerClick(o._id)}>
                  <td className="px-4 py-2">
                    {provider?.name || (
                      <span className="text-gray-500">
                        {String(o?.provider || o?.providerId || o?.user || "—")}
                        <span className="ml-2 text-[10px] px-1 py-0.5 rounded bg-gray-100 align-middle">loading</span>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">{o.name || "—"}</td>
                  <td className="px-4 py-2">{o.category || "—"}</td>
                  <td className="px-4 py-2">{o.subcategory || "—"}</td>
                  <td className="px-4 py-2">{fmtDate(o?.validDates?.from)} {fmtTime(o?.validTimes?.start)}</td>
                  <td className="px-4 py-2">{fmtDate(o?.validDates?.to)} {fmtTime(o?.validTimes?.end)}</td>
                  <td className="px-4 py-2">{remaining}</td>
                  <td className="px-4 py-2">
                    {todayValid
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
