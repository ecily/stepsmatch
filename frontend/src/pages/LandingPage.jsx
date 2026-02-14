import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Helmet } from "@dr.pogodin/react-helmet";
import { QRCodeCanvas } from "qrcode.react";
import Navbar from "../components/Navbar";
import logoIcon from "../assets/stepsmatch-icon.svg";
import heroFriendlyCity from "../assets/hero-friendly-city.jpg";

function ApkModal({ open, onClose, apkUrl, onDontShowAgain }) {
  if (!open) return null;
  const qrValue = `${apkUrl}${apkUrl.includes("?") ? "&" : "?"}src=qr`;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/60" onClick={onClose} />
      <div className="relative z-[101] mx-4 w-full max-w-lg rounded-3xl border border-sky-100 bg-white p-6 shadow-2xl">
        <h3 className="text-xl font-extrabold text-slate-900">In 30 Sekunden starten 🚀</h3>
        <p className="mt-2 text-slate-600">QR-Code scannen, APK laden, fertig. Danach findet StepsMatch passende Angebote für dich, auch im Hintergrund.</p>
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
    emoji: "🍽️",
    title: "Feierabend + Tagesgerichte",
    text: "Du gehst nach Hause. Ein Restaurant in 100 m hat von 17:00 bis 19:00 noch 5 Gerichte übrig. Du bekommst den Hinweis genau jetzt.",
  },
  {
    emoji: "🚬",
    title: "Trafik ohne Kopfstress",
    text: "Du musst etwas besorgen, willst aber nicht ständig daran denken. In der Nähe einer Trafik erinnert dich StepsMatch rechtzeitig.",
  },
  {
    emoji: "💊",
    title: "Apotheke im richtigen Moment",
    text: "Du läufst vorbei und wirst erinnert: Apotheke nur wenige Schritte entfernt. Praktisch, ohne aktiv zu suchen.",
  },
  {
    emoji: "💸",
    title: "Schäppchenjäger-Modus",
    text: "Du aktivierst Sales & Rabatte. Wenn du an einem passenden Angebot vorbeikommst, bekommst du eine Nachricht statt Werberaushen.",
  },
  {
    emoji: "🍹",
    title: "Happy Hour beim Ausgehen",
    text: "Du ziehst mit Freunden durch die Stadt. Nur wenn es gerade ein passendes Special gibt, meldet sich StepsMatch.",
  },
  {
    emoji: "🧳",
    title: "Fremd in der Gegend",
    text: "Du bist neu vor Ort und offen für Unterkunft oder Services in Laufnähe. StepsMatch meldet nur echte Treffer.",
  },
  {
    emoji: "💼",
    title: "Jobs in Gehweite",
    text: "Du suchst Arbeit. Wenn ein Anbieter in deiner Nähe gerade dein Profil braucht, wirst du sofort informiert.",
  },
  {
    emoji: "❤️",
    title: "Singles & spontane Matches",
    text: "Du willst offen für Begegnungen sein, ohne Dauer-Swipen. StepsMatch zeigt nur passende Optionen im richtigen Kontext.",
  },
  {
    emoji: "🥾",
    title: "Pilgern ohne Suchstress",
    text: "Auf dem Weg brauchst du Ruhe. StepsMatch erinnert dich an passende Angebote entlang deiner Route, wenn du wirklich in der Nähe bist.",
  },
];

export default function LandingPage() {
  const location = useLocation();
  const title = "StepsMatch – finden. nicht suchen.";
  const description = "Die neuartige App für lokale Angebote: Ort × Zeit × Interesse. StepsMatch findet für dich – auch im Hintergrund, selbst wenn die App geschlossen ist.";
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
    <div className="min-h-screen text-slate-900 bg-[radial-gradient(circle_at_20%_0%,rgba(125,211,252,0.25),transparent_40%),radial-gradient(circle_at_95%_10%,rgba(129,140,248,0.18),transparent_35%),linear-gradient(180deg,#f8fdff_0%,#eef8ff_45%,#f7fbff_100%)]">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />
      </Helmet>

      <Navbar />

      <header className="sm-shell py-10 md:py-16">
        <div className="grid lg:grid-cols-12 gap-6 items-stretch">
          <section className="lg:col-span-8 rounded-3xl overflow-hidden border border-sky-100 bg-white shadow-sm">
            <div className="relative h-full">
              <img src={heroFriendlyCity} alt="Freundliche, lebendige Stadt am Tag" className="h-full min-h-[420px] w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-white via-white/65 to-transparent" />
              <div className="absolute left-6 right-6 bottom-6 animate-[fadeIn_.5s_ease-out]">
                <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white px-3 py-1 text-xs font-semibold text-sky-800">
                  <img src={logoIcon} alt="StepsMatch" className="h-4 w-4" /> Neuartig: Die App sucht im Hintergrund für dich
                </span>
                <h1 className="mt-4 text-5xl md:text-7xl font-black tracking-tight text-slate-900">finden.<br />nicht suchen.</h1>
                <p className="mt-3 max-w-3xl text-lg md:text-xl text-slate-700">
                  Du gehst deinen Weg. StepsMatch findet passende Angebote in deiner Nähe und meldet sich nur, wenn es wirklich passt.
                </p>
              </div>
            </div>
          </section>

          <aside className="lg:col-span-4 flex flex-col gap-4">
            <div className="sm-card p-6">
              <p className="text-sm font-semibold text-sky-700">MVP von StepsMatch</p>
              <h2 className="mt-2 text-2xl font-extrabold">Die erste App, die für dich sucht, selbst wenn sie nicht offen ist.</h2>
              <p className="mt-3 text-slate-700">Anbieter setzen Radius (bis 2 km), Zeitfenster und Kategorie. Du wählst Interessen. Bist du in Schrittweite, kommt ein Push. Sonst bleibt es ruhig.</p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs font-semibold">
                <div className="rounded-lg bg-sky-50 border border-sky-100 p-2 text-center">Ort</div>
                <div className="rounded-lg bg-sky-50 border border-sky-100 p-2 text-center">Zeit</div>
                <div className="rounded-lg bg-sky-50 border border-sky-100 p-2 text-center">Interesse</div>
              </div>
            </div>

            <div className="sm-card p-6">
              <p className="text-sm font-semibold text-sky-700">Jetzt starten ✨</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => setApkOpen(true)} className="sm-btn-primary">App installieren</button>
                <Link to="/register" className="sm-btn-secondary">Anbieter starten</Link>
                <Link to="/login" className="sm-btn-secondary">Login</Link>
              </div>
              <p className="mt-3 text-xs text-slate-500">Push funktioniert auch im Hintergrund bei geschlossener App.</p>
            </div>
          </aside>
        </div>
      </header>

      <section className="sm-shell py-10">
        <div className="rounded-3xl border border-sky-100 bg-white p-7">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight">So fühlt sich StepsMatch im Alltag an:</h2>
          <p className="mt-3 text-slate-700 text-lg">Du musst nicht suchen. Du musst nicht dauernd an alles denken. StepsMatch informiert dich freundlich genau dann, wenn in deiner Nähe etwas für dich passt.</p>
        </div>
      </section>

      <section className="sm-shell pb-14">
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {useCases.map((item, idx) => (
            <article key={item.title} className="sm-card p-5 hover:shadow-md transition-transform duration-300 hover:-translate-y-1" style={{ animationDelay: `${idx * 40}ms` }}>
              <h3 className="text-lg font-bold flex items-center gap-2"><span>{item.emoji}</span>{item.title}</h3>
              <p className="mt-2 text-slate-700">{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="sm-shell pb-16">
        <div className="rounded-3xl border border-sky-200 bg-sky-700 p-8 md:p-10 text-white">
          <h3 className="text-3xl font-extrabold">Mehr Lust auf lokale Angebote. Weniger Suchstress.</h3>
          <p className="mt-3 text-sky-100 max-w-3xl">Für App-User bedeutet StepsMatch: Relevanz ohne Aufwand. Für Anbieter bedeutet es: Sichtbarkeit genau im richtigen Moment. Das ist neu. Das ist MVP-ready.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={() => setApkOpen(true)} className="rounded-full bg-white px-5 py-3 font-semibold text-sky-800">App jetzt testen</button>
            <Link to="/register" className="rounded-full border border-white/40 px-5 py-3 font-semibold">Anbieter Onboarding</Link>
            <Link to="/admin/offers" className="rounded-full border border-white/40 px-5 py-3 font-semibold">Admin Demo</Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-sky-100 bg-white/80">
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
