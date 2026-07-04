"use client";

// Fil d'Ariane : « Accueil › <section> ». Masqué sur l'accueil. Donne le repère de
// position sur toutes les pages internes.
import Link from "next/link";
import { usePathname } from "next/navigation";

// `/echange` n'a plus de libellé propre : depuis CLV-53 §incrément 5 (docs/26), c'est un
// redirect serveur vers `/voice?echange=1` (app/echange/page.tsx, même patron que `/brief`
// ci-dessous) — jamais rendu assez longtemps pour que ce fil d'Ariane s'affiche dessus.
const LABELS: Record<string, string> = {
  "/voice": "Projet",
  "/brief": "Brief",
  "/live": "Temps réel",
};

export default function Breadcrumb() {
  const path = usePathname() || "/";
  if (path === "/") return null;
  const label = LABELS[path] ?? (path.startsWith("/run") ? "Projet en cours" : "");
  return (
    <div className="crumbs-bar">
      <div className="container crumbs">
        <Link href="/">Accueil</Link>
        {label && (
          <>
            <span className="sep" aria-hidden>›</span>
            <span className="cur">{label}</span>
          </>
        )}
      </div>
    </div>
  );
}
