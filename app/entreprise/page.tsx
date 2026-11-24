"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import AppShell from "@/app/components/AppShell";

type Entreprise = {
  id: string;
  raisonSociale: string;
  formeJuridique: string | null;
  ice: string;
  ifFiscal: string;
  rc: string;
  rcVille: string | null;
  tp: string | null;
  cnss: string | null;
  adresse: string;
  ville: string;
  telephone: string | null;
  email: string | null;
  capitalSocial: string | null;
  logoUrl: string | null;
};

type FormData = {
  raisonSociale: string;
  formeJuridique: string;
  ice: string;
  ifFiscal: string;
  rc: string;
  rcVille: string;
  tp: string;
  cnss: string;
  adresse: string;
  ville: string;
  telephone: string;
  email: string;
  capitalSocial: string;
  logoUrl: string;
};

type Feedback = { type: "success" | "error"; text: string };

const initialForm: FormData = {
  raisonSociale: "",
  formeJuridique: "",
  ice: "",
  ifFiscal: "",
  rc: "",
  rcVille: "",
  tp: "",
  cnss: "",
  adresse: "",
  ville: "",
  telephone: "",
  email: "",
  capitalSocial: "",
  logoUrl: "",
};

const FORMES_JURIDIQUES = [
  "SARL",
  "SARL AU",
  "SA",
  "SAS",
  "SASU",
  "Auto-entrepreneur",
  "Entreprise individuelle",
];

const inputClass =
  "w-full rounded-lg border border-[#dce1e7] bg-white px-3 py-2 text-sm text-[#18212f] placeholder:text-[#a0a7b1] outline-none transition focus:border-[#456f9f] focus:ring-2 focus:ring-[#456f9f]/20 disabled:cursor-not-allowed disabled:bg-[#f3f5f8] disabled:text-[#9aa2ad]";

const btnPrimary =
  "inline-flex items-center justify-center rounded-lg bg-[#456f9f] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#395f8a] disabled:cursor-not-allowed disabled:opacity-50";

/* -------------------------------------------------------------------------- */
/*  Composants communs                                                        */
/* -------------------------------------------------------------------------- */



function Field({
  label,
  htmlFor,
  required,
  hint,
  className = "",
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-sm font-medium text-[#3e4855]"
      >
        {label}
        {required && <span className="ml-0.5 text-red-600">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-[#89919d]">{hint}</p>}
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="grid gap-6 border-b border-[#e8ebef] px-6 py-6 last:border-b-0 lg:grid-cols-3">
      <div>
        <legend className="text-sm font-bold text-[#18212f]">{title}</legend>
        {description && (
          <p className="mt-1 text-xs leading-5 text-[#7b8490]">{description}</p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:col-span-2">{children}</div>
    </fieldset>
  );
}

export default function EntreprisePage() {
  const [entreprise, setEntreprise] = useState<Entreprise | null>(null);
  const [form, setForm] = useState<FormData>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [logoError, setLogoError] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  async function loadEntreprise() {
    try {
      setLoading(true);
      setFeedback(null);

      const response = await fetch("/api/entreprise");
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Erreur lors du chargement");
      }

      if (data.entreprise) {
        setEntreprise(data.entreprise);

        setForm({
          raisonSociale: data.entreprise.raisonSociale || "",
          formeJuridique: data.entreprise.formeJuridique || "",
          ice: data.entreprise.ice || "",
          ifFiscal: data.entreprise.ifFiscal || "",
          rc: data.entreprise.rc || "",
          rcVille: data.entreprise.rcVille || "",
          tp: data.entreprise.tp || "",
          cnss: data.entreprise.cnss || "",
          adresse: data.entreprise.adresse || "",
          ville: data.entreprise.ville || "",
          telephone: data.entreprise.telephone || "",
          email: data.entreprise.email || "",
          capitalSocial: data.entreprise.capitalSocial || "",
          logoUrl: data.entreprise.logoUrl || "",
        });
      }
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Erreur lors du chargement",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEntreprise();
  }, []);

  function handleChange(field: keyof FormData, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
    if (field === "logoUrl") setLogoError(false);
  }

  async function handleLogoUpload(file: File | undefined) {
    if (!file) return;
    setFeedback(null);
    if (!(["image/png", "image/jpeg"].includes(file.type)) || file.size > 2 * 1024 * 1024) {
      setFeedback({ type: "error", text: "Sélectionnez une image PNG ou JPEG de 2 Mo maximum." });
      return;
    }
    setUploadingLogo(true);
    try {
      const payload = new FormData();
      payload.append("logo", file);
      const response = await fetch("/api/upload/logo", { method: "POST", body: payload });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Échec de l'envoi du logo.");
      handleChange("logoUrl", result.logoUrl);
      setFeedback({ type: "success", text: "Logo importé. Enregistrez les modifications pour l'associer à l'entreprise." });
    } catch (error) {
      setFeedback({ type: "error", text: error instanceof Error ? error.message : "Erreur d'import du logo." });
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    if (
      !form.raisonSociale ||
      !form.ice ||
      !form.ifFiscal ||
      !form.rc ||
      !form.adresse ||
      !form.ville
    ) {
      setFeedback({
        type: "error",
        text: "Veuillez remplir tous les champs obligatoires.",
      });
      return;
    }

    try {
      setSaving(true);

      const method = entreprise ? "PUT" : "POST";

      const response = await fetch("/api/entreprise", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          capitalSocial: form.capitalSocial ? Number(form.capitalSocial) : null,
          formeJuridique: form.formeJuridique || null,
          rcVille: form.rcVille || null,
          tp: form.tp || null,
          cnss: form.cnss || null,
          telephone: form.telephone || null,
          email: form.email || null,
          logoUrl: form.logoUrl || null,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Erreur lors de l'enregistrement");
      }

      setEntreprise(data.entreprise);

      setFeedback({
        type: "success",
        text: entreprise
          ? "Les informations ont été modifiées avec succès."
          : "Entreprise créée avec succès.",
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Erreur lors de l'enregistrement",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="rounded-2xl border border-[#e1e6ec] bg-white px-6 py-12 text-center text-sm text-[#89919d] shadow-sm">
          Chargement des informations...
        </div>
      </AppShell>
    );
  }

  const logoValue = form.logoUrl.trim();

  return (
    <AppShell>
      <section className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Entreprise</h1>
        <p className="mt-1 text-sm text-[#6d7682]">
          Ces informations apparaissent sur vos factures et avoirs.
        </p>
      </section>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-[#e1e6ec] bg-white shadow-sm"
      >
        {/* Identité */}

        <Section
          title="Identité"
          description="Nom, statut juridique et logo affichés dans l'en-tête des documents."
        >
          <Field
            label="Raison sociale"
            htmlFor="raisonSociale"
            required
            className="md:col-span-2"
          >
            <input
              id="raisonSociale"
              value={form.raisonSociale}
              onChange={(e) => handleChange("raisonSociale", e.target.value)}
              className={inputClass}
              required
            />
          </Field>

          <Field label="Forme juridique" htmlFor="formeJuridique" className="md:col-span-2">
            <select
              id="formeJuridique"
              value={form.formeJuridique}
              onChange={(e) => handleChange("formeJuridique", e.target.value)}
              className={inputClass}
            >
              <option value="">Sélectionner</option>
              {FORMES_JURIDIQUES.map((forme) => (
                <option key={forme} value={forme}>
                  {forme}
                </option>
              ))}
            </select>
          </Field>

          

          <Field
            label="Logo de l'entreprise"
            htmlFor="logoFile"
            className="md:col-span-2"
            hint="Sélectionnez un fichier PNG ou JPEG (2 Mo maximum), puis enregistrez les modifications."
          >
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#e1e6ec] bg-[#fafbfc] text-[10px] text-[#a0a7b1]">
                {logoValue && !logoError ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoValue}
                    alt="Aperçu du logo"
                    onError={() => setLogoError(true)}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  "Logo"
                )}
              </div>
              <input
                id="logoFile"
                type="file"
                accept="image/png,image/jpeg"
                disabled={uploadingLogo || saving}
                onChange={(e) => {
                  void handleLogoUpload(e.target.files?.[0]);
                  e.target.value = "";
                }}
                className={inputClass}
              />
            </div>
            {uploadingLogo && <p className="mt-2 text-xs text-[#456f9f]">Import du logo en cours...</p>}
            {logoValue && <p className="mt-2 break-all text-xs text-[#89919d]">Fichier : {logoValue}</p>}
          </Field>
        </Section>

        {/* Informations légales */}

        <Section
          title="Informations légales"
          description="Identifiants fiscaux et commerciaux, repris dans le pied de page des documents."
        >
          <Field label="ICE" htmlFor="ice" required>
            <input
              id="ice"
              value={form.ice}
              onChange={(e) => handleChange("ice", e.target.value)}
              className={inputClass}
              required
            />
          </Field>

          <Field label="Identifiant fiscal (IF)" htmlFor="ifFiscal" required>
            <input
              id="ifFiscal"
              value={form.ifFiscal}
              onChange={(e) => handleChange("ifFiscal", e.target.value)}
              className={inputClass}
              required
            />
          </Field>

          <Field label="Registre de commerce (RC)" htmlFor="rc" required>
            <input
              id="rc"
              value={form.rc}
              onChange={(e) => handleChange("rc", e.target.value)}
              className={inputClass}
              required
            />
          </Field>

          <Field label="Ville du RC" htmlFor="rcVille">
            <input
              id="rcVille"
              value={form.rcVille}
              onChange={(e) => handleChange("rcVille", e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Taxe professionnelle (TP)" htmlFor="tp">
            <input
              id="tp"
              value={form.tp}
              onChange={(e) => handleChange("tp", e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="CNSS" htmlFor="cnss">
            <input
              id="cnss"
              value={form.cnss}
              onChange={(e) => handleChange("cnss", e.target.value)}
              className={inputClass}
            />
          </Field>
        </Section>

        {/* Coordonnées */}

        <Section
          title="Coordonnées"
          description="Adresse du siège et moyens de contact."
        >
          <Field
            label="Adresse"
            htmlFor="adresse"
            required
            className="md:col-span-2"
          >
            <textarea
              id="adresse"
              rows={2}
              value={form.adresse}
              onChange={(e) => handleChange("adresse", e.target.value)}
              className={inputClass}
              required
            />
          </Field>

          <Field label="Ville" htmlFor="ville" required>
            <input
              id="ville"
              value={form.ville}
              onChange={(e) => handleChange("ville", e.target.value)}
              className={inputClass}
              required
            />
          </Field>

          <Field label="Téléphone" htmlFor="telephone">
            <input
              id="telephone"
              type="tel"
              value={form.telephone}
              onChange={(e) => handleChange("telephone", e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field
            label="Email"
            htmlFor="email"
            className="md:col-span-2"
          >
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
              className={inputClass}
            />
          </Field>
        </Section>

        {/* Barre d'enregistrement */}

        <div className="sticky bottom-0 flex flex-col gap-3 rounded-b-2xl border-t border-[#e8ebef] bg-[#fafbfc]/95 px-6 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <p
            role="status"
            aria-live="polite"
            className={`text-sm ${
              feedback?.type === "success"
                ? "text-emerald-700"
                : feedback?.type === "error"
                  ? "text-red-700"
                  : "text-[#89919d]"
            }`}
          >
            {feedback?.text ?? "Les champs marqués d'un * sont obligatoires."}
          </p>

          <button type="submit" disabled={saving || uploadingLogo} className={btnPrimary}>
            {saving
              ? "Enregistrement..."
              : entreprise
                ? "Enregistrer les modifications"
                : "Créer l'entreprise"}
          </button>
        </div>
      </form>
    </AppShell>
  );
}