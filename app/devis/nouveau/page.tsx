"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "@/app/components/AppShell";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

type DevisRow = {
  id: string;
  numero: string;
  statut: string;
  dateEmission: string | null;
  dateValidite: string | null;
  totalTtc: string | number;
  client: { id: string; nomRaisonSociale: string };
  facturesIssues: { id: string; numero: string }[];
};

type ClientOption = {
  id: string;
  typeClient?: string;
  nomRaisonSociale: string;
  ice?: string | null;
};

type TypeClient = "entreprise" | "particulier";

type Notice = { type: "success" | "error"; text: string };

/* -------------------------------------------------------------------------- */
/*  Constantes                                                                */
/* -------------------------------------------------------------------------- */

const STATUTS: Record<string, { label: string; className: string }> = {
  brouillon: {
    label: "Brouillon",
    className: "bg-gray-100 text-gray-600 border-gray-200",
  },
  converti: {
    label: "Converti",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
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

const newLigne = () => ({
  description: "",
  quantite: 1,
  prixUnitaireHt: 0,
  tauxTva: 20,
});

const emptyClient = {
  typeClient: "entreprise" as TypeClient,
  nomRaisonSociale: "",
  ice: "",
  ifFiscal: "",
  rc: "",
  adresse: "",
  ville: "",
  telephone: "",
  email: "",
};

const today = () => new Date().toISOString().slice(0, 10);

const inputClass =
  "w-full rounded-lg border border-[#dce1e7] bg-white px-3 py-2 text-sm text-[#18212f] placeholder:text-[#a0a7b1] outline-none transition focus:border-[#456f9f] focus:ring-2 focus:ring-[#456f9f]/20 disabled:cursor-not-allowed disabled:bg-[#f3f5f8] disabled:text-[#9aa2ad]";

const thClass =
  "px-6 py-3 text-xs font-semibold uppercase tracking-wide text-[#7b8490]";

const actionClass =
  "text-sm font-semibold text-[#456f9f] transition hover:underline disabled:opacity-50";

const segmentedWrap =
  "inline-flex rounded-lg border border-[#dce1e7] bg-[#f6f8fb] p-0.5 text-sm font-medium";

const segmentedBtn = (active: boolean) =>
  `rounded-md px-4 py-1.5 transition ${
    active
      ? "bg-white text-[#456f9f] shadow-sm"
      : "text-[#6d7682] hover:text-[#18212f]"
  }`;

/* -------------------------------------------------------------------------- */
/*  Formatage                                                                 */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*  Composants                                                                */
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

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function DevisPage() {
  const router = useRouter();

  const [devis, setDevis] = useState<DevisRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);

  const [clientMode, setClientMode] = useState<"nouveau" | "existant">("nouveau");
  const [clientId, setClientId] = useState("");
  const [nouveauClient, setNouveauClient] = useState(emptyClient);

  const [dateEmission, setDateEmission] = useState(today());
  const [validiteJours, setValiditeJours] = useState("30");
  const [modePaiement, setModePaiement] = useState("Virement");
  const [lignes, setLignes] = useState([newLigne()]);

  const isEntreprise = nouveauClient.typeClient === "entreprise";

  /* ------------------------------------------------------------------ */
  /*  Chargement                                                         */
  /* ------------------------------------------------------------------ */

  const loadDevis = useCallback(async () => {
    try {
      setLoading(true);

      const response = await fetch("/api/devis", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Erreur lors du chargement des devis");
      }

      setDevis(data.data);
    } catch (err) {
      console.error(err);
      setNotice({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Impossible de charger les devis",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  async function loadClients() {
    try {
      setLoadingClients(true);

      const response = await fetch("/api/clients");
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Erreur lors du chargement des clients");
      }

      setClients(data.clients);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingClients(false);
    }
  }

  useEffect(() => {
    loadDevis();
    loadClients();
  }, [loadDevis]);

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
    setClientMode("nouveau");
    setClientId("");
    setNouveauClient(emptyClient);
    setDateEmission(today());
    setValiditeJours("30");
    setModePaiement("Virement");
    setLignes([newLigne()]);
    setFormError("");
  }

  function openForm() {
    resetForm();
    setNotice(null);
    setShowForm(true);
    loadClients(); // inclut les clients créés depuis le dernier affichage
  }

  function closeForm() {
    setShowForm(false);
    setFormError("");
  }

  function handleClientChange(field: keyof typeof emptyClient, value: string) {
    setNouveauClient((previous) => ({ ...previous, [field]: value }));
  }

  function ajouterLigne() {
    setLignes([...lignes, newLigne()]);
  }

  function supprimerLigne(index: number) {
    if (lignes.length === 1) return;
    setLignes(lignes.filter((_, i) => i !== index));
  }

  function modifierLigne(index: number, field: string, value: string | number) {
    const nouvellesLignes = [...lignes];

    nouvellesLignes[index] = {
      ...nouvellesLignes[index],
      [field]: field === "description" ? value : Number(value),
    };

    setLignes(nouvellesLignes);
  }

  const montantLigneHt = (ligne: (typeof lignes)[number]) =>
    Number(ligne.quantite || 0) * Number(ligne.prixUnitaireHt || 0);

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

  // Aperçu de la date limite de validité.
  const dateValiditeApercu = useMemo(() => {
    const debut = new Date(dateEmission);
    if (Number.isNaN(debut.getTime())) return "-";
    debut.setDate(debut.getDate() + (Number(validiteJours) || 30));
    return debut.toLocaleDateString("fr-FR");
  }, [dateEmission, validiteJours]);

  async function creerDevis(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");

    if (clientMode === "existant" && !clientId) {
      setFormError("Veuillez sélectionner un client.");
      return;
    }

    if (clientMode === "nouveau") {
      if (!nouveauClient.nomRaisonSociale.trim()) {
        setFormError("Le nom ou la raison sociale est obligatoire.");
        return;
      }

      if (isEntreprise && !nouveauClient.ice.trim()) {
        setFormError("L’ICE est obligatoire pour une entreprise.");
        return;
      }
    }

    for (const ligne of lignes) {
      if (!ligne.description.trim()) {
        setFormError("Veuillez renseigner la description de chaque ligne.");
        return;
      }

      if (Number(ligne.quantite) <= 0) {
        setFormError("La quantité doit être supérieure à 0.");
        return;
      }

      if (Number(ligne.prixUnitaireHt) < 0) {
        setFormError("Le prix unitaire ne peut pas être négatif.");
        return;
      }
    }

    try {
      setSaving(true);

      const response = await fetch("/api/devis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(clientMode === "existant"
            ? { clientId }
            : {
                nouveauClient: {
                  ...nouveauClient,
                  // ICE, IF et RC ne sont envoyés que pour une entreprise.
                  ice: isEntreprise ? nouveauClient.ice.trim() : "",
                  ifFiscal: isEntreprise ? nouveauClient.ifFiscal.trim() : "",
                  rc: isEntreprise ? nouveauClient.rc.trim() : "",
                },
              }),
          dateEmission: dateEmission || null,
          validiteJours: Number(validiteJours) || 30,
          modePaiement: modePaiement || null,
          lignes,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Erreur lors de la création du devis");
      }

      closeForm();
      setNotice({
        type: "success",
        text: `Devis ${data.data.numero} créé avec succès.`,
      });

      await loadDevis();
    } catch (err) {
      console.error(err);

      setFormError(
        err instanceof Error
          ? err.message
          : "Erreur lors de la création du devis"
      );
    } finally {
      setSaving(false);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Actions de la liste                                                */
  /* ------------------------------------------------------------------ */

  async function convertir(row: DevisRow) {
    if (!window.confirm(`Créer une facture à partir du devis ${row.numero} ?`)) {
      return;
    }

    setBusyId(row.id);
    setNotice(null);

    try {
      const response = await fetch(`/api/devis/${row.id}/convertir`, {
        method: "POST",
      });
      const data = await response.json();

      if (response.status === 409 && data.factureId) {
        router.push(`/factures/${data.factureId}`);
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Conversion impossible.");
      }

      router.push(`/factures/${data.data.id}`);
    } catch (err) {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Conversion impossible.",
      });
      setBusyId(null);
    }
  }

  async function supprimer(row: DevisRow) {
    if (!window.confirm(`Supprimer définitivement le devis ${row.numero} ?`)) {
      return;
    }

    setBusyId(row.id);
    setNotice(null);

    try {
      const response = await fetch(`/api/devis/${row.id}`, { method: "DELETE" });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Suppression impossible.");
      }

      setDevis((previous) => previous.filter((d) => d.id !== row.id));
      setNotice({ type: "success", text: `Devis ${row.numero} supprimé.` });
    } catch (err) {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Suppression impossible.",
      });
    } finally {
      setBusyId(null);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Affichage                                                          */
  /* ------------------------------------------------------------------ */

  return (
    <AppShell>
      {/* ------------------------------ Titre ----------------------------- */}

      <section className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Devis</h1>
          <p className="mt-1 text-sm text-[#6d7682]">
            {loading
              ? "Chargement..."
              : `${devis.length} devis enregistré${devis.length > 1 ? "s" : ""}`}
          </p>
        </div>

        <button
          type="button"
          onClick={openForm}
          className="inline-flex items-center justify-center rounded-lg bg-[#456f9f] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#395f8a]"
        >
          + Nouveau devis
        </button>
      </section>

      {/* ----------------------------- Notification ----------------------- */}

      {notice && (
        <div
          role="status"
          className={`mb-5 flex items-start justify-between gap-4 rounded-xl border px-4 py-3 text-sm ${
            notice.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Fermer la notification"
            className="text-base leading-none opacity-60 transition hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* -------------------------- Liste des devis ----------------------- */}

      <section className="rounded-2xl border border-[#e1e6ec] bg-white shadow-sm">
        {loading ? (
          <div className="px-6 py-12 text-center text-sm text-[#89919d]">
            Chargement des devis...
          </div>
        ) : devis.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="font-semibold text-[#273241]">Aucun devis</p>
            <p className="mt-1 text-sm text-[#89919d]">
              Créez votre premier devis pour un client ou un prospect.
            </p>
            <button
              type="button"
              onClick={openForm}
              className="mt-5 inline-flex rounded-lg bg-[#456f9f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#395f8a]"
            >
              Créer un devis
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead>
                <tr className="border-b border-[#e8ebef] bg-[#fafbfc]">
                  <th className={thClass}>Devis</th>
                  <th className={thClass}>Client</th>
                  <th className={thClass}>Émis le</th>
                  <th className={thClass}>Valable jusqu&apos;au</th>
                  <th className={thClass}>Statut</th>
                  <th className={`${thClass} text-right`}>TTC (MAD)</th>
                  <th className={thClass}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {devis.map((row) => {
                  const statut = getStatut(row.statut);
                  const facture = row.facturesIssues[0];
                  const occupe = busyId === row.id;

                  return (
                    <tr
                      key={row.id}
                      className="border-b border-[#edf0f3] last:border-b-0 hover:bg-[#fafbfc]"
                    >
                      <td className="px-6 py-3.5 font-semibold text-[#273241]">
                        {row.numero}
                      </td>

                      <td className="px-6 py-3.5 text-sm font-medium text-[#273241]">
                        {row.client.nomRaisonSociale}
                      </td>

                      <td className="px-6 py-3.5 text-sm tabular-nums text-[#697381]">
                        {formatDate(row.dateEmission)}
                      </td>

                      <td className="px-6 py-3.5 text-sm tabular-nums text-[#697381]">
                        {formatDate(row.dateValidite)}
                      </td>

                      <td className="px-6 py-3.5">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statut.className}`}
                        >
                          {statut.label}
                        </span>
                      </td>

                      <td className="px-6 py-3.5 text-right text-sm font-semibold tabular-nums text-[#273241]">
                        {formatMontant(row.totalTtc)}
                      </td>

                      <td className="px-6 py-3.5">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                          <a
                            href={`/api/factures/${row.id}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={actionClass}
                          >
                            PDF
                          </a>

                          <a
                            href={`/api/factures/${row.id}/pdf?version=client`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={actionClass}
                          >
                            PDF client
                          </a>

                          {facture ? (
                            <Link
                              href={`/factures/${facture.id}`}
                              className={actionClass}
                            >
                              Facture {facture.numero}
                            </Link>
                          ) : (
                            <>
                              <Link
                                href={`/devis/${row.id}/modifier`}
                                className={actionClass}
                              >
                                Modifier
                              </Link>

                              <button
                                type="button"
                                onClick={() => convertir(row)}
                                disabled={occupe}
                                className={actionClass}
                              >
                                Convertir en facture
                              </button>

                              <button
                                type="button"
                                onClick={() => supprimer(row)}
                                disabled={occupe}
                                className="text-sm font-semibold text-red-700 transition hover:underline disabled:opacity-50"
                              >
                                Supprimer
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
            onSubmit={creerDevis}
            role="dialog"
            aria-modal="true"
            aria-labelledby="devis-form-title"
            className="w-full max-w-4xl rounded-2xl bg-white shadow-xl"
          >
            {/* Titre */}

            <div className="flex items-center justify-between border-b border-[#e8ebef] px-6 py-4">
              <h2 id="devis-form-title" className="text-lg font-bold">
                Nouveau devis
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

              {/* Client */}

              <fieldset>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <legend className="text-xs font-semibold uppercase tracking-wide text-[#456f9f]">
                    Client
                  </legend>

                  <div className={segmentedWrap}>
                    {(
                      [
                        ["nouveau", "Nouveau client"],
                        ["existant", "Client existant"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={clientMode === value}
                        onClick={() => setClientMode(value)}
                        className={segmentedBtn(clientMode === value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {clientMode === "existant" ? (
                  <Field label="Client" htmlFor="clientId" required>
                    <select
                      id="clientId"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      className={inputClass}
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
                        Aucun client enregistré. Utilisez « Nouveau client ».
                      </p>
                    )}
                  </Field>
                ) : (
                  <>
                    <div className="mb-4 flex flex-wrap items-center gap-3">
                      <div className={segmentedWrap}>
                        {(
                          [
                            ["entreprise", "Entreprise"],
                            ["particulier", "Particulier"],
                          ] as [TypeClient, string][]
                        ).map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            aria-pressed={nouveauClient.typeClient === value}
                            onClick={() => handleClientChange("typeClient", value)}
                            className={segmentedBtn(
                              nouveauClient.typeClient === value
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      {!isEntreprise && (
                        <p className="text-xs text-[#89919d]">
                          L’ICE, l’IF et le RC ne sont pas requis pour un
                          particulier.
                        </p>
                      )}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <Field
                        label={isEntreprise ? "Raison sociale" : "Nom complet"}
                        htmlFor="nomRaisonSociale"
                        required
                        className="md:col-span-2"
                      >
                        <input
                          id="nomRaisonSociale"
                          value={nouveauClient.nomRaisonSociale}
                          onChange={(e) =>
                            handleClientChange("nomRaisonSociale", e.target.value)
                          }
                          className={inputClass}
                        />
                      </Field>

                      <Field label="ICE" htmlFor="ice" required={isEntreprise}>
                        <input
                          id="ice"
                          maxLength={15}
                          value={nouveauClient.ice}
                          onChange={(e) => handleClientChange("ice", e.target.value)}
                          disabled={!isEntreprise}
                          className={inputClass}
                        />
                      </Field>

                      <Field label="Identifiant fiscal (IF)" htmlFor="ifFiscal">
                        <input
                          id="ifFiscal"
                          value={nouveauClient.ifFiscal}
                          onChange={(e) =>
                            handleClientChange("ifFiscal", e.target.value)
                          }
                          disabled={!isEntreprise}
                          className={inputClass}
                        />
                      </Field>

                      <Field
                        label="Registre de commerce (RC)"
                        htmlFor="rc"
                        className="md:col-span-2"
                      >
                        <input
                          id="rc"
                          value={nouveauClient.rc}
                          onChange={(e) => handleClientChange("rc", e.target.value)}
                          disabled={!isEntreprise}
                          className={inputClass}
                        />
                      </Field>

                      <Field
                        label="Adresse"
                        htmlFor="adresse"
                        className="md:col-span-2"
                      >
                        <textarea
                          id="adresse"
                          rows={2}
                          value={nouveauClient.adresse}
                          onChange={(e) =>
                            handleClientChange("adresse", e.target.value)
                          }
                          className={inputClass}
                        />
                      </Field>

                      <Field label="Ville" htmlFor="ville">
                        <input
                          id="ville"
                          value={nouveauClient.ville}
                          onChange={(e) => handleClientChange("ville", e.target.value)}
                          className={inputClass}
                        />
                      </Field>

                      <Field label="Téléphone" htmlFor="telephone">
                        <input
                          id="telephone"
                          type="tel"
                          value={nouveauClient.telephone}
                          onChange={(e) =>
                            handleClientChange("telephone", e.target.value)
                          }
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
                          value={nouveauClient.email}
                          onChange={(e) => handleClientChange("email", e.target.value)}
                          className={inputClass}
                        />
                      </Field>
                    </div>
                  </>
                )}
              </fieldset>

              {/* Informations générales */}

              <fieldset>
                <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#456f9f]">
                  Informations générales
                </legend>

                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Date d'émission" htmlFor="dateEmission">
                    <input
                      id="dateEmission"
                      type="date"
                      value={dateEmission}
                      onChange={(e) => setDateEmission(e.target.value)}
                      className={inputClass}
                    />
                  </Field>

                  <Field
                    label="Validité (jours)"
                    htmlFor="validiteJours"
                    hint={`Valable jusqu'au ${dateValiditeApercu}`}
                  >
                    <input
                      id="validiteJours"
                      type="number"
                      min="1"
                      max="365"
                      value={validiteJours}
                      onChange={(e) => setValiditeJours(e.target.value)}
                      className={inputClass}
                    />
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

              {/* Lignes */}

              <fieldset>
                <div className="mb-3 flex items-center justify-between">
                  <legend className="text-xs font-semibold uppercase tracking-wide text-[#456f9f]">
                    Lignes du devis
                  </legend>

                  <button
                    type="button"
                    onClick={ajouterLigne}
                    className="text-sm font-semibold text-[#456f9f] hover:underline"
                  >
                    + Ajouter une ligne
                  </button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-[#e1e6ec]">
                  <table className="w-full min-w-[680px] text-sm">
                    <thead>
                      <tr className="border-b border-[#e8ebef] bg-[#fafbfc] text-xs font-semibold uppercase tracking-wide text-[#7b8490]">
                        <th className="px-3 py-2.5 text-left">Description</th>
                        <th className="px-3 py-2.5 text-right">Qté</th>
                        <th className="px-3 py-2.5 text-right">PU HT</th>
                        <th className="px-3 py-2.5 text-right">TVA %</th>
                        <th className="px-3 py-2.5 text-right">Total HT</th>
                        <th className="w-10 px-3 py-2.5" />
                      </tr>
                    </thead>

                    <tbody>
                      {lignes.map((ligne, index) => (
                        <tr
                          key={index}
                          className="border-b border-[#edf0f3] last:border-b-0"
                        >
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              aria-label={`Description de la ligne ${index + 1}`}
                              value={ligne.description}
                              onChange={(e) =>
                                modifierLigne(index, "description", e.target.value)
                              }
                              placeholder="Ex : Bardage aluminium"
                              className={inputClass}
                              required
                            />
                          </td>

                          <td className="px-3 py-2">
                            <input
                              type="number"
                              aria-label={`Quantité de la ligne ${index + 1}`}
                              min="0.01"
                              step="0.01"
                              value={ligne.quantite}
                              onChange={(e) =>
                                modifierLigne(index, "quantite", e.target.value)
                              }
                              className={`${inputClass} w-20 text-right`}
                            />
                          </td>

                          <td className="px-3 py-2">
                            <input
                              type="number"
                              aria-label={`Prix unitaire HT de la ligne ${index + 1}`}
                              min="0"
                              step="0.01"
                              value={ligne.prixUnitaireHt}
                              onChange={(e) =>
                                modifierLigne(index, "prixUnitaireHt", e.target.value)
                              }
                              className={`${inputClass} w-28 text-right`}
                            />
                          </td>

                          <td className="px-3 py-2">
                            <input
                              type="number"
                              aria-label={`Taux de TVA de la ligne ${index + 1}`}
                              min="0"
                              max="100"
                              step="0.01"
                              value={ligne.tauxTva}
                              onChange={(e) =>
                                modifierLigne(index, "tauxTva", e.target.value)
                              }
                              className={`${inputClass} w-20 text-right`}
                            />
                          </td>

                          <td className="whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums text-[#273241]">
                            {formatMontant(montantLigneHt(ligne))}
                          </td>

                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => supprimerLigne(index)}
                              disabled={lignes.length === 1}
                              aria-label={`Supprimer la ligne ${index + 1}`}
                              className="rounded-md px-2 py-1 text-[#89919d] transition hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#89919d]"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="mt-2 text-xs text-[#89919d]">
                  Montants exprimés en dirhams (MAD).
                </p>
              </fieldset>

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
                {saving ? "Création..." : "Créer le devis"}
              </button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}