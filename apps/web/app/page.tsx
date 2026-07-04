import Link from "next/link";

// Accueil — deux dalles verticales (docs/12) : le mode Assistant (discussion vocale) et le
// mode Projet (board + équipe). Le choix du mode est explicite : plus de triage deviné.
export default function Home() {
  return (
    <>
      <div className="modes-head">
        <p className="eyebrow">Ton équipe, à la demande</p>
        <h1>Comment veux-tu avancer&nbsp;?</h1>
      </div>

      <div className="modes">
        <Link href="/echange" className="slab slab-assistant">
          <div className="slab-inner">
            <div className="slab-text">
              <p className="slab-eyebrow">Parler · mains-libres · en direct</p>
              <h2 className="slab-title">Mode Assistant</h2>
              <p className="slab-desc">
                Une discussion à voix haute avec ton bras droit. Tu parles, il te répond, il
                réécoute tout seul — pour dégrossir une idée, un avis, réfléchir tout haut.
              </p>
            </div>
            <div className="slab-visual" aria-hidden>
              <div className="eq">
                <span /><span /><span /><span /><span /><span /><span />
              </div>
            </div>
            <span className="slab-cta">Discuter →</span>
          </div>
        </Link>

        <Link href="/voice" className="slab slab-projet">
          <div className="slab-inner">
            <div className="slab-text">
              <p className="slab-eyebrow">Cadrer · produire · mobiliser l'équipe</p>
              <h2 className="slab-title">Mode Projet</h2>
              <p className="slab-desc">
                Le bras droit cadre ton besoin, puis l'équipe d'agents produit les livrables dans
                le board, en direct. Pour un vrai projet — build, business plan, montage, campagne.
              </p>
            </div>
            <div className="slab-visual" aria-hidden>
              <div className="kb">
                <div className="kb-col"><i /><i /><i className="short" /></div>
                <div className="kb-col"><i /><i className="short" /><i /></div>
                <div className="kb-col"><i className="short" /><i /><i /></div>
              </div>
            </div>
            <span className="slab-cta">Lancer un projet →</span>
          </div>
        </Link>
      </div>

      <p className="muted modes-foot">
        Envie de voir sans rien configurer&nbsp;? <Link href="/voice?demo=1">Lancer une démo</Link> (scénario
        complet, sans IA).
      </p>
    </>
  );
}
