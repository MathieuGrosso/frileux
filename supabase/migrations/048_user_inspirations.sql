-- 048_user_inspirations.sql
-- L'ŒIL : pièces / adresses / planches que l'utilisateur retient hors garde-robe.
-- Nourrit derived_prefs dans suggest-outfit (lib/profile.ts). RLS strict per-user.
-- Storage : réutilise le bucket wardrobe existant, path {user_id}/eye/*.

create type public.inspiration_kind as enum ('piece', 'shop', 'lookbook');

create table if not exists public.user_inspirations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind public.inspiration_kind not null default 'piece',
  image_url text,
  external_url text,
  title text,
  site_name text,
  note text,
  extracted_description text,
  extracted_tags text[] not null default '{}'::text[],
  extracted_color text,
  extracted_material text,
  approved boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_inspirations_has_content
    check (
      image_url is not null
      or external_url is not null
      or extracted_description is not null
      or note is not null
    )
);

create index if not exists user_inspirations_user_created_idx
  on public.user_inspirations(user_id, created_at desc);

create index if not exists user_inspirations_user_approved_recent_idx
  on public.user_inspirations(user_id, approved, created_at desc)
  where approved = true;

alter table public.user_inspirations enable row level security;

create policy "read own inspirations" on public.user_inspirations
  for select using (auth.uid() = user_id);

create policy "insert own inspirations" on public.user_inspirations
  for insert with check (auth.uid() = user_id);

create policy "update own inspirations" on public.user_inspirations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "delete own inspirations" on public.user_inspirations
  for delete using (auth.uid() = user_id);

create or replace function public.touch_user_inspirations_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end
$$;

create trigger user_inspirations_touch
  before update on public.user_inspirations
  for each row execute function public.touch_user_inspirations_updated_at();

comment on table public.user_inspirations is
  'L''ŒIL — pièces / adresses / planches épinglées par l''utilisateur (image + url + description IA). Alimente derived_prefs dans suggest-outfit.';
comment on column public.user_inspirations.kind is
  'Type éditorial : piece (pièce vêtement), shop (adresse / boutique), lookbook (planche éditoriale).';
comment on column public.user_inspirations.image_url is
  'Chemin storage (bucket wardrobe, path {user_id}/eye/...) ou URL externe og:image.';
comment on column public.user_inspirations.approved is
  'false = analyse IA non concluante (non-vêtement détecté, description vide). Exclu de derived_prefs.';
