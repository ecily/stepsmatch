import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import {
  CheckCircle,
  Clock,
  XCircle,
  Ruler,
} from "lucide-react";

const ProviderDashboard = () => {
  const navigate = useNavigate();
  const [offers, setOffers] = useState([]);
  const [error, setError] = useState("");
  const [providerId, setProviderId] = useState("");

  useEffect(() => {
    const userId = localStorage.getItem("userId");

    if (!userId) {
      navigate("/login");
      return;
    }

    const fetchProviderAndOffers = async () => {
      try {
        const providerRes = await axios.get(
          `http://localhost:5000/api/providers/user/${userId}`
        );
        const provider = providerRes.data;
        setProviderId(provider._id);

        const offersRes = await axios.get(
          `http://localhost:5000/api/offers/provider/${provider._id}`
        );
        setOffers(offersRes.data);
      } catch (err) {
        console.error(err);
        setError("Daten konnten nicht geladen werden");
      }
    };

    fetchProviderAndOffers();
  }, []);

  const handleDelete = async (offerId) => {
    try {
      await axios.delete(`http://localhost:5000/api/offers/${offerId}`);
      setOffers(offers.filter((o) => o._id !== offerId));
    } catch (err) {
      console.error(err);
      alert("Fehler beim Löschen");
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate("/");
  };

  const getStatusInfo = (offer) => {
    const now = new Date();
    const startDate = new Date(offer.validDates?.from);
    const endDate = new Date(offer.validDates?.to);
    endDate.setHours(23, 59, 59, 999);

    const [startHour, startMinute] = offer.validTimes?.start?.split(":") || [];
    const [endHour, endMinute] = offer.validTimes?.end?.split(":") || [];
    if (startHour && startMinute) startDate.setHours(+startHour, +startMinute, 0);
    if (endHour && endMinute) endDate.setHours(+endHour, +endMinute, 59);

    if (now < startDate) {
      const diffMs = startDate - now;
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      return {
        icon: <Clock className="text-orange-500 w-5 h-5 mr-1" />,
        text: `Gültig in ${hours}h ${minutes}min`,
      };
    }

    if (now > endDate) {
      return {
        icon: <XCircle className="text-red-500 w-5 h-5 mr-1" />,
        text: "Angebot abgelaufen",
      };
    }

    const diffMs = endDate - now;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return {
      icon: <CheckCircle className="text-green-600 w-5 h-5 mr-1" />,
      text: `Gerade gültig. Noch ${hours}h ${minutes}min`,
    };
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
          {offers.map((offer) => {
            const status = getStatusInfo(offer);
            return (
              <div
                key={offer._id}
                className="border p-4 rounded shadow-sm bg-gray-50 flex justify-between items-start gap-4"
              >
                <div className="flex gap-4">
                  {offer.images?.[0] && (
                    <img
                      src={offer.images[0]}
                      alt="Preview"
                      className="w-20 h-20 object-cover rounded"
                    />
                  )}

                  <div>
                    <h3 className="text-lg font-bold">{offer.name}</h3>
                    <p className="text-sm text-gray-600">{offer.description}</p>
                    <p className="text-sm italic text-gray-500">{offer.category}</p>

                    <div className="flex gap-2 mt-2 text-sm">
                      {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(
                        (day) => (
                          <span
                            key={day}
                            className={`px-2 py-1 text-xs rounded ${
                              offer.validDays.includes(day)
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-400"
                            }`}
                          >
                            {day.slice(0, 2)}
                          </span>
                        )
                      )}
                    </div>

                    <div className="mt-2 flex items-center text-sm text-gray-600">
                      <Ruler className="w-4 h-4 mr-1" />
                      Dein Angebot gilt im Umkreis von {offer.radius} m
                    </div>

                    <div className="mt-4 flex gap-2">
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

                <div className="text-sm text-right flex-shrink-0 flex items-center gap-1">
                  {status.icon}
                  <span className="text-gray-700">{status.text}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProviderDashboard;

