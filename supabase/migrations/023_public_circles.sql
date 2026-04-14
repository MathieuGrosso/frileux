-- ============================================
-- Frileux — Public circles + discovery
-- ============================================
-- Extend circles with visibility, slug, description, denormalised counters,
-- last_activity_at, accent_hue for editorial tint. Add RLS + RPC for public
-- discovery and joining without an invite code.

alter table public.circles
  add column if not exists visibility text not null default 'private'
    check (visibility in ('private', 'public')),
  add column if not exists slug text unique,
  add column if not exists description text check (description is null or char_length(description) <= 280),
  add column if not exists accent_hue smallint check (accent_hue is null or (accent_hue between 0 and 359)),
  add column if not exists member_count int not null default 1,
  add column if not exists last_activity_at timestamptz not null default now(),
  add column if not exists is_featured boolean not null default false;

create index if not exists idx_circles_visibility_activity
  on public.circles(visibility, last_activity_at desc)
  where visibility = 'public';

create index if not exists idx_circles_slug on public.circles(slug);

-- ============================================
-- Backfill member_count for existing circles
-- ============================================
update public.circles c
set member_count = coalesce((select count(*) from public.circle_members m where m.circle_id = c.id), 0);

-- ============================================
-- Maintain member_count via trigger
-- ============================================
create or replace function public.circle_members_count_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.circles
      set member_count = member_count + 1,
          last_activity_at = now()
      where id = new.circle_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.circles
      set member_count = greatest(member_count - 1, 0)
      where id = old.circle_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists circle_members_count_ins on public.circle_members;
drop trigger if exists circle_members_count_del on public.circle_members;

create trigger circle_members_count_ins
  after insert on public.circle_members
  for each row execute procedure public.circle_members_count_sync();

create trigger circle_members_count_del
  after delete on public.circle_members
  for each row execute procedure public.circle_members_count_sync();

-- ============================================
-- Bump last_activity_at on messages / outfits tied to a circle
-- ============================================
create or replace function public.bump_circle_activity_from_message()
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

drop trigger if exists bump_circle_activity_on_message on public.circle_messages;
create trigger bump_circle_activity_on_message
  after insert on public.circle_messages
  for each row execute procedure public.bump_circle_activity_from_message();

-- When a user posts an outfit, bump activity on all circles they belong to
-- so public circles bubble up based on their members' engagement.
create or replace function public.bump_circle_activity_from_outfit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.circles c
    set last_activity_at = now()
    where c.id in (
      select circle_id from public.circle_members where user_id = new.user_id
    );
  return new;
end;
$$;

drop trigger if exists bump_circle_activity_on_outfit on public.outfits;
create trigger bump_circle_activity_on_outfit
  after insert on public.outfits
  for each row execute procedure public.bump_circle_activity_from_outfit();

-- ============================================
-- RLS additions
-- ============================================
-- Allow authenticated users to read public circles even if they aren't members
drop policy if exists "Public circles are visible to all authenticated" on public.circles;
create policy "Public circles are visible to all authenticated"
  on public.circles for select
  using (visibility = 'public' and auth.role() = 'authenticated');

-- Allow authenticated users to read members of public circles (for preview)
drop policy if exists "Public circle members are readable" on public.circle_members;
create policy "Public circle members are readable"
  on public.circle_members for select
  using (
    circle_id in (select id from public.circles where visibility = 'public')
  );

-- Allow authenticated users to view outfits of public circle members (preview grid)
drop policy if exists "Public circle outfits are readable" on public.outfits;
create policy "Public circle outfits are readable"
  on public.outfits for select
  using (
    user_id in (
      select cm.user_id from public.circle_members cm
      join public.circles c on c.id = cm.circle_id
      where c.visibility = 'public'
    )
  );

-- Creator can update their circle (visibility, description, etc.)
drop policy if exists "Creator can update circle" on public.circles;
create policy "Creator can update circle"
  on public.circles for update
  using (auth.uid() = created_by);

-- ============================================
-- RPC: join_public_circle
-- ============================================
create or replace function public.join_public_circle(target_circle_id uuid)
returns public.circles
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.circles;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into c from public.circles where id = target_circle_id;
  if not found then
    return null;
  end if;

  if c.visibility <> 'public' then
    raise exception 'circle is not public' using errcode = '42501';
  end if;

  insert into public.circle_members (circle_id, user_id)
  values (c.id, uid)
  on conflict (circle_id, user_id) do nothing;

  return c;
end
$$;

revoke all on function public.join_public_circle(uuid) from public;
grant execute on function public.join_public_circle(uuid) to authenticated;

-- ============================================
-- RPC: set_circle_visibility
-- ============================================
create or replace function public.set_circle_visibility(
  target_circle_id uuid,
  new_visibility text,
  new_description text default null,
  new_slug text default null,
  new_accent_hue smallint default null
)
returns public.circles
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.circles;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if new_visibility not in ('private', 'public') then
    raise exception 'invalid visibility' using errcode = '22023';
  end if;

  update public.circles
     set visibility = new_visibility,
         description = coalesce(new_description, description),
         slug = coalesce(new_slug, slug),
         accent_hue = coalesce(new_accent_hue, accent_hue)
   where id = target_circle_id
     and created_by = uid
   returning * into c;

  if not found then
    raise exception 'not authorised or circle missing' using errcode = '42501';
  end if;

  return c;
end
$$;

revoke all on function public.set_circle_visibility(uuid, text, text, text, smallint) from public;
grant execute on function public.set_circle_visibility(uuid, text, text, text, smallint) to authenticated;

-- ============================================
-- Helper: list public circles (ordered)
-- ============================================
create or replace function public.list_public_circles(page_limit int default 50, page_offset int default 0)
returns setof public.circles
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.circles
  where visibility = 'public'
  order by is_featured desc, last_activity_at desc
  limit coalesce(page_limit, 50)
  offset coalesce(page_offset, 0);
$$;

grant execute on function public.list_public_circles(int, int) to authenticated;
