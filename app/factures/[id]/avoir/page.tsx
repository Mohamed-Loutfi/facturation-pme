"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/app/components/AppShell";

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
  ordre?: number;
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
  typeDocument: string;
  numero: string;
  statut: string;
  factureReferenceId?: string | null;
  motifAvoir?: string | null;
  clientId: string;
  dateEmission?: string | null;
  dateEcheance?: string | null;
  modePaiement?: string | null;
  sousTotalHt: string | number;
  totalTva: string | number;
  totalTtc: string | number;
  client: Client;
  lignes: LigneFacture[];
};

type LigneAvoirForm = {
  id: string;
  description: string;
  quantite: string;
  prixUnitaireHt: string;
  tauxTva: string;
};

const inputClass =
  "w-full rounded-lg border border-[#dce1e7] bg-white px-3 py-2 text-sm text-[#18212f] placeholder:text-[#a0a7b1] outline-none transition focus:border-[#456f9f] focus:ring-2 focus:ring-[#456f9f]/20";

const btnBase =
  "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

const btnPrimary =
  `${btnBase} bg-[#456f9f] text-white shadow-sm hover:bg-[#395f8a]`;

const btnSecondary =
  `${btnBase} border border-[#dce1e7] bg-white text-[#4c5663] hover:bg-[#f6f8fb]`;

const btnDanger =
  `${btnBase} border border-red-200 bg-white text-red-600 hover:bg-red-50`;

function formatMontant(value: number) {
  return new Intl.NumberFormat("fr-MA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function toNumber(value: string | number | null | undefined) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function calculerLigne(ligne: LigneAvoirForm) {
  const quantite = Math.abs(toNumber(ligne.quantite));
  const prixUnitaireHt = Math.abs(toNumber(ligne.prixUnitaireHt));
  const tauxTva = Math.max(0, toNumber(ligne.tauxTva));

  const montantHt = quantite * prixUnitaireHt;
  const montantTva = montantHt * (tauxTva / 100);
  const montantTtc = montantHt + montantTva;

  return {
    montantHt,
    montantTva,
    montantTtc,
  };
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f5f7fa] text-[#273241]">
      <header className="border-b border-[#e1e6ec] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight text-[#273241]"
          >
            Facturation PME
          </Link>

          <nav className="flex items-center gap-2 text-sm font-medium text-[#4c5663]">
            <Link
              href="/factures"
              className="rounded-lg px-3 py-2 transition hover:bg-[#f0f3f7]"
            >
              Factures
            </Link>

            <Link
              href="/clients"
              className="rounded-lg px-3 py-2 transition hover:bg-[#f0f3f7]"
            >
              Clients
            </Link>

            <Link
              href="/entreprise"
              className="rounded-lg px-3 py-2 transition hover:bg-[#f0f3f7]"
            >
              Entreprise
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        {children}
      </div>
    </main>
  );
}

export default function CreerAvoirPage() {
  const params = useParams();
  const router = useRouter();

  const id = params.id as string;

  const [facture, setFacture] = useState<Facture | null>(null);
  const [motifAvoir, setMotifAvoir] = useState("");
  const [lignes, setLignes] = useState<LigneAvoirForm[]>([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadFacture() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(`/api/factures/${id}`, {
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data?.message || "Impossible de charger la facture."
          );
        }

        const factureChargee = data.facture as Facture;

        setFacture(factureChargee);

        setLignes(
          factureChargee.lignes.map((ligne, index) => ({
            id: ligne.id || `ligne-${index + 1}`,
            description: ligne.description,
            quantite: Math.abs(toNumber(ligne.quantite)).toString(),
            prixUnitaireHt: Math.abs(
              toNumber(ligne.prixUnitaireHt)
            ).toString(),
            tauxTva: toNumber(ligne.tauxTva).toString(),
          }))
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Une erreur est survenue."
        );
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      loadFacture();
    }
  }, [id]);

  const totaux = useMemo(() => {
    return lignes.reduce(
      (acc, ligne) => {
        const calcul = calculerLigne(ligne);

        acc.ht += calcul.montantHt;
        acc.tva += calcul.montantTva;
        acc.ttc += calcul.montantTtc;

        return acc;
      },
      {
        ht: 0,
        tva: 0,
        ttc: 0,
      }
    );
  }, [lignes]);

  function modifierLigne(
    index: number,
    field: keyof LigneAvoirForm,
    value: string
  ) {
    setLignes((anciennes) =>
      anciennes.map((ligne, ligneIndex) =>
        ligneIndex === index
          ? {
              ...ligne,
              [field]: value,
            }
          : ligne
      )
    );
  }

  function supprimerLigne(index: number) {
    setLignes((anciennes) =>
      anciennes.filter((_, ligneIndex) => ligneIndex !== index)
    );
  }

  function ajouterLigne() {
    setLignes((anciennes) => [
      ...anciennes,
      {
        id: `nouvelle-${Date.now()}`,
        description: "",
        quantite: "1",
        prixUnitaireHt: "0",
        tauxTva: "20",
      },
    ]);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!facture) {
      return;
    }

    setError("");

    if (!motifAvoir.trim()) {
      setError("Veuillez saisir le motif de l'avoir.");
      return;
    }

    if (lignes.length === 0) {
      setError("L'avoir doit contenir au moins une ligne.");
      return;
    }

    for (let index = 0; index < lignes.length; index++) {
      const ligne = lignes[index];

      if (!ligne.description.trim()) {
        setError(
          `Veuillez saisir une désignation pour la ligne ${index + 1}.`
        );
        return;
      }

      if (toNumber(ligne.quantite) <= 0) {
        setError(
          `La quantité de la ligne ${index + 1} doit être supérieure à 0.`
        );
        return;
      }

      if (toNumber(ligne.prixUnitaireHt) < 0) {
        setError(
          `Le prix unitaire de la ligne ${index + 1} ne peut pas être négatif.`
        );
        return;
      }

      if (toNumber(ligne.tauxTva) < 0) {
        setError(
          `Le taux de TVA de la ligne ${index + 1} ne peut pas être négatif.`
        );
        return;
      }
    }

    if (totaux.ttc <= 0) {
      setError("Le montant total de l'avoir doit être supérieur à 0.");
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch(`/api/factures/${id}/avoir`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          motifAvoir: motifAvoir.trim(),
          lignes: lignes.map((ligne, index) => ({
            ordre: index,
            description: ligne.description.trim(),
            quantite: Math.abs(toNumber(ligne.quantite)),
            prixUnitaireHt: Math.abs(
              toNumber(ligne.prixUnitaireHt)
            ),
            tauxTva: Math.max(0, toNumber(ligne.tauxTva)),
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data?.message || "Impossible de créer l'avoir."
        );
      }

      router.push(`/factures/${data.avoir.id}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Une erreur est survenue."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="rounded-2xl border border-[#e1e6ec] bg-white px-6 py-12 text-center text-sm text-[#89919d] shadow-sm">
          Chargement de la facture...
        </div>
      </AppShell>
    );
  }

  if (error && !facture) {
    return (
      <AppShell>
        <div className="rounded-2xl border border-[#e1e6ec] bg-white p-8 text-center shadow-sm">
          <p className="font-semibold text-[#273241]">
            {error}
          </p>

          <Link
            href={`/factures/${id}`}
            className={`${btnPrimary} mt-5`}
          >
            Retour à la facture
          </Link>
        </div>
      </AppShell>
    );
  }

  if (!facture) {
    return null;
  }

  if (
    facture.typeDocument !== "facture" ||
    (facture.statut !== "emise" &&
      facture.statut !== "payee")
  ) {
    return (
      <AppShell>
        <div className="rounded-2xl border border-[#e1e6ec] bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-bold">
            Création d'avoir impossible
          </h1>

          <p className="mx-auto mt-2 max-w-md text-sm text-[#6d7682]">
            Un avoir peut uniquement être créé à partir d'une
            facture émise ou payée.
          </p>

          <Link
            href={`/factures/${id}`}
            className={`${btnPrimary} mt-5`}
          >
            Retour à la facture
          </Link>
        </div>
      </AppShell>
    );
  }

  const client = facture.client;

  return (
    <AppShell>
      <Link
        href={`/factures/${id}`}
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-[#6d7682] transition hover:text-[#456f9f]"
      >
        ← Facture {facture.numero}
      </Link>

      <section className="mb-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Créer un avoir
            </h1>

            <p className="mt-1 text-sm text-[#6d7682]">
              À partir de la facture {facture.numero}.
              Modifiez les lignes selon le montant à
              créditer.
            </p>
          </div>

          <span className="w-fit rounded-full border border-purple-200 bg-purple-50 px-3 py-1.5 text-sm font-semibold text-purple-700">
            Avoir
          </span>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* INFORMATIONS */}
            <section className="rounded-2xl border border-[#e1e6ec] bg-white p-6 shadow-sm">
              <h2 className="mb-5 text-xs font-semibold uppercase tracking-wide text-[#456f9f]">
                Informations
              </h2>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[#89919d]">
                    Facture d'origine
                  </p>

                  <p className="font-semibold text-[#273241]">
                    {facture.numero}
                  </p>
                </div>

                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[#89919d]">
                    Client
                  </p>

                  <p className="font-semibold text-[#273241]">
                    {client.nomRaisonSociale}
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <label
                  htmlFor="motifAvoir"
                  className="mb-1.5 block text-sm font-semibold text-[#273241]"
                >
                  Motif de l'avoir{" "}
                  <span className="text-red-600">*</span>
                </label>

                <textarea
                  id="motifAvoir"
                  value={motifAvoir}
                  onChange={(event) =>
                    setMotifAvoir(event.target.value)
                  }
                  placeholder="Exemple : Retour de marchandises"
                  rows={3}
                  className={inputClass}
                  required
                />

                <p className="mt-2 text-xs text-[#89919d]">
                  Ce motif sera enregistré et affiché sur
                  l'avoir.
                </p>
              </div>
            </section>

            {/* LIGNES */}
            <section className="overflow-hidden rounded-2xl border border-[#e1e6ec] bg-white shadow-sm">
              <div className="flex flex-col justify-between gap-2 border-b border-[#e8ebef] px-6 py-4 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-[#456f9f]">
                    Lignes de l'avoir
                  </h2>

                  <p className="mt-1 text-xs text-[#89919d]">
                    Vous pouvez modifier les désignations,
                    quantités, prix et taux de TVA.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={ajouterLigne}
                  className={btnSecondary}
                >
                  + Ajouter une ligne
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px]">
                  <thead className="bg-[#f8fafc]">
                    <tr>
                      <th className="w-10 px-3 py-3 text-center text-xs font-semibold text-[#89919d]">
                        N°
                      </th>

                      <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#89919d]">
                        Désignation
                      </th>

                      <th className="w-28 px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#89919d]">
                        Qté
                      </th>

                      <th className="w-36 px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#89919d]">
                        PU HT
                      </th>

                      <th className="w-24 px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#89919d]">
                        TVA %
                      </th>

                      <th className="w-36 px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#89919d]">
                        Total HT
                      </th>

                      <th className="w-12 px-3 py-3"></th>
                    </tr>
                  </thead>

                  <tbody>
                    {lignes.map((ligne, index) => {
                      const calcul = calculerLigne(ligne);

                      return (
                        <tr
                          key={ligne.id}
                          className="border-t border-[#edf0f3]"
                        >
                          <td className="px-3 py-3 text-center text-sm text-[#89919d]">
                            {index + 1}
                          </td>

                          <td className="px-3 py-3">
                            <input
                              type="text"
                              value={ligne.description}
                              onChange={(event) =>
                                modifierLigne(
                                  index,
                                  "description",
                                  event.target.value
                                )
                              }
                              className={inputClass}
                              placeholder="Désignation"
                            />
                          </td>

                          <td className="px-3 py-3">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={ligne.quantite}
                              onChange={(event) =>
                                modifierLigne(
                                  index,
                                  "quantite",
                                  event.target.value
                                )
                              }
                              className={`${inputClass} text-right`}
                            />
                          </td>

                          <td className="px-3 py-3">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={ligne.prixUnitaireHt}
                              onChange={(event) =>
                                modifierLigne(
                                  index,
                                  "prixUnitaireHt",
                                  event.target.value
                                )
                              }
                              className={`${inputClass} text-right`}
                            />
                          </td>

                          <td className="px-3 py-3">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={ligne.tauxTva}
                              onChange={(event) =>
                                modifierLigne(
                                  index,
                                  "tauxTva",
                                  event.target.value
                                )
                              }
                              className={`${inputClass} text-right`}
                            />
                          </td>

                          <td className="px-3 py-3 text-right">
                            <div className="font-semibold tabular-nums text-[#273241]">
                              -{formatMontant(calcul.montantHt)}
                            </div>

                            <div className="text-xs text-[#89919d]">
                              MAD
                            </div>
                          </td>

                          <td className="px-3 py-3 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                supprimerLigne(index)
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

                    {lignes.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-6 py-10 text-center text-sm text-[#89919d]"
                        >
                          Aucune ligne. Cliquez sur « Ajouter
                          une ligne ».
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          {/* COLONNE TOTAUX */}
          <div className="space-y-6">
            <section className="rounded-2xl border border-[#e1e6ec] bg-white p-6 shadow-sm">
              <h2 className="mb-5 text-xs font-semibold uppercase tracking-wide text-[#456f9f]">
                Totaux de l'avoir
              </h2>

              <div className="space-y-1">
                <div className="flex items-center justify-between gap-4 border-b border-[#edf0f3] py-3 text-sm">
                  <span className="text-[#6d7682]">
                    Total HT
                  </span>

                  <span className="font-semibold tabular-nums text-[#273241]">
                    -{formatMontant(totaux.ht)} MAD
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4 border-b border-[#edf0f3] py-3 text-sm">
                  <span className="text-[#6d7682]">
                    Total TVA
                  </span>

                  <span className="font-semibold tabular-nums text-[#273241]">
                    -{formatMontant(totaux.tva)} MAD
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4 py-4">
                  <span className="font-bold text-[#273241]">
                    Total TTC
                  </span>

                  <span className="text-xl font-bold tabular-nums text-purple-700">
                    -{formatMontant(totaux.ttc)} MAD
                  </span>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-purple-200 bg-purple-50 p-5">
              <h3 className="font-semibold text-purple-900">
                Fonctionnement
              </h3>

              <ul className="mt-3 space-y-2 text-sm text-purple-800">
                <li>• Les lignes sont préremplies depuis la facture.</li>
                <li>• Les quantités et montants sont modifiables.</li>
                <li>• Les totaux sont recalculés automatiquement.</li>
                <li>• L'avoir sera créé en brouillon.</li>
                <li>• La facture originale reste inchangée.</li>
              </ul>
            </section>

            <div className="flex flex-col gap-3">
              <button
                type="submit"
                disabled={
                  submitting ||
                  lignes.length === 0 ||
                  totaux.ttc <= 0
                }
                className={`${btnPrimary} w-full py-3`}
              >
                {submitting
                  ? "Création en cours..."
                  : "Créer l'avoir"}
              </button>

              <Link
                href={`/factures/${id}`}
                className={`${btnSecondary} w-full`}
              >
                Annuler
              </Link>
            </div>
          </div>
        </div>
      </form>
    </AppShell>
  );
}