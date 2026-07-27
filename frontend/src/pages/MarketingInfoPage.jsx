import React from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowRight, BellRing, Clock3, EyeOff, MapPin, ShieldCheck, Store } from "lucide-react";

import Navbar from "../components/Navbar";
import SiteFooter from "../components/SiteFooter";

const pages = {
  app: {
    badge: "App",
    title: "Die App läuft ruhig im Hintergrund.",
    lead: "StepsMatch meldet sich nur, wenn in deiner Nähe etwas Relevantes aktiv ist und zu deinen Interessen passt.",
    icon: BellRing,
    points: [
      "Interessen bewusst wählen",
      "Standortfreigabe selbst kontrollieren",
      "Hinweise nur im passenden lokalen Moment",
      "Schritt für Schritt zum relevanten Ort",
    ],
    cta: { to: "/home?apk=1", label: "App testen" },
  },
  anbieter: {
    badge: "Fuer Anbieter",
    title: "Lokale Hinweise fuer den Pre-Alpha-Test steuern.",
    lead: "StepsMatch testet Naehe, Zeit und Interesse in einem lokalen Demo-Gebiet. Anbieter koennen spaeter Inhalte mit Radius, Laufzeit, Sichtbarkeit und klarer Kennzeichnung pflegen.",
    icon: Store,
    points: [
      "Stammdaten und Standort sauber pruefen",
      "Kategorie oder Interesse passend waehlen",
      "Radius und Laufzeit festlegen",
      "Demo-/Pre-Alpha-Hinweise klar kennzeichnen",
      "Keine Rabatte, Preise oder Partnerclaims erfinden",
    ],
    note: "Pre-Alpha heisst: Demo-Hinweise sind keine offiziellen Partnerclaims. Schritte, Sichtbarkeit und Push-Regeln werden vor echter Ausspielung bewusst geprueft.",
    cta: { to: "/register", label: "Anbieter registrieren" },
    heroActions: [
      { to: "/register", label: "Anbieter registrieren", variant: "primary" },
      { to: "/login", label: "Anbieter einloggen", variant: "secondary" },
    ],
  },
  "so-funktionierts": {
    badge: "So funktioniert StepsMatch",
    title: "Ort, Zeit und Interesse müssen zusammenpassen.",
    lead: "StepsMatch ist einfach gedacht: Du sagst, was dich interessiert. Die App bleibt ruhig. Ein Hinweis kommt nur, wenn der Kontext passt.",
    icon: MapPin,
    points: [
      "Interessen wählen",
      "App ruhig laufen lassen",
      "Hinweis bekommen, wenn Ort, Radius, Zeit und Interesse passen",
      "Zum passenden Ort geführt werden",
    ],
    cta: { to: "/home#so-funktionierts", label: "Auf der Startseite ansehen" },
  },
  "pre-alpha": {
    badge: "PRE ALPHA",
    title: "Raum Graz im Aufbau.",
    lead: "Der technische Kern funktioniert. Jetzt bauen wir regionale Datenbasis, bessere Anbieter-Flows und ein verlässliches Beta-Erlebnis auf.",
    icon: Clock3,
    points: [
      "Background-Hinweise sind technisch verifiziert",
      "Inhalte werden schrittweise und klar gekennzeichnet aufgebaut",
      "Demo-Hinweise dürfen nie wie echte Angebote wirken",
      "Keine Partner-Claims ohne Prüfung",
    ],
    cta: { to: "/home#pre-alpha", label: "PRE ALPHA auf der Startseite" },
  },
  "datenschutz-standort": {
    badge: "Standort & Datenschutz",
    title: "Standortfunktionen brauchen klare Kontrolle.",
    lead: "StepsMatch nutzt Standort und Benachrichtigungen nur für die Produktfunktion: relevante lokale Hinweise im passenden Moment.",
    icon: ShieldCheck,
    points: [
      "Standortfreigaben werden bewusst erteilt",
      "Interessen bleiben Teil der eigenen Relevanzsteuerung",
      "Keine Marketing- oder Tracking-Cookies auf der Website",
      "PRE ALPHA heißt: Funktionen werden transparent geprüft",
    ],
    cta: { to: "/privacy", label: "Datenschutz lesen" },
  },
};

Object.assign(pages, {
  app: {
    ...pages.app,
    title: "Relevant, wenn Angebot, Ort und Zeit zusammenpassen.",
    lead: "StepsMatch verbindet lokale Anbieter mit Menschen in der Nähe. Interessen, Radius und gültiges Zeitfenster entscheiden, ob ein Hinweis relevant ist.",
    points: [
      "Interessen bewusst wählen",
      "Standortfreigabe selbst kontrollieren",
      "Hinweise nur im passenden lokalen Moment",
      "Push statt ständiger Suche – nur bei passendem Match",
    ],
  },
  anbieter: {
    ...pages.anbieter,
    lead: "Anbieter legen Angebote mit Details, Bildern, Kategorie oder Interesse an und steuern Radius, Datum, Wochentage und Zeitfenster.",
    points: [
      "Stammdaten und Standort sauber prüfen",
      "Kategorie oder Interesse passend wählen",
      "Radius, Datum, Wochentage und Zeitfenster festlegen",
      "Keine Massenwerbung und keine lauten Pushes für alles",
      "Keine Rabatte, Preise oder Partnerclaims erfinden",
    ],
    note: "Beispiel: Ein Gasthaus könnte ein Mittagsmenü um 9,90 EUR von Montag bis Freitag, 11:00 bis 15:00, in 200 m Radius anlegen. Das ist kein echtes Angebot und kein Partnerclaim.",
  },
  "so-funktionierts": {
    ...pages["so-funktionierts"],
    lead: "Du wählst Interessen. Die App kann im Hintergrund bleiben und informiert nur, wenn Interesse, Ort und Zeitfenster eines Angebots passen. Ohne Match bleibt sie ruhig.",
  },
  "pre-alpha": {
    ...pages["pre-alpha"],
    lead: "Der technische Kern ist am getesteten Android-Gerät validiert. Jetzt bauen wir regionale Datenbasis und bessere Anbieter-Flows kontrolliert weiter aus.",
  },
  "datenschutz-standort": {
    ...pages["datenschutz-standort"],
    lead: "Standort und Benachrichtigungen sind Teil der Produktfunktion: relevante lokale Hinweise im passenden Moment. StepsMatch ist auf sparsame, zweckgebundene Standortnutzung ausgelegt.",
    points: [
      "Standortfreigaben werden bewusst erteilt",
      "Interessen bleiben Teil der eigenen Relevanzsteuerung",
      "Rechte können jederzeit widerrufen werden",
      "Keine Marketing- oder Tracking-Cookies auf der Website",
      "PRE ALPHA heißt: Funktionen werden transparent geprüft",
    ],
  },
});

export default function MarketingInfoPage() {
  const { slug } = useParams();
  const page = pages[slug || ""];

  if (!page) return <Navigate to="/home" replace />;

  const Icon = page.icon || EyeOff;

  return (
    <div className="sm-page">
      <div className="sm-stack">
        <Navbar />

        <main className="sm-shell py-10 sm:py-14">
          <section className="sm-card-soft p-7 sm:p-10 sm-rise">
            <p className="sm-badge">{page.badge}</p>
            <div className="mt-5 flex h-12 w-12 items-center justify-center rounded-md bg-slate-950 text-[var(--sm-accent)]">
              <Icon size={22} />
            </div>
            <h1 className="mt-5 max-w-4xl text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">{page.title}</h1>
            <p className="sm-section-copy max-w-4xl">{page.lead}</p>
            {page.heroActions?.length ? (
              <div className="mt-6 flex flex-wrap gap-3">
                {page.heroActions.map((action) => (
                  <Link
                    key={action.to}
                    to={action.to}
                    className={`${action.variant === "primary" ? "sm-btn-primary" : "sm-btn-secondary"} gap-2`}
                  >
                    {action.label} <ArrowRight size={16} />
                  </Link>
                ))}
              </div>
            ) : null}
          </section>

          <section className="mt-6 grid gap-4 md:grid-cols-2">
            {page.points.map((point) => (
              <article key={point} className="sm-card p-5 sm-rise">
                <p className="flex items-center gap-3 text-lg font-extrabold text-slate-900">
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--sm-accent-strong)]" />
                  {point}
                </p>
              </article>
            ))}
          </section>

          {page.note ? (
            <section className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-950 sm:text-base">
              {page.note}
            </section>
          ) : null}

          <section className="mt-8 sm-card-strong p-7 sm:p-9 sm-rise">
            <h2 className="text-2xl font-extrabold sm:text-3xl">Ruhig, lokal, klar gekennzeichnet.</h2>
            <p className="mt-3 max-w-3xl text-blue-50">
              StepsMatch bleibt bewusst präzise: kein Dealportal-Versprechen, kein Dauerfeuer, keine falschen Partner-Aussagen.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to={page.cta.to} className="sm-btn-secondary gap-2">
                {page.cta.label} <ArrowRight size={16} />
              </Link>
              <Link to="/home" className="sm-btn-ghost">Zur Startseite</Link>
            </div>
          </section>
        </main>

        <SiteFooter />
      </div>
    </div>
  );
}
