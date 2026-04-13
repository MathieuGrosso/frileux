-- =====================================================================
-- Outfit "notes" (commentaires courts, éditoriaux) sous une tenue.
-- =====================================================================

create table public.outfit_comments (
  id uuid primary key default gen_random_uuid(),
  outfit_id uuid not null references public.outfits(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(body) > 0 and length(body) <= 200),
  created_at timestamptz not null default now()
);

create index idx_outfit_comments_outfit on public.outfit_comments(outfit_id, created_at);

alter table public.outfit_comments enable row level security;

-- Read: membre d'un cercle qui contient l'auteur de l'outfit.
create policy "Circle members can read outfit notes"
  on public.outfit_comments for select
  using (
    exists (
      select 1
      from public.outfits o
      join public.circle_members cm_author on cm_author.user_id = o.user_id
      join public.circle_members cm_me on cm_me.circle_id = cm_author.circle_id
      where o.id = outfit_comments.outfit_id
        and cm_me.user_id = auth.uid()
    )
  );

-- Insert: même règle + user_id = auth.uid().
create policy "Circle members can write outfit notes"
  on public.outfit_comments for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.outfits o
      join public.circle_members cm_author on cm_author.user_id = o.user_id
      join public.circle_members cm_me on cm_me.circle_id = cm_author.circle_id
      where o.id = outfit_comments.outfit_id
        and cm_me.user_id = auth.uid()
    )
  );

-- Delete: auteur uniquement.
create policy "Authors can delete their notes"
  on public.outfit_comments for delete
  using (auth.uid() = user_id);
