"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import AppShell from "@/app/components/AppShell";
import PhotoArticle from "@/app/components/PhotoArticle";
import type { ArticleCatalogue } from "@/app/components/SelecteurArticles";

const vide = { reference: "", designation: "", description: "", unite: "pièce", prixUnitaireHt: "", tauxTva: "20" };
const champ = "mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2";
const action = "rounded-lg border border-[#456f9f] px-3 py-2 font-medium text-[#456f9f] disabled:opacity-50";
const actionDanger = "rounded-lg border border-red-300 px-3 py-2 font-medium text-red-700 hover:bg-red-50 disabled:opacity-50";

export default function ArticlesPage() {
  const [articles, setArticles] = useState<ArticleCatalogue[] | null>(null);
  const [recherche, setRecherche] = useState("");
  const [formulaire, setFormulaire] = useState(vide);
  const [id, setId] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [erreurFormulaire, setErreurFormulaire] = useState("");
  const modale = useRef<HTMLDialogElement>(null);
  const formulaireRef = useRef<HTMLFormElement>(null);
  const champReference = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controleur = new AbortController();
    async function charger() {
      try {
        const response = await fetch("/api/articles", { signal: controleur.signal });
        if (!response.ok) throw new Error();
        const resultat: ArticleCatalogue[] = await response.json();
        if (!controleur.signal.aborted) setArticles(resultat);
      } catch {
        if (!controleur.signal.aborted) setErreur("Impossible de charger les articles.");
      }
    }
    void charger();
    return () => controleur.abort();
  }, []);

  function definir(champ: keyof typeof vide, valeur: string) {
    setFormulaire((precedent) => ({ ...precedent, [champ]: valeur }));
  }

  async function envoyer(url: string, method: "POST" | "PUT" | "PATCH" | "DELETE", data?: FormData | { actif: boolean }) {
    const afficherErreur = method === "POST" || method === "PUT" ? setErreurFormulaire : setErreur;
    afficherErreur("");
    setEnCours(true);
    const messageErreur = method === "DELETE" ? "Impossible de supprimer l’article." : "Impossible d’enregistrer l’article.";
    try {
      const response = await fetch(url, {
        method,
        headers: data && !(data instanceof FormData) ? { "Content-Type": "application/json" } : undefined,
        body: data instanceof FormData ? data : data && JSON.stringify(data),
      });
      const resultat = await response.json();
      if (!response.ok) {
        afficherErreur(resultat.erreur ?? messageErreur);
        return false;
      }
      setArticles((precedents) => {
        const autres = (precedents ?? []).filter((item) => item.id !== resultat.id);
        return method === "DELETE" ? autres : [...autres, resultat as ArticleCatalogue];
      });
      return true;
    } catch {
      afficherErreur(messageErreur);
      return false;
    } finally {
      setEnCours(false);
    }
  }

  async function enregistrer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    for (const [champ, valeur] of Object.entries(formulaire)) data.set(champ, valeur);
    const reussi = await envoyer(id ? `/api/articles/${id}` : "/api/articles", id ? "PUT" : "POST", data);
    if (reussi) modale.current?.close();
  }

  function ouvrirFormulaire(article?: ArticleCatalogue) {
    formulaireRef.current?.reset();
    setErreurFormulaire("");
    setId(article?.id ?? null);
    setFormulaire(article ? {
      reference: article.reference,
      designation: article.designation,
      description: article.description ?? "",
      unite: article.unite,
      prixUnitaireHt: article.prixUnitaireHt,
      tauxTva: article.tauxTva,
    } : vide);
    modale.current?.showModal();
    champReference.current?.focus();
  }

  async function supprimer(article: ArticleCatalogue) {
    if (!window.confirm(`Supprimer définitivement l’article « ${article.designation} » du catalogue ?`)) return;
    await envoyer(`/api/articles/${article.id}`, "DELETE");
  }

  const terme = recherche.trim().toLocaleLowerCase("fr");
  const articleModifie = articles?.find((article) => article.id === id);
  const resultats = articles?.filter((article) =>
    [article.reference, article.designation].some((valeur) => valeur.toLocaleLowerCase("fr").includes(terme))
  ).sort((a, b) => a.designation.localeCompare(b.designation, "fr"));

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Articles</h1>
        <button className={action} disabled={enCours || articles === null} type="button" onClick={() => ouvrirFormulaire()}>
          + Nouvel article
        </button>
      </div>
      {erreur && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-red-700">{erreur}</p>}
      <dialog
        ref={modale}
        aria-labelledby="titre-formulaire-article"
        className="m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-xl border border-[#e1e6ec] bg-white p-5 text-[#273241] shadow-xl backdrop:bg-slate-900/50 sm:p-6"
        onCancel={(event) => {
          if (enCours) event.preventDefault();
        }}
      >
        <form ref={formulaireRef} onSubmit={enregistrer}>
          <h2 id="titre-formulaire-article" className="mb-4 text-lg font-semibold">{id ? "Modifier l’article" : "Nouvel article"}</h2>
          {erreurFormulaire && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreurFormulaire}</p>}
          <fieldset disabled={enCours || articles === null}>
            <div className="grid gap-4 text-sm sm:grid-cols-2">
              <label>Référence<input ref={champReference} required className={champ} value={formulaire.reference} onChange={(e) => definir("reference", e.target.value)} /></label>
              <label>Désignation<input required className={champ} value={formulaire.designation} onChange={(e) => definir("designation", e.target.value)} /></label>
              <label>Unité
                <select className={champ} value={formulaire.unite} onChange={(e) => definir("unite", e.target.value)}>
                  <option>pièce</option><option>m²</option><option>ml</option><option>forfait</option>
                </select>
              </label>
              <label>Prix unitaire HT (MAD)<input required type="number" min="0" max="999999999999.99" step="0.01" className={champ} value={formulaire.prixUnitaireHt} onChange={(e) => definir("prixUnitaireHt", e.target.value)} /></label>
              <label>TVA (%)<input required type="number" min="0" max="99.99" step="0.01" className={champ} value={formulaire.tauxTva} onChange={(e) => definir("tauxTva", e.target.value)} /></label>
              <label className="sm:col-span-2">Description (facultatif)<input className={champ} value={formulaire.description} onChange={(e) => definir("description", e.target.value)} /></label>
              <div className="space-y-2 sm:col-span-2">
                <label className="block">
                  {articleModifie?.photoType ? "Remplacer la photo" : "Photo (facultatif)"}
                  <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" className={champ} aria-describedby="formats-photo-article" />
                </label>
                <p id="formats-photo-article" className="text-xs text-slate-600">JPEG, PNG ou WebP. 5 Mo maximum.</p>
                {articleModifie?.photoType && (
                  <div className="flex items-center gap-3">
                    <PhotoArticle article={articleModifie} />
                    <label className="flex items-center gap-2">
                      <input type="checkbox" name="retirerPhoto" value="1" />
                      Retirer la photo actuelle
                    </label>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button className={action} type="button" onClick={() => modale.current?.close()}>Annuler</button>
              <button className={action} type="submit">{id ? "Enregistrer" : "Créer l’article"}</button>
            </div>
          </fieldset>
        </form>
      </dialog>
      <section className="rounded-xl border border-[#e1e6ec] bg-white p-5">
        <label className="block max-w-md text-sm font-medium">
          Rechercher par référence ou désignation
          <input type="search" className={champ} value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </label>
        {!resultats && !erreur && <p role="status" className="mt-4">Chargement…</p>}
        {resultats?.length === 0 && <p role="status" className="mt-4">Aucun article trouvé.</p>}
        <ul className="mt-4 divide-y">
          {resultats?.map((article) => (
            <li key={article.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <div className="flex items-center gap-3">
                <PhotoArticle article={article} />
                <div>
                  <p className="font-semibold">{article.reference} · {article.designation}</p>
                  <p>{article.prixUnitaireHt} MAD HT / {article.unite} · TVA {article.tauxTva} % · {article.actif ? "Actif" : "Archivé"}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className={action} disabled={enCours} type="button" onClick={() => ouvrirFormulaire(article)}>Modifier</button>
                <button className={action} disabled={enCours} type="button" onClick={() => {
                  void envoyer(`/api/articles/${article.id}`, "PATCH", { actif: !article.actif });
                }}>{article.actif ? "Archiver" : "Réactiver"}</button>
                <button className={actionDanger} disabled={enCours} type="button" onClick={() => void supprimer(article)}>Supprimer</button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}
