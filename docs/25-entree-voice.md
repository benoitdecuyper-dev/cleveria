# 25 — L'entrée de `/voice` doit tenir la promesse du hero (le site, la maquette gratuite)

> Rédigé par l'UX/UI & communication de la Factory, 2026-07-04, à la demande de Ben.
> S'appuie sur [`24-positionnement-entree.md`](./24-positionnement-entree.md) (la
> promesse validée sur `/`) et [`19-service-site.md`](./19-service-site.md) (le parcours
> maquette-first, création vs rebranding). Ne modifie ni le parcours ni le droit — c'est
> une spec de **texte + agencement** pour l'entrée `apps/web/app/voice/page.tsx`,
> section `!started` (ce que Ben appelle « heroState »), lignes ~1149-1296 du fichier
> actuel. Le développeur implémente ; ce document ne code pas la page.

## 0. Le problème, en une phrase

`/` promet : *« Votre site, avant de payer un centime »* → CTA *« Voir la maquette de
mon site — gratuit »*. Le visiteur clique, arrive sur `/voice`, et lit : *« Quel est
votre besoin ? » / « Parlez. On s'en occupe. »* — un accueil d'assistant vocal
générique, qui ne confirme ni le mot « site », ni la promesse « gratuit », ni le geste
attendu (décrire son activité ou coller une URL). C'est exactement la rupture que
`24-positionnement-entree.md` §3 signalait déjà sans la trancher (« point d'attention non
résolu »). Ce document la tranche pour `/voice`.

---

## 1. Titre + sous-titre retenus

**Titre (`h1.sh-title`)**

```
Voyons à quoi ressemble votre site.
```

**Sous-titre (`p.sh-sub`)**

```
Décrivez votre activité, ou collez l'adresse de votre site actuel. Vous voyez la
maquette avant de payer un centime.
```

**Justification** : le titre reprend l'action promise (voir un résultat), pas un
mécanisme abstrait (« votre besoin »). Le sous-titre reprend mot pour mot le geste
décrit sur `/` (« décrivez votre activité, ou donnez-nous l'adresse de votre site
actuel ») et la clause de risque inversé du hero (« avant de payer un centime ») — le
visiteur retrouve exactement ce qu'il vient de lire, sans changement de registre ni de
vocabulaire. Vouvoiement conservé (cohérent avec `/` et avec la remarque de
`24-positionnement-entree.md` §4 sur la tension avec le tutoiement du pitch général —
tension déjà actée, pas rouverte ici).

**Élément optionnel à ajouter au-dessus du titre** — un eyebrow (`p.eyebrow`, classe déjà
stylée et utilisée ailleurs sur la page dans l'état « crystal ») :

```
Maquette gratuite — sans engagement
```

Utile pour ancrer « gratuit » très haut dans le champ de vision, avant même le titre —
mais **optionnel** : à arbitrer par le dev/Ben si l'écran commence à être chargé (voir
§3 les autres éléments qui se disputent l'espace au-dessus du pli).

---

## 2. Les deux chemins d'entrée : lequel est primaire, comment ils coexistent

### Décision : **décrire son activité est le chemin primaire ; l'URL est secondaire et optionnelle.**

Raisons :
- C'est déjà l'ordre choisi dans le hero de `/` (« Décrivez votre activité, ou
  donnez-nous l'adresse de votre site actuel ») — respecter cet ordre évite une nouvelle
  rupture de cohérence entre les deux pages.
- Décrire fonctionne pour **tout le monde** (avec ou sans site existant) ; l'URL n'aide
  qu'un sous-ensemble (ceux qui ont déjà un site à moderniser). Le chemin universel doit
  être la voie par défaut, l'autre un complément.
- Le champ URL est déjà câblé côté produit comme optionnel (placeholder actuel : « URL
  de votre site actuel (optionnel — pour un rebranding) », le bouton d'envoi s'active
  dès que l'un OU l'autre champ est rempli — voir `page.tsx` ligne ~1251). Le
  repositionnement du texte confirme un choix déjà fait dans le code, il ne l'inverse
  pas.

### Ce qui change dans l'agencement (et pourquoi)

**Aujourd'hui** : un gros bouton micro circulaire (96px, animation « Shazam ») est
l'élément visuellement dominant de l'écran, avant même le champ texte. C'était juste
quand `/voice` vendait un assistant vocal générique. Ce n'est plus juste maintenant :
pour quelqu'un venu chercher un site, un micro géant en premier plan signale « ceci est
un outil vocal », pas « ceci va produire mon site » — c'est le même défaut que doc 24 §1
diagnostiquait sur `/` avant repositionnement, transposé à `/voice`.

**Recommandation** : le champ de description (texte) devient l'élément dominant ;
le micro reste disponible mais **en icône compacte accolée au champ**, pas en gros
bouton central. Le geste vocal continue d'exister (case d'usage réelle : quelqu'un qui
préfère parler), mais il n'est plus la vedette visuelle de l'écran dédié au site.

### Wireframe (bas-fidélité)

```
                    Maquette gratuite — sans engagement          [eyebrow, optionnel]

              Voyons à quoi ressemble votre site.                [titre]
     Décrivez votre activité, ou collez l'adresse de votre       [sous-titre]
       site actuel. Vous voyez la maquette avant de payer
                        un centime.

  ┌───────────────────────────────────────────────────────┐
  │ Décrivez votre activité en une phrase…            🎤 ➤ │   ← PRIMAIRE
  └───────────────────────────────────────────────────────┘
     [ Menuisier ]  [ Association sportive ]  [ Food-truck ]  [ Boutique en ligne ]
                          (exemples cliquables)

                 — ou, si vous avez déjà un site —                [séparateur reformulé]

  ┌───────────────────────────────────────────────────────┐
  │ 🔗 Adresse de votre site actuel (si vous en avez un)    │   ← SECONDAIRE, optionnel
  └───────────────────────────────────────────────────────┘
     On récupère son contenu pour vous proposer une nouvelle version.
```

**Pendant la dictée** (micro activé) : la zone au-dessus du champ affiche l'état
d'écoute (« J'écoute… » + transcription live) — mécanisme déjà en place
(`sh-listening`, `sh-transcript`), juste ancré autour de l'icône compacte plutôt qu'au
centre de l'écran.

### Ce qui NE change pas

- Les deux champs restent visibles **simultanément**, sans onglet ni bascule
  « j'ai un site / je n'en ai pas ». Un commutateur ajouterait un clic et une décision
  avant même de commencer — contraire à l'argument « pas de formulaire à remplir » du
  hero. La hiérarchie visuelle (taille, ordre, poids) suffit à indiquer lequel est
  attendu par défaut.
- Le bouton d'envoi reste unique et s'active dès que l'un des deux champs est rempli
  (texte seul, URL seule, ou les deux) — logique déjà correcte dans le code
  (`disabled={loading || (!text.trim() && !url.trim())}`).
- Les chips d'exemples restent rattachés au champ description (ils illustrent des
  activités, pas des URLs).

---

## 3. Le fil jusqu'à la maquette — ce qu'on montre pour rassurer

Une fois le champ envoyé (description et/ou URL), le parcours suit exactement
`19-service-site.md` §2 : capture d'URL si fournie (invisible pour le client) → le bras
droit peut poser 1-2 questions ciblées → génération automatique de la 1ère maquette,
affichée dans le board, sans bouton à cliquer pour la déclencher.

**Ce qui doit rester visible/rassurant pendant ce trajet** :

1. **Pendant la génération** — le board affiche déjà « La maquette se construit… »
   (`mockup-building`, `page.tsx` ligne ~1386). Recommandation : ajouter, à côté de
   l'eyebrow du board (« Board · maquette en live »), un badge court et discret —
   par exemple **« Gratuit »** ou **« Gratuit jusqu'à validation »** — réutilisant un
   style de badge/chip déjà présent dans `globals.css` (`.chip` ou `.badge.*`), pas une
   nouvelle couleur. Objectif : que la promesse du hero reste visible à l'écran suivant,
   pas seulement dans le souvenir du visiteur.
2. **Pendant les itérations** (« ce bouton en vert », etc.) — rien à changer, le
   mécanisme existant (régénération complète, doc 16/18) fonctionne déjà en conversation
   naturelle ; pas besoin d'ajouter de texte de réassurance à chaque tour, ce serait
   redondant.
3. **Au moment du devis** (CLV-36/37, pas encore construit) — hors périmètre de ce
   document, mais le principe déjà acté dans doc 19 §3 doit se retrouver dans la
   microcopie du bouton final quand il sera câblé : nommer explicitement que c'est
   **maintenant** que ça devient payant (ex. « Valider la maquette — voir le devis »),
   jamais un bouton ambigu qui laisserait croire à un lancement gratuit de l'équipe.

Le bras droit peut être nommé une fois à ce stade (ex. légende sous le champ, ou
première question posée à l'oral/à l'écrit) — cohérent avec doc 24 §2 : il devient
visible **une fois la promesse comprise**, jamais avant.

---

## 4. Microcopie précise à changer

| Emplacement (code) | Avant | Après |
|---|---|---|
| `h1.sh-title` | « Quel est votre besoin ? » | « Voyons à quoi ressemble votre site. » |
| `p.sh-sub` | « Parlez. On s'en occupe. » | « Décrivez votre activité, ou collez l'adresse de votre site actuel. Vous voyez la maquette avant de payer un centime. » |
| *(nouveau, optionnel)* `p.eyebrow` avant le titre | — n'existe pas | « Maquette gratuite — sans engagement » |
| placeholder champ texte (`input` dans `.sh-write`) | « Décrivez votre besoin en une phrase… » | « Décrivez votre activité en une phrase… » |
| placeholder champ URL (`.sh-url input`) | « URL de votre site actuel (optionnel — pour un rebranding) » | « Adresse de votre site actuel (si vous en avez un) » — évite le mot « rebranding », jargon interne (cf. doc 24 §1, allergie au vocabulaire technique) |
| *(nouveau, optionnel)* légende sous le champ URL | — n'existe pas | « On récupère son contenu pour vous proposer une nouvelle version. » |
| divider `.sh-or` | « ou écrivez » | « ou, si vous avez déjà un site » — change de rôle : ne sépare plus « parler » de « écrire », sépare « décrire » de « donner une URL » |
| chips d'exemples (`EXAMPLES`, `page.tsx` ligne ~69) | « Financer et structurer mon asso sportive », « Un business plan pour ouvrir mon food-truck » (hors-sujet : ne parlent pas de site) | À reformuler entièrement autour du site, ex. : « Un site vitrine pour mon activité de menuisier », « Une page pour mon association sportive », « Un site pour présenter mon food-truck », « Une boutique en ligne pour mes créations » — les 4 exemples doivent illustrer des *sites*, pas d'autres services, puisque `/voice` ne vend plus que ça |
| badge board (nouveau, optionnel) | — n'existe pas | « Gratuit » ou « Gratuit jusqu'à validation », à côté de l'eyebrow « Board · maquette en live » |

---

## 5. Ajustements CSS (`.sh-*`) à décrire au dev

Aucune nouvelle couleur, aucun nouveau token — tout reste piloté par les variables déjà
en place (`--primary`/`--accent`, y compris l'override magenta de
`.voice[data-mode="projet"]`, clair et sombre via `data-theme`). Ajustements structurels
seulement :

1. **Le micro passe de « gros bouton central » à « icône compacte accolée au champ
   texte »**. Aujourd'hui `.sh-mic` est un cercle de 96px, positionné en premier,
   centré, avec halo (`.sh-rings`). Besoin d'une variante plus petite (~40-44px,
   proportionnée au champ `.sh-write`, qui fait déjà 42px de hauteur pour son bouton
   d'envoi `.cbtn.send`) — même dégradé (`var(--primary)`/`var(--accent)`), mêmes
   états (`recognizing`/`rec`), juste une taille et une position différentes (dans la
   ligne flex de `.sh-write`, entre le champ et le bouton d'envoi, ou juste avant lui).
   Les anneaux (`.sh-rings`) peuvent être conservés à échelle réduite ou simplifiés —
   à valider visuellement par le dev, ce n'est pas critique si l'animation ne passe pas
   bien en petit format.
2. **Ordre du DOM à inverser** : aujourd'hui `.sh-mic` (centré) → `.sh-or` → `.sh-write`
   → `.sh-url`. Nouvel ordre : `.sh-write` (avec micro compact intégré) → `.sh-examples`
   → `.sh-or` (reformulé) → `.sh-url` (+ légende optionnelle).
3. **`.sh-or`** : le texte s'allonge (« ou, si vous avez déjà un site » vs « ou
   écrivez ») — vérifier le retour à la ligne sur mobile (`.sh-or-line` a une largeur
   fixe de 42px de part et d'autre, à revalider si le texte central prend plus de
   place).
4. **Légende sous `.sh-url`** (si retenue) : simple ligne muted, réutiliser le pattern
   déjà existant ailleurs (`.muted`, taille ~0.78rem), pas de nouvelle classe
   indispensable — un `<p className="muted">` suffit, ou une classe `.sh-url-note`
   dédiée si un style plus spécifique est voulu.
5. **Badge « Gratuit » sur le board** (si retenu) : réutiliser un style de badge/chip
   existant (`.chip` ou `.badge.*` dans `globals.css`), pas une nouvelle couleur —
   ton neutre (gris) par défaut, cohérent avec la sobriété demandée hors demande
   explicite de mise en avant de marque.
6. **État « crystal »** (écho après dictée, `sh-crystal`, eyebrow « Voici ce que j'ai
   compris ») : **inchangé** — ce document ne touche pas à cet état, qui reste correct
   tel quel (il s'affiche après une dictée vocale, peu importe qu'elle porte sur une
   description ou soit suivie d'une URL séparée).

---

## 6. Bras droit — reste en second rideau

Cohérent avec `24-positionnement-entree.md` §2 : le mot « bras droit » n'apparaît ni
dans le titre, ni dans le sous-titre, ni dans les placeholders de cette entrée. Il peut
apparaître **une fois**, plus loin dans le fil (légende discrète, première relance du
bras droit après envoi — voir §3), une fois que la promesse (le site, la maquette
gratuite) est déjà comprise. Ce document ne le retire pas du vocabulaire de marque, il
confirme juste qu'il n'est pas tête d'affiche sur cet écran non plus.

---

## 7. Point non résolu, signalé pour la suite

Le champ URL est aujourd'hui capturé côté client (`page.tsx`) mais la capture réelle du
contenu (Jina/`readUrl`, doc 19 §1, ticket CLV-34) n'est pas encore branchée côté
serveur — ce document suppose que le fil décrit en §3 (capture invisible → maquette
qui reprend le contenu réel) est disponible au moment où cette microcopie sera livrée.
Si CLV-33/34 ne sont pas encore faits, le champ URL fonctionnera visuellement mais la
maquette générée ne reprendra pas encore le contenu du site existant — écart à
surveiller avec le développeur, pas un problème de copy.
