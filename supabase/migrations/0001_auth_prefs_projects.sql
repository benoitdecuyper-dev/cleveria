-- Cleveria — V2 : auth (Google OAuth via Supabase) + chef de projet personnalisé + persistance.
-- ⚠️ NON APPLIQUÉ : schéma de CADRAGE. À exécuter quand le projet Supabase « Cleveria » existera
--    (cf. blocage quota gratuit : 2 projets max, déjà pris par Sporae + Wikifluence).
-- Réf : docs/06-auth-cdp-personnalise.md

-- 1. PROFILS & PRÉFÉRENCES (1 ligne par utilisateur) -------------------------------
-- `prefs` = les 4 familles de préférences injectées dans le system prompt du chef de projet.
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  prefs        jsonb not null default '{
    "profil":   {"org": null, "secteur": null, "role": null, "objectifs": null},
    "style":    {"tutoiement": true, "niveau_detail": "standard", "langue": "fr", "format_livrables": "markdown"},
    "delivery": {"hebergeur": "Render", "stack": null, "contraintes": []}
  }'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 2. PROJETS (= mémoire des projets passés du chef de projet) -----------------------
create table if not exists public.projects (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text not null default 'Projet sans titre',
  brief      text,          -- échange de cadrage compilé
  note       text,          -- note de cadrage validée
  status     text not null default 'cadrage',  -- cadrage | lance | termine | archive
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_user_idx on public.projects (user_id, created_at desc);

-- 3. RUNS (persistance de l'orchestration ; aujourd'hui en mémoire dans runStore.ts) -
create table if not exists public.runs (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  plan       jsonb,         -- { summary, steps[] }
  steps      jsonb,         -- état des étapes (statuts + livrables)
  synthesis  text,
  status     text not null default 'planning',  -- planning | running | done | error
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists runs_user_idx on public.runs (user_id, created_at desc);

-- 4. RLS — chacun ne voit QUE ses données (multi-tenant) ---------------------------
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.runs     enable row level security;

create policy "profiles self" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());
create policy "projects own" on public.projects
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "runs own" on public.runs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 5. Création auto du profil à l'inscription (Google renseigne full_name) -----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 6. updated_at automatique ---------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();
create trigger runs_touch before update on public.runs
  for each row execute function public.touch_updated_at();
