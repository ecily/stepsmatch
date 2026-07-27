import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { GoogleMap, Circle } from "@react-google-maps/api";
import { Save, Trash2 } from "lucide-react";

import axiosInstance from "../api/axios";
import {
  CONTENT_TYPE_OPTIONS,
  GEO_VALIDITY_OPTIONS,
  OFFER_POLICY_DEFAULTS,
  PUBLIC_VISIBILITY_OPTIONS,
  PUSH_ELIGIBILITY_OPTIONS,
  PUSH_PRIORITY_OPTIONS,
  normalizeActiveTimeWindows,
} from "../utils/offerPolicy";

const mapContainerStyle = { width: "100%", height: "300px" };
const MAX_IMAGES = 3;

const EditOfferForm = () => {
  const { offerId } = useParams();
  const navigate = useNavigate();
  const API_BASE = (axiosInstance?.defaults?.baseURL || import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

  const [providerLocation, setProviderLocation] = useState(null);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    category: "",
    subcategory: "",
    categoryId: "",
    subcategoryId: "",
    description: "",
    radius: 100,
    validDays: [],
    validTimes: { start: "", end: "" },
    validDates: { from: "", to: "" },
    contact: "",
    images: [],
    provider: "",
    ...OFFER_POLICY_DEFAULTS,
  });

  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const isGoogleLoaded = typeof window !== "undefined" && typeof window.google !== "undefined" && window.google.maps;

  const formatDateInput = (dateString) => {
    if (!dateString) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString;
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "";
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await axiosInstance.get("categories");
        setCategories(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Fehler Kategorien:", err);
      }
    };

    const fetchOffer = async () => {
      try {
        const res = await axiosInstance.get(`offers/${offerId}`);
        const d = res.data || {};
        setFormData({
          name: d.name || "",
          category: d.category || "",
          subcategory: d.subcategory || "",
          categoryId: d.categoryId?._id || d.categoryId || "",
          subcategoryId: d.subcategoryId?._id || d.subcategoryId || "",
          description: d.description || "",
          radius: d.radius ?? d.radiusMeters ?? 100,
          validDays: Array.isArray(d.activeDays) ? d.activeDays : Array.isArray(d.validDays) ? d.validDays : [],
          validTimes: {
            start: d.activeTimeWindows?.[0]?.from || d.validTimes?.start || d.validTimes?.from || "",
            end: d.activeTimeWindows?.[0]?.to || d.validTimes?.end || d.validTimes?.to || "",
          },
          validDates: {
            from: formatDateInput(d.validFrom || d.validDates?.from),
            to: formatDateInput(d.validTo || d.validDates?.to),
          },
          contact: d.contact || "",
          images: Array.isArray(d.images) ? d.images : [],
          provider: d.provider?._id || d.provider || "",
          contentType: d.contentType || OFFER_POLICY_DEFAULTS.contentType,
          publicVisibility: d.publicVisibility || OFFER_POLICY_DEFAULTS.publicVisibility,
          demoLabel: d.demoLabel || OFFER_POLICY_DEFAULTS.demoLabel,
          pushEligibility: d.pushEligibility || OFFER_POLICY_DEFAULTS.pushEligibility,
          suggestedPushPriority: d.suggestedPushPriority || OFFER_POLICY_DEFAULTS.suggestedPushPriority,
          matchReason: d.matchReason || "",
          riskNote: d.riskNote || OFFER_POLICY_DEFAULTS.riskNote,
          sourceUrl: d.sourceUrl || "",
          sourceVerifiedAt: formatDateInput(d.sourceVerifiedAt),
          geoValidity: d.geoValidity || OFFER_POLICY_DEFAULTS.geoValidity,
          cooldownSuggestionHours: d.cooldownSuggestionHours ?? OFFER_POLICY_DEFAULTS.cooldownSuggestionHours,
        });
        setProviderLocation(Array.isArray(d.location?.coordinates) ? d.location.coordinates : null);
      } catch {
        setError("Angebot konnte nicht geladen werden.");
      }
    };

    fetchCategories();
    fetchOffer();
  }, [offerId]);

  useEffect(() => {
    const cat = categories.find((c) => c.name === formData.category);
    const subs = Array.isArray(cat?.subcategories) ? cat.subcategories : [];
    setSubcategories(subs);
    if (formData.subcategory && !subs.includes(formData.subcategory)) {
      setFormData((p) => ({ ...p, subcategory: "" }));
    }
  }, [formData.category, formData.subcategory, categories]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "categoryId") {
      const selected = categories.find((c) => String(c._id) === String(value));
      setFormData((prev) => ({ ...prev, categoryId: value, category: selected?.name || "", subcategoryId: "", subcategory: "" }));
    } else if (name === "subcategoryId") {
      const selected = subcategories.find((sc) => String(sc._id) === String(value));
      setFormData((prev) => ({ ...prev, subcategoryId: value, subcategory: selected?.name || "" }));
    } else if (name.includes(".")) {
      const [parent, child] = name.split(".");
      setFormData((prev) => ({ ...prev, [parent]: { ...prev[parent], [child]: value } }));
    } else if (name === "radius" || name === "cooldownSuggestionHours") {
      const n = Number(value);
      setFormData((prev) => ({ ...prev, [name]: Number.isFinite(n) ? n : prev[name] }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const toggleArrayItem = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].includes(value) ? prev[field].filter((v) => v !== value) : [...prev[field], value],
    }));
  };

  const handleImageChange = async (e) => {
    const incoming = Array.from(e.target.files || []);
    if (incoming.length === 0) return;

    const remaining = Math.max(0, MAX_IMAGES - formData.images.length);
    const files = incoming.slice(0, remaining);
    if (files.length === 0) {
      setError(`Maximal ${MAX_IMAGES} Bilder erlaubt.`);
      return;
    }

    try {
      setUploading(true);
      const fd = new FormData();
      files.forEach((f) => fd.append("images", f));

      const resp = await fetch(`${API_BASE}/uploads/images?folder=offers`, {
        method: "POST",
        body: fd,
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.ok) {
        const msg = data?.error || `Upload fehlgeschlagen (HTTP ${resp.status}).`;
        throw new Error(msg);
      }

      const urls = (data.images || []).map((i) => i.url).filter(Boolean);
      setFormData((prev) => ({ ...prev, images: [...prev.images, ...urls].slice(0, MAX_IMAGES) }));
    } catch (err) {
      setError(err?.message || "Fehler beim Hochladen der Bilder.");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = async (index) => {
    const imageUrl = formData.images[index];
    try {
      await axiosInstance.delete("uploads", { data: { url: imageUrl } });
    } catch (err) {
      console.error("Cloudinary Delete:", err);
    }
    setFormData((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if ((!formData.categoryId && !formData.category) || (!formData.subcategoryId && !formData.subcategory)) return setError("Kategorie und Subkategorie müssen gewählt werden.");
    if ((formData.description || "").length > 250) return setError("Beschreibung darf maximal 250 Zeichen haben.");
    if (!formData.provider) return setError("Provider-ID fehlt.");
    if (!Array.isArray(providerLocation) || providerLocation.length !== 2) return setError("Ungültige Geo-Koordinaten (GeoJSON [lng, lat]).");

    try {
      const payload = {
        ...formData,
        radius: Number(formData.radius) || 0,
        radiusMeters: Number(formData.radius) || 0,
        validFrom: formData.validDates?.from || null,
        validTo: formData.validDates?.to || null,
        activeDays: formData.validDays,
        activeTimeWindows: normalizeActiveTimeWindows(formData.validTimes),
        cooldownSuggestionHours: Number(formData.cooldownSuggestionHours) || null,
        sourceVerifiedAt: formData.sourceVerifiedAt || null,
        location: { type: "Point", coordinates: providerLocation },
      };
      await axiosInstance.put(`offers/${offerId}`, payload);
      setSuccess(true);
      setTimeout(() => navigate(`/dashboard/${formData.provider}`), 800);
    } catch (err) {
      setError(err.response?.data?.error || "Fehler beim Aktualisieren");
    }
  };

  const center = Array.isArray(providerLocation) && providerLocation.length === 2 ? { lat: providerLocation[1], lng: providerLocation[0] } : null;

  return (
    <div className="sm-page">
      <div className="sm-stack sm-shell py-8 sm:py-10">
        <div className="mx-auto w-full max-w-4xl sm-card p-6 sm:p-8">
          <h1 className="text-3xl font-extrabold">Angebot bearbeiten</h1>
          {error && <p className="sm-error mt-4">{error}</p>}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label className="sm-label" htmlFor="edit-offer-name">Name</label>
              <input id="edit-offer-name" name="name" value={formData.name} onChange={handleChange} required className="sm-input" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="sm-label" htmlFor="edit-offer-category">Kategorie</label>
                <select id="edit-offer-category" name="category" value={formData.category} onChange={handleChange} required className="sm-select">
                  <option value="">Kategorie wählen</option>
                  {categories.map((cat, idx) => (
                    <option key={idx} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="sm-label" htmlFor="edit-offer-subcategory">Subkategorie</label>
                <select id="edit-offer-subcategory" name="subcategory" value={formData.subcategory} onChange={handleChange} required className="sm-select">
                  <option value="">Subkategorie wählen</option>
                  {subcategories.map((sub, idx) => (
                    <option key={idx} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="sm-label" htmlFor="edit-offer-description">Beschreibung (max. 250)</label>
              <textarea id="edit-offer-description" name="description" value={formData.description} onChange={handleChange} maxLength={250} rows={3} className="sm-textarea" />
              <p className="mt-2 text-xs text-slate-500">
                Keine Preise, Rabatte, Oeffnungszeiten oder Partnerclaims eintragen, solange sie nicht freigegeben sind.
              </p>
            </div>

            <div>
              <label className="sm-label" htmlFor="edit-offer-radius">Radius (m)</label>
              <input id="edit-offer-radius" type="number" name="radius" value={formData.radius} onChange={handleChange} min={0} className="sm-input" />
            </div>

            {center && isGoogleLoaded ? (
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <GoogleMap mapContainerStyle={mapContainerStyle} zoom={14} center={center}>
                  <Circle center={center} radius={Number(formData.radius) || 0} options={{ fillColor: "#3b82f6", fillOpacity: 0.2, strokeColor: "#2563eb", strokeOpacity: 0.8, strokeWeight: 2 }} />
                </GoogleMap>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-600">Karte nicht geladen (Google Maps Script wird zentral geladen).</div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="sm-label" htmlFor="edit-valid-from">Gültig ab</label>
                <input id="edit-valid-from" type="date" name="validDates.from" value={formData.validDates.from} onChange={handleChange} className="sm-input" />
              </div>
              <div>
                <label className="sm-label" htmlFor="edit-valid-to">Gültig bis</label>
                <input id="edit-valid-to" type="date" name="validDates.to" value={formData.validDates.to} onChange={handleChange} className="sm-input" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="sm-label" htmlFor="edit-time-start">Startzeit</label>
                <input id="edit-time-start" type="time" name="validTimes.start" value={formData.validTimes.start} onChange={handleChange} className="sm-input" />
              </div>
              <div>
                <label className="sm-label" htmlFor="edit-time-end">Endzeit</label>
                <input id="edit-time-end" type="time" name="validTimes.end" value={formData.validTimes.end} onChange={handleChange} className="sm-input" />
              </div>
            </div>

            <div>
              <label className="sm-label" htmlFor="edit-offer-contact">Kontakt (optional)</label>
              <input id="edit-offer-contact" name="contact" value={formData.contact} onChange={handleChange} className="sm-input" />
            </div>

            <div>
              <label className="sm-label">Gültige Tage</label>
              <div className="flex flex-wrap gap-2">
                {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => (
                  <button
                    type="button"
                    key={day}
                    onClick={() => toggleArrayItem("validDays", day)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                      formData.validDays.includes(day)
                        ? "border-emerald-300 bg-emerald-100 text-emerald-800"
                        : "border-slate-300 bg-white text-slate-600"
                    }`}
                  >
                    {day.slice(0, 2)}
                  </button>
                ))}
              </div>
            </div>

            <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
              <div>
                <h2 className="text-lg font-extrabold text-amber-950">Pitch-/Policy-Steuerung</h2>
                <p className="mt-1 text-sm text-amber-900">
                  Sichtbarkeit und Push bewusst setzen. Unsichere Inhalte bleiben In-App oder Silent, High Attention nur als Ausnahme.
                </p>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="sm-label" htmlFor="edit-contentType">Content-Typ</label>
                  <select id="edit-contentType" name="contentType" value={formData.contentType} onChange={handleChange} className="sm-select">
                    {CONTENT_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="sm-label" htmlFor="edit-publicVisibility">Sichtbarkeit</label>
                  <select id="edit-publicVisibility" name="publicVisibility" value={formData.publicVisibility} onChange={handleChange} className="sm-select">
                    {PUBLIC_VISIBILITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="sm-label" htmlFor="edit-pushEligibility">Push-Eignung</label>
                  <select id="edit-pushEligibility" name="pushEligibility" value={formData.pushEligibility} onChange={handleChange} className="sm-select">
                    {PUSH_ELIGIBILITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="sm-label" htmlFor="edit-suggestedPushPriority">Push-Prioritaet</label>
                  <select id="edit-suggestedPushPriority" name="suggestedPushPriority" value={formData.suggestedPushPriority} onChange={handleChange} className="sm-select">
                    {PUSH_PRIORITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="sm-label" htmlFor="edit-geoValidity">Geo-Gueltigkeit</label>
                  <select id="edit-geoValidity" name="geoValidity" value={formData.geoValidity} onChange={handleChange} className="sm-select">
                    {GEO_VALIDITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="sm-label" htmlFor="edit-cooldownSuggestionHours">Cooldown-Vorschlag (Stunden)</label>
                  <input id="edit-cooldownSuggestionHours" type="number" min={1} name="cooldownSuggestionHours" value={formData.cooldownSuggestionHours} onChange={handleChange} className="sm-input" />
                </div>
              </div>

              <div className="mt-4 grid gap-4">
                <div>
                  <label className="sm-label" htmlFor="edit-demoLabel">Demo-Label</label>
                  <input id="edit-demoLabel" name="demoLabel" value={formData.demoLabel} onChange={handleChange} className="sm-input" />
                </div>
                <div>
                  <label className="sm-label" htmlFor="edit-matchReason">Match-Grund</label>
                  <textarea id="edit-matchReason" name="matchReason" value={formData.matchReason} onChange={handleChange} rows={2} className="sm-textarea" />
                </div>
                <div>
                  <label className="sm-label" htmlFor="edit-riskNote">Risiko-/Review-Hinweis</label>
                  <textarea id="edit-riskNote" name="riskNote" value={formData.riskNote} onChange={handleChange} rows={2} className="sm-textarea" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="sm-label" htmlFor="edit-sourceUrl">Quelle URL</label>
                    <input id="edit-sourceUrl" type="url" name="sourceUrl" value={formData.sourceUrl} onChange={handleChange} className="sm-input" placeholder="https://..." />
                  </div>
                  <div>
                    <label className="sm-label" htmlFor="edit-sourceVerifiedAt">Quelle geprueft am</label>
                    <input id="edit-sourceVerifiedAt" type="date" name="sourceVerifiedAt" value={formData.sourceVerifiedAt} onChange={handleChange} className="sm-input" />
                  </div>
                </div>
              </div>
            </section>

            <div className="sm-card-soft p-4">
              <label className="sm-label" htmlFor="edit-offer-images">Bilder (max. {MAX_IMAGES})</label>
              <input
                id="edit-offer-images"
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageChange}
                disabled={uploading || formData.images.length >= MAX_IMAGES}
                className="sm-input file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700"
              />
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {formData.images.map((img, idx) => (
                  <div key={idx} className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <img src={img} alt={`Bild ${idx + 1}`} className="h-24 w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute right-2 top-2 hidden rounded-full bg-red-600 p-1 text-white group-hover:block"
                      title="Bild entfernen"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {success && <p className="sm-success">Angebot aktualisiert.</p>}
            <button type="submit" disabled={uploading} className="sm-btn-primary gap-2">
              <Save size={16} /> {uploading ? "Lädt..." : "Änderungen speichern"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditOfferForm;
