import React, { useState } from "react";

import axiosInstance from "../api/axios";

const initialForm = {
  name: "",
  email: "",
  organization: "",
  role: "",
  region: "",
  message: "",
  confidentialityAccepted: false,
  contactConsentAccepted: false,
  website: "",
};

export default function TesterKeyRequestForm({ source = "tester-page" }) {
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (event) => {
    const { name, value, checked, type } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus({ type: "", message: "" });
    setIsSubmitting(true);
    try {
      await axiosInstance.post("/testers/request-key", { ...form, source });
      setForm(initialForm);
      setStatus({
        type: "success",
        message: "Danke. Deine Anfrage wurde gesendet. Andreas prüft sie und meldet sich mit einem Tester-Key.",
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: error?.response?.data?.message || "Die Anfrage konnte gerade nicht gesendet werden. Bitte versuche es später erneut.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-5 border-t border-slate-200 pt-5">
      <h3 className="text-xl font-extrabold text-slate-950">Tester-Key anfordern</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        StepsMatch befindet sich in der Pre-Alpha. Der App-Test ist derzeit nur für freigegebene Tester vorgesehen. Sende eine kurze Anfrage, wenn du Zugang erhalten möchtest.
      </p>

      {status.message ? <div className={status.type === "success" ? "sm-success mt-4" : "sm-error mt-4"} role="status">{status.message}</div> : null}

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true">
          <label htmlFor="tester-request-website">Website</label>
          <input id="tester-request-website" name="website" value={form.website} onChange={updateField} tabIndex={-1} autoComplete="off" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="tester-request-name" className="sm-label">Name *</label>
            <input id="tester-request-name" name="name" value={form.name} onChange={updateField} required maxLength={120} className="sm-input" autoComplete="name" />
          </div>
          <div>
            <label htmlFor="tester-request-email" className="sm-label">E-Mail *</label>
            <input id="tester-request-email" name="email" type="email" value={form.email} onChange={updateField} required maxLength={320} className="sm-input" autoComplete="email" />
          </div>
          <div>
            <label htmlFor="tester-request-organization" className="sm-label">Firma/Organisation <span className="font-normal text-slate-500">(optional)</span></label>
            <input id="tester-request-organization" name="organization" value={form.organization} onChange={updateField} maxLength={160} className="sm-input" autoComplete="organization" />
          </div>
          <div>
            <label htmlFor="tester-request-role" className="sm-label">Rolle/Interesse <span className="font-normal text-slate-500">(optional)</span></label>
            <input id="tester-request-role" name="role" value={form.role} onChange={updateField} maxLength={160} className="sm-input" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="tester-request-region" className="sm-label">Ort/Region <span className="font-normal text-slate-500">(optional)</span></label>
            <input id="tester-request-region" name="region" value={form.region} onChange={updateField} maxLength={160} className="sm-input" autoComplete="address-level2" />
          </div>
        </div>
        <div>
          <label htmlFor="tester-request-message" className="sm-label">Warum möchtest du testen? <span className="font-normal text-slate-500">(optional, empfohlen)</span></label>
          <textarea id="tester-request-message" name="message" value={form.message} onChange={updateField} maxLength={2000} rows={2} className="sm-textarea" />
        </div>
        <label htmlFor="tester-request-confidentiality" className="flex items-start gap-3 text-sm leading-relaxed text-slate-700">
          <input id="tester-request-confidentiality" name="confidentialityAccepted" type="checkbox" checked={form.confidentialityAccepted} onChange={updateField} required className="mt-1 h-4 w-4 rounded border-slate-300" />
          <span>Ich bestätige, dass ich Pre-Alpha-Inhalte vertraulich behandle und keine APKs, Screenshots oder Zugangsdaten öffentlich weitergebe. *</span>
        </label>
        <label htmlFor="tester-request-contact" className="flex items-start gap-3 text-sm leading-relaxed text-slate-700">
          <input id="tester-request-contact" name="contactConsentAccepted" type="checkbox" checked={form.contactConsentAccepted} onChange={updateField} required className="mt-1 h-4 w-4 rounded border-slate-300" />
          <span>Ich bin damit einverstanden, dass meine Angaben zur Bearbeitung der Tester-Anfrage verwendet und Andreas Franz per E-Mail Kontakt mit mir aufnehmen darf. *</span>
        </label>
        <button type="submit" disabled={isSubmitting} className="sm-btn-primary !w-full">
          {isSubmitting ? "Anfrage wird gesendet..." : "Tester-Key anfordern"}
        </button>
      </form>
    </div>
  );
}
