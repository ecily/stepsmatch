import React from "react";
import { Link } from "react-router-dom";

import Navbar from "../components/Navbar";
import SiteFooter from "../components/SiteFooter";
import { getPreferredSiteText } from "../content/siteContent";

export default function ImpressumPage() {
  const text = React.useMemo(() => getPreferredSiteText(), []);
  const imprint = text.impressum;
  const phone = String(imprint.phone || "").trim();
  const showPhone = phone && phone.toLowerCase() !== "keine telefonnummer angegeben";

  return (
    <div className="sm-page">
      <div className="sm-stack">
        <Navbar />

        <main className="sm-shell py-10 sm:py-14">
          <section className="sm-card-soft p-7 sm:p-9 sm-rise">
            <h1 className="sm-section-title">{imprint.title}</h1>
            <p className="sm-section-copy">{imprint.lead}</p>
          </section>

          <section className="mt-6 grid gap-4">
            <article className="sm-card p-6 sm-rise">
              <h2 className="text-xl font-bold sm:text-2xl">Angaben zur Anbieterin / zum Anbieter</h2>
              <p className="mt-3 text-slate-700"><strong>Projekt:</strong> {imprint.projectName}</p>
              <p className="mt-1 text-slate-700"><strong>Rechtsform:</strong> {imprint.legalForm}</p>
              <p className="mt-1 text-slate-700"><strong>Name:</strong> {imprint.ownerName}</p>
              <p className="mt-1 text-slate-700"><strong>Adresse:</strong> {imprint.addressLine1}</p>
              <p className="mt-1 text-slate-700">{imprint.addressLine2}</p>
              <p className="mt-1 text-slate-700">{imprint.country}</p>
              <p className="mt-3 text-slate-700"><strong>E-Mail:</strong> {imprint.email}</p>
              {showPhone ? <p className="mt-1 text-slate-700"><strong>Telefon (optional):</strong> {phone}</p> : null}
            </article>

            <article className="sm-card p-6 sm-rise sm-delay-1">
              <h2 className="text-xl font-bold sm:text-2xl">Offenlegung nach Mediengesetz</h2>
              <p className="mt-3 text-slate-700"><strong>Medieninhaber:</strong> {imprint.mediaOwner}</p>
              <p className="mt-1 text-slate-700"><strong>Unternehmensgegenstand / Zweck:</strong> {imprint.purpose}</p>
              <p className="mt-1 text-slate-700"><strong>Blattlinie:</strong> {imprint.editorialLine}</p>
            </article>

            <article className="sm-card p-6 sm-rise sm-delay-2">
              <h2 className="text-xl font-bold sm:text-2xl">Rechtlicher Hinweis</h2>
              <p className="mt-3 text-slate-700">{imprint.sourceLabel}</p>
              <p className="mt-2 text-slate-700">
                UID / Firmenbuchnummer / Aufsichtsbehörde: nicht relevant, da rein privat und derzeit ohne
                finanzielle Tätigkeit betrieben.
              </p>
              <p className="mt-2 text-slate-700">
                Für verbindliche rechtliche Beurteilungen ist eine individuelle Rechtsberatung erforderlich.
              </p>
            </article>
          </section>

          <section className="mt-8 sm-card-strong p-7 sm:p-9 sm-rise sm-delay-2">
            <h3 className="text-2xl font-extrabold sm:text-3xl">Mehr Informationen</h3>
            <p className="mt-3 max-w-3xl text-blue-50">
              Datenschutz- und Cookie-Hinweise findest du auf der Datenschutz-Seite.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/privacy" className="sm-btn-secondary">
                Datenschutz
              </Link>
              <Link to="/home" className="sm-btn-ghost">
                Zur Startseite
              </Link>
            </div>
          </section>
        </main>

        <SiteFooter />
      </div>
    </div>
  );
}
