import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// =====================================================
// GET : récupérer une facture
// =====================================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const facture = await prisma.facture.findUnique({
      where: {
        id,
      },
      include: {
        client: true,
        lignes: {
          orderBy: {
            ordre: "asc",
          },
        },
      },
    });

    if (!facture) {
      return NextResponse.json(
        {
          success: false,
          message: "Facture introuvable",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      facture,
    });
  } catch (error) {
    console.error("ERREUR GET FACTURE :", error);

    return NextResponse.json(
      {
        success: false,
        message: "Erreur lors de la récupération de la facture",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// =====================================================
// PUT : modifier une facture brouillon
// =====================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const {
      clientId,
      dateEmission,
      dateEcheance,
      modePaiement,
      lignes,
    } = body;

    // -----------------------------------------------
    // Vérifier la facture
    // -----------------------------------------------

    const factureExistante = await prisma.facture.findUnique({
      where: {
        id,
      },
      include: {
        client: true,
        lignes: true,
      },
    });

    if (!factureExistante) {
      return NextResponse.json(
        {
          success: false,
          message: "Facture introuvable",
        },
        { status: 404 }
      );
    }

    // -----------------------------------------------
    // Une facture émise/payée/annulée ne doit pas
    // être modifiée avec cette route
    // -----------------------------------------------

    if (factureExistante.statut !== "brouillon") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Seules les factures brouillon peuvent être modifiées",
        },
        { status: 400 }
      );
    }

    // -----------------------------------------------
    // Validation
    // -----------------------------------------------

    if (!clientId) {
      return NextResponse.json(
        {
          success: false,
          message: "Le client est obligatoire",
        },
        { status: 400 }
      );
    }

    if (!Array.isArray(lignes) || lignes.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "La facture doit contenir au moins une ligne",
        },
        { status: 400 }
      );
    }

    // -----------------------------------------------
    // Client
    // -----------------------------------------------

    const client = await prisma.client.findUnique({
      where: {
        id: clientId,
      },
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

    // -----------------------------------------------
    // Entreprise
    // -----------------------------------------------

    const entreprise = await prisma.entreprise.findFirst();

    if (!entreprise) {
      return NextResponse.json(
        {
          success: false,
          message: "Aucune entreprise configurée",
        },
        { status: 400 }
      );
    }

    // -----------------------------------------------
    // Snapshots
    // -----------------------------------------------

    const clientSnapshot = {
      id: client.id,
      typeClient: client.typeClient,
      nomRaisonSociale: client.nomRaisonSociale,
      ice: client.ice,
      ifFiscal: client.ifFiscal,
      rc: client.rc,
      adresse: client.adresse,
      ville: client.ville,
      telephone: client.telephone,
      email: client.email,
    };

    const entrepriseSnapshot = {
      id: entreprise.id,
      raisonSociale: entreprise.raisonSociale,
      formeJuridique: entreprise.formeJuridique,
      ice: entreprise.ice,
      ifFiscal: entreprise.ifFiscal,
      rc: entreprise.rc,
      rcVille: entreprise.rcVille,
      tp: entreprise.tp,
      cnss: entreprise.cnss,
      adresse: entreprise.adresse,
      ville: entreprise.ville,
      telephone: entreprise.telephone,
      email: entreprise.email,
      capitalSocial: entreprise.capitalSocial
        ? entreprise.capitalSocial.toString()
        : null,
      logoUrl: entreprise.logoUrl,
    };

    // -----------------------------------------------
    // Calcul des lignes
    // -----------------------------------------------

    let sousTotalHt = new Prisma.Decimal(0);
    let totalTva = new Prisma.Decimal(0);
    let totalTtc = new Prisma.Decimal(0);

    const lignesPreparees = lignes.map(
      (
        ligne: {
          description?: string;
          quantite?: number | string;
          prixUnitaireHt?: number | string;
          tauxTva?: number | string;
        },
        index: number
      ) => {
        if (!ligne.description?.trim()) {
          throw new Error(
            `La description est obligatoire pour la ligne ${
              index + 1
            }`
          );
        }

        const quantite = new Prisma.Decimal(
          ligne.quantite ?? 1
        );

        const prixUnitaireHt = new Prisma.Decimal(
          ligne.prixUnitaireHt ?? 0
        );

        const tauxTva = new Prisma.Decimal(
          ligne.tauxTva ?? 20
        );

        if (quantite.lessThan(0)) {
          throw new Error(
            `La quantité de la ligne ${index + 1} est invalide`
          );
        }

        if (prixUnitaireHt.lessThan(0)) {
          throw new Error(
            `Le prix de la ligne ${index + 1} est invalide`
          );
        }

        if (
          tauxTva.lessThan(0) ||
          tauxTva.greaterThan(100)
        ) {
          throw new Error(
            `Le taux TVA de la ligne ${index + 1} est invalide`
          );
        }

        const montantHt = quantite
          .mul(prixUnitaireHt)
          .toDecimalPlaces(2);

        const montantTva = montantHt
          .mul(tauxTva)
          .div(100)
          .toDecimalPlaces(2);

        const montantTtc = montantHt
          .add(montantTva)
          .toDecimalPlaces(2);

        sousTotalHt = sousTotalHt.add(montantHt);
        totalTva = totalTva.add(montantTva);
        totalTtc = totalTtc.add(montantTtc);

        return {
          ordre: index + 1,
          description: ligne.description.trim(),
          quantite,
          prixUnitaireHt,
          tauxTva,
          montantHt,
          montantTva,
          montantTtc,
        };
      }
    );

    // -----------------------------------------------
    // Mise à jour transactionnelle
    // -----------------------------------------------

    const facture = await prisma.$transaction(async (tx) => {
      // Supprimer les anciennes lignes
      await tx.ligneFacture.deleteMany({
        where: {
          factureId: id,
        },
      });

      // Mettre à jour la facture
      return tx.facture.update({
        where: {
          id,
        },
        data: {
          clientId: client.id,

          clientSnapshot,
          entrepriseSnapshot,

          dateEmission: dateEmission
            ? new Date(dateEmission)
            : null,

          dateEcheance: dateEcheance
            ? new Date(dateEcheance)
            : null,

          modePaiement: modePaiement || null,

          sousTotalHt: sousTotalHt.toDecimalPlaces(2),
          totalTva: totalTva.toDecimalPlaces(2),
          totalTtc: totalTtc.toDecimalPlaces(2),

          lignes: {
            create: lignesPreparees,
          },
        },
        include: {
          client: true,
          lignes: {
            orderBy: {
              ordre: "asc",
            },
          },
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Facture modifiée avec succès",
      facture,
    });
  } catch (error) {
    console.error("ERREUR PUT FACTURE :", error);

    return NextResponse.json(
      {
        success: false,
        message: "Erreur lors de la modification de la facture",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// =====================================================
// DELETE : supprimer une facture brouillon
// =====================================================

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const facture = await prisma.facture.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        numero: true,
        statut: true,
      },
    });

    if (!facture) {
      return NextResponse.json(
        {
          success: false,
          message: "Facture introuvable",
        },
        { status: 404 }
      );
    }

    /*if (facture.statut !== "brouillon") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Seules les factures brouillon peuvent être supprimées",
        },
        { status: 400 }
      );
    }*/

    await prisma.facture.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Facture ${facture.numero} supprimée avec succès`,
    });
  } catch (error) {
    console.error("ERREUR DELETE FACTURE :", error);

    return NextResponse.json(
      {
        success: false,
        message: "Erreur lors de la suppression de la facture",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}