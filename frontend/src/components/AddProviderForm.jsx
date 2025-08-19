import React, { useState, useRef, useEffect } from 'react';
import { GoogleMap, useLoadScript, Autocomplete, Circle } from '@react-google-maps/api';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../api/axios';

const mapContainerStyle = { width: '100%', height: '340px' };
const defaultCenter = { lat: 47.0707, lng: 15.4395 };

const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID; // <-- aus .env
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export default function AddProviderForm() {
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
    contact: '',
    address: '',
  });

  const [markerPosition, setMarkerPosition] = useState(defaultCenter);
  const [radius, setRadius] = useState(300); // Meter
  const [mapType, setMapType] = useState('roadmap'); // 'roadmap' | 'satellite'

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const autocompleteRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  const navigate = useNavigate();

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: ['places', 'marker'],
  });

  // Optional: initial auf User-Standort zentrieren
  useEffect(() => {
    if (!navigator?.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMarkerPosition(coords);
        if (mapRef.current) {
          mapRef.current.panTo(coords);
          mapRef.current.setZoom(15);
        }
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  // Marker EINMAL erstellen (abhängig von isLoaded + vorhandener Map)
  useEffect(() => {
    if (!isLoaded || !mapRef.current || !window.google?.maps) return;
    if (markerRef.current) return;

    const hasAdvanced = !!window.google?.maps?.marker?.AdvancedMarkerElement;
    const canUseAdvanced = hasAdvanced && !!MAP_ID; // Advanced Marker benötigen mapId

    if (canUseAdvanced) {
      markerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        position: markerPosition,
        gmpDraggable: true,
        title: 'Standort',
      });
      markerRef.current.addListener('dragend', (e) => {
        setMarkerPosition({ lat: e.latLng.lat(), lng: e.latLng.lng() });
      });
    } else {
      markerRef.current = new window.google.maps.Marker({
        map: mapRef.current,
        position: markerPosition,
        draggable: true,
        title: 'Standort',
      });
      markerRef.current.addListener('dragend', (e) => {
        setMarkerPosition({ lat: e.latLng.lat(), lng: e.latLng.lng() });
      });
    }
  }, [isLoaded]);

  // Marker verschieben, wenn sich markerPosition ändert
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

  // Autocomplete → Marker & Map setzen (wenn User einen Vorschlag auswählt)
  const handlePlaceChanged = () => {
    const place = autocompleteRef.current?.getPlace?.();
    if (!place || !place.geometry) {
      setError('Adresse konnte nicht erkannt werden. Bitte erneut versuchen.');
      return;
    }
    const { lat, lng } = place.geometry.location;
    const next = { lat: lat(), lng: lng() };
    setMarkerPosition(next);
    setFormData((prev) => ({
      ...prev,
      address: place.formatted_address || prev.address,
    }));
    if (mapRef.current) {
      mapRef.current.panTo(next);
      mapRef.current.setZoom(16);
    }
  };

  // Adresse aus Textfeld geokodieren → Marker setzen
  const geocodeAddress = async (address) =>
    new Promise((resolve, reject) => {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode(
        { address, region: 'AT' }, // Bias nach Österreich
        (results, status) => {
          if (status === 'OK' && results[0]) resolve(results[0]);
          else reject(new Error(status));
        }
      );
    });

  const applyAddressPosition = async () => {
    setError('');
    const addr = (formData.address || '').trim();
    if (!addr) {
      setError('Bitte zuerst eine Adresse eingeben.');
      return;
    }
    try {
      setIsGeocoding(true);
      const result = await geocodeAddress(addr);
      const loc = result.geometry.location;
      const next = { lat: loc.lat(), lng: loc.lng() };
      setMarkerPosition(next);
      if (mapRef.current) {
        mapRef.current.panTo(next);
        mapRef.current.setZoom(16);
      }
    } catch (err) {
      console.error(err);
      setError('Adresse konnte nicht geokodiert werden.');
    } finally {
      setIsGeocoding(false);
    }
  };

  // Optionaler GPS-Button
  const locateMe = () => {
    if (!navigator?.geolocation) {
      setError('Geolokalisierung wird nicht unterstützt.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMarkerPosition(coords);
        if (mapRef.current) {
          mapRef.current.panTo(coords);
          mapRef.current.setZoom(16);
        }
        setIsLocating(false);
      },
      (err) => {
        console.error(err);
        setError('Standort konnte nicht ermittelt werden.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const toggleMapType = () => setMapType((t) => (t === 'roadmap' ? 'satellite' : 'roadmap'));

  const handleInputChange = (e) => {
    const { name, value } = e.target || {};
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      const userId = localStorage.getItem('userId');
      if (!userId) {
        setError('Kein Benutzer angemeldet.');
        setIsSubmitting(false);
        return;
      }

      const payload = {
        ...formData,
        user: userId,
        location: {
          type: 'Point',
          coordinates: [markerPosition.lng, markerPosition.lat], // GeoJSON: [lng, lat]
        },
        radiusMeters: radius,
      };

      const res = await axiosInstance.post('/providers', payload);
      const providerId = res?.data?._id;
      setSuccess(true);
      setTimeout(() => navigate(`/dashboard/${providerId}`), 400);
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.error || 'Fehler beim Speichern');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadError) return <p className="text-red-600 p-4">Fehler beim Laden der Karte.</p>;
  if (!isLoaded) return <p className="p-4">Karte wird geladen…</p>;

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white shadow-md rounded-lg mt-8">
      <h2 className="text-2xl font-semibold mb-4 text-gray-800">Anbieter erfassen</h2>

      {error && <p className="text-red-500 mb-3">{error}</p>}
      {success && <p className="text-green-600 mb-3">✅ Anbieter erfolgreich gespeichert!</p>}

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

        {/* Adresseingabe + Map Controls */}
        <div className="space-y-2">
          <Autocomplete
            onLoad={(ref) => (autocompleteRef.current = ref)}
            onPlaceChanged={handlePlaceChanged}
            options={{ componentRestrictions: { country: 'at' } }}
          >
            <input
              type="text"
              placeholder="Adresse eingeben"
              value={formData.address}
              onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
              className="w-full p-2 border rounded"
            />
          </Autocomplete>

          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={applyAddressPosition}
              className={`px-3 py-2 rounded text-white ${isGeocoding ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
              disabled={isGeocoding}
              title="Marker auf die eingegebene Adresse setzen"
            >
              {isGeocoding ? 'Übernehme…' : 'Adresse übernehmen'}
            </button>

            <button
              type="button"
              onClick={locateMe}
              className={`px-3 py-2 rounded text-white ${isLocating ? 'bg-gray-400' : 'bg-emerald-600 hover:bg-emerald-700'}`}
              disabled={isLocating}
              title="Marker auf aktuellen GPS-Standort setzen"
            >
              {isLocating ? 'Bestimme…' : 'Mein Standort'}
            </button>

            <button
              type="button"
              onClick={toggleMapType}
              className="px-3 py-2 rounded text-white bg-slate-700 hover:bg-slate-800"
              title="Zwischen Karte und Satellit wechseln"
            >
              {mapType === 'roadmap' ? 'Satellit' : 'Karte'}
            </button>
          </div>

          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={markerPosition}
            zoom={15}
            onLoad={(map) => (mapRef.current = map)}
            onClick={(e) => setMarkerPosition({ lat: e.latLng.lat(), lng: e.latLng.lng() })}
            options={{
              mapId: MAP_ID,                 // <<-- WICHTIG für AdvancedMarkerElement
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

        {/* Radius Slider */}
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
            onChange={(e) => setRadius(Number(e.target.value))}
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
          <button
            type="submit"
            disabled={isSubmitting}
            className={`px-4 py-2 rounded text-white ${isSubmitting ? 'bg-blue-300' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {isSubmitting ? 'Speichere…' : 'Anbieter speichern'}
          </button>
        </div>
      </form>
    </div>
  );
}
