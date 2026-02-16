import React from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";

const blocks = [
  {
    title: "Problem",
    text: "Lokale Werbung hat hohen Streuverlust, weil sie selten den richtigen Moment trifft.",
  },
  {
    title: "Lösung",
    text: "Realtime Matching über Ort, Zeit und Interesse mit Push in Hintergrund-Szenarien.",
  },
  {
    title: "Nutzen",
    text: "Mehr relevante Nutzerkontakte für Anbieter, weniger Suchaufwand für Endnutzer.",
  },
];

export default function Pitch() {
  return (
    <div className="min-h-screen text-slate-900 bg-[#f8fcff]">
      <Navbar />

      <section className="sm-shell py-12 md:py-16">
        <div className="rounded-3xl border border-sky-100 bg-white p-8 md:p-10 shadow-sm">
          <p className="text-sm font-semibold text-sky-700">Investor Summary</p>
          <h1 className="mt-2 text-4xl md:text-6xl font-black tracking-tight">StepsMatch baut die Infrastruktur für Zero-Search im Alltag.</h1>
          <p className="mt-4 text-lg text-slate-700 max-w-3xl">Nicht Suche als Ausgangspunkt, sondern Relevanz im richtigen Moment. Genau dort entsteht monetarisierbarer Mehrwert.</p>
        </div>
      </section>

      <section className="sm-shell pb-12 grid md:grid-cols-3 gap-4">
        {blocks.map((b) => (
          <article key={b.title} className="rounded-3xl border border-sky-100 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">{b.title}</h2>
            <p className="mt-2 text-slate-700">{b.text}</p>
          </article>
        ))}
      </section>

      <section className="sm-shell pb-16">
        <div className="rounded-3xl border border-sky-200 bg-sky-700 p-8 md:p-10 text-white">
          <h3 className="text-3xl font-extrabold">Klarer Fit: lokale Nachfrage in Echtzeit</h3>
          <p className="mt-3 text-sky-100 max-w-3xl">StepsMatch verbindet Angebotsdichte, Laufwege und Interessen zu einem Live-Marketplace für die reale Welt.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="mailto:hello@stepsmatch.com" className="rounded-full bg-white px-5 py-3 font-semibold text-sky-800">Investor Kontakt</a>
            <Link to="/home" className="rounded-full border border-white/40 px-5 py-3 font-semibold">Zur Landing</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
