import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { prochainNumero } from "@/lib/numerotation";

export const runtime = "nodejs";

// POST /api/devis/:id/convertir
// Crée une facture (brouillon) à partir d'un devis, en copiant client, lignes et totaux.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const devis = await prisma.facture.findUnique({
      where: { id },
      include: {
        lignes: { orderBy: { ordre: "asc" } },
        facturesIssues: { select: { id: true, numero: true } },
      },
    });

    if (!devis || devis.typeDocument !== "devis") {
      return NextResponse.json(
        { success: false, message: "Devis introuvable." },
        { status: 404 }
      );
    }

    // Un devis ne se convertit qu'une fois.
    if (devis.facturesIssues.length > 0) {
      const existante = devis.facturesIssues[0];
      return NextResponse.json(
        {
          success: false,
          message: `Ce devis a déjà été converti en facture ${existante.numero}.`,
          factureId: existante.id,
        },
        { status: 409 }
      );
    }

    const maintenant = new Date();
    const echeance = new Date(maintenant);
    echeance.setDate(echeance.getDate() + 30);

    const facture = await prisma.$transaction(async (tx) => {
      const numero = await prochainNumero(tx, "FACT", maintenant);

      const creee = await tx.facture.create({
        data: {
          numero,
          typeDocument: "facture",
          statut: "brouillon",
          clientId: devis.clientId,
          clientSnapshot: JSON.parse(JSON.stringify(devis.clientSnapshot)),
          entrepriseSnapshot: JSON.parse(JSON.stringify(devis.entrepriseSnapshot)),
          devisReferenceId: devis.id,
          dateEmission: maintenant,
          dateEcheance: echeance,
          modePaiement: devis.modePaiement,
          sousTotalHt: devis.sousTotalHt,
          totalTva: devis.totalTva,
          totalTtc: devis.totalTtc,
          lignes: {
            create: devis.lignes.map((l, index) => ({
              ordre: l.ordre ?? index + 1,
              description: l.description,
              articleId: l.articleId,
              quantite: l.quantite,
              prixUnitaireHt: l.prixUnitaireHt,
              tauxTva: l.tauxTva,
              montantHt: l.montantHt,
              montantTva: l.montantTva,
              montantTtc: l.montantTtc,
            })),
          },
        },
        select: { id: true, numero: true },
      });

      await tx.facture.update({
        where: { id: devis.id },
        data: { statut: "converti" },
      });

      return creee;
    });

    return NextResponse.json({ success: true, data: facture }, { status: 201 });
  } catch (error) {
    console.error("ERREUR CONVERSION DEVIS :", error);
    return NextResponse.json(
      { success: false, message: "Erreur lors de la conversion du devis." },
      { status: 500 }
    );
  }
}
