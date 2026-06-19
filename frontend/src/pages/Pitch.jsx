import React from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Building2, Gauge, Target } from "lucide-react";

import Navbar from "../components/Navbar";

const blocks = [
  {
    icon: <Target className="h-5 w-5 text-blue-700" />,
    title: "Produktproblem",
    text: "Lokale Angebote sind oft vorhanden, aber nicht im richtigen Moment relevant sichtbar.",
  },
  {
    icon: <Gauge className="h-5 w-5 text-blue-700" />,
    title: "Ansatz",
    text: "Matching über Nähe, Interesse und aktive Angebote. Die Mobile-App prüft, ob Hinweise verlässlich ausgelöst werden.",
  },
  {
    icon: <Building2 className="h-5 w-5 text-blue-700" />,
    title: "Anbieter-Nutzen",
    text: "Anbieter erstellen Angebote, setzen Radius und Laufzeit und erreichen Menschen in Reichweite, wenn der Kontext passt.",
  },
];

const investorSignals = [
  "Mobile-App als Produktkern: Background-Heartbeat, Push und Geofence werden auf echten Geräten getestet",
  "Relevanzlogik: Nähe + Interesse + aktives Angebot statt Suche-first oder Branchenbuch",
  "Anbieter-Werkzeug: Angebot erstellen, Radius und Zeitfenster pflegen, lokale Reichweite prüfen",
  "Interne Alpha: Fokus auf Verlässlichkeit, klare Texte und saubere Konfiguration",
];

const competitiveLens = [
  {
    app: "Google Maps / Local Discovery",
    strength: "Hohe Reichweite und starke Kartennutzung",
    gap: "Keine fokussierte Interessen- und Angebotslogik fuer lokale Echtzeit-Trigger",
  },
  {
    app: "Groupon / Deal-Portale",
    strength: "Deal-Dichte und bekannte Angebotsmechanik",
    gap: "Primaer Pull-basiert, wenig Kontext ueber aktuellen Weg",
  },
  {
    app: "Delivery-Apps / Nearby Feeds",
    strength: "Hohe Nutzung im konkreten Bestellmoment",
    gap: "Angebote selten kontextgetrieben auf Naehe + Zeitfenster + Interessen",
  },
];

export default function Pitch() {
  return (
    <div className="sm-page">
      <div className="sm-stack">
        <Navbar />

        <section className="sm-shell py-10 sm:py-14">
          <div className="sm-card-soft p-7 sm:p-10 sm-rise">
            <p className="sm-badge">Produktklarheit</p>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
              StepsMatch testet den Kern
              <br />
              für lokale Relevanz.
            </h1>
            <p className="sm-section-copy max-w-4xl">
              Relevante lokale Angebote. Zur richtigen Zeit. Am richtigen Ort. Der Fokus liegt aktuell
              auf interner Alpha, Mobile-Verlässlichkeit und verständlicher Anbietersteuerung.
            </p>
          </div>
        </section>

        <section className="sm-shell pb-12">
          <div className="grid gap-4 md:grid-cols-3">
            {blocks.map((block, idx) => (
              <article key={block.title} className={`sm-card p-6 sm-rise sm-delay-${Math.min(idx + 1, 3)}`}>
                <div className="mb-3 inline-flex rounded-xl border border-blue-200 bg-blue-50 p-2">{block.icon}</div>
                <h2 className="text-xl font-bold">{block.title}</h2>
                <p className="mt-2 text-slate-700">{block.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="sm-shell pb-12">
          <div className="sm-card p-6 sm:p-8 sm-rise sm-delay-1">
            <h2 className="text-2xl font-extrabold sm:text-3xl">Abgrenzung</h2>
            <p className="mt-2 text-slate-700">
              StepsMatch ist kein Branchenbuch, kein Dealportal und keine Social-Ad-Fläche. Entscheidend ist die lokale Passung.
            </p>

            <div className="mt-5 overflow-x-auto sm-table-wrap">
              <table className="sm-table">
                <thead>
                  <tr>
                    <th>Kategorie</th>
                    <th>Staerke</th>
                    <th>Gap</th>
                  </tr>
                </thead>
                <tbody>
                  {competitiveLens.map((row) => (
                    <tr key={row.app}>
                      <td className="font-bold text-slate-800">{row.app}</td>
                      <td className="text-slate-700">{row.strength}</td>
                      <td className="text-slate-700">{row.gap}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="sm-shell pb-12">
          <div className="grid gap-4 md:grid-cols-2">
            {investorSignals.map((item, idx) => (
              <article key={item} className={`sm-card-soft p-6 sm-rise sm-delay-${Math.min(idx + 1, 3)}`}>
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-blue-700">Fokus {idx + 1}</p>
                <p className="mt-2 text-slate-800">{item}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="sm-shell pb-16 sm:pb-20">
          <div className="sm-card-strong p-8 sm:p-10 sm-rise sm-delay-2">
            <h3 className="text-3xl font-extrabold sm:text-4xl">Der nächste Schritt ist Verlässlichkeit im echten Nutzungskontext</h3>
            <p className="mt-3 max-w-3xl text-blue-50 sm:text-lg">
              Die Website erklärt den Produktweg. Die Mobile-App bleibt der eigentliche Core:
              Nähe, Interesse, aktives Angebot und ein ruhiger Hinweis, wenn der Kontext passt.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="mailto:hello@stepsmatch.com" className="sm-btn-secondary gap-2">
                Kontakt aufnehmen <ArrowUpRight size={16} />
              </a>
              <Link to="/home" className="sm-btn-ghost">
                Zur Landing
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
