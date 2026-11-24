import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ValidationError, verifierArticleLigne } from "@/lib/devis";

// GET : récupérer toutes les factures
export async function GET() {
  try {
    const factures = await prisma.facture.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: {
        client: true,
        lignes: true,
      },
    });

    return NextResponse.json({
      success: true,
      factures,
    });
  } catch (error) {
    console.error("ERREUR GET FACTURES :", error);

    return NextResponse.json(
      {
        success: false,
        message: "Erreur lors de la récupération des factures",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// POST : créer une facture
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      clientId,
      dateEmission,
      dateEcheance,
      modePaiement,
      lignes,
    } = body;

    // =========================
    // 1. VALIDATIONS
    // =========================

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
          message: "La facture doit contenir au moins une ligne",
        },
        { status: 400 }
      );
    }

    // =========================
    // 2. RÉCUPÉRER LE CLIENT
    // =========================

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

    // =========================
    // 3. RÉCUPÉRER L'ENTREPRISE
    // =========================

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

    // =========================
    // 4. CALCULER L'ANNÉE
    // =========================

    const annee = dateEmission
      ? new Date(dateEmission).getFullYear()
      : new Date().getFullYear();

    // =========================
    // 5. TRANSACTION
    // =========================

    const facture = await prisma.$transaction(async (tx) => {
      // -------------------------
      // Compteur facture
      // -------------------------

      const compteur = await tx.compteurFacture.upsert({
        where: {
          annee,
        },
        update: {
          dernierNumero: {
            increment: 1,
          },
        },
        create: {
          annee,
          dernierNumero: 1,
          prefixe: "FACT",
        },
      });

      // -------------------------
      // Numéro facture
      // -------------------------

      const numero = `${compteur.prefixe}-${annee}-${String(
        compteur.dernierNumero
      ).padStart(4, "0")}`;

      // -------------------------
      // Snapshot client
      // -------------------------

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

      // -------------------------
      // Snapshot entreprise
      // -------------------------

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

      // -------------------------
      // Calcul des lignes
      // -------------------------

      let sousTotalHt = new Prisma.Decimal(0);
      let totalTva = new Prisma.Decimal(0);
      let totalTtc = new Prisma.Decimal(0);

      const articles = new Set<string>();
      const lignesPreparees = lignes.map(
        (
          ligne: {
            articleId?: unknown;
            description?: string;
            quantite?: number | string;
            prixUnitaireHt?: number | string;
            tauxTva?: number | string;
          },
          index: number
        ) => {
          if (!ligne.description) {
            throw new Error(
              `La description est obligatoire pour la ligne ${index + 1}`
            );
          }

          const quantite = new Prisma.Decimal(ligne.quantite ?? 1);
          const prixUnitaireHt = new Prisma.Decimal(
            ligne.prixUnitaireHt ?? 0
          );
          const tauxTva = new Prisma.Decimal(ligne.tauxTva ?? 20);

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
            articleId: verifierArticleLigne(ligne.articleId, articles),
            description: ligne.description,
            quantite,
            prixUnitaireHt,
            tauxTva,
            montantHt,
            montantTva,
            montantTtc,
          };
        }
      );

      // -------------------------
      // Création facture
      // -------------------------

      return tx.facture.create({
        data: {
          typeDocument: "facture",
          numero,
          statut: "brouillon",

          clientId: client.id,

          clientSnapshot,
          entrepriseSnapshot,

          dateEmission: dateEmission
            ? new Date(dateEmission)
            : new Date(),

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
          lignes: true,
        },
      });
    });

    // =========================
    // 6. RÉPONSE
    // =========================

    return NextResponse.json(
      {
        success: true,
        message: "Facture créée avec succès",
        facture,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }
    console.error("ERREUR POST FACTURE :", error);

    return NextResponse.json(
      {
        success: false,
        message: "Erreur lors de la création de la facture",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
