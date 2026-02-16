import React from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#f8fcff] text-slate-900">
      <Navbar />

      <main className="sm-shell py-10 md:py-14">
        <section className="rounded-3xl border border-sky-100 bg-white p-7 md:p-9 shadow-sm">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">Datenschutz- und Cookie-Hinweise</h1>
          <p className="mt-3 text-slate-700">
            Diese Seite informiert über den Einsatz von Cookies und ähnlichen Technologien auf StepsMatch.
          </p>
        </section>

        <section className="mt-6 rounded-3xl border border-sky-100 bg-white p-7 shadow-sm">
          <h2 className="text-2xl font-bold">1. Welche Technologien werden genutzt?</h2>
          <p className="mt-2 text-slate-700">
            Derzeit werden nur technisch notwendige Technologien verwendet, insbesondere lokal gespeicherte
            Zustände (Local Storage), damit zentrale Funktionen der Seite funktionieren.
          </p>
          <ul className="mt-3 list-disc pl-5 text-slate-700 space-y-1">
            <li>Tester-Zugang und NDA-Status</li>
            <li>Session-nahe Zustände für Navigation und Bedienbarkeit</li>
            <li>Sicherheits- und Funktionszustände der Anwendung</li>
          </ul>
        </section>

        <section className="mt-6 rounded-3xl border border-sky-100 bg-white p-7 shadow-sm">
          <h2 className="text-2xl font-bold">2. Wofür werden sie genutzt?</h2>
          <p className="mt-2 text-slate-700">
            Ausschließlich, um von dir angeforderte Funktionen bereitzustellen (z. B. geschützte Seitenzugänge,
            korrekte Weiterleitungen und stabile Nutzung der Anwendung).
          </p>
        </section>

        <section className="mt-6 rounded-3xl border border-sky-100 bg-white p-7 shadow-sm">
          <h2 className="text-2xl font-bold">3. Werden Analyse- oder Marketing-Cookies gesetzt?</h2>
          <p className="mt-2 text-slate-700">
            Aktuell nein. Es werden derzeit keine Analyse- oder Marketing-Cookies eingesetzt.
          </p>
        </section>

        <section className="mt-6 rounded-3xl border border-sky-100 bg-white p-7 shadow-sm">
          <h2 className="text-2xl font-bold">4. Speicherdauer und Widerruf</h2>
          <p className="mt-2 text-slate-700">
            Notwendige Einträge bleiben je nach Zweck gespeichert. Du kannst sie jederzeit in deinem Browser löschen
            (z. B. Website-Daten/Local Storage). Danach werden bestimmte Komfort- oder Zugangszustände zurückgesetzt.
          </p>
        </section>

        <section className="mt-6 rounded-3xl border border-sky-100 bg-white p-7 shadow-sm">
          <h2 className="text-2xl font-bold">5. Rechtsgrundlagen (EU/DE)</h2>
          <p className="mt-2 text-slate-700">
            Für technisch notwendige Speicher-/Zugriffsvorgänge gilt die Ausnahme für unbedingt erforderliche
            Technologien. Die anschließende Datenverarbeitung erfolgt auf Grundlage der jeweils einschlägigen
            datenschutzrechtlichen Rechtsgrundlagen.
          </p>
          <p className="mt-2 text-slate-600 text-sm">
            Hinweis: Diese Informationen dienen der Transparenz und ersetzen keine individuelle Rechtsberatung.
          </p>
        </section>

        <div className="mt-8">
          <Link to="/home" className="sm-btn-secondary">Zurück zur Startseite</Link>
        </div>
      </main>
    </div>
  );
}
