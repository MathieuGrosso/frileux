-- ============================================
-- 023 · Taste profile columns on profiles
-- ============================================
-- Contexte : l'app lit/écrit déjà ces colonnes (voir lib/profile.ts, onboarding/*),
-- mais aucune migration ne les déclare. Bug silencieux : les UPDATE passent,
-- les SELECT renvoient undefined pour ces champs. On formalise ici.
-- RLS déjà active sur profiles (migration 001).

alter table public.profiles
  add column if not exists gender_presentation text,
  add column if not exists style_universes text[] not null default '{}',
  add column if not exists favorite_brands text[] not null default '{}',
  add column if not exists avoid_tags text[] not null default '{}',
  add column if not exists fit_preference text,
  add column if not exists build text,
  add column if not exists height_cm integer,
  add column if not exists shoe_size_eu numeric(4,1);

-- Contraintes légères (sans CHECK strict pour rester permissif côté app)
comment on column public.profiles.gender_presentation is
  'Expression stylistique choisie à l''onboarding (ex: masculine, feminine, fluide).';
comment on column public.profiles.style_universes is
  'Univers stylistiques préférés (tags libres : minimal, workwear, techwear...).';
comment on column public.profiles.favorite_brands is
  'Liste de marques favorites (noms libres, pondère les suggestions IA).';
comment on column public.profiles.avoid_tags is
  'Choses à éviter systématiquement dans les propositions.';
comment on column public.profiles.fit_preference is
  'Coupe préférée (slim, regular, oversize, fluide).';
comment on column public.profiles.build is
  'Morphologie auto-déclarée (fin, athlétique, rond...).';
comment on column public.profiles.height_cm is
  'Taille en cm (optionnel, utilisé pour les proportions suggérées).';
comment on column public.profiles.shoe_size_eu is
  'Pointure EU (optionnel, préparation future pour recos chaussures).';
