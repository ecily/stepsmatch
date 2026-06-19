import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpenText, Clock3, Footprints, Sparkles } from "lucide-react";

import Navbar from "../components/Navbar";
import SiteFooter from "../components/SiteFooter";
import { getPreferredSiteText } from "../content/siteContent";

export default function WhyStepsMatch() {
  const text = React.useMemo(() => getPreferredSiteText(), []);

  return (
    <div className="sm-page">
      <div className="sm-stack">
        <Navbar />

        <section className="sm-shell py-10 sm:py-14 lg:py-16">
          <div className="sm-card-soft p-7 sm:p-10 sm-rise">
            <p className="sm-badge">
              <BookOpenText size={14} /> StepsMatch Produktkern
            </p>
            <h1 className="sm-hero-title mt-5 max-w-4xl text-[clamp(2.2rem,6vw,4.5rem)]">{text.way.title}</h1>
            <p className="sm-section-copy max-w-4xl">{text.way.intro}</p>
          </div>
        </section>

        <section className="sm-shell pb-16 sm:pb-20">
          <div className="grid gap-4">
            {text.way.posts.map((post, idx) => (
              <article key={post.slug} className={`sm-card p-6 sm:p-7 sm-rise sm-delay-${Math.min((idx % 3) + 1, 3)}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="sm-badge !text-[11px]">
                    <Footprints size={13} /> Produktnotiz
                  </p>
                  <p className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600">
                    <Clock3 size={13} /> 4 Min Lesezeit
                  </p>
                </div>

                <h2 className="mt-4 text-2xl font-extrabold sm:text-3xl">{post.title}</h2>
                <p className="mt-3 text-base font-semibold text-slate-700">{post.excerpt}</p>
                <p className="mt-3 text-slate-700">{post.content}</p>
              </article>
            ))}
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <div className="sm-card-strong p-8 sm:p-10 sm-rise sm-delay-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-yellow-300/50 bg-yellow-300/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-yellow-100">
                <Sparkles size={14} /> Interne Alpha
              </div>
              <h3 className="mt-4 text-3xl font-extrabold sm:text-4xl">Der Kern wird auf echten Geräten geprüft.</h3>
              <p className="mt-3 max-w-3xl text-blue-50 sm:text-lg">
                StepsMatch macht lokale Relevanz prüfbar: Nähe, Interesse, aktives Angebot
                und ein Hinweis, wenn der Kontext passt.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/home?apk=1" className="sm-btn-secondary gap-2">
                  Mobile-App testen <ArrowRight size={16} />
                </Link>
                <Link to="/home" className="sm-btn-ghost">
                  Zur Startseite
                </Link>
              </div>
            </div>

            <div className="sm-card p-8 sm:p-10 sm-rise sm-delay-2">
              <p className="sm-badge">Anbieter</p>
              <h3 className="mt-4 text-3xl font-extrabold sm:text-4xl">Menschen in Reichweite erreichen, wenn der Kontext passt.</h3>
              <p className="mt-3 text-slate-700 sm:text-lg">
                StepsMatch bringt Angebote in den Kontext von Nähe, Interesse und Verfügbarkeit. Anbieter pflegen Angebote,
                Radius und Laufzeit; die App prüft die Relevanz im mobilen Nutzungskontext.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/register" className="sm-btn-primary">Als Anbieter starten</Link>
                <Link to="/login" className="sm-btn-secondary">Anbieter Login</Link>
              </div>
            </div>
          </div>
        </section>

        <SiteFooter />
      </div>
    </div>
  );
}
