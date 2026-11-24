"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import AppShell from "@/app/components/AppShell";
import EditeurLignesMesures, {
  ligneDepuisApi, lignePourApi, montantHtLigne, nouvelleLigne,
  quantiteCalculee, type LigneSaisie,
} from "@/app/components/EditeurLignesMesures";

type DevisApi = {
  numero: string;
  clientId: string;
  dateEmission: string | null;
  dateValidite: string | null;
  modePaiement: string | null;
  lignes: { description: string; quantite: string | number; prixUnitaireHt: string | number; tauxTva: string | number }[];
  facturesIssues: { id: string; numero: string }[];
};
type Client = { id: string; nomRaisonSociale: string };
const inputClass = "w-full rounded-lg border border-[#dce1e7] bg-white px-3 py-2 text-sm text-[#18212f] outline-none focus:border-[#456f9f] focus:ring-2 focus:ring-[#456f9f]/20";
const btnPrimary = "rounded-lg bg-[#456f9f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#395f8a] disabled:opacity-50";
const money = (n: number) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const localDate = (value: string) => {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export default function ModifierDevisPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [devis, setDevis] = useState<DevisApi | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [clientId, setClientId] = useState("");
  const [dateEmission, setDateEmission] = useState("");
  const [validiteJours, setValiditeJours] = useState("30");
  const [modePaiement, setModePaiement] = useState("Virement");
  const [lignes, setLignes] = useState<LigneSaisie[]>([nouvelleLigne()]);

  useEffect(() => {
    if (!id) return;
    let active = true;
    (async () => {
      try {
        const [r, rc] = await Promise.all([
          fetch(`/api/devis/${id}`, { cache: "no-store" }),
          fetch("/api/clients", { cache: "no-store" }),
        ]);
        const data = await r.json();
        if (!r.ok || !data.success) throw new Error(data.message || "Impossible de charger le devis.");
        if (!active) return;
        const d = data.data as DevisApi;
        setDevis(d);
        setClientId(d.clientId);
        setDateEmission(d.dateEmission?.slice(0, 10) || "");
        const jours = d.dateEmission && d.dateValidite
          ? Math.round((Date.parse(d.dateValidite) - Date.parse(d.dateEmission)) / 86400000) : 30;
        setValiditeJours(String(jours > 0 ? jours : 30));
        setModePaiement(d.modePaiement || "Virement");
        setLignes(d.lignes.length ? d.lignes.map(ligneDepuisApi) : [nouvelleLigne()]);
        if (rc.ok) {
          const clientsData = await rc.json();
          if (active && clientsData.success) setClients(clientsData.clients || []);
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Erreur de chargement.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [id]);

  const echeance = useMemo(() => {
    if (!dateEmission || !Number.isInteger(Number(validiteJours)) || Number(validiteJours) <= 0) return "";
    const d = localDate(dateEmission);
    d.setDate(d.getDate() + Number(validiteJours));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, [dateEmission, validiteJours]);
  const ht = lignes.reduce((sum, l) => sum + montantHtLigne(l), 0);
  const tva = lignes.reduce((sum, l) => sum + montantHtLigne(l) * Number(l.tauxTva) / 100, 0);

  async function enregistrer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    if (!clientId || !dateEmission || !echeance || lignes.length === 0) {
      setFormError("Renseignez le client, la date, la durée de validité et au moins une ligne."); return;
    }
    for (const l of lignes) {
      if ((l.mode === "simple" && !l.description.trim()) ||
        (l.mode === "mesures" && ((l.ouvrage === "Autre" && !l.description.trim()) || l.largeur <= 0 || (l.unite === "m2" && l.hauteur <= 0) || !Number.isInteger(l.nombre) || l.nombre <= 0)) ||
        quantiteCalculee(l) <= 0 || l.prixUnitaireHt < 0 || l.tauxTva < 0 || l.tauxTva > 100) {
        setFormError("Vérifiez les descriptions, dimensions, quantités, prix et taux de TVA."); return;
      }
    }
    try {
      setSaving(true);
      const response = await fetch(`/api/devis/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, dateEmission, validiteJours: Number(validiteJours), modePaiement, lignes: lignes.map(lignePourApi) }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Modification du devis impossible.");
      router.push("/devis");
      router.refresh();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Erreur d'enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <AppShell><div className="rounded-xl bg-white p-8">Chargement du devis...</div></AppShell>;
  if (error || !devis) return <AppShell><div className="rounded-xl bg-white p-8"><p>{error || "Devis introuvable."}</p><Link className="mt-4 inline-block text-[#456f9f]" href="/devis">Retour aux devis</Link></div></AppShell>;
  const facture = devis.facturesIssues?.[0];
  if (facture) return <AppShell><div className="rounded-xl bg-white p-8"><h1 className="font-bold">Modification impossible</h1><p>Le devis {devis.numero} a déjà été converti en facture {facture.numero}.</p><Link className="mt-4 inline-block text-[#456f9f]" href={`/factures/${facture.id}`}>Voir la facture</Link></div></AppShell>;

  return (
    <AppShell>
      <Link href="/devis" className="text-sm font-medium text-[#456f9f]">← Devis</Link>
      <h1 className="my-5 text-2xl font-bold">Modifier le devis {devis.numero}</h1>
      <form onSubmit={enregistrer} className="rounded-2xl border border-[#e1e6ec] bg-white shadow-sm">
        <div className="space-y-7 p-6">
          {formError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{formError}</div>}
          <fieldset>
            <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#456f9f]">Informations générales</legend>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="text-sm font-medium md:col-span-3">Client
                <select required value={clientId} onChange={e => setClientId(e.target.value)} className={inputClass + " mt-1"}>
                  <option value="">Sélectionner un client</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.nomRaisonSociale}</option>)}
                  {clientId && !clients.some(c => c.id === clientId) && <option value={clientId}>Client actuel</option>}
                </select>
              </label>
              <label className="text-sm font-medium">Date d'émission
                <input type="date" required value={dateEmission} onChange={e => setDateEmission(e.target.value)} className={inputClass + " mt-1"}/>
              </label>
              <label className="text-sm font-medium">Durée de validité (jours)
                <input type="number" min="1" step="1" required value={validiteJours} onChange={e => setValiditeJours(e.target.value)} className={inputClass + " mt-1"}/>
                <span className="mt-1 block text-xs text-[#6d7682]">Valable jusqu'au : {echeance ? localDate(echeance).toLocaleDateString("fr-FR") : "—"}</span>
              </label>
              <label className="text-sm font-medium">Mode de paiement
                <select value={modePaiement} onChange={e => setModePaiement(e.target.value)} className={inputClass + " mt-1"}>
                  {["Virement", "Chèque", "Espèces", "Carte bancaire", "Prélèvement"].map(m => <option key={m}>{m}</option>)}
                </select>
              </label>
            </div>
          </fieldset>
          <EditeurLignesMesures lignes={lignes} setLignes={setLignes} titre="Lignes du devis" />
          <div className="ml-auto max-w-sm space-y-2 text-sm">
            <div className="flex justify-between"><span>Sous-total HT</span><strong>{money(ht)} MAD</strong></div>
            <div className="flex justify-between"><span>TVA</span><strong>{money(tva)} MAD</strong></div>
            <div className="flex justify-between border-t pt-3 text-lg font-bold text-[#456f9f]"><span>Total TTC</span><span>{money(ht + tva)} MAD</span></div>
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t bg-[#fafbfc] p-4">
          <Link href="/devis" className="rounded-lg border border-[#dce1e7] px-4 py-2 text-sm font-semibold">Annuler</Link>
          <button type="submit" disabled={saving} className={btnPrimary}>{saving ? "Enregistrement..." : "Enregistrer les modifications"}</button>
        </div>
      </form>
    </AppShell>
  );
}
