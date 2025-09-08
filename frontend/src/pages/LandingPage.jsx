import React from "react";
import { Link } from "react-router-dom";
import { Helmet } from "@dr.pogodin/react-helmet";
import { motion } from "motion/react";
import Navbar from "../components/Navbar";
import logoIcon from "../assets/stepsmatch-icon.svg"; // bleibt für Footer
import heroBg from "../assets/hero-bg-pitch2.jpg";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut", delay } },
});

const fadeIn = (delay = 0) => ({
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.6, ease: "easeOut", delay } },
});

const PhonePushMock = () => {
  return (
    <motion.div
      className="relative mx-auto mt-10 md:mt-0 w-[290px] sm:w-[320px]"
      {...fadeUp(0.2)}
    >
      {/* Phone frame */}
      <div className="relative rounded-[36px] border border-white/20 bg-white/10 backdrop-blur-xl shadow-2xl overflow-hidden">
        {/* Notch */}
        <div className="absolute left-1/2 -translate-x-1/2 top-0 h-6 w-36 bg-black/70 rounded-b-2xl z-20" />
        {/* Map placeholder */}
        <div className="h-[520px] w-full bg-gradient-to-br from-blue-900/30 via-blue-700/30 to-indigo-700/30">
          {/* Radius bubble */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="relative">
              <span className="absolute inset-0 rounded-full bg-blue-400/20 animate-ping" />
              <span className="block h-28 w-28 rounded-full bg-blue-500/25 border border-white/30" />
            </div>
          </div>
          {/* Location dot */}
          <div className="absolute left-1/2 top-[54%] -translate-x-1/2 -translate-y-1/2">
            <span className="block h-3 w-3 rounded-full bg-emerald-400 shadow shadow-emerald-900/40" />
          </div>
        </div>

        {/* Push bubble */}
        <motion.div className="absolute left-4 right-4 top-16" {...fadeUp(0.35)}>
          <div className="rounded-2xl bg-white text-gray-900 shadow-xl shadow-black/10 border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-blue-600 text-white grid place-items-center font-bold">
                S
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold">StepsMatch</div>
                <div className="text-xs text-gray-600">
                  Du bist <b>120 m</b> entfernt – <b>11–14 Uhr</b> heute <b>10 % Pasta</b>
                </div>
              </div>
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

const LandingPage = () => {
  const title = "StepsMatch – finden. nicht suchen.";
  const description =
    "StepsMatch sendet dir nur dann ein Signal, wenn ein Angebot in deiner Nähe wirklich passt – Zero-Search, DSGVO-konform und in Echtzeit.";
  const url = "https://www.stepsmatch.com/";
  const ogImage = heroBg; // Alternativ ein dediziertes 1200x630-OG-Bild exportieren
  const twitterHandle = "@stepsmatch"; // falls vorhanden, sonst leer lassen

  const jsonLdOrganization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "StepsMatch",
    url,
    logo: logoIcon,
    sameAs: ["https://www.ecily.com"],
  };

  const jsonLdApp = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "StepsMatch",
    operatingSystem: "Android",
    applicationCategory: "LifestyleApplication",
    description,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "EUR",
    },
  };

  return (
    <div className="bg-white min-h-screen flex flex-col font-sans text-gray-900">
      {/* ───────── SEO / SHARING ───────── */}
      <Helmet>
        {/* Base */}
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />

        {/* Preload Hero (schneller First Paint) */}
        <link rel="preload" as="image" href={heroBg} />

        {/* Preconnects (Performance-Hint) */}
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="StepsMatch" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={url} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:image:alt" content="StepsMatch – Zero-Search Benachrichtigungsvorschau" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        {twitterHandle && <meta name="twitter:site" content={twitterHandle} />}
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={ogImage} />

        {/* JSON-LD */}
        <script type="application/ld+json">{JSON.stringify(jsonLdOrganization)}</script>
        <script type="application/ld+json">{JSON.stringify(jsonLdApp)}</script>
      </Helmet>

      {/* ───────── NAVBAR ───────── */}
      <Navbar />

      {/* ───────── HERO ───────── */}
      <header
        className="relative w-full min-h-[92vh] md:min-h-screen bg-cover bg-center pt-16"
        style={{ backgroundImage: `url(${heroBg})` }}
        aria-label="Hero Hintergrundbild Stadtansicht"
      >
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/80" />

        {/* Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-16 md:py-24">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            {/* Left: Text */}
            <motion.div className="max-w-3xl" {...fadeIn(0.05)}>
              {/* Brand Chip */}
              <motion.span
                className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90 ring-1 ring-white/20 backdrop-blur"
                {...fadeUp(0.1)}
              >
                <img src={logoIcon} alt="StepsMatch" className="h-4 w-4 rounded-sm" />
                <span>StepsMatch</span>
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Zero-Search • DSGVO-konform
              </motion.span>

              {/* Brand + Claim */}
              <motion.h1
                className="mt-5 text-[2.6rem] leading-[1.05] md:text-6xl font-black tracking-tight text-white"
                {...fadeUp(0.15)}
              >
                <span className="block">StepsMatch</span>
                <span className="block opacity-90">finden. nicht suchen.</span>
              </motion.h1>

              <motion.p
                className="mt-5 text-lg md:text-xl text-white/85 max-w-2xl"
                {...fadeUp(0.2)}
              >
                Wir zeigen dir nur, was <b>jetzt</b> und <b>hier</b> wirklich passt – basierend auf
                Standort, Zeitfenster und Interessen. Keine Suche. Kein Spam. Nur Relevanz.
              </motion.p>

              {/* Persona-CTAs */}
              <motion.div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3" {...fadeUp(0.25)}>
                <Link
                  to="/register"
                  className="group inline-flex items-center justify-between rounded-2xl bg-white px-5 py-4 text-base font-semibold text-blue-700 shadow-lg shadow-black/10 hover:bg-gray-100 transition"
                  title="Anbieter registrieren"
                >
                  Anbieter
                  <span className="ml-3 text-blue-700/70 group-hover:translate-x-0.5 transition">→</span>
                </Link>
                <a
                  href="#how"
                  className="group inline-flex items-center justify-between rounded-2xl border border-white/30 bg-white/10 px-5 py-4 text-base font-semibold text-white hover:bg-white/15 transition"
                  title="So funktioniert’s für Nutzer"
                >
                  Nutzer
                  <span className="ml-3 opacity-80 group-hover:translate-x-0.5 transition">→</span>
                </a>
                <Link
                  to="/pitch"
                  className="group inline-flex items-center justify-between rounded-2xl bg-blue-600/90 px-5 py-4 text-base font-semibold text-white shadow-lg hover:bg-blue-700 transition"
                  title="Investor Pitch"
                >
                  Investoren
                  <span className="ml-3 opacity-90 group-hover:translate-x-0.5 transition">→</span>
                </Link>
              </motion.div>

              {/* Trust bar */}
              <motion.div className="mt-8 flex flex-wrap items-center gap-4 text-white/85" {...fadeUp(0.3)}>
                {["DSGVO", "Zero-Search", "Echtzeit", "Kein Tracking der Wege"].map((t, i) => (
                  <div key={i} className="inline-flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-white/85" />
                    <span className="tracking-wide">{t}</span>
                  </div>
                ))}
              </motion.div>

              {/* Admin Demo (dezent) */}
              <motion.div className="mt-6" {...fadeUp(0.35)}>
                <Link
                  to="/admin/offers"
                  className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/90 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100 transition"
                  title="Admin-Demo: Angebote auf der Karte"
                >
                  Admin-Demo öffnen
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path
                      d="M12 4l1.41 1.41L8.83 10H20v2H8.83l4.58 4.59L12 18l-8-8 8-8z"
                      transform="scale(-1,1) translate(-24,0)"
                    />
                  </svg>
                </Link>
              </motion.div>
            </motion.div>

            {/* Right: Visual */}
            <div className="hidden md:block">
              <PhonePushMock />
            </div>
          </div>
        </div>
      </header>

      {/* ───────── USP PERSONAS ───────── */}
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
                title: "Für Nutzer",
                lead: "Nichts mehr suchen.",
                text: "Nur Angebote, die genau jetzt passen – am Ort, zur Zeit, mit deinen Interessen.",
                cta: { label: "So funktioniert’s", href: "#how" },
              },
              {
                title: "Für Anbieter",
                lead: "Sichtbar im richtigen Moment.",
                text: "Erreiche Menschen, die gerade in der Nähe sind. Null Streuverlust, volle Relevanz.",
                cta: { label: "Jetzt starten", href: "/register" },
              },
              {
                title: "Für Investoren",
                lead: "Skalierbar & datengetrieben.",
                text: "Event-Streams (Enter/Exit/Heartbeat), Privacy-by-Design, klare Unit-Economics.",
                cta: { label: "Pitch ansehen", href: "/pitch" },
              },
            ].map((f, i) => (
              <motion.div
                key={i}
                className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition"
                whileHover={{ y: -3, transition: { duration: 0.2 } }}
                {...fadeUp(0.05 * i)}
              >
                <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-700 grid place-items-center mb-4">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <circle cx="6" cy="12" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="18" cy="12" r="2" />
                  </svg>
                </div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{f.title}</p>
                <h3 className="mt-1 text-lg font-semibold">{f.lead}</h3>
                <p className="mt-2 text-gray-600">{f.text}</p>
                <div className="mt-4">
                  <Link
                    to={f.cta.href}
                    className="text-sm text-blue-700 group-hover:text-blue-800 transition"
                    title={f.cta.label}
                  >
                    {f.cta.label} →
                  </Link>
                </div>
              </motion.div>
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
                    title: "Interessen & Radius",
                    text: "Definiere Interessen, Ort und Radius – oder richte ein Angebot ein.",
                  },
                  {
                    step: "02",
                    title: "Zeitfenster aktivieren",
                    text: "Mittags, abends oder flexibel – du bestimmst, wann es relevant ist.",
                  },
                  {
                    step: "03",
                    title: "Automatisch gefunden werden",
                    text: "Wir benachrichtigen nur passende Personen in der Nähe – ohne Suche.",
                  },
                ].map((s, i) => (
                  <motion.li key={i} className="flex gap-4" {...fadeUp(0.05 * i)}>
                    <div className="shrink-0 h-10 w-10 rounded-xl bg-blue-600 text-white grid place-items-center font-bold">
                      {s.step}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{s.title}</h3>
                      <p className="text-gray-600">{s.text}</p>
                    </div>
                  </motion.li>
                ))}
              </ol>

              <motion.div className="mt-8 flex flex-wrap gap-3" {...fadeUp(0.2)}>
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
              </motion.div>
            </div>

            {/* Glass Card – Live-Beispiel */}
            <motion.div className="relative" {...fadeUp(0.1)}>
              <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-lg">
                <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
                  <p className="text-sm font-semibold text-blue-700">Live-Beispiel</p>
                  <p className="mt-2 text-gray-700">
                    „Heute <b>11–14 Uhr</b> frische Pasta – <b>10 %</b> für alle in <b>150 m</b>.“
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

              {/* Floating Admin Demo button on mobile */}
              <Link
                to="/admin/offers"
                className="md:hidden fixed right-4 bottom-4 z-40 rounded-full bg-blue-600 px-4 py-3 text-white font-semibold shadow-lg hover:bg-blue-700 transition"
                title="Admin-Demo: Angebote auf der Karte"
              >
                Admin-Demo
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ───────── MINI-KPI / PRIVACY STRIP ───────── */}
      <section className="py-8 bg-gray-900">
        <div className="max-w-7xl mx-auto px-6 text-gray-100">
          <div className="grid sm:grid-cols-3 gap-6 text-sm">
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Echtzeit-Matching im Millisekunden-Bereich
            </div>
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-sky-400" />
              DSGVO-konform • Privacy-by-Design
            </div>
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              Event-Modell: Enter / Exit / Heartbeat
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-300">
            Wir tracken keine Wege. Wir triggern nur kontextuelle Ereignisse.
          </p>
        </div>
      </section>

      {/* ───────── PROVIDER ROI ───────── */}
      <section id="trust" className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h3 className="text-2xl md:text-3xl font-extrabold">
            Zeig dich genau dann, wenn Kund:innen <span className="text-blue-700">vorbeikommen</span>.
          </h3>
          <p className="mt-3 text-gray-600 max-w-2xl mx-auto">
            Perfekt für Gastronomie, lokale Shops, Services und Events – zeitlich limitiert,
            ortsgenau und ohne Streuverlust.
          </p>

          <div className="mt-8 grid sm:grid-cols-3 gap-4 text-left max-w-4xl mx-auto">
            {[
              "Nur Personen im definierten Radius & Zeitfenster",
              "Null Streuverlust – nur Relevanz",
              "Selbstverwaltete Kampagnen in Minuten",
            ].map((b, i) => (
              <motion.div
                key={i}
                className="rounded-xl border border-gray-200 bg-white p-4"
                whileHover={{ scale: 1.01 }}
                transition={{ type: "spring", stiffness: 250, damping: 20 }}
              >
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-blue-600" />
                  <p className="text-gray-800">{b}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div className="mt-8 flex flex-wrap justify-center gap-3" {...fadeUp(0.05)}>
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
          </motion.div>
        </div>
      </section>

      {/* ───────── PITCH STRIP ───────── */}
      <section className="py-8 bg-blue-900">
        <div className="max-w-7xl mx-auto px-6 text-white">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-lg font-semibold">
              Die Infrastruktur für <span className="opacity-90">Zero-Search</span> in der realen Welt.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/pitch"
                className="rounded-full bg-white/10 px-5 py-2 font-semibold hover:bg-white/15 transition"
              >
                Pitch ansehen
              </Link>
              <Link
                to="/admin/offers"
                className="rounded-full bg-white/10 px-5 py-2 font-semibold hover:bg-white/15 transition"
              >
                Tech-Demo (Karte)
              </Link>
              <Link
                to="/register"
                className="rounded-full bg-white text-blue-900 px-5 py-2 font-semibold hover:bg-gray-100 transition"
              >
                Anbieter: Jetzt starten
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── FOOTER ───────── */}
      <footer className="mt-auto bg-gray-100 py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-3">
            <img src={logoIcon} alt="StepsMatch Logo" className="h-7 w-7 rounded-md" />
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
};

export default LandingPage;
