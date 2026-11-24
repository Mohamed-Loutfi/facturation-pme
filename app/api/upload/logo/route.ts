import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";

const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("logo");
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, message: "Aucun fichier reçu." }, { status: 400 });
    }
    if (file.size === 0 || file.size > MAX_BYTES) {
      return NextResponse.json({ success: false, message: "Le logo doit faire entre 1 octet et 2 Mo." }, { status: 400 });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const png = bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((b, i) => bytes[i] === b);
    const jpg = bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    if (!png && !jpg) {
      return NextResponse.json({ success: false, message: "Format invalide : PNG ou JPEG uniquement." }, { status: 400 });
    }
    const directory = path.join(process.cwd(), "public", "uploads", "logos");
    await mkdir(directory, { recursive: true });
    const filename = `${randomUUID()}.${png ? "png" : "jpg"}`;
    await writeFile(path.join(directory, filename), bytes, { flag: "wx" });
    return NextResponse.json({ success: true, logoUrl: `/uploads/logos/${filename}` });
  } catch (error) {
    console.error("Erreur upload logo :", error);
    return NextResponse.json({ success: false, message: "Impossible d'enregistrer le logo." }, { status: 500 });
  }
}
