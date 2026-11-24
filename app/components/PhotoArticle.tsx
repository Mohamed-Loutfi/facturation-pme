import Image from "next/image";

export default function PhotoArticle({ article }: {
  article: { id: string; photoType: string | null; updatedAt: string };
}) {
  if (!article.photoType) return null;

  return (
    <Image
      key={article.updatedAt}
      src={`/api/articles/${article.id}/photo?v=${encodeURIComponent(article.updatedAt)}`}
      alt=""
      width={48}
      height={48}
      unoptimized
      className="size-12 shrink-0 rounded-md bg-slate-100 object-cover"
    />
  );
}
