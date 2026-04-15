-- ============================================
-- Frileux — Simplification sociale : cercles → feed global
-- ============================================
-- Le système multi-cercles (création, membres, chat, stories, polls,
-- partages explicites) est supprimé au profit d'un modèle plus simple :
--   - feed global public (outfits.is_public)
--   - DMs 1:1 (déjà en place depuis 024)
-- Les DMs servent de couche intime. Le feed de couche publique.
-- Tout l'entre-deux disparaît.
-- ============================================

-- 1. Nouvelle colonne : visibilité publique d'une tenue
alter table public.outfits
  add column if not exists is_public boolean not null default false;

create index if not exists idx_outfits_public_created
  on public.outfits(is_public, created_at desc)
  where is_public = true;

-- 2. Préférence : poster par défaut sur le feed
alter table public.profiles
  add column if not exists default_post_public boolean not null default false;

-- 3. Backfill : tenues partagées dans un cercle public → is_public
-- (uniquement si les tables existent encore au moment de la migration)
do $$
begin
  if to_regclass('public.outfit_shares') is not null
     and to_regclass('public.circles') is not null then
    update public.outfits o
       set is_public = true
      from public.outfit_shares s
      join public.circles c on c.id = s.circle_id
     where s.outfit_id = o.id
       and c.visibility = 'public';
  end if;
end $$;

-- 4. Réécriture RLS outfits : auteur OU public
drop policy if exists "Users can view their own outfits" on public.outfits;
drop policy if exists "Circle members can view each other's outfits" on public.outfits;

create policy "Outfits visible to author or if public"
  on public.outfits for select
  using (
    user_id = auth.uid()
    or is_public = true
  );

-- 5. Réécriture RLS profiles : tout user authentifié peut lire
-- (seul display_name + avatar sont exposés via les queries client ;
-- la RLS ne restreint pas colonne par colonne — on garde simple)
drop policy if exists "Profiles are viewable by authenticated users" on public.profiles;
drop policy if exists "Circle members can view each other's profiles" on public.profiles;
drop policy if exists "Users can view their own profile" on public.profiles;

create policy "Profiles readable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

-- 5b. Réécriture RLS outfit_comments : lisible/publiable par tout user sur une
-- tenue publique ; l'auteur de la tenue voit aussi ses propres commentaires.
drop policy if exists "Circle members can read outfit notes" on public.outfit_comments;
drop policy if exists "Circle members can write outfit notes" on public.outfit_comments;

create policy "Notes readable on public outfits or own"
  on public.outfit_comments for select
  using (
    exists (
      select 1 from public.outfits o
      where o.id = outfit_comments.outfit_id
        and (o.is_public = true or o.user_id = auth.uid())
    )
  );

create policy "Notes writable on public outfits"
  on public.outfit_comments for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.outfits o
      where o.id = outfit_comments.outfit_id
        and (o.is_public = true or o.user_id = auth.uid())
    )
  );

-- 6. DROP de tout le système cercle (ordre importe peu avec CASCADE)
drop table if exists public.poll_votes cascade;
drop table if exists public.poll_options cascade;
drop table if exists public.polls cascade;
drop table if exists public.daily_post_views cascade;
drop table if exists public.daily_posts cascade;
drop table if exists public.message_reactions cascade;
drop table if exists public.circle_messages cascade;
drop table if exists public.outfit_shares cascade;
drop table if exists public.circle_members cascade;
drop table if exists public.circles cascade;

-- 7. Nettoyage des fonctions/RPC obsolètes
drop function if exists public.user_circle_ids(uuid) cascade;
drop function if exists public.join_circle_by_code(text) cascade;
drop function if exists public.list_public_circles() cascade;
drop function if exists public.join_public_circle(uuid) cascade;
drop function if exists public.delete_circle(uuid) cascade;
drop function if exists public.bump_circle_activity_from_share() cascade;
drop function if exists public.bump_circle_activity_from_message() cascade;
