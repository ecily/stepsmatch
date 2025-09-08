import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axiosInstance from "../api/axios";

/**
 * NDA Page (AT)
 * - Zeigt klick-wrap NDA.
 * - Erfordert Checkbox + (optional) bis zum Ende scrollen.
 * - Speichert lokales Flag und versucht einen Server-Log (/testers/accept).
 * - Wenn kein tester_key im localStorage -> zurück zum Gate (/).
 */

const NDA_VERSION = "v1.0";
const NDA_DATE = "20.08.2025"; // bei Änderungen anpassen

export default function NDA() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/home";

  const containerRef = useRef(null);

  const [checked, setChecked] = useState(false);
  const [scrolledEnd, setScrolledEnd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const testerKey = useMemo(() => localStorage.getItem("stepsmatch_tester_key") || "", []);
  const testerInfo = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("stepsmatch_tester_info") || "{}");
    } catch {
      return {};
    }
  }, []);

  // Falls schon akzeptiert -> direkt weiter
  useEffect(() => {
    const accepted = localStorage.getItem("stepsmatch_ndaa_accepted") === "1";
    if (accepted) {
      navigate(next, { replace: true });
    }
  }, [navigate, next]);

  // Wenn kein Key vorhanden -> zurück zum Gate
  useEffect(() => {
    if (!testerKey) {
      navigate("/", { replace: true });
    }
  }, [testerKey, navigate]);

  const onScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const reachedEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 12;
    if (reachedEnd) setScrolledEnd(true);
  };

  const handleAccept = async () => {
    setErrorMsg("");
    setSubmitting(true);
    try {
      // Lokalen Zustand direkt setzen (UX: sofortiger Zugang)
      localStorage.setItem("stepsmatch_ndaa_accepted", "1");
      localStorage.setItem("stepsmatch_ndaa_version", NDA_VERSION);
      localStorage.setItem("stepsmatch_ndaa_date", NDA_DATE);

      // Server-Log (best effort)
      try {
        await axiosInstance.post("/testers/accept", {
          key: testerKey,
          ndaVersion: NDA_VERSION,
        });
      } catch (err) {
        console.warn("[NDA] accept log failed", err?.response?.data || err?.message);
      }

      navigate(next, { replace: true });
    } catch (err) {
      setErrorMsg(
        err?.response?.data?.message || "Akzeptieren derzeit nicht möglich. Bitte später erneut versuchen."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <header style={styles.header}>
          <div style={styles.logoCircle} aria-hidden>S</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={styles.brandTitle}>StepsMatch</div>
            <div style={styles.brandTagline}>NDA – Vertraulichkeit</div>
          </div>
          <div style={{ marginLeft: "auto", color: "#6b7280", fontSize: 12 }}>
            Version {NDA_VERSION} · Stand {NDA_DATE}
          </div>
        </header>

        <section style={styles.meta}>
          <div style={styles.metaCard}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Tester</div>
            <div style={styles.metaRow}><span style={styles.metaKey}>Name:</span><span>{testerInfo?.name || "—"}</span></div>
            <div style={styles.metaRow}><span style={styles.metaKey}>E-Mail:</span><span>{testerInfo?.email || "—"}</span></div>
            <div style={styles.metaRow}><span style={styles.metaKey}>Key:</span><code style={styles.key}>{testerKey}</code></div>
          </div>

          <div style={styles.metaNote}>
            Diese „Click-Wrap“-Vereinbarung gilt für die Pre-Seed-Testphase. Es werden nur technisch notwendige Daten verarbeitet (siehe Abschnitt Datenschutz).
          </div>
        </section>

        <section style={styles.scrollWrap} ref={containerRef} onScroll={onScroll} aria-label="NDA Text">
          <NDAContent />
        </section>

        <section style={styles.consent}>
          <label style={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              disabled={submitting}
              aria-checked={checked}
              aria-describedby="nda-ack"
            />
            <span id="nda-ack">
              Ich habe die Vertraulichkeitsvereinbarung gelesen und <strong>stimme zu</strong>.
            </span>
          </label>

          <div style={styles.actions}>
            <button
              type="button"
              onClick={() => window.print()}
              style={styles.secondaryBtn}
              disabled={submitting}
            >
              Drucken / PDF speichern
            </button>

            <button
              type="button"
              onClick={handleAccept}
              style={{
                ...styles.primaryBtn,
                opacity: checked && scrolledEnd ? 1 : 0.6,
                cursor: checked && scrolledEnd ? "pointer" : "not-allowed",
              }}
              disabled={!checked || !scrolledEnd || submitting}
              aria-busy={submitting}
            >
              {submitting ? "Speichere Zustimmung …" : "Akzeptieren & fortfahren"}
            </button>
          </div>

          <div aria-live="polite" style={{ minHeight: 22, marginTop: 8 }}>
            {errorMsg ? <div style={styles.error}>{errorMsg}</div> : null}
            {!scrolledEnd ? (
              <div style={styles.hint}>Bitte bis zum Ende des Textes scrollen.</div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}

function NDAContent() {
  return (
    <div style={styles.doc}>
      <h1>Vertraulichkeitsvereinbarung (NDA) – Pre-Seed-Testphase</h1>

      <h2>1. Parteien und Zweck</h2>
      <p>
        Diese Vertraulichkeitsvereinbarung („<strong>Vereinbarung</strong>“) wird geschlossen zwischen der
        <strong> StepsMatch ECILY e.U.</strong>, Sitz in Österreich (nachfolgend „<strong>StepsMatch</strong>“),
        und der in der Testerdatenbank hinterlegten natürlichen Person (nachfolgend „<strong>Tester</strong>“).
        Zweck dieser Vereinbarung ist es, dem Tester vertrauliche Informationen von StepsMatch ausschließlich
        zur Evaluierung und Erprobung der StepsMatch-Lösung in einer frühen Entwicklungsphase
        („<strong>Pre-Seed-Testphase</strong>“) zugänglich zu machen.
      </p>

      <h2>2. Vertrauliche Informationen</h2>
      <p>
        „<strong>Vertrauliche Informationen</strong>“ sind sämtliche nicht öffentliche Informationen, gleich welcher
        Form (schriftlich, mündlich, elektronisch oder sonstiger Art), die StepsMatch dem Tester direkt oder indirekt
        offenlegt oder zugänglich macht, einschließlich, aber nicht beschränkt auf: Konzepte, Geschäftsmodelle,
        Produkt- und Roadmap-Informationen, Designdaten, Quell- und Objektcode, APIs, Datenmodelle, technische
        Dokumentation, Algorithmen, Prototypen, Nutzerfeedback, Usability-Erkenntnisse, Preise, Markt- und Finanzdaten,
        Geschäftsbeziehungen sowie alle Kopien, Notizen, Analysen oder Ableitungen hieraus. Die Tatsache der
        Zusammenarbeit und das Bestehen dieser Vereinbarung gelten ebenfalls als vertraulich.
      </p>

      <h2>3. Pflichten des Testers</h2>
      <ol>
        <li>Vertrauliche Informationen streng vertraulich behandeln und ausschließlich zum in Abschnitt&nbsp;1 genannten Zweck verwenden.</li>
        <li>Vertrauliche Informationen ohne vorherige schriftliche Zustimmung von StepsMatch weder ganz noch teilweise Dritten offenlegen.</li>
        <li>Angemessene technische und organisatorische Maßnahmen ergreifen, um Vertrauliche Informationen vor unbefugtem Zugriff zu schützen.</li>
        <li>Kein Reverse-Engineering, keine Dekompilierung, keine Ableitung von Quellcode oder Konkurrenzprodukte aus Vertraulichen Informationen.</li>
        <li>Unverzügliche schriftliche Mitteilung an StepsMatch bei tatsächlicher oder drohender unbefugter Offenlegung oder Nutzung.</li>
      </ol>

      <h2>4. Ausnahmen</h2>
      <p>
        Die Verpflichtungen dieser Vereinbarung gelten nicht für Informationen, die der Tester nachweislich (a) ohne
        Verstoß allgemein bekannt sind oder werden, (b) rechtmäßig und ohne Geheimhaltungspflicht von Dritten erhalten
        hat, (c) unabhängig und ohne Rückgriff auf Vertrauliche Informationen entwickelt hat oder (d) aufgrund zwingender
        gesetzlicher Vorschriften oder behördlicher/gerichtlicher Anordnung offenlegen muss; soweit rechtlich zulässig,
        informiert der Tester StepsMatch hierüber vorab und beschränkt die Offenlegung auf das zwingend Erforderliche.
      </p>

      <h2>5. Eigentum, Rückgabe und Löschung</h2>
      <p>
        Sämtliche Vertraulichen Informationen bleiben im Eigentum von StepsMatch. Auf Anforderung von StepsMatch hat der
        Tester alle Vertraulichen Informationen (einschließlich Kopien und Ableitungen) unverzüglich zurückzugeben oder
        zu löschen und schriftlich zu bestätigen, dass keine Vertraulichen Informationen zurückbehalten wurden.
      </p>

      <h2>6. Laufzeit</h2>
      <p>
        Diese Vereinbarung tritt mit der Akzeptanz durch den Tester in Kraft und gilt während der Pre-Seed-Testphase
        sowie für <strong>drei (3) Jahre</strong> nach deren Beendigung fort. Für als „Betriebs- und Geschäftsgeheimnisse“
        im Sinne der §§ 26 ff UWG qualifizierte Informationen gelten die Geheimhaltungspflichten zeitlich unbeschränkt,
        solange sie als solche fortbestehen.
      </p>

      <h2>7. Rechte, Lizenzen und Feedback</h2>
      <p>
        Durch diese Vereinbarung werden dem Tester keinerlei Rechte oder Lizenzen an geistigem Eigentum von StepsMatch
        eingeräumt. Der Tester räumt StepsMatch an übermitteltem Feedback ein einfaches, zeitlich und räumlich
        unbeschränktes, unentgeltliches Nutzungsrecht zur Integration in Produkte, Dienste und Geschäftsprozesse ein.
      </p>

      <h2>8. Datenschutz (DSGVO)</h2>
      <p>
        StepsMatch verarbeitet personenbezogene Daten des Testers (insb. Name, E-Mail, Tester-Key, Zeitpunkte von
        Eingabe/Akzeptanz) ausschließlich zur Zugangskontrolle, Vertragsdurchführung und Dokumentation dieser
        Vereinbarung (<em>Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;b und f DSGVO</em>). Eine Weitergabe an Dritte erfolgt nicht,
        außer wenn gesetzlich erforderlich. Speicherfrist: grundsätzlich bis 90 Tage nach Ende der Testphase, danach
        Löschung oder Anonymisierung. Die Betroffenenrechte nach Art.&nbsp;12 ff DSGVO (Auskunft, Berichtigung, Löschung,
        Einschränkung, Widerspruch) bleiben unberührt. Weitere Informationen finden sich im Datenschutzhinweis auf der Website.
      </p>

      <h2>9. Rechtsbehelfe, Unterlassung, Schadenersatz</h2>
      <p>
        Bei Verstößen gegen diese Vereinbarung ist StepsMatch berechtigt, neben Schadenersatz auch Unterlassungsansprüche
        (einschließlich einstweiliger Verfügungen) nach österreichischem Recht geltend zu machen. Die Geltendmachung
        weiterer Rechte bleibt unberührt.
      </p>

      <h2>10. Rechtswahl und Gerichtsstand</h2>
      <p>
        Es gilt das materielle Recht der <strong>Republik Österreich</strong> unter Ausschluss seiner Kollisionsnormen und
        des UN-Kaufrechts. Für alle Streitigkeiten aus oder im Zusammenhang mit dieser Vereinbarung ist, soweit
        zulässig, der <strong>zuständige Gerichtsstand Wien</strong> vereinbart.
      </p>

      <h2>11. Schlussbestimmungen</h2>
      <p>
        Änderungen und Ergänzungen dieser Vereinbarung bedürfen der Schriftform; E-Mail genügt. Sollten einzelne
        Bestimmungen unwirksam sein oder werden, berührt dies die Wirksamkeit der übrigen Bestimmungen nicht; an die
        Stelle der unwirksamen Bestimmung tritt eine wirksame Regelung, die dem wirtschaftlichen Zweck am nächsten
        kommt. Die elektronische Akzeptanz („Click-Wrap“) gilt als rechtsverbindliche Zustimmung.
      </p>

      <p style={{ marginTop: 16 }}>
        <strong>Akzeptanz:</strong> Durch Anklicken von „Akzeptieren &amp; fortfahren“ bestätigt der Tester die
        Kenntnisnahme und Zustimmung zu dieser Vereinbarung.
      </p>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f7f9fc",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  shell: {
    width: "100%",
    maxWidth: 860,
    background: "#fff",
    border: "1px solid rgba(0,0,0,0.06)",
    borderRadius: 20,
    boxShadow: "0 12px 40px rgba(0,0,0,0.08)",
    padding: 24,
    display: "grid",
    gridTemplateRows: "auto auto 1fr auto",
    gap: 16,
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    borderBottom: "1px solid #eef2f7",
    paddingBottom: 12,
  },
  logoCircle: {
    height: 40,
    width: 40,
    borderRadius: 12,
    background:
      "conic-gradient(from 210deg at 50% 50%, #1e90ff, #7aa6ff, #7ed6ff, #1e90ff)",
    color: "#fff",
    fontWeight: 700,
    fontSize: 18,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 6px 18px rgba(30,144,255,0.35)",
  },
  brandTitle: { fontWeight: 800, fontSize: 18, lineHeight: "20px" },
  brandTagline: { color: "#6b7280", fontSize: 13 },
  meta: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 16,
    alignItems: "start",
  },
  metaCard: {
    border: "1px solid #eef2f7",
    borderRadius: 14,
    padding: 14,
    background: "#fbfdff",
  },
  metaRow: { display: "flex", gap: 8, marginTop: 2, fontSize: 14 },
  metaKey: { color: "#6b7280", minWidth: 70, display: "inline-block" },
  key: {
    background: "#eef2ff",
    color: "#1e3a8a",
    padding: "0 6px",
    borderRadius: 6,
    fontSize: 13,
  },
  metaNote: { fontSize: 12, color: "#6b7280" },
  scrollWrap: {
    height: 380,
    overflow: "auto",
    border: "1px solid #eef2f7",
    borderRadius: 14,
    padding: "16px 18px",
    background: "#fff",
  },
  doc: { lineHeight: 1.6, color: "#1f2937", fontSize: 15 },
  consent: {
    borderTop: "1px solid #eef2f7",
    paddingTop: 12,
  },
  checkboxRow: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 10,
    fontSize: 14,
  },
  actions: {
    display: "flex",
    gap: 10,
    justifyContent: "flex-end",
    flexWrap: "wrap",
  },
  primaryBtn: {
    height: 46,
    borderRadius: 12,
    background: "linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%)",
    color: "#fff",
    fontWeight: 700,
    fontSize: 15,
    border: "none",
    padding: "0 16px",
  },
  secondaryBtn: {
    height: 46,
    borderRadius: 12,
    background: "#f3f4f6",
    color: "#111827",
    fontWeight: 600,
    fontSize: 14,
    border: "1px solid #e5e7eb",
    padding: "0 14px",
  },
  error: {
    background: "#fef2f2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    padding: "10px 12px",
    borderRadius: 10,
    fontSize: 13,
  },
  hint: { fontSize: 12, color: "#6b7280" },
};

