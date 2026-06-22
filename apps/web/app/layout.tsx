import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";

export const metadata = {
  title: "Cleveria — ton agence d'agents IA",
  description: "Dépose un brief, une équipe d'agents IA le cadre et le réalise.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <header className="site-header">
          <div className="container inner">
            <Link href="/" className="brand">
              <span className="logo" aria-hidden />
              Cleveria <small>agence d'agents IA</small>
            </Link>
            <span className="header-spacer" />
            <Link href="/brief" className="header-link">
              Déposer un brief
            </Link>
          </div>
        </header>
        <main className="page">
          <div className="container">{children}</div>
        </main>
      </body>
    </html>
  );
}
