import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle, Clock, LogOut, Ruler, Settings2, Trash2, XCircle } from "lucide-react";
import { GoogleMap, Circle, useJsApiLoader } from "@react-google-maps/api";

import axiosInstance from "../api/axios";

const ProviderDashboard = () => {
  const navigate = useNavigate();
  const [offers, setOffers] = useState([]);
  const [error, setError] = useState("");
  const [providerId, setProviderId] = useState("");

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  useEffect(() => {
    const userId = localStorage.getItem("userId");

    if (!userId) {
      navigate("/login");
      return;
    }

    const fetchProviderAndOffers = async () => {
      try {
        const providerRes = await axiosInstance.get(`/providers/user/${userId}`);
        const provider = providerRes.data;
        setProviderId(provider._id);

        const offersRes = await axiosInstance.get(`/offers/provider/${provider._id}`);
        setOffers(offersRes.data);
      } catch (err) {
        console.error(err);
        setError("Daten konnten nicht geladen werden");
      }
    };

    fetchProviderAndOffers();
  }, [navigate]);

  const handleDelete = async (offerId) => {
    try {
      await axiosInstance.delete(`/offers/${offerId}`);
      setOffers((prev) => prev.filter((o) => o._id !== offerId));
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
        icon: <Clock className="mr-1 h-4 w-4 text-orange-500" />,
        text: `Gültig in ${hours}h ${minutes}min`,
      };
    }

    if (now > endDate) {
      return {
        icon: <XCircle className="mr-1 h-4 w-4 text-red-500" />,
        text: "Angebot abgelaufen",
      };
    }

    const diffMs = endDate - now;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return {
      icon: <CheckCircle className="mr-1 h-4 w-4 text-emerald-600" />,
      text: `Gerade gültig · noch ${hours}h ${minutes}min`,
    };
  };

  return (
    <div className="sm-page">
      <div className="sm-stack sm-shell py-8 sm:py-10">
        <div className="mx-auto w-full max-w-5xl space-y-5">
          <section className="sm-card-soft p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-3xl font-extrabold">Deine Angebote</h1>
                <p className="mt-2 text-slate-600">Verwalte Laufzeiten, Radius und Inhalte für deine aktive Ausspielung.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    if (!providerId) return;
                    navigate(`/edit-provider/${providerId}`);
                  }}
                  className="sm-btn-secondary !px-4 !py-2"
                >
                  <Settings2 size={15} /> Stammdaten
                </button>
                <button onClick={handleLogout} className="sm-btn-danger !px-4 !py-2">
                  <LogOut size={15} /> Logout
                </button>
              </div>
            </div>

            {providerId && (
              <Link to={`/add-offer/${providerId}`} className="sm-btn-primary mt-5 !px-4 !py-2">
                Neues Angebot anlegen
              </Link>
            )}
          </section>

          {error && <p className="sm-error">{error}</p>}

          {offers.length === 0 ? (
            <div className="sm-card p-6 text-slate-600">Noch keine Angebote vorhanden.</div>
          ) : (
            <div className="grid gap-4">
              {offers.map((offer) => {
                const status = getStatusInfo(offer);
                const [lng, lat] = offer.location.coordinates;
                const center = { lat, lng };
                const radiusWithBuffer = offer.radius + 10;

                return (
                  <article key={offer._id} className="sm-card p-5 sm:p-6">
                    <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-start gap-3">
                          {offer.images?.[0] ? (
                            <img src={offer.images[0]} alt="Preview" className="h-20 w-20 rounded-xl object-cover" />
                          ) : null}
                          <div>
                            <h2 className="text-xl font-bold">{offer.name}</h2>
                            <p className="mt-1 text-sm text-slate-600">{offer.description}</p>
                            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                              {offer.category} {offer.subcategory ? `· ${offer.subcategory}` : ""}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => (
                            <span
                              key={day}
                              className={`rounded-full border px-2 py-1 text-xs font-semibold ${
                                offer.validDays.includes(day)
                                  ? "border-emerald-300 bg-emerald-100 text-emerald-800"
                                  : "border-slate-200 bg-slate-50 text-slate-400"
                              }`}
                            >
                              {day.slice(0, 2)}
                            </span>
                          ))}
                        </div>

                        <div className="flex items-center gap-1 text-sm text-slate-600">
                          <Ruler className="h-4 w-4" />
                          Angebot gilt im Umkreis von {offer.radius} m
                        </div>

                        <div className="flex flex-wrap gap-2 pt-1">
                          <Link to={`/edit-offer/${offer._id}`} className="sm-btn-secondary !px-4 !py-2">
                            Bearbeiten
                          </Link>
                          <button onClick={() => handleDelete(offer._id)} className="sm-btn-danger !px-4 !py-2">
                            <Trash2 size={14} /> Löschen
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                          {status.icon}
                          {status.text}
                        </div>

                        {isLoaded ? (
                          <GoogleMap
                            mapContainerStyle={{ width: "100%", height: "150px", borderRadius: "12px" }}
                            center={center}
                            zoom={15}
                            options={{ disableDefaultUI: true }}
                            onLoad={(map) => {
                              const bounds = new window.google.maps.LatLngBounds();
                              const circle = new window.google.maps.Circle({ center, radius: radiusWithBuffer });
                              bounds.union(circle.getBounds());
                              map.fitBounds(bounds);
                            }}
                          >
                            <Circle
                              center={center}
                              radius={offer.radius}
                              options={{
                                fillColor: "#3b82f6",
                                fillOpacity: 0.2,
                                strokeColor: "#2563eb",
                                strokeOpacity: 0.8,
                                strokeWeight: 2,
                              }}
                            />
                          </GoogleMap>
                        ) : (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">Karte lädt...</div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProviderDashboard;
