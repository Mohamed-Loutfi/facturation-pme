import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = {
  params: Promise<{ id: string }>;
};

// GET /api/clients/:id
export async function GET(
  request: Request,
  { params }: Params
) {
  try {
    const { id } = await params;

    const client = await prisma.client.findUnique({
      where: { id },
    });

    if (!client) {
      return NextResponse.json(
        {
          success: false,
          message: "Client introuvable",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      client,
    });
  } catch (error) {
    console.error("ERREUR GET CLIENT :", error);

    return NextResponse.json(
      {
        success: false,
        message: "Erreur lors de la récupération du client",
      },
      { status: 500 }
    );
  }
}

// PUT /api/clients/:id
export async function PUT(
  request: Request,
  { params }: Params
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const {
      typeClient,
      nomRaisonSociale,
      ice,
      ifFiscal,
      rc,
      adresse,
      ville,
      telephone,
      email,
    } = body;

    if (!nomRaisonSociale) {
      return NextResponse.json(
        {
          success: false,
          message: "Le nom ou la raison sociale est obligatoire",
        },
        { status: 400 }
      );
    }

    if (typeClient === "entreprise" && !ice) {
      return NextResponse.json(
        {
          success: false,
          message: "L'ICE est obligatoire pour une entreprise",
        },
        { status: 400 }
      );
    }

    const client = await prisma.client.update({
      where: { id },
      data: {
        typeClient: typeClient || "entreprise",
        nomRaisonSociale,
        ice: ice || null,
        ifFiscal: ifFiscal || null,
        rc: rc || null,
        adresse: adresse || null,
        ville: ville || null,
        telephone: telephone || null,
        email: email || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Client modifié avec succès",
      client,
    });
  } catch (error) {
    console.error("ERREUR UPDATE CLIENT :", error);

    return NextResponse.json(
      {
        success: false,
        message: "Erreur lors de la modification du client",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// DELETE /api/clients/:id
export async function DELETE(
  request: Request,
  { params }: Params
) {
  try {
    const { id } = await params;

    await prisma.client.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Client supprimé avec succès",
    });
  } catch (error) {
    console.error("ERREUR DELETE CLIENT :", error);

    return NextResponse.json(
      {
        success: false,
        message: "Erreur lors de la suppression du client",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}