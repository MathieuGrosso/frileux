-- ============================================
-- Frileux — Direct messages (1:1)
-- ============================================

create table if not exists public.dm_threads (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  last_message_preview text,
  constraint dm_threads_canonical check (user_a < user_b),
  constraint dm_threads_unique unique (user_a, user_b)
);

create index if not exists idx_dm_threads_user_a on public.dm_threads(user_a, last_message_at desc);
create index if not exists idx_dm_threads_user_b on public.dm_threads(user_b, last_message_at desc);

alter table public.dm_threads enable row level security;

drop policy if exists "DM threads visible to participants" on public.dm_threads;
create policy "DM threads visible to participants"
  on public.dm_threads for select
  using (auth.uid() = user_a or auth.uid() = user_b);

drop policy if exists "DM thread insertable by participant" on public.dm_threads;
create policy "DM thread insertable by participant"
  on public.dm_threads for insert
  with check (auth.uid() = user_a or auth.uid() = user_b);

drop policy if exists "DM thread updatable by participant" on public.dm_threads;
create policy "DM thread updatable by participant"
  on public.dm_threads for update
  using (auth.uid() = user_a or auth.uid() = user_b);

-- ============================================
create table if not exists public.dm_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.dm_threads(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists idx_dm_messages_thread on public.dm_messages(thread_id, created_at desc);

alter table public.dm_messages enable row level security;

drop policy if exists "DM messages readable by thread participants" on public.dm_messages;
create policy "DM messages readable by thread participants"
  on public.dm_messages for select
  using (
    exists (
      select 1 from public.dm_threads t
      where t.id = thread_id
        and (auth.uid() = t.user_a or auth.uid() = t.user_b)
    )
  );

drop policy if exists "DM messages insertable by sender" on public.dm_messages;
create policy "DM messages insertable by sender"
  on public.dm_messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.dm_threads t
      where t.id = thread_id
        and (auth.uid() = t.user_a or auth.uid() = t.user_b)
    )
  );

drop policy if exists "DM messages deletable by sender" on public.dm_messages;
create policy "DM messages deletable by sender"
  on public.dm_messages for delete
  using (auth.uid() = sender_id);

drop policy if exists "DM messages updatable for read" on public.dm_messages;
create policy "DM messages updatable for read"
  on public.dm_messages for update
  using (
    exists (
      select 1 from public.dm_threads t
      where t.id = thread_id
        and (auth.uid() = t.user_a or auth.uid() = t.user_b)
    )
  );

-- ============================================
-- Trigger: bump last_message_at / preview
-- ============================================
create or replace function public.dm_bump_thread()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.dm_threads
    set last_message_at = new.created_at,
        last_message_preview = substring(new.body from 1 for 120)
    where id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists dm_bump_thread_trigger on public.dm_messages;
create trigger dm_bump_thread_trigger
  after insert on public.dm_messages
  for each row execute procedure public.dm_bump_thread();

-- ============================================
-- RPC: open_dm_thread(other_user)
-- ============================================
create or replace function public.open_dm_thread(other_user_id uuid)
returns public.dm_threads
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  a uuid;
  b uuid;
  t public.dm_threads;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if other_user_id = uid then
    raise exception 'cannot DM self' using errcode = '22023';
  end if;

  if uid < other_user_id then a := uid; b := other_user_id;
  else a := other_user_id; b := uid;
  end if;

  select * into t from public.dm_threads where user_a = a and user_b = b;
  if found then
    return t;
  end if;

  insert into public.dm_threads (user_a, user_b) values (a, b)
    returning * into t;
  return t;
end
$$;

revoke all on function public.open_dm_thread(uuid) from public;
grant execute on function public.open_dm_thread(uuid) to authenticated;

-- Realtime
alter publication supabase_realtime add table public.dm_messages;
alter publication supabase_realtime add table public.dm_threads;
