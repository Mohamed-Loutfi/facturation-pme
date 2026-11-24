"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

type ClientOption = { id: string; nomRaisonSociale: string };

type LigneForm = {
  key: string;
  description: string;
  quantite: string;
  prixUnitaireHt: string;
  tauxTva: string;
};

export type DevisInitial = {
  clientId: string;
  dateEmission: string; // AAAA-MM-JJ
  validiteJours: string;
  modePaiement: string;
  lignes: Omit<LigneForm, "key">[];
};

type Props = {
  devisId?: string; // présent = modification
  initial?: DevisInitial;
};

const inputClass =
  "w-full rounded-lg border border-[#dce1e7] bg-white px-3 py-2 text-sm text-[#18212f] placeholder:text-[#a0a7b1] outline-none transition focus:border-[#456f9f] focus:ring-2 focus:ring-[#456f9f]/20";

const labelClass = "mb-1.5 block text-sm font-semibold text-[#273241]";

const cardClass = "rounded-2xl border border-[#e1e6ec] bg-white p-6 shadow-sm";

const sectionTitle =
  "mb-5 text-xs font-semibold uppercase tracking-wide text-[#456f9f]";

const btnBase =
  "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
const btnPrimary = `${btnBase} bg-[#456f9f] text-white shadow-sm hover:bg-[#395f8a]`;
const btnSecondary = `${btnBase} border border-[#dce1e7] bg-white text-[#4c5663] hover:bg-[#f6f8fb]`;

const money = (n: number) =>
  new Intl.NumberFormat("fr-MA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

const toNum = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const today = () => new Date().toISOString().slice(0, 10);

const MODES_PAIEMENT = ["Virement", "Chèque", "Espèces", "Carte bancaire", "Prélèvement"];

let keySeq = 0;
const newKey = () => `ligne-${++keySeq}`;

const ligneVide = (): LigneForm => ({
  key: newKey(),
  description: "",
  quantite: "1",
  prixUnitaireHt: "",
  tauxTva: "20",
});

export default function DevisForm({ devisId, initial }: Props) {
  const router = useRouter();
  const modification = Boolean(devisId);

  const [clientMode, setClientMode] = useState<"nouveau" | "existant">(
    initial ? "existant" : "nouveau"
  );
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientId, setClientId] = useState(initial?.clientId ?? "");
  const [nouveauClient, setNouveauClient] = useState({
    nomRaisonSociale: "",
    adresse: "",
    ville: "",
    ice: "",
    telephone: "",
    email: "",
  });

  const [dateEmission, setDateEmission] = useState(initial?.dateEmission ?? today());
  const [validiteJours, setValiditeJours] = useState(initial?.validiteJours ?? "30");
  const [modePaiement, setModePaiement] = useState(initial?.modePaiement ?? "");
  const [lignes, setLignes] = useState<LigneForm[]>(() =>
    initial && initial.lignes.length > 0
      ? initial.lignes.map((l) => ({ ...l, key: newKey() }))
      : [ligneVide()]
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Clients existants (la réponse peut être un tableau ou { data: [...] }).
  useEffect(() => {
    fetch("/api/clients", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        const list = Array.isArray(json) ? json : (json.data ?? json.clients ?? []);
        setClients(list);
      })
      .catch(() => setClients([]));
  }, []);

  const totaux = useMemo(() => {
    let ht = 0;
    let tva = 0;
    for (const l of lignes) {
      const lht = round2(toNum(l.quantite) * toNum(l.prixUnitaireHt));
      ht += lht;
      tva += round2((lht * toNum(l.tauxTva)) / 100);
    }
    return { ht: round2(ht), tva: round2(tva), ttc: round2(ht + tva) };
  }, [lignes]);

  function modifierLigne(key: string, patch: Partial<LigneForm>) {
    setLignes((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (clientMode === "existant" && !clientId) {
      setError("Choisissez un client.");
      return;
    }
    if (clientMode === "nouveau" && !nouveauClient.nomRaisonSociale.trim()) {
      setError("Renseignez le nom du nouveau client.");
      return;
    }
    if (lignes.some((l) => !l.description.trim())) {
      setError("Chaque ligne doit avoir une désignation.");
      return;
    }
    if (lignes.some((l) => toNum(l.quantite) <= 0)) {
      setError("Chaque quantité doit être supérieure à 0.");
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch(modification ? `/api/devis/${devisId}` : "/api/devis", {
        method: modification ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(clientMode === "existant" ? { clientId } : { nouveauClient }),
          dateEmission,
          validiteJours: toNum(validiteJours) || 30,
          modePaiement,
          lignes: lignes.map((l) => ({
            description: l.description,
            quantite: toNum(l.quantite),
            prixUnitaireHt: toNum(l.prixUnitaireHt),
            tauxTva: toNum(l.tauxTva),
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data?.message || "Enregistrement impossible.");
      }

      router.push("/devis");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* CLIENT */}
          <section className={cardClass}>
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[#456f9f]">
                Client
              </h2>

              <div className="inline-flex rounded-lg border border-[#dce1e7] bg-[#f6f8fb] p-0.5 text-sm font-semibold">
                {(["nouveau", "existant"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setClientMode(mode)}
                    className={`rounded-md px-3 py-1.5 transition ${
                      clientMode === mode
                        ? "bg-white text-[#456f9f] shadow-sm"
                        : "text-[#6d7682] hover:text-[#273241]"
                    }`}
                  >
                    {mode === "nouveau" ? "Nouveau client" : "Client existant"}
                  </button>
                ))}
              </div>
            </div>

            {clientMode === "existant" ? (
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className={inputClass}
              >
                <option value="">Choisir un client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nomRaisonSociale}
                  </option>
                ))}
              </select>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={labelClass}>
                    Nom ou raison sociale <span className="text-red-600">*</span>
                  </label>
                  <input
                    className={inputClass}
                    value={nouveauClient.nomRaisonSociale}
                    onChange={(e) =>
                      setNouveauClient({ ...nouveauClient, nomRaisonSociale: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className={labelClass}>Adresse</label>
                  <input
                    className={inputClass}
                    value={nouveauClient.adresse}
                    onChange={(e) => setNouveauClient({ ...nouveauClient, adresse: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelClass}>Ville</label>
                  <input
                    className={inputClass}
                    value={nouveauClient.ville}
                    onChange={(e) => setNouveauClient({ ...nouveauClient, ville: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelClass}>ICE</label>
                  <input
                    className={inputClass}
                    maxLength={15}
                    value={nouveauClient.ice}
                    onChange={(e) => setNouveauClient({ ...nouveauClient, ice: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelClass}>Téléphone</label>
                  <input
                    className={inputClass}
                    value={nouveauClient.telephone}
                    onChange={(e) =>
                      setNouveauClient({ ...nouveauClient, telephone: e.target.value })
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>E-mail</label>
                  <input
                    type="email"
                    className={inputClass}
                    value={nouveauClient.email}
                    onChange={(e) => setNouveauClient({ ...nouveauClient, email: e.target.value })}
                  />
                </div>
              </div>
            )}
          </section>

          {/* CONDITIONS */}
          <section className={cardClass}>
            <h2 className={sectionTitle}>Conditions</h2>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className={labelClass}>Date d&apos;émission</label>
                <input
                  type="date"
                  className={inputClass}
                  value={dateEmission}
                  onChange={(e) => setDateEmission(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Validité (jours)</label>
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={validiteJours}
                  onChange={(e) => setValiditeJours(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Mode de paiement</label>
                <select
                  className={inputClass}
                  value={modePaiement}
                  onChange={(e) => setModePaiement(e.target.value)}
                >
                  <option value="">Non précisé</option>
                  {/* Conserve une valeur déjà enregistrée qui ne figure pas dans la liste */}
                  {modePaiement && !MODES_PAIEMENT.includes(modePaiement) && (
                    <option value={modePaiement}>{modePaiement}</option>
                  )}
                  {MODES_PAIEMENT.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* LIGNES */}
          <section className="overflow-hidden rounded-2xl border border-[#e1e6ec] bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-[#e8ebef] px-6 py-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[#456f9f]">
                Prestations
              </h2>

              <button
                type="button"
                onClick={() => setLignes((prev) => [...prev, ligneVide()])}
                className={btnSecondary}
              >
                + Ajouter une ligne
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px]">
                <thead className="bg-[#f8fafc]">
                  <tr className="text-xs font-semibold uppercase tracking-wide text-[#89919d]">
                    <th className="w-10 px-3 py-3 text-center">N°</th>
                    <th className="px-3 py-3 text-left">Désignation</th>
                    <th className="w-24 px-3 py-3 text-right">Qté</th>
                    <th className="w-32 px-3 py-3 text-right">PU HT</th>
                    <th className="w-24 px-3 py-3 text-right">TVA %</th>
                    <th className="w-32 px-3 py-3 text-right">Total HT</th>
                    <th className="w-12 px-3 py-3"></th>
                  </tr>
                </thead>

                <tbody>
                  {lignes.map((l, index) => {
                    const ht = round2(toNum(l.quantite) * toNum(l.prixUnitaireHt));
                    return (
                      <tr key={l.key} className="border-t border-[#edf0f3]">
                        <td className="px-3 py-3 text-center text-sm text-[#89919d]">
                          {index + 1}
                        </td>
                        <td className="px-3 py-3">
                          <input
                            className={inputClass}
                            placeholder="Désignation"
                            value={l.description}
                            onChange={(e) => modifierLigne(l.key, { description: e.target.value })}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className={`${inputClass} text-right`}
                            value={l.quantite}
                            onChange={(e) => modifierLigne(l.key, { quantite: e.target.value })}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className={`${inputClass} text-right`}
                            value={l.prixUnitaireHt}
                            onChange={(e) =>
                              modifierLigne(l.key, { prixUnitaireHt: e.target.value })
                            }
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className={`${inputClass} text-right`}
                            value={l.tauxTva}
                            onChange={(e) => modifierLigne(l.key, { tauxTva: e.target.value })}
                          />
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="font-semibold tabular-nums text-[#273241]">
                            {money(ht)}
                          </div>
                          <div className="text-xs text-[#89919d]">MAD</div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              setLignes((prev) => prev.filter((x) => x.key !== l.key))
                            }
                            disabled={lignes.length === 1}
                            className="rounded-lg p-2 text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"
                            title="Supprimer la ligne"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* TOTAUX */}
        <div className="space-y-6">
          <section className={cardClass}>
            <h2 className={sectionTitle}>Totaux du devis</h2>

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-4 border-b border-[#edf0f3] py-3 text-sm">
                <span className="text-[#6d7682]">Total HT</span>
                <span className="font-semibold tabular-nums text-[#273241]">
                  {money(totaux.ht)} MAD
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-[#edf0f3] py-3 text-sm">
                <span className="text-[#6d7682]">Total TVA</span>
                <span className="font-semibold tabular-nums text-[#273241]">
                  {money(totaux.tva)} MAD
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 py-4">
                <span className="font-bold text-[#273241]">Total TTC</span>
                <span className="text-xl font-bold tabular-nums text-[#456f9f]">
                  {money(totaux.ttc)} MAD
                </span>
              </div>
            </div>
          </section>

          <div className="flex flex-col gap-3">
            <button
              type="submit"
              disabled={submitting || totaux.ttc <= 0}
              className={`${btnPrimary} w-full py-3`}
            >
              {submitting
                ? "Enregistrement..."
                : modification
                  ? "Enregistrer les modifications"
                  : "Créer le devis"}
            </button>

            <Link href="/devis" className={`${btnSecondary} w-full`}>
              Annuler
            </Link>
          </div>
        </div>
      </div>
    </form>
  );
}