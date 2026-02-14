import React from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import logoIcon from "../assets/stepsmatch-icon.svg";

export default function WhyStepsMatch() {
  return (
    <div className="min-h-screen text-slate-900">
      <Navbar />

      <section className="sm-shell py-14 md:py-18">
        <div className="sm-card p-8 md:p-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
            <img src={logoIcon} alt="StepsMatch" className="h-4 w-4" /> Warum StepsMatch wirklich neu ist
          </span>
          <h1 className="mt-4 text-4xl md:text-6xl font-black tracking-tight">finden. nicht suchen.</h1>
          <p className="mt-4 text-lg text-slate-700 max-w-3xl">
            Klassische Plattformen warten darauf, dass Menschen aktiv suchen.
            StepsMatch dreht das um: Das passende Angebot findet den Menschen – nur wenn Ort, Zeit und Interesse gleichzeitig passen.
          </p>
        </div>
      </section>

      <section className="sm-shell pb-16 grid md:grid-cols-3 gap-5">
        <div className="sm-card p-6">
          <h2 className="text-xl font-bold">Bisher</h2>
          <p className="mt-2 text-slate-700">Suche, Filter, Scrollen, viele irrelevante Treffer.</p>
        </div>
        <div className="sm-card p-6">
          <h2 className="text-xl font-bold">Mit StepsMatch</h2>
          <p className="mt-2 text-slate-700">Nur relevante Hinweise im richtigen Moment. Sonst Ruhe.</p>
        </div>
        <div className="sm-card p-6">
          <h2 className="text-xl font-bold">Mehrwert</h2>
          <p className="mt-2 text-slate-700">Nutzer sparen Aufmerksamkeit. Anbieter sparen Streuverlust.</p>
        </div>
      </section>

      <section className="sm-shell pb-16">
        <div className="rounded-3xl border border-sky-100 bg-white p-8">
          <h3 className="text-2xl font-extrabold">Der MVP ganz klar</h3>
          <ol className="mt-4 space-y-2 text-slate-700 list-decimal pl-5">
            <li>Anbieter stellt ein lokales Angebot mit Radius und Zeitfenster ein.</li>
            <li>Nutzer wählt Interessen.</li>
            <li>Kommt der Nutzer in Reichweite und passt das Timing, sendet StepsMatch den Hinweis.</li>
            <li>Ein Tap öffnet das Angebot und auf Wunsch die Navigation.</li>
          </ol>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/register" className="sm-btn-primary">Als Anbieter starten</Link>
            <Link to="/home" className="sm-btn-secondary">Zur Landing</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
