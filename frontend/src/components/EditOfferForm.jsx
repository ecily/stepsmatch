import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../api/axios';
import { GoogleMap, Circle, useLoadScript } from '@react-google-maps/api';

const mapContainerStyle = {
  width: '100%',
  height: '300px',
};

const EditOfferForm = () => {
  const { offerId } = useParams();
  const navigate = useNavigate();
  const [providerLocation, setProviderLocation] = useState(null);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);

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

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  const formatDateInput = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await axiosInstance.get('/categories');
        setCategories(res.data);
      } catch (err) {
        console.error('Fehler beim Laden der Kategorien:', err);
      }
    };

    const fetchOffer = async () => {
      try {
        const res = await axiosInstance.get(`/offers/${offerId}`);
        const data = res.data;

        setFormData({
          name: data.name || '',
          category: data.category || '',
          subcategory: data.subcategory || '',
          description: data.description || '',
          radius: data.radius || 100,
          validDays: data.validDays || [],
          validTimes: data.validTimes || { start: '', end: '' },
          validDates: {
            from: formatDateInput(data.validDates?.from),
            to: formatDateInput(data.validDates?.to),
          },
          contact: data.contact || '',
          images: Array.isArray(data.images) ? data.images : [],
          provider: data.provider || '',
        });

        setProviderLocation(data.location.coordinates);
      } catch (err) {
        console.error(err);
        setError('Angebot konnte nicht geladen werden.');
      }
    };

    fetchCategories();
    fetchOffer();
  }, [offerId]);

  useEffect(() => {
    const selected = categories.find(c => c.category === formData.category);
    setSubcategories(selected?.subcategories || []);
  }, [formData.category, categories]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData((prev) => ({
        ...prev,
        [parent]: { ...prev[parent], [child]: value }
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const toggleArrayItem = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((v) => v !== value)
        : [...prev[field], value]
    }));
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files).slice(0, 3 - formData.images.length);

    Promise.all(
      files.map(file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      }))
    ).then(base64Images => {
      setFormData((prev) => ({
        ...prev,
        images: [...prev.images, ...base64Images],
      }));
    }).catch(err => {
      console.error("Fehler beim Konvertieren der Bilder:", err);
    });
  };

  const removeImage = (index) => {
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

    if (formData.description.length > 250) {
      setError('Beschreibung darf maximal 250 Zeichen haben.');
      return;
    }

    try {
      const payload = {
        ...formData,
        location: {
          type: 'Point',
          coordinates: providerLocation
        }
      };
      await axiosInstance.put(`/offers/${offerId}`, payload);
      setSuccess(true);
      setTimeout(() => {
        navigate(`/dashboard/${formData.provider}`);
      }, 1000);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Fehler beim Aktualisieren');
    }
  };

  if (loadError) return <div>Fehler beim Laden der Karte.</div>;
  if (!isLoaded) return <div>Lade Karte...</div>;

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white shadow-lg rounded-xl mt-8">
      <h2 className="text-2xl font-semibold mb-4 text-gray-800">Angebot bearbeiten</h2>
      {error && <p className="text-red-500 mb-2">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input name="name" value={formData.name} onChange={handleChange} placeholder="Name" required className="w-full p-2 border rounded" />

        <select name="category" value={formData.category} onChange={handleChange} required className="w-full p-2 border rounded">
          <option value="">Kategorie wählen</option>
          {categories.map((cat, idx) => (
            <option key={idx} value={cat.category}>{cat.category}</option>
          ))}
        </select>

        <select name="subcategory" value={formData.subcategory} onChange={handleChange} required className="w-full p-2 border rounded">
          <option value="">Subkategorie wählen</option>
          {subcategories.map((sub, idx) => (
            <option key={idx} value={sub}>{sub}</option>
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

        <input type="number" name="radius" value={formData.radius} onChange={handleChange} placeholder="Radius (in m)" className="w-full p-2 border rounded" />

        {providerLocation && (
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            zoom={14}
            center={{ lat: providerLocation[1], lng: providerLocation[0] }}
          >
            <Circle
              center={{ lat: providerLocation[1], lng: providerLocation[0] }}
              radius={parseFloat(formData.radius) || 0}
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

        <div className="flex gap-4">
          <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">Gültig ab</label>
            <input type="date" name="validDates.from" value={formData.validDates.from} onChange={handleChange} className="w-full p-2 border rounded" />
          </div>
          <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">Gültig bis</label>
            <input type="date" name="validDates.to" value={formData.validDates.to} onChange={handleChange} className="w-full p-2 border rounded" />
          </div>
        </div>

        <div className="flex gap-4">
          <input type="time" name="validTimes.start" value={formData.validTimes.start} onChange={handleChange} className="p-2 border rounded w-full" />
          <input type="time" name="validTimes.end" value={formData.validTimes.end} onChange={handleChange} className="p-2 border rounded w-full" />
        </div>

        <input name="contact" value={formData.contact} onChange={handleChange} placeholder="Kontaktinfo (optional)" className="w-full p-2 border rounded" />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bilder (max. 3):</label>
          <input type="file" accept="image/*" multiple onChange={handleImageChange} className="w-full" />
          <div className="flex flex-wrap mt-2 gap-2">
            {formData.images.map((img, idx) => (
              <div key={idx} className="relative group">
                <img src={img} alt={`Bild ${idx + 1}`} className="w-24 h-24 object-cover rounded shadow" />
                <button type="button" onClick={() => removeImage(idx)} className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 text-xs hidden group-hover:flex items-center justify-center" title="Bild entfernen">
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block font-medium text-gray-700 mb-1">Gültige Tage:</label>
          <div className="flex flex-wrap gap-2">
            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
              <button
                type="button"
                key={day}
                onClick={() => toggleArrayItem('validDays', day)}
                className={`px-3 py-1 rounded border ${formData.validDays.includes(day) ? 'bg-green-500 text-white' : 'bg-gray-100'}`}
              >
                {day.slice(0, 2)}
              </button>
            ))}
          </div>
        </div>

        {success && <p className="text-green-600">✅ Angebot aktualisiert!</p>}
        <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">Änderungen speichern</button>
      </form>
    </div>
  );
};

export default EditOfferForm;
