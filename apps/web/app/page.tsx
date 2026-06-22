import Link from "next/link";

export default function Home() {
  return (
    <>
      <p className="eyebrow">Ton équipe, à la demande</p>
      <h1>Décris ce que tu veux faire. Une équipe d'agents s'en occupe.</h1>
      <p className="lead">
        Le chef de projet cadre ton besoin avec toi, puis mobilise les bons spécialistes —
        dev, finance, juridique, marketing… — qui produisent les livrables sous tes yeux.
      </p>

      <div className="spacer-sm" />

      <div className="card-grid">
        <Link href="/brief" className="entry">
          <span className="pill">Recommandé</span>
          <div className="title">
            <span className="ico">📝</span> Déposer un brief
          </div>
          <div className="desc">
            Écrit ou vocal, avec pièces jointes. Le chef de projet te challenge avec des questions,
            produit une note de cadrage, puis lance l'équipe.
          </div>
        </Link>

        <Link href="/brief?demo=1" className="entry">
          <span className="pill soft">Sans compte</span>
          <div className="title">
            <span className="ico">▶️</span> Voir une démo
          </div>
          <div className="desc">
            Rejoue un scénario complet (cadrage → équipe au travail → synthèse) avec un exemple réel,
            sans rien configurer.
          </div>
        </Link>

        <Link href="/live" className="entry">
          <span className="pill soft">Bientôt</span>
          <div className="title">
            <span className="ico">🎙️</span> Parler en direct
          </div>
          <div className="desc">
            Conversation vocale temps réel avec le chef de projet (en cours de mise au point).
          </div>
        </Link>
      </div>
    </>
  );
}
