import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, LogIn } from "lucide-react";

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
    <div className="sm-page">
      <div className="sm-stack sm-shell grid min-h-screen place-items-center py-10">
        <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="sm-card-strong p-7 sm:p-9 sm-rise">
            <p className="sm-chip !border-white/30 !bg-white/10 !text-white">Provider Access</p>
            <h1 className="mt-4 text-3xl font-extrabold sm:text-4xl">Dein Anbieter-Dashboard in Sekunden</h1>
            <p className="mt-3 text-blue-50 sm:text-lg">
              Verwalte Radius, Gültigkeit und Inhalte deiner Angebote in einem klaren Flow.
            </p>
            <div className="mt-6 flex items-center gap-2 text-sm text-blue-50">
              <LogIn className="h-4 w-4" />
              Sicherer Login und direkte Weiterleitung in deine Live-Daten
            </div>
          </section>

          <section className="sm-card p-7 sm:p-8 sm-rise sm-delay-1">
            <h2 className="text-2xl font-extrabold">Anbieter Login</h2>
            <p className="mt-2 text-slate-600">Melde dich an, um Angebote zu erstellen, zu bearbeiten und zu steuern.</p>

            {error && <div className="sm-error mt-4">{error}</div>}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="email" className="sm-label">E-Mail</label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  autoComplete="email"
                  className="sm-input"
                />
              </div>

              <div>
                <label htmlFor="password" className="sm-label">Passwort</label>
                <div className="relative mt-1">
                  <input
                    id="password"
                    type={showPw ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    autoComplete="current-password"
                    className="sm-input pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    className="absolute inset-y-0 right-1 my-auto grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
                    aria-label={showPw ? "Passwort verbergen" : "Passwort anzeigen"}
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={isLoading} className="sm-btn-primary !w-full">
                {isLoading ? "Prüfe Zugang..." : "Einloggen"}
              </button>
            </form>

            <div className="mt-4 flex items-center justify-between text-sm">
              <Link to="/register" className="font-semibold text-blue-700 hover:text-blue-800">
                Noch kein Konto?
              </Link>
              <Link to="/home" className="text-slate-600 hover:text-slate-800">
                Zur Landing
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Login;
