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

      {/* HERO */}
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
                Angebote, die dich finden —{" "}
                <span className="text-blue-300">genau im richtigen Moment.</span>
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

      {/* ... (Zwischenteile unverändert, siehe deine Version) ... */}

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
                href="mailto:andreas.franz@ecily.com"
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
