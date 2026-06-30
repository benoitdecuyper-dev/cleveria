# 06 — Auth + chef de projet personnalisé (cadrage V2)

> **Statut : CADRÉ, pas branché.** On conçoit le modèle maintenant ; la vraie auth s'active
> quand le blocage Supabase est levé (cf. §5). Décidé avec Ben le 2026-06-29.

## Objectif

Passer Cleveria de « sans compte, tout en mémoire » à un **SaaS multi-tenant** : chaque personne
se connecte et retrouve **son** chef de projet, qui **la connaît** (profil, style, historique,
préférences de delivery). Les projets/runs deviennent **privés et persistants** par utilisateur.

## 1. Authentification — Google / OAuth (via Supabase Auth)

- Fournisseur : **Google OAuth**, géré par **Supabase Auth** (cohérent avec le parc).
- Connexion en 1 clic, pas de mot de passe à gérer côté Cleveria.
- Sessions via cookies (`@supabase/ssr`), lues côté serveur (les routes API sont déjà `runtime=nodejs`).
- Pages : `/login` (bouton « Continuer avec Google ») + `middleware.ts` qui protège
  `/voice`, `/brief`, `/run/*` → redirige vers `/login` si pas de session.
- 1er login → un **profil** est créé automatiquement (trigger SQL `handle_new_user`), puis un court
  **onboarding** propose de remplir les prefs (toutes facultatives, valeurs par défaut sinon).

## 2. Modèle de données

Voir `supabase/migrations/0001_auth_prefs_projects.sql`. Trois tables, toutes en **RLS**
(`user_id = auth.uid()`) → isolation stricte par utilisateur.

| Table | Rôle |
|---|---|
| `profiles` | 1 ligne/utilisateur. `prefs jsonb` = les 4 familles de préférences. |
| `projects` | 1 ligne/projet (brief + note de cadrage). = **mémoire des projets passés**. |
| `runs` | persistance de l'orchestration (plan, étapes, synthèse) — remplace le `runStore` en mémoire. |

## 3. Les « prefs » du chef de projet dédié (les 4, validées)

Stockées dans `profiles.prefs` :

```jsonc
{
  "profil":   { "org": "…", "secteur": "…", "role": "…", "objectifs": "…" }, // qui es-tu
  "style":    { "tutoiement": true, "niveau_detail": "standard|synthetique|detaille",
                "langue": "fr", "format_livrables": "markdown" },             // ton & format
  "delivery": { "hebergeur": "Render", "stack": "…", "contraintes": ["RGPD", "…"] } // delivery
}
```

+ **Mémoire des projets passés** : dérivée de la table `projects` (pas un champ de prefs) — on
injecte un **digest des N derniers projets** (titre + 1 ligne de la note) au démarrage d'un échange.

### Injection dans le CDP (le seul point de couplage runtime)

Aujourd'hui, `apps/web/app/api/brief/route.ts` construit :

```ts
system: `${chef.prompt}\n\n${V0_CDP_INSTRUCTIONS}`
```

V2 → on intercale un **bloc préférences** entre les deux :

```ts
system: `${chef.prompt}\n\n${prefsBlock(profile.prefs, recentProjects)}\n\n${V0_CDP_INSTRUCTIONS}`
```

`prefsBlock()` (à créer dans `apps/web/lib/prefs.ts`) formate les prefs + le digest en quelques
lignes de consignes, p. ex. :

```
## Ton interlocuteur (mémorise et applique sans le redemander)
- Profil : {role} chez {org} ({secteur}). Objectifs : {objectifs}.
- Style attendu : {tutoiement→tutoie}, niveau {niveau_detail}, livrables en {format_livrables}.
- Delivery par défaut : héberge sur {hebergeur}, stack {stack}, contraintes {contraintes}.
## Projets précédents de cette personne (pour continuité, ne repars pas de zéro)
- « {titre} » : {1 ligne de la note}
```

Même bloc réutilisable côté `/api/plan` et orchestrateur si on veut que la delivery respecte aussi
les contraintes (ex. héberger sur Render par défaut).

## 4. Impacts sur le code existant (quand on branche)

- `runStore.ts` (Map en mémoire) → adaptateur Supabase : `createRun/getRun/emit` persistent dans
  `runs`. Le SSE peut rester (lecture depuis la base) ou passer à **Supabase Realtime**.
- `/api/run` et `/api/brief` : récupèrent `user_id` depuis la session, écrivent `projects`/`runs`.
- Nouveau : `/api/profile` (GET/PUT prefs), pages `/login`, `/account` (éditer ses prefs),
  `/projects` (historique).
- `lib/prefs.ts` : type `UserPrefs` + `prefsBlock()`.

## 5. Pré-requis bloquant (à régler avant de brancher)

⚠️ **Quota Supabase gratuit = 2 projets actifs**, déjà pris par **Sporae** et **Wikifluence**.
Un 3ᵉ projet « Cleveria » est **impossible** sans :
- soit **passer l'org Supabase en payant** (lève la limite — coût mensuel), 
- soit **libérer un slot** (pause/migration de Sporae ou Wikifluence).

Décision **reportée** par Ben (option « cadrer maintenant, brancher plus tard »).

## 6. Étapes de branchement (le jour J)

1. Régler le slot/budget Supabase (§5) → créer le projet Supabase **Cleveria**.
2. Console Google Cloud : créer un **OAuth Client** → renseigner le provider Google dans Supabase Auth.
3. Appliquer `supabase/migrations/0001_auth_prefs_projects.sql`.
4. `npm i @supabase/ssr @supabase/supabase-js` → client serveur + `middleware.ts` + `/login`.
5. Brancher `prefsBlock()` dans `/api/brief` (et `/api/plan`).
6. Migrer `runStore` → persistance `runs`/`projects` + page `/projects` (historique).
7. Variables d'env Render : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` (sync:false). Convention parc : secrets uniquement en env Render.
