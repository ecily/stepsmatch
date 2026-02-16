import React from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import logoIcon from "../assets/stepsmatch-icon.svg";

const pillars = [
  {
    title: "1. Anbieter definiert Kontext",
    text: "Radius bis 2 km, Kategorie und Zeitfenster - damit das Angebot nur dann erscheint, wenn es wirklich Sinn macht.",
  },
  {
    title: "2. User definiert Interesse",
    text: "User entscheidet, was relevant ist. Keine permanente Suche, keine endlosen Feeds.",
  },
  {
    title: "3. Match passiert im Moment",
    text: "Wenn Ort, Zeit und Interesse zusammenkommen, sendet StepsMatch den Hinweis. Sonst bleibt es ruhig.",
  },
];

export default function WhyStepsMatch() {
  return (
    <div className="min-h-screen text-slate-900 bg-[#f8fcff]">
      <Navbar />

      <section className="sm-shell py-12 md:py-16">
        <div className="rounded-3xl border border-sky-100 bg-white p-8 md:p-10 shadow-sm">
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
            <img src={logoIcon} alt="StepsMatch" className="h-4 w-4" /> Warum StepsMatch neuartig ist
          </span>
          <h1 className="mt-4 text-4xl md:text-6xl font-black tracking-tight">finden. nicht suchen.</h1>
          <p className="mt-4 text-lg text-slate-700 max-w-3xl">Die Neuheit liegt nicht im Anzeigen von Angeboten, sondern im Timing. StepsMatch bringt Angebot und Nachfrage erst dann zusammen, wenn die Situation wirklich passt.</p>
        </div>
      </section>

      <section className="sm-shell pb-12 grid md:grid-cols-3 gap-4">
        {pillars.map((p) => (
          <article key={p.title} className="rounded-3xl border border-sky-100 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">{p.title}</h2>
            <p className="mt-2 text-slate-700">{p.text}</p>
          </article>
        ))}
      </section>

      <section className="sm-shell pb-16">
        <div className="rounded-3xl border border-sky-200 bg-sky-700 p-8 md:p-10 text-white">
          <h3 className="text-3xl font-extrabold">Das Ergebnis für beide Seiten</h3>
          <p className="mt-3 text-sky-100 max-w-3xl">User bekommen relevante Hinweise ohne Suchstress. Anbieter erreichen Menschen in echter Nähe und im passenden Moment.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/register" className="rounded-full bg-white px-5 py-3 font-semibold text-sky-800">Als Anbieter starten</Link>
            <Link to="/home" className="rounded-full border border-white/40 px-5 py-3 font-semibold">Zur Landing</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
