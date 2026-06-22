import Link from "next/link";

// Approche B — échange vocal temps réel. Le worker existe (apps/voice-agent) ;
// le branchement front sera fait après que l'approche A (dépôt de brief) soit complète.
export default function LivePage() {
  return (
    <>
      <p className="eyebrow">Bientôt</p>
      <h1>Parler en direct</h1>
      <p className="lead">
        L'échange vocal temps réel avec le chef de projet arrive ensuite. Le worker voix est déjà en
        place (<code>apps/voice-agent</code>) ; on branche le front une fois le dépôt de brief complet.
      </p>
      <div className="card">
        En attendant, le plus rapide : <Link href="/brief">déposer un brief</Link> ou{" "}
        <Link href="/brief?demo=1">voir une démo</Link>.
      </div>
      <p style={{ marginTop: "1.4rem" }}>
        <Link href="/" className="muted">
          ← Retour à l'accueil
        </Link>
      </p>
    </>
  );
}
