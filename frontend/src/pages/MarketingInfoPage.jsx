import React from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowRight, EyeOff, ShieldCheck } from "lucide-react";

import Navbar from "../components/Navbar";
import SiteFooter from "../components/SiteFooter";

const pages = {
  "datenschutz-standort": {
    badge: "Standort & Datenschutz",
    title: "Standortfunktionen brauchen klare Kontrolle.",
    lead: "Standort und Benachrichtigungen sind Teil der Produktfunktion: relevante lokale Hinweise im passenden Moment. StepsMatch ist auf sparsame, zweckgebundene Standortnutzung ausgelegt.",
    icon: ShieldCheck,
    points: [
      "Standortfreigaben werden bewusst erteilt",
      "Interessen bleiben Teil der eigenen Relevanzsteuerung",
      "Rechte können jederzeit widerrufen werden",
      "Keine Marketing- oder Tracking-Cookies auf der Website",
      "PRE ALPHA heißt: Funktionen werden transparent geprüft",
    ],
    cta: { to: "/privacy", label: "Datenschutz lesen" },
  },
};

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
