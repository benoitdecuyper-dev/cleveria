import type { ReactNode } from "react";

export const metadata = {
  title: "Cleveria",
  description: "Dépose un brief, l'équipe s'en occupe.",
};

// V0 : volontairement nu. L'esthétique viendra plus tard.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          maxWidth: 680,
          margin: "2rem auto",
          padding: "0 1rem",
          lineHeight: 1.5,
        }}
      >
        {children}
      </body>
    </html>
  );
}
