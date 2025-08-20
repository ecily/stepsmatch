// src/components/AddOfferForm.jsx
// Korrigierte Version: stabiler Multi-Upload (/uploads/images, Feld "images"),
// kein doppeltes Google-Maps-Script-Laden, saubere Validierungen & UX-Feedback.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../api/axios';
import { GoogleMap, Circle, MarkerF } from '@react-google-maps/api';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const mapContainerStyle = { width: '100%', height: '320px' };
const MAX_IMAGES = 3;

// --- Helper zur Validierung ---
const isValidLngLat = (lng, lat) =>
  Number.isFinite(lng) &&
  Number.isFinite(lat) &&
  lng >= -180 &&
  lng <= 180 &&
  lat >= -90 &&
  lat <= 90;

const geoJsonToLatLng = (coords) => {
  // Erwartet GeoJSON: [lng, lat]
  if (!Array.isArray(coords) || coords.length !== 2) return null;
  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!isValidLngLat(lng, lat)) return null;
  return { lat, lng };
};

export default function AddOfferForm() {
  const { providerId: paramId } = useParams();
  const navigate = useNavigate();

  // Provider Id NUR aus der Route (kein localStorage Fallback)
  const resolvedProviderId = useMemo(() => (paramId || '').trim(), [paramId]);
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Provider-Infos
  const [providerLocation, setProviderLocation] = useState(null); // { lat, lng }
  const [providerMeta, setProviderMeta] = useState(null); // name, address
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);

  const [formData, setFormData] = useState({
    provider: resolvedProviderId,
    name: '',
    category: '',
    subcategory: '',
    description: '',
    radius: 100,
    validDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    validTimes: { start: '00:00', end: '23:59' },
    validDates: { from: today, to: today },
    contact: '',
    images: [],
  });

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const mapRef = useRef(null);
  const fetchedRef = useRef(false); // StrictMode-Doppel-Call entprellen (nur Dev)

  // Diese Komponente lädt NICHT das Google-Maps-Script selbst (verhindert Doppel-Laden).
  const isGoogleLoaded =
    typeof window !== 'undefined' && typeof window.google !== 'undefined' && window.google.maps;

  // Provider-ID in formData spiegeln (falls Route wechselt)
  useEffect(() => {
    setFormData((prev) => ({ ...prev, provider: resolvedProviderId }));
  }, [resolvedProviderId]);

  // Kategorien laden
  useEffect(() => {
    axiosInstance
      .get('categories') // → /api/categories
      .then((res) => setCategories(Array.isArray(res.data) ? res.data : []))
      .catch((err) => {
        console.error('❌ Fehler bei /categories:', err?.message || err);
      });
  }, []);

  // Provider laden (NUR wenn Route eine ID liefert)
  useEffect(() => {
    if (!resolvedProviderId) {
      setError('Kein Anbieter ausgewählt. Rufe die Seite als /offers/add/:providerId auf.');
      return;
    }
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    axiosInstance
      .get(`providers/${resolvedProviderId}`) // → /api/providers/:id
      .then((res) => {
        const provider = res?.data;
        if (!provider?._id) {
          setError('Anbieter nicht gefunden.');
          return;
        }

        const coords = provider?.location?.coordinates;
        const ll = geoJsonToLatLng(coords);
        if (!ll) {
          setError('Ungültige Geo-Koordinaten des Anbieters (erwartet GeoJSON [lng, lat]).');
          return;
        }

        setProviderLocation(ll);
        setProviderMeta({ name: provider?.name, address: provider?.address });
      })
      .catch((e) => {
        console.error(e);
        setError('Anbieter nicht gefunden.');
      });
  }, [resolvedProviderId]);

  // Subkategorien dynamisch
  useEffect(() => {
    const selected = categories.find((c) => c.name === formData.category);
    const subs = Array.isArray(selected?.subcategories) ? selected.subcategories : [];
    setSubcategories(subs);
    // entkoppeln, falls alte Subkategorie nicht mehr passt
    if (formData.subcategory && !subs.includes(formData.subcategory)) {
      setFormData((prev) => ({ ...prev, subcategory: '' }));
    }
  }, [formData.category, categories]);

  // Karte auf Provider-Center pannen
  useEffect(() => {
    if (providerLocation && mapRef.current) {
      mapRef.current.panTo(providerLocation);
      mapRef.current.setZoom(15);
    }
  }, [providerLocation]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData((prev) => ({ ...prev, [parent]: { ...prev[parent], [child]: value } }));
    } else if (name === 'radius') {
      const n = Number(value);
      setFormData((prev) => ({ ...prev, radius: Number.isFinite(n) ? n : prev.radius }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const toggleArrayItem = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((v) => v !== value)
        : [...prev[field], value],
    }));
  };

  // ✔️ Multi-Upload-Route + Feld "images" (Backend antwortet: { ok, images: [{url,...}] })
  const handleImageChange = async (e) => {
    const picked = Array.from(e.target.files || []);
    if (picked.length === 0) return;

    const remaining = Math.max(0, MAX_IMAGES - formData.images.length);
    const files = picked.slice(0, remaining);

    if (files.length === 0) {
      setError(`Maximal ${MAX_IMAGES} Bilder erlaubt.`);
      toast.error(`Maximal ${MAX_IMAGES} Bilder erlaubt.`);
      e.target.value = '';
      return;
    }

    try {
      setUploading(true);
      const form = new FormData();
      files.forEach((file) => form.append('images', file)); // Feld MUSS "images" heißen

      const res = await axiosInstance.post('uploads/images?folder=offers', form);
      if (res.data?.ok && Array.isArray(res.data.images)) {
        const urls = res.data.images.map((i) => i.url).filter(Boolean);
        setFormData((prev) => ({
          ...prev,
          images: [...prev.images, ...urls].slice(0, MAX_IMAGES),
        }));
        toast.success('Bilder hochgeladen.');
      } else {
        throw new Error(res.data?.error || 'Upload fehlgeschlagen.');
      }
    } catch (err) {
      console.error('Fehler beim Hochladen:', err);
      setError('Fehler beim Hochladen der Bilder.');
      toast.error('Fehler beim Hochladen der Bilder.');
    } finally {
      setUploading(false);
      // Reset input, damit gleiche Datei erneut wählbar
      e.target.value = '';
    }
  };

  const removeImage = async (index) => {
    const imageUrl = formData.images[index];
    try {
      await axiosInstance.delete('uploads', { data: { url: imageUrl } });
      setFormData((prev) => ({
        ...prev,
        images: prev.images.filter((_, i) => i !== index),
      }));
      toast.success('Bild entfernt.');
    } catch (err) {
      console.error('Fehler beim Löschen des Bildes:', err);
      const serverMsg = err?.response?.data?.error || 'Fehler beim Löschen des Bildes.';
      toast.error(serverMsg);
      // Optional: trotzdem optimistisch entfernen:
      setFormData((prev) => ({
        ...prev,
        images: prev.images.filter((_, i) => i !== index),
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!resolvedProviderId) {
      setError('Kein Anbieter ausgewählt.');
      toast.error('Kein Anbieter ausgewählt.');
      return;
    }
    if (!providerLocation) {
      setError('Standort des Anbieters fehlt.');
      toast.error('Standort des Anbieters fehlt.');
      return;
    }
    if (!formData.category || !formData.subcategory) {
      setError('Kategorie und Subkategorie müssen gewählt werden.');
      toast.error('Kategorie und Subkategorie müssen gewählt werden.');
      return;
    }
    if ((formData.description || '').length > 250) {
      setError('Beschreibung darf maximal 250 Zeichen haben.');
      toast.error('Beschreibung darf maximal 250 Zeichen haben.');
      return;
    }

    const radiusMeters = Number(formData.radius) || 0;

    const payload = {
      ...formData,
      provider: resolvedProviderId,
      radius: radiusMeters,
      location: {
        type: 'Point',
        // GeoJSON: [lng, lat]
        coordinates: [providerLocation.lng, providerLocation.lat],
      },
    };

    try {
      await axiosInstance.post('offers', payload); // → /api/offers
      toast.success('✅ Angebot erfolgreich gespeichert!');
      navigate(`/dashboard/${resolvedProviderId}`);
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || 'Fehler beim Speichern';
      setError(msg);
      toast.error(msg);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white shadow-lg rounded-xl mt-8">
      <ToastContainer />
      <h2 className="text-2xl font-semibold mb-2 text-gray-800">Angebot hinzufügen</h2>
      {providerMeta && (
        <p className="text-sm text-gray-600 mb-4">
          Anbieter: <span className="font-medium">{providerMeta.name}</span> — {providerMeta.address}
        </p>
      )}
      {error && <p className="text-red-500 mb-2">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="Name"
          required
          className="w-full p-2 border rounded"
        />

        <select
          name="category"
          value={formData.category}
          onChange={handleChange}
          required
          className="w-full p-2 border rounded"
        >
          <option value="">Kategorie wählen</option>
          {categories.map((cat, idx) => (
            <option key={idx} value={cat.name}>
              {cat.name}
            </option>
          ))}
        </select>

        <select
          name="subcategory"
          value={formData.subcategory}
          onChange={handleChange}
          required
          className="w-full p-2 border rounded"
        >
          <option value="">Subkategorie wählen</option>
          {subcategories.map((sub, idx) => (
            <option key={idx} value={sub}>
              {sub}
            </option>
          ))}
        </select>

        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="Beschreibung"
          maxLength={250}
          rows={3}
          className="w-full p-2 border rounded"
        />

        <input
          type="number"
          name="radius"
          value={formData.radius}
          onChange={handleChange}
          placeholder="Radius (in m)"
          className="w-full p-2 border rounded"
          min={0}
        />

        {/* Karte zeigt IMMER den exakten Provider-Standort */}
        {providerLocation && isGoogleLoaded ? (
          <GoogleMap
            key={`${providerLocation.lat},${providerLocation.lng}`} // Remount bei Center-Change erzwingen
            mapContainerStyle={mapContainerStyle}
            zoom={15}
            center={providerLocation}
            onLoad={(map) => (mapRef.current = map)}
            options={{
              mapTypeControl: false,
              streetViewControl: false,
              fullscreenControl: false,
              zoomControl: true,
            }}
          >
            <MarkerF position={providerLocation} />
            <Circle
              center={providerLocation}
              radius={Number(formData.radius) || 0}
              options={{
                strokeColor: '#2563eb',
                fillColor: '#3b82f6',
                strokeOpacity: 0.8,
                strokeWeight: 2,
                fillOpacity: 0.2,
              }}
            />
          </GoogleMap>
        ) : (
          <div className="p-3 rounded bg-gray-50 text-gray-600">
            Karte nicht geladen (Google Maps Script wird zentral geladen).
          </div>
        )}

        <div className="flex gap-4">
          <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">Gültig ab</label>
            <input
              type="date"
              name="validDates.from"
              value={formData.validDates.from}
              onChange={handleChange}
              className="w-full p-2 border rounded"
            />
          </div>
          <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">Gültig bis</label>
            <input
              type="date"
              name="validDates.to"
              value={formData.validDates.to}
              onChange={handleChange}
              className="w-full p-2 border rounded"
            />
          </div>
        </div>

        <div className="flex gap-4">
          <input
            type="time"
            name="validTimes.start"
            value={formData.validTimes.start}
            onChange={handleChange}
            className="p-2 border rounded w-full"
          />
          <input
            type="time"
            name="validTimes.end"
            value={formData.validTimes.end}
            onChange={handleChange}
            className="p-2 border rounded w-full"
          />
        </div>

        <input
          name="contact"
          value={formData.contact}
          onChange={handleChange}
          placeholder="Kontaktinfo (optional)"
          className="w-full p-2 border rounded"
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bilder (max. {MAX_IMAGES}):</label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageChange}
            disabled={uploading || formData.images.length >= MAX_IMAGES}
            className="w-full"
          />
        </div>

        {formData.images.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {formData.images.map((img, idx) => (
              <div key={idx} className="relative group">
                <img
                  src={img}
                  alt={`Bild ${idx + 1}`}
                  className="w-24 h-24 object-cover rounded shadow"
                />
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 text-xs hidden group-hover:flex items-center justify-center"
                  title="Bild entfernen"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="submit"
          disabled={uploading}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded disabled:opacity-60"
        >
          {uploading ? 'Lädt…' : 'Angebot speichern'}
        </button>
      </form>
    </div>
  );
}
