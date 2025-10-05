// src/pages/Login.jsx
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
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
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

      // ➕ Hole zugehörigen Anbieter (per userId)
      const providerRes = await axiosInstance.get(`/providers/user/${userId}`);
      const providerId = providerRes?.data?._id;
      if (!providerId) throw new Error("Kein Anbieterprofil gefunden.");

      // ✅ Weiterleitung zum richtigen Dashboard
      navigate(`/dashboard/${providerId}`);
    } catch (err) {
      console.error(err);
      setError(
        err?.response?.data?.error ||
          err?.message ||
          "Login fehlgeschlagen. Bitte erneut versuchen."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[92vh] md:min-h-screen bg-gradient-to-b from-blue-50 via-white to-white flex items-start md:items-center justify-center px-6 py-10">
      <div className="w-full max-w-2xl">
        {/* ───────── Intro / Marketing ───────── */}
        <header className="relative overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 md:p-8 shadow-sm">
          <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-blue-200/30 blur-3xl" aria-hidden />
          <div className="relative">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-blue-900">
              Anbieter-Login · Vorschau
            </h1>
            <p className="mt-2 text-gray-700">
              Diese Seite ist eine <b>Vorschau</b> auf das spätere, vollständige{" "}
              <b>Onboarding für Anbieter</b>. Im Endausbau kannst du{" "}
              <b>Angebote in Echtzeit erstellen & bearbeiten</b>, erhältst
              <b> Echtzeit-KPIs</b> (z. B. „Angebot zugestellt“, „Route gestartet“, „Angekommen“)
              und siehst <b>transparente Wirkung</b>: Wie hilft StepsMatch, deinen Umsatz zu steigern?
            </p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-800 ring-1 ring-blue-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Vorschau-Modus – Funktionen & Flows werden laufend erweitert.
            </div>
          </div>
        </header>

        {/* ───────── Login Card ───────── */}
        <div className="mt-6 rounded-2xl bg-white border border-gray-100 shadow p-6 md:p-8">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900">
            Einloggen
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Melde dich mit deiner E-Mail an, um dein Anbieter-Dashboard zu öffnen.
          </p>

          {/* Error */}
          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-gray-800"
              >
                E-Mail
              </label>
              <input
                id="email"
                type="email"
                name="email"
                placeholder="name@firma.com"
                value={formData.email}
                onChange={handleChange}
                required
                autoComplete="email"
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-gray-800"
              >
                Passwort
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  type={showPw ? "text" : "password"}
                  name="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 pr-10 text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute inset-y-0 right-2 my-auto h-8 w-8 grid place-items-center rounded-lg text-gray-500 hover:bg-gray-100"
                  aria-label={showPw ? "Passwort verbergen" : "Passwort anzeigen"}
                  title={showPw ? "Passwort verbergen" : "Passwort anzeigen"}
                >
                  {showPw ? (
                    // eye-off
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 6c4.5 0 8.3 2.6 10 6-1 2.1-2.8 3.9-5 5.1l1.4 1.4-1.4 1.4-14-14L4.4 4.4 6 6c1.8-.6 3.8-1 6-1zm0 3c-.3 0-.5 0-.8.1l1.7 1.7c.1-.2.1-.5.1-.8 0-1.1-.9-2-2-2zM3 12c.6-1.3 1.5-2.4 2.7-3.4l1.5 1.5C6 11 5 11.9 4.2 13c1.8 2.5 4.9 4 7.8 4 .9 0 1.8-.1 2.6-.4l1.6 1.6c-1.3.5-2.8.8-4.2.8-4.5 0-8.3-2.6-10-6z" />
                    </svg>
                  ) : (
                    // eye
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 5c-5 0-9.3 3-11 7 1.7 4 6 7 11 7s9.3-3 11-7c-1.7-4-6-7-11-7zm0 12c-2.8 0-5-2.2-5-5s2.2-5 5-5 5 2.2 5 5-2.2 5-5 5zm0-8a3 3 0 100 6 3 3 0 000-6z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full rounded-xl px-4 py-2 font-semibold text-white shadow transition ${
                isLoading
                  ? "bg-blue-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {isLoading ? (
                <span className="inline-flex items-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-90"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                  Wird geprüft…
                </span>
              ) : (
                "Einloggen"
              )}
            </button>
          </form>

          {/* Help / Links */}
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
            <Link
              to="/register"
              className="text-blue-700 hover:text-blue-800 font-semibold"
              title="Als Anbieter registrieren"
            >
              Noch kein Konto? Jetzt registrieren →
            </Link>
            <Link
              to="/"
              className="text-gray-600 hover:text-gray-800"
              title="Zurück zur Startseite"
            >
              Zur Startseite
            </Link>
          </div>
        </div>

        {/* ───────── Footer Hint ───────── */}
        <p className="mt-4 text-xs text-gray-500">
          In der finalen Version folgen geführtes Onboarding, Angebots-Assistent,
          Echtzeit-KPIs mit Drilldown sowie transparente Umsatz-Attribution
          pro Kampagne.
        </p>
      </div>
    </div>
  );
};

export default Login;
