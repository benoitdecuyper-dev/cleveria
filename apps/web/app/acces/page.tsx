"use client";

// Page d'accès du gate léger (démarchage). Le middleware (../../middleware.ts) redirige ici
// toute route protégée quand le visiteur n'a pas de cookie de session valide, avec un
// paramètre `?next=` pour le ramener où il voulait aller une fois le code accepté.
//
// Le code de référence n'est JAMAIS présent ici : cette page ne connaît que ce que
// l'utilisateur saisit, et confie la vérification à /api/access (serveur uniquement).
import { useState, type FormEvent } from "react";

export default function AccesPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!code.trim() || pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        setError("Code incorrect. Vérifiez le lien qui vous a été communiqué.");
        setPending(false);
        return;
      }
      const next = new URLSearchParams(window.location.search).get("next");
      // navigation complète (pas router.push) : on veut que le cookie fraîchement posé soit
      // pris en compte dès le prochain passage dans le middleware, sans état client résiduel.
      window.location.href = next && next.startsWith("/") ? next : "/";
    } catch {
      setError("Une erreur est survenue. Réessayez.");
      setPending(false);
    }
  }

  return (
    <div className="vhero">
      <div className="avatar">C</div>
      <h1>Entrez votre code d&rsquo;accès</h1>
      <p className="lead">
        Cleveria est encore en accès restreint. Le code vous a été communiqué avec le lien vers
        cette page.
      </p>
      <form onSubmit={onSubmit} style={{ maxWidth: "22rem", margin: "1.2rem auto 0", textAlign: "left" }}>
        <input
          className="input"
          type="password"
          inputMode="text"
          autoComplete="off"
          autoFocus
          placeholder="Code d'accès"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          disabled={pending}
          aria-label="Code d'accès"
        />
        {error && (
          <p className="banner err" role="alert" style={{ marginTop: "0.6rem" }}>
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-lg" style={{ width: "100%", marginTop: "0.8rem", justifyContent: "center" }} disabled={pending || !code.trim()}>
          {pending ? "Vérification…" : "Entrer"}
        </button>
      </form>
    </div>
  );
}
