import { prisma } from "@/lib/prisma";

export class ValidationError extends Error {}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const num = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export const str = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

type LigneInput = {
  description?: unknown;
  quantite?: unknown;
  prixUnitaireHt?: unknown;
  tauxTva?: unknown;
};

export type NouveauClientInput = {
  typeClient?: unknown; // "entreprise" | "particulier"
  nomRaisonSociale?: unknown;
  adresse?: unknown;
  ville?: unknown;
  ice?: unknown;
  ifFiscal?: unknown;
  rc?: unknown;
  telephone?: unknown;
  email?: unknown;
};

/** Recalcule les lignes et les totaux côté serveur (on ne fait jamais confiance au navigateur). */
export function construireLignes(input: unknown) {
  const source: LigneInput[] = Array.isArray(input) ? input : [];

  const lignes = source
    .map((l, index) => {
      const quantite = num(l.quantite);
      const prixUnitaireHt = num(l.prixUnitaireHt);
      const tauxTva = num(l.tauxTva);
      const montantHt = round2(quantite * prixUnitaireHt);
      const montantTva = round2((montantHt * tauxTva) / 100);
      return {
        ordre: index + 1,
        description: str(l.description),
        quantite,
        prixUnitaireHt,
        tauxTva,
        montantHt,
        montantTva,
        montantTtc: round2(montantHt + montantTva),
      };
    })
    .filter((l) => l.description && l.quantite > 0);

  if (lignes.length === 0) {
    throw new ValidationError(
      "Ajoutez au moins une ligne avec une désignation et une quantité."
    );
  }

  const sousTotalHt = round2(lignes.reduce((s, l) => s + l.montantHt, 0));
  const totalTva = round2(lignes.reduce((s, l) => s + l.montantTva, 0));
  const totalTtc = round2(sousTotalHt + totalTva);

  return { lignes, sousTotalHt, totalTva, totalTtc };
}

/** Date d'émission + date limite de validité (30 jours par défaut). */
export function calculerDates(dateEmissionRaw: unknown, validiteJoursRaw: unknown) {
  const parsed = dateEmissionRaw ? new Date(String(dateEmissionRaw)) : new Date();
  const dateEmission = Number.isNaN(parsed.getTime()) ? new Date() : parsed;

  const validiteJours = Math.min(Math.max(Math.round(num(validiteJoursRaw) || 30), 1), 365);
  const dateValidite = new Date(dateEmission);
  dateValidite.setUTCDate(dateValidite.getUTCDate() + validiteJours);

  return { dateEmission, dateValidite, validiteJours };
}

type ClientDb = Pick<typeof prisma, "client">;

/** Retourne le client existant, ou crée le nouveau client saisi dans le formulaire. */
export async function resoudreClient(
  db: ClientDb,
  clientId: unknown,
  nouveauClient: NouveauClientInput | undefined
) {
  const id = str(clientId);

  if (id) {
    const existant = await db.client.findUnique({ where: { id } });
    if (!existant) throw new ValidationError("Client introuvable.");
    return existant;
  }

  const c = nouveauClient ?? {};
  const nom = str(c.nomRaisonSociale);
  if (!nom) {
    throw new ValidationError("Choisissez un client ou renseignez le nom du nouveau client.");
  }

  const typeClient = str(c.typeClient) === "particulier" ? "particulier" : "entreprise";
  const estEntreprise = typeClient === "entreprise";

  return db.client.create({
    data: {
      typeClient,
      nomRaisonSociale: nom,
      adresse: str(c.adresse) || null,
      ville: str(c.ville) || null,
      // ICE, IF et RC ne concernent que les entreprises.
      ice: (estEntreprise && str(c.ice)) || null,
      ifFiscal: (estEntreprise && str(c.ifFiscal)) || null,
      rc: (estEntreprise && str(c.rc)) || null,
      telephone: str(c.telephone) || null,
      email: str(c.email) || null,
    },
  });
}