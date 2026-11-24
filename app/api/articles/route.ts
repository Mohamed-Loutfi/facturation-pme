import { erreurArticle, lireArticle, sansDonneesPhoto } from "@/lib/articles";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const recherche = params.get("q")?.trim();
  try {
    const articles = await prisma.article.findMany({
      where: {
        actif: params.get("actif") === "1" ? true : undefined,
        OR: recherche ? [
          { reference: { contains: recherche, mode: "insensitive" } },
          { designation: { contains: recherche, mode: "insensitive" } },
        ] : undefined,
      },
      orderBy: [{ designation: "asc" }, { reference: "asc" }],
      omit: sansDonneesPhoto,
    });
    return Response.json(articles);
  } catch (error) {
    return erreurArticle(error);
  }
}

export async function POST(request: Request) {
  try {
    const resultat = await lireArticle(request);
    if ("erreur" in resultat) return Response.json(resultat, { status: 400 });
    return Response.json(await prisma.article.create({ data: resultat.data, omit: sansDonneesPhoto }), { status: 201 });
  } catch (error) {
    return erreurArticle(error);
  }
}
