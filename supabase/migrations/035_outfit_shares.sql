-- ============================================
-- Frileux — outfit_shares : scoper les tenues par cercle
-- ============================================
-- Avant : toute tenue d'un membre d'un cercle était visible par les autres
-- membres via RLS "shared circle". Avec multi-cercles (privés + publics),
-- c'est une fuite. Dorénavant une tenue est explicitement partagée à N
-- cercles choisis à la publication.

create table if not exists public.outfit_shares (
  outfit_id uuid not null references public.outfits(id) on delete cascade,
  circle_id uuid not null references public.circles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (outfit_id, circle_id)
);

create index if not exists idx_outfit_shares_circle
  on public.outfit_shares(circle_id, created_at desc);

create index if not exists idx_outfit_shares_outfit
  on public.outfit_shares(outfit_id);

alter table public.outfit_shares enable row level security;

-- Un user peut inserer/supprimer les shares de ses propres tenues, uniquement
-- vers des cercles dont il est membre.
drop policy if exists "Users can share own outfits to their circles" on public.outfit_shares;
create policy "Users can share own outfits to their circles"
  on public.outfit_shares for insert
  with check (
    exists (
      select 1 from public.outfits o
      where o.id = outfit_id and o.user_id = auth.uid()
    )
    and circle_id in (select public.user_circle_ids(auth.uid()))
  );

drop policy if exists "Users can unshare own outfits" on public.outfit_shares;
create policy "Users can unshare own outfits"
  on public.outfit_shares for delete
  using (
    exists (
      select 1 from public.outfits o
      where o.id = outfit_id and o.user_id = auth.uid()
    )
  );

-- Un membre d'un cercle peut voir les shares de ce cercle.
drop policy if exists "Circle members can view shares of their circles" on public.outfit_shares;
create policy "Circle members can view shares of their circles"
  on public.outfit_shares for select
  using (circle_id in (select public.user_circle_ids(auth.uid())));

-- ============================================
-- Backfill : reconduire le comportement ancien (tenues visibles dans tous les
-- cercles du poster) pour toutes les tenues existantes au moment de la
-- migration. Sans ça, les feeds existants seraient vides après déploiement.
-- ============================================
insert into public.outfit_shares (outfit_id, circle_id)
select o.id, cm.circle_id
from public.outfits o
join public.circle_members cm on cm.user_id = o.user_id
on conflict (outfit_id, circle_id) do nothing;

-- ============================================
-- Remplacer l'ancienne RLS "Circle members can view each other's outfits"
-- ============================================
-- Avant : toute tenue d'un co-membre était visible. Maintenant : une tenue
-- est visible uniquement si (a) je suis l'auteur, ou (b) elle est shared
-- dans un cercle dont je suis membre.
drop policy if exists "Circle members can view each other's outfits" on public.outfits;
create policy "Circle members can view each other's outfits"
  on public.outfits for select
  using (
    exists (
      select 1
      from public.outfit_shares s
      where s.outfit_id = outfits.id
        and s.circle_id in (select public.user_circle_ids(auth.uid()))
    )
  );

-- La policy "Users can view their own outfits" (création 001) reste en place,
-- donc l'auteur continue à voir toutes ses tenues dans son historique perso.

-- ============================================
-- Bump last_activity_at au partage
-- ============================================
create or replace function public.bump_circle_activity_from_share()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.circles
    set last_activity_at = now()
    where id = new.circle_id;
  return new;
end;
$$;

drop trigger if exists bump_circle_activity_on_share on public.outfit_shares;
create trigger bump_circle_activity_on_share
  after insert on public.outfit_shares
  for each row execute procedure public.bump_circle_activity_from_share();
