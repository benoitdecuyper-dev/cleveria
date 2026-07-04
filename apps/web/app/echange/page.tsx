import { redirect } from "next/navigation";

// CLV-53 §incrément 5 (docs/26) : /echange n'est plus une surface séparée. `/voice` porte
// désormais tout ce que `/echange` faisait — le rail échange non-engagé (incr. 2), le bouton
// « Transformer en projet » qui promeut l'objet EN PLACE (incr. 3), et l'historique unifié
// (tous stages, incr. 4). On redirige donc simplement, même patron que `/brief` (ci-dessus dans
// l'arbre) : redirect serveur, pas de flash de l'ancienne UI orbe/demi-duplex.
// `?echange=1` préserve l'entrée « discuter » : /voice démarre une conversation NEUVE au stage
// "echange" (cf. app/voice/page.tsx, bootstrap `?echange=1`) — sans lui, l'entrée disparaîtrait.
// ⚠️ Ne PAS supprimer ce fichier : il évite un lien mort pour tout marque-page/lien externe vers
// /echange. Le nettoyage du code mort de l'ancienne page (boucle demi-duplex, orbe) = incr. 6.
export default function EchangePage() {
  redirect("/voice?echange=1");
}
