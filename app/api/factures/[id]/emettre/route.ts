import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const facture = await prisma.facture.findUnique({
      where: {
        id,
      },
      include: {
        lignes: true,
        client: true,
      },
    });

    if (!facture) {
      return NextResponse.json(
        {
          success: false,
          message: "Document introuvable.",
        },
        { status: 404 }
      );
    }

    if (facture.statut !== "brouillon") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Seul un document au statut brouillon peut être émis.",
        },
        { status: 400 }
      );
    }

    if (!facture.client) {
      return NextResponse.json(
        {
          success: false,
          message: "Le client du document est introuvable.",
        },
        { status: 400 }
      );
    }

    if (!facture.lignes || facture.lignes.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Impossible d'émettre un document sans ligne.",
        },
        { status: 400 }
      );
    }

    if (
      facture.typeDocument === "avoir" &&
      !facture.factureReferenceId
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "L'avoir doit être rattaché à une facture d'origine.",
        },
        { status: 400 }
      );
    }

    const documentEmis = await prisma.facture.update({
      where: {
        id,
      },
      data: {
        statut: "emise",
        emiseAt: new Date(),
      },
      include: {
        client: true,
        lignes: true,
      },
    });

    const typeDocument =
      facture.typeDocument === "avoir"
        ? "avoir"
        : "facture";

    return NextResponse.json({
      success: true,
      message:
        typeDocument === "avoir"
          ? "Avoir émis avec succès."
          : "Facture émise avec succès.",
      facture: documentEmis,
    });
  } catch (error) {
    console.error("ERREUR ÉMISSION :", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Erreur lors de l'émission du document.",
      },
      { status: 500 }
    );
  }
}