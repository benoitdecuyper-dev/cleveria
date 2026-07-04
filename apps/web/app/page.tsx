import Link from "next/link";

// Accueil (CLV-51, docs/22 §1) — plus de choix de mode a priori : un hero unique, un seul
// CTA, qui mène directement à la surface conversationnelle (`/echange`). La conversation est
// l'état zéro : elle peut rester un simple échange, ou devenir un Projet via la passerelle
// « Transformer en projet » déjà présente dans `/echange` (geste explicite, pas un 2e chooser
// ici). Accès discret conservé vers les projets déjà engagés et la démo, pour ne pas enfermer
// un utilisateur qui revient.
export default function Home() {
  return (
    <div className="hero-solo">
      <p className="eyebrow">Votre équipe, à la demande</p>
      <h1>Dites-nous ce que vous voulez faire</h1>
      <p className="lead hero-solo-lead">
        Une conversation avec votre bras droit suffit pour démarrer. Il vous écoute, cadre votre
        besoin avec vous, puis mobilise une équipe d'agents pour le réaliser — quand vous êtes
        prêt à passer à l'action.
      </p>
      <Link href="/echange" className="btn btn-primary btn-lg hero-solo-cta">
        Commencer une conversation →
      </Link>
      <p className="muted hero-solo-links">
        <Link href="/voice?history=1">Retrouver mes projets</Link>
        <span aria-hidden> · </span>
        <Link href="/voice?demo=1">Voir une démo</Link>
      </p>
    </div>
  );
}
