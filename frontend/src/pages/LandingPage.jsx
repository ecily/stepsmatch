import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Helmet } from "@dr.pogodin/react-helmet";
import { QRCodeCanvas } from "qrcode.react";
import {
  ArrowRight,
  BellRing,
  Compass,
  Footprints,
  House,
  MapPin,
  Pill,
  Sparkles,
  Store,
  UtensilsCrossed,
} from "lucide-react";

import Navbar from "../components/Navbar";
import SiteFooter from "../components/SiteFooter";
import { getPreferredSiteText } from "../content/siteContent";
import heroCity from "../assets/hero-city-daylight.jpg";

function ApkModal({ open, onClose, apkUrl, text, onDontShowAgain }) {
  if (!open) return null;
  const qrValue = `${apkUrl}${apkUrl.includes("?") ? "&" : "?"}src=qr`;

  return (
    <div className="fixed inset-0 z-[120] grid place-items-end bg-slate-900/60 p-3 sm:place-items-center sm:p-6" role="dialog" aria-modal="true">
      <div className="sm-card w-full max-w-xl p-6 sm:p-8 sm-rise">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="sm-badge">
              <Sparkles size={14} /> App installieren
            </p>
            <h3 className="mt-3 text-2xl font-extrabold">{text.brand.appModalTitle}</h3>
            <p className="mt-2 text-sm text-slate-700 sm:text-base">{text.brand.appModalBody}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Schließen
          </button>
        </div>

        <div className="mt-5 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="mx-auto rounded-2xl border border-slate-200 bg-white p-3 sm:mx-0">
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

  const journeyIcons = [Pill, UtensilsCrossed, House, BellRing];
  const signalIcons = [MapPin, Sparkles, BellRing];

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
          <img
            src={heroCity}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,13,25,0.92)_0%,rgba(10,23,39,0.82)_44%,rgba(10,23,39,0.32)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-slate-950/80 to-transparent" />

          <section className="sm-shell relative z-10 grid min-h-[76vh] items-center gap-8 py-12 sm:min-h-[72vh] lg:grid-cols-[minmax(0,1fr)_420px] lg:py-16">
            <div className="max-w-4xl text-white sm-rise">
              <div className="flex flex-wrap items-center gap-3">
                <p className="sm-badge !border-white/30 !bg-white/10 !text-white">{text.landing.badge}</p>
                <div className="rounded-md border border-[var(--sm-accent)] bg-[var(--sm-accent)] px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-950 shadow-lg shadow-black/20">
                  {text.landing.preAlphaLabel}
                </div>
              </div>
              <p className="mt-4 max-w-2xl text-sm font-bold uppercase tracking-[0.08em] text-white/82">
                {text.landing.preAlphaLine}
              </p>
              <h1 className="mt-6 max-w-3xl text-5xl font-black leading-[0.92] sm:text-6xl lg:text-8xl">
                {text.landing.heroTitle}
              </h1>
              <p className="mt-5 max-w-2xl text-lg font-semibold leading-relaxed text-white/92 sm:text-2xl">
                {text.landing.heroLead}
              </p>

              <div className="mt-7 flex flex-wrap gap-2">
                {["Nähe", "Interesse", "aktives Angebot"].map((item) => (
                  <span key={item} className="rounded-md border border-white/25 bg-white/12 px-3 py-2 text-sm font-extrabold uppercase tracking-[0.08em] text-white backdrop-blur-sm">
                    {item}
                  </span>
                ))}
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <button onClick={() => setApkOpen(true)} className="sm-btn-primary gap-2">
                  {text.landing.ctaPrimary} <ArrowRight size={16} />
                </button>
                <Link to="/why" className="sm-btn-secondary gap-2">
                  <Compass size={16} />
                  {text.landing.ctaSecondary}
                </Link>
              </div>

              <p className="mt-6 max-w-2xl text-base font-bold text-[var(--sm-accent)] sm:text-lg">
                {text.landing.heroQuickLine}
              </p>
            </div>

            <aside className="sm-match-panel sm-rise sm-delay-1" aria-label="Matching-Signal aus Nähe, Interesse und aktivem Angebot">
              <div className="sm-match-radar">
                <div className="sm-match-ring sm-match-ring-1" />
                <div className="sm-match-ring sm-match-ring-2" />
                <div className="sm-match-ring sm-match-ring-3" />
                <div className="sm-match-center">
                  <MapPin size={22} />
                  <span>Hier</span>
                </div>
                <div className="sm-match-node sm-match-node-interest">
                  <Sparkles size={16} />
                  <span>Interesse</span>
                </div>
                <div className="sm-match-node sm-match-node-offer">
                  <Store size={16} />
                  <span>Angebot aktiv</span>
                </div>
              </div>
              <div className="mt-5 grid gap-2">
                {["Nähe erkannt", "Interesse passt", "Angebot ist aktiv"].map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm font-bold text-white/90">
                    <span className="h-2 w-2 rounded-full bg-[var(--sm-accent)]" />
                    {item}
                  </div>
                ))}
              </div>
            </aside>
          </section>
        </header>

        <section className="sm-shell py-8 sm:py-10">
          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="sm-card p-6 sm:p-8 sm-rise">
              <p className="sm-badge">USP</p>
              <h2 className="mt-4 text-3xl font-extrabold leading-tight sm:text-4xl">
                {text.landing.quickTrustLine}
              </h2>
              <p className="mt-4 max-w-3xl text-lg text-slate-700">{text.landing.helpText}</p>
            </div>
            <div className="sm-card-strong p-6 sm:p-8 sm-rise sm-delay-1">
              <p className="sm-chip">Status</p>
              <p className="mt-4 text-2xl font-extrabold">Interne Alpha. Mobile zuerst.</p>
              <p className="mt-3 text-sm font-semibold leading-relaxed text-white/85">
                {text.landing.heroQuickLine}
              </p>
            </div>
          </div>
        </section>

        <section id="nutzer" className="sm-shell pb-8 sm:pb-12">
          <div className="sm-card p-7 sm:p-9 sm-rise sm-delay-1">
            <p className="sm-badge">Für Nutzer</p>
            <h2 className="sm-section-title mt-4">{text.landing.painTitle}</h2>
            <p className="sm-section-copy">{text.landing.painIntro}</p>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {text.landing.painCards.map((item, idx) => {
                const Icon = journeyIcons[idx % journeyIcons.length];
                return (
                  <article key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="inline-flex items-center gap-2 text-sm font-bold text-blue-900">
                      <Icon size={16} /> {item.title}
                    </p>
                    <p className="mt-2 text-sm text-slate-700 sm:text-base">{item.text}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="sm-shell pb-8 sm:pb-12">
          <div className="sm-card p-7 sm:p-9 sm-rise sm-delay-1">
            <p className="sm-badge">Matching-Logik</p>
            <h2 className="sm-section-title mt-4">{text.landing.routeFocusTitle}</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {text.landing.routeFocusSteps.map((step, index) => {
                const Icon = signalIcons[index % signalIcons.length];
                const [label, description] = step.split(": ");
                return (
                  <div key={step} className="rounded-lg border border-slate-200 bg-white p-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-900 text-[var(--sm-accent)]">
                      <Icon size={18} />
                    </div>
                    <p className="mt-4 text-lg font-extrabold text-slate-950">{label}</p>
                    <p className="mt-2 text-sm text-slate-700 sm:text-base">{description || step}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="sm-shell pb-8 sm:pb-12">
          <div className="sm-card-soft p-7 sm:p-9 sm-rise sm-delay-2">
            <p className="sm-badge">StepsMatch-Prinzipien</p>
            <h2 className="sm-section-title mt-4">{text.landing.symbolsTitle}</h2>
            <p className="sm-section-copy">{text.landing.symbolsIntro}</p>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {text.landing.symbolsFacts.map((fact) => (
                <div key={fact} className="rounded-2xl border border-slate-200 bg-white/70 p-4 text-sm text-slate-700 sm:text-base">
                  {fact}
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              {text.landing.symbolsSourceLine}
            </p>
          </div>
        </section>

        <section id="anbieter" className="sm-shell pb-8 sm:pb-12">
          <div className="sm-card p-7 sm:p-9 sm-rise sm-delay-2">
            <p className="sm-badge">
              <Store size={14} /> Für Anbieter
            </p>
            <h2 className="sm-section-title mt-4">{text.landing.providerTitle}</h2>
            <p className="sm-section-copy">{text.landing.providerLead}</p>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {text.landing.providerPoints.map((point) => (
                <div key={point} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 sm:text-base">
                  {point}
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/register" className="sm-btn-primary gap-2">
                {text.landing.providerCta} <ArrowRight size={16} />
              </Link>
              <Link to="/login" className="sm-btn-secondary">Anbieter Login</Link>
            </div>
          </div>
        </section>

        <section className="sm-shell pb-8 sm:pb-12">
          <div className="sm-card-soft p-7 sm:p-9 sm-rise sm-delay-2">
            <p className="sm-badge">
              <Footprints size={14} /> Mobile-Core
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {text.landing.emotionalCards.map((item) => (
                <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-lg font-bold text-slate-900">{item.title}</p>
                  <p className="mt-2 text-sm text-slate-700 sm:text-base">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="sm-shell pt-2 pb-16 sm:pt-4 sm:pb-20">
          <div className="sm-card-strong p-7 sm:p-10 sm-rise sm-delay-2">
            <p className="sm-chip">StepsMatch</p>
            <h3 className="mt-4 text-3xl font-extrabold sm:text-4xl">{text.landing.quote}</h3>
            <p className="mt-3 max-w-3xl text-sm text-blue-50 sm:text-lg">
              StepsMatch hält den Informationslärm klein und testet passende Hinweise im richtigen Moment.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={() => setApkOpen(true)} className="sm-btn-secondary">
                {text.brand.appCta}
              </button>
              <Link to="/why" className="sm-btn-ghost">
                Mehr über den Produktkern
              </Link>
              <Link to="/register" className="sm-btn-ghost">
                <MapPin size={14} className="mr-1" /> Für Anbieter
              </Link>
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
