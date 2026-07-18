# MODÈLE FONCTIONNEL — <projet>

_Tenu par le product-owner · relu au cadrage de toute refonte · Date : <AAAA-MM-JJ>_

> **À quoi ça sert.** Un défaut d'ABSENCE (un workflow attendu qui n'existe pas — ex. « il n'y a
> pas de création de client ») n'est visible par aucune gate : le diff ne le contient pas, aucun
> critère de ticket ne tombe. Il ne devient observable que par comparaison à ce référentiel de ce
> qui DOIT exister. **Une cellule non statuée d'une entité touchée par un plan = plan invalide.**

## Matrice entités × cycle de vie
Statuts admis par cellule : `EXISTE(<où : écran/route>)` · `ABSENT-VOULU(<n° ticket>)` ·
`EXCLU(<décision, datée>)` — jamais de cellule vide.

| Entité | Créer | Consulter | Modifier | Archiver/Supprimer | Lister/Rechercher |
|---|---|---|---|---|---|
| <entité 1> | … | … | … | … | … |
| <entité 2> | … | … | … | … | … |

## Entrées / sorties par parcours
| Parcours | Points d'entrée (d'où on y arrive) | Sorties (où on va après) |
|---|---|---|
| <parcours 1> | … | … |
