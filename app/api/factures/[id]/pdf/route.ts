import { NextResponse } from "next/server";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "fs/promises";
import path from "path";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/* -------------------------------------------------------------------------- */
/*  Constantes de mise en page                                                */
/* -------------------------------------------------------------------------- */

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 42;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BOTTOM_LIMIT = 66; // zone réservée au pied de page

const COLORS = {
  dark: rgb(0.1, 0.13, 0.18),
  gray: rgb(0.38, 0.42, 0.48),
  mutedGray: rgb(0.55, 0.59, 0.64),
  lightGray: rgb(0.955, 0.96, 0.97),
  zebra: rgb(0.978, 0.982, 0.988),
  border: rgb(0.85, 0.87, 0.9),
  accent: rgb(0.27, 0.48, 0.7),
  accentLight: rgb(0.55, 0.7, 0.85),
  white: rgb(1, 1, 1),
  red: rgb(0.7, 0.1, 0.1),
  redSoft: rgb(0.99, 0.94, 0.94),
  green: rgb(0.1, 0.5, 0.3),
};

type Line = {
  ordre: number;
  description: string;
  quantite: unknown;
  prixUnitaireHt: unknown;
  tauxTva: unknown;
  montantHt: unknown;
  montantTva: unknown;
  montantTtc: unknown;
};

type Entreprise = {
  raisonSociale: string;
  formeJuridique?: string | null;
  ice?: string | null;
  ifFiscal?: string | null;
  rc?: string | null;
  rcVille?: string | null;
  tp?: string | null;
  cnss?: string | null;
  adresse?: string | null;
  ville?: string | null;
  telephone?: string | null;
  email?: string | null;
  logoUrl?: string | null;
};

/* -------------------------------------------------------------------------- */
/*  Utilitaires                                                               */
/* -------------------------------------------------------------------------- */

function toNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

// Les espaces insécables produits par Intl (U+202F / U+00A0) sont remplacés
// par un espace classique pour éviter tout glyphe manquant dans la police.
function normalizeSpaces(value: string): string {
  return value.replace(/[\u202f\u00a0]/g, " ");
}

function formatAmount(value: unknown): string {
  return normalizeSpaces(
    new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(toNumber(value))
  );
}

function formatMoney(value: unknown): string {
  return `${formatAmount(value)} MAD`;
}

function formatNumber(value: unknown, digits = 2): string {
  return normalizeSpaces(
    new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits,
    }).format(toNumber(value))
  );
}

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function addDays(value: string | Date, days: number): Date {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function clean(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\uFFFD/g, "").trim();
}

function statusStyle(statut: string) {
  const s = statut
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (/(annule|impaye|retard|refuse)/.test(s)) return { bg: COLORS.red, fg: COLORS.white };
  if (/(paye|regle|solde|accepte|converti)/.test(s)) return { bg: COLORS.green, fg: COLORS.white };
  if (/(brouillon)/.test(s)) return { bg: COLORS.mutedGray, fg: COLORS.white };
  return { bg: COLORS.accent, fg: COLORS.white };
}

async function loadLogo(pdfDoc: PDFDocument, logoUrl?: string | null) {
  const value = clean(logoUrl);
  if (!value) return null;

  try {
    let bytes: Uint8Array;
    let extension = "";

    if (value.startsWith("data:image/")) {
      const match = value.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i);
      if (!match) return null;
      extension = match[1].toLowerCase();
      bytes = new Uint8Array(Buffer.from(match[2], "base64"));
    } else if (/^https?:\/\//i.test(value)) {
      const response = await fetch(value, { cache: "no-store" });
      if (!response.ok) return null;
      const contentType = response.headers.get("content-type") || "";
      bytes = new Uint8Array(await response.arrayBuffer());
      extension = contentType.includes("png") ? "png" : "jpg";
    } else {
      const relative = value.startsWith("/") ? value.slice(1) : value;
      const filePath = path.join(process.cwd(), "public", relative);
      bytes = await readFile(filePath);
      extension = path.extname(filePath).toLowerCase().replace(".", "");
    }

    if (extension === "png") return await pdfDoc.embedPng(bytes);
    if (extension === "jpg" || extension === "jpeg") return await pdfDoc.embedJpg(bytes);
    return null;
  } catch (error) {
    console.warn("LOGO PDF NON CHARGÉ :", error);
    return null;
  }
}

function wrapText(text: string, maxWidth: number, font: PDFFont, size: number): string[] {
  const normalized = clean(text).replace(/\s+/g, " ");
  if (!normalized) return [""];

  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) lines.push(current);

    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      current = word;
      continue;
    }

    let partial = "";
    for (const char of word) {
      const candidateChar = partial + char;
      if (font.widthOfTextAtSize(candidateChar, size) <= maxWidth) {
        partial = candidateChar;
      } else {
        if (partial) lines.push(partial);
        partial = char;
      }
    }
    current = partial;
  }

  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

// Réduit la taille de police jusqu'à ce que le texte tienne dans la largeur.
function fitSize(font: PDFFont, text: string, size: number, maxWidth: number, min = 5.5) {
  let s = size;
  while (s > min && font.widthOfTextAtSize(text, s) > maxWidth) s -= 0.25;
  return s;
}

/* -------------------------------------------------------------------------- */
/*  Montant en lettres (français, dirhams)                                    */
/* -------------------------------------------------------------------------- */

const UNITES = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
  "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
  "dix-sept", "dix-huit", "dix-neuf",
];
const DIZAINES = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"];

// 0 à 99. `final` : "quatre-vingts" prend un « s » seulement s'il termine le groupe.
function sousCent(n: number, final: boolean): string {
  if (n < 20) return UNITES[n];

  const d = Math.floor(n / 10);
  const u = n % 10;

  if (d === 7) return u === 1 ? "soixante et onze" : `soixante-${UNITES[10 + u]}`;
  if (d === 9) return `quatre-vingt-${UNITES[10 + u]}`;
  if (d === 8) {
    if (u === 0) return final ? "quatre-vingts" : "quatre-vingt";
    return `quatre-vingt-${UNITES[u]}`;
  }

  if (u === 0) return DIZAINES[d];
  if (u === 1) return `${DIZAINES[d]} et un`;
  return `${DIZAINES[d]}-${UNITES[u]}`;
}

// 0 à 999. `final` : « cents » et « quatre-vingts » prennent un « s » en fin de groupe.
function sousMille(n: number, final: boolean): string {
  const h = Math.floor(n / 100);
  const r = n % 100;

  if (h === 0) return sousCent(r, final);

  const cent = h === 1 ? "cent" : `${UNITES[h]} cent${r === 0 && final ? "s" : ""}`;
  return r === 0 ? cent : `${cent} ${sousCent(r, final)}`;
}

function entierEnLettres(n: number): string {
  if (n === 0) return "zéro";

  const milliards = Math.floor(n / 1e9);
  const millions = Math.floor((n % 1e9) / 1e6);
  const milliers = Math.floor((n % 1e6) / 1e3);
  const reste = n % 1e3;

  const parts: string[] = [];

  if (milliards > 0) {
    parts.push(`${sousMille(milliards, true)} milliard${milliards > 1 ? "s" : ""}`);
  }
  if (millions > 0) {
    parts.push(`${sousMille(millions, true)} million${millions > 1 ? "s" : ""}`);
  }
  if (milliers > 0) {
    parts.push(milliers === 1 ? "mille" : `${sousMille(milliers, false)} mille`);
  }
  if (reste > 0) {
    parts.push(sousMille(reste, true));
  }

  return parts.join(" ");
}

// Ex. 1234.5 → « Mille deux cent trente-quatre dirhams et cinquante centimes ».
function montantEnLettres(value: number): string {
  const totalCentimes = Math.round(Math.abs(value) * 100);
  const dirhams = Math.floor(totalCentimes / 100);
  const centimes = totalCentimes % 100;

  const mots = entierEnLettres(dirhams);
  const de = dirhams >= 1e6 && dirhams % 1e6 === 0 ? " de" : "";
  const unite = dirhams > 1 ? "dirhams" : "dirham";

  let result = `${mots}${de} ${unite}`;

  if (centimes > 0) {
    result += ` et ${entierEnLettres(centimes)} centime${centimes > 1 ? "s" : ""}`;
  }

  return result.charAt(0).toUpperCase() + result.slice(1);
}

/* -------------------------------------------------------------------------- */
/*  Route                                                                     */
/* -------------------------------------------------------------------------- */

// GET /api/factures/:id/pdf                  → version interne (avec statut)
// GET /api/factures/:id/pdf?version=client   → version client (sans statut)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const isClientVersion =
      new URL(request.url).searchParams.get("version") === "client";

    const facture = await prisma.facture.findUnique({
      where: { id },
      include: {
        client: true,
        lignes: { orderBy: { ordre: "asc" } },
        factureReference: { select: { numero: true } },
        devisReference: { select: { numero: true } },
      },
    });

    if (!facture) {
      return NextResponse.json(
        { success: false, message: "Document introuvable." },
        { status: 404 }
      );
    }

    const entrepriseDb = await prisma.entreprise.findFirst({
      orderBy: { createdAt: "asc" },
    });

    const entreprise: Entreprise = entrepriseDb
      ? {
          raisonSociale: entrepriseDb.raisonSociale,
          formeJuridique: entrepriseDb.formeJuridique,
          ice: entrepriseDb.ice,
          ifFiscal: entrepriseDb.ifFiscal,
          rc: entrepriseDb.rc,
          rcVille: entrepriseDb.rcVille,
          tp: entrepriseDb.tp,
          cnss: entrepriseDb.cnss,
          adresse: entrepriseDb.adresse,
          ville: entrepriseDb.ville,
          telephone: entrepriseDb.telephone,
          email: entrepriseDb.email,
          logoUrl: entrepriseDb.logoUrl,
        }
      : { raisonSociale: "Entreprise" };

    const isAvoir = facture.typeDocument === "avoir";
    const isDevis = facture.typeDocument === "devis";
    const docTitle = isAvoir ? "AVOIR" : isDevis ? "DEVIS" : "FACTURE";
    const docLabel = isAvoir ? "Avoir" : isDevis ? "Devis" : "Facture";
    const docNumber = clean(facture.numero);

    // Date limite de validité d'un devis (30 jours par défaut).
    const validUntil = facture.dateValidite ?? addDays(facture.dateEmission ?? facture.createdAt, 30);

    // Phrase de validité affichée en bas du document.
    const validityNote = isAvoir
      ? null
      : isDevis
        ? `Ce devis est valable jusqu'au ${formatDate(validUntil)}.`
        : "Cette facture n'est valable que pour une durée de 30 jours à compter de sa date d'émission.";

    /* ------------------------------ Document PDF ------------------------------ */

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    pdfDoc.setTitle(`${docLabel} ${facture.numero}`);
    pdfDoc.setAuthor(entreprise.raisonSociale || "Application de facturation PME");
    pdfDoc.setSubject("Document commercial");
    pdfDoc.setCreator("Facturation PME");

    const regularFontBytes = await readFile(
      path.join(process.cwd(), "public", "fonts", "DejaVuSans.ttf")
    );
    const boldFontBytes = await readFile(
      path.join(process.cwd(), "public", "fonts", "DejaVuSans-Bold.ttf")
    );
    const regular = await pdfDoc.embedFont(regularFontBytes, { subset: false });
    const bold = await pdfDoc.embedFont(boldFontBytes, { subset: false });
    const logo = await loadLogo(pdfDoc, entreprise.logoUrl);

    const pages: PDFPage[] = [];
    const newPage = () => {
      const p = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      pages.push(p);
      return p;
    };

    /* ------------------------------ Helpers dessin ----------------------------- */

    type RGB = ReturnType<typeof rgb>;

    const text = (
      p: PDFPage,
      value: string,
      x: number,
      yy: number,
      size: number,
      font: PDFFont,
      color: RGB
    ) => p.drawText(value, { x, y: yy, size, font, color });

    const textRight = (
      p: PDFPage,
      value: string,
      xRight: number,
      yy: number,
      size: number,
      font: PDFFont,
      color: RGB
    ) => text(p, value, xRight - font.widthOfTextAtSize(value, size), yy, size, font, color);

    const textCenter = (
      p: PDFPage,
      value: string,
      yy: number,
      size: number,
      font: PDFFont,
      color: RGB
    ) =>
      text(
        p,
        value,
        (PAGE_WIDTH - font.widthOfTextAtSize(value, size)) / 2,
        yy,
        size,
        font,
        color
      );

    const drawTopBar = (p: PDFPage) => {
      p.drawRectangle({
        x: 0,
        y: PAGE_HEIGHT - 4,
        width: PAGE_WIDTH,
        height: 4,
        color: COLORS.accent,
      });
    };

    /* --------------------------------- En-têtes -------------------------------- */

    // En-tête complet (première page) : logo à gauche,
    // type/numéro/statut du document à droite.
    const drawFullHeader = (p: PDFPage) => {
      drawTopBar(p);

      const top = PAGE_HEIGHT - 44;
      const logoBoxW = 200; // largeur max du logo
      const logoBoxH = 90; // hauteur max du logo
      const right = PAGE_WIDTH - MARGIN;

      // Dimensions réelles du logo une fois mis à l'échelle
      let dw = 0;
      let dh = 0;
      if (logo) {
        const scale = Math.min(logoBoxW / logo.width, logoBoxH / logo.height);
        dw = logo.width * scale;
        dh = logo.height * scale;
      }

      // Le bloc de droite (titre, numéro, badge) a besoin d'au moins 66 pt
      const headerHeight = Math.max(dh, 66);

      if (logo) {
        p.drawImage(logo, {
          x: MARGIN,
          y: top + 8 - dh, // haut du logo aligné sur le haut du titre
          width: dw,
          height: dh,
        });
      } else {
        // Sans logo, on garde la raison sociale pour ne pas laisser la gauche vide.
        const nameText = clean(entreprise.raisonSociale) || "Entreprise";
        text(
          p,
          nameText,
          MARGIN,
          top - 32,
          fitSize(bold, nameText, 16, right - 190 - MARGIN, 8),
          bold,
          COLORS.dark
        );
      }

      // Informations propres au document, conservées à droite.
      textRight(p, docTitle, right, top - 4, 26, bold, COLORS.accent);
      textRight(p, `N° ${docNumber}`, right, top - 22, 11, bold, COLORS.dark);

      // Le statut n'apparaît pas dans la version client.
      const statut = clean(facture.statut).toUpperCase();
      if (statut && !isClientVersion) {
        const badgeSize = 7;
        const badgeW = bold.widthOfTextAtSize(statut, badgeSize) + 18;
        const badgeH = 15;
        const style = statusStyle(statut);
        const badgeY = top - 46;
        p.drawRectangle({
          x: right - badgeW,
          y: badgeY,
          width: badgeW,
          height: badgeH,
          borderColor: style.bg,
          borderWidth: 0.9,
        });
        text(p, statut, right - badgeW + 9, badgeY + 4.5, badgeSize, bold, style.bg);
      }

      p.drawLine({
        start: { x: MARGIN, y: top - headerHeight },
        end: { x: PAGE_WIDTH - MARGIN, y: top - headerHeight },
        thickness: 0.8,
        color: COLORS.border,
      });
      return top - headerHeight - 20;
    };

    // En-tête compact (pages suivantes).
    const drawCompactHeader = (p: PDFPage) => {
      drawTopBar(p);

      const baseline = PAGE_HEIGHT - 36;

      textRight(
        p,
        `${docTitle} N° ${docNumber}`,
        PAGE_WIDTH - MARGIN,
        baseline,
        10,
        bold,
        COLORS.accent
      );

      p.drawLine({
        start: { x: MARGIN, y: baseline - 9 },
        end: { x: PAGE_WIDTH - MARGIN, y: baseline - 9 },
        thickness: 0.8,
        color: COLORS.border,
      });

      return baseline - 30;
    };

    /* --------------------------------- Pied de page ---------------------------- */

    const drawFooter = (p: PDFPage, pageIndex: number, total: number) => {
      p.drawLine({
        start: { x: MARGIN, y: 52 },
        end: { x: PAGE_WIDTH - MARGIN, y: 52 },
        thickness: 0.7,
        color: COLORS.border,
      });

      const legalLine = [
        entreprise.ice ? `ICE : ${clean(entreprise.ice)}` : null,
        entreprise.ifFiscal ? `IF : ${clean(entreprise.ifFiscal)}` : null,
        entreprise.rc
          ? `RC : ${clean(entreprise.rc)}${entreprise.rcVille ? ` / ${clean(entreprise.rcVille)}` : ""}`
          : null,
        entreprise.tp ? `TP : ${clean(entreprise.tp)}` : null,
        entreprise.cnss ? `CNSS : ${clean(entreprise.cnss)}` : null,
      ]
        .filter(Boolean)
        .join("  •  ");

      // La raison sociale n'apparaît plus dans l'en-tête : on la place ici
      // pour que la dénomination légale figure toujours sur le document.
      const identityLine = [
        clean(entreprise.raisonSociale),
        clean(entreprise.formeJuridique),
        [entreprise.adresse, entreprise.ville].map(clean).filter(Boolean).join(", "),
      ]
        .filter(Boolean)
        .join("  •  ");

      if (legalLine) {
        textCenter(p, legalLine, 41, fitSize(bold, legalLine, 6.8, CONTENT_WIDTH), bold, COLORS.gray);
      }
      if (identityLine) {
        textCenter(
          p,
          identityLine,
          31,
          fitSize(regular, identityLine, 7.5, CONTENT_WIDTH),
          regular,
          COLORS.mutedGray
        );
      }
      textCenter(p, `Page ${pageIndex} / ${total}`, 20, 6.5, regular, COLORS.mutedGray);
    };

    /* ------------------------------ Gestion de flux ---------------------------- */

    let page = newPage();
    let y = drawFullHeader(page);

    const ensureSpace = (height: number) => {
      if (y - height < BOTTOM_LIMIT) {
        page = newPage();
        y = drawCompactHeader(page);
        return true;
      }
      return false;
    };

    /* ------------------------- Bandeau d'informations -------------------------- */

    const metaItems: { label: string; value: string; danger?: boolean }[] = [
      { label: "DATE D'ÉMISSION", value: formatDate(facture.dateEmission) },
      isDevis
        ? { label: "VALABLE JUSQU'AU", value: formatDate(validUntil) }
        : { label: "DATE D'ÉCHÉANCE", value: formatDate(facture.dateEcheance) },
      { label: "MODE DE PAIEMENT", value: clean(facture.modePaiement) || "-" },
    ];

    if (isAvoir) {
      const origin = facture.factureReference?.numero || facture.factureReferenceId || "-";
      metaItems.push({ label: "FACTURE D'ORIGINE", value: clean(origin), danger: true });
    }

    // Facture issue d'un devis : on rappelle le numéro du devis.
    if (!isAvoir && !isDevis && facture.devisReference?.numero) {
      metaItems.push({ label: "DEVIS D'ORIGINE", value: clean(facture.devisReference.numero) });
    }

    const stripHeight = 40;
    ensureSpace(stripHeight + 20);

    page.drawRectangle({
      x: MARGIN,
      y: y - stripHeight,
      width: CONTENT_WIDTH,
      height: stripHeight,
      color: COLORS.lightGray,
      borderColor: COLORS.border,
      borderWidth: 0.6,
    });

    const cellWidth = CONTENT_WIDTH / metaItems.length;
    metaItems.forEach((item, index) => {
      const cx = MARGIN + index * cellWidth;
      if (index > 0) {
        page.drawLine({
          start: { x: cx, y: y - 7 },
          end: { x: cx, y: y - stripHeight + 7 },
          thickness: 0.6,
          color: COLORS.border,
        });
      }
      text(page, item.label, cx + 12, y - 15, 6.5, bold, COLORS.mutedGray);
      const valueSize = fitSize(bold, item.value, 9.5, cellWidth - 24, 6.5);
      text(
        page,
        item.value,
        cx + 12,
        y - 30,
        valueSize,
        bold,
        item.danger ? COLORS.red : COLORS.dark
      );
    });

    y -= stripHeight + 16;

    /* ------------------------------ Bloc client -------------------------------- */

    const boxPadding = 14;
    const clientInnerWidth = CONTENT_WIDTH - boxPadding * 2 - 3;
    const clientLeftWidth = clientInnerWidth * 0.55;
    const clientRightWidth = clientInnerWidth - clientLeftWidth - 14;

    const clientName = clean(facture.client.nomRaisonSociale) || "-";
    const clientNameLines = wrapText(clientName, clientLeftWidth, bold, 11);
    const clientAddressLines = [
      clean(facture.client.adresse),
      clean(facture.client.ville),
    ]
      .filter(Boolean)
      .flatMap((l) => wrapText(l, clientLeftWidth, regular, 8));

    const clientRightRaw = [
      facture.client.ice ? `ICE : ${clean(facture.client.ice)}` : null,
      facture.client.ifFiscal ? `IF : ${clean(facture.client.ifFiscal)}` : null,
      facture.client.rc ? `RC : ${clean(facture.client.rc)}` : null,
      facture.client.telephone ? `Tél. : ${clean(facture.client.telephone)}` : null,
      facture.client.email ? clean(facture.client.email) : null,
    ].filter(Boolean) as string[];
    const clientRightLines = clientRightRaw.flatMap((l) =>
      wrapText(l, clientRightWidth, regular, 7.8)
    );

    const leftContentHeight =
      clientNameLines.length * 14 +
      (clientAddressLines.length ? 4 : 0) +
      clientAddressLines.length * 11;
    const rightContentHeight = clientRightLines.length * 11;
    const clientHeight =
      boxPadding + 14 + Math.max(leftContentHeight, rightContentHeight, 24) + boxPadding - 2;

    ensureSpace(clientHeight + 20);

    page.drawRectangle({
      x: MARGIN,
      y: y - clientHeight,
      width: CONTENT_WIDTH,
      height: clientHeight,
      borderColor: COLORS.border,
      borderWidth: 0.6,
    });
    page.drawRectangle({
      x: MARGIN,
      y: y - clientHeight,
      width: 3,
      height: clientHeight,
      color: COLORS.accent,
    });

    const clientX = MARGIN + 3 + boxPadding;
    text(
      page,
      isDevis ? "DESTINATAIRE" : "FACTURÉ À",
      clientX,
      y - boxPadding - 4,
      7,
      bold,
      COLORS.accent
    );

    let leftY = y - boxPadding - 20;
    for (const line of clientNameLines) {
      text(page, line, clientX, leftY, 11, bold, COLORS.dark);
      leftY -= 14;
    }
    leftY -= 4;
    for (const line of clientAddressLines) {
      text(page, line, clientX, leftY, 8, regular, COLORS.gray);
      leftY -= 11;
    }

    const clientRightX = clientX + clientLeftWidth + 14;
    if (clientRightLines.length) {
      page.drawLine({
        start: { x: clientRightX - 8, y: y - boxPadding - 4 },
        end: { x: clientRightX - 8, y: y - clientHeight + boxPadding },
        thickness: 0.6,
        color: COLORS.border,
      });
    }
    let rightY = y - boxPadding - 20;
    for (const line of clientRightLines) {
      text(page, line, clientRightX, rightY, 7.8, regular, COLORS.dark);
      rightY -= 11;
    }

    y -= clientHeight + 16;

    /* ------------------------------ Motif d'avoir ------------------------------ */

    if (isAvoir && facture.motifAvoir) {
      const motifLines = wrapText(clean(facture.motifAvoir), CONTENT_WIDTH - 28, regular, 8);
      const motifHeight = 26 + motifLines.length * 11;

      ensureSpace(motifHeight + 14);

      page.drawRectangle({
        x: MARGIN,
        y: y - motifHeight,
        width: CONTENT_WIDTH,
        height: motifHeight,
        borderColor: COLORS.red,
        borderWidth: 0.5,
      });
      page.drawRectangle({
        x: MARGIN,
        y: y - motifHeight,
        width: 3,
        height: motifHeight,
        color: COLORS.red,
      });
      text(page, "MOTIF DE L'AVOIR", MARGIN + 14, y - 14, 6.8, bold, COLORS.red);
      let motifY = y - 27;
      for (const line of motifLines) {
        text(page, line, MARGIN + 14, motifY, 8, regular, COLORS.dark);
        motifY -= 11;
      }
      y -= motifHeight + 16;
    }

    /* --------------------------------- Tableau --------------------------------- */

    ensureSpace(110);

    text(page, "DÉTAIL DES PRESTATIONS", MARGIN, y - 8, 7, bold, COLORS.accent);
    textRight(
      page,
      "Montants exprimés en dirhams (MAD)",
      PAGE_WIDTH - MARGIN,
      y - 8,
      6.8,
      regular,
      COLORS.mutedGray
    );
    y -= 16;

    const tableX = MARGIN;
    const tableWidth = CONTENT_WIDTH;
    const headerHeight = 24;

    type Column = { label: string; width: number; align: "left" | "right" | "center" };
    const columns: Column[] = [
      { label: "N°", width: 24, align: "center" },
      { label: "Désignation", width: 195, align: "left" },
      { label: "Qté", width: 30, align: "right" },
      { label: "PU HT", width: 54, align: "right" },
      { label: "TVA %", width: 33, align: "right" },
      { label: "Total HT", width: 56, align: "right" },
      { label: "Montant TVA", width: 57, align: "right" },
      { label: "Total TTC", width: 62, align: "right" },
    ];
    const totalColumnWidth = columns.reduce((sum, c) => sum + c.width, 0);
    columns[1].width += tableWidth - totalColumnWidth;

    const cellTextX = (col: Column, x: number, value: string, font: PDFFont, size: number) => {
      const w = font.widthOfTextAtSize(value, size);
      if (col.align === "right") return x + col.width - w - 6;
      if (col.align === "center") return x + (col.width - w) / 2;
      return x + 6;
    };

    const drawTableHeader = () => {
      page.drawRectangle({
        x: tableX,
        y: y - headerHeight,
        width: tableWidth,
        height: headerHeight,
        color: COLORS.lightGray,
      });
      page.drawLine({
        start: { x: tableX, y: y - headerHeight },
        end: { x: tableX + tableWidth, y: y - headerHeight },
        thickness: 1,
        color: COLORS.accent,
      });
      let x = tableX;
      for (const col of columns) {
        const size = fitSize(bold, col.label, 7, col.width - 10, 5.3);
        text(
          page,
          col.label,
          cellTextX(col, x, col.label, bold, size),
          y - 15,
          size,
          bold,
          COLORS.dark
        );
        x += col.width;
      }
      y -= headerHeight;
    };

    drawTableHeader();

    const rows = facture.lignes as unknown as Line[];
    const rowFontSize = 7.5;

    // Les descriptions de métrage sont organisées en blocs lisibles :
    // ouvrage / dimensions / quantité et surface / tarif.
    // Chaque bloc peut revenir à la ligne sans couper les montants en deux.
    const descriptionMesuree = (description: string): string[] => {
      const segments = clean(description)
        .split(/\s*\|\s*/)
        .map((part) => part.trim())
        .filter(Boolean);

      if (segments.length < 2) {
        return wrapText(description, columns[1].width - 14, regular, rowFontSize);
      }

      const result: string[] = [];
      for (const segment of segments) {
        // Le tarif est placé sur sa propre ligne, sans scinder « 5 000,00 ».
        const parts = segment.split(/\s+à\s+(?=\d)/i);
        const readableParts = parts.length > 1
          ? [parts[0], `Prix : ${parts.slice(1).join(" à ")}`]
          : [segment];
        for (const part of readableParts) {
          result.push(...wrapText(part, columns[1].width - 14, regular, rowFontSize));
        }
      }
      return result.length ? result : [""];
    };

    for (let index = 0; index < rows.length; index++) {
      const line = rows[index];
      const descriptionLines = descriptionMesuree(line.description);
      const rowHeight = Math.max(24, descriptionLines.length * 11.5 + 14);

      if (y - rowHeight < BOTTOM_LIMIT) {
        page = newPage();
        y = drawCompactHeader(page);
        drawTableHeader();
      }

      page.drawLine({
        start: { x: tableX, y: y - rowHeight },
        end: { x: tableX + tableWidth, y: y - rowHeight },
        thickness: 0.4,
        color: COLORS.border,
      });

      const values: string[][] = [
        [String(index + 1)],
        descriptionLines,
        [formatNumber(line.quantite)],
        [formatAmount(line.prixUnitaireHt)],
        [`${formatNumber(line.tauxTva)} %`],
        [formatAmount(line.montantHt)],
        [formatAmount(line.montantTva)],
        [formatAmount(line.montantTtc)],
      ];

      let x = tableX;
      values.forEach((valueLines, columnIndex) => {
        const col = columns[columnIndex];
        const isTtc = columnIndex === columns.length - 1;
        const isIndex = columnIndex === 0;
        const font = isTtc ? bold : regular;
        valueLines.forEach((value, lineIndex) => {
          const size = columnIndex === 1 ? rowFontSize : fitSize(font, value, rowFontSize, col.width - 12, 5.2);
          text(
            page,
            value,
            cellTextX(col, x, value, font, size),
            y - 15 - lineIndex * 11.5,
            size,
            font,
            isIndex ? COLORS.mutedGray : COLORS.dark
          );
        });
        x += col.width;
      });

      y -= rowHeight;
    }

    // Trait de clôture du tableau
    page.drawLine({
      start: { x: tableX, y },
      end: { x: tableX + tableWidth, y },
      thickness: 1,
      color: COLORS.accent,
    });

    y -= 20;

    /* ------------------------- Totaux + informations --------------------------- */

    const totalsWidth = 210;
    const totalsX = PAGE_WIDTH - MARGIN - totalsWidth;
    const leftBlockWidth = CONTENT_WIDTH - totalsWidth - 22;

    // Montant en lettres : valeur enregistrée si elle existe, sinon calculée
    // à partir du total TTC pour qu'il figure sur chaque document.
    const montantLettres =
      clean(facture.montantEnLettres) || montantEnLettres(toNumber(facture.totalTtc));
    const lettersLines = wrapText(montantLettres, leftBlockWidth - 24, regular, 8.5).slice(0, 4);
    const lettersHeight = 28 + lettersLines.length * 11;

    const totalsHeight = 78;
    const leftBlockHeight = lettersHeight;
    const blockHeight = Math.max(totalsHeight, leftBlockHeight);

    ensureSpace(blockHeight + 10);

    // --- Colonne gauche
    const leftBlockY = y;

    {
      page.drawRectangle({
        x: MARGIN,
        y: leftBlockY - lettersHeight,
        width: leftBlockWidth,
        height: lettersHeight,
        borderColor: COLORS.border,
        borderWidth: 0.6,
      });
      page.drawRectangle({
        x: MARGIN,
        y: leftBlockY - lettersHeight,
        width: 3,
        height: lettersHeight,
        color: COLORS.accent,
      });
      text(
        page,
        isAvoir
          ? "ARRÊTÉ LE PRÉSENT AVOIR À LA SOMME DE"
          : isDevis
            ? "ARRÊTÉ LE PRÉSENT DEVIS À LA SOMME DE"
            : "ARRÊTÉ LA PRÉSENTE FACTURE À LA SOMME DE",
        MARGIN + 12,
        leftBlockY - 14,
        6.5,
        bold,
        COLORS.accent
      );
      let ly = leftBlockY - 27;
      for (const line of lettersLines) {
        text(page, line, MARGIN + 12, ly, 8.5, regular, COLORS.dark);
        ly -= 11;
      }
    }

    // --- Colonne droite : totaux
    page.drawRectangle({
      x: totalsX,
      y: y - totalsHeight,
      width: totalsWidth,
      height: totalsHeight,
      borderColor: COLORS.border,
      borderWidth: 0.7,
    });

    const drawTotalRow = (label: string, value: string, baseline: number) => {
      text(page, label, totalsX + 12, baseline, 8, regular, COLORS.gray);
      textRight(page, value, totalsX + totalsWidth - 12, baseline, 8.5, bold, COLORS.dark);
    };

    drawTotalRow("Sous-total HT", formatMoney(facture.sousTotalHt), y - 17);
    page.drawLine({
      start: { x: totalsX + 12, y: y - 25 },
      end: { x: totalsX + totalsWidth - 12, y: y - 25 },
      thickness: 0.4,
      color: COLORS.border,
    });
    drawTotalRow("Total TVA", formatMoney(facture.totalTva), y - 41);

    page.drawLine({
      start: { x: totalsX, y: y - totalsHeight + 28 },
      end: { x: totalsX + totalsWidth, y: y - totalsHeight + 28 },
      thickness: 1,
      color: COLORS.accent,
    });
    text(page, "TOTAL TTC", totalsX + 12, y - totalsHeight + 10, 8.5, bold, COLORS.accent);
    textRight(
      page,
      formatMoney(facture.totalTtc),
      totalsX + totalsWidth - 12,
      y - totalsHeight + 10,
      10.5,
      bold,
      COLORS.accent
    );

    y -= blockHeight + 26;

    /* ------------------------ Validité + cachet / signature -------------------- */

    const signatureHeight = 62;
    ensureSpace(signatureHeight + 10);

    // Colonne gauche : phrase de validité
    if (validityNote) {
      text(page, "VALIDITÉ", MARGIN, y - 13, 6.5, bold, COLORS.accent);
      let noteY = y - 27;
      for (const line of wrapText(validityNote, leftBlockWidth, regular, 8.5)) {
        text(page, line, MARGIN, noteY, 8.5, regular, COLORS.dark);
        noteY -= 11;
      }
    }

    // Colonne droite : cachet et signature
    page.drawRectangle({
      x: totalsX,
      y: y - signatureHeight,
      width: totalsWidth,
      height: signatureHeight,
      borderColor: COLORS.border,
      borderWidth: 0.6,
    });
    text(
      page,
      isDevis ? "BON POUR ACCORD, CACHET ET SIGNATURE" : "CACHET ET SIGNATURE",
      totalsX + 10,
      y - 13,
      6.5,
      bold,
      COLORS.mutedGray
    );

    /* --------------------------- Pieds de page + sauvegarde -------------------- */

    pages.forEach((p, i) => drawFooter(p, i + 1, pages.length));

    const pdfBytes = await pdfDoc.save();

    // Le hash n'est enregistré que pour la version interne : la version client
    // est une simple copie de consultation et ne doit pas écraser la référence.
    if (!isClientVersion) {
      const hash = createHash("sha256").update(pdfBytes).digest("hex");
      await prisma.facture.update({
        where: { id },
        data: {
          pdfHashSha256: hash,
          pdfUrl: `/api/factures/${id}/pdf`,
        },
      });
    }

    const filename = `${facture.numero}${isClientVersion ? "-client" : ""}.pdf`;

    return new NextResponse(pdfBytes as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("ERREUR GÉNÉRATION PDF :", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Erreur lors de la génération du PDF.",
      },
      { status: 500 }
    );
  }
}