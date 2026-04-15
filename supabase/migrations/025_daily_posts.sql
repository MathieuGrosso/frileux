-- ============================================
-- Frileux — Daily posts (stories 24h)
-- ============================================

create table if not exists public.daily_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  circle_id uuid references public.circles(id) on delete cascade,
  image_path text not null,
  caption text check (caption is null or char_length(caption) <= 60),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create index if not exists idx_daily_posts_expires on public.daily_posts(expires_at);
create index if not exists idx_daily_posts_user on public.daily_posts(user_id, created_at desc);
create index if not exists idx_daily_posts_circle on public.daily_posts(circle_id, created_at desc);

alter table public.daily_posts enable row level security;

drop policy if exists "Daily posts readable by circle members" on public.daily_posts;
create policy "Daily posts readable by circle members"
  on public.daily_posts for select
  using (
    expires_at > now()
    and (
      user_id = auth.uid()
      or (
        circle_id is not null
        and circle_id in (select circle_id from public.circle_members where user_id = auth.uid())
      )
      or (
        circle_id is null
        and user_id in (
          select cm2.user_id from public.circle_members cm1
          join public.circle_members cm2 on cm1.circle_id = cm2.circle_id
          where cm1.user_id = auth.uid()
        )
      )
    )
  );

drop policy if exists "Users insert own daily posts" on public.daily_posts;
create policy "Users insert own daily posts"
  on public.daily_posts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own daily posts" on public.daily_posts;
create policy "Users delete own daily posts"
  on public.daily_posts for delete
  using (auth.uid() = user_id);

-- ============================================
-- Views seen tracking
-- ============================================
create table if not exists public.daily_post_views (
  post_id uuid not null references public.daily_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.daily_post_views enable row level security;

drop policy if exists "Views readable by self and post owner" on public.daily_post_views;
create policy "Views readable by self and post owner"
  on public.daily_post_views for select
  using (
    user_id = auth.uid()
    or post_id in (select id from public.daily_posts where user_id = auth.uid())
  );

drop policy if exists "Users insert own views" on public.daily_post_views;
create policy "Users insert own views"
  on public.daily_post_views for insert
  with check (auth.uid() = user_id);

-- ============================================
-- Storage bucket
-- ============================================
insert into storage.buckets (id, name, public)
values ('daily-posts', 'daily-posts', true)
on conflict (id) do nothing;

drop policy if exists "Daily posts upload by owner" on storage.objects;
create policy "Daily posts upload by owner"
  on storage.objects for insert
  with check (
    bucket_id = 'daily-posts'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );

drop policy if exists "Daily posts public read" on storage.objects;
create policy "Daily posts public read"
  on storage.objects for select
  using (bucket_id = 'daily-posts');

drop policy if exists "Daily posts delete by owner" on storage.objects;
create policy "Daily posts delete by owner"
  on storage.objects for delete
  using (
    bucket_id = 'daily-posts'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );

-- ============================================
-- Purge expired posts (called from cron edge function)
-- ============================================
create or replace function public.purge_expired_daily_posts()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  delete from public.daily_posts where expires_at <= now();
  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function public.purge_expired_daily_posts() to authenticated;

-- Realtime
alter publication supabase_realtime add table public.daily_posts;
