// frontend/src/pages/WhyStepsMatch.jsx
import React from "react";
import { Link } from "react-router-dom";
import { Helmet } from "@dr.pogodin/react-helmet";
import { motion } from "motion/react";
import Navbar from "../components/Navbar";
import logoIcon from "../assets/stepsmatch-icon.svg";
import heroBg from "../assets/hero-bg-pitch2.jpg";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut", delay } },
});

export default function WhyStepsMatch() {
  const title = "Warum StepsMatch – Klar & auf den Punkt";
  const description =
    "Welche Probleme StepsMatch für Nutzer und Anbieter löst, unser USP – und echte Beispiele aus dem Alltag.";

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
      </Helmet>

      {/* Navbar wie gewohnt */}
      <Navbar />

      {/* Breadcrumplink zurück zur Home (externer Link gewünscht) */}
      <div className="bg-blue-50/60 border-b border-blue-100">
        <div className="max-w-7xl mx-auto px-6 py-2 text-sm">
          <a
            href="https://www.stepsmatch.com/home"
            className="inline-flex items-center gap-2 font-semibold text-blue-800 hover:text-blue-900"
            title="Zur Startseite"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 4l1.41 1.41L8.83 10H21v2H8.83l4.58 4.59L12 18l-8-8 8-8z" />
            </svg>
            Zur Startseite
          </a>
        </div>
      </div>

      {/* HERO */}
      <header
        className="relative w-full bg-cover bg-center"
        style={{ backgroundImage: `url(${heroBg})` }}
        aria-label="Hintergrundbild Stadt"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/65 to-black/85" />
        <div className="relative max-w-7xl mx-auto px-6 pt-20 pb-16">
          <motion.div className="max-w-3xl" {...fadeUp(0.05)}>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90 ring-1 ring-white/20 backdrop-blur">
              <img src={logoIcon} alt="StepsMatch" className="h-4 w-4 rounded-sm" />
              StepsMatch
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Zero-Search • DSGVO
            </span>

            {/* Slogan mit dezenter Premium-Betonung */}
            <motion.h1
              className="mt-4 text-[2.6rem] leading-[1.05] md:text-6xl font-black tracking-tight text-white"
              {...fadeUp(0.1)}
            >
              <span
                className="inline-block bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    "linear-gradient(90deg,#a7f3d0,#93c5fd,#a5b4fc,#93c5fd,#a7f3d0)",
                  backgroundSize: "200% 100%",
                  animation: "shimmer 6s linear infinite alternate",
                }}
              >
                Finden.
              </span>{" "}
              <span className="text-white/90">Nicht suchen.</span>
            </motion.h1>

            <motion.p
              className="mt-4 text-white/85 text-lg md:text-xl max-w-2xl"
              {...fadeUp(0.16)}
            >
              Wir melden uns nur, wenn gerade in deiner Nähe etwas wirklich passt. Kein Scrollen.
              Kein Spam. Nur Relevanz – in Echtzeit.
            </motion.p>
          </motion.div>
        </div>
      </header>

      {/* Key pains & USP */}
      <section className="py-14 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Für Nutzer – Pain */}
            <motion.div
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
              {...fadeUp(0.05)}
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Für Nutzer
              </p>
              <h2 className="mt-1 text-xl font-bold">Welchen Pain lösen wir?</h2>
              <ul className="mt-3 space-y-2 text-gray-700">
                <li>• Endlose Suche nach etwas Passendem in der Nähe.</li>
                <li>• Zu viel Rauschen: unpassende Angebote, falsches Timing.</li>
                <li>• Fehlende Orientierung: Wo soll ich jetzt hin?</li>
              </ul>
              <div className="mt-4 rounded-xl bg-blue-50 border border-blue-100 p-3 text-sm text-blue-900">
                Ergebnis: Du wirst <b>gefunden</b>, wenn Ort × Zeit × Interesse zusammenpassen.
              </div>
            </motion.div>

            {/* Für Anbieter – Pain */}
            <motion.div
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
              {...fadeUp(0.1)}
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Für Anbieter
              </p>
              <h2 className="mt-1 text-xl font-bold">Welchen Pain lösen wir?</h2>
              <ul className="mt-3 space-y-2 text-gray-700">
                <li>• Streuverlust: richtige Menschen nicht im richtigen Moment.</li>
                <li>• Komplexe Kampagnen, wenig Transparenz über Wirkung.</li>
                <li>• Keine schnelle Brücke vom Angebot zum Eintreten.</li>
              </ul>
              <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-sm text-emerald-900">
                Ergebnis: <b>Moment-of-Need</b> statt Gießkanne. Messbar, lokal, sofort.
              </div>
            </motion.div>

            {/* USP */}
            <motion.div
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
              {...fadeUp(0.15)}
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Unser USP
              </p>
              <h2 className="mt-1 text-xl font-bold">Warum einzigartig?</h2>
              <ul className="mt-3 space-y-2 text-gray-700">
                <li>• <b>Zero-Search:</b> Push nur, wenn es wirklich passt.</li>
                <li>• <b>Echtzeit:</b> Geofence-Enter → Benachrichtigung in ≤ 30 s.</li>
                <li>• <b>Privacy-by-Design:</b> keine Wege-Tracks, nur Ereignisse.</li>
                <li>• <b>Von lokal zu Umsatz:</b> Angebot → Route → Ankunft – messbar.</li>
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Beispiele */}
      <section className="py-4 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <h3 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            So fühlt sich StepsMatch im Alltag an
          </h3>

          {/* Beispiel 1 */}
          <div className="mt-6 grid lg:grid-cols-2 gap-6 items-stretch">
            <motion.div
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
              {...fadeUp(0.05)}
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Beispiel · Gastronomie
              </p>
              <h4 className="mt-1 text-xl font-bold">„Italienisch? Genau jetzt um die Ecke.“</h4>
              <p className="mt-2 text-gray-700">
                Du hast das Interesse <b>„Italienisches Restaurant“</b> gewählt. StepsMatch prüft im
                Hintergrund deine Nähe – ganz ohne Suche.
              </p>

              <ol className="mt-4 space-y-3 text-gray-800">
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
                  <span>
                    Push erscheint: „<b>120 m</b> entfernt: <b>Trattoria Roma</b> – heute Mittagsmenü,
                    ideal für dich.“
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-blue-500" />
                  <span>Tippen → <b>Schritt-für-Schritt-Navigation</b> startet.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-amber-500" />
                  <span>Ankunft – Angebot eingelöst. Kein Suchen, kein Verpassen.</span>
                </li>
              </ol>
            </motion.div>

            {/* Visual / Timeline Card */}
            <motion.div
              className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 shadow-sm"
              {...fadeUp(0.1)}
            >
              <p className="text-sm font-semibold text-blue-800">Flow (vereinfachtes Live-Beispiel)</p>
              <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-xl bg-white p-3 border border-gray-200">
                  <p className="font-semibold">Interesse</p>
                  <p className="text-gray-600">Italienisch</p>
                </div>
                <div className="rounded-xl bg-white p-3 border border-gray-200">
                  <p className="font-semibold">Distanz</p>
                  <p className="text-gray-600">120 m</p>
                </div>
                <div className="rounded-xl bg-white p-3 border border-gray-200">
                  <p className="font-semibold">Aktion</p>
                  <p className="text-gray-600">Navi starten</p>
                </div>
              </div>
              <div className="mt-5 flex items-center gap-2 text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Aktiv – wird bei Geofence-Enter automatisch getriggert
              </div>
            </motion.div>
          </div>

          {/* Beispiel 2 */}
          <div className="mt-6 grid lg:grid-cols-2 gap-6 items-stretch">
            <motion.div
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
              {...fadeUp(0.1)}
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Beispiel · Nightlife
              </p>
              <h4 className="mt-1 text-xl font-bold">
                „Happy Hour 22–24 Uhr – 3 für 2. Jetzt abbiegen?“
              </h4>
              <p className="mt-2 text-gray-700">
                Eine Studierenden-Gruppe hat Interessen wie <b>Nightlife</b>, <b>Happy Hour</b> und{" "}
                <b>Sonderaktionen</b> gesetzt. Sie sind unterwegs ins nächste Lokal …
              </p>

              <ol className="mt-4 space-y-3 text-gray-800">
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
                  <span>
                    Push poppt auf: „<b>Happy Hour 22–24 Uhr</b> · <b>3 Getränke = 2 zahlen</b> ·{" "}
                    <b>200 m</b> rechts.“
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-blue-500" />
                  <span>Interesse + Zeitfenster + Nähe stimmen → <b>Navi</b> zum Angebot.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-amber-500" />
                  <span>
                    Gruppe entscheidet sich um – <b>wertvoller Zusatzumsatz</b> für das Lokal durch
                    StepsMatch.
                  </span>
                </li>
              </ol>
            </motion.div>

            <motion.div
              className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-6 shadow-sm"
              {...fadeUp(0.15)}
            >
              <p className="text-sm font-semibold text-amber-900">KPIs, die zählen</p>
              <ul className="mt-3 space-y-2 text-amber-900/90 text-sm">
                <li>• Zugestellt → Route gestartet → Angekommen</li>
                <li>• Conversion je Zeitfenster & Distanz</li>
                <li>• Relevanz-Score (Interesse × Timing)</li>
              </ul>
              <div className="mt-5 rounded-xl bg-white p-3 border border-amber-200 text-sm">
                Transparent & DSGVO-konform: keine Wege-Tracks, nur Events.
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 bg-blue-900">
        <div className="max-w-7xl mx-auto px-6 text-white">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-lg font-semibold">
              Bereit für Zero-Search im echten Leben?
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/register"
                className="rounded-full bg-white text-blue-900 px-6 py-3 font-semibold hover:bg-gray-100 transition"
              >
                Anbieter: Jetzt starten
              </Link>
              <Link
                to="/admin/offers"
                className="rounded-full bg-white/10 px-6 py-3 font-semibold hover:bg-white/15 transition"
              >
                Tech-Demo (Karte)
              </Link>
              <Link
                to="/pitch"
                className="rounded-full bg-white/10 px-6 py-3 font-semibold hover:bg-white/15 transition"
              >
                Pitch ansehen
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer kompakt */}
      <footer className="bg-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-6 text-sm text-gray-600 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src={logoIcon} alt="StepsMatch Logo" className="h-7 w-7 rounded-md" />
            <span>© {new Date().getFullYear()} stepsmatch.com</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://www.stepsmatch.com/home" className="hover:text-gray-900">Home</a>
            <Link to="/login" className="hover:text-gray-900">Login</Link>
            <Link to="/register" className="hover:text-gray-900">Registrieren</Link>
            <Link to="/admin/offers" className="hover:text-gray-900">Admin-Demo</Link>
          </div>
        </div>
      </footer>

      {/* Shimmer Keyframes (scoped) */}
      <style>{`
        @keyframes shimmer {
          0% { background-position-x: 0%; }
          100% { background-position-x: 100%; }
        }
      `}</style>
    </div>
  );
}
