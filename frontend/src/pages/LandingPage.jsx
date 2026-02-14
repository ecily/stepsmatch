import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Helmet } from "@dr.pogodin/react-helmet";
import { QRCodeCanvas } from "qrcode.react";
import Navbar from "../components/Navbar";
import logoIcon from "../assets/stepsmatch-icon.svg";
import heroBg from "../assets/hero-bg-urban.jpg";

function ApkModal({ open, onClose, apkUrl, onDontShowAgain }) {
  if (!open) return null;
  const qrValue = `${apkUrl}${apkUrl.includes("?") ? "&" : "?"}src=qr`;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/60" onClick={onClose} />
      <div className="relative z-[101] mx-4 w-full max-w-lg rounded-3xl border border-sky-100 bg-white p-6 shadow-2xl">
        <h3 className="text-xl font-extrabold text-slate-900">App installieren in 30 Sekunden</h3>
        <p className="mt-2 text-slate-600">QR-Code scannen, APK laden, fertig. Dann bekommst du passende Angebote in deiner Nähe.</p>
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

export default function LandingPage() {
  const location = useLocation();
  const title = "StepsMatch - finden. nicht suchen.";
  const description = "Die App zeigt Menschen genau jetzt passende Angebote in der Nähe. Anbieter erreichen genau die richtigen Leute im richtigen Moment.";
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

  const cards = [
    {
      title: "Für Nutzer",
      lead: "Du suchst nicht mehr.",
      text: "Du bekommst nur Angebote, die jetzt passen: nah, relevant, gültig.",
      cta: { label: "So funktioniert es", href: "/why" },
    },
    {
      title: "Für Anbieter",
      lead: "Du erreichst Leute im richtigen Moment.",
      text: "Dein Angebot wird genau dann sichtbar, wenn Menschen in der Nähe sind.",
      cta: { label: "Als Anbieter starten", href: "/register" },
    },
    {
      title: "Warum neu",
      lead: "Ort x Zeit x Interesse.",
      text: "Nicht Suchmaschine, sondern Live-Matching. Genau das ist StepsMatch.",
      cta: { label: "Neuheit ansehen", href: "/why" },
    },
  ];

  return (
    <div className="min-h-screen text-slate-900">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />
      </Helmet>

      <Navbar />

      <header className="relative overflow-hidden border-b border-sky-100">
        <div className="absolute inset-0 bg-cover bg-center opacity-15" style={{ backgroundImage: `url(${heroBg})` }} />
        <div className="relative sm-shell py-16 md:py-24 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white px-3 py-1 text-xs font-semibold text-sky-800">
              <img src={logoIcon} alt="StepsMatch" className="h-4 w-4" />
              Neu: Live-Angebote ohne Suchen
            </span>
            <h1 className="mt-5 text-5xl md:text-7xl font-black tracking-tight text-slate-900">finden.<br />nicht suchen.</h1>
            <p className="mt-6 text-lg text-slate-700 max-w-2xl">
              StepsMatch ist die App, die Menschen und lokale Angebote automatisch zusammenbringt.
              Wenn es in deiner Nähe jetzt wirklich passt, bekommst du einen Hinweis.
              Kein Scrollen. Kein Suchen. Kein Streuverlust.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/register" className="sm-btn-primary">Anbieter kostenlos starten</Link>
              <Link to="/login" className="sm-btn-secondary">Anbieter Login</Link>
              <button onClick={() => setApkOpen(true)} className="sm-btn-secondary">App per QR laden</button>
            </div>
          </div>

          <div className="sm-card p-7">
            <p className="text-sm font-semibold text-sky-700">MVP in einem Satz</p>
            <h2 className="mt-2 text-2xl font-bold">Die richtigen Menschen sehen das richtige Angebot zur richtigen Zeit am richtigen Ort.</h2>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="rounded-2xl bg-sky-50 p-3 border border-sky-100"><b>Ort</b><p className="text-slate-600">in deiner Nähe</p></div>
              <div className="rounded-2xl bg-sky-50 p-3 border border-sky-100"><b>Zeit</b><p className="text-slate-600">jetzt gültig</p></div>
              <div className="rounded-2xl bg-sky-50 p-3 border border-sky-100"><b>Interesse</b><p className="text-slate-600">wirklich passend</p></div>
            </div>
          </div>
        </div>
      </header>

      <section className="sm-shell py-16">
        <h2 className="text-3xl md:text-4xl font-extrabold">Warum StepsMatch sofort verständlich ist</h2>
        <p className="mt-3 text-lg text-slate-600 max-w-3xl">Stell dir vor: Du gehst durch die Stadt. Genau dann meldet sich nur das Angebot, das jetzt für dich Sinn macht. Das ist alles.</p>
        <div className="mt-8 grid md:grid-cols-3 gap-5">
          {cards.map((c) => (
            <div key={c.title} className="sm-card p-6">
              <p className="text-xs uppercase tracking-wide text-slate-500">{c.title}</p>
              <h3 className="mt-2 text-xl font-bold">{c.lead}</h3>
              <p className="mt-2 text-slate-600">{c.text}</p>
              <Link to={c.cta.href} className="mt-4 inline-block text-sky-700 font-semibold">{c.cta.label} {"->"}</Link>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border-y border-sky-100">
        <div className="sm-shell py-14 grid md:grid-cols-2 gap-8 items-start">
          <div className="sm-card p-6">
            <p className="text-sm font-semibold text-sky-700">Für App-Nutzer</p>
            <h3 className="mt-2 text-2xl font-bold">Mehr gute Treffer, weniger Lärm.</h3>
            <ul className="mt-4 space-y-2 text-slate-700">
              <li>Nur relevante Hinweise statt Werbeflut</li>
              <li>Angebote mit echtem Bezug zu deinem Ort</li>
              <li>Sofort reagieren und Route starten</li>
            </ul>
          </div>
          <div className="sm-card p-6">
            <p className="text-sm font-semibold text-sky-700">Für Anbieter</p>
            <h3 className="mt-2 text-2xl font-bold">Mehr Sichtbarkeit, wenn Kunden wirklich da sind.</h3>
            <ul className="mt-4 space-y-2 text-slate-700">
              <li>Angebote lokal und zeitlich präzise ausspielen</li>
              <li>Weniger Streuverlust als klassische Werbung</li>
              <li>Schnell aufsetzen, direkt live gehen</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="sm-shell py-16">
        <div className="rounded-3xl bg-sky-700 p-8 md:p-10 text-white">
          <h3 className="text-3xl font-extrabold">StepsMatch ist keine weitere Suchseite.</h3>
          <p className="mt-3 text-sky-100 max-w-3xl">StepsMatch ist ein neues Live-Konzept: Angebot und Nachfrage finden sich automatisch. Genau dadurch entsteht echter Mehrwert auf beiden Seiten.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/why" className="rounded-full bg-white px-5 py-3 font-semibold text-sky-800">Warum das neu ist</Link>
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
