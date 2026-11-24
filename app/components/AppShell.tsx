import Link from "next/link";
import type { ReactNode } from "react";

const navLink =
  "rounded-lg px-3 py-2 transition hover:bg-[#f0f3f7]";

// En-tête + conteneur communs. Même rendu que le Shell de vos pages,
// avec le lien « Devis » en plus.
export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f5f7fa] text-[#273241]">
      <header className="border-b border-[#e1e6ec] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-bold tracking-tight text-[#273241]">
            Facturation FUSION INOX
          </Link>

          <nav className="flex items-center gap-2 text-sm font-medium text-[#4c5663]">
            <Link href="/factures" className={navLink}>
              Factures
            </Link>

            <Link href="/devis" className={navLink}>
              Devis
            </Link>

            <Link href="/clients" className={navLink}>
              Clients
            </Link>

            <Link href="/articles" className={navLink}>
              Articles
            </Link>

            <Link href="/entreprise" className={navLink}>
              Entreprise
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
    </main>
  );
}
