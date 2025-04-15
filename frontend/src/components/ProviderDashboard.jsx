import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

const ProviderDashboard = () => {
  const navigate = useNavigate();
  const [offers, setOffers] = useState([]);
  const [error, setError] = useState('');
  const [providerId, setProviderId] = useState('');

  useEffect(() => {
    const userId = localStorage.getItem('userId');

    if (!userId) {
      navigate('/login');
      return;
    }

    const fetchProviderAndOffers = async () => {
      try {
        // ✅ Anbieter zur User-ID laden
        const providerRes = await axios.get(`http://localhost:5000/api/providers/user/${userId}`);
        const provider = providerRes.data;
        setProviderId(provider._id);

        // ✅ Angebote für diesen Anbieter laden
        const offersRes = await axios.get(`http://localhost:5000/api/offers/provider/${provider._id}`);
        setOffers(offersRes.data);
      } catch (err) {
        console.error(err);
        setError('Daten konnten nicht geladen werden');
      }
    };

    fetchProviderAndOffers();
  }, []);

  const handleDelete = async (offerId) => {
    try {
      await axios.delete(`http://localhost:5000/api/offers/${offerId}`);
      setOffers(offers.filter(o => o._id !== offerId));
    } catch (err) {
      console.error(err);
      alert('Fehler beim Löschen');
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  return (
    <div className="max-w-4xl mx-auto mt-8 p-6 bg-white rounded shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-800">Deine Angebote</h2>
        <button
          onClick={handleLogout}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
        >
          Logout
        </button>
      </div>

      {providerId && (
        <Link
          to={`/add-offer/${providerId}`}
          className="inline-block mb-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
        >
          ➕ Neues Angebot anlegen
        </Link>
      )}

      {error && <p className="text-red-500">{error}</p>}

      {offers.length === 0 ? (
        <p className="text-gray-600">Noch keine Angebote vorhanden.</p>
      ) : (
        <div className="space-y-4">
          {offers.map((offer) => (
            <div key={offer._id} className="border p-4 rounded shadow-sm bg-gray-50">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold">{offer.name}</h3>
                  <p className="text-sm text-gray-600">{offer.description}</p>
                  <p className="text-sm text-gray-600 italic">{offer.category}</p>
                </div>
                <div className="flex gap-2">
                  <Link
                    to={`/edit-offer/${offer._id}`}
                    className="px-3 py-1 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600"
                  >
                    ✏️ Bearbeiten
                  </Link>
                  <button
                    onClick={() => handleDelete(offer._id)}
                    className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    🗑️ Löschen
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProviderDashboard;
