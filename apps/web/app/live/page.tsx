import Link from "next/link";

// Approche B — échange vocal temps réel. Le worker existe (apps/voice-agent) ;
// le branchement front (token LiveKit + client) sera fait après que l'approche A
// (dépôt de brief) soit fonctionnelle de bout en bout.
export default function LivePage() {
  return (
    <main>
      <p>
        <Link href="/">← Cleveria</Link>
      </p>
      <h1>Parler en direct</h1>
      <p>
        L'échange vocal temps réel avec le chef de projet arrive ensuite. Le worker voix est
        déjà en place (<code>apps/voice-agent</code>) ; on branche le front une fois le dépôt de
        brief validé.
      </p>
      <p>
        En attendant : <Link href="/brief">déposer un brief</Link>.
      </p>
    </main>
  );
}
