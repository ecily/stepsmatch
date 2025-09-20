// C:\Users\Lenovo\stepsmatch\frontend\src\components\EditProviderForm.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import { GoogleMap, useLoadScript, Autocomplete, Circle } from "@react-google-maps/api";
import { useNavigate, useParams } from "react-router-dom";
import axiosInstance from "../api/axios";

const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID;
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const GOOGLE_LIBRARIES = ["places", "marker"]; // ← fix: statisch, vermeidet Reload-Warnung

const mapContainerStyle = { width: "100%", height: "340px" };
const fallbackCenter = { lat: 47.0707, lng: 15.4395 }; // Graz fallback

export default function EditProviderForm() {
  const navigate = useNavigate();
  const { providerId: routeProviderId } = useParams();

  const [providerId, setProviderId] = useState(routeProviderId || "");
  const [loading, setLoading] = useState(true);
  const [loadErrorText, setLoadErrorText] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    category: "",
    description: "",
    contact: "",
    address: "",
  });

  const [markerPosition, setMarkerPosition] = useState(fallbackCenter);
  const [radius, setRadius] = useState(300);
  const [mapType, setMapType] = useState("roadmap");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false); // Änderungen vorhanden?

  const autocompleteRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_LIBRARIES,
  });

  // Provider laden (URL-Param bevorzugt, sonst via userId)
  useEffect(() => {
    let isActive = true;

    (async () => {
      try {
        setLoading(true);
        setError("");
        setLoadErrorText("");

        let pid = routeProviderId;

        // Sanity: falls versehentlich ein Literal wie "${providerId}" durchgereicht wird
        if (pid && /\$\{/.test(pid)) {
          console.warn("[EditProviderForm] Ungültige providerId im Pfad:", pid);
          pid = "";
        }

        if (!pid) {
          const userId = localStorage.getItem("userId");
          if (!userId) {
            setLoadErrorText("Kein Benutzer angemeldet.");
            navigate("/login");
            return;
          }

          // 1) Hole Provider via userId
          try {
            const res = await axiosInstance.get(`/providers/user/${encodeURIComponent(userId)}`);
            pid = res?.data?._id;
          } catch (err) {
            console.error("[EditProviderForm] GET /providers/user/:userId failed:", err);
            if (err?.response?.status === 404) {
              setLoadErrorText("Für diesen Benutzer ist noch kein Anbieter angelegt.");
              setLoading(false);
              return;
            }
            throw err;
          }
        }

        if (!pid) {
          setLoadErrorText("Kein Anbieter gefunden.");
          setLoading(false);
          return;
        }
        setProviderId(pid);

        // 2) Lade Stammdaten des Providers
        const getUrl = `/providers/${encodeURIComponent(pid)}`;
        console.log("🔎 Lade Provider via:", axiosInstance.defaults.baseURL + getUrl);

        const provRes = await axiosInstance.get(getUrl);
        const p = provRes?.data;
        if (!p) {
          setLoadErrorText("Anbieterdaten leer oder ungültig.");
          setLoading(false);
          return;
        }

        if (!isActive) return;

        // Prefill form
        setFormData({
          name: p.name || "",
          category: p.category || "",
          description: p.description || "",
          contact: p.contact || "",
          address: p.address || "",
        });

        const coords = Array.isArray(p.location?.coordinates)
          ? { lat: p.location.coordinates[1], lng: p.location.coordinates[0] }
          : fallbackCenter;

        setMarkerPosition(coords);
        setRadius(typeof p.radiusMeters === "number" ? p.radiusMeters : 300);
        setDirty(false);

        if (mapRef.current) {
          mapRef.current.panTo(coords);
          mapRef.current.setZoom(15);
        }
      } catch (e) {
        console.error("[EditProviderForm] Laden der Provider-Stammdaten fehlgeschlagen:", e);
        const msg =
          e?.response?.data?.error ||
          e?.message ||
          "Fehler beim Laden der Anbieterdaten (500).";
        setLoadErrorText(msg);
      } finally {
        if (isActive) setLoading(false);
      }
    })();

    return () => {
      isActive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeProviderId]);

  // Marker einmalig erzeugen
  useEffect(() => {
    if (!isLoaded || !mapRef.current || !window.google?.maps) return;
    if (markerRef.current) return;

    const hasAdvanced = !!window.google?.maps?.marker?.AdvancedMarkerElement;
    const canUseAdvanced = hasAdvanced && !!MAP_ID;

    if (canUseAdvanced) {
      markerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        position: markerPosition,
        gmpDraggable: true,
        title: "Standort",
      });
      markerRef.current.addListener("dragend", (e) => {
        setMarkerPosition({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        setDirty(true);
      });
    } else {
      markerRef.current = new window.google.maps.Marker({
        map: mapRef.current,
        position: markerPosition,
        draggable: true,
        title: "Standort",
      });
      markerRef.current.addListener("dragend", (e) => {
        setMarkerPosition({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        setDirty(true);
      });
    }
  }, [isLoaded, markerPosition]);

  // Marker synchron halten
  useEffect(() => {
    if (!markerRef.current || !window.google?.maps) return;
    const m = markerRef.current;
    if (window.google?.maps?.marker?.AdvancedMarkerElement &&
        m instanceof window.google.maps.marker.AdvancedMarkerElement) {
      m.position = markerPosition;
    } else if (m.setPosition) {
      m.setPosition(markerPosition);
    }
  }, [markerPosition]);

  const handlePlaceChanged = () => {
    const place = autocompleteRef.current?.getPlace?.();
    if (!place || !place.geometry) {
      setError("Adresse konnte nicht erkannt werden. Bitte erneut versuchen.");
      return;
    }
    const { lat, lng } = place.geometry.location;
    const next = { lat: lat(), lng: lng() };
    setMarkerPosition(next);
    setFormData((prev) => ({
      ...prev,
      address: place.formatted_address || prev.address,
    }));
    setDirty(true);
    if (mapRef.current) {
      mapRef.current.panTo(next);
      mapRef.current.setZoom(16);
    }
  };

  // Geocode address string → set marker
  const geocodeAddress = async (address) =>
    new Promise((resolve, reject) => {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address, region: "AT" }, (results, status) => {
        if (status === "OK" && results[0]) resolve(results[0]);
        else reject(new Error(status));
      });
    });

  const applyAddressPosition = async () => {
    setError("");
    const addr = (formData.address || "").trim();
    if (!addr) {
      setError("Bitte zuerst eine Adresse eingeben.");
      return;
    }
    try {
      setIsGeocoding(true);
      const result = await geocodeAddress(addr);
      const loc = result.geometry.location;
      const next = { lat: loc.lat(), lng: loc.lng() };
      setMarkerPosition(next);
      setDirty(true);
      if (mapRef.current) {
        mapRef.current.panTo(next);
        mapRef.current.setZoom(16);
      }
    } catch (err) {
      console.error(err);
      setError("Adresse konnte nicht geokodiert werden.");
    } finally {
      setIsGeocoding(false);
    }
  };

  const locateMe = () => {
    if (!navigator?.geolocation) {
      setError("Geolokalisierung wird nicht unterstützt.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMarkerPosition(coords);
        setDirty(true);
        if (mapRef.current) {
          mapRef.current.panTo(coords);
          mapRef.current.setZoom(16);
        }
        setIsLocating(false);
      },
      (err) => {
        console.error(err);
        setError("Standort konnte nicht ermittelt werden.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const toggleMapType = () => setMapType((t) => (t === "roadmap" ? "satellite" : "roadmap"));

  const handleInputChange = (e) => {
    const { name, value } = e.target || {};
    setFormData((prev) => ({ ...prev, [name]: value }));
    setDirty(true);
  };

  // Zentrale Save-Funktion → versucht PATCH, fällt bei 404/405/400 auf PUT zurück
  const doSave = useCallback(async () => {
    if (!providerId) return;
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      setError("");
      setSuccess(false);

      const payload = {
        ...formData,
        location: {
          type: "Point",
          coordinates: [markerPosition.lng, markerPosition.lat], // GeoJSON [lng, lat]
        },
        radiusMeters: radius,
      };

      const url = `/providers/${encodeURIComponent(providerId)}`;
      console.log("💾 Speichere Provider via:", axiosInstance.defaults.baseURL + url, payload);

      let resp;
      try {
        resp = await axiosInstance.patch(url, payload);
        console.log("✅ PATCH ok", resp?.status);
      } catch (err) {
        const st = err?.response?.status;
        console.warn("ℹ️ PATCH fehlgeschlagen (Status:", st, ") → versuche PUT …");
        if (st === 404 || st === 405 || st === 400) {
          resp = await axiosInstance.put(url, payload);
          console.log("✅ PUT ok", resp?.status);
        } else {
          throw err;
        }
      }

      setSuccess(true);
      setDirty(false);
      // Optional: auf Dashboard zurück
      setTimeout(() => navigate(`/dashboard/${providerId}`), 450);
    } catch (err) {
      console.error("[EditProviderForm] Update fehlgeschlagen:", err);
      setError(err?.response?.data?.error || "Fehler beim Speichern der Stammdaten");
    } finally {
      setIsSubmitting(false);
    }
  }, [providerId, formData, markerPosition, radius, isSubmitting, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await doSave();
  };

  if (loadError) return <p className="text-red-600 p-4">Fehler beim Laden der Karte.</p>;
  if (!isLoaded) return <p className="p-4">Karte wird geladen…</p>;
  if (loading) return <p className="p-4">Anbieterdaten werden geladen…</p>;
  if (loadErrorText) return <p className="text-red-600 p-4">{loadErrorText}</p>;

  const disableSave =
    isSubmitting || isGeocoding || isLocating || !providerId || !dirty;

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white shadow-md rounded-lg mt-8">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-semibold text-gray-800">Anbieter-Stammdaten bearbeiten</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(`/dashboard/${providerId || ""}`)}
            className="px-3 py-2 rounded text-white bg-slate-700 hover:bg-slate-800"
          >
            Zurück
          </button>
          {/* ⬇️ Prominenter Speichern-Button in der Kopfzeile */}
          <button
            type="button"
            onClick={doSave}
            disabled={disableSave}
            className={`px-4 py-2 rounded text-white ${
              disableSave ? "bg-emerald-300" : "bg-emerald-600 hover:bg-emerald-700"
            }`}
            title={dirty ? "Änderungen speichern" : "Keine Änderungen"}
          >
            {isSubmitting ? "Speichere…" : dirty ? "Speichern" : "Gespeichert"}
          </button>
        </div>
      </div>

      {error && <p className="text-red-500 mb-3">{error}</p>}
      {success && <p className="text-green-600 mb-3">✅ Änderungen gespeichert!</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          name="name"
          placeholder="Name"
          value={formData.name}
          onChange={handleInputChange}
          required
          className="w-full p-2 border rounded"
        />

        <input
          name="category"
          placeholder="Kategorie"
          value={formData.category}
          onChange={handleInputChange}
          required
          className="w-full p-2 border rounded"
        />

        <textarea
          name="description"
          placeholder="Beschreibung"
          value={formData.description}
          onChange={handleInputChange}
          rows={3}
          className="w-full p-2 border rounded"
        />

        <input
          name="contact"
          placeholder="Kontaktinfo (optional)"
          value={formData.contact}
          onChange={handleInputChange}
          className="w-full p-2 border rounded"
        />

        {/* Adresse + Map Controls */}
        <div className="space-y-2">
          <Autocomplete
            onLoad={(ref) => (autocompleteRef.current = ref)}
            onPlaceChanged={handlePlaceChanged}
            options={{ componentRestrictions: { country: "at" } }}
          >
            <input
              type="text"
              placeholder="Adresse eingeben"
              value={formData.address}
              onChange={(e) => {
                setFormData((p) => ({ ...p, address: e.target.value }));
                setDirty(true);
              }}
              className="w-full p-2 border rounded"
            />
          </Autocomplete>

          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={applyAddressPosition}
              className={`px-3 py-2 rounded text-white ${
                isGeocoding ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"
              }`}
              disabled={isGeocoding}
              title="Marker auf die eingegebene Adresse setzen"
            >
              {isGeocoding ? "Übernehme…" : "Adresse übernehmen"}
            </button>

            <button
              type="button"
              onClick={locateMe}
              className={`px-3 py-2 rounded text-white ${
                isLocating ? "bg-gray-400" : "bg-emerald-600 hover:bg-emerald-700"
              }`}
              disabled={isLocating}
              title="Marker auf aktuellen GPS-Standort setzen"
            >
              {isLocating ? "Bestimme…" : "Mein Standort"}
            </button>

            <button
              type="button"
              onClick={() => setMapType((t) => (t === "roadmap" ? "satellite" : "roadmap"))}
              className="px-3 py-2 rounded text-white bg-slate-700 hover:bg-slate-800"
              title="Zwischen Karte und Satellit wechseln"
            >
              {mapType === "roadmap" ? "Satellit" : "Karte"}
            </button>
          </div>

          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={markerPosition}
            zoom={15}
            onLoad={(map) => (mapRef.current = map)}
            onClick={(e) => {
              setMarkerPosition({ lat: e.latLng.lat(), lng: e.latLng.lng() });
              setDirty(true);
            }}
            options={{
              mapId: MAP_ID,
              mapTypeId: mapType,
              mapTypeControl: false,
              streetViewControl: false,
              fullscreenControl: false,
              zoomControl: true,
            }}
          >
            <Circle
              center={markerPosition}
              radius={radius}
              options={{ strokeOpacity: 0.6, strokeWeight: 1, fillOpacity: 0.12 }}
            />
          </GoogleMap>
        </div>

        {/* Radius */}
        <div className="space-y-1">
          <label className="text-sm text-gray-700">
            Radius: <span className="font-medium">{radius} m</span>
          </label>
          <input
            type="range"
            min={50}
            max={5000}
            step={50}
            value={radius}
            onChange={(e) => {
              setRadius(Number(e.target.value));
              setDirty(true);
            }}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>50 m</span>
            <span>5.000 m</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="text-sm text-gray-600">
            <span className="font-medium">Koordinaten: </span>
            {markerPosition.lat.toFixed(6)}, {markerPosition.lng.toFixed(6)}
          </div>
          {/* Submit-Button bleibt als alternative Speichern-Aktion */}
          <button
            type="submit"
            disabled={isSubmitting || isGeocoding || isLocating || !providerId}
            className={`px-4 py-2 rounded text-white ${
              isSubmitting ? "bg-blue-300" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {isSubmitting ? "Speichere…" : "Änderungen speichern"}
          </button>
        </div>
      </form>
    </div>
  );
}
