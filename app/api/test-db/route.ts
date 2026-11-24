import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const clients = await prisma.client.findMany({
      take: 5,
    });

    return NextResponse.json({
      success: true,
      message: "Connexion PostgreSQL + Prisma OK",
      clients,
    });
  } catch (error) {
    console.error("ERREUR PRISMA :", error);

    return NextResponse.json(
      {
        success: false,
        message: "Erreur de connexion à la base de données",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}