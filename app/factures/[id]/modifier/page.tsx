"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import AppShell from "@/app/components/AppShell";
import EditeurLignesMesures, { nouvelleLigne, ligneDepuisApi, lignePourApi, montantHtLigne, quantiteCalculee, type LigneSaisie } from "@/app/components/EditeurLignesMesures";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

type Client = {
  id: string;
  typeClient: string;
  nomRaisonSociale: string;
  ice?: string | null;
  ifFiscal?: string | null;
  rc?: string | null;
  adresse?: string | null;
  ville?: string | null;
  telephone?: string | null;
  email?: string | null;
};

type Ligne = {
  id?: string;
  ordre?: number;
  articleId?: string | null;
  description: string;
  quantite: number;
  prixUnitaireHt: number;
  tauxTva: number;
  montantHt?: number;
  montantTva?: number;
  montantTtc?: number;
};

type Facture = {
  id: string;
  numero: string;
  typeDocument: string;
  statut: string;

  dateEmission?: string | null;
  dateEcheance?: string | null;
  modePaiement?: string | null;

  client: Client;
  clientId: string;

  lignes: Ligne[];

  sousTotalHt: string | number;
  totalTva: string | number;
  totalTtc: string | number;
};

const MODES_PAIEMENT = [
  "Virement",
  "Chèque",
  "Espèces",
  "Carte bancaire",
  "Prélèvement",
];

const inputClass =
  "w-full rounded-lg border border-[#dce1e7] bg-white px-3 py-2 text-sm text-[#18212f] placeholder:text-[#a0a7b1] outline-none transition focus:border-[#456f9f] focus:ring-2 focus:ring-[#456f9f]/20 disabled:cursor-not-allowed disabled:bg-[#f3f5f8] disabled:text-[#9aa2ad]";

const btnBase =
  "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
const btnPrimary = `${btnBase} bg-[#456f9f] text-white shadow-sm hover:bg-[#395f8a]`;
const btnSecondary = `${btnBase} border border-[#dce1e7] bg-white text-[#4c5663] hover:bg-[#f6f8fb]`;

function formatMontant(value: number | string) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

/* -------------------------------------------------------------------------- */
/*  Composants communs                                                        */
/* -------------------------------------------------------------------------- */

function Field({
  label,
  htmlFor,
  required,
  className = "",
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
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
    </div>
  );
}

export default function ModifierFacturePage() {
  const params = useParams();
  const router = useRouter();

  const id = params.id as string;

  const [facture, setFacture] = useState<Facture | null>(null);
  const [clients, setClients] = useState<Client[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const [clientId, setClientId] = useState("");
  const [dateEmission, setDateEmission] = useState("");
  const [validiteJours, setValiditeJours] = useState("30");
  const [modePaiement, setModePaiement] = useState("Virement");

  const [lignes, setLignes] = useState<LigneSaisie[]>([]);

  /* ------------------------------------------------------------------ */
  /*  Chargement                                                         */
  /* ------------------------------------------------------------------ */

  async function loadFacture() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`/api/factures/${id}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Impossible de charger la facture");
      }

      const f = data.facture;

      setFacture(f);
      setClientId(f.clientId);
      setDateEmission(f.dateEmission ? f.dateEmission.substring(0, 10) : "");
      const jours = f.dateEmission && f.dateEcheance
        ? Math.round((Date.parse(f.dateEcheance) - Date.parse(f.dateEmission)) / 86400000)
        : 30;
      setValiditeJours(String(jours > 0 ? jours : 30));
      setModePaiement(f.modePaiement || "Virement");

      setLignes(f.lignes.map(ligneDepuisApi));
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error ? err.message : "Erreur lors du chargement"
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadClients() {
    try {
      const response = await fetch("/api/clients");
      const data = await response.json();

      if (data.success) {
        setClients(data.clients);
      }
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    if (id) {
      loadFacture();
      loadClients();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /* ------------------------------------------------------------------ */
  /*  Lignes et calculs                                                  */
  /* ------------------------------------------------------------------ */

  const dateEcheance = useMemo(() => {
    const jours = Number(validiteJours);
    if (!dateEmission || !Number.isInteger(jours) || jours <= 0) return "";
    const [year, month, day] = dateEmission.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + jours);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }, [dateEmission, validiteJours]);

  const montantLigneHt = montantHtLigne;
  const calculerSousTotal = () => lignes.reduce((total, ligne) => total + montantLigneHt(ligne), 0);
  const calculerTva = () => lignes.reduce((total, ligne) => total + montantLigneHt(ligne) * (Number(ligne.tauxTva) / 100), 0);
  const calculerTtc = () => calculerSousTotal() + calculerTva();

  /* ------------------------------------------------------------------ */
  /*  Enregistrement                                                     */
  /* ------------------------------------------------------------------ */

  async function modifierFacture(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");

    if (!clientId) {
      setFormError("Veuillez sélectionner un client.");
      return;
    }

    if (!dateEcheance) { setFormError("Renseignez une date d’émission et une durée de validité positive."); return; }

    if (lignes.length === 0) {
      setFormError("La facture doit contenir au moins une ligne.");
      return;
    }

    for (const ligne of lignes) {
      if (ligne.mode === "simple" && !ligne.description.trim()) {
        setFormError("Renseignez la description des lignes simples."); return;
      }
      if (ligne.mode === "mesures" && (
        (ligne.ouvrage === "Autre" && !ligne.description.trim()) ||
        ligne.largeur <= 0 || (ligne.unite === "m2" && ligne.hauteur <= 0) ||
        !Number.isInteger(ligne.nombre) || ligne.nombre <= 0
      )) {
        setFormError("Vérifiez les dimensions, le nombre d'éléments et la désignation des lignes de mesures."); return;
      }
      if (quantiteCalculee(ligne) <= 0 || ligne.prixUnitaireHt < 0 || ligne.tauxTva < 0 || ligne.tauxTva > 100) {
        setFormError("Vérifiez les quantités, les prix et la TVA."); return;
      }
    }

    try {
      setSaving(true);

      const response = await fetch(`/api/factures/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          dateEmission: dateEmission || null,
          dateEcheance: dateEcheance || null,
          modePaiement: modePaiement || null,
          lignes: lignes.map(lignePourApi),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Erreur lors de la modification de la facture"
        );
      }

      router.push(`/factures/${id}`);
    } catch (err) {
      console.error(err);

      setFormError(
        err instanceof Error ? err.message : "Erreur lors de la modification"
      );
    } finally {
      setSaving(false);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  États particuliers                                                 */
  /* ------------------------------------------------------------------ */

  if (loading) {
    return (
      <AppShell>
        <div className="rounded-2xl border border-[#e1e6ec] bg-white px-6 py-12 text-center text-sm text-[#89919d] shadow-sm">
          Chargement de la facture...
        </div>
      </AppShell>
    );
  }

  if (error || !facture) {
    return (
      <AppShell>
        <div className="rounded-2xl border border-[#e1e6ec] bg-white p-8 text-center shadow-sm">
          <p className="font-semibold text-[#273241]">
            {error || "Facture introuvable"}
          </p>
          <Link href="/factures" className={`${btnPrimary} mt-5`}>
            Retour aux factures
          </Link>
        </div>
      </AppShell>
    );
  }

  if (facture.statut !== "brouillon") {
    return (
      <AppShell>
        <div className="rounded-2xl border border-[#e1e6ec] bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-bold">Modification impossible</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#6d7682]">
            La facture <strong>{facture.numero}</strong> n'est plus au statut
            brouillon. Seules les factures brouillon peuvent être modifiées.
          </p>
          <Link href={`/factures/${id}`} className={`${btnPrimary} mt-5`}>
            Retour à la facture
          </Link>
        </div>
      </AppShell>
    );
  }

  /* ------------------------------------------------------------------ */
  /*  Affichage                                                          */
  /* ------------------------------------------------------------------ */

  return (
    <AppShell>
      <Link
        href={`/factures/${id}`}
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-[#6d7682] transition hover:text-[#456f9f]"
      >
        ← {facture.numero}
      </Link>

      <section className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">
          Modifier la facture {facture.numero}
        </h1>
        <p className="mt-1 text-sm text-[#6d7682]">
          Les modifications sont possibles tant que la facture est au statut
          brouillon.
        </p>
      </section>

      <form
        onSubmit={modifierFacture}
        className="rounded-2xl border border-[#e1e6ec] bg-white shadow-sm"
      >
        <div className="space-y-7 px-6 py-6">
          {formError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              {formError}
            </div>
          )}

          {/* Informations générales */}

          <fieldset>
            <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#456f9f]">
              Informations générales
            </legend>

            <div className="grid gap-4 md:grid-cols-3">
              <Field
                label="Client"
                htmlFor="clientId"
                required
                className="md:col-span-3"
              >
                <select
                  id="clientId"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className={inputClass}
                  required
                >
                  <option value="">Sélectionner un client</option>

                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.nomRaisonSociale}
                      {client.ice ? ` - ICE : ${client.ice}` : ""}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Date d'émission" htmlFor="dateEmission">
                <input
                  id="dateEmission"
                  type="date"
                  value={dateEmission}
                  onChange={(e) => setDateEmission(e.target.value)}
                  className={inputClass}
                />
              </Field>

              <Field label="Durée de validité (jours)" htmlFor="validiteJours">
                <input
                  id="validiteJours"
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={validiteJours}
                  onChange={(e) => setValiditeJours(e.target.value)}
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-[#6d7682]">
                  Échéance calculée : {dateEcheance ? new Date(`${dateEcheance}T12:00:00`).toLocaleDateString("fr-FR") : "—"}
                </p>
              </Field>

              <Field label="Mode de paiement" htmlFor="modePaiement">
                <select
                  id="modePaiement"
                  value={modePaiement}
                  onChange={(e) => setModePaiement(e.target.value)}
                  className={inputClass}
                >
                  {MODES_PAIEMENT.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </fieldset>

          {/* Lignes simples et métrées */}
          <EditeurLignesMesures lignes={lignes} setLignes={setLignes} titre="Lignes de facture" />

          {/* Totaux */}

          <div className="flex justify-end">
            <dl className="w-full max-w-xs text-sm">
              <div className="flex justify-between border-b border-[#edf0f3] py-2">
                <dt className="text-[#6d7682]">Sous-total HT</dt>
                <dd className="font-medium tabular-nums">
                  {formatMontant(calculerSousTotal())}
                </dd>
              </div>

              <div className="flex justify-between border-b border-[#edf0f3] py-2">
                <dt className="text-[#6d7682]">Total TVA</dt>
                <dd className="font-medium tabular-nums">
                  {formatMontant(calculerTva())}
                </dd>
              </div>

              <div className="flex items-baseline justify-between pt-3">
                <dt className="font-bold">Total TTC</dt>
                <dd className="text-lg font-bold tabular-nums text-[#456f9f]">
                  {formatMontant(calculerTtc())}{" "}
                  <span className="text-sm font-semibold">MAD</span>
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Actions */}

        <div className="flex justify-end gap-3 rounded-b-2xl border-t border-[#e8ebef] bg-[#fafbfc] px-6 py-4">
          <Link href={`/factures/${id}`} className={btnSecondary}>
            Annuler
          </Link>

          <button type="submit" disabled={saving} className={btnPrimary}>
            {saving ? "Enregistrement..." : "Enregistrer les modifications"}
          </button>
        </div>
      </form>
    </AppShell>
  );
}
