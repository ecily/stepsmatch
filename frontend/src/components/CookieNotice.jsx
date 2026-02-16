import React from "react";
import { Link } from "react-router-dom";

const CONSENT_KEY = "sm.cookie.notice.v1";

export default function CookieNotice() {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    try {
      const seen = localStorage.getItem(CONSENT_KEY) === "1";
      if (!seen) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const acceptNotice = () => {
    try {
      localStorage.setItem(CONSENT_KEY, "1");
    } catch {
      // ignore
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[10000] p-3 md:p-4">
      <div className="mx-auto max-w-5xl rounded-2xl border border-sky-200 bg-white/98 p-4 shadow-2xl backdrop-blur">
        <p className="text-sm text-slate-800">
          Wir verwenden derzeit nur technisch notwendige Cookies/ähnliche Speichertechnologien
          (z. B. für Login-/Tester-Zustand und Sicherheit). Es werden aktuell keine Analyse-
          oder Marketing-Cookies gesetzt.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={acceptNotice}
            className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
          >
            Verstanden
          </button>
          <Link
            to="/privacy"
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Datenschutzhinweise
          </Link>
        </div>
      </div>
    </div>
  );
}
