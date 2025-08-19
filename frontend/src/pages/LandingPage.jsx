import React from "react";
import { Link } from "react-router-dom";
import logoIcon from "../assets/stepsmatch-icon.svg"; // ⬅️ neues Icon-Logo
import heroBg from "../assets/hero-bg-urban.png";

const LandingPage = () => {
  return (
    <div className="bg-white min-h-screen flex flex-col font-sans text-gray-900">
      {/* ───────── NAVBAR ───────── */}
      <nav className="fixed top-0 inset-x-0 z-40 backdrop-blur bg-white/60 border-b border-gray-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 grid grid-cols-2 md:grid-cols-3 items-center">
          <div className="flex items-center gap-3">
            <img src={logoIcon} alt="StepsMatch Logo" className="h-9 w-9 rounded-lg shadow-sm" />
            <span className="font-extrabold tracking-tight text-lg">
              stepsmatch<span className="text-blue-600">.com</span>
            </span>
          </div>

          <div className="hidden md:flex justify-center gap-8 text-sm">
            <a href="#features" className="hover:text-blue-700 transition">Features</a>
            <a href="#how" className="hover:text-blue-700 transition">So funktioniert’s</a>
            <a href="#trust" className="hover:text-blue-700 transition">Für Anbieter</a>
          </div>

          <div className="flex justify-end items-center gap-2">
            {/* Pitch-Button (Navbar) */}
            <Link
              to="/pitch"
              className="hidden sm:inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition"
              title="Pitch: Produkt in 1 Minute"
            >
              Pitch
            </Link>

            {/* Admin-Demo Button (Pitch) */}
            <Link
              to="/admin/offers"
              className="hidden sm:inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition"
              title="Admin-Demo: Angebote auf der Karte"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M3 5h18v2H3V5zm0 6h12v2H3v-2zm0 6h18v2H3v-2z" />
              </svg>
              Admin-Demo
            </Link>

            <Link
              to="/login"
              className="rounded-full px-3.5 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition"
            >
              Login
            </Link>
            <Link
              to="/register"
              className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition"
            >
              Registrieren
            </Link>
          </div>
        </div>
      </nav>

      {/* ───────── HERO ───────── */}
      <header
        className="relative w-full min-h-[92vh] md:min-h-screen bg-cover bg-center pt-16"
        style={{ backgroundImage: `url(${heroBg})` }}
      >
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/30" />

        {/* Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-20 md:py-28">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90 ring-1 ring-white/20 backdrop-blur">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Live-Kontext • Standortbasiert • Zero-Search
            </span>

            <h1 className="mt-5 text-4xl md:text-6xl font-black leading-tight tracking-tight text-white">
              Finden. Nicht suchen. <span className="text-blue-300">Genau im richtigen Moment.</span>
            </h1>

            <p className="mt-5 text-lg md:text-xl text-white/85 max-w-2xl">
              StepsMatch zeigt dir Angebote in deiner Nähe genau dann, wenn sie relevant sind.
              Keine Suche, keine Werbung – nur das, was jetzt zählt.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/register"
                className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-base font-semibold text-blue-700 shadow-lg shadow-black/10 hover:bg-gray-100 transition"
              >
                Für Anbieter: Jetzt starten
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/10 px-5 py-3 text-base font-semibold text-white hover:bg-white/15 transition"
              >
                Ich habe bereits einen Account
              </Link>

              {/* Pitch-Button (Hero – Platz 1) */}
              <Link
                to="/pitch"
                className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-base font-semibold text-white shadow-lg hover:bg-blue-700 transition"
              >
                Pitch ansehen
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M5 12h12l-4-4 1.41-1.41L21.83 12l-7.42 7.41L13 18l4-4H5z"/>
                </svg>
              </Link>

              {/* Admin-Demo prominent im Hero für Pitch */}
              <Link
                to="/admin/offers"
                className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/90 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100 transition"
              >
                Admin-Demo öffnen
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12 4l1.41 1.41L8.83 10H20v2H8.83l4.58 4.59L12 18l-8-8 8-8z" transform="scale(-1,1) translate(-24,0)"/>
                </svg>
              </Link>
            </div>

            {/* Trust badges */}
            <div className="mt-10 flex flex-wrap items-center gap-4 text-white/70">
              <div className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                DSGVO-konform
              </div>
              <div className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-sky-400" />
                Keine nervige Werbung
              </div>
              <div className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                Echtzeit-Relevanz
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ───────── FEATURES ───────── */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-3xl">
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Kontext statt Suche: <span className="text-blue-700">Warum StepsMatch?</span>
            </h2>
            <p className="mt-3 text-gray-600">
              Wir verbinden Standort, Zeitfenster und persönliche Interessen – und zeigen nur das,
              was dich im Moment weiterbringt.
            </p>
          </div>

          <div className="mt-10 grid md:grid-cols-3 gap-6">
            {[
              {
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M12 2a7 7 0 017 7c0 5.25-7 13-7 13S5 14.25 5 9a7 7 0 017-7zm0 9.5A2.5 2.5 0 109.5 9 2.5 2.5 0 0012 11.5z" />
                  </svg>
                ),
                title: "Ortsspezifisch",
                text: "Angebote in deiner Nähe – automatisch, ohne zu tippen.",
              },
              {
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M13 3a9 9 0 100 18 9 9 0 000-18zm1 4v6l4 2-1 1-5-3V7h2z" />
                  </svg>
                ),
                title: "Echtzeit",
                text: "Wir prüfen live, was jetzt für dich relevant ist.",
              },
              {
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M21 7L9 19l-6-6 1.41-1.41L9 16.17 19.59 5.59 21 7z" />
                  </svg>
                ),
                title: "Fokussiert",
                text: "Keine Werbung, keine Ablenkung – nur Nutzen im richtigen Moment.",
              },
            ].map((f, i) => (
              <div
                key={i}
                className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition"
              >
                <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-700 grid place-items-center mb-4">
                  {f.icon}
                </div>
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-gray-600">{f.text}</p>
                <div className="mt-4 text-sm text-blue-700 opacity-0 group-hover:opacity-100 transition">
                  Mehr erfahren →
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── HOW IT WORKS ───────── */}
      <section id="how" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                In drei Schritten <span className="text-blue-700">zum perfekten Match</span>
              </h2>
              <ol className="mt-6 space-y-5">
                {[
                  {
                    step: "01",
                    title: "Registrieren & Profil anlegen",
                    text: "Anbieter definieren Zeitfenster, Standort-Radius und Kategorie.",
                  },
                  {
                    step: "02",
                    title: "Live gehen",
                    text: "Deine Angebote werden im definierten Radius und Zeitfenster live ausgespielt.",
                  },
                  {
                    step: "03",
                    title: "Gefunden werden",
                    text: "Nutzer erhalten genau dann ein Signal, wenn sie in der Nähe sind – ohne Suche.",
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
                  to="/login"
                  className="rounded-full border border-gray-300 px-5 py-3 font-semibold text-gray-800 hover:bg-gray-100 transition"
                >
                  Anbieter-Login
                </Link>
              </div>
            </div>

            {/* Glass Card */}
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
                    Aktiv – wird an passende Nutzer im Umkreis ausgespielt
                  </div>
                </div>
              </div>

              {/* Floating Admin Demo button for pitch on mobile */}
              <Link
                to="/admin/offers"
                className="md:hidden fixed right-4 bottom-4 z-40 rounded-full bg-blue-600 px-4 py-3 text-white font-semibold shadow-lg hover:bg-blue-700 transition"
                title="Admin-Demo: Angebote auf der Karte"
              >
                Admin-Demo
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── TRUST / CTA FOR PROVIDERS ───────── */}
      <section id="trust" className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h3 className="text-2xl md:text-3xl font-extrabold">
            Zeig dich genau dann, wenn Kund:innen <span className="text-blue-700">vorbeikommen</span>.
          </h3>
          <p className="mt-3 text-gray-600 max-w-2xl mx-auto">
            Perfekt für Gastronomie, lokale Shops, Services und Events – zeitlich limitiert,
            ortsgenau und ohne Streuverlust.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/register"
              className="rounded-full bg-blue-600 px-6 py-3 text-white font-semibold shadow hover:bg-blue-700 transition"
            >
              Jetzt kostenlos testen
            </Link>
            <Link
              to="/admin/offers"
              className="rounded-full border border-blue-200 bg-blue-50 px-6 py-3 text-blue-800 font-semibold hover:bg-blue-100 transition"
            >
              Admin-Demo ansehen
            </Link>
          </div>

          {/* Simple logos / badges placeholder */}
          <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-6 opacity-70">
            {["Schnell", "Lokal", " DSGVO", "Zero-Search"].map((t, i) => (
              <div key={i} className="rounded-xl border border-gray-200 bg-white py-4 text-sm font-semibold">
                {t}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── FOOTER ───────── */}
      <footer className="mt-auto bg-gray-100 py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-3">
            <img src={logoIcon} alt="StepsMatch" className="h-7 w-7 rounded-md" />
            <span>© {new Date().getFullYear()} stepsmatch.com</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#features" className="hover:text-gray-900">Features</a>
            <a href="#how" className="hover:text-gray-900">So funktioniert’s</a>
            <Link to="/login" className="hover:text-gray-900">Login</Link>
            <Link to="/register" className="hover:text-gray-900">Registrieren</Link>
            <Link to="/admin/offers" className="font-semibold text-blue-700 hover:text-blue-800">
              Admin-Demo
            </Link>
            <Link to="/pitch" className="hover:text-gray-900">Pitch</Link>
          </div>
          <div>Ein Projekt von ecily / Webentwicklung</div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
