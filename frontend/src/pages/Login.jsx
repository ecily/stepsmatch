import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axiosInstance from "../api/axios";

const Login = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await axiosInstance.post("/users/login", formData);
      const userId = res?.data?.user?._id;
      if (!userId) throw new Error("userId fehlt in der Login-Antwort");
      localStorage.setItem("userId", userId);

      const providerRes = await axiosInstance.get(`/providers/user/${userId}`);
      const providerId = providerRes?.data?._id;
      if (!providerId) throw new Error("Kein Anbieterprofil gefunden.");

      navigate(`/dashboard/${providerId}`);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Login fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="max-w-xl mx-auto">
        <div className="sm-card p-7 md:p-8">
          <h1 className="text-3xl font-extrabold tracking-tight">Anbieter Login</h1>
          <p className="mt-2 text-slate-600">Verwalte deine Angebote und erreiche Menschen im richtigen Moment.</p>

          {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-800">E-Mail</label>
              <input id="email" type="email" name="email" value={formData.email} onChange={handleChange} required autoComplete="email" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2" />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-slate-800">Passwort</label>
              <div className="mt-1 relative">
                <input id="password" type={showPw ? "text" : "password"} name="password" value={formData.password} onChange={handleChange} required autoComplete="current-password" className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pr-10" />
                <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute inset-y-0 right-2 my-auto h-8 w-8 grid place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label={showPw ? "Passwort verbergen" : "Passwort anzeigen"}>
                  {showPw ? "•" : "?"}
                </button>
              </div>
            </div>

            <button type="submit" disabled={isLoading} className={`w-full rounded-xl px-4 py-2 font-semibold text-white ${isLoading ? "bg-sky-300" : "bg-sky-600 hover:bg-sky-700"}`}>
              {isLoading ? "Wird geprüft..." : "Einloggen"}
            </button>
          </form>

          <div className="mt-4 flex items-center justify-between text-sm">
            <Link to="/register" className="text-sky-700 font-semibold">Noch kein Konto?</Link>
            <Link to="/home" className="text-slate-600">Zur Landing</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
