import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type LigneAvoirInput = {
  ordre?: number;
  description?: string;
  quantite?: number | string;
  prixUnitaireHt?: number | string;
  tauxTva?: number | string;
};

function toNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatNumeroAvoir(annee: number, numero: number): string {
  return `AV-${annee}-${String(numero).padStart(4, "0")}`;
}

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const { id } = await context.params;

    const body = await request.json();

    const motifAvoir =
      typeof body?.motifAvoir === "string"
        ? body.motifAvoir.trim()
        : "";

    const lignesInput = Array.isArray(body?.lignes)
      ? (body.lignes as LigneAvoirInput[])
      : null;

    if (!motifAvoir) {
      return NextResponse.json(
        {
          success: false,
          message: "Le motif de l'avoir est obligatoire.",
        },
        { status: 400 }
      );
    }

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
          message: "Facture introuvable.",
        },
        { status: 404 }
      );
    }

    if (facture.typeDocument !== "facture") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Un avoir ne peut être créé qu'à partir d'une facture.",
        },
        { status: 400 }
      );
    }

    if (
      facture.statut !== "emise" &&
      facture.statut !== "payee"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Un avoir peut uniquement être créé à partir d'une facture émise ou payée.",
        },
        { status: 400 }
      );
    }

    if (!lignesInput || lignesInput.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "L'avoir doit contenir au moins une ligne.",
        },
        { status: 400 }
      );
    }

    const lignesPreparees = lignesInput.map((ligne, index) => {
      const description =
        typeof ligne.description === "string"
          ? ligne.description.trim()
          : "";

      const quantite = Math.abs(
        toNumber(ligne.quantite)
      );

      const prixUnitaireHt = Math.abs(
        toNumber(ligne.prixUnitaireHt)
      );

      const tauxTva = Math.max(
        0,
        toNumber(ligne.tauxTva)
      );

      if (!description) {
        throw new Error(
          `La désignation de la ligne ${index + 1} est obligatoire.`
        );
      }

      if (quantite <= 0) {
        throw new Error(
          `La quantité de la ligne ${index + 1} doit être supérieure à 0.`
        );
      }

      if (prixUnitaireHt < 0) {
        throw new Error(
          `Le prix unitaire de la ligne ${index + 1} est invalide.`
        );
      }

      const montantHt = round2(
        quantite * prixUnitaireHt
      );

      const montantTva = round2(
        montantHt * (tauxTva / 100)
      );

      const montantTtc = round2(
        montantHt + montantTva
      );

      return {
        ordre:
          typeof ligne.ordre === "number"
            ? ligne.ordre
            : index,
        description,
        quantite,
        prixUnitaireHt,
        tauxTva,
        montantHt,
        montantTva,
        montantTtc,
      };
    });

    const sousTotalHt = round2(
      lignesPreparees.reduce(
        (total, ligne) => total + ligne.montantHt,
        0
      )
    );

    const totalTva = round2(
      lignesPreparees.reduce(
        (total, ligne) => total + ligne.montantTva,
        0
      )
    );

    const totalTtc = round2(
      lignesPreparees.reduce(
        (total, ligne) => total + ligne.montantTtc,
        0
      )
    );

    if (totalTtc <= 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Le montant total de l'avoir doit être supérieur à 0.",
        },
        { status: 400 }
      );
    }

    const now = new Date();
    const annee = now.getFullYear();

    const avoir = await prisma.$transaction(
      async (tx) => {
        const compteur = await tx.compteurAvoir.upsert({
          where: {
            annee,
          },
          create: {
            annee,
            dernierNumero: 1,
            prefixe: "AV",
          },
          update: {
            dernierNumero: {
              increment: 1,
            },
          },
        });

        const numero = formatNumeroAvoir(
          annee,
          compteur.dernierNumero
        );

        const clientSnapshot = {
          id: facture.client.id,
          typeClient: facture.client.typeClient,
          nomRaisonSociale:
            facture.client.nomRaisonSociale,
          ice: facture.client.ice,
          ifFiscal: facture.client.ifFiscal,
          rc: facture.client.rc,
          adresse: facture.client.adresse,
          ville: facture.client.ville,
          telephone: facture.client.telephone,
          email: facture.client.email,
        };

        const entreprise = await tx.entreprise.findFirst();

        const entrepriseSnapshot = entreprise
          ? {
              id: entreprise.id,
              raisonSociale:
                entreprise.raisonSociale,
              formeJuridique:
                entreprise.formeJuridique,
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
              capitalSocial:
                entreprise.capitalSocial?.toString() ??
                null,
              logoUrl: entreprise.logoUrl,
            }
          : {};

        const createdAvoir =
          await tx.facture.create({
            data: {
              typeDocument: "avoir",
              numero,
              statut: "brouillon",

              factureReferenceId: facture.id,
              motifAvoir,

              clientId: facture.clientId,

              clientSnapshot,
              entrepriseSnapshot,

              dateEmission: null,
              dateEcheance:
                facture.dateEcheance,
              modePaiement:
                facture.modePaiement,

              sousTotalHt:
                new Prisma.Decimal(-sousTotalHt),

              totalTva:
                new Prisma.Decimal(-totalTva),

              totalTtc:
                new Prisma.Decimal(-totalTtc),

              montantEnLettres: null,

              createdBy: facture.createdBy,
              emiseAt: null,

              lignes: {
                create: lignesPreparees.map(
                  (ligne) => ({
                    ordre: ligne.ordre,

                    description:
                      ligne.description,

                    /*
                     * Pour un avoir, les montants
                     * enregistrés sont négatifs.
                     *
                     * La quantité reste négative afin
                     * de conserver la logique comptable
                     * déjà utilisée par l'application.
                     */
                    quantite:
                      new Prisma.Decimal(
                        -ligne.quantite
                      ),

                    prixUnitaireHt:
                      new Prisma.Decimal(
                        ligne.prixUnitaireHt
                      ),

                    tauxTva:
                      new Prisma.Decimal(
                        ligne.tauxTva
                      ),

                    montantHt:
                      new Prisma.Decimal(
                        -ligne.montantHt
                      ),

                    montantTva:
                      new Prisma.Decimal(
                        -ligne.montantTva
                      ),

                    montantTtc:
                      new Prisma.Decimal(
                        -ligne.montantTtc
                      ),
                  })
                ),
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

        return createdAvoir;
      }
    );

    return NextResponse.json(
      {
        success: true,
        message: "Avoir créé avec succès.",
        avoir,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Erreur création avoir :",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Erreur lors de la création de l'avoir.",
      },
      { status: 500 }
    );
  }
}