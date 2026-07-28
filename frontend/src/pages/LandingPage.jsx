import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import { Helmet } from "@dr.pogodin/react-helmet";
import { QRCodeCanvas } from "qrcode.react";
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  Clock3,
  EyeOff,
  Map,
  MapPin,
  Radio,
  Route,
  ShieldCheck,
  Store,
  X,
} from "lucide-react";

import Navbar from "../components/Navbar";
import SiteFooter from "../components/SiteFooter";
import TesterKeyRequestForm from "../components/TesterKeyRequestForm";
import { getPreferredSiteText } from "../content/siteContent";
import heroCity from "../assets/hero-city-daylight.jpg";
import heroRelevantMatch from "../assets/stepsmatch-hero-relevant-match.png";
import userFlowComic from "../assets/stepsmatch-user-flow-comic.png";
import providerFlowComic from "../assets/stepsmatch-provider-flow-comic.png";

const TESTER_ACCESS_KEY = String(import.meta.env.VITE_TESTER_ACCESS_KEY || "PREALPHA-DEMO").trim().toUpperCase();
const APK_ACCESS_STORAGE_KEY = "stepsmatchTesterAccessAccepted";
const SUPPORT_MODAL_STORAGE_KEY = "stepsmatchTesterModalDismissedV1";

function hasAcceptedTesterAccess() {
  try {
    return localStorage.getItem(APK_ACCESS_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

const userSteps = [
  {
    title: "Interessen wählen",
    text: "Zum Beispiel günstig essen, Kaffee, Nahversorgung, Freizeit oder lokale Services.",
    icon: CheckCircle2,
  },
  {
    title: "App laufen lassen",
    text: "Die App kann im Hintergrund bleiben. Du musst nicht ständig selbst suchen.",
    icon: EyeOff,
  },
  {
    title: "Passenden Hinweis erhalten",
    text: "Nur wenn Interesse, Ort und Zeitfenster passen, kann StepsMatch informieren.",
    icon: BellRing,
  },
  {
    title: "Details ansehen und hinfinden",
    text: "Angebot öffnen, Karte ansehen und Route starten.",
    icon: Route,
  },
];

const providerSteps = [
  {
    title: "Angebot anlegen",
    text: "Mittagsmenü, Service, Aktion, Hinweis oder lokaler Vorteil.",
  },
  {
    title: "Radius festlegen",
    text: "Zum Beispiel 200 m rund um das eigene Geschäft.",
  },
  {
    title: "Laufzeit bestimmen",
    text: "Datum, Wochentage und Uhrzeit passend zum Angebot festlegen.",
  },
  {
    title: "Passende Menschen erreichen",
    text: "Nur Nutzer mit passendem Interesse im gültigen Radius werden informiert.",
  },
];

const differencePoints = [
  "Kein ständiges Blättern",
  "Kein Dauerfeuer an Werbung",
  "Kein alles für alle",
  "Relevanz im richtigen Moment",
  "Lokale Nähe statt Angebotslärm",
];

const corePillars = [
  {
    title: "Näher dran",
    text: "Ein Hinweis wird relevant, wenn du wirklich im passenden Radius bist.",
    icon: MapPin,
  },
  {
    title: "Im richtigen Moment",
    text: "Zeitfenster und Gültigkeit halten unpassende Hinweise zurück.",
    icon: Clock3,
  },
  {
    title: "Ruhig informiert",
    text: "Push soll dich auch ohne geöffnete App erreichen – nicht alles und überall.",
    icon: BellRing,
  },
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

function SupportRecruitmentModal({ open, onDismissPermanently, onCloseTemporarily }) {
  const dialogRef = React.useRef(null);
  const previouslyFocusedRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) return undefined;

    previouslyFocusedRef.current = document.activeElement;
    const root = document.getElementById("root");
    const previousOverflow = document.body.style.overflow;
    const previousInert = root?.inert;
    const previousAriaHidden = root?.getAttribute("aria-hidden");

    if (root) {
      root.inert = true;
      root.setAttribute("aria-hidden", "true");
    }
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      dialogRef.current?.querySelector("button")?.focus();
    }, 0);

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onDismissPermanently();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll(
        'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (root) {
        root.inert = previousInert;
        if (previousAriaHidden === null) root.removeAttribute("aria-hidden");
        else root.setAttribute("aria-hidden", previousAriaHidden);
      }
      previouslyFocusedRef.current?.focus?.();
    };
  }, [onDismissPermanently, open]);

  if (!open) return null;

  const dismissFromAction = () => {
    onDismissPermanently();
  };

  return createPortal(
    <div
      className="sm-support-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onDismissPermanently();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="support-modal-title"
        aria-describedby="support-modal-description"
        className="sm-card sm-support-modal"
      >
        <div className="sticky top-0 z-10 -mx-5 -mt-5 flex items-start justify-between gap-4 bg-white/95 px-5 pb-3 pt-5 backdrop-blur sm:-mx-8 sm:-mt-8 sm:px-8 sm:pb-4 sm:pt-8">
          <div>
            <p className="sm-badge">PRE ALPHA</p>
            <h2 id="support-modal-title" className="mt-3 text-2xl font-extrabold leading-tight sm:text-3xl">
              StepsMatch sucht Tester und Anbieter
            </h2>
          </div>
          <button
            type="button"
            onClick={onDismissPermanently}
            className="shrink-0 rounded-md border border-slate-300 bg-white p-2 text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--sm-accent-strong)]"
            aria-label="Dialog schließen"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div id="support-modal-description" className="mt-4 space-y-4 text-base leading-relaxed text-slate-700">
          <p>Hilf uns, die StepsMatch-App zu testen – als Nutzer oder als Anbieter.</p>
          <p>ecily.com hat eine starke technische Basis geschaffen. Jetzt brauchen wir Menschen, die StepsMatch im echten Alltag ausprobieren, Rückmeldungen geben und erste Angebote testen.</p>
          <p>Die ersten 100 aktiven Unterstützer erhalten einen persönlichen StepsMatch Lifetime Pass. Die genauen Leistungen und Bedingungen werden vor der Vergabe transparent bestätigt.</p>
          <p>Danke für deine Unterstützung.</p>
        </div>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link to="/tester" onClick={dismissFromAction} className="sm-btn-primary justify-center">
            App testen
          </Link>
          <Link to="/#anbieter" onClick={dismissFromAction} className="sm-btn-secondary justify-center">
            Als Anbieter helfen
          </Link>
        </div>
        <button type="button" onClick={onCloseTemporarily} className="mt-4 self-center text-sm font-semibold text-slate-600 underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--sm-accent-strong)]">
          Später
        </button>
      </div>
    </div>,
    document.body
  );
}

function ApkModal({ open, onClose, apkUrl, text, onDontShowAgain }) {
  const [key, setKey] = React.useState("");
  const [ndaAccepted, setNdaAccepted] = React.useState(false);
  const [accessAccepted, setAccessAccepted] = React.useState(hasAcceptedTesterAccess);
  const [error, setError] = React.useState("");
  if (!open) return null;

  const handleAccessCheck = (event) => {
    event.preventDefault();
    setError("");
    const normalizedKey = key.trim().toUpperCase();
    if (!normalizedKey) return setError("Bitte gib deinen Tester-Key ein.");
    if (!ndaAccepted) return setError("Bitte bestätige die Vertraulichkeit.");
    if (normalizedKey !== TESTER_ACCESS_KEY) return setError("Tester-Key nicht erkannt.");
    try {
      localStorage.setItem(APK_ACCESS_STORAGE_KEY, "1");
      localStorage.setItem(`${APK_ACCESS_STORAGE_KEY}At`, new Date().toISOString());
    } catch {
      // Current-session access remains available if browser storage is blocked.
    }
    setAccessAccepted(true);
  };

  const qrValue = `${apkUrl}${apkUrl.includes("?") ? "&" : "?"}src=qr`;

  if (!accessAccepted) {
    return (
      <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-slate-900/60 p-2 sm:items-center sm:p-4" role="dialog" aria-modal="true">
        <div className="sm-card my-1 flex max-h-[calc(100vh-1rem)] w-full max-w-xl flex-col overflow-hidden p-4 sm:my-4 sm:max-h-[calc(100vh-2rem)] sm:p-6">
          <div className="flex shrink-0 items-start justify-between gap-3">
            <div>
              <p className="sm-badge">App testen</p>
              <h3 className="mt-3 text-2xl font-extrabold">StepsMatch Pre-Alpha testen</h3>
              <p className="mt-2 text-sm text-slate-700 sm:text-base">Die Android-App ist derzeit nur für freigegebene Tester verfügbar. Bitte gib deinen Tester-Key ein und bestätige die Vertraulichkeit, bevor du den Download öffnest.</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Schließen</button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <form onSubmit={handleAccessCheck} className="mt-5 space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div>
                <label htmlFor="apk-tester-key" className="sm-label">Tester-Key</label>
                <input id="apk-tester-key" value={key} onChange={(event) => setKey(event.target.value)} className="sm-input uppercase tracking-wide" placeholder="z. B. PREALPHA-DEMO" autoComplete="off" />
              </div>
              <label htmlFor="apk-nda" className="flex items-start gap-3 text-sm leading-relaxed text-slate-700">
                <input id="apk-nda" type="checkbox" checked={ndaAccepted} onChange={(event) => setNdaAccepted(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300" />
                <span>Ich bestätige vertraulichen Umgang mit Pre-Alpha-Inhalten und gebe keine APKs, Screenshots oder Zugangsdaten öffentlich weiter.</span>
              </label>
              {error ? <div className="sm-error" role="alert">{error}</div> : null}
              <button type="submit" className="sm-btn-primary !w-full sm:!w-auto">Zugang prüfen</button>
            </form>
            <TesterKeyRequestForm source="app-download-popup" />
          </div>
          <div className="mt-4 flex shrink-0 justify-end border-t border-slate-200 pt-4"><button type="button" onClick={onClose} className="sm-btn-secondary">Weiter</button></div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-slate-900/60 p-2 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="sm-card my-1 flex max-h-[calc(100vh-1rem)] w-full max-w-xl flex-col overflow-hidden p-4 sm:my-4 sm:max-h-[calc(100vh-2rem)] sm:p-6">
        <div className="flex shrink-0 items-start justify-between gap-3">
          <div>
            <p className="sm-badge">App testen</p>
            <h3 className="mt-3 text-2xl font-extrabold">StepsMatch Pre-Alpha testen</h3>
            <p className="mt-2 text-sm text-slate-700 sm:text-base">
              Zugang bestätigt. Scanne den QR-Code oder lade die App direkt herunter. Bitte gib die APK und deinen Tester-Key nicht weiter.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Schließen
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
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
        </div>

        <div className="mt-4 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
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
  const [supportModalOpen, setSupportModalOpen] = React.useState(false);

  const dismissSupportModalPermanently = React.useCallback(() => {
    try {
      localStorage.setItem(SUPPORT_MODAL_STORAGE_KEY, "1");
    } catch {
      // The modal can still be dismissed for the current session.
    }
    setSupportModalOpen(false);
  }, []);

  const closeSupportModalTemporarily = React.useCallback(() => {
    setSupportModalOpen(false);
  }, []);

  React.useEffect(() => {
    if (location.pathname !== "/") return undefined;
    const query = new URLSearchParams(location.search);
    if (query.get("apk") === "1" || query.get("openApk") === "1") return undefined;

    let dismissed = false;
    try {
      dismissed = localStorage.getItem(SUPPORT_MODAL_STORAGE_KEY) === "1";
    } catch {
      // Continue without persistence when browser storage is unavailable.
    }
    if (dismissed) return undefined;

    const timer = window.setTimeout(() => setSupportModalOpen(true), 700);
    return () => window.clearTimeout(timer);
  }, [location.pathname, location.search]);

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

          <section className="sm-shell relative z-10 grid min-h-[82vh] items-center gap-8 py-12 lg:grid-cols-[minmax(0,0.88fr)_minmax(420px,1.12fr)] lg:py-16">
            <div className="max-w-4xl text-white sm-rise">
              <p className="sm-badge !border-white/30 !bg-white/10 !text-white">PRE ALPHA · Raum Graz im Aufbau</p>
              <h1 className="mt-6 max-w-3xl text-5xl font-black leading-[0.92] sm:text-6xl lg:text-8xl">
                {text.landing.heroTitle}
              </h1>
              <p className="mt-5 max-w-2xl text-lg font-semibold leading-relaxed text-white/92 sm:text-2xl">
                {text.landing.heroLead}
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/tester" className="sm-btn-primary gap-2">
                  App testen <ArrowRight size={16} />
                </Link>
                <Link to="/#anbieter" className="sm-btn-secondary gap-2">
                  Anbieter werden <Store size={16} />
                </Link>
              </div>

            </div>

            <aside className="sm-hero-media-slot sm-rise sm-delay-1" aria-label="StepsMatch-Nutzer erhält einen Hinweis auf ein aktuell passendes Angebot in unmittelbarer Nähe">
              <img
                src={heroRelevantMatch}
                alt="Ein StepsMatch-Nutzer erhält beim Vorbeigehen einen Hinweis auf ein aktuell passendes Angebot in unmittelbarer Nähe."
                width="1536"
                height="1024"
                loading="eager"
                decoding="async"
                fetchPriority="high"
                className="sm-hero-media-image"
              />
            </aside>
          </section>
        </header>

        <section className="sm-shell py-10 sm:py-14">
          <div className="sm-card-strong p-7 sm:p-9 sm-rise">
            <div className="max-w-3xl">
              <p className="sm-chip">Der StepsMatch-Kern</p>
              <h2 className="mt-4 text-3xl font-extrabold leading-tight sm:text-5xl">
                Relevant, wenn Angebot, Ort und Zeit zusammenpassen.
              </h2>
              <p className="mt-4 text-blue-50 sm:text-lg">
                Der Kern von StepsMatch ist eine orts- und zeitabhängige Push-Logik. Wenn ein passendes Angebot im gültigen Radius liegt und zum Interesse passt, kann die App auch im Hintergrund informieren. Ohne passenden Match bleibt StepsMatch ruhig.
              </p>
            </div>
            <div className="mt-7 grid gap-3 md:grid-cols-3">
              {corePillars.map((pillar) => {
                const Icon = pillar.icon;
                return (
                  <article key={pillar.title} className="rounded-lg border border-white/15 bg-white/10 p-4">
                    <Icon size={20} className="text-[var(--sm-accent)]" />
                    <h3 className="mt-3 text-lg font-extrabold text-white">{pillar.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-blue-50">{pillar.text}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="so-funktionierts" className="sm-shell py-10 sm:py-14">
          <div className="sm-card p-7 sm:p-9 sm-rise">
            <p className="sm-badge">So funktioniert StepsMatch</p>
            <h2 className="sm-section-title mt-4">So funktioniert StepsMatch für Nutzer</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
            <figure className="mt-7">
              <img
                src={userFlowComic}
                alt="Vier Schritte mit StepsMatch: Interesse wählen, App im Hintergrund laufen lassen, passenden Hinweis in der Nähe erhalten und zum Angebot navigieren."
                width="1536"
                height="1024"
                loading="lazy"
                decoding="async"
                className="block h-auto w-full rounded-lg border border-slate-200 shadow-sm"
              />
              <figcaption className="mt-2 text-xs leading-relaxed text-slate-500">
                Produktvisualisierung des Nutzerablaufs – kein reales Angebot, kein Partner- oder Rabattversprechen.
              </figcaption>
            </figure>
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
              StepsMatch ist derzeit eine PRE ALPHA im Raum Graz. Der technische Kern – Nähe, Interesse, Zeit und Push – ist am getesteten Android-Gerät validiert. Demo-Inhalte zeigen das Prinzip, ohne echte Partner-, Preis- oder Rabattclaims. Regionale Datenbasis und Anbieter-Flows werden kontrolliert weiterentwickelt.
            </p>
          </div>
        </section>

        <section id="anbieter" className="sm-shell pb-10 sm:pb-14">
          <div className="sm-card p-7 sm:p-9 sm-rise">
            <p className="sm-badge">
              <Store size={14} /> Für Anbieter
            </p>
            <h2 className="sm-section-title mt-4">So funktioniert StepsMatch für Anbieter</h2>
            <p className="sm-section-copy">
              Anbieter können ein Angebot mit Details, Bildern, Kategorie oder Interesse anlegen und bestimmen, wann und für welchen Radius es relevant ist.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {providerSteps.map((step, index) => (
                <div key={step.title} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">{String(index + 1).padStart(2, "0")}</p>
                  <p className="mt-2 text-lg font-extrabold text-slate-900">{step.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">{step.text}</p>
                </div>
              ))}
            </div>
            <figure className="mt-7">
              <img
                src={providerFlowComic}
                alt="Vier Schritte für Anbieter mit StepsMatch: Angebot anlegen, Radius festlegen, Laufzeit bestimmen und passende Nutzer im gültigen Radius erreichen."
                width="1774"
                height="887"
                loading="lazy"
                decoding="async"
                className="block h-auto w-full rounded-lg border border-slate-200 shadow-sm"
              />
              <figcaption className="mt-2 text-xs leading-relaxed text-slate-500">
                Produktvisualisierung, kein reales Angebot.
              </figcaption>
            </figure>

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
              Der technische Kern ist lokal validiert. Die Website erklärt jetzt klar, was StepsMatch kann – und was im Pre-Alpha-/Pilotstatus noch offen bleibt.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/tester" className="sm-btn-secondary gap-2">
                  App testen <Route size={16} />
                </Link>
              <Link to="/#pre-alpha" className="sm-btn-ghost">PRE ALPHA lesen</Link>
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
      <SupportRecruitmentModal
        open={supportModalOpen}
        onDismissPermanently={dismissSupportModalPermanently}
        onCloseTemporarily={closeSupportModalTemporarily}
      />
    </div>
  );
}
