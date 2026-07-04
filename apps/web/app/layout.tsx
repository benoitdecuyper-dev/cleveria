import type { ReactNode } from "react";
import Link from "next/link";
import Breadcrumb from "./components/Breadcrumb";
import ThemeToggle from "./components/ThemeToggle";
import "./globals.css";

export const metadata = {
  title: "Cleveria — votre site web, avant de payer un centime",
  description:
    "Décrivez votre activité ou donnez l'adresse de votre site actuel : voyez une maquette gratuite de votre futur site. Vous ne validez un devis que si le résultat vous convainc.",
};

// Pose le thème sur <html> AVANT le paint (pas de flash blanc en mode nuit) : localStorage
// s'il existe, sinon la préférence OS.
const THEME_SCRIPT = `(function(){try{var k='cleveria.theme';var t=localStorage.getItem(k);if(t!=='dark'&&t!=='light'){t=(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <header className="site-header">
          <div className="container inner">
            <Link href="/" className="brand">
              <svg className="logo" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                <rect x="6" y="20" width="14" height="14" rx="5" fill="currentColor" transform="rotate(45 13 27)" />
                <rect x="18" y="4" width="18" height="18" rx="6.5" fill="var(--primary)" transform="rotate(45 27 13)" />
              </svg>
              <span className="wordmark">Clever<span className="wm-i">i</span>a</span> <small>agence d'agents IA</small>
            </Link>
            <span className="header-spacer" />
            <ThemeToggle />
          </div>
        </header>
        <Breadcrumb />
        <main className="page">
          <div className="container">{children}</div>
        </main>
      </body>
    </html>
  );
}
