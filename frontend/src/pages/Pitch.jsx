import React from "react";
import { Link } from "react-router-dom";
import { Helmet } from "@dr.pogodin/react-helmet";
import { motion } from "motion/react";
import Navbar from "../components/Navbar";
import logoIcon from "../assets/stepsmatch-icon.svg"; // für Footer
import heroBg from "../assets/hero-bg-pitch2.png";
import navMockup from "../assets/navigation-preview.png"; // Mockup-Bild

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut", delay } },
});

const fadeIn = (delay = 0) => ({
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.55, ease: "easeOut", delay } },
});

export default function Pitch() {
  const title = "StepsMatch Pitch – Zero-Search für die reale Welt";
  const description =
    "Pre-Seed Pitch: StepsMatch macht Suchen überflüssig. Angebote finden Menschen im richtigen Moment – standort- und zeitbasiert, DSGVO-konform. Team & Ressourcen gesucht.";
  const url = "https://www.stepsmatch.com/pitch";
  const ogImage = heroBg;

  return (
    <div className="min-h-screen w-full bg-white text-gray-900">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="StepsMatch" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={url} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:image:alt" content="StepsMatch – Pre-Seed Pitch" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={ogImage} />
      </Helmet>

      {/* NAVBAR */}
      <Navbar />

      {/* HERO – Narrative in 1 Blick */}
      <header
        className="relative w-full bg-cover bg-center pt-16"
        style={{ backgroundImage: `url(${heroBg})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/60 to-black/30" />
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-20 md:py-28">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <motion.div {...fadeIn(0.05)}>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90 ring-1 ring-white/20 backdrop-blur">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Live-Kontext • Standortbasiert • Zero-Search
              </span>
              <h1 className="mt-4 text-4xl md:text-6xl font-black leading-tight tracking-tight text-white">
                Angebote, die dich finden —
                <span className="text-blue-300"> genau im richtigen Moment.</span>
              </h1>
              <p className="mt-4 text-lg md:text-xl text-white/90">
                StepsMatch macht Suchen überflüssig. Wir verbinden Ort, Zeitfenster und Interessen —
                und senden ein einziges relevantes Signal, wenn es wirklich zählt.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  to="/admin/offers"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-base font-semibold text-blue-700 shadow-lg hover:bg-gray-100 transition"
                >
                  Live-Tech-Demo öffnen
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M5 12h12l-4-4 1.41-1.41L21.83 12l-7.41 7.41L13 18l4-4H5z" />
                  </svg>
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/10 px-5 py-3 text-base font-semibold text-white hover:bg-white/15 transition"
                >
                  Anbieter: Jetzt starten
                </Link>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-4 text-white/80">
                {["DSGVO-konform", "Echtzeit-Matching", "Zero-Search UX"].map((t, i) => (
                  <span key={i} className="inline-flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
                    {t}
                  </span>
                ))}
              </div>
            </motion.div>

            {/* Mockup */}
            <motion.div className="relative hidden lg:block" {...fadeUp(0.15)}>
              <div className="rounded-[2.5rem] shadow-2xl border border-white/20 overflow-hidden bg-black/70 max-w-sm ml-auto">
                <img
                  src={navMockup}
                  alt="StepsMatch App – Navigation & Live-Signal"
                  className="w-full h-auto opacity-95"
                />
              </div>
              <div className="absolute -bottom-6 -left-6 bg-white/95 shadow-xl rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-blue-700">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
                📍 Noch 120 m bis „Pasta Lunch Angebot“
              </div>
            </motion.div>
          </div>
        </div>
      </header>

      {/* WHY NOW • PROBLEM → LÖSUNG */}
      <section className="bg-white py-14 md:py-20">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-3 gap-10">
          <motion.div className="lg:col-span-1" {...fadeUp(0.05)}>
            <h2 className="text-2xl md:text-3xl font-extrabold">Warum jetzt?</h2>
            <p className="mt-3 text-gray-700">
              Menschen sind mobil, Feeds sind voll — Aufmerksamkeit im falschen Moment ist wertlos.
              Lokale Anbieter brauchen Sichtbarkeit genau dann, wenn Laufkundschaft wirklich
              vorbeikommt. *Zero-Search* ist die logische nächste UX-Stufe.
            </p>
          </motion.div>

          <motion.div className="rounded-2xl border border-gray-200 p-6 bg-gray-50" {...fadeUp(0.1)}>
            <h3 className="text-lg font-semibold">Problem</h3>
            <ul className="mt-3 space-y-2 text-gray-700">
              <li>• Streuverluste & „Werbemüdigkeit“ in klassischen Kanälen.</li>
              <li>• Suchaufwand bei Nutzer:innen — falscher Zeitpunkt, falscher Ort.</li>
              <li>• Lokale Angebote sind flüchtig (Mittagstisch, Reststücke, Slots).</li>
            </ul>
          </motion.div>

          <motion.div className="rounded-2xl border border-gray-200 p-6 bg-white" {...fadeUp(0.15)}>
            <h3 className="text-lg font-semibold">Lösung</h3>
            <ul className="mt-3 space-y-2 text-gray-700">
              <li>• Ereignis-getriebene Signale (Enter/Exit/Heartbeat) statt Dauer-Tracking.</li>
              <li>• Matching aus Ort × Zeitfenster × Interessen ⇒ ein relevantes Signal.</li>
              <li>• Zero-Search UX: „finden, nicht suchen“ — ohne Werbung, 100 % Nutzen.</li>
            </ul>
          </motion.div>
        </div>
      </section>

      {/* MARKET • OPPORTUNITY • SIMPLE METRICS */}
      <section className="bg-gray-50 py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {[
              { k: "x3", l: "höhere Signal-Relevanz vs. Push-Spam" },
              { k: "0", l: "Suchaufwand für Nutzer:innen" },
              { k: "Minuten", l: "bis zur ersten Live-Ausspielung" },
              { k: "DSGVO", l: "Privacy-by-Design" },
            ].map((m, i) => (
              <motion.div
                key={i}
                className="rounded-2xl border border-gray-200 bg-white p-5 text-center"
                {...fadeUp(0.05 * i)}
              >
                <div className="text-2xl md:text-3xl font-extrabold text-blue-700">{m.k}</div>
                <div className="mt-1 text-xs md:text-sm text-gray-600">{m.l}</div>
              </motion.div>
            ))}
          </div>
          <p className="mt-6 text-sm text-gray-600">
            *Hinweis:* Metriken basieren aktuell auf Produkt-Annahmen & internen Tests — formale
            Pilotzahlen folgen (Admin-Demo ist bereits live).
          </p>
        </div>
      </section>

      {/* PRODUKT • HOW IT WORKS für Investoren */}
      <section className="bg-white py-14 md:py-20">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-start">
          <motion.div {...fadeUp(0.05)}>
            <h2 className="text-2xl md:text-3xl font-extrabold">Produkt in 3 Schritten</h2>
            <ol className="mt-6 space-y-5">
              {[
                {
                  step: "01",
                  title: "Angebot definieren",
                  text: "Kategorie, Radius, Zeitfenster, optional Wochentage & Slots.",
                },
                {
                  step: "02",
                  title: "Live gehen",
                  text: "Ausspielung an passende Personen im Umkreis — in Echtzeit.",
                },
                {
                  step: "03",
                  title: "Gefunden werden",
                  text: "Signal beim Eintritt — Zero-Search statt Werbung oder Suche.",
                },
              ].map((s, i) => (
                <li key={i} className="flex gap-4">
                  <div className="shrink-0 h-10 w-10 rounded-xl bg-blue-600 text-white grid place-items-center font-bold">
                    {s.step}
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{s.title}</h3>
                    <p className="text-gray-700">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/admin/offers"
                className="rounded-full bg-blue-600 px-5 py-3 text-white font-semibold shadow hover:bg-blue-700 transition"
              >
                Tech-Demo ansehen
              </Link>
              <Link
                to="/register"
                className="rounded-full border border-gray-300 px-5 py-3 font-semibold text-gray-800 hover:bg-gray-100 transition"
              >
                Anbieter registrieren
              </Link>
            </div>
          </motion.div>

          {/* Live-Beispiel Karte */}
          <motion.div className="relative" {...fadeUp(0.1)}>
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-lg">
              <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
                <p className="text-sm font-semibold text-blue-700">Live-Beispiel</p>
                <p className="mt-2 text-gray-700">
                  „Heute <b>11–14 Uhr</b> frische Pasta — <b>10 %</b> für alle in <b>150 m</b>.“
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
                  Aktiv — Ausspielung an passende Personen in der Nähe
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* BUSINESS • GTM • MOAT */}
      <section className="bg-gray-50 py-14 md:py-20">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-3 gap-10">
          <motion.div className="rounded-2xl border border-gray-200 p-6 bg-white" {...fadeUp(0.05)}>
            <h3 className="text-lg font-semibold">Geschäftsmodell</h3>
            <ul className="mt-3 space-y-2 text-gray-700">
              <li>• Start: Freemium für Anbieter (schnell onboarden).</li>
              <li>• Pro: monatlich planbar + erweiterte Radius/Slots & Insights.</li>
              <li>• Perspektive: Pay-per-Signal / Performance-Pricing.</li>
            </ul>
          </motion.div>

          <motion.div className="rounded-2xl border border-gray-200 p-6 bg-white" {...fadeUp(0.1)}>
            <h3 className="text-lg font-semibold">Go-to-Market</h3>
            <ul className="mt-3 space-y-2 text-gray-700">
              <li>• Vertical-Start: Gastro, Bäckereien, lokale Services, Events.</li>
              <li>• City-by-City Rollout mit lokalen Champions & Multiplikatoren.</li>
              <li>• Partner: Stadtmarketing, Betreiber-Netzwerke, Lieferanten.</li>
            </ul>
          </motion.div>

          <motion.div className="rounded-2xl border border-gray-200 p-6 bg-white" {...fadeUp(0.15)}>
            <h3 className="text-lg font-semibold">Tech-Moat & Privacy</h3>
            <ul className="mt-3 space-y-2 text-gray-700">
              <li>• Event-Streams (Enter/Exit/Heartbeat) statt permanenter Ortung.</li>
              <li>• On-Device-Filter & Minimierung personenbezogener Daten.</li>
              <li>• DSGVO-Konzept: *Privacy by Design*, klare Consent-Flows.</li>
            </ul>
          </motion.div>
        </div>
      </section>

      {/* ROADMAP • TEAM • HIRING */}
      <section className="bg-white py-14 md:py-20">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-3 gap-10">
          <motion.div {...fadeUp(0.05)}>
            <h3 className="text-lg font-semibold">Roadmap (Kurzfrist)</h3>
            <ul className="mt-3 space-y-2 text-gray-700">
              <li>• Pilot-City (Onboarding 50+ Anbieter), KPI-Readiness.</li>
              <li>• App-Public Beta (iOS/Android), Optimierung Signal-Relevanz.</li>
              <li>• Provider-Insights & einfache Kampagnen-Templates.</li>
            </ul>
          </motion.div>

          <motion.div {...fadeUp(0.1)}>
            <h3 className="text-lg font-semibold">Teambedarf (sofort)</h3>
            <ul className="mt-3 space-y-2 text-gray-700">
              <li>• **Full-Stack MERN** (Node/Express, MongoDB, React/React Native).</li>
              <li>• **Mobile** (React Native) — Background/Location-APIs, Push.</li>
              <li>• **Growth/Marketing** — City Rollout, Partnerships, Messaging.</li>
              <li>• Plus: **Brand/UX** für Zero-Search-Erlebnis.</li>
            </ul>
          </motion.div>

          <motion.div {...fadeUp(0.15)}>
            <h3 className="text-lg font-semibold">Traktion (heute)</h3>
            <ul className="mt-3 space-y-2 text-gray-700">
              <li>• Admin-Karte & Angebots-Engine live (Demo).</li>
              <li>• DSGVO-First Architektur & Zero-Search-Flow implementiert.</li>
              <li>• Erste Partner-Gespräche & Pilot-Setups in Vorbereitung.</li>
            </ul>
          </motion.div>
        </div>
      </section>

      {/* ASK • KONTAKT / CTA */}
      <section className="bg-blue-900 py-12 md:py-16 text-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-3 gap-8 items-center">
            <motion.div className="lg:col-span-2" {...fadeIn(0.05)}>
              <h2 className="text-2xl md:text-3xl font-extrabold">Unser „Ask“</h2>
              <p className="mt-3 text-blue-100">
                Wir öffnen unsere **Pre-Seed-Runde** und suchen parallel **Mitgründer:innen /
                frühe Team-Leads** in Engineering & Growth. Wir bieten: klares Produkt-Narrativ,
                Live-Tech, fokussierten Rollout und Ownership ab Tag 1.
              </p>
              <ul className="mt-4 space-y-2 text-blue-100">
                <li>• Kapital für Pilot-City, Beta-App & GTM (Ticketgröße flexibel).</li>
                <li>• Ressourcen für Full-Stack MERN, Mobile (RN) & Growth.</li>
                <li>• Netzwerk in Städte-/Gastro-/Event-Ökosysteme.</li>
              </ul>
            </motion.div>

            <motion.div className="space-y-3" {...fadeUp(0.1)}>
              <Link
                to="/admin/offers"
                className="block rounded-full bg-white px-6 py-3 text-blue-900 font-semibold text-center shadow hover:bg-gray-100 transition"
              >
                Live-Tech-Demo
              </Link>
              <Link
                to="/register"
                className="block rounded-full border border-white/30 bg-white/10 px-6 py-3 font-semibold text-center text-white hover:bg-white/15 transition"
              >
                Anbieter onboarden
              </Link>
              <a
                href="mailto:hello@stepsmatch.com"
                className="block rounded-full bg-blue-700 px-6 py-3 text-white font-semibold text-center shadow hover:bg-blue-800 transition"
              >
                Intro-Call anfragen
              </a>
              <p className="text-xs text-blue-200 text-center">
                Keine Zeit? Schick uns 3 Stichworte – wir melden uns mit einem Vorschlag.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-gray-100 py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-3">
            <img src={logoIcon} alt="StepsMatch" className="h-7 w-7 rounded-md" />
            <span>© {new Date().getFullYear()} stepsmatch.com</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/home" className="hover:text-gray-900">Landing</Link>
            <Link to="/register" className="hover:text-gray-900">Registrieren</Link>
            <Link to="/login" className="hover:text-gray-900">Login</Link>
            <Link to="/admin/offers" className="font-semibold text-blue-700 hover:text-blue-800">
              Admin-Demo
            </Link>
          </div>
          <div>
            Ein Projekt von{" "}
            <a
              href="https://www.ecily.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              ecily / Webentwicklung
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
