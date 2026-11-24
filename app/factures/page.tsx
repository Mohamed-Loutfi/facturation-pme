"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import EditeurLignesMesures, { nouvelleLigne, montantHtLigne, lignePourApi, quantiteCalculee, type LigneSaisie } from "@/app/components/EditeurLignesMesures";
import AppShell from "../components/AppShell";

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

type LigneFacture = {
  id: string;
  ordre: number;
  description: string;
  quantite: string | number;
  prixUnitaireHt: string | number;
  tauxTva: string | number;
  montantHt: string | number;
  montantTva: string | number;
  montantTtc: string | number;
};

type Facture = {
  id: string;
  numero: string;
  typeDocument: string;
  statut: string;

  dateEmission?: string | null;
  dateEcheance?: string | null;
  modePaiement?: string | null;

  sousTotalHt: string | number;
  totalTva: string | number;
  totalTtc: string | number;

  client: Client;
  lignes: LigneFacture[];

  createdAt: string;
};

const STATUTS: Record<string, { label: string; className: string }> = {
  brouillon: {
    label: "Brouillon",
    className: "bg-gray-100 text-gray-600 border-gray-200",
  },
  emise: {
    label: "Émise",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  payee: {
    label: "Payée",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  annulee: {
    label: "Annulée",
    className: "bg-red-50 text-red-700 border-red-200",
  },
};

const getStatut = (statut: string) =>
  STATUTS[statut] ?? { label: statut, className: STATUTS.brouillon.className };

const MODES_PAIEMENT = [
  "Virement",
  "Chèque",
  "Espèces",
  "Carte bancaire",
  "Prélèvement",
];

const newLigne = nouvelleLigne;

const inputClass =
  "w-full rounded-lg border border-[#dce1e7] bg-white px-3 py-2 text-sm text-[#18212f] placeholder:text-[#a0a7b1] outline-none transition focus:border-[#456f9f] focus:ring-2 focus:ring-[#456f9f]/20 disabled:cursor-not-allowed disabled:bg-[#f3f5f8] disabled:text-[#9aa2ad]";

const thClass =
  "px-6 py-3 text-xs font-semibold uppercase tracking-wide text-[#7b8490]";

const plural = (count: number, word: string) =>
  `${count} ${word}${count > 1 ? "s" : ""}`;

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

export default function FacturesPage() {
  const router = useRouter();

  const [factures, setFactures] = useState<Facture[]>([]);
  const [recherche, setRecherche] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("tous");
  const [filtreType, setFiltreType] = useState("tous");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [triChamp, setTriChamp] = useState<"date" | "numero" | "client" | "montant">("date");
  const [triSens, setTriSens] = useState<"asc" | "desc">("desc");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState("");

  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);

  const [clientId, setClientId] = useState("");
  const [dateEmission, setDateEmission] = useState("");
  const [validiteJours, setValiditeJours] = useState("30");
  const [modePaiement, setModePaiement] = useState("Virement");
  const [lignes, setLignes] = useState<LigneSaisie[]>([newLigne()]);

  const [saving, setSaving] = useState(false);

  // Calcul local de l'échéance à partir de la date d'émission.
  const dateEcheance = useMemo(() => {
    if (!dateEmission || !/^\d{4}-\d{2}-\d{2}$/.test(dateEmission)) return "";
    const jours = Number(validiteJours);
    if (!Number.isInteger(jours) || jours <= 0) return "";
    const [annee, mois, jour] = dateEmission.split("-").map(Number);
    const date = new Date(annee, mois - 1, jour);
    if (date.getFullYear() !== annee || date.getMonth() !== mois - 1 || date.getDate() !== jour) return "";
    date.setDate(date.getDate() + jours);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, [dateEmission, validiteJours]);

  const dateEcheanceApercu = dateEcheance
    ? dateEcheance.split("-").reverse().join("/")
    : "—";


  /* ------------------------------------------------------------------ */
  /*  Chargement                                                         */
  /* ------------------------------------------------------------------ */

  async function loadFactures() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/factures");

      if (!response.ok) {
        throw new Error("Erreur lors du chargement des factures");
      }

      const data = await response.json();

      if (data.success) {
        // L’annuaire Factures exclut les devis et les autres types de documents.
        // Les avoirs restent dans cet annuaire avec les factures.
        const documents = Array.isArray(data.factures) ? data.factures : [];
        setFactures(
          documents.filter(
            (document: Facture) =>
              document.typeDocument === "facture" ||
              document.typeDocument === "avoir"
          )
        );
      } else {
        throw new Error(data.message || "Erreur inconnue");
      }
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Impossible de charger les factures"
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadClients() {
    try {
      setLoadingClients(true);

      const response = await fetch("/api/clients");

      if (!response.ok) {
        throw new Error("Erreur lors du chargement des clients");
      }

      const data = await response.json();

      if (data.success) {
        setClients(data.clients);
      } else {
        throw new Error(
          data.message || "Erreur lors du chargement des clients"
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingClients(false);
    }
  }

  useEffect(() => {
    loadFactures();
    loadClients();
  }, []);

  // Fermeture du formulaire avec la touche Échap.
  useEffect(() => {
    if (!showForm) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) closeForm();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showForm, saving]);

  /* ------------------------------------------------------------------ */
  /*  Formulaire                                                         */
  /* ------------------------------------------------------------------ */

  function resetForm() {
    setClientId("");
    setDateEmission("");
    setValiditeJours("30");
    setModePaiement("Virement");
    setLignes([newLigne()]);
    setFormError("");
  }

  function openForm() {
    resetForm();
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setFormError("");
  }

  const montantLigneHt = montantHtLigne;

  function calculerSousTotal() {
    return lignes.reduce((total, ligne) => total + montantLigneHt(ligne), 0);
  }

  function calculerTva() {
    return lignes.reduce(
      (total, ligne) =>
        total + montantLigneHt(ligne) * (Number(ligne.tauxTva || 0) / 100),
      0
    );
  }

  function calculerTtc() {
    return calculerSousTotal() + calculerTva();
  }

  async function creerFacture(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");

    if (!clientId) {
      setFormError("Veuillez sélectionner un client.");
      return;
    }

    if (!dateEmission || !dateEcheance) {
      setFormError("Veuillez saisir une date d'émission et une durée de validité entière supérieure à zéro.");
      return;
    }

    if (lignes.length === 0) {
      setFormError("Veuillez ajouter au moins une ligne.");
      return;
    }

    for (const ligne of lignes) {
      if (ligne.mode === "simple" && !ligne.description.trim()) {
        setFormError("Veuillez renseigner la description de chaque ligne simple."); return;
      }
      if (ligne.mode === "mesures" && ligne.ouvrage === "Autre" && !ligne.description.trim()) {
        setFormError("Veuillez préciser le nom de l’ouvrage personnalisé."); return;
      }
      if (ligne.mode === "mesures" && (ligne.largeur <= 0 || (ligne.unite === "m2" && ligne.hauteur <= 0) || !Number.isInteger(ligne.nombre) || ligne.nombre <= 0)) {
        setFormError("Renseignez des dimensions positives et un nombre entier d’éléments."); return;
      }
      if (quantiteCalculee(ligne) <= 0 || !Number.isFinite(quantiteCalculee(ligne))) {
        setFormError("La quantité ou le métrage doit être supérieur à zéro."); return;
      }
      if (!Number.isFinite(ligne.prixUnitaireHt) || ligne.prixUnitaireHt < 0 || !Number.isFinite(ligne.tauxTva) || ligne.tauxTva < 0 || ligne.tauxTva > 100) {
        setFormError("Vérifiez le prix HT et le taux de TVA (0 à 100 %)."); return;
      }
    }

    try {
      setSaving(true);

      const response = await fetch("/api/factures", {
        method: "POST",
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
          data.message || "Erreur lors de la création de la facture"
        );
      }

      resetForm();
      setShowForm(false);

      await loadFactures();

      router.push(`/factures/${data.facture.id}`);
    } catch (err) {
      console.error(err);

      setFormError(
        err instanceof Error
          ? err.message
          : "Erreur lors de la création de la facture"
      );
    } finally {
      setSaving(false);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Formatage                                                          */
  /* ------------------------------------------------------------------ */

  function formatMontant(value: string | number) {
    return new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value || 0));
  }

  function formatDate(date?: string | null) {
    if (!date) return "-";
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return "-";
    return parsed.toLocaleDateString("fr-FR");
  }


  const facturesFiltres = useMemo(() => {
    const terme = recherche.trim().toLocaleLowerCase("fr");
    const debut = dateDebut ? new Date(`${dateDebut}T00:00:00`).getTime() : null;
    const fin = dateFin ? new Date(`${dateFin}T23:59:59`).getTime() : null;
    return factures.filter((item) => {
      const rechercheTexte = [item.numero, item.client?.nomRaisonSociale, item.client?.ice].filter(Boolean).join(" ").toLocaleLowerCase("fr");
      if (terme && !rechercheTexte.includes(terme)) return false;
      if (filtreStatut !== "tous" && item.statut !== filtreStatut) return false;
      if (filtreType !== "tous" && item.typeDocument !== filtreType) return false;
      const dateValeur = item.dateEmission ? new Date(item.dateEmission).getTime() : NaN;
      if ((debut !== null || fin !== null) && !Number.isFinite(dateValeur)) return false;
      if (debut !== null && dateValeur < debut) return false;
      if (fin !== null && dateValeur > fin) return false;
      return true;
    }).sort((a, b) => {
      let comparaison = 0;
      if (triChamp === "montant") comparaison = Number(a.totalTtc) - Number(b.totalTtc);
      else if (triChamp === "client") comparaison = (a.client?.nomRaisonSociale ?? "").localeCompare(b.client?.nomRaisonSociale ?? "", "fr", {numeric:true});
      else if (triChamp === "numero") comparaison = a.numero.localeCompare(b.numero, "fr", {numeric:true});
      else comparaison = (a.dateEmission ? new Date(a.dateEmission).getTime() : 0) - (b.dateEmission ? new Date(b.dateEmission).getTime() : 0);
      return triSens === "asc" ? comparaison : -comparaison;
    });
  }, [factures, recherche, filtreStatut, filtreType, dateDebut, dateFin, triChamp, triSens]);

  function reinitialiserFiltres() {
    setRecherche(""); setFiltreStatut("tous"); setFiltreType("tous");
    setDateDebut(""); setDateFin(""); setTriChamp("date"); setTriSens("desc");
  }

  /* ------------------------------------------------------------------ */
  /*  Affichage                                                          */
  /* ------------------------------------------------------------------ */

  return (
    <AppShell>
        {/* ------------------------------ Titre ----------------------------- */}

        <section className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Factures</h1>
            <p className="mt-1 text-sm text-[#6d7682]">
              {loading
                ? "Chargement..."
                : `${plural(factures.length, "document")} enregistré${
                    factures.length > 1 ? "s" : ""
                  }`}
            </p>
          </div>

          <button
            type="button"
            onClick={openForm}
            className="inline-flex items-center justify-center rounded-lg bg-[#456f9f] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#395f8a]"
          >
            + Nouvelle facture
          </button>
        </section>

        {/* ------------------------------ Erreur ---------------------------- */}

        {error && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {error}
          </div>
        )}

  
      {/* Recherche, filtres et tri */}
      <section aria-label="Recherche et filtres" className="mb-5 rounded-2xl border border-[#e1e6ec] bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm font-medium text-[#3e4855]">Rechercher (numéro ou client)
            <input type="search" value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Numéro, client..." className={inputClass + " mt-1.5"} />
          </label>
          <label className="text-sm font-medium text-[#3e4855]">Statut
            <select value={filtreStatut} onChange={e => setFiltreStatut(e.target.value)} className={inputClass + " mt-1.5"}>
              <option value="tous">Tous les statuts</option>
              <option value="brouillon">Brouillon</option><option value="emise">Emise</option><option value="payee">Payee</option><option value="annulee">Annulee</option>
            </select>
          </label>
          <label className="text-sm font-medium text-[#3e4855]">Type de document<select value={filtreType} onChange={e => setFiltreType(e.target.value)} className={inputClass + " mt-1.5"}><option value="tous">Tous les types</option><option value="facture">Factures</option><option value="avoir">Avoirs</option></select></label>
          <label className="text-sm font-medium text-[#3e4855]">Date du
            <input type="date" value={dateDebut} max={dateFin || undefined} onChange={e => setDateDebut(e.target.value)} className={inputClass + " mt-1.5"} />
          </label>
          <label className="text-sm font-medium text-[#3e4855]">Date au
            <input type="date" value={dateFin} min={dateDebut || undefined} onChange={e => setDateFin(e.target.value)} className={inputClass + " mt-1.5"} />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm font-medium text-[#3e4855]">Trier par
            <select value={triChamp} onChange={e => setTriChamp(e.target.value as typeof triChamp)} className={inputClass + " mt-1.5 min-w-36"}>
              <option value="date">Date</option><option value="numero">Numéro</option><option value="client">Client</option><option value="montant">Montant TTC</option>
            </select>
          </label>
          <div className="flex gap-2" role="group" aria-label="Sens du tri">
            <button type="button" aria-pressed={triSens === "asc"} onClick={() => setTriSens("asc")} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${triSens === "asc" ? "border-[#456f9f] bg-[#edf3f8] text-[#456f9f]" : "border-[#dce1e7] bg-white text-[#4c5663]"}`}>↑ Ascendant</button>
            <button type="button" aria-pressed={triSens === "desc"} onClick={() => setTriSens("desc")} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${triSens === "desc" ? "border-[#456f9f] bg-[#edf3f8] text-[#456f9f]" : "border-[#dce1e7] bg-white text-[#4c5663]"}`}>↓ Descendant</button>
          </div>
          <button type="button" onClick={reinitialiserFiltres} className="rounded-lg border border-[#dce1e7] bg-white px-3 py-2 text-sm font-medium text-[#4c5663] hover:bg-[#f6f8fb]">Réinitialiser</button>
          <span className="ml-auto text-sm text-[#6d7682]">{facturesFiltres.length} / {factures.length} documents</span>
        </div>
      </section>

      {/* ------------------------ Liste des factures ---------------------- */}

        <section className="rounded-2xl border border-[#e1e6ec] bg-white shadow-sm">
          {loading ? (
            <div className="px-6 py-12 text-center text-sm text-[#89919d]">
              Chargement des factures...
            </div>
          ) : factures.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="font-semibold text-[#273241]">Aucune facture</p>
              <p className="mt-1 text-sm text-[#89919d]">
                Créez votre première facture pour commencer.
              </p>
              <button
                type="button"
                onClick={openForm}
                className="mt-5 inline-flex rounded-lg bg-[#456f9f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#395f8a]"
              >
                Créer une facture
              </button>
            </div>
          ) : (
            facturesFiltres.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-[#6d7682]">Aucun résultat pour ces critères. <button type="button" onClick={reinitialiserFiltres} className="font-semibold text-[#456f9f] hover:underline">Effacer les filtres</button></div>
            ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left">
                <thead>
                  <tr className="border-b border-[#e8ebef] bg-[#fafbfc]">
                    <th className={thClass}>Document</th>
                    <th className={thClass}>Client</th>
                    <th className={thClass}>Date</th>
                    <th className={thClass}>Statut</th>
                    <th className={`${thClass} text-right`}>HT</th>
                    <th className={`${thClass} text-right`}>TVA</th>
                    <th className={`${thClass} text-right`}>TTC (MAD)</th>
                    <th className={`${thClass} text-right`}>PDF</th>
                  </tr>
                </thead>

                <tbody>
                  {facturesFiltres.map((facture) => {
                    const statut = getStatut(facture.statut);
                    const isAvoir = facture.typeDocument === "avoir";

                    return (
                      <tr
                        key={facture.id}
                        className="border-b border-[#edf0f3] last:border-b-0 hover:bg-[#fafbfc]"
                      >
                        <td className="px-6 py-3.5">
                          <Link
                            href={`/factures/${facture.id}`}
                            className="font-semibold text-[#456f9f] hover:underline"
                          >
                            {facture.numero}
                          </Link>
                          <div
                            className={`mt-0.5 text-xs ${
                              isAvoir ? "text-red-700" : "text-[#89919d]"
                            }`}
                          >
                            {isAvoir ? "Avoir" : "Facture"}
                          </div>
                        </td>

                        <td className="px-6 py-3.5">
                          {facture.client ? (
                            <>
                              <div className="text-sm font-medium text-[#273241]">
                                {facture.client.nomRaisonSociale}
                              </div>
                              {facture.client.ice && (
                                <div className="mt-0.5 text-xs tabular-nums text-[#89919d]">
                                  ICE : {facture.client.ice}
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-sm italic text-[#89919d]">
                              Client supprimé
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-3.5 text-sm tabular-nums text-[#697381]">
                          {formatDate(facture.dateEmission)}
                        </td>

                        <td className="px-6 py-3.5">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statut.className}`}
                          >
                            {statut.label}
                          </span>
                        </td>

                        <td className="px-6 py-3.5 text-right text-sm tabular-nums text-[#697381]">
                          {formatMontant(facture.sousTotalHt)}
                        </td>

                        <td className="px-6 py-3.5 text-right text-sm tabular-nums text-[#697381]">
                          {formatMontant(facture.totalTva)}
                        </td>

                        <td className="px-6 py-3.5 text-right text-sm font-semibold tabular-nums text-[#273241]">
                          {formatMontant(facture.totalTtc)}
                        </td>

                        <td className="px-6 py-3.5 text-right">
                          <a
                            href={`/api/factures/${facture.id}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-semibold text-[#456f9f] hover:underline"
                          >
                            Ouvrir
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            )
          )}
        </section>
      

      {/* ------------------------------------------------------------------ */}
      {/* Formulaire de création (fenêtre modale)                            */}
      {/* ------------------------------------------------------------------ */}

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#18212f]/40 p-4 sm:p-8"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) closeForm();
          }}
        >
          <form
            onSubmit={creerFacture}
            role="dialog"
            aria-modal="true"
            aria-labelledby="facture-form-title"
            className="w-full max-w-4xl rounded-2xl bg-white shadow-xl"
          >
            {/* Titre */}

            <div className="flex items-center justify-between border-b border-[#e8ebef] px-6 py-4">
              <h2 id="facture-form-title" className="text-lg font-bold">
                Nouvelle facture
              </h2>

              <button
                type="button"
                onClick={closeForm}
                aria-label="Fermer"
                className="rounded-lg px-2 py-1 text-[#7b8490] transition hover:bg-[#f0f3f7] hover:text-[#18212f]"
              >
                ✕
              </button>
            </div>

            <div className="space-y-7 px-6 py-5">
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
                      <option value="">
                        {loadingClients
                          ? "Chargement des clients..."
                          : "Sélectionner un client"}
                      </option>

                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.nomRaisonSociale}
                          {client.ice ? ` - ICE: ${client.ice}` : ""}
                        </option>
                      ))}
                    </select>

                    {!loadingClients && clients.length === 0 && (
                      <p className="mt-1.5 text-xs text-[#7b8490]">
                        Aucun client enregistré.{" "}
                        <Link
                          href="/clients"
                          className="font-semibold text-[#456f9f] hover:underline"
                        >
                          Ajouter un client
                        </Link>
                      </p>
                    )}
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
                    <p className="mt-1.5 text-xs text-[#6d7682]">
                      Échéance calculée : {dateEcheanceApercu}
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

              {/* Lignes simples et lignes de mesures */}
              <EditeurLignesMesures lignes={lignes} setLignes={setLignes} titre="Lignes du facture" />

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
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="rounded-lg border border-[#dce1e7] bg-white px-4 py-2 text-sm font-medium text-[#4c5663] transition hover:bg-[#f6f8fb] disabled:opacity-50"
              >
                Annuler
              </button>

              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[#456f9f] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#395f8a] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Création..." : "Créer la facture"}
              </button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}