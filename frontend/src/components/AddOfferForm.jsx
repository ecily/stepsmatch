import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  GoogleMap,
  Circle,
  useLoadScript,
} from '@react-google-maps/api';

const mapContainerStyle = {
  width: '100%',
  height: '300px',
};

const AddOfferForm = () => {
  const { providerId: paramId } = useParams();
  const navigate = useNavigate();

  const providerId = paramId || localStorage.getItem('providerId');

  const today = new Date().toISOString().split('T')[0];

  const [providerLocation, setProviderLocation] = useState(null);
  const [formData, setFormData] = useState({
    provider: providerId,
    name: '',
    category: '',
    description: '',
    radius: 100,
    validDays: [],
    validTimes: { start: '00:00', end: '23:59' }, // Default-Zeit
    validDates: { from: today, to: today },       // Default-Datum
    contact: '',
    images: [],
  });

  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  useEffect(() => {
    const fetchProvider = async () => {
      if (!providerId) {
        setError('Kein Anbieter gefunden.');
        return;
      }

      try {
        const res = await axios.get(`http://localhost:5000/api/providers/${providerId}`);
        setProviderLocation(res.data.location.coordinates);
      } catch (err) {
        console.error(err);
        setError('Anbieter nicht gefunden');
      }
    };
    fetchProvider();
  }, [providerId]);

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
      files.map(file => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      })
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
    setSuccess(false);

    if (!providerLocation) {
      setError('Standort des Anbieters fehlt.');
      return;
    }

    const payload = {
      ...formData,
      provider: providerId,
      location: {
        type: 'Point',
        coordinates: providerLocation,
      },
    };

    try {
      await axios.post('http://localhost:5000/api/offers', payload);
      setSuccess(true);
      navigate(`/dashboard/${providerId}`);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Fehler beim Speichern');
    }
  };

  if (loadError) return <div>Fehler beim Laden der Karte.</div>;
  if (!isLoaded) return <div>Lade Karte...</div>;

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white shadow-lg rounded-xl mt-8">
      <h2 className="text-2xl font-semibold mb-4 text-gray-800">Angebot hinzufügen</h2>
      {error && <p className="text-red-500 mb-2">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input name="name" value={formData.name} onChange={handleChange} placeholder="Name" required className="w-full p-2 border rounded" />
        <input name="category" value={formData.category} onChange={handleChange} placeholder="Kategorie" required className="w-full p-2 border rounded" />
        <textarea name="description" value={formData.description} onChange={handleChange} placeholder="Beschreibung" rows={3} className="w-full p-2 border rounded" />

        <input type="number" name="radius" value={formData.radius} onChange={handleChange} placeholder="Radius (in m)" className="w-full p-2 border rounded" />

        {providerLocation && (
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            zoom={14}
            center={{
              lat: providerLocation[1],
              lng: providerLocation[0],
            }}
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

        {/* Gültigkeit von/bis */}
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
          <input type="time" name="validTimes.start" value={formData.validTimes.start} onChange={handleChange} className="p-2 border rounded w-full" />
          <input type="time" name="validTimes.end" value={formData.validTimes.end} onChange={handleChange} className="p-2 border rounded w-full" />
        </div>

        <input name="contact" value={formData.contact} onChange={handleChange} placeholder="Kontaktinfo (optional)" className="w-full p-2 border rounded" />

        {/* 📷 Bild-Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bilder (max. 3):</label>
          <input type="file" accept="image/*" multiple onChange={handleImageChange} className="w-full" />
          <div className="flex flex-wrap mt-2 gap-2">
            {formData.images.map((img, idx) => (
              <div key={idx} className="relative group">
                <img src={img} alt={`Bild ${idx + 1}`} className="w-24 h-24 object-cover rounded shadow" />
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

        {/* Tage */}
        <div>
          <label className="block font-medium text-gray-700 mb-1">Gültige Tage:</label>
          <div className="flex flex-wrap gap-2">
            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
              <button type="button"
                key={day}
                onClick={() => toggleArrayItem('validDays', day)}
                className={`px-3 py-1 rounded border ${formData.validDays.includes(day) ? 'bg-green-500 text-white' : 'bg-gray-100'}`}>
                {day.slice(0, 2)}
              </button>
            ))}
          </div>
        </div>

        {success && <p className="text-green-600">✅ Angebot erfolgreich gespeichert!</p>}

        <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
          Angebot speichern
        </button>
      </form>
    </div>
  );
};

export default AddOfferForm;
