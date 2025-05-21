import React, { useState, useRef, useEffect } from 'react';
import {
  GoogleMap,
  Marker,
  useLoadScript,
  Autocomplete,
} from '@react-google-maps/api';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../api/axios';

const mapContainerStyle = {
  width: '100%',
  height: '300px',
};

const defaultCenter = {
  lat: 47.0707,
  lng: 15.4395,
};

const AddProviderForm = () => {
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
    contact: '',
    address: '',
  });

  const [markerPosition, setMarkerPosition] = useState(defaultCenter);
  const [userLocation, setUserLocation] = useState(null);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const autocompleteRef = useRef(null);
  const navigate = useNavigate();

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: ['places'],
  });

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setUserLocation(coords);
        setMarkerPosition(coords);
      },
      () => {
        setUserLocation(defaultCenter);
      }
    );
  }, []);

  const handlePlaceChanged = () => {
    const place = autocompleteRef.current.getPlace();
    if (place.geometry) {
      const { lat, lng } = place.geometry.location;
      setMarkerPosition({ lat: lat(), lng: lng() });
      setFormData((prev) => ({
        ...prev,
        address: place.formatted_address || '',
      }));
    }
  };

  const handleInputChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    try {
      const userId = localStorage.getItem('userId');
      if (!userId) {
        setError('Kein Benutzer angemeldet.');
        return;
      }

      const payload = {
        ...formData,
        user: userId,
        location: {
          type: 'Point',
          coordinates: [markerPosition.lng, markerPosition.lat],
        },
      };

      const res = await axiosInstance.post('/providers', payload);

      const providerId = res.data._id;
      setSuccess(true);
      navigate(`/dashboard/${providerId}`);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Fehler beim Speichern');
    }
  };

  if (loadError) return <p>Fehler beim Laden der Karte</p>;
  if (!isLoaded) return <p>Karte wird geladen...</p>;

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white shadow-md rounded-lg mt-8">
      <h2 className="text-2xl font-semibold mb-4 text-gray-800">Anbieter erfassen</h2>
      {error && <p className="text-red-500 mb-2">{error}</p>}
      {success && <p className="text-green-600 mb-2">✅ Anbieter erfolgreich gespeichert!</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input name="name" placeholder="Name" value={formData.name} onChange={handleInputChange} required className="w-full p-2 border rounded" />
        <input name="category" placeholder="Kategorie" value={formData.category} onChange={handleInputChange} required className="w-full p-2 border rounded" />
        <textarea name="description" placeholder="Beschreibung" value={formData.description} onChange={handleInputChange} rows={3} className="w-full p-2 border rounded" />
        <input name="contact" placeholder="Kontaktinfo (optional)" value={formData.contact} onChange={handleInputChange} className="w-full p-2 border rounded" />

        <Autocomplete onLoad={(ref) => (autocompleteRef.current = ref)} onPlaceChanged={handlePlaceChanged}>
          <input type="text" placeholder="Adresse eingeben" className="w-full p-2 border rounded" />
        </Autocomplete>

        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={markerPosition}
          zoom={14}
          onClick={(e) => setMarkerPosition({ lat: e.latLng.lat(), lng: e.latLng.lng() })}
        >
          <Marker position={markerPosition} draggable onDragEnd={(e) => setMarkerPosition({ lat: e.latLng.lat(), lng: e.latLng.lng() })} />
        </GoogleMap>

        <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">Anbieter speichern</button>
      </form>
    </div>
  );
};

export default AddProviderForm;
