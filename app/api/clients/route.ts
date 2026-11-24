import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const clients = await prisma.client.findMany({
      orderBy: {
        nomRaisonSociale: "asc",
      },
    });

    return NextResponse.json({
      success: true,
      clients,
    });
  } catch (error) {
    console.error("ERREUR GET CLIENTS :", error);

    return NextResponse.json(
      {
        success: false,
        message: "Erreur lors de la récupération des clients",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
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

    const client = await prisma.client.create({
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

    return NextResponse.json(
      {
        success: true,
        message: "Client créé avec succès",
        client,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("ERREUR CREATE CLIENT :", error);

    return NextResponse.json(
      {
        success: false,
        message: "Erreur lors de la création du client",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}