import { prisma } from "@/lib/prisma";

// Accepte le client Prisma normal ou celui d'une transaction ($transaction).
type Db = Pick<typeof prisma, "compteurFacture" | "compteurDevis">;

/**
 * Prochain numéro basé sur les compteurs annuels (même principe que vos factures).
 * Ex. "FACT-2026-0011" ou "DEV-2026-0001".
 * L'incrément est atomique : à appeler dans la même transaction que la création du document.
 */
export async function prochainNumero(
  db: Db,
  type: "DEV" | "FACT",
  date: Date = new Date()
): Promise<string> {
  const annee = date.getFullYear();

  const compteur =
    type === "FACT"
      ? await db.compteurFacture.upsert({
          where: { annee },
          create: { annee, dernierNumero: 1 },
          update: { dernierNumero: { increment: 1 } },
        })
      : await db.compteurDevis.upsert({
          where: { annee },
          create: { annee, dernierNumero: 1 },
          update: { dernierNumero: { increment: 1 } },
        });

  return `${compteur.prefixe}-${annee}-${String(compteur.dernierNumero).padStart(4, "0")}`;
}
