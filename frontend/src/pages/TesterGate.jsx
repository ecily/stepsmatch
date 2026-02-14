import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axiosInstance from "../api/axios";

export default function TesterGate() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/home";

  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const accepted = localStorage.getItem("stepsmatch_ndaa_accepted") === "1";
    if (accepted) navigate(next, { replace: true });
  }, [navigate, next]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("stepsmatch_tester_key");
      if (saved && typeof saved === "string") setKey(saved);
    } catch (e) {
      void e;
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
      const res = await axiosInstance.post("/testers/validate", { key: trimmed });
      if (res?.data?.ok) {
        localStorage.setItem("stepsmatch_tester_key", trimmed);
        if (res?.data?.tester) localStorage.setItem("stepsmatch_tester_info", JSON.stringify(res.data.tester));
        navigate("/nda", { replace: true });
      } else {
        setErrorMsg("Ungültiger Key. Bitte überprüfe deine Eingabe.");
      }
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || "Validierung derzeit nicht möglich.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="max-w-xl mx-auto sm-card p-7 md:p-8">
        <h1 className="text-3xl font-extrabold tracking-tight">Tester-Zugang</h1>
        <p className="mt-2 text-slate-600">Diese Vorabversion ist nur für eingeladene Tester. Bitte gib deinen Key ein.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="testerKey" className="block text-sm font-semibold text-slate-800">Tester-Key</label>
            <input id="testerKey" type="text" value={key} onChange={(e) => setKey(e.target.value)} disabled={loading} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2" placeholder="z. B. SM-2025-ALPHA" />
          </div>

          {errorMsg ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMsg}</div> : null}

          <button type="submit" disabled={loading} className={`w-full rounded-xl px-4 py-2 font-semibold text-white ${loading ? "bg-sky-300" : "bg-sky-600 hover:bg-sky-700"}`}>
            {loading ? "Prüfe Key..." : "Weiter"}
          </button>
        </form>
      </div>
    </div>
  );
}

