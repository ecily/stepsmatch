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

      // 🔜 Backend folgt in Schritt 3 — hier schon versuchen zu loggen
      // Expected: { ok: true }
      try {
        await axiosInstance.post("/testers/accept", {
          key: testerKey,
          ndaVersion: NDA_VERSION,
        });
      } catch (err) {
        // Sanftes Fallback: Wir lassen den User dennoch rein.
        console.warn("[NDA] accept log failed (will be added in step 3)", err?.response?.data || err?.message);
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
            <div style={styles.metaRow}><span style={styles.metaKey}>E‑Mail:</span><span>{testerInfo?.email || "—"}</span></div>
            <div style={styles.metaRow}><span style={styles.metaKey}>Key:</span><code style={styles.key}>{testerKey}</code></div>
          </div>

          <div style={styles.metaNote}>
            Diese „Click‑Wrap“‑Vereinbarung ist für die Pre‑Seed‑Testphase gedacht. Kein Tracking, nur technisch notwendige Cookies.
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
              Ich habe die Vertraulichkeitsvereinbarung gelesen und **stimme zu**.
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
      <h1>Vertraulichkeitsvereinbarung (NDA) – Pre‑Seed‑Testphase</h1>
      <p><em>Hinweis: Dieses Dokument ist ein praxisnahes Muster für Österreich und ersetzt keine Rechtsberatung.</em></p>

      <h2>1. Parteien und Zweck</h2>
      <p>
        Diese Vertraulichkeitsvereinbarung („<strong>Vereinbarung</strong>“) wird zwischen der
        <strong> StepsMatch ECILY e.U.</strong> (nachfolgend „<strong>StepsMatch</strong>“) und der in der Testerdatenbank
        hinterlegten Person („<strong>Tester</strong>“) geschlossen. Zweck ist die vertrauliche Evaluierung der
        StepsMatch‑Lösung in einer frühen Entwicklungsphase („<strong>Pre‑Seed‑Testphase</strong>“).
      </p>

      <h2>2. Vertrauliche Informationen</h2>
      <p>
        „<strong>Vertrauliche Informationen</strong>“ sind alle nicht‑öffentlichen Informationen, die StepsMatch dem
        Tester direkt oder indirekt zugänglich macht, einschließlich, aber nicht beschränkt auf: Konzepte, Geschäftsmodelle,
        Produkt‑ und Roadmap‑Informationen, Designs, Quell‑ und Objektcode, APIs, Datenmodelle, technische Dokumentation,
        Algorithmen, Prototypen, Usability‑Erkenntnisse, Preise, Markt‑ und Finanzinformationen sowie sämtliche Kopien
        und daraus abgeleitete Erkenntnisse. Mündliche Informationen gelten als vertraulich, wenn ihre Vertraulichkeit den
        Umständen nach erkennbar ist.
      </p>

      <h2>3. Pflichten des Testers</h2>
      <ol>
        <li>Vertrauliche Informationen strikt geheim halten und nur zur Evaluierung des Produkts verwenden.</li>
        <li>Keine Weitergabe an Dritte ohne vorherige schriftliche Zustimmung von StepsMatch.</li>
        <li>Angemessene technische und organisatorische Maßnahmen zum Schutz ergreifen.</li>
        <li>Keine Reverse‑Engineering‑, Dekompilierungs‑ oder Ableitungsversuche.</li>
        <li>Unverzügliche Mitteilung an StepsMatch bei tatsächlicher oder drohender unbefugter Offenlegung.</li>
      </ol>

      <h2>4. Ausnahmen</h2>
      <p>
        Die Verpflichtungen gelten nicht für Informationen, die (a) ohne Verstoß allgemein bekannt sind/werden,
        (b) dem Tester rechtmäßig und ohne Geheimhaltungspflicht von Dritten zugänglich wurden, (c) der Tester
        unabhängig und ohne Rückgriff auf vertrauliche Informationen entwickelt hat oder (d) aufgrund zwingender
        gesetzlicher Vorschriften oder behördlicher/gerichtlicher Anordnung offenzulegen sind (sofern rechtlich zulässig,
        informiert der Tester StepsMatch vorab).
      </p>

      <h2>5. Laufzeit und Rückgabe</h2>
      <p>
        Diese Vereinbarung gilt ab Akzeptanz und während der gesamten Testphase sowie darüber hinaus für
        <strong> drei (3) Jahre</strong> nach deren Ende. Auf Anforderung von StepsMatch löscht oder gibt der Tester
        alle vertraulichen Informationen zurück und bestätigt dies schriftlich.
      </p>

      <h2>6. Rechte, Lizenzen, Feedback</h2>
      <p>
        Es werden keine Rechte oder Lizenzen an geistigem Eigentum übertragen. Der Tester räumt StepsMatch ein
        nicht‑exklusives, unentgeltliches Recht ein, bereitgestelltes Feedback in Produkt und Geschäftsmodell zu
        integrieren.
      </p>

      <h2>7. Datenschutz (DSGVO)</h2>
      <p>
        StepsMatch verarbeitet Tester‑Daten (Name, E‑Mail, Tester‑Key, Zeitpunkte von Eingabe/Akzeptanz) ausschließlich
        zur Zugangskontrolle und Dokumentation der NDA (<em>Art. 6 Abs. 1 lit. b bzw. f DSGVO</em>).
        Keine Weitergabe an Dritte. Aufbewahrung: grund­sätzlich bis 90 Tage nach Ende der Testphase, danach Löschung
        bzw. Anonymisierung. Betroffenenrechte nach Art. 12 ff DSGVO bleiben unberührt. Weitere Details siehe
        Datenschutzhinweis auf der Website.
      </p>

      <h2>8. Rechtswahl und Gerichtsstand</h2>
      <p>
        Es gilt materielles Recht der <strong>Republik Österreich</strong> unter Ausschluss seiner Kollisionsnormen.
        Für Streitigkeiten ist, soweit zulässig, der <strong>zuständige Gerichtsstand Wien</strong> vereinbart.
      </p>

      <h2>9. Schlussbestimmungen</h2>
      <p>
        Sollten einzelne Bestimmungen unwirksam sein/werden, bleibt die Wirksamkeit der übrigen unberührt;
        an die Stelle tritt eine Regelung, die dem wirtschaftlichen Zweck am nächsten kommt. Änderungen und
        Ergänzungen bedürfen der Schriftform; E‑Mail genügt. Diese klick‑wrap Akzeptanz gilt als wirksame
        Zustimmung.
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
