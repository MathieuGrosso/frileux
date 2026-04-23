-- Réactions qualitatives sur les outfits : fit / color / styling / piece.
-- Pas d'étoiles ni de slider : un user peut cocher 0 à 4 axes par outfit.

create type outfit_reaction_kind as enum ('fit', 'color', 'styling', 'piece');

create table public.outfit_reactions (
  outfit_id uuid not null references public.outfits(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind outfit_reaction_kind not null,
  created_at timestamptz not null default now(),
  primary key (outfit_id, user_id, kind)
);

alter table public.outfit_reactions enable row level security;

-- Lecture : visible pour tout outfit que l'user peut déjà voir (public ou sien).
create policy outfit_reactions_select on public.outfit_reactions
  for select
  using (
    exists (
      select 1
      from public.outfits o
      where o.id = outfit_reactions.outfit_id
        and (o.is_public = true or o.user_id = auth.uid())
    )
  );

-- Écriture : propres réactions uniquement.
create policy outfit_reactions_insert on public.outfit_reactions
  for insert
  with check (user_id = auth.uid());

create policy outfit_reactions_delete on public.outfit_reactions
  for delete
  using (user_id = auth.uid());

create index idx_outfit_reactions_outfit_kind
  on public.outfit_reactions(outfit_id, kind);

alter publication supabase_realtime add table public.outfit_reactions;
