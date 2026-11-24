"use client";

import type { Dispatch, SetStateAction } from "react";
import SelecteurArticles, { articleDejaPresent, ligneDepuisArticle } from "./SelecteurArticles";

export type LigneSaisie = {
  articleId?: string | null;
  mode: "simple" | "mesures";
  description: string;
  quantite: number;
  prixUnitaireHt: number;
  tauxTva: number;
  ouvrage: string;
  largeur: number;
  hauteur: number;
  nombre: number;
  unite: "m2" | "ml";
};

export const nouvelleLigne = (): LigneSaisie => ({
  mode: "simple", description: "", quantite: 1, prixUnitaireHt: 0,
  tauxTva: 20, ouvrage: "Fenêtre", largeur: 0, hauteur: 0,
  nombre: 1, unite: "m2",
});

export const OUVRAGES = ["Fenêtre", "Porte", "Rideau", "Garde-corps", "Baie vitrée", "Volet", "Portail", "Cloison", "Autre"];

export function quantiteCalculee(ligne: LigneSaisie): number {
  if (ligne.mode === "simple") return Number(ligne.quantite) || 0;
  const largeur = Number(ligne.largeur) || 0;
  const hauteur = Number(ligne.hauteur) || 0;
  const nombre = Number(ligne.nombre) || 0;
  return (ligne.unite === "m2" ? largeur * hauteur : largeur) * nombre;
}

export function montantHtLigne(ligne: LigneSaisie): number {
  return quantiteCalculee(ligne) * (Number(ligne.prixUnitaireHt) || 0);
}

const formatNombre = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 }).format(n);
const formatPrix = (n: number) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export function lignePourApi(ligne: LigneSaisie) {
  if (ligne.mode === "simple") {
    return { articleId: ligne.articleId, description: ligne.description.trim(), quantite: Number(ligne.quantite), prixUnitaireHt: Number(ligne.prixUnitaireHt), tauxTva: Number(ligne.tauxTva) };
  }
  const nom = ligne.ouvrage === "Autre" ? ligne.description.trim() : ligne.ouvrage;
  const mesures = ligne.unite === "m2"
    ? `${formatNombre(ligne.largeur)} m × ${formatNombre(ligne.hauteur)} m`
    : `${formatNombre(ligne.largeur)} m linéaires`;
  const description = `${nom}${ligne.description.trim() && ligne.ouvrage !== "Autre" ? ` — ${ligne.description.trim()}` : ""} | ${mesures} | ${formatNombre(ligne.nombre)} élément(s) | ${formatNombre(quantiteCalculee(ligne))} ${ligne.unite === "m2" ? "m²" : "ml"} à ${formatPrix(ligne.prixUnitaireHt)} MAD/${ligne.unite === "m2" ? "m²" : "ml"}`;
  return { articleId: ligne.articleId, description, quantite: quantiteCalculee(ligne), prixUnitaireHt: Number(ligne.prixUnitaireHt), tauxTva: Number(ligne.tauxTva) };
}


/** Reconstruit une ligne de mesures enregistrée dans la description du document. */
export function ligneDepuisApi(source: {
  articleId?: string | null;
  description: string;
  quantite: string | number;
  prixUnitaireHt: string | number;
  tauxTva: string | number;
}): LigneSaisie {
  const base: LigneSaisie = {
    articleId: source.articleId,
    ...nouvelleLigne(), description: source.description ?? "",
    quantite: Number(source.quantite),
    prixUnitaireHt: Number(source.prixUnitaireHt),
    tauxTva: Number(source.tauxTva),
  };
  const description = source.description ?? "";
  const morceaux = description.split(/\s*\|\s*/);
  if (morceaux.length < 4) return base;
  const dimension = morceaux[1].match(/^([\d\s.,]+)\s*m\s*[×x]\s*([\d\s.,]+)\s*m$/i);
  const lineaire = morceaux[1].match(/^([\d\s.,]+)\s*m\s+linéaires?$/i);
  const nb = morceaux[2].match(/^([\d\s.,]+)\s*élément\(s\)$/i);
  if ((!dimension && !lineaire) || !nb) return base;
  const nombre = (value: string) => Number(value.replace(/[\s\u00a0\u202f]/g, "").replace(",", "."));
  const premier = morceaux[0].split(/\s+—\s+/);
  const ouvrage = premier[0].trim();
  const connu = OUVRAGES.includes(ouvrage);
  return {
    ...base,
    mode: "mesures",
    ouvrage: connu ? ouvrage : "Autre",
    description: connu ? premier.slice(1).join(" — ") : morceaux[0].trim(),
    largeur: nombre((dimension || lineaire)![1]),
    hauteur: dimension ? nombre(dimension[2]) : 0,
    nombre: nombre(nb[1]),
    unite: dimension ? "m2" : "ml",
  };
}

type Props = { lignes: LigneSaisie[]; setLignes: Dispatch<SetStateAction<LigneSaisie[]>>; titre: string };
const champ = "w-full rounded-lg border border-[#dce1e7] bg-white px-3 py-2 text-sm text-[#18212f] outline-none focus:border-[#456f9f] focus:ring-2 focus:ring-[#456f9f]/20";

export default function EditeurLignesMesures({ lignes, setLignes, titre }: Props) {
  const changer = (index: number, patch: Partial<LigneSaisie>) =>
    setLignes(prev => prev.map((ligne, i) => i === index ? { ...ligne, ...patch } : ligne));
  const ajouter = (mode: LigneSaisie["mode"]) =>
    setLignes(prev => [...prev, { ...nouvelleLigne(), mode }]);
  const supprimer = (index: number) =>
    setLignes(prev => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev);
  return (
    <fieldset className="space-y-4">
      <legend className="text-xs font-semibold uppercase tracking-wide text-[#456f9f]">{titre}</legend>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => ajouter("simple")} className="rounded-lg border border-[#456f9f] px-3 py-2 text-sm font-semibold text-[#456f9f] hover:bg-[#edf3f8]">+ Ligne simple</button>
        <button type="button" onClick={() => ajouter("mesures")} className="rounded-lg bg-[#456f9f] px-3 py-2 text-sm font-semibold text-white hover:bg-[#395f8a]">+ Ligne de mesures</button>
      </div>
      <SelecteurArticles lignes={lignes} onSelection={(article) => {
        const ligne = { ...nouvelleLigne(), ...ligneDepuisArticle(article) };
        setLignes((prev) => {
          if (articleDejaPresent(prev, article)) return prev;
          const derniere = prev.at(-1);
          if (derniere?.mode === "simple" && !derniere.articleId && !derniere.description.trim() &&
              derniere.quantite === 1 && derniere.prixUnitaireHt === 0 && derniere.tauxTva === 20) {
            return [...prev.slice(0, -1), ligne];
          }
          return [...prev, ligne];
        });
      }} />
      {lignes.map((ligne, index) => (
        <div key={index} className="rounded-xl border border-[#e1e6ec] bg-[#fafbfc] p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[#273241]">Ligne {index + 1}</span>
              <select aria-label={`Type de ligne ${index + 1}`} value={ligne.mode} onChange={e => changer(index, { mode: e.target.value as LigneSaisie["mode"] })} className={champ}>
                <option value="simple">Ligne simple</option><option value="mesures">Ligne de mesures</option>
              </select>
            </div>
            <button type="button" onClick={() => supprimer(index)} disabled={lignes.length === 1} className="text-sm font-semibold text-red-700 disabled:opacity-30">Supprimer</button>
          </div>
          {ligne.mode === "mesures" && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs font-semibold text-[#536071]">Ouvrage
                <select className={champ + " mt-1"} value={ligne.ouvrage} onChange={e => changer(index, { ouvrage: e.target.value })}>{OUVRAGES.map(o => <option key={o} value={o}>{o}</option>)}</select>
              </label>
              <label className="text-xs font-semibold text-[#536071]">Facturation
                <select className={champ + " mt-1"} value={ligne.unite} onChange={e => changer(index, { unite: e.target.value as LigneSaisie["unite"] })}><option value="m2">Surface (m²)</option><option value="ml">Mètre linéaire (ml)</option></select>
              </label>
              <label className="text-xs font-semibold text-[#536071]">Largeur (m)
                <input className={champ + " mt-1"} type="number" min="0" step="any" value={ligne.largeur || ""} onChange={e => changer(index, { largeur: Number(e.target.value) })} placeholder="1.20" /></label>
              {ligne.unite === "m2" && <label className="text-xs font-semibold text-[#536071]">Hauteur (m)
                <input className={champ + " mt-1"} type="number" min="0" step="any" value={ligne.hauteur || ""} onChange={e => changer(index, { hauteur: Number(e.target.value) })} placeholder="1.50" /></label>}
              <label className="text-xs font-semibold text-[#536071]">Nombre d'éléments
                <input className={champ + " mt-1"} type="number" min="1" step="1" value={ligne.nombre} onChange={e => changer(index, { nombre: Number(e.target.value) })} /></label>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs font-semibold text-[#536071] lg:col-span-2">{ligne.mode === "simple" ? "Description" : "Détails / finition (facultatif sauf Autre)"}
              <input className={champ + " mt-1"} value={ligne.description} onChange={e => changer(index, { description: e.target.value })} placeholder={ligne.mode === "simple" ? "Description de l'article" : "Ex : Aluminium noir, double vitrage"} required={ligne.mode === "simple" || ligne.ouvrage === "Autre"} /></label>
            {ligne.mode === "simple" && <label className="text-xs font-semibold text-[#536071]">Quantité
              <input className={champ + " mt-1"} type="number" min="0.01" step="any" value={ligne.quantite} onChange={e => changer(index, { quantite: Number(e.target.value) })} /></label>}
            <label className="text-xs font-semibold text-[#536071]">Prix HT {ligne.mode === "mesures" ? (ligne.unite === "m2" ? "(MAD/m²)" : "(MAD/ml)") : "(MAD/unité)"}
              <input className={champ + " mt-1"} type="number" min="0" step="any" value={ligne.prixUnitaireHt || ""} onChange={e => changer(index, { prixUnitaireHt: Number(e.target.value) })} /></label>
            <label className="text-xs font-semibold text-[#536071]">TVA (%)
              <input className={champ + " mt-1"} type="number" min="0" max="100" step="any" value={ligne.tauxTva} onChange={e => changer(index, { tauxTva: Number(e.target.value) })} /></label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e1e6ec] pt-3 text-sm">
            <span className="text-[#536071]">{ligne.mode === "mesures" ? `${formatNombre(quantiteCalculee(ligne))} ${ligne.unite === "m2" ? "m²" : "ml"} au total` : `${formatNombre(quantiteCalculee(ligne))} unité(s)`}</span>
            <span className="font-semibold text-[#273241]">HT : {formatPrix(montantHtLigne(ligne))} MAD</span>
          </div>
        </div>
      ))}
    </fieldset>
  );
}
