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

  return (
    <div className="sm-page">
      <Helmet>
        <title>{text.landing.title}</title>
        <meta name="description" content={text.landing.description} />
        <link rel="canonical" href="https://www.stepsmatch.com/" />
      </Helmet>

      <div className="sm-stack">
        <Navbar />

        <section className="sm-shell pt-4 sm:pt-6">
          <div className="sm-card-soft p-6 sm:p-8 sm-rise sm-delay-1">
            <p className="sm-badge">StepsMatch</p>
            <p className="mt-4 text-lg font-bold leading-snug text-slate-900 sm:text-2xl">
              StepsMatch testet lokale Relevanz in echten Alltagssituationen.
            </p>
            <p className="mt-3 max-w-5xl text-slate-700 sm:text-lg">{text.landing.founderMessage}</p>
            <p className="mt-4 max-w-5xl rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3 text-slate-800 sm:text-base font-semibold">
              {text.landing.founderIntent}
            </p>
            <p className="mt-3 max-w-5xl text-sm font-semibold text-slate-700 sm:text-base">
              {text.landing.founderContact}
            </p>
          </div>
        </section>

        <header className="sm-shell py-8 sm:py-10 lg:py-14">
          <section className="relative overflow-hidden rounded-[2rem] border border-white/40 bg-gradient-to-br from-blue-950 via-blue-800 to-cyan-700 shadow-2xl sm-rise">
            <div className="absolute inset-0 bg-gradient-to-r from-[#082956]/85 via-[#0b3f85]/65 to-[#0b3f85]/42" />

            <div className="relative z-10 max-w-3xl p-6 text-white sm:p-10 lg:p-14">
              <p className="sm-badge !border-white/30 !bg-white/20 !text-white">{text.landing.badge}</p>
              <h1 className="sm-hero-title mt-5 whitespace-pre-line drop-shadow-[0_3px_10px_rgba(0,0,0,0.55)]">
                {text.landing.heroTitle}
              </h1>
              <p className="mt-5 max-w-2xl text-base font-semibold leading-relaxed text-white/95 drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] sm:text-xl">
                {text.landing.heroLead}
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <button onClick={() => setApkOpen(true)} className="sm-btn-primary gap-2">
                  {text.landing.ctaPrimary} <ArrowRight size={16} />
                </button>
                <Link to="/why" className="sm-btn-secondary gap-2 !bg-white/90">
                  <Compass size={16} />
                  {text.landing.ctaSecondary}
                </Link>
              </div>

              <p className="mt-5 inline-flex max-w-2xl rounded-2xl border border-white/35 bg-white/15 px-4 py-3 text-sm font-semibold leading-relaxed text-white/95 backdrop-blur-sm sm:text-base">
                {text.landing.heroQuickLine}
              </p>
            </div>
          </section>

          <section className="mt-4 sm-card p-6 sm:p-7 sm-rise sm-delay-1">
            <p className="sm-badge">Lokale Relevanz</p>
            <p className="mt-3 text-lg font-extrabold text-slate-900 sm:text-2xl">{text.landing.quickTrustLine}</p>
            <p className="mt-2 max-w-4xl text-slate-700 sm:text-lg">{text.landing.helpText}</p>
          </section>
        </header>

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
              {text.landing.routeFocusSteps.map((step, index) => (
                <div key={step} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-sm font-extrabold text-blue-800">
                    {index + 1}
                  </p>
                  <p className="mt-3 text-sm text-slate-700 sm:text-base">{step}</p>
                </div>
              ))}
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
