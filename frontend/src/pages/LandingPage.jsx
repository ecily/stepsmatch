import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Helmet } from "@dr.pogodin/react-helmet";
import { QRCodeCanvas } from "qrcode.react";
import Navbar from "../components/Navbar";
import logoIcon from "../assets/stepsmatch-icon.svg";
import heroFriendlyCity from "../assets/navigation-preview.png";

function ApkModal({ open, onClose, apkUrl, onDontShowAgain }) {
  if (!open) return null;
  const qrValue = `${apkUrl}${apkUrl.includes("?") ? "&" : "?"}src=qr`;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/60" onClick={onClose} />
      <div className="relative z-[101] mx-4 w-full max-w-lg rounded-3xl border border-sky-100 bg-white p-6 shadow-2xl">
        <h3 className="text-xl font-extrabold text-slate-900">In 30 Sekunden starten</h3>
        <p className="mt-2 text-slate-600">QR-Code scannen, APK laden, fertig. Danach findet StepsMatch passende Angebote fÃ¼r dich, auch im Hintergrund.</p>
        <div className="mt-5 flex justify-center">
          <div className="rounded-3xl border border-sky-100 p-4">
            <QRCodeCanvas value={qrValue} size={220} includeMargin level="M" />
          </div>
        </div>
        <div className="mt-6 flex items-center justify-between gap-3">
          <button onClick={onDontShowAgain} className="text-sm text-slate-500 underline">Nicht mehr anzeigen</button>
          <button onClick={onClose} className="sm-btn-secondary">SchlieÃŸen</button>
        </div>
      </div>
    </div>
  );
}

const steps = [
  {
    title: "1. Anbieter stellt ein Angebot ein",
    text: "Mit Radius bis 2 km, Zeitfenster und Kategorie.",
  },
  {
    title: "2. Du wÃ¤hlst Interessen",
    text: "Zum Beispiel Essen, Jobs, Rabatte, Nightlife oder Services.",
  },
  {
    title: "3. StepsMatch meldet sich nur wenn es passt",
    text: "Bist du in der NÃ¤he, kommt ein Push. Sonst bleibt es ruhig.",
  },
];

const useCases = [
  "Feierabend und Restegerichte: Du gehst heim, in 100 m gibt es noch Tagesgerichte.",
  "Trafik oder Apotheke: Du wirst erinnert, wenn du ohnehin vorbeikommst.",
  "Rabatte: Du aktivierst Sales und bekommst nur passende Hinweise.",
  "Happy Hour: Beim Ausgehen siehst du Specials genau im richtigen Moment.",
  "Neu in der Gegend: Du entdeckst lokale Angebote ohne Suchstress.",
  "Abseits der HauptstraÃŸe: Spannende Anbieter werden sichtbar, wenn du nahe bist.",
  "Jobs in Gehweite: Wenn dein Profil gebraucht wird, bekommst du sofort Bescheid.",
  "Singles: Keine ReizÃ¼berflutung, nur passende Kontexte.",
  "Pilgern: Nur relevante Hinweise entlang deiner Route.",
];

export default function LandingPage() {
  const location = useLocation();
  const [heroOk, setHeroOk] = React.useState(true);
  const [apkOpen, setApkOpen] = React.useState(false);

  const title = "StepsMatch - finden. nicht suchen.";
  const description = "Die neuartige App fÃ¼r lokale Angebote: Ort x Zeit x Interesse. StepsMatch findet fÃ¼r dich auch im Hintergrund.";
  const url = "https://www.stepsmatch.com/";

  const APK_REDIRECT_URL = "https://stepsmatch.fra1.digitaloceanspaces.com/app-release.apk";

  React.useEffect(() => {
    try {
      const params = new URLSearchParams(location.search);
      const fromQuery = params.get("apk") === "1";
      const ndaAcceptedAt = localStorage.getItem("ndaAcceptedAt");
      const modalSeen = localStorage.getItem("apkModalSeen") === "1";

      if (fromQuery) {
        setApkOpen(true);
        params.delete("apk");
        const newSearch = params.toString();
        const newUrl = `${location.pathname}${newSearch ? `?${newSearch}` : ""}${location.hash || ""}`;
        window.history.replaceState({}, "", newUrl);
        return;
      }

      if (ndaAcceptedAt && !modalSeen) setApkOpen(true);
    } catch (e) {
      void e;
    }
  }, [location.pathname, location.search, location.hash]);

  return (
    <div className="relative min-h-screen overflow-x-hidden text-slate-900 bg-[#f8fcff]">
      <div className="pointer-events-none absolute inset-0 [background:radial-gradient(900px_420px_at_0%_0%,rgba(14,165,233,.12),transparent_60%),radial-gradient(720px_420px_at_100%_10%,rgba(37,99,235,.10),transparent_60%),linear-gradient(180deg,#ffffff_0%,#f4f9ff_55%,#f8fcff_100%)]" />

      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />
      </Helmet>

      <div className="relative z-10">
        <Navbar />

        <header className="sm-shell py-10 md:py-16">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white px-3 py-1 text-xs font-semibold text-sky-800">
                <img src={logoIcon} alt="StepsMatch" className="h-4 w-4" /> Neuartig: Die App sucht im Hintergrund
              </span>

              <h1 className="mt-5 text-5xl md:text-7xl font-black tracking-tight leading-[0.98]">
                finden.
                <br />
                nicht suchen.
              </h1>

              <p className="mt-5 text-lg md:text-xl text-slate-700 max-w-xl">
                Du gehst deinen Weg. StepsMatch meldet sich nur dann, wenn ein Angebot in deiner NÃ¤he wirklich zu dir passt.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <button onClick={() => setApkOpen(true)} className="sm-btn-primary">App installieren</button>
                <Link to="/register" className="sm-btn-secondary">Als Anbieter starten</Link>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-xl border border-sky-100 bg-white p-3 text-center">
                  <p className="font-bold">Ort</p>
                </div>
                <div className="rounded-xl border border-sky-100 bg-white p-3 text-center">
                  <p className="font-bold">Zeit</p>
                </div>
                <div className="rounded-xl border border-sky-100 bg-white p-3 text-center">
                  <p className="font-bold">Interesse</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl overflow-hidden border border-sky-100 bg-white shadow-sm">
              {heroOk ? (
                <img src={heroFriendlyCity} alt="Lebendige Stadt am Tag" className="h-[460px] w-full object-cover" onError={() => setHeroOk(false)} />
              ) : (
                <div className="h-[460px] w-full bg-gradient-to-br from-sky-100 via-cyan-50 to-blue-100" />
              )}
            </div>
          </div>
        </header>

        <section className="sm-shell pb-8">
          <div className="rounded-3xl border border-sky-100 bg-white p-7 md:p-9">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight">Was ist der MVP von StepsMatch?</h2>
            <p className="mt-4 text-lg text-slate-700 max-w-4xl">Anbieter stellen lokale Angebote mit Radius und Zeit ein. Du wÃ¤hlst Interessen. Sobald du in Schrittweite bist, bekommst du einen Push. Die App muss dafÃ¼r nicht offen sein.</p>
          </div>
        </section>

        <section className="sm-shell py-8">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight">So funktioniert es</h2>
          <div className="mt-5 grid md:grid-cols-3 gap-4">
            {steps.map((s) => (
              <article key={s.title} className="rounded-3xl border border-sky-100 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold">{s.title}</h3>
                <p className="mt-2 text-slate-700">{s.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="sm-shell py-8">
          <div className="rounded-3xl border border-sky-100 bg-white p-7">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight">So fÃ¼hlt sich StepsMatch im Alltag an</h2>
            <p className="mt-3 text-slate-700 text-lg">Neun einfache Beispiele, bei denen die App fÃ¼r dich sucht.</p>
            <div className="mt-6 grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {useCases.map((item, idx) => (
                <article key={idx} className="rounded-2xl border border-sky-100 bg-sky-50/40 p-5">
                  <p className="text-slate-800">{item}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="sm-shell pt-6 pb-16">
          <div className="rounded-3xl border border-sky-200 bg-sky-700 p-8 md:p-10 text-white">
            <h3 className="text-3xl font-extrabold">Bereit fÃ¼r Relevanz statt Suche?</h3>
            <p className="mt-3 text-sky-100 max-w-3xl">FÃ¼r User: mehr passende Treffer, weniger Aufwand. FÃ¼r Anbieter: Sichtbarkeit genau im richtigen Moment.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={() => setApkOpen(true)} className="rounded-full bg-white px-5 py-3 font-semibold text-sky-800">App jetzt testen</button>
              <Link to="/register" className="rounded-full border border-white/40 px-5 py-3 font-semibold">Anbieter Onboarding</Link>
              <Link to="/why" className="rounded-full border border-white/40 px-5 py-3 font-semibold">Warum neu</Link>
            </div>
          </div>
        </section>

        <footer className="border-t border-sky-100 bg-white/80">
          <div className="sm-shell py-8 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-slate-600">
            <div className="flex items-center gap-2"><img src={logoIcon} alt="StepsMatch" className="h-6 w-6" /> Â© {new Date().getFullYear()} StepsMatch</div>
            <div className="flex items-center gap-4">
              <Link to="/home">Home</Link>
              <Link to="/why">Warum neu</Link>
              <Link to="/register">Registrieren</Link>
              <Link to="/admin/offers">Admin Demo</Link>
            </div>
          </div>
        </footer>
      </div>

      <ApkModal
        open={apkOpen}
        onClose={() => setApkOpen(false)}
        onDontShowAgain={() => {
          try {
            localStorage.setItem("apkModalSeen", "1");
          } catch (e) {
            void e;
          }
          setApkOpen(false);
        }}
        apkUrl={APK_REDIRECT_URL}
      />
    </div>
  );
}

