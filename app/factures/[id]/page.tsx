"use client";

import { ReactNode, useEffect, useState } from "react";
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

  factureReferenceId?: string | null;
  motifAvoir?: string | null;

  clientId: string;
  client: Client;

  dateEmission?: string | null;
  dateEcheance?: string | null;
  modePaiement?: string | null;

  sousTotalHt: string | number;
  totalTva: string | number;
  totalTtc: string | number;

  montantEnLettres?: string | null;

  createdAt: string;
  emiseAt?: string | null;

  lignes: LigneFacture[];
};

type Notice = { type: "success" | "error"; text: string };

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

const btnBase =
  "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
const btnPrimary = `${btnBase} bg-[#456f9f] text-white shadow-sm hover:bg-[#395f8a]`;
const btnSecondary = `${btnBase} border border-[#dce1e7] bg-white text-[#4c5663] hover:bg-[#f6f8fb]`;
const btnDanger = `${btnBase} border border-red-200 bg-white text-red-700 hover:bg-red-50`;

const thClass =
  "px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#7b8490]";

function formatMontant(value: string | number) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatNombre(value: string | number) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
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
/*  Structure commune (header + conteneur)                                    */
/* -------------------------------------------------------------------------- */

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f6f8fb] text-[#18212f]">
      <header className="border-b border-[#e4e8ee] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#456f9f] text-base font-bold text-white">
              F
            </span>
            <span className="text-[15px] font-bold tracking-wide">
              FACTURATION PME
            </span>
          </Link>

          <nav className="flex items-center gap-1 text-sm font-medium text-[#4c5663]">
            <Link
              href="/factures"
              aria-current="page"
              className="rounded-lg bg-[#edf3f8] px-3 py-2 text-[#456f9f]"
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

      <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
    </main>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <dt className="text-[#7b8490]">{label}</dt>
      <dd className="text-right font-medium tabular-nums text-[#273241]">
        {value}
      </dd>
    </div>
  );
}

export default function FactureDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const id = params.id as string;

  const [facture, setFacture] = useState<Facture | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);

  // Action en cours : "emettre" | "payer" | "annuler" | "supprimer" | null
  const [busy, setBusy] = useState<string | null>(null);

  /* ------------------------------------------------------------------ */
  /*  Chargement                                                         */
  /* ------------------------------------------------------------------ */

  async function loadFacture(showLoader = true) {
    try {
      if (showLoader) setLoading(true);
      setError("");

      const response = await fetch(`/api/factures/${id}`, {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Impossible de charger la facture");
      }

      setFacture(data.facture);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Erreur lors du chargement de la facture"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) {
      loadFacture();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /* ------------------------------------------------------------------ */
  /*  Actions                                                            */
  /* ------------------------------------------------------------------ */

  async function executeAction(options: {
    key: string;
    confirmMessage: string;
    endpoint: string;
    method: "PUT" | "DELETE";
    successMessage: string;
    errorMessage: string;
    redirectTo?: string;
  }) {
    if (!window.confirm(options.confirmMessage)) return;

    try {
      setBusy(options.key);
      setNotice(null);

      const response = await fetch(options.endpoint, {
        method: options.method,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || options.errorMessage);
      }

      if (options.redirectTo) {
        router.push(options.redirectTo);
        return;
      }

      await loadFacture(false);
      setNotice({ type: "success", text: options.successMessage });
    } catch (err) {
      console.error(err);

      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : options.errorMessage,
      });
    } finally {
      setBusy(null);
    }
  }

  function genererPdf() {
    window.open(`/api/factures/${id}/pdf`, "_blank");
  }

  function genererPdfClient() {
  window.open(`/api/factures/${id}/pdf?version=client`, "_blank");
}

  /* ------------------------------------------------------------------ */
  /*  États de chargement / erreur                                       */
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
          <Link
            href="/factures"
            className={`${btnPrimary} mt-5`}
          >
            Retour aux factures
          </Link>
        </div>
      </AppShell>
    );
  }

  /* ------------------------------------------------------------------ */
  /*  Données dérivées                                                   */
  /* ------------------------------------------------------------------ */

  const isAvoir = facture.typeDocument === "avoir";
  const isFacture = facture.typeDocument === "facture";
  const statut = getStatut(facture.statut);
  const docLabel = isAvoir ? "Avoir" : "Facture";

  const canModifier = isFacture && facture.statut === "brouillon";
  const canEmettre = facture.statut === "brouillon";
  const canPayer = isFacture && facture.statut === "emise";
  const canCreerAvoir =
    isFacture && (facture.statut === "emise" || facture.statut === "payee");
  const canAnnuler =
    facture.statut === "brouillon" ||
    (isFacture && facture.statut === "emise");
  const canSupprimer = true;

  const client = facture.client;
  const adresseClient = [client?.adresse, client?.ville]
    .filter(Boolean)
    .join(", ");
  const identifiantsClient = [
    client?.ice ? `ICE : ${client.ice}` : null,
    client?.ifFiscal ? `IF : ${client.ifFiscal}` : null,
    client?.rc ? `RC : ${client.rc}` : null,
  ].filter(Boolean) as string[];
  const contactsClient = [client?.telephone, client?.email].filter(
    Boolean
  ) as string[];

  /* ------------------------------------------------------------------ */
  /*  Affichage                                                          */
  /* ------------------------------------------------------------------ */

  return (
    <AppShell>
      {/* ---------------------------- Navigation ---------------------------- */}

      <Link
        href="/factures"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-[#6d7682] transition hover:text-[#456f9f]"
      >
        ← Factures
      </Link>

      {/* --------------------------- Titre + actions ------------------------ */}

      <section className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">
            {docLabel} {facture.numero}
          </h1>

          <span
            className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statut.className}`}
          >
            {statut.label}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={genererPdf} className={btnSecondary}>
            Ouvrir le PDF
          </button>
          <button type="button" onClick={genererPdfClient} className={btnSecondary}>
            PDF client
          </button>

          {canModifier && (
            <button
              type="button"
              onClick={() => router.push(`/factures/${facture.id}/modifier`)}
              className={btnSecondary}
            >
              Modifier
            </button>
          )}

          {canCreerAvoir && (
            <button
              type="button"
              onClick={() => router.push(`/factures/${facture.id}/avoir`)}
              className={btnSecondary}
            >
              Créer un avoir
            </button>
          )}

          {canSupprimer && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() =>
                executeAction({
                  key: "supprimer",
                  confirmMessage:
                    `Voulez-vous vraiment supprimer ${
                      isAvoir ? "l’avoir" : "la facture"
                    } ${facture.numero} ?\n\nCette action est irréversible.`,
                  endpoint: `/api/factures/${id}`,
                  method: "DELETE",
                  successMessage: "Document supprimé avec succès.",
                  errorMessage: "Erreur lors de la suppression de la facture",
                  redirectTo: "/factures",
                })
              }
              className={btnDanger}
            >
              {busy === "supprimer" ? "Suppression..." : "Supprimer"}
            </button>
          )}

          {canAnnuler && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() =>
                executeAction({
                  key: "annuler",
                  confirmMessage:
                    `Voulez-vous vraiment annuler ${
                      isAvoir ? "l’avoir" : "la facture"
                    } ${facture.numero} ?\n\nCette action est irréversible.`,
                  endpoint: `/api/factures/${id}/annuler`,
                  method: "PUT",
                  successMessage: `${isAvoir ? "L’avoir" : "La facture"} ${
                    facture.numero
                  } a été annulé${isAvoir ? "" : "e"} avec succès.`,
                  errorMessage: "Erreur lors de l'annulation de la facture",
                })
              }
              className={btnDanger}
            >
              {busy === "annuler" ? "Annulation..." : "Annuler"}
            </button>
          )}

          {canPayer && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() =>
                executeAction({
                  key: "payer",
                  confirmMessage: `Voulez-vous marquer la facture ${facture.numero} comme payée ?`,
                  endpoint: `/api/factures/${id}/payer`,
                  method: "PUT",
                  successMessage: `La facture ${facture.numero} a été marquée comme payée.`,
                  errorMessage: "Erreur lors du paiement de la facture",
                })
              }
              className={btnPrimary}
            >
              {busy === "payer" ? "Enregistrement..." : "Marquer comme payée"}
            </button>
          )}

          {canEmettre && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() =>
                executeAction({
                  key: "emettre",
                  confirmMessage:
                    `Voulez-vous vraiment émettre ${
                      isAvoir ? "l’avoir" : "la facture"
                    } ${facture.numero} ?\n\n` +
                    "Après émission, ce document ne pourra plus être modifié.",
                  endpoint: `/api/factures/${id}/emettre`,
                  method: "PUT",
                  successMessage: `${isAvoir ? "L’avoir" : "La facture"} ${
                    facture.numero
                  } a été émis${isAvoir ? "" : "e"} avec succès.`,
                  errorMessage: "Erreur lors de l'émission de la facture",
                })
              }
              className={btnPrimary}
            >
              {busy === "emettre"
                ? "Émission..."
                : isAvoir
                  ? "Émettre l'avoir"
                  : "Émettre la facture"}
            </button>
          )}
        </div>
      </section>

      {/* ----------------------------- Notification ------------------------- */}

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

      {/* ------------------------------ Document ---------------------------- */}

      <article className="rounded-2xl border border-[#e1e6ec] bg-white shadow-sm">
        {/* Avoir : référence et motif */}

        {isAvoir && (facture.factureReferenceId || facture.motifAvoir) && (
          <div className="flex flex-col gap-1.5 border-b border-[#e8ebef] border-l-[3px] border-l-red-600 px-6 py-4 text-sm">
            {facture.factureReferenceId && (
              <p>
                <span className="font-semibold text-red-700">
                  Facture d'origine :
                </span>{" "}
                <Link
                  href={`/factures/${facture.factureReferenceId}`}
                  className="font-semibold text-[#456f9f] hover:underline"
                >
                  Consulter la facture
                </Link>
              </p>
            )}

            {facture.motifAvoir && (
              <p className="text-[#3e4855]">
                <span className="font-semibold text-red-700">Motif :</span>{" "}
                {facture.motifAvoir}
              </p>
            )}
          </div>
        )}

        {/* Client + informations */}

        <div className="grid gap-8 border-b border-[#e8ebef] px-6 py-6 md:grid-cols-2">
          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#456f9f]">
              Facturé à
            </h2>

            <p className="text-lg font-bold text-[#18212f]">
              {client?.nomRaisonSociale || "Client introuvable"}
            </p>

            <div className="mt-2 space-y-0.5 text-sm text-[#5f6875]">
              {adresseClient && <p>{adresseClient}</p>}
              {contactsClient.map((contact) => (
                <p key={contact}>{contact}</p>
              ))}
            </div>

            {identifiantsClient.length > 0 && (
              <p className="mt-3 text-xs tabular-nums text-[#89919d]">
                {identifiantsClient.join("  •  ")}
              </p>
            )}
          </div>

          <div>
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#456f9f]">
              Informations
            </h2>

            <dl className="divide-y divide-[#edf0f3]">
              <InfoRow
                label="Date d'émission"
                value={formatDate(facture.dateEmission)}
              />
              <InfoRow
                label="Date d'échéance"
                value={formatDate(facture.dateEcheance)}
              />
              <InfoRow
                label="Mode de paiement"
                value={facture.modePaiement || "-"}
              />
              {facture.emiseAt && (
                <InfoRow
                  label="Émise le"
                  value={formatDate(facture.emiseAt)}
                />
              )}
            </dl>
          </div>
        </div>

        {/* Lignes */}

        <div className="px-6 py-6">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[#456f9f]">
              Détail {isAvoir ? "de l'avoir" : "de la facture"}
            </h2>
            <span className="text-xs text-[#89919d]">
              Montants exprimés en dirhams (MAD)
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#e1e6ec]">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#e8ebef] bg-[#fafbfc]">
                  <th className={`${thClass} w-10`}>#</th>
                  <th className={thClass}>Désignation</th>
                  <th className={`${thClass} text-right`}>Qté</th>
                  <th className={`${thClass} text-right`}>PU HT</th>
                  <th className={`${thClass} text-right`}>TVA %</th>
                  <th className={`${thClass} text-right`}>Total HT</th>
                  <th className={`${thClass} text-right`}>TVA</th>
                  <th className={`${thClass} text-right`}>Total TTC</th>
                </tr>
              </thead>

              <tbody>
                {facture.lignes.map((ligne, index) => (
                  <tr
                    key={ligne.id}
                    className="border-b border-[#edf0f3] last:border-b-0"
                  >
                    <td className="px-4 py-3 tabular-nums text-[#89919d]">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3 font-medium text-[#273241]">
                      {ligne.description}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[#3e4855]">
                      {formatNombre(ligne.quantite)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[#3e4855]">
                      {formatMontant(ligne.prixUnitaireHt)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[#3e4855]">
                      {formatNombre(ligne.tauxTva)} %
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[#3e4855]">
                      {formatMontant(ligne.montantHt)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[#697381]">
                      {formatMontant(ligne.montantTva)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-[#273241]">
                      {formatMontant(ligne.montantTtc)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totaux + montant en lettres */}

        <div className="flex flex-col gap-6 px-6 pb-6 md:flex-row md:items-start md:justify-between">
          <div className="md:max-w-md">
            {facture.montantEnLettres && (
              <>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#89919d]">
                  Arrêté {isAvoir ? "le présent avoir" : "la présente facture"}{" "}
                  à la somme de
                </p>
                <p className="mt-1.5 text-sm text-[#3e4855]">
                  {facture.montantEnLettres}
                </p>
              </>
            )}
          </div>

          <dl className="w-full md:max-w-xs">
            <div className="flex justify-between border-b border-[#edf0f3] py-2 text-sm">
              <dt className="text-[#6d7682]">Total HT</dt>
              <dd className="font-medium tabular-nums">
                {formatMontant(facture.sousTotalHt)}
              </dd>
            </div>

            <div className="flex justify-between border-b border-[#edf0f3] py-2 text-sm">
              <dt className="text-[#6d7682]">Total TVA</dt>
              <dd className="font-medium tabular-nums">
                {formatMontant(facture.totalTva)}
              </dd>
            </div>

            <div className="flex items-baseline justify-between pt-3">
              <dt className="font-bold">Total TTC</dt>
              <dd className="text-xl font-bold tabular-nums text-[#456f9f]">
                {formatMontant(facture.totalTtc)}{" "}
                <span className="text-sm font-semibold">MAD</span>
              </dd>
            </div>
          </dl>
        </div>

        {/* Pied de document */}

        <div className="rounded-b-2xl border-t border-[#e8ebef] bg-[#fafbfc] px-6 py-3 text-xs text-[#89919d]">
          {docLabel} créé{isAvoir ? "" : "e"} le {formatDate(facture.createdAt)}
        </div>
      </article>
    </AppShell>
  );
}