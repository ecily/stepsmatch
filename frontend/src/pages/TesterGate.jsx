import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axiosInstance from "../api/axios";

/**
 * TesterGate
 * - Eingabe & Validierung des Tester-Keys (Backend-Route folgt).
 * - Persistenz: Der gültige Tester-Key wird unter "stepsmatch_tester_key"
 *   in localStorage gespeichert (siehe axios-Interceptor).
 * - Rehydration: Beim Mount wird der Key aus localStorage in das Inputfeld geladen,
 *   sodass Reloads konsistent sind und der Header X-Tester-Key weiter gesetzt bleibt.
 * - Ist NDA bereits akzeptiert (localStorage), leiten wir direkt weiter (next oder /home).
 */
export default function TesterGate() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/home";

  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // 1) Direkt weiter, falls NDA bereits akzeptiert
  useEffect(() => {
    const accepted = localStorage.getItem("stepsmatch_ndaa_accepted") === "1";
    if (accepted) {
      navigate(next, { replace: true });
    }
  }, [navigate, next]);

  // 2) UI-Rehydration: vorhandenen Tester-Key aus localStorage ins Input übernehmen
  useEffect(() => {
    try {
      const saved = localStorage.getItem("stepsmatch_tester_key");
      if (saved && typeof saved === "string") {
        setKey(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    const trimmed = key.trim().toUpperCase();
    if (!trimmed) {
      setErrorMsg("Bitte gib deinen Tester-Key ein.");
      return;
    }

    setLoading(true);
    try {
      // Erwartete Response: { ok: true, tester: { key, name, email } }
      const res = await axiosInstance.post("/testers/validate", { key: trimmed });

      if (res?.data?.ok) {
        // Persistenz: gültigen Key & optional Tester-Info speichern
        localStorage.setItem("stepsmatch_tester_key", trimmed);
        if (res?.data?.tester) {
          localStorage.setItem("stepsmatch_tester_info", JSON.stringify(res.data.tester));
        }
        // NDA als nächstes (wird später mit echter NDA-Seite ersetzt)
        navigate("/nda", { replace: true });
      } else {
        setErrorMsg("Ungültiger Key. Bitte überprüfe deine Eingabe.");
      }
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        "Validierung derzeit nicht möglich. Bitte später erneut versuchen.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.card} role="region" aria-label="Testerzugang">
        <div style={styles.logoRow}>
          <div style={styles.logoCircle} aria-hidden>S</div>
          <div style={styles.brand}>
            <div style={styles.brandTitle}>StepsMatch</div>
            <div style={styles.brandTagline}>finden. nicht suchen.</div>
          </div>
        </div>

        <h1 style={styles.title}>Tester-Zugang</h1>
        <p style={styles.subtitle}>
          Diese Vorabversion ist ausschließlich für eingeladene Tester. Bitte gib deinen persönlichen Tester-Key ein.
        </p>

        <form onSubmit={handleSubmit} style={styles.form} aria-describedby="formHint">
          <label htmlFor="testerKey" style={styles.label}>Tester-Key</label>
          <input
            id="testerKey"
            name="testerKey"
            type="text"
            inputMode="latin"
            autoCapitalize="characters"
            placeholder="z. B. SM-2025-ALPHA-7K3Q"
            autoFocus
            value={key}
            onChange={(e) => setKey(e.target.value)}
            style={styles.input}
            disabled={loading}
            aria-invalid={Boolean(errorMsg)}
          />

          <div aria-live="polite" style={{ minHeight: 22 }}>
            {errorMsg ? <div style={styles.error}>{errorMsg}</div> : null}
          </div>

          <button type="submit" style={styles.button} disabled={loading} aria-busy={loading}>
            {loading ? "Prüfe Key …" : "Weiter"}
          </button>

          <div id="formHint" style={styles.hint}>
            Probleme? <a href="mailto:hello@stepsmatch.com" style={styles.link}>hello@stepsmatch.com</a>
          </div>
        </form>

        <div style={styles.footerNote}>
          Diese Vorabversion ist ausschließlich für Testzwecke bestimmt.
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 600px at 80% -10%, #e9f2ff 0%, transparent 60%), radial-gradient(900px 600px at -10% 110%, #f5f5ff 0%, transparent 60%), #ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 520,
    background: "#fff",
    border: "1px solid rgba(0,0,0,0.06)",
    borderRadius: 20,
    boxShadow: "0 12px 40px rgba(0,0,0,0.08)",
    padding: 28,
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  logoCircle: {
    height: 42,
    width: 42,
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
  brand: { display: "flex", flexDirection: "column" },
  brandTitle: { fontWeight: 800, fontSize: 18, lineHeight: "20px" },
  brandTagline: { color: "#6b7280", fontSize: 13 },
  title: { marginTop: 10, fontSize: 22, fontWeight: 800 },
  subtitle: { color: "#4b5563", marginTop: 4, marginBottom: 16, lineHeight: 1.5 },
  form: { display: "flex", flexDirection: "column", gap: 10 },
  label: { fontSize: 13, color: "#374151", fontWeight: 600 },
  input: {
    height: 48,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    padding: "0 14px",
    outline: "none",
    fontSize: 15,
  },
  button: {
    height: 48,
    borderRadius: 12,
    background: "linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%)",
    color: "#fff",
    fontWeight: 700,
    fontSize: 15,
    border: "none",
    cursor: "pointer",
    marginTop: 6,
  },
  error: {
    background: "#fef2f2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    padding: "10px 12px",
    borderRadius: 10,
    fontSize: 13,
  },
  hint: { marginTop: 8, fontSize: 13, color: "#6b7280" },
  link: { color: "#2563eb", textDecoration: "none", fontWeight: 600 },
  footerNote: {
    marginTop: 18,
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center",
  },
};
