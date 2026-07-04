"use client";

// Bascule clair / nuit. Le thème initial est déjà posé sur <html> par le script inline du
// layout (avant paint). Ici on lit l'état courant et on le bascule + persiste.
import { useEffect, useState } from "react";

const KEY = "cleveria.theme";

const Sun = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </svg>
);
const Moon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </svg>
);

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const cur = document.documentElement.getAttribute("data-theme");
    if (cur === "dark" || cur === "light") setTheme(cur);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* mode privé / quota → on ignore */
    }
  };

  return (
    <button
      type="button"
      className="cbtn theme-toggle"
      onClick={toggle}
      aria-label={theme === "dark" ? "Passer en mode clair" : "Passer en mode nuit"}
      title={theme === "dark" ? "Mode clair" : "Mode nuit"}
    >
      {theme === "dark" ? <Sun /> : <Moon />}
    </button>
  );
}
