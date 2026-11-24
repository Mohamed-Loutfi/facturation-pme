"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "./components/AppShell";

type Client = {
  id: string;
  nomRaisonSociale: string;
};

type Facture = {
  id: string;
  numero: string;
  typeDocument: string;
  statut: string;
  totalTtc: string | number;
  dateEmission: string | null;
  client: Client | null;
};

type Entreprise = {
  raisonSociale: string;
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

const formatMoney = (value: number) =>
  new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const formatDate = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

const plural = (count: number, word: string) =>
  `${count} ${word}${count > 1 ? "s" : ""}`;

function StatCard({
  label,
  value,
  unit,
  hint,
}: {
  label: string;
  value: string;
  unit?: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-[#e1e6ec] bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-[#697381]">{label}</p>

      <p className="mt-3 text-2xl font-bold tabular-nums text-[#18212f]">
        {value}
        {unit && (
          <span className="ml-1.5 text-sm font-semibold text-[#89919d]">
            {unit}
          </span>
        )}
      </p>

      <p className="mt-1 text-xs text-[#89919d]">{hint}</p>
    </div>
  );
}

export default function HomePage() {
  const [factures, setFactures] = useState<Facture[]>([]);
  const [entreprise, setEntreprise] = useState<Entreprise | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [facturesResponse, entrepriseResponse] = await Promise.all([
          fetch("/api/factures"),
          fetch("/api/entreprise"),
        ]);

        if (facturesResponse.ok) {
          const data = await facturesResponse.json();

          if (Array.isArray(data)) {
            setFactures(data);
          } else if (Array.isArray(data.factures)) {
            setFactures(data.factures);
          }
        }

        if (entrepriseResponse.ok) {
          const data = await entrepriseResponse.json();
          setEntreprise(data.entreprise ?? data);
        }
      } catch (error) {
        console.error("Erreur chargement tableau de bord :", error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const stats = useMemo(() => {
    const sum = (list: Facture[]) =>
      list.reduce((total, f) => total + Number(f.totalTtc || 0), 0);

    const normales = factures.filter((f) => f.typeDocument !== "facture");
    const emises = normales.filter((f) => f.statut === "emise");
    const payees = normales.filter((f) => f.statut === "payee");
    const brouillons = normales.filter((f) => f.statut === "brouillon");
    const facturees = normales.filter(
      (f) => f.statut !== "annulee" && f.statut !== "brouillon"
    );

    return {
      facturees,
      montantFacture: sum(facturees),
      emises,
      montantAttente: sum(emises),
      payees,
      montantPaye: sum(payees),
      brouillons,
    };
  }, [factures]);

  const recents = useMemo(
    () =>
      [...factures]
        .sort((a, b) => {
          const da = a.dateEmission ? new Date(a.dateEmission).getTime() : 0;
          const db = b.dateEmission ? new Date(b.dateEmission).getTime() : 0;
          return db - da;
        })
        .slice(0, 8),
    [factures]
  );

  const dash = "—";

  return (
    <AppShell>
        {/* ------------------------------ Titre ----------------------------- */}

        <section className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Tableau de bord
            </h1>
            {entreprise?.raisonSociale && (
              <p className="mt-1 text-sm text-[#6d7682]">
                {entreprise.raisonSociale}
              </p>
            )}
          </div>

          <div className="flex gap-3">
  <Link
    href="/devis/nouveau"
    className="inline-flex items-center justify-center rounded-lg border border-[#dce1e7] bg-white px-4 py-2.5 text-sm font-semibold text-[#4c5663] transition hover:bg-[#f6f8fb]"
  >
    + Nouveau devis
  </Link>

  <Link
    href="/factures"
    className="inline-flex items-center justify-center rounded-lg bg-[#456f9f] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#395f8a]"
  >
    + Nouvelle facture
  </Link>
</div>
        </section>

        {/* -------------------------- Statistiques -------------------------- */}

        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Montant facturé"
            value={loading ? dash : formatMoney(stats.montantFacture)}
            unit="MAD"
            hint={plural(stats.facturees.length, "facture") + " hors brouillons"}
          />

          <StatCard
            label="Encaissé"
            value={loading ? dash : formatMoney(stats.montantPaye)}
            unit="MAD"
            hint={plural(stats.payees.length, "facture") + " payée" + (stats.payees.length > 1 ? "s" : "")}
          />

          <StatCard
            label="En attente de paiement"
            value={loading ? dash : formatMoney(stats.montantAttente)}
            unit="MAD"
            hint={plural(stats.emises.length, "facture") + " émise" + (stats.emises.length > 1 ? "s" : "")}
          />

          <StatCard
            label="Brouillons"
            value={loading ? dash : String(stats.brouillons.length)}
            hint="À finaliser et émettre"
          />
        </section>

        {/* ------------------------ Documents récents ----------------------- */}

        <section className="rounded-2xl border border-[#e1e6ec] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#e8ebef] px-6 py-4">
            <h2 className="text-lg font-bold">Documents récents</h2>

            <Link
              href="/factures"
              className="text-sm font-semibold text-[#456f9f] hover:underline"
            >
              Voir tout →
            </Link>
          </div>

          {loading ? (
            <div className="px-6 py-12 text-center text-sm text-[#89919d]">
              Chargement des documents...
            </div>
          ) : recents.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="font-semibold text-[#273241]">Aucun document</p>
              <p className="mt-1 text-sm text-[#89919d]">
                Créez votre première facture pour commencer.
              </p>
              <Link
                href="/factures"
                className="mt-5 inline-flex rounded-lg bg-[#456f9f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#395f8a]"
              >
                Créer une facture
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr className="border-b border-[#e8ebef] bg-[#fafbfc] text-left">
                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-[#7b8490]">
                      Document
                    </th>
                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-[#7b8490]">
                      Client
                    </th>
                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-[#7b8490]">
                      Date
                    </th>
                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-[#7b8490]">
                      Statut
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#7b8490]">
                      Montant TTC (MAD)
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#7b8490]">
                      PDF
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {recents.map((facture) => {
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

                        <td className="px-6 py-3.5 text-sm text-[#3e4855]">
                          {facture.client?.nomRaisonSociale || "-"}
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

                        <td className="px-6 py-3.5 text-right text-sm font-semibold tabular-nums text-[#273241]">
                          {formatMoney(Number(facture.totalTtc || 0))}
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
          )}
        </section>
    </AppShell>
  );
}