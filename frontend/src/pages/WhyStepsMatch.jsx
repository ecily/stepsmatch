import React from "react";
import { Link } from "react-router-dom";

import Navbar from "../components/Navbar";
import logoIcon from "../assets/stepsmatch-icon.svg";

const blocks = [
  {
    title: "Problem heute",
    text: "Nutzer suchen zu lange. Anbieter werben zu breit. Beide verlieren Zeit und Geld.",
  },
  {
    title: "Neu bei StepsMatch",
    text: "Nicht mehr suchen: Unser System matched Ort, Zeit und Interesse live.",
  },
  {
    title: "Ergebnis",
    text: "Nutzer sehen Relevantes. Anbieter erreichen echte Nähe. Genau im Moment der Entscheidung.",
  },
];

export default function WhyStepsMatch() {
  return (
    <div className="min-h-screen text-slate-900">
      <Navbar />

      <section className="sm-shell py-14 md:py-20">
        <div className="sm-card p-8 md:p-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
            <img src={logoIcon} alt="StepsMatch" className="h-4 w-4" />
            Warum StepsMatch anders ist
          </span>
          <h1 className="mt-4 text-4xl md:text-6xl font-black tracking-tight">finden. nicht suchen.</h1>
          <p className="mt-5 text-lg text-slate-700 max-w-3xl">
            StepsMatch ist eine echte Neuheit, weil Angebote nicht gesucht werden müssen.
            Sie erscheinen nur dann, wenn sie in deiner Nähe und für dich relevant sind.
          </p>
        </div>
      </section>

      <section className="sm-shell pb-16 grid md:grid-cols-3 gap-5">
        {blocks.map((b) => (
          <div key={b.title} className="sm-card p-6">
            <h2 className="text-xl font-bold">{b.title}</h2>
            <p className="mt-2 text-slate-600">{b.text}</p>
          </div>
        ))}
      </section>

      <section className="sm-shell pb-16">
        <div className="grid md:grid-cols-2 gap-5">
          <div className="sm-card p-7">
            <p className="text-sm font-semibold text-sky-700">Für Nutzer</p>
            <h3 className="mt-2 text-2xl font-bold">Nur das, was jetzt Sinn macht.</h3>
            <p className="mt-3 text-slate-700">Beispiel: Du bist in 120 m Nähe zu einem Angebot, das nur heute Mittag gilt. Genau dann kommt der Hinweis.</p>
          </div>
          <div className="sm-card p-7">
            <p className="text-sm font-semibold text-sky-700">Für Anbieter</p>
            <h3 className="mt-2 text-2xl font-bold">Dein Angebot trifft echte Laufkundschaft.</h3>
            <p className="mt-3 text-slate-700">Nicht tausend unscharfe Einblendungen, sondern Reichweite dort, wo Menschen wirklich vorbeikommen.</p>
          </div>
        </div>
      </section>

      <section className="sm-shell pb-16">
        <div className="rounded-3xl bg-white border border-sky-100 p-8">
          <h3 className="text-2xl font-extrabold">MVP, glasklar:</h3>
          <p className="mt-3 text-slate-700">Eine standortbasierte Plattform, die passende lokale Angebote zuverlässig ausspielt - per Push, im richtigen Moment, ohne Suche.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/register" className="sm-btn-primary">Als Anbieter starten</Link>
            <Link to="/home" className="sm-btn-secondary">Zur Landing</Link>
            <Link to="/admin/offers" className="sm-btn-secondary">Admin Demo</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
