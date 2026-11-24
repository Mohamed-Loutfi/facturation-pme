import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ValidationError,
  calculerDates,
  construireLignes,
  resoudreClient,
  str,
  type NouveauClientInput,
} from "@/lib/devis";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

type DevisInput = {
  clientId?: unknown;
  nouveauClient?: NouveauClientInput;
  dateEmission?: unknown;
  validiteJours?: unknown;
  modePaiement?: unknown;
  lignes?: unknown;
};

const reponse = (message: string, status: number) =>
  NextResponse.json({ success: false, message }, { status });

// Vérifie que le document est un devis encore modifiable (non converti en facture).
// Retourne une réponse d'erreur, ou null si tout est bon.
async function verifierModifiable(id: string): Promise<NextResponse | null> {
  const devis = await prisma.facture.findUnique({
    where: { id },
    select: {
      typeDocument: true,
      facturesIssues: { select: { numero: true } },
    },
  });

  if (!devis || devis.typeDocument !== "devis") {
    return reponse("Devis introuvable.", 404);
  }

  if (devis.facturesIssues.length > 0) {
    return reponse(
      `Ce devis a été converti en facture ${devis.facturesIssues[0].numero} : il n'est plus modifiable.`,
      409
    );
  }

  return null;
}

/* ------------------------------- Lecture ----------------------------------- */

export async function GET(_request: Request, { params }: Context) {
  try {
    const { id } = await params;

    const devis = await prisma.facture.findUnique({
      where: { id },
      include: {
        client: true,
        lignes: { orderBy: { ordre: "asc" } },
        facturesIssues: { select: { id: true, numero: true } },
      },
    });

    if (!devis || devis.typeDocument !== "devis") {
      return reponse("Devis introuvable.", 404);
    }

    return NextResponse.json({ success: true, data: devis });
  } catch (error) {
    console.error("ERREUR LECTURE DEVIS :", error);
    return reponse("Impossible de charger le devis.", 500);
  }
}

/* ------------------------------ Modification ------------------------------- */

export async function PUT(request: Request, { params }: Context) {
  try {
    const { id } = await params;

    const refus = await verifierModifiable(id);
    if (refus) return refus;

    const body = (await request.json()) as DevisInput;

    const { lignes, sousTotalHt, totalTva, totalTtc } = construireLignes(body.lignes);
    const { dateEmission, dateValidite } = calculerDates(body.dateEmission, body.validiteJours);

    const devis = await prisma.$transaction(async (tx) => {
      const client = await resoudreClient(tx, body.clientId, body.nouveauClient);

      const entreprise = await tx.entreprise.findFirst({ orderBy: { createdAt: "asc" } });
      if (!entreprise) {
        throw new ValidationError("Renseignez d'abord les informations de l'entreprise.");
      }

      // Les lignes sont remplacées en bloc.
      await tx.ligneFacture.deleteMany({ where: { factureId: id } });

      return tx.facture.update({
        where: { id },
        data: {
          clientId: client.id,
          clientSnapshot: JSON.parse(JSON.stringify(client)),
          entrepriseSnapshot: JSON.parse(JSON.stringify(entreprise)),
          dateEmission,
          dateValidite,
          dateEcheance: dateValidite,
          modePaiement: str(body.modePaiement) || null,
          sousTotalHt,
          totalTva,
          totalTtc,
          montantEnLettres: null, // recalculé à la génération du PDF
          lignes: { create: lignes },
        },
        select: { id: true, numero: true },
      });
    });

    return NextResponse.json({ success: true, data: devis });
  } catch (error) {
    if (error instanceof ValidationError) {
      return reponse(error.message, 400);
    }
    console.error("ERREUR MODIFICATION DEVIS :", error);
    return reponse("Erreur lors de la modification du devis.", 500);
  }
}

/* ------------------------------- Suppression ------------------------------- */

export async function DELETE(_request: Request, { params }: Context) {
  try {
    const { id } = await params;

    const refus = await verifierModifiable(id);
    if (refus) return refus;

    // Les lignes sont supprimées en cascade (onDelete: Cascade).
    await prisma.facture.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("ERREUR SUPPRESSION DEVIS :", error);
    return reponse("Erreur lors de la suppression du devis.", 500);
  }
}