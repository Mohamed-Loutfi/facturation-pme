import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { prochainNumero } from "@/lib/numerotation";
import {
  ValidationError,
  calculerDates,
  construireLignes,
  resoudreClient,
  str,
  type NouveauClientInput,
} from "@/lib/devis";

export const runtime = "nodejs";

type DevisInput = {
  clientId?: unknown;
  nouveauClient?: NouveauClientInput;
  dateEmission?: unknown;
  validiteJours?: unknown;
  modePaiement?: unknown;
  lignes?: unknown;
};

/* ------------------------------ Liste des devis ----------------------------- */

export async function GET() {
  try {
    const devis = await prisma.facture.findMany({
      where: { typeDocument: "devis" },
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { id: true, nomRaisonSociale: true } },
        facturesIssues: { select: { id: true, numero: true } },
      },
    });

    return NextResponse.json({ success: true, data: devis });
  } catch (error) {
    console.error("ERREUR LISTE DEVIS :", error);
    return NextResponse.json(
      { success: false, message: "Impossible de charger les devis." },
      { status: 500 }
    );
  }
}

/* ------------------------------ Création d'un devis ------------------------- */

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DevisInput;

    const { lignes, sousTotalHt, totalTva, totalTtc } = construireLignes(body.lignes);
    const { dateEmission, dateValidite } = calculerDates(body.dateEmission, body.validiteJours);

    const devis = await prisma.$transaction(async (tx) => {
      const client = await resoudreClient(tx, body.clientId, body.nouveauClient);

      const entreprise = await tx.entreprise.findFirst({ orderBy: { createdAt: "asc" } });
      if (!entreprise) {
        throw new ValidationError("Renseignez d'abord les informations de l'entreprise.");
      }

      const numero = await prochainNumero(tx, "DEV", dateEmission);

      return tx.facture.create({
        data: {
          numero,
          typeDocument: "devis",
          statut: "brouillon",
          clientId: client.id,
          clientSnapshot: JSON.parse(JSON.stringify(client)),
          entrepriseSnapshot: JSON.parse(JSON.stringify(entreprise)),
          dateEmission,
          dateValidite,
          // Valeur de repli : la date limite de validité sert d'échéance.
          dateEcheance: dateValidite,
          modePaiement: str(body.modePaiement) || null,
          sousTotalHt,
          totalTva,
          totalTtc,
          lignes: { create: lignes },
        },
        select: { id: true, numero: true },
      });
    });

    return NextResponse.json({ success: true, data: devis }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }
    console.error("ERREUR CRÉATION DEVIS :", error);
    return NextResponse.json(
      { success: false, message: "Erreur lors de la création du devis." },
      { status: 500 }
    );
  }
}