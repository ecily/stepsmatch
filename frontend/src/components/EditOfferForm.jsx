// src/components/EditOfferForm.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../api/axios';
import { GoogleMap, Circle } from '@react-google-maps/api';

const mapContainerStyle = { width: '100%', height: '300px' };
const MAX_IMAGES = 3;

const EditOfferForm = () => {
  const { offerId } = useParams();
  const navigate = useNavigate();
  const API_BASE =
    (import.meta.env.VITE_API_BASE_URL || axiosInstance?.defaults?.baseURL || '').replace(/\/+$/, '');

  const [providerLocation, setProviderLocation] = useState(null);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    subcategory: '',
    description: '',
    radius: 100,
    validDays: [],
    // UI-intern: start/end (DB: from/to)
    validTimes: { start: '', end: '' },
    validDates: { from: '', to: '' },
    contact: '',
    images: [],
    provider: '',
  });

  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const isGoogleLoaded =
    typeof window !== 'undefined' && typeof window.google !== 'undefined' && window.google.maps;

  // ——— Helpers ————————————————————————————————————————————————
  const formatDateInput = (dateString) => {
    if (!dateString) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString;
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  /** Normalize to HTML time "HH:MM" (24h). */
  const formatTimeInput = (val) => {
    if (val === null || val === undefined || val === '') return '';
    if (typeof val === 'number') {
      if (val >= 0 && val < 24) return `${String(val).padStart(2, '0')}:00`;
      const h = Math.floor(val / 60);
      const m = val % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    const s = String(val).trim();

    if (/^\d{2}:\d{2}$/.test(s)) return s;

    const m1 = s.match(/^(\d{1,2}):(\d{1,2})(?::\d{1,2})?$/);
    if (m1) {
      const hh = Math.min(23, parseInt(m1[1], 10));
      const mm = Math.min(59, parseInt(m1[2], 10));
      return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    }

    if (/^\d{3,4}$/.test(s)) {
      const mm = s.slice(-2);
      const hh = s.slice(0, -2);
      return `${String(Math.min(23, parseInt(hh, 10))).padStart(2, '0')}:${String(
        Math.min(59, parseInt(mm, 10))
      ).padStart(2, '0')}`;
    }

    const ampm = s.match(/^(\d{1,2})(?::(\d{1,2}))?\s*(AM|PM)$/i);
    if (ampm) {
      let h = parseInt(ampm[1], 10);
      const m = parseInt(ampm[2] || '0', 10);
      const isPM = /pm/i.test(ampm[3]);
      if (isPM && h < 12) h += 12;
      if (!isPM && h === 12) h = 0;
      return `${String(Math.min(23, h)).padStart(2, '0')}:${String(Math.min(59, m)).padStart(2, '0')}`;
    }

    const asDate = new Date(s);
    if (!Number.isNaN(asDate.getTime())) {
      return `${String(asDate.getHours()).padStart(2, '0')}:${String(asDate.getMinutes()).padStart(2, '0')}`;
    }

    return '';
  };
  // ————————————————————————————————————————————————————————————————

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await axiosInstance.get('categories');
        setCategories(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error('Fehler Kategorien:', err);
      }
    };

    const fetchOffer = async () => {
      try {
        const res = await axiosInstance.get(`offers/${offerId}`);
        const d = res.data || {};

        // ⚠️ WICHTIG: Manche alten Datensätze enthalten leere Strings für "start"/"end".
        // Mit "||" (nicht ??) fallen wir in solchen Fällen auf "from"/"to" zurück.
        const startRaw = (d?.validTimes?.start || d?.validTimes?.from || '').trim();
        const endRaw   = (d?.validTimes?.end   || d?.validTimes?.to   || '').trim();

        setFormData({
          name: d.name || '',
          category: d.category || '',
          subcategory: d.subcategory || '',
          description: d.description || '',
          radius: d.radius ?? 100,
          validDays: Array.isArray(d.validDays) ? d.validDays : [],
          validTimes: {
            start: formatTimeInput(startRaw),
            end: formatTimeInput(endRaw),
          },
          validDates: {
            from: formatDateInput(d.validDates?.from),
            to: formatDateInput(d.validDates?.to),
          },
          contact: d.contact || '',
          images: Array.isArray(d.images) ? d.images : [],
          provider: d.provider || '',
        });

        setProviderLocation(Array.isArray(d.location?.coordinates) ? d.location.coordinates : null);
      } catch (e) {
        console.error(e);
        setError('Angebot konnte nicht geladen werden.');
      }
    };

    fetchCategories();
    fetchOffer();
  }, [offerId]);

  useEffect(() => {
    const cat = categories.find((c) => c.name === formData.category);
    const subs = Array.isArray(cat?.subcategories) ? cat.subcategories : [];
    setSubcategories(subs);
    if (formData.subcategory && !subs.includes(formData.subcategory)) {
      setFormData((p) => ({ ...p, subcategory: '' }));
    }
  }, [formData.category, categories]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'validTimes.start' || name === 'validTimes.end') {
      const normalized = formatTimeInput(value);
      const [, child] = name.split('.');
      setFormData((prev) => ({
        ...prev,
        validTimes: { ...prev.validTimes, [child]: normalized },
      }));
      return;
    }

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

  // Upload via fetch (bypasst Axios-Defaults)
  const handleImageChange = async (e) => {
    const incoming = Array.from(e.target.files || []);
    if (incoming.length === 0) return;

    const remaining = Math.max(0, MAX_IMAGES - formData.images.length);
    const files = incoming.slice(0, remaining);
    if (files.length === 0) {
      setError(`Maximal ${MAX_IMAGES} Bilder erlaubt.`);
      return;
    }

    try {
      setUploading(true);
      const fd = new FormData();
      files.forEach((f) => fd.append('images', f));

      const resp = await fetch(`${API_BASE}/uploads/images?folder=offers`, {
        method: 'POST',
        body: fd,
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.ok) {
        const msg = data?.error || `Upload fehlgeschlagen (HTTP ${resp.status}).`;
        throw new Error(msg);
      }

      const urls = (data.images || []).map((i) => i.url).filter(Boolean);
      setFormData((prev) => ({ ...prev, images: [...prev.images, ...urls].slice(0, MAX_IMAGES) }));
      // kein Reset von e.target.value → Dateiname bleibt sichtbar
    } catch (err) {
      console.error('Fehler beim Hochladen der Bilder:', err);
      setError(err?.message || 'Fehler beim Hochladen der Bilder.');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = async (index) => {
    const imageUrl = formData.images[index];
    try {
      await axiosInstance.delete('uploads', { data: { url: imageUrl } });
    } catch (err) {
      console.error('Cloudinary Delete:', err);
    }
    setFormData((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.category || !formData.subcategory)
      return setError('Kategorie und Subkategorie müssen gewählt werden.');
    if ((formData.description || '').length > 250)
      return setError('Beschreibung darf maximal 250 Zeichen haben.');
    if (!formData.provider) return setError('Provider-ID fehlt!');
    if (!Array.isArray(providerLocation) || providerLocation.length !== 2)
      return setError('Ungültige Geo-Koordinaten (GeoJSON [lng, lat])');

    try {
      const payload = {
        ...formData,
        // DB verlangt from/to
        validTimes: {
          from: formatTimeInput(formData.validTimes?.start),
          to:   formatTimeInput(formData.validTimes?.end),
        },
        radius: Number(formData.radius) || 0,
        location: { type: 'Point', coordinates: providerLocation },
      };
      await axiosInstance.put(`offers/${offerId}`, payload);
      setSuccess(true);
      setTimeout(() => navigate(`/dashboard/${formData.provider}`), 800);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Fehler beim Aktualisieren');
    }
  };

  const center =
    Array.isArray(providerLocation) && providerLocation.length === 2
      ? { lat: providerLocation[1], lng: providerLocation[0] }
      : null;

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white shadow-lg rounded-xl mt-8">
      <h2 className="text-2xl font-semibold mb-4 text-gray-800">Angebot bearbeiten</h2>
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

        {center && isGoogleLoaded ? (
          <GoogleMap mapContainerStyle={mapContainerStyle} zoom={14} center={center}>
            <Circle
              center={center}
              radius={Number(formData.radius) || 0}
              options={{
                fillColor: '#3b82f6',
                fillOpacity: 0.2,
                strokeColor: '#2563eb',
                strokeOpacity: 0.8,
                strokeWeight: 2,
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
            value={formData.validTimes.start || ''}
            onChange={handleChange}
            step="60"
            className="p-2 border rounded w-full"
          />
          <input
            type="time"
            name="validTimes.end"
            value={formData.validTimes.end || ''}
            onChange={handleChange}
            step="60"
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Bilder (max. {MAX_IMAGES}):
          </label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageChange}
            disabled={uploading || formData.images.length >= MAX_IMAGES}
            className="w-full"
          />
          <div className="flex flex-wrap mt-2 gap-2">
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
        </div>

        <div>
          <label className="block font-medium text-gray-700 mb-1">Gültige Tage:</label>
          <div className="flex flex-wrap gap-2">
            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(
              (day) => (
                <button
                  type="button"
                  key={day}
                  onClick={() => toggleArrayItem('validDays', day)}
                  className={`px-3 py-1 rounded border ${
                    formData.validDays.includes(day)
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100'
                  }`}
                >
                  {day.slice(0, 2)}
                </button>
              )
            )}
          </div>
        </div>

        {success && <p className="text-green-600">✅ Angebot aktualisiert!</p>}
        <button
          type="submit"
          disabled={uploading}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded disabled:opacity-60"
        >
          {uploading ? 'Lädt…' : 'Änderungen speichern'}
        </button>
      </form>
    </div>
  );
};

export default EditOfferForm;
