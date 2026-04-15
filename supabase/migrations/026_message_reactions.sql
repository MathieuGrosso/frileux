-- ============================================
-- Frileux — Message reactions (set d'icônes fermé)
-- ============================================

create table if not exists public.message_reactions (
  message_id uuid not null references public.circle_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji_key text not null check (emoji_key in ('fire','eye','snow','heart','spark')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji_key)
);

create index if not exists idx_message_reactions_msg on public.message_reactions(message_id);

alter table public.message_reactions enable row level security;

drop policy if exists "Reactions readable by circle members" on public.message_reactions;
create policy "Reactions readable by circle members"
  on public.message_reactions for select
  using (
    message_id in (
      select m.id from public.circle_messages m
      where m.circle_id in (
        select circle_id from public.circle_members where user_id = auth.uid()
      )
    )
  );

drop policy if exists "Reactions insertable by circle members" on public.message_reactions;
create policy "Reactions insertable by circle members"
  on public.message_reactions for insert
  with check (
    auth.uid() = user_id
    and message_id in (
      select m.id from public.circle_messages m
      where m.circle_id in (
        select circle_id from public.circle_members where user_id = auth.uid()
      )
    )
  );

drop policy if exists "Reactions deletable by self" on public.message_reactions;
create policy "Reactions deletable by self"
  on public.message_reactions for delete
  using (auth.uid() = user_id);

alter table public.message_reactions replica identity full;
alter publication supabase_realtime add table public.message_reactions;
