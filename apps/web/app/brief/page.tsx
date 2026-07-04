import { redirect } from "next/navigation";

// L'ancienne UI de cadrage (chat + questions/note) a été remplacée par /voice. Cette page ne
// sert plus qu'à rediriger les liens/marque-pages existants, en préservant ?demo=1.
// ⚠️ Ne PAS supprimer NoteView.tsx : il est réutilisé par /voice (need card en mode démo).
export default async function BriefPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const demo = sp.demo === "1";
  redirect(demo ? "/voice?demo=1" : "/voice");
}
