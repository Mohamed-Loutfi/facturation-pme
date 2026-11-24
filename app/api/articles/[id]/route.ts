import { erreurArticle, lireArticle, sansDonneesPhoto } from "@/lib/articles";
import { prisma } from "@/lib/prisma";

type Contexte = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Contexte) {
  const { id } = await params;
  try {
    const resultat = await lireArticle(request);
    if ("erreur" in resultat) return Response.json(resultat, { status: 400 });
    return Response.json(await prisma.article.update({ where: { id }, data: resultat.data, omit: sansDonneesPhoto }));
  } catch (error) {
    return erreurArticle(error);
  }
}

export async function PATCH(request: Request, { params }: Contexte) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (typeof body?.actif !== "boolean") {
    return Response.json({ erreur: "Le statut actif doit être un booléen." }, { status: 400 });
  }
  try {
    return Response.json(await prisma.article.update({
      where: { id },
      data: { actif: body.actif },
      omit: sansDonneesPhoto,
    }));
  } catch (error) {
    return erreurArticle(error);
  }
}

export async function DELETE(_request: Request, { params }: Contexte) {
  const { id } = await params;
  try {
    const article = await prisma.article.delete({ where: { id }, select: { id: true } });
    return Response.json(article);
  } catch (error) {
    return erreurArticle(error);
  }
}
