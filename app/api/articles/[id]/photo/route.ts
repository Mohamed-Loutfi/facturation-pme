import { erreurArticle } from "@/lib/articles";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const article = await prisma.article.findUnique({
      where: { id },
      select: { photo: true, photoType: true },
    });
    if (!article?.photo || !article.photoType) {
      return new Response(null, { status: 404 });
    }
    return new Response(new Uint8Array(article.photo), {
      headers: {
        "Content-Type": article.photoType,
        "Cache-Control": "private, no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return erreurArticle(error);
  }
}
