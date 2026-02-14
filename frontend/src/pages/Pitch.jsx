import React from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";

export default function Pitch() {
  return (
    <div className="min-h-screen text-slate-900">
      <Navbar />

      <section className="sm-shell py-14 md:py-20">
        <div className="sm-card p-8 md:p-10">
          <p className="text-sm font-semibold text-sky-700">Investor Summary</p>
          <h1 className="mt-2 text-4xl md:text-6xl font-black tracking-tight">StepsMatch baut die Infrastruktur für Zero-Search.</h1>
          <p className="mt-5 text-lg text-slate-700 max-w-3xl">
            Statt Suche entsteht ein Live-Marketplace: Angebote und Nachfrage treffen sich automatisch durch Ort, Zeit und Interesse.
          </p>
        </div>
      </section>

      <section className="sm-shell pb-16 grid md:grid-cols-3 gap-5">
        <div className="sm-card p-6">
          <h2 className="text-xl font-bold">Marktproblem</h2>
          <p className="mt-2 text-slate-600">Lokale Werbung hat viel Streuverlust. Nutzer ignorieren irrelevante Signale.</p>
        </div>
        <div className="sm-card p-6">
          <h2 className="text-xl font-bold">Unsere Lösung</h2>
          <p className="mt-2 text-slate-600">Realtime-Matching mit klaren Triggern: Enter, Exit, Heartbeat.</p>
        </div>
        <div className="sm-card p-6">
          <h2 className="text-xl font-bold">Moat</h2>
          <p className="mt-2 text-slate-600">Privacy-first Architektur plus operative Zuverlässigkeit im Background.</p>
        </div>
      </section>

      <section className="sm-shell pb-16">
        <div className="rounded-3xl bg-sky-700 text-white p-8 md:p-10">
          <h3 className="text-3xl font-extrabold">Was wir bauen, ist neu und sofort verständlich.</h3>
          <p className="mt-3 text-sky-100 max-w-3xl">Menschen müssen Angebote nicht mehr suchen. Anbieter müssen Menschen nicht mehr raten. StepsMatch verbindet beides im richtigen Moment.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="mailto:hello@stepsmatch.com" className="rounded-full bg-white px-5 py-3 font-semibold text-sky-800">Investor Kontakt</a>
            <Link to="/home" className="rounded-full border border-white/40 px-5 py-3 font-semibold">Zur Landing</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

