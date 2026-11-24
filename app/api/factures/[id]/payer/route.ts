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
      include: {
        client: true,
        lignes: {
          orderBy: { ordre: "asc" },
        },
      },
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

    if (facture.statut !== "emise") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Seule une facture émise peut être marquée comme payée.",
        },
        { status: 400 }
      );
    }

    const facturePayee = await prisma.facture.update({
      where: { id },
      data: {
        statut: "payee",
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
      message: "Facture marquée comme payée.",
      facture: facturePayee,
    });
  } catch (error) {
    console.error("ERREUR PAIEMENT FACTURE :", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Erreur lors du paiement de la facture",
      },
      { status: 500 }
    );
  }
}