import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const entreprise = await prisma.entreprise.findFirst();

    return NextResponse.json({
      success: true,
      entreprise,
    });
  } catch (error) {
    console.error("ERREUR GET ENTREPRISE :", error);

    return NextResponse.json(
      {
        success: false,
        message: "Erreur lors de la récupération de l'entreprise",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      raisonSociale,
      formeJuridique,
      ice,
      ifFiscal,
      rc,
      rcVille,
      tp,
      cnss,
      adresse,
      ville,
      telephone,
      email,
      capitalSocial,
      logoUrl,
    } = body;

    if (!raisonSociale || !ice || !ifFiscal || !rc || !adresse || !ville) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Raison sociale, ICE, IF, RC, adresse et ville sont obligatoires.",
        },
        { status: 400 }
      );
    }

    const existante = await prisma.entreprise.findFirst();

    if (existante) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Une entreprise existe déjà. Utilisez la modification.",
        },
        { status: 409 }
      );
    }

    const entreprise = await prisma.entreprise.create({
      data: {
        raisonSociale,
        formeJuridique: formeJuridique || null,
        ice,
        ifFiscal,
        rc,
        rcVille: rcVille || null,
        tp: tp || null,
        cnss: cnss || null,
        adresse,
        ville,
        telephone: telephone || null,
        email: email || null,
        capitalSocial: capitalSocial || null,
        logoUrl: logoUrl || null,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Entreprise créée avec succès",
        entreprise,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("ERREUR CREATE ENTREPRISE :", error);

    return NextResponse.json(
      {
        success: false,
        message: "Erreur lors de la création de l'entreprise",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
export async function PUT(request: Request) {
  try {
    const body = await request.json();

    const {
      raisonSociale,
      formeJuridique,
      ice,
      ifFiscal,
      rc,
      rcVille,
      tp,
      cnss,
      adresse,
      ville,
      telephone,
      email,
      capitalSocial,
      logoUrl,
    } = body;

    if (!raisonSociale || !ice || !ifFiscal || !rc || !adresse || !ville) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Raison sociale, ICE, IF, RC, adresse et ville sont obligatoires.",
        },
        { status: 400 }
      );
    }

    const existante = await prisma.entreprise.findFirst();

    if (!existante) {
      return NextResponse.json(
        {
          success: false,
          message: "Aucune entreprise n'existe encore.",
        },
        { status: 404 }
      );
    }

    const entreprise = await prisma.entreprise.update({
      where: {
        id: existante.id,
      },
      data: {
        raisonSociale,
        formeJuridique: formeJuridique || null,
        ice,
        ifFiscal,
        rc,
        rcVille: rcVille || null,
        tp: tp || null,
        cnss: cnss || null,
        adresse,
        ville,
        telephone: telephone || null,
        email: email || null,
        capitalSocial: capitalSocial || null,
        logoUrl: logoUrl || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Entreprise modifiée avec succès",
      entreprise,
    });
  } catch (error) {
    console.error("ERREUR UPDATE ENTREPRISE :", error);

    return NextResponse.json(
      {
        success: false,
        message: "Erreur lors de la modification de l'entreprise",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}