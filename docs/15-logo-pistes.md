# 15 — Pistes de logo Cleveria

> Dessiné par `factory-ux-ui` à partir du brief de marque (`docs/14-marque.md`), 2026-07-03.
> 4 concepts, en SVG inline autonome, prêts à être ouverts dans un navigateur. **Priorité
> à Direction A et D** (ce que Ben a déjà validé) ; B et C sont des options si une icône
> d'app autonome s'avère nécessaire.

## Avertissement honnête avant de lire

Je n'ai pas d'outil de rendu de navigateur dans cet environnement — ces SVG sont
construits à la main (géométrie calculée, pas dessinés à l'œil dans un logiciel), mais
je ne les ai **pas vus rendus**. Deux conséquences :

1. **Ouvre chaque bloc SVG dans un navigateur avant de trancher** (copier le code dans un
   fichier `.svg` ou dans https://svg-edit... / un simple fichier HTML). Je suis confiant
   sur la construction géométrique (angles, rayons, superpositions vérifiés par calcul),
   mais un contrôle visuel reste nécessaire avant tout usage engageant — je le dis
   explicitement plutôt que d'affirmer « c'est bon ».
2. **Le positionnement du point/repère du « i » dans les lockups (mot complet) est une
   estimation de la chasse des lettres** pour la pile de polices système demandée
   (`ui-sans-serif, system-ui, 'Segoe UI', Roboto, sans-serif`, 800), pas une mesure
   exacte — les polices système varient légèrement d'un OS à l'autre. C'est volontaire et
   assumé par le brief (« la typo finale sera choisie plus tard, tu approximes
   proprement ») : à recaler visuellement une fois la typo verrouillée, ou à refaire en
   traçant le mot en path une fois le lettrage final figé. Le **détail du i lui-même**
   (Concept 1 notamment), lui, est entièrement dessiné à la main donc fiable.

## Convention commune aux 4 concepts

- **`currentColor`** porte tout ce qui doit s'adapter au fond (traits, lettrage) — hérite
  de la couleur du texte du conteneur parent (ou de l'attribut `style="color:…"` posé sur
  la balise `<svg>` elle-même, ce que je fais ici pour que chaque bloc s'affiche
  correctement même ouvert seul : `#18181b` par défaut, à remplacer par un gris clair en
  thème sombre).
- **Le violet `#7c3aed` est toujours en dur**, jamais en `currentColor` — c'est la seule
  couleur de marque qui ne bouge pas, qu'on soit en clair ou en sombre. Aucun dégradé
  nulle part (cf. liste noire « blurple » du brief) : le violet est toujours un aplat.
- L'élément qui porte le violet a systématiquement `id="cleveria-signal"` — c'est
  délibéré : dans le produit, c'est cet élément-là (et lui seul) qu'on cible en CSS pour
  l'animer (pulse d'opacité/échelle) quand Cleveria écoute/traite/a livré. Le logo et
  l'état de l'app doivent pouvoir raconter la même chose avec le même nœud SVG.
- Aucun des 4 concepts n'utilise le magenta `#db2777` du brief : je le garde en réserve
  pour l'UI produit (états secondaires), pas dans le logo — cohérent avec la référence
  Linear du brief (« un seul accent violet, utilisé avec parcimonie »). Deux accents dans
  la marque elle-même la ferait passer d'« un point qui s'allume » à un logo bicolore, ce
  qui dilue le geste.

---

## Concept 1 — Direction A : le mot-symbole signal

**Idée** : le mot « Cleveria » en lettrage géométrique, avec le « i » remplacé par un
fût neutre + une **tache violette inclinée et décalée** au-dessus — pas un point rond,
un petit trait/flash qui a une forme propre, détachable du mot pour servir d'icône seule.

### (a) Icône seule — favicon / avatar (40×40)

```svg
<svg viewBox="0 0 40 40" width="40" height="40" xmlns="http://www.w3.org/2000/svg" style="color:#18181b">
  <rect x="17" y="17" width="6" height="17" rx="3" fill="currentColor"/>
  <rect id="cleveria-signal" x="16" y="7" width="14" height="6" rx="3"
        transform="rotate(-18 23 10)" fill="#7c3aed"/>
</svg>
```

### (b) Lockup horizontal — marque + mot

```svg
<svg viewBox="0 0 145 56" width="290" height="112" xmlns="http://www.w3.org/2000/svg" style="color:#18181b">
  <text x="6" y="40" font-family="ui-sans-serif, system-ui, 'Segoe UI', Roboto, sans-serif"
        font-weight="800" font-size="32" letter-spacing="-0.5" fill="currentColor">Clev</text>
  <rect x="84" y="18" width="5" height="22" rx="2.2" fill="currentColor"/>
  <rect id="cleveria-signal" x="84.5" y="9.5" width="11" height="5" rx="2.5"
        transform="rotate(-18 90 12)" fill="#7c3aed"/>
  <text x="91" y="40" font-family="ui-sans-serif, system-ui, 'Segoe UI', Roboto, sans-serif"
        font-weight="800" font-size="32" letter-spacing="-0.5" fill="currentColor">r</text>
  <text x="107.5" y="40" font-family="ui-sans-serif, system-ui, 'Segoe UI', Roboto, sans-serif"
        font-weight="800" font-size="32" letter-spacing="-0.5" fill="currentColor">a</text>
</svg>
```

### Ce que ça raconte

Le point du « i » n'est plus un accessoire de couleur : c'est un signal qui a une forme à
lui (inclinée, décalée à droite du fût — pas centrée, pas un cercle), comme un flash qui
vient de s'allumer au-dessus d'un point d'entrée fixe. C'est exactement la mécanique du
produit : un seul endroit où on pose la demande (le fût, stable), et un signal qui
s'active quand Cleveria se met au travail (la tache, dynamique). Une fois extrait du mot,
ce même fragment devient l'icône d'app et — côté produit — l'indicateur d'état
(`id="cleveria-signal"` pensé pour être animé : pulse doux en boucle pendant qu'il
traite, fixe une fois qu'il a livré).

### Lisibilité / robustesse

- **16px (favicon)** : tient. Deux masses simples et bien contrastées (un rectangle
  vertical, un petit flash incliné) — pas de détail fin qui se perd à cette taille. Le
  seul risque d'exécution : que le flash soit dessiné avec un dégradé ou une ombre portée
  pour « faire joli » — à bannir, l'angle net est ce qui le rend lisible en petit.
- **Mono-couleur** (tampon, gravure, impression N&B) : tient aussi, parce que la
  distinction ne repose pas que sur la couleur — la forme (inclinée, décalée) reste
  identifiable même si le flash devient la même encre que le fût. Un simple point rond
  aurait disparu dans le mot en mono ; celui-ci non.
- **Fond sombre** : `currentColor` bascule le fût et le texte automatiquement via la
  couleur héritée. Le violet `#7c3aed` reste lisible sur clair comme sur foncé sans
  ajustement ; sur un fond très sombre (quasi noir), une variante plus claire `#a78bfa`
  peut être proposée comme token optionnel pour plus de contraste — pas obligatoire, à
  tester à l'usage.

---

## Concept 2 — Direction D : le wordmark seul

**Idée** : aucun symbole séparé à inventer. Le lettrage « Cleveria » impeccable porte
toute la marque, et le point du « i » reste un point — rond, classique, sans forme
particulière — sa seule signature, c'est la couleur. Le favicon se découpe directement
dans le mot (le « i » isolé), sans rien ajouter.

### (a) Icône seule — favicon / avatar (40×40), fragment du « i »

```svg
<svg viewBox="0 0 40 40" width="40" height="40" xmlns="http://www.w3.org/2000/svg" style="color:#18181b">
  <rect x="18" y="18" width="4" height="16" rx="2" fill="currentColor"/>
  <circle id="cleveria-signal" cx="20" cy="11" r="3.6" fill="#7c3aed"/>
</svg>
```

### (b) Lockup — le mot seul (pas de composition icône + texte, juste le mot)

```svg
<svg viewBox="0 0 175 48" width="350" height="96" xmlns="http://www.w3.org/2000/svg" style="color:#18181b">
  <text x="6" y="34" font-family="ui-sans-serif, system-ui, 'Segoe UI', Roboto, sans-serif"
        font-weight="800" font-size="34" letter-spacing="-0.5" fill="currentColor">Cleveria</text>
  <circle id="cleveria-signal" cx="130" cy="6.5" r="3.3" fill="#7c3aed"/>
</svg>
```

### Ce que ça raconte

La confiance qu'on n'a pas besoin d'un pictogramme pour paraître sérieux : un bras droit
ne se présente pas avec un logo-mascotte, il se présente par son nom et prouve le reste
par le travail livré. C'est la direction la plus économe à produire (aucune icône à
inventer en parallèle du mot) et la plus proche de ce que Ben a déjà validé — mais c'est
aussi celle qui a le moins de marge d'erreur : sans forme de secours, chaque défaut de
tracé du lettrage se voit directement.

### Lisibilité / robustesse

- **16px (favicon)** : le point plein sur le fût reste identifiable à cette taille, mais
  c'est la version la plus « nue » des quatre — pas d'autre forme pour compenser si les
  proportions fût/point sont mal calées. À contrôler en priorité une fois la typo
  définitive choisie.
- **Mono-couleur** : le point garde son identité par la taille (nettement plus gros qu'un
  point de « i » standard) et non plus seulement par la couleur — donc ça tient, mais de
  justesse ; c'est la direction la plus dépendante d'un bon calibrage du point.
- **Fond sombre** : même logique que le Concept 1 — `currentColor` pour le lettrage,
  violet fixe pour le point, avec la même option de variante claire `#a78bfa` sur fond
  quasi noir si besoin.

---

## Concept 3 — Direction B : le monogramme convergent

**Idée** : trois arcs concentriques (des fragments de « C », de rayon et d'épaisseur
différents) ouverts sur la droite, qui ne se touchent pas, et un point violet posé à
l'extérieur de l'ouverture, vers lequel les trois arcs semblent tendre sans jamais le
rejoindre. Pas de trait qui relie (ça retomberait dans le node-graph écarté par le
brief) — juste des formes indépendantes qui pointent vers la même issue.

### (a) Icône seule — favicon / app icon (40×40)

```svg
<svg viewBox="0 0 40 40" width="40" height="40" xmlns="http://www.w3.org/2000/svg" style="color:#18181b">
  <path d="M28,6.14 A16,16 0 1,0 28,33.86" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round"/>
  <path d="M26,9.61 A12,12 0 1,0 26,30.39" fill="none" stroke="currentColor"
        stroke-width="3" stroke-linecap="round"/>
  <path d="M24,13.07 A8,8 0 1,0 24,26.93" fill="none" stroke="currentColor"
        stroke-width="4.2" stroke-linecap="round"/>
  <circle id="cleveria-signal" cx="31" cy="20" r="2.4" fill="#7c3aed"/>
</svg>
```

### (b) Lockup horizontal — icône + mot

```svg
<svg viewBox="0 0 233 48" width="466" height="96" xmlns="http://www.w3.org/2000/svg" style="color:#18181b">
  <g transform="translate(4,4)">
    <path d="M28,6.14 A16,16 0 1,0 28,33.86" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round"/>
    <path d="M26,9.61 A12,12 0 1,0 26,30.39" fill="none" stroke="currentColor"
          stroke-width="3" stroke-linecap="round"/>
    <path d="M24,13.07 A8,8 0 1,0 24,26.93" fill="none" stroke="currentColor"
          stroke-width="4.2" stroke-linecap="round"/>
    <circle id="cleveria-signal" cx="31" cy="20" r="2.4" fill="#7c3aed"/>
  </g>
  <g transform="translate(58,0)">
    <text x="6" y="34" font-family="ui-sans-serif, system-ui, 'Segoe UI', Roboto, sans-serif"
          font-weight="800" font-size="34" letter-spacing="-0.5" fill="currentColor">Cleveria</text>
    <circle cx="130" cy="6.5" r="3.3" fill="#7c3aed"/>
  </g>
</svg>
```

### Ce que ça raconte

Trois flux de poids différents (les spécialistes mobilisés en coulisse), qui convergent
vers une seule issue sans jamais se toucher — l'orchestration du produit (agents en
parallèle → un seul livrable) montrée sans la dessiner littéralement, et sans le moindre
node-graph. Le monogramme est aussi, de fait, un fragment de « C » — un rappel discret du
nom sans être un « C » cliché en arc de cercle (ce que Ben avait déjà écarté).

### Lisibilité / robustesse

- **16px (favicon)** : c'est la piste la plus fragile des quatre à cette taille. Trois
  arcs fins + un point isolé, ça reste net à 40px mais risque de se brouiller à 16px (les
  arcs les plus fins peuvent se perdre). À tester en priorité avant de retenir cette
  direction pour un usage favicon réel — c'est exactement le risque que le brief anticipe
  pour B.
- **Mono-couleur** : tient (les épaisseurs de trait restent le repère principal, pas la
  couleur), mais le point de convergence perd sa fonction de « signal » sans le violet —
  il devient un simple point parmi les arcs.
- **Risque à surveiller (déjà signalé par le brief)** : des arcs concentriques peuvent
  glisser vers un cliché adjacent non listé explicitement — icône « wifi »/« signal
  réseau » ou spinner de chargement. Le brief demandait de l'abandonner si l'esquisse
  « ressemble à un hexagone ou un circuit » ; ce n'est pas le cas ici, mais le risque
  wifi/spinner mérite un regard frais avant de trancher (moi qui l'ai dessiné, je suis
  mal placé pour juger si l'œil neuf y verra la même chose).
- **Fond sombre** : arcs en `currentColor`, point fixe `#7c3aed` — même logique que les
  concepts précédents.

---

## Concept 4 — Direction C : le relais

**Idée** : deux formes arrondies (des carrés à coins très ronds, pivotés à 45°) qui se
chevauchent en diagonale — pas une main, pas un objet, un mouvement. La première, plus
petite et neutre, est en bas à gauche ; la seconde, plus grande et violette, la recouvre
en haut à droite, sans dégradé de fusion (la seconde est simplement posée par-dessus, en
aplat) — la bascule du mode Échange (petit, neutre) vers le mode Projet (plus grand,
violet, qui prend le relais) qui structure le produit.

### (a) Icône seule — favicon / app icon (40×40)

```svg
<svg viewBox="0 0 40 40" width="40" height="40" xmlns="http://www.w3.org/2000/svg" style="color:#18181b">
  <rect x="6" y="20" width="14" height="14" rx="5" fill="currentColor"
        transform="rotate(45 13 27)"/>
  <rect id="cleveria-signal" x="18" y="4" width="18" height="18" rx="6.5" fill="#7c3aed"
        transform="rotate(45 27 13)"/>
</svg>
```

### (b) Lockup horizontal — icône + mot

```svg
<svg viewBox="0 0 233 48" width="466" height="96" xmlns="http://www.w3.org/2000/svg" style="color:#18181b">
  <g transform="translate(4,4)">
    <rect x="6" y="20" width="14" height="14" rx="5" fill="currentColor"
          transform="rotate(45 13 27)"/>
    <rect id="cleveria-signal" x="18" y="4" width="18" height="18" rx="6.5" fill="#7c3aed"
          transform="rotate(45 27 13)"/>
  </g>
  <g transform="translate(58,0)">
    <text x="6" y="34" font-family="ui-sans-serif, system-ui, 'Segoe UI', Roboto, sans-serif"
          font-weight="800" font-size="34" letter-spacing="-0.5" fill="currentColor">Cleveria</text>
    <circle cx="130" cy="6.5" r="3.3" fill="#7c3aed"/>
  </g>
</svg>
```

### Ce que ça raconte

Le moment charnière du produit — la bascule entre le bras droit qui répond tout de suite
(petite forme, neutre, discrète) et l'équipe qui prend le relais pour livrer un vrai
projet (grande forme, violette, qui recouvre et prend le dessus) — sans flèche générique
ni mallette. La lecture ne dépend pas de connaître le produit : deux formes qui se
chevauchent racontent déjà un passage, une prise de relais.

### Lisibilité / robustesse

- **16px (favicon)** : tient bien, deux masses simples et bien distinctes par la couleur
  et la taille — c'est une des pistes les plus robustes en petit format des quatre, avec
  le Concept 1.
- **Mono-couleur** : fonctionne par la superposition et la taille (petit dessous, grand
  dessus) plutôt que par la couleur — donc ça tient en une seule encre, mais on perd la
  narration « neutre → violet » qui est la moitié du sens du concept.
- **Risque à surveiller** : deux formes arrondies qui se chevauchent, c'est aussi un
  motif très répandu comme icône d'app générique (beaucoup de startups y sont déjà
  allées). Le lien avec « échange → projet » sauve le concept d'être un simple exercice
  de style, mais c'est la piste la plus proche d'un standard déjà vu — à garder en tête
  si on la retient.
- **Fond sombre** : la forme neutre en `currentColor` s'inverse automatiquement, la forme
  violette reste fixe `#7c3aed` par-dessus, dans les deux cas la superposition reste
  lisible car les deux formes ont des masses différentes (jamais de zone ambiguë où les
  deux couleurs se confondraient).

---

## Résumé des partis pris

- **Un seul accent, jamais deux** : dans les quatre concepts, seul l'élément « signal »
  (le point/la tache/le point de convergence/la forme du dessus) porte le violet en dur ;
  tout le reste est `currentColor`. C'est un choix délibéré, pas un oubli : garder le
  magenta du brief pour l'UI produit, pas pour la marque, pour que le geste du logo reste
  net (référence Linear du brief : un seul accent, avec parcimonie).
- **Un système, pas juste un dessin** : le violet a toujours `id="cleveria-signal"` — la
  même forme qui existe dans le logo doit pouvoir devenir, dans le produit, l'indicateur
  d'état (écoute/traite/a livré). C'est explicite dans les Concepts 1 et 3 (où le point
  EST littéralement un signal), et transposable aux Concepts 2 et 4.
- **Aucun cliché de la liste noire** : pas de cercle-chat, pas d'hexagone, pas de
  node-graph (les arcs du Concept 3 ne se touchent jamais, c'est vérifié dans la
  géométrie), pas de dégradé blurple (zéro dégradé dans les quatre concepts, tout est en
  aplat), pas de sparkle/robot/ampoule/engrenage.
- **Honnêteté sur les risques** : chaque concept a sa fragilité assumée — Concept 1 tient
  bien en petit mais demande un tracé du flash très net ; Concept 2 n'a aucune marge
  d'erreur (rien pour rattraper un mauvais calage) ; Concept 3 est le plus fragile à
  16px et flirte avec le cliché « wifi/spinner » ; Concept 4 est solide visuellement mais
  proche d'un standard déjà vu ailleurs.

### Ma reco

**Concept 1 (Direction A)** en premier choix : c'est celui qui prolonge le plus
directement ce que Ben a déjà validé, et le seul des quatre où la forme du signal porte
une vraie idée de produit (pas juste un point coloré, un geste qui a un sens — le fût
fixe, le flash qui s'active) tout en restant sobre et sans besoin d'inventer une icône
séparée. **Concept 2 (Direction D)** en filet de sécurité si le flash du Concept 1 ne
tient pas assez bien en très petit format une fois testé en vrai — c'est la version la
plus économe et la plus proche de zéro risque d'exécution. Je garderais **Concept 3**
en option si un jour il faut une icône d'app totalement autonome du mot (ex. app mobile
où le nom ne s'affiche pas) — mais seulement après un test réel à 16-32px pour vérifier
qu'il ne tombe pas dans le cliché wifi/spinner que je ne peux pas juger seul depuis un
SVG non rendu. **Concept 4** je le mettrais de côté sauf avis contraire : il est
techniquement le plus solide des quatre en petit format, mais c'est aussi celui qui
ressemble le plus à ce que d'autres produits font déjà.
