import React from "react";
import { Link } from "react-router-dom";
import logoIcon from "../assets/stepsmatch-icon.svg"; // ⬅️ neues Icon-Logo
import heroBg from "../assets/hero-bg-pitch2.png";
import navMockup from "../assets/navigation-preview.png"; // <- Mockup-Bild ablegen unter: frontend/src/assets/navigation-preview.png

export default function Pitch() {
  return (
    <div className="min-h-screen w-full bg-white text-gray-900">
      {/* Topbar */}
      <div className="sticky top-0 z-40 backdrop-blur bg-white/70 border-b border-gray-200/60">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoIcon} alt="StepsMatch" className="h-8 w-8 rounded-md" />
            <span className="font-extrabold text-sm md:text-base tracking-tight">
              stepsmatch<span className="text-blue-600">.com</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/admin/offers"
              className="hidden sm:inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition"
            >
              Admin-Demo
            </Link>
            <Link
              to="/"
              className="rounded-full px-3.5 py-1.5 text-xs md:text-sm font-semibold text-gray-700 hover:bg-gray-100 transition"
            >
              Landing
            </Link>
          </div>
        </div>
      </div>

      {/* Hero */}
      <header
        className="relative w-full bg-cover bg-center"
        style={{ backgroundImage: `url(${heroBg})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/30" />
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-20 md:py-28">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90 ring-1 ring-white/20 backdrop-blur">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Live-Kontext • Standortbasiert • Zero-Search
            </span>
            <h1 className="mt-4 text-4xl md:text-6xl font-black leading-tight tracking-tight text-white">
              Nutze den Moment, in dem <span className="text-blue-300">DEINE Kund:innen </span>vorbeikommen.
            </h1>
            <p className="mt-4 text-lg md:text-xl text-white">
              StepsMatch zeigt Angebote genau dann, wenn sie relevant sind – deine Kund:innen wollen nicht suchen, sie wollen gefunden werden. Perfekt für Gastronomie, lokale Shops und Services.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/register"
                className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-base font-semibold text-blue-700 shadow-lg shadow-black/10 hover:bg-gray-100 transition"
              >
                Für Anbieter: Jetzt starten
              </Link>
              <Link
                to="/admin/offers"
                className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/90 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100 transition"
              >
                Admin-Demo öffnen
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12 4l1.41 1.41L8.83 10H20v2H8.83l4.58 4.59L12 18l-8-8 8-8z" transform="scale(-1,1) translate(-24,0)"/>
                </svg>
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/10 px-5 py-3 text-base font-semibold text-white hover:bg-white/15 transition"
              >
                Ich habe bereits einen Account
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Metrics */}
      <section className="bg-white py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {[
            { k: "150 m", l: "typischer Radius" },
            { k: "11–14", l: "Zeitfenster mittags" },
            { k: "x3", l: "mehr Relevanz-Signale" },
            { k: "0", l: "Suchaufwand" },
          ].map((m, i) => (
            <div
              key={i}
              className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-center"
            >
              <div className="text-2xl md:text-3xl font-extrabold text-blue-700">{m.k}</div>
              <div className="mt-1 text-xs md:text-sm text-gray-600">{m.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Story / How it works */}
      <section className="bg-gray-50 py-14 md:py-20">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-10 items-start">
          <div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              In drei Schritten <span className="text-blue-700">zum Match</span>
            </h2>
            <ol className="mt-6 space-y-5">
              {[
                {
                  step: "01",
                  title: "Definiere dein Angebot",
                  text: "Kategorie, Radius, Zeitfenster. Optional: Wochentage und präzise Zeitslots.",
                },
                {
                  step: "02",
                  title: "Geh live",
                  text: "Wir spielen dein Angebot im Umkreis an passende Nutzer:innen aus – in Echtzeit.",
                },
                {
                  step: "03",
                  title: "Werde gefunden",
                  text: "Wenn sie vorbeikommen, bekommen sie ein Signal. Zero-Search statt Werbung.",
                },
              ].map((s, i) => (
                <li key={i} className="flex gap-4">
                  <div className="shrink-0 h-10 w-10 rounded-xl bg-blue-600 text-white grid place-items-center font-bold">
                    {s.step}
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{s.title}</h3>
                    <p className="text-gray-600">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/register"
                className="rounded-full bg-blue-600 px-5 py-3 text-white font-semibold shadow hover:bg-blue-700 transition"
              >
                Kostenlos registrieren
              </Link>
              <Link
                to="/admin/offers"
                className="rounded-full border border-blue-200 bg-blue-50 px-5 py-3 text-blue-800 font-semibold hover:bg-blue-100 transition"
              >
                Admin-Demo ansehen
              </Link>
            </div>
          </div>

          {/* Live-Beispiel Card */}
          <div className="relative">
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-lg">
              <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
                <p className="text-sm font-semibold text-blue-700">Live-Beispiel</p>
                <p className="mt-2 text-gray-700">
                  „Heute von 11–14 Uhr frische Pasta – 10% für alle in 150m.“
                </p>
                <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded-xl bg-white p-3 border border-gray-200">
                    <p className="font-semibold">Radius</p>
                    <p className="text-gray-600">150 m</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 border border-gray-200">
                    <p className="font-semibold">Zeit</p>
                    <p className="text-gray-600">11:00–14:00</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 border border-gray-200">
                    <p className="font-semibold">Kategorie</p>
                    <p className="text-gray-600">Gastronomie</p>
                  </div>
                </div>
                <div className="mt-5 flex items-center gap-2 text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Aktiv – wird an passende Nutzer:innen im Umkreis ausgespielt
                </div>
              </div>
            </div>

            {/* Floating Admin Demo (mobile) */}
            <Link
              to="/admin/offers"
              className="md:hidden fixed right-4 bottom-4 z-40 rounded-full bg-blue-600 px-4 py-3 text-white font-semibold shadow-lg hover:bg-blue-700 transition"
              title="Admin-Demo: Angebote auf der Karte"
            >
              Admin-Demo
            </Link>
          </div>
        </div>
      </section>

      {/* CTA mit Visual (Bullet-Text + App-Mockup) */}
      <section className="bg-white py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
          {/* Textseite */}
          <div>
            <h3 className="text-3xl md:text-4xl font-extrabold text-gray-900">
              Sichtbar im genau richtigen Moment.
            </h3>
            <ul className="mt-6 space-y-4">
              {[
                "Keine Streuverluste – dein Angebot erreicht nur die Richtigen.",
                "Zero-Search: Die App läuft diskret im Hintergrund und meldet sich genau dann.",
                "Präzise Schritt-für-Schritt-Navigation führt direkt bis vor die Türe.",
                "Ideal auch für Anbieter abseits der Haupteinkaufsrouten – wie eine digitale Schautafel."
              ].map((item, i) => (
                <li key={i} className="flex gap-3">
                  <span className="h-6 w-6 flex-shrink-0 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
                    ✓
                  </span>
                  <span className="text-gray-700">{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/register"
                className="rounded-full bg-blue-600 px-6 py-3 text-white font-semibold shadow hover:bg-blue-700 transition"
              >
                Jetzt kostenlos testen
              </Link>
              <Link
                to="/login"
                className="rounded-full border border-gray-300 px-6 py-3 font-semibold text-gray-800 hover:bg-gray-100 transition"
              >
                Anbieter-Login
              </Link>
            </div>
          </div>

          {/* Mockupseite */}
          <div className="relative">
            {/* Phone-Frame */}
            <div className="rounded-[2.5rem] shadow-2xl border border-gray-200 overflow-hidden bg-black max-w-xs mx-auto">
              <img
                src={navMockup}
                alt="StepsMatch App – Navigation mit Live-Distanz und Angebot"
                className="w-full h-auto"
              />
            </div>

            {/* Live-Badge */}
            <div className="absolute -bottom-6 -left-6 bg-white shadow-xl rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-blue-700">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
              📍 Noch 120 m bis „Pasta Lunch Angebot“
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-100 py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-3">
            <img src={logoIcon} alt="StepsMatch" className="h-7 w-7 rounded-md" />
            <span>© {new Date().getFullYear()} stepsmatch.com</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/" className="hover:text-gray-900">Landing</Link>
            <Link to="/register" className="hover:text-gray-900">Registrieren</Link>
            <Link to="/login" className="hover:text-gray-900">Login</Link>
            <Link to="/admin/offers" className="font-semibold text-blue-700 hover:text-blue-800">
              Admin-Demo
            </Link>
          </div>
          <div>Ein Projekt von ecily / Webentwicklung</div>
        </div>
      </footer>
    </div>
  );
}
