import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const facture = await prisma.facture.findUnique({
      where: { id },
    });

    if (!facture) {
      return NextResponse.json(
        {
          success: false,
          message: "Facture introuvable.",
        },
        { status: 404 }
      );
    }

    if (facture.statut === "payee") {
      return NextResponse.json(
        {
          success: false,
          message: "Une facture payée ne peut pas être annulée.",
        },
        { status: 400 }
      );
    }

    if (facture.statut === "annulee") {
      return NextResponse.json(
        {
          success: false,
          message: "Cette facture est déjà annulée.",
        },
        { status: 400 }
      );
    }

    const factureAnnulee = await prisma.facture.update({
      where: { id },
      data: {
        statut: "annulee",
      },
      include: {
        client: true,
        lignes: {
          orderBy: { ordre: "asc" },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Facture annulée avec succès.",
      facture: factureAnnulee,
    });
  } catch (error) {
    console.error("ERREUR ANNULATION FACTURE :", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Erreur lors de l'annulation de la facture",
      },
      { status: 500 }
    );
  }
}