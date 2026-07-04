import Link from "next/link";

// Accueil (docs/24 — positionnement d'entrée) : on mène par le SITE (le service qui se vend),
// pas par l'assistant générique. Promesse = voir une maquette gratuite de son futur site avant
// tout paiement ; le « bras droit » passe en second rideau (mécanisme, pas tête d'affiche). Le
// CTA mène à `/voice`, la surface qui porte la capture d'URL + la génération de maquette.
// (Le flux « collez votre URL → maquette instantanée » complet est CLV-33/34, pas encore construit.)
export default function Home() {
  return (
    <div className="hero-solo">
      <p className="eyebrow">Création &amp; refonte de site internet — pour indépendants, TPE et associations</p>
      <h1>Votre site, avant de payer un centime.</h1>
      <p className="lead hero-solo-lead">
        Décrivez votre activité, ou donnez-nous l'adresse de votre site actuel : en quelques
        minutes, vous voyez une vraie maquette de votre futur site — gratuitement. Vous ne validez
        un devis que si le résultat vous convainc ; c'est alors notre équipe qui construit le site
        pour de vrai.
      </p>
      <Link href="/voice" className="btn btn-primary btn-lg hero-solo-cta">
        Voir la maquette de mon site — gratuit →
      </Link>
      <p className="hero-solo-note">
        Pas de formulaire à remplir : vous en discutez avec votre bras droit Cleveria, qui construit
        la maquette avec vous, à votre rythme.
      </p>
      <p className="muted hero-solo-links">
        <Link href="/voice?echange=1">Juste discuter</Link>
        <span aria-hidden> · </span>
        <Link href="/voice?history=1">Retrouver mes projets</Link>
        <span aria-hidden> · </span>
        <Link href="/voice?demo=1">Voir une démo</Link>
      </p>
    </div>
  );
}
