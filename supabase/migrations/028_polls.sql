-- ============================================
-- Frileux — Sondages outfit (A vs B vs ...)
-- ============================================

create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  question text not null check (char_length(question) between 1 and 160),
  created_at timestamptz not null default now(),
  closes_at timestamptz not null default (now() + interval '24 hours')
);

create index if not exists idx_polls_circle_created on public.polls(circle_id, created_at desc);

create table if not exists public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  label text check (label is null or char_length(label) <= 60),
  image_path text,
  position smallint not null default 0
);

create index if not exists idx_poll_options_poll on public.poll_options(poll_id, position);

create table if not exists public.poll_votes (
  poll_id uuid not null references public.polls(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  option_id uuid not null references public.poll_options(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

create index if not exists idx_poll_votes_option on public.poll_votes(option_id);

alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;

-- polls visible to circle members
drop policy if exists "Polls readable by circle members" on public.polls;
create policy "Polls readable by circle members"
  on public.polls for select
  using (
    circle_id in (select circle_id from public.circle_members where user_id = auth.uid())
  );

drop policy if exists "Polls insertable by circle members" on public.polls;
create policy "Polls insertable by circle members"
  on public.polls for insert
  with check (
    auth.uid() = author_id
    and circle_id in (select circle_id from public.circle_members where user_id = auth.uid())
  );

drop policy if exists "Polls deletable by author" on public.polls;
create policy "Polls deletable by author"
  on public.polls for delete
  using (auth.uid() = author_id);

-- options follow polls
drop policy if exists "Poll options readable by circle members" on public.poll_options;
create policy "Poll options readable by circle members"
  on public.poll_options for select
  using (
    poll_id in (
      select id from public.polls
      where circle_id in (select circle_id from public.circle_members where user_id = auth.uid())
    )
  );

drop policy if exists "Poll options insertable by poll author" on public.poll_options;
create policy "Poll options insertable by poll author"
  on public.poll_options for insert
  with check (
    poll_id in (select id from public.polls where author_id = auth.uid())
  );

-- votes
drop policy if exists "Poll votes readable by circle members" on public.poll_votes;
create policy "Poll votes readable by circle members"
  on public.poll_votes for select
  using (
    poll_id in (
      select id from public.polls
      where circle_id in (select circle_id from public.circle_members where user_id = auth.uid())
    )
  );

drop policy if exists "Poll votes insertable by circle members" on public.poll_votes;
create policy "Poll votes insertable by circle members"
  on public.poll_votes for insert
  with check (
    auth.uid() = user_id
    and poll_id in (
      select id from public.polls
      where circle_id in (select circle_id from public.circle_members where user_id = auth.uid())
    )
  );

drop policy if exists "Poll votes updatable by self" on public.poll_votes;
create policy "Poll votes updatable by self"
  on public.poll_votes for update
  using (auth.uid() = user_id);

drop policy if exists "Poll votes deletable by self" on public.poll_votes;
create policy "Poll votes deletable by self"
  on public.poll_votes for delete
  using (auth.uid() = user_id);

-- storage bucket for poll option images
insert into storage.buckets (id, name, public)
values ('polls', 'polls', true)
on conflict (id) do nothing;

drop policy if exists "Poll upload by owner" on storage.objects;
create policy "Poll upload by owner"
  on storage.objects for insert
  with check (
    bucket_id = 'polls'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );

drop policy if exists "Poll read public" on storage.objects;
create policy "Poll read public"
  on storage.objects for select
  using (bucket_id = 'polls');

drop policy if exists "Poll delete by owner" on storage.objects;
create policy "Poll delete by owner"
  on storage.objects for delete
  using (
    bucket_id = 'polls'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );

alter publication supabase_realtime add table public.polls;
alter publication supabase_realtime add table public.poll_votes;
