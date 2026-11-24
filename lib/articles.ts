import { Prisma } from "@prisma/client";

export const unitesArticle = ["pièce", "m²", "ml", "forfait"];
export const sansDonneesPhoto = { photo: true } as const;

function typePhoto(photo: Uint8Array) {
  const commencePar = (signature: number[]) => signature.every((octet, index) => photo[index] === octet);
  if (commencePar([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (commencePar([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (commencePar([0x52, 0x49, 0x46, 0x46]) && String.fromCharCode(...photo.subarray(8, 12)) === "WEBP") {
    return "image/webp";
  }
  return null;
}

function decimal(valeur: unknown, chiffres: number) {
  const texte = typeof valeur === "number" || typeof valeur === "string" ? String(valeur).trim() : "";
  if (!new RegExp(`^\\d{1,${chiffres}}(?:[.,]\\d{1,2})?$`).test(texte)) return null;
  return texte.replace(",", ".");
}

export async function lireArticle(request: Request): Promise<{ data: Prisma.ArticleUncheckedCreateInput } | { erreur: string }> {
  const multipart = request.headers.get("content-type")?.startsWith("multipart/form-data");
  const formulaire = multipart ? await request.formData().catch(() => null) : null;
  const contenu: unknown = multipart ? formulaire && Object.fromEntries(formulaire) : await request.json().catch(() => null);
  const donneesInvalides = { erreur: "Vérifiez les champs de l’article." };
  if (!contenu || typeof contenu !== "object") return donneesInvalides;
  const body = contenu as Record<string, unknown>;
  const reference = typeof body.reference === "string" ? body.reference.trim() : "";
  const designation = typeof body.designation === "string" ? body.designation.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() || null : null;
  const prixUnitaireHt = decimal(body.prixUnitaireHt, 12);
  const tauxTva = decimal(body.tauxTva ?? 20, 2);
  const unite = body.unite;
  if (!reference || !designation || typeof unite !== "string" || !unitesArticle.includes(unite) || prixUnitaireHt === null || tauxTva === null) {
    return donneesInvalides;
  }
  const data = { reference, designation, description, unite, prixUnitaireHt, tauxTva };
  const fichier = formulaire?.get("photo");
  if (fichier instanceof File && fichier.name) {
    if (fichier.size > 5 * 1024 * 1024) return { erreur: "La photo doit faire au maximum 5 Mo." };
    const photo = new Uint8Array(await fichier.arrayBuffer());
    const photoType = typePhoto(photo);
    if (!photoType) return { erreur: "Choisissez une image JPEG, PNG ou WebP." };
    return { data: { ...data, photo, photoType } };
  }
  if (formulaire?.get("retirerPhoto") === "1") {
    return { data: { ...data, photo: null, photoType: null } };
  }
  return { data };
}

export function erreurArticle(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return Response.json({ erreur: "Cette référence est déjà utilisée." }, { status: 409 });
    if (error.code === "P2025" || error.code === "P2023") return Response.json({ erreur: "Article introuvable." }, { status: 404 });
  }
  console.error(error);
  return Response.json({ erreur: "Le catalogue est indisponible." }, { status: 500 });
}
