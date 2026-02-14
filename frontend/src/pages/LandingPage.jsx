import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Helmet } from "@dr.pogodin/react-helmet";
import { QRCodeCanvas } from "qrcode.react";
import Navbar from "../components/Navbar";
import logoIcon from "../assets/stepsmatch-icon.svg";
import heroDaylight from "../assets/hero-city-daylight.jpg";

function ApkModal({ open, onClose, apkUrl, onDontShowAgain }) {
  if (!open) return null;
  const qrValue = `${apkUrl}${apkUrl.includes("?") ? "&" : "?"}src=qr`;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/60" onClick={onClose} />
      <div className="relative z-[101] mx-4 w-full max-w-lg rounded-3xl border border-sky-100 bg-white p-6 shadow-2xl">
        <h3 className="text-xl font-extrabold text-slate-900">App installieren in 30 Sekunden</h3>
        <p className="mt-2 text-slate-600">QR-Code scannen, APK laden, fertig. Dann bekommst du passende Angebote genau im richtigen Moment.</p>
        <div className="mt-5 flex justify-center">
          <div className="rounded-3xl border border-sky-100 p-4">
            <QRCodeCanvas value={qrValue} size={220} includeMargin level="M" />
          </div>
        </div>
        <div className="mt-6 flex items-center justify-between gap-3">
          <button onClick={onDontShowAgain} className="text-sm text-slate-500 underline">Nicht mehr anzeigen</button>
          <button onClick={onClose} className="sm-btn-secondary">Schließen</button>
        </div>
      </div>
    </div>
  );
}

const useCases = [
  {
    title: "Feierabend + Tagesgerichte",
    text: "Du gehst heim. Ein Restaurant in 100 m hat von 17:00 bis 19:00 noch 5 Gerichte übrig. Du willst ‘50% für Gutes von heute’? Dann bekommst du genau diesen Hinweis.",
  },
  {
    title: "Erinnerung ohne Kopfstress",
    text: "Du willst an Trafik oder Apotheke erinnert werden, sobald du in der Nähe bist. StepsMatch erinnert dich, wenn es relevant ist, sonst bleibt es still.",
  },
  {
    title: "Schäppchenjäger-Modus",
    text: "Du aktivierst Sales/Rabatte. Beim Vorbeigehen kommt eine Nachricht. Ein Tap und du siehst Angebot plus Route bis vor die Tür.",
  },
  {
    title: "Nachtleben + Happy Hour",
    text: "Du ziehst mit Freunden von Lokal zu Lokal. Nur wenn es gerade ein passendes Special gibt, meldet sich StepsMatch.",
  },
  {
    title: "Fremd in der Gegend",
    text: "Du suchst nicht aktiv, bist aber offen für eine Unterkunft in der Nähe. Wenn etwas passt, meldet sich StepsMatch.",
  },
  {
    title: "Tourist abseits der Hauptstraße",
    text: "Du würdest den Juwelier abseits der Touristenroute nie finden. StepsMatch macht ihn sichtbar, wenn du in Reichweite bist und offen dafür bist.",
  },
];

export default function LandingPage() {
  const location = useLocation();
  const title = "StepsMatch – finden. nicht suchen.";
  const description = "StepsMatch verbindet Menschen und lokale Angebote im richtigen Moment: Ort × Zeit × Interesse. Kein Suchen, kein Streuverlust.";
  const url = "https://www.stepsmatch.com/";

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
  const backendBaseUrl = apiBaseUrl ? String(apiBaseUrl).replace(/\/api\/?$/, "") : "https://lobster-app-ie9a5.ondigitalocean.app";
  const APK_REDIRECT_URL = `${backendBaseUrl}/apk`;
  const [apkOpen, setApkOpen] = React.useState(false);

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
    <div className="min-h-screen text-slate-900">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />
      </Helmet>

      <Navbar />

      <header className="sm-shell py-10 md:py-16">
        <div className="grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 rounded-3xl overflow-hidden border border-sky-100 shadow-sm bg-white">
            <div className="relative">
              <img src={heroDaylight} alt="Belebte Stadtstraße am Tag" className="h-[380px] w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-white via-white/70 to-transparent" />
              <div className="absolute left-6 right-6 bottom-6">
                <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white px-3 py-1 text-xs font-semibold text-sky-800">
                  <img src={logoIcon} alt="StepsMatch" className="h-4 w-4" /> Live-Matching für echte Laufwege
                </span>
                <h1 className="mt-4 text-5xl md:text-7xl font-black tracking-tight text-slate-900">finden.<br />nicht suchen.</h1>
                <p className="mt-3 max-w-2xl text-lg text-slate-700">
                  StepsMatch zeigt dir Angebote genau dann, wenn sie zu deinem Ort, deiner Zeit und deinem Interesse passen.
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <div className="sm-card p-6">
              <p className="text-sm font-semibold text-sky-700">Was ist der MVP?</p>
              <h2 className="mt-2 text-2xl font-extrabold">Eine App, die Angebot und Nachfrage live zusammenführt.</h2>
              <p className="mt-3 text-slate-700">Nicht suchen. Nicht raten. Wenn es wirklich passt, meldet sich StepsMatch. Wenn nicht, schweigt es.</p>
              <div className="mt-5 grid grid-cols-3 gap-2 text-sm">
                <div className="rounded-xl bg-sky-50 border border-sky-100 p-2 text-center"><b>Ort</b></div>
                <div className="rounded-xl bg-sky-50 border border-sky-100 p-2 text-center"><b>Zeit</b></div>
                <div className="rounded-xl bg-sky-50 border border-sky-100 p-2 text-center"><b>Interesse</b></div>
              </div>
            </div>

            <div className="sm-card p-6">
              <p className="text-sm font-semibold text-sky-700">Jetzt testen</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to="/register" className="sm-btn-primary">Als Anbieter starten</Link>
                <Link to="/login" className="sm-btn-secondary">Anbieter Login</Link>
                <button onClick={() => setApkOpen(true)} className="sm-btn-secondary">App per QR laden</button>
              </div>
              <p className="mt-3 text-xs text-slate-500">Admin-Demo und bestehende Funktionen bleiben unverändert verfügbar.</p>
            </div>
          </div>
        </div>
      </header>

      <section className="sm-shell py-12">
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="sm-card p-7">
            <h3 className="text-2xl font-extrabold">Warum das für Nutzer neu ist</h3>
            <p className="mt-3 text-slate-700">Du entscheidest einmal, was dich interessiert. Danach übernimmt StepsMatch den Rest: relevante Hinweise statt Suche.</p>
          </div>
          <div className="sm-card p-7">
            <h3 className="text-2xl font-extrabold">Warum das für Anbieter neu ist</h3>
            <p className="mt-3 text-slate-700">Angebote treffen Menschen im richtigen Moment in echter Nähe. So entsteht Wirkung statt Streuverlust.</p>
          </div>
        </div>
      </section>

      <section className="sm-shell pb-14">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight">So fühlt sich StepsMatch im Alltag an</h2>
          <Link to="/why" className="hidden md:inline text-sky-700 font-semibold">Warum das neu ist →</Link>
        </div>
        <div className="mt-6 grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {useCases.map((item) => (
            <article key={item.title} className="sm-card p-5">
              <h3 className="text-lg font-bold">{item.title}</h3>
              <p className="mt-2 text-slate-700">{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="sm-shell pb-16">
        <div className="rounded-3xl border border-sky-200 bg-sky-700 p-8 md:p-10 text-white">
          <h3 className="text-3xl font-extrabold">Die Neuheit in einem Satz</h3>
          <p className="mt-3 text-sky-100 max-w-3xl">StepsMatch macht aus passiver Laufkundschaft aktive Nachfrage – automatisch, kontextgenau und steuerbar für beide Seiten.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/register" className="rounded-full bg-white px-5 py-3 font-semibold text-sky-800">Anbieter onboarding</Link>
            <Link to="/admin/offers" className="rounded-full border border-white/40 px-5 py-3 font-semibold">Admin Demo</Link>
            <Link to="/pitch" className="rounded-full border border-white/40 px-5 py-3 font-semibold">Investor Pitch</Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-sky-100 bg-white">
        <div className="sm-shell py-8 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-slate-600">
          <div className="flex items-center gap-2"><img src={logoIcon} alt="StepsMatch" className="h-6 w-6" /> © {new Date().getFullYear()} StepsMatch</div>
          <div className="flex items-center gap-4">
            <Link to="/home">Home</Link>
            <Link to="/why">Warum neu</Link>
            <Link to="/register">Registrieren</Link>
            <Link to="/admin/offers">Admin Demo</Link>
          </div>
        </div>
      </footer>

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
