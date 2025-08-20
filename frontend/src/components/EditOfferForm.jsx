// src/components/EditOfferForm.jsx
// Korrigierte EditOfferForm.jsx mit stabilen Uploads & ohne doppeltes Google Maps Laden
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../api/axios';
import { GoogleMap, Circle } from '@react-google-maps/api';

const mapContainerStyle = {
  width: '100%',
  height: '300px',
};

const MAX_IMAGES = 3;

const EditOfferForm = () => {
  const { offerId } = useParams();
  const navigate = useNavigate();

  const [providerLocation, setProviderLocation] = useState(null); // GeoJSON [lng, lat]
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
    validTimes: { start: '', end: '' },
    validDates: { from: '', to: '' },
    contact: '',
    images: [],
    provider: '',
  });

  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Verhindere Doppel-Laden der Google Maps JS API:
  // Diese Komponente lädt NICHT mehr selbst das Script.
  const isGoogleLoaded =
    typeof window !== 'undefined' && typeof window.google !== 'undefined' && window.google.maps;

  const formatDateInput = (dateString) => {
    if (!dateString) return '';
    // Falls bereits YYYY-MM-DD, zurückgeben:
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString;
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '';
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await axiosInstance.get('categories'); // → /api/categories
        setCategories(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error('Fehler beim Laden der Kategorien:', err);
      }
    };

    const fetchOffer = async () => {
      try {
        const res = await axiosInstance.get(`offers/${offerId}`); // → /api/offers/:id
        const data = res.data || {};

        const providerId = data.provider || '';
        setFormData({
          name: data.name || '',
          category: data.category || '',
          subcategory: data.subcategory || '',
          description: data.description || '',
          radius: data.radius ?? 100,
          validDays: Array.isArray(data.validDays) ? data.validDays : [],
          validTimes: {
            start: data.validTimes?.start || '',
            end: data.validTimes?.end || '',
          },
          validDates: {
            from: formatDateInput(data.validDates?.from),
            to: formatDateInput(data.validDates?.to),
          },
          contact: data.contact || '',
          images: Array.isArray(data.images) ? data.images : [],
          provider: providerId,
        });

        // GeoJSON: [lng, lat]
        setProviderLocation(
          Array.isArray(data.location?.coordinates) ? data.location.coordinates : null
        );
      } catch (err) {
        console.error(err);
        setError('Angebot konnte nicht geladen werden.');
      }
    };

    fetchCategories();
    fetchOffer();
  }, [offerId]);

  useEffect(() => {
    const selected = categories.find((c) => c.name === formData.category);
    const subs = Array.isArray(selected?.subcategories) ? selected.subcategories : [];
    setSubcategories(subs);
    // Wenn aktuelle Subkategorie nicht (mehr) existiert, zurücksetzen
    if (formData.subcategory && !subs.includes(formData.subcategory)) {
      setFormData((prev) => ({ ...prev, subcategory: '' }));
    }
  }, [formData.category, categories]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData((prev) => ({
        ...prev,
        [parent]: { ...prev[parent], [child]: value },
      }));
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

  // ✔️ Korrigiert: Multi-Upload-Route + Feldname "images", API antwortet { ok, images: [{url,...}] }
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
      const form = new FormData();
      files.forEach((file) => form.append('images', file)); // Feldname MUSS "images" sein

      const res = await axiosInstance.post('uploads/images?folder=offers', form);
      if (res.data?.ok && Array.isArray(res.data.images)) {
        const urls = res.data.images.map((i) => i.url).filter(Boolean);
        setFormData((prev) => ({
          ...prev,
          images: [...prev.images, ...urls].slice(0, MAX_IMAGES),
        }));
      } else {
        throw new Error(res.data?.error || 'Upload fehlgeschlagen.');
      }
    } catch (err) {
      console.error('Fehler beim Hochladen der Bilder:', err);
      setError('Fehler beim Hochladen der Bilder.');
    } finally {
      setUploading(false);
      // Reset file input, damit gleiches File erneut wählbar ist
      e.target.value = '';
    }
  };

  const removeImage = async (index) => {
    const imageUrl = formData.images[index];
    try {
      await axiosInstance.delete('uploads', { data: { url: imageUrl } });
    } catch (err) {
      console.error('Fehler beim Löschen in Cloudinary:', err);
      // optimistisch entfernen
    }
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.category || !formData.subcategory) {
      setError('Kategorie und Subkategorie müssen gewählt werden.');
      return;
    }
    if ((formData.description || '').length > 250) {
      setError('Beschreibung darf maximal 250 Zeichen haben.');
      return;
    }
    if (!formData.provider) {
      setError('Provider-ID fehlt!');
      return;
    }
    if (!Array.isArray(providerLocation) || providerLocation.length !== 2) {
      setError('Ungültige Geo-Koordinaten (GeoJSON [lng, lat])');
      return;
    }

    try {
      const payload = {
        ...formData,
        radius: Number(formData.radius) || 0,
        location: {
          type: 'Point',
          coordinates: providerLocation, // GeoJSON: [lng, lat]
        },
      };
      await axiosInstance.put(`offers/${offerId}`, payload);
      setSuccess(true);
      setTimeout(() => {
        navigate(`/dashboard/${formData.provider}`);
      }, 800);
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

        {center && isGoogleLoaded && (
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
        )}
        {!isGoogleLoaded && (
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
