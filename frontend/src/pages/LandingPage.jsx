import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Helmet } from "@dr.pogodin/react-helmet";
import { QRCodeCanvas } from "qrcode.react";
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  Clock3,
  Compass,
  EyeOff,
  Footprints,
  Map,
  MapPin,
  Radio,
  Route,
  ShieldCheck,
  Store,
} from "lucide-react";

import Navbar from "../components/Navbar";
import SiteFooter from "../components/SiteFooter";
import { getPreferredSiteText } from "../content/siteContent";
import heroCity from "../assets/hero-city-daylight.jpg";

const userSteps = [
  {
    title: "Interessen wählen",
    text: "Du legst fest, welche Hinweise für dich grundsätzlich relevant sind.",
    icon: CheckCircle2,
  },
  {
    title: "App ruhig laufen lassen",
    text: "StepsMatch bleibt im Hintergrund und drängt sich nicht in den Vordergrund.",
    icon: EyeOff,
  },
  {
    title: "Hinweis bekommen",
    text: "Du wirst informiert, wenn Ort, Radius, Zeit und Interesse zusammenpassen.",
    icon: BellRing,
  },
];

const differencePoints = [
  "Kein ständiges Blättern",
  "Kein Dauerfeuer an Werbung",
  "Kein alles für alle",
  "Relevanz im richtigen Moment",
  "Lokale Nähe statt Angebotslärm",
];

const providerSteps = [
  "Stammdaten angeben",
  "Standort prüfen",
  "Hinweis oder Angebot erstellen",
  "Radius und Laufzeit festlegen",
  "Vorschau prüfen",
  "Veröffentlichen oder zur Prüfung einreichen",
];

const contentTypes = [
  {
    title: "Verifizierter Anbieter",
    text: "Ein lokaler Anbieter mit geprüften Stammdaten und klar zugeordnetem Standort.",
  },
  {
    title: "Öffentlicher Spot",
    text: "Ein Ort, der öffentlich relevant sein kann, etwa für Orientierung oder Alltag.",
  },
  {
    title: "Allgemeiner Ortshinweis",
    text: "Ein neutraler Hinweis ohne Verkaufsversprechen und ohne Partner-Claim.",
  },
  {
    title: "Demo-Hinweis",
    text: "Ein klar markierter Testinhalt, der nie wie ein echtes Angebot wirken darf.",
  },
];

function ApkModal({ open, onClose, apkUrl, text, onDontShowAgain }) {
  if (!open) return null;
  const qrValue = `${apkUrl}${apkUrl.includes("?") ? "&" : "?"}src=qr`;

  return (
    <div className="fixed inset-0 z-[120] grid place-items-end bg-slate-900/60 p-3 sm:place-items-center sm:p-6" role="dialog" aria-modal="true">
      <div className="sm-card w-full max-w-xl p-6 sm:p-8 sm-rise">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="sm-badge">App testen</p>
            <h3 className="mt-3 text-2xl font-extrabold">StepsMatch auf dem Handy prüfen</h3>
            <p className="mt-2 text-sm text-slate-700 sm:text-base">
              Scanne den QR-Code oder lade die App direkt herunter. In der PRE ALPHA prüfen wir, wie zuverlässig lokale Hinweise auf echten Geräten funktionieren.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Schließen
          </button>
        </div>

        <div className="mt-5 grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="mx-auto rounded-lg border border-slate-200 bg-white p-3 sm:mx-0">
            <QRCodeCanvas value={qrValue} size={180} includeMargin level="M" />
          </div>
          <div>
            <p className="text-sm text-slate-700">Option A: Kamera öffnen und QR-Code scannen</p>
            <a href={apkUrl} className="sm-btn-primary mt-3 !w-full gap-2 sm:!w-auto" target="_blank" rel="noreferrer">
              {text.brand.appDownloadLabel}
            </a>
            <p className="mt-3 text-xs text-slate-600">Android: Installation aus dieser Quelle einmal erlauben.</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={onDontShowAgain} className="text-sm font-semibold text-slate-600 underline-offset-4 hover:underline">
            Nicht mehr anzeigen
          </button>
          <button type="button" onClick={onClose} className="sm-btn-secondary">
            Weiter
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const text = React.useMemo(() => getPreferredSiteText(), []);
  const location = useLocation();
  const [apkOpen, setApkOpen] = React.useState(false);

  React.useEffect(() => {
    try {
      const params = new URLSearchParams(location.search);
      const fromQuery = params.get("apk") === "1";
      const modalSeen = localStorage.getItem("apkModalSeen") === "1";

      if (fromQuery) {
        setApkOpen(true);
        params.delete("apk");
        const newSearch = params.toString();
        const newUrl = `${location.pathname}${newSearch ? `?${newSearch}` : ""}${location.hash || ""}`;
        window.history.replaceState({}, "", newUrl);
        return;
      }

      if (!modalSeen && params.get("openApk") === "1") setApkOpen(true);
    } catch {
      // ignore
    }
  }, [location.pathname, location.search, location.hash]);

  return (
    <div className="sm-page">
      <Helmet>
        <title>{text.landing.title}</title>
        <meta name="description" content={text.landing.description} />
        <link rel="canonical" href="https://www.stepsmatch.com/" />
      </Helmet>

      <div className="sm-stack">
        <Navbar />

        <header className="relative overflow-hidden border-b border-white/20 bg-slate-950">
          <img src={heroCity} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,13,25,0.92)_0%,rgba(10,23,39,0.78)_48%,rgba(10,23,39,0.34)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-slate-950/70 to-transparent" />

          <section className="sm-shell relative z-10 grid min-h-[82vh] items-center gap-8 py-12 lg:grid-cols-[minmax(0,1fr)_390px] lg:py-16">
            <div className="max-w-4xl text-white sm-rise">
              <p className="sm-badge !border-white/30 !bg-white/10 !text-white">PRE ALPHA · Raum Graz im Aufbau</p>
              <h1 className="mt-6 max-w-3xl text-5xl font-black leading-[0.92] sm:text-6xl lg:text-8xl">
                Angebote finden dich.
              </h1>
              <p className="mt-5 max-w-2xl text-lg font-semibold leading-relaxed text-white/92 sm:text-2xl">
                StepsMatch läuft ruhig im Hintergrund und meldet sich nur, wenn in deiner Nähe etwas zu dir passt.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <button onClick={() => setApkOpen(true)} className="sm-btn-primary gap-2">
                  App testen <ArrowRight size={16} />
                </button>
                <Link to="/anbieter" className="sm-btn-secondary gap-2">
                  Anbieter werden <Store size={16} />
                </Link>
                <Link to="/so-funktionierts" className="sm-btn-ghost gap-2">
                  So funktioniert es <Compass size={16} />
                </Link>
              </div>

              <p className="mt-6 max-w-2xl text-sm font-semibold uppercase tracking-[0.08em] text-[var(--sm-accent)]">
                Ruhige Hinweise. Klare Nähe. Keine dauernde Werbung.
              </p>
            </div>

            <aside className="sm-match-panel sm-rise sm-delay-1" aria-label="StepsMatch Signal">
              <div className="sm-match-radar">
                <div className="sm-match-ring sm-match-ring-1" />
                <div className="sm-match-ring sm-match-ring-2" />
                <div className="sm-match-ring sm-match-ring-3" />
                <div className="sm-match-center">
                  <MapPin size={22} />
                  <span>Hier</span>
                </div>
                <div className="sm-match-node sm-match-node-interest">
                  <Footprints size={16} />
                  <span>Interesse</span>
                </div>
                <div className="sm-match-node sm-match-node-offer">
                  <Clock3 size={16} />
                  <span>Hinweis aktiv</span>
                </div>
              </div>
              <div className="mt-5 grid gap-2">
                {["Ort passt", "Radius passt", "Zeit passt", "Interesse passt"].map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm font-bold text-white/90">
                    <span className="h-2 w-2 rounded-full bg-[var(--sm-accent)]" />
                    {item}
                  </div>
                ))}
              </div>
            </aside>
          </section>
        </header>

        <section id="so-funktionierts" className="sm-shell py-10 sm:py-14">
          <div className="sm-card p-7 sm:p-9 sm-rise">
            <p className="sm-badge">So funktioniert StepsMatch</p>
            <h2 className="sm-section-title mt-4">Drei einfache Schritte.</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {userSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <article key={step.title} className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-900 text-[var(--sm-accent)]">
                      <Icon size={18} />
                    </div>
                    <p className="mt-4 text-sm font-bold uppercase tracking-[0.08em] text-slate-500">Schritt {index + 1}</p>
                    <h3 className="mt-1 text-xl font-extrabold text-slate-950">{step.title}</h3>
                    <p className="mt-2 text-slate-700">{step.text}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="sm-shell pb-10 sm:pb-14">
          <div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
            <div className="sm-card-strong p-7 sm:p-9 sm-rise">
              <p className="sm-chip">Warum anders?</p>
              <h2 className="mt-4 text-3xl font-extrabold leading-tight sm:text-4xl">Nicht gebaut für Angebotslärm.</h2>
              <p className="mt-4 text-blue-50 sm:text-lg">
                StepsMatch ist nicht dafür gebaut, dich ständig mit Angeboten zu beschäftigen. Es ist dafür gebaut,
                dich im richtigen Moment auf etwas Relevantes in deiner Nähe hinzuweisen.
              </p>
            </div>
            <div className="sm-card p-7 sm:p-9 sm-rise sm-delay-1">
              <div className="grid gap-3 sm:grid-cols-2">
                {differencePoints.map((point) => (
                  <div key={point} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800">
                    <ShieldCheck size={16} className="text-[var(--sm-teal)]" />
                    {point}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="pre-alpha" className="sm-shell pb-10 sm:pb-14">
          <div className="sm-card-soft p-7 sm:p-9 sm-rise">
            <p className="sm-badge">PRE ALPHA transparent</p>
            <h2 className="sm-section-title mt-4">Raum Graz im Aufbau.</h2>
            <p className="sm-section-copy">
              StepsMatch ist derzeit eine PRE ALPHA im Raum Graz. Der technische Kern funktioniert: Die App kann im
              Hintergrund laufen und dich benachrichtigen, wenn in deiner Nähe ein passender Hinweis aktiv ist. Jetzt
              bauen wir gemeinsam die regionale Datenbasis, bessere Anbieter-Flows und ein verlässliches Beta-Erlebnis auf.
            </p>
          </div>
        </section>

        <section id="anbieter" className="sm-shell pb-10 sm:pb-14">
          <div className="sm-card p-7 sm:p-9 sm-rise">
            <p className="sm-badge">
              <Store size={14} /> Für Anbieter
            </p>
            <h2 className="sm-section-title mt-4">Erreiche Menschen, wenn dein Ort gerade relevant ist.</h2>
            <p className="sm-section-copy">
              Anbieter können Hinweise oder Angebote mit Standort, Radius, Laufzeit und klaren Bedingungen veröffentlichen.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {providerSteps.map((step, index) => (
                <div key={step} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">{String(index + 1).padStart(2, "0")}</p>
                  <p className="mt-2 text-lg font-extrabold text-slate-900">{step}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-950">
              StepsMatch verspricht keine Verkäufe und keine garantierten Besuche. StepsMatch hilft dabei, relevante
              Hinweise im passenden lokalen Moment sichtbar zu machen.
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/register" className="sm-btn-primary gap-2">
                Anbieter werden <ArrowRight size={16} />
              </Link>
              <Link to="/login" className="sm-btn-secondary">Anbieter Login</Link>
            </div>
          </div>
        </section>

        <section id="inhalte" className="sm-shell pb-10 sm:pb-14">
          <div className="sm-card p-7 sm:p-9 sm-rise">
            <p className="sm-badge">
              <Map size={14} /> Beta-Datenstrategie
            </p>
            <h2 className="sm-section-title mt-4">Inhalte müssen klar gekennzeichnet sein.</h2>
            <p className="sm-section-copy">
              In der PRE ALPHA können unterschiedliche Arten lokaler Inhalte vorkommen. Demo-Hinweise wirken nie wie echte
              Angebote, und es gibt keine Partner-Claims ohne Prüfung.
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {contentTypes.map((item) => (
                <article key={item.title} className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                  <Radio size={18} className="text-[var(--sm-route)]" />
                  <h3 className="mt-3 text-lg font-extrabold">{item.title}</h3>
                  <p className="mt-2 text-sm text-slate-700">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="sm-shell pb-16 sm:pb-20">
          <div className="sm-card-strong p-7 sm:p-10 sm-rise">
            <p className="sm-chip">StepsMatch</p>
            <h2 className="mt-4 text-3xl font-extrabold sm:text-4xl">Ein ruhiger Hinweis, wenn Nähe und Interesse passen.</h2>
            <p className="mt-3 max-w-3xl text-blue-50 sm:text-lg">
              Der aktuelle MVP-Kern ist verifiziert. Die Website bereitet jetzt die Beta-Kommunikation vor.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={() => setApkOpen(true)} className="sm-btn-secondary gap-2">
                App testen <Route size={16} />
              </button>
              <Link to="/pre-alpha" className="sm-btn-ghost">PRE ALPHA lesen</Link>
              <Link to="/datenschutz-standort" className="sm-btn-ghost">Standort & Datenschutz</Link>
            </div>
          </div>
        </section>

        <SiteFooter />
      </div>

      <ApkModal
        open={apkOpen}
        onClose={() => setApkOpen(false)}
        onDontShowAgain={() => {
          try {
            localStorage.setItem("apkModalSeen", "1");
          } catch {
            // ignore
          }
          setApkOpen(false);
        }}
        text={text}
        apkUrl={text.brand.appDownloadUrl}
      />
    </div>
  );
}
