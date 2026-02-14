import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axiosInstance from "../api/axios";

const Register = ({ onRegisterSuccess }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ name: "", email: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await axiosInstance.post("/users/register", formData);
      const providerId = res?.data?.provider?._id;
      if (!providerId) throw new Error("Registrierung erfolgreich, aber providerId fehlt.");
      localStorage.setItem("providerId", providerId);
      if (onRegisterSuccess) onRegisterSuccess(providerId);
      navigate(`/dashboard/${providerId}`);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Registrierung fehlgeschlagen.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="max-w-xl mx-auto">
        <div className="sm-card p-7 md:p-8">
          <h1 className="text-3xl font-extrabold tracking-tight">Anbieter Registrierung</h1>
          <p className="mt-2 text-slate-600">In wenigen Minuten live gehen und lokale Sichtbarkeit im richtigen Moment bekommen.</p>

          {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <form onSubmit={handleRegister} className="mt-6 space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-slate-800">Name</label>
              <input id="name" name="name" value={formData.name} onChange={handleChange} required className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2" />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-800">E-Mail</label>
              <input id="email" type="email" name="email" value={formData.email} onChange={handleChange} required className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2" />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-slate-800">Passwort</label>
              <div className="mt-1 relative">
                <input id="password" type={showPw ? "text" : "password"} name="password" value={formData.password} onChange={handleChange} required className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pr-10" />
                <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute inset-y-0 right-2 my-auto h-8 w-8 grid place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label={showPw ? "Passwort verbergen" : "Passwort anzeigen"}>
                  {showPw ? "•" : "?"}
                </button>
              </div>
            </div>

            <button type="submit" disabled={isLoading} className={`w-full rounded-xl px-4 py-2 font-semibold text-white ${isLoading ? "bg-sky-300" : "bg-sky-600 hover:bg-sky-700"}`}>
              {isLoading ? "Wird erstellt..." : "Konto erstellen"}
            </button>
          </form>

          <div className="mt-4 flex items-center justify-between text-sm">
            <Link to="/login" className="text-sky-700 font-semibold">Schon registriert?</Link>
            <Link to="/home" className="text-slate-600">Zur Landing</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
