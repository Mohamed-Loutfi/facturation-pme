"use client";

import { useEffect, useState } from "react";
import PhotoArticle from "./PhotoArticle";

export type ArticleCatalogue = {
  id: string;
  reference: string;
  designation: string;
  description: string | null;
  unite: string;
  prixUnitaireHt: string;
  tauxTva: string;
  actif: boolean;
  photoType: string | null;
  updatedAt: string;
};

export function ligneDepuisArticle(article: ArticleCatalogue) {
  const libelle = article.description
    ? `${article.designation} — ${article.description}`
    : article.designation;
  return {
    articleId: article.id,
    description: `${libelle} (${article.unite})`,
    quantite: 1,
    prixUnitaireHt: Number(article.prixUnitaireHt),
    tauxTva: Number(article.tauxTva),
  };
}

export function articleDejaPresent(
  lignes: { articleId?: string | null; description: string }[],
  article: ArticleCatalogue,
) {
  const description = ligneDepuisArticle(article).description;
  return lignes.some((ligne) =>
    ligne.articleId ? ligne.articleId === article.id : ligne.description.trim() === description
  );
}

export default function SelecteurArticles({ onSelection, lignes }: {
  onSelection: (article: ArticleCatalogue) => void;
  lignes: Parameters<typeof articleDejaPresent>[0];
}) {
  const [ouvert, setOuvert] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [articles, setArticles] = useState<ArticleCatalogue[]>([]);
  const [etat, setEtat] = useState<"chargement" | "pret" | "erreur">("chargement");

  useEffect(() => {
    if (!ouvert) return;
    const controleur = new AbortController();
    const params = new URLSearchParams({ actif: "1", q: recherche });
    const delai = setTimeout(async () => {
      try {
        const response = await fetch(`/api/articles?${params}`, { signal: controleur.signal });
        if (!response.ok) throw new Error();
        const resultat: ArticleCatalogue[] = await response.json();
        if (controleur.signal.aborted) return;
        setArticles(resultat);
        setEtat("pret");
      } catch {
        if (!controleur.signal.aborted) setEtat("erreur");
      }
    }, 200);
    return () => {
      clearTimeout(delai);
      controleur.abort();
    };
  }, [ouvert, recherche]);

  return (
    <div className="space-y-2">
      <button type="button" aria-expanded={ouvert} className="rounded-lg border border-[#456f9f] px-3 py-2 text-sm font-semibold text-[#456f9f]" onClick={() => {
        setOuvert(!ouvert);
        setRecherche("");
        setEtat("chargement");
      }}>
        {ouvert ? "Fermer le catalogue" : "+ Ajouter depuis le catalogue"}
      </button>
      {ouvert && (
        <div className="space-y-2 rounded-lg border border-[#e1e6ec] bg-white p-3">
          <label className="block text-sm font-medium">
            Référence ou désignation
            <input type="search" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" value={recherche} onChange={(event) => {
              setRecherche(event.target.value);
              setEtat("chargement");
            }} />
          </label>
          {etat === "chargement" && <p role="status">Chargement…</p>}
          {etat === "erreur" && <p role="alert">Impossible de charger le catalogue.</p>}
          {etat === "pret" && (articles.length ? (
            <ul className="max-h-60 divide-y overflow-auto">
              {articles.map((article) => {
                const present = articleDejaPresent(lignes, article);
                return <li key={article.id}>
                  <button type="button" disabled={present} className="flex w-full items-center gap-3 rounded px-2 py-2 text-left text-sm hover:bg-[#edf3f8] disabled:opacity-60" onClick={() => {
                    onSelection(article);
                    setOuvert(false);
                  }}>
                    <PhotoArticle article={article} />
                    <span>
                      {article.reference} · {article.designation} · {article.prixUnitaireHt} MAD HT / {article.unite}
                      {present && " · Déjà ajouté"}
                    </span>
                  </button>
                </li>;
              })}
            </ul>
          ) : <p role="status">Aucun article actif trouvé.</p>)}
        </div>
      )}
    </div>
  );
}
