import Link from "next/link";

export default function Home() {
  return (
    <main>
      <h1>Cleveria</h1>
      <p>Comment veux-tu démarrer ?</p>
      <ul>
        <li>
          <Link href="/brief">
            <strong>Déposer un brief</strong> — écrit ou vocal, avec pièces jointes
          </Link>
          <br />
          <small>Tu déposes, le chef de projet cadre. Pas de conversation en direct.</small>
        </li>
        <li style={{ marginTop: "1rem" }}>
          <Link href="/live">
            <strong>Parler en direct</strong> — échange vocal temps réel
          </Link>
          <br />
          <small>Conversation live avec le chef de projet (en cours de mise au point).</small>
        </li>
      </ul>
    </main>
  );
}
