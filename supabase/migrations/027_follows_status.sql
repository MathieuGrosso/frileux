-- ============================================
-- Frileux — Social graph (follows) + user statuses
-- ============================================

create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followed_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  constraint no_self_follow check (follower_id <> followed_id)
);

create index if not exists idx_follows_followed on public.follows(followed_id);

alter table public.follows enable row level security;

drop policy if exists "Follows readable by anyone authenticated" on public.follows;
create policy "Follows readable by anyone authenticated"
  on public.follows for select
  using (auth.role() = 'authenticated');

drop policy if exists "Follows insertable by follower" on public.follows;
create policy "Follows insertable by follower"
  on public.follows for insert
  with check (auth.uid() = follower_id);

drop policy if exists "Follows deletable by follower" on public.follows;
create policy "Follows deletable by follower"
  on public.follows for delete
  using (auth.uid() = follower_id);

-- ============================================
-- User status (court, éphémère 24h)
-- ============================================
create table if not exists public.user_statuses (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 40),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

alter table public.user_statuses enable row level security;

drop policy if exists "Statuses readable by anyone authenticated" on public.user_statuses;
create policy "Statuses readable by anyone authenticated"
  on public.user_statuses for select
  using (auth.role() = 'authenticated' and expires_at > now());

drop policy if exists "Users upsert own status" on public.user_statuses;
create policy "Users upsert own status"
  on public.user_statuses for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own status" on public.user_statuses;
create policy "Users update own status"
  on public.user_statuses for update
  using (auth.uid() = user_id);

drop policy if exists "Users delete own status" on public.user_statuses;
create policy "Users delete own status"
  on public.user_statuses for delete
  using (auth.uid() = user_id);
