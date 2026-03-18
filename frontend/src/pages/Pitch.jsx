import React from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Building2, Gauge, Target } from "lucide-react";

import Navbar from "../components/Navbar";

const blocks = [
  {
    icon: <Target className="h-5 w-5 text-blue-700" />,
    title: "Problem",
    text: "Lokale Werbung trifft den Kontext oft nicht und erzeugt hohen Streuverlust.",
  },
  {
    icon: <Gauge className="h-5 w-5 text-blue-700" />,
    title: "Lösung",
    text: "Realtime-Matching über Ort, Zeit und Interesse mit zuverlässigem Push-Trigger.",
  },
  {
    icon: <Building2 className="h-5 w-5 text-blue-700" />,
    title: "Business-Impact",
    text: "Mehr relevante Kontakte für Anbieter, bessere Conversion und weniger Suchaufwand für Nutzer.",
  },
];

export default function Pitch() {
  return (
    <div className="sm-page">
      <div className="sm-stack">
        <Navbar />

        <section className="sm-shell py-10 sm:py-14">
          <div className="sm-card-soft p-7 sm:p-10 sm-rise">
            <p className="sm-badge">Investor Summary</p>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
              StepsMatch baut die Infrastruktur
              <br />
              für Zero-Search im Alltag.
            </h1>
            <p className="sm-section-copy max-w-4xl">
              Die Plattform monetarisiert Relevanz im Moment: statt Reichweite um jeden
              Preis entsteht ein präziser Match zwischen lokalen Angeboten und realem Bedarf.
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

        <section className="sm-shell pb-16 sm:pb-20">
          <div className="sm-card-strong p-8 sm:p-10 sm-rise sm-delay-2">
            <h3 className="text-3xl font-extrabold sm:text-4xl">Lokale Nachfrage in Echtzeit ist ein klarer Category-Fit</h3>
            <p className="mt-3 max-w-3xl text-blue-50 sm:text-lg">
              StepsMatch verbindet Angebotsdichte, Laufwege und persönliche Präferenzen
              zu einem Live-Marketplace mit hoher operativer Präzision.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="mailto:hello@stepsmatch.com" className="sm-btn-secondary gap-2">
                Investor Kontakt <ArrowUpRight size={16} />
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
