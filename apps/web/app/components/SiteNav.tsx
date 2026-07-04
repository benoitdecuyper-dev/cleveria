"use client";

// Bascule de mode persistante dans le header : orientation (« tu es ici ») + navigation
// entre Assistant et Projet depuis n'importe quelle page.
import Link from "next/link";
import { usePathname } from "next/navigation";

const MODES = [
  { href: "/echange", label: "Assistant" },
  { href: "/voice", label: "Projet" },
];

export default function SiteNav() {
  const path = usePathname() || "/";
  return (
    <nav className="mode-nav" aria-label="Modes">
      {MODES.map((m) => {
        const active = path === m.href || path.startsWith(m.href + "/");
        return (
          <Link
            key={m.href}
            href={m.href}
            className={`mode-pill ${active ? "active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            {m.label}
          </Link>
        );
      })}
    </nav>
  );
}
