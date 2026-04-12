-- ============================================
-- Frileux — Initial Database Schema
-- ============================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================
-- PROFILES
-- ============================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text not null,
  avatar_url text,
  coldness_level smallint not null default 3 check (coldness_level between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- ============================================
-- OUTFITS
-- ============================================
create table public.outfits (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  photo_url text not null,
  date date not null default current_date,
  weather_data jsonb,
  rating smallint check (rating is null or (rating between 1 and 5)),
  notes text,
  ai_suggestion text,
  created_at timestamptz not null default now()
);

create index idx_outfits_user_date on public.outfits(user_id, date desc);
create index idx_outfits_date on public.outfits(date desc);

alter table public.outfits enable row level security;

create policy "Users can view their own outfits"
  on public.outfits for select
  using (auth.uid() = user_id);

create policy "Users can insert their own outfits"
  on public.outfits for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own outfits"
  on public.outfits for update
  using (auth.uid() = user_id);

create policy "Users can delete their own outfits"
  on public.outfits for delete
  using (auth.uid() = user_id);

-- ============================================
-- CIRCLES
-- ============================================
create table public.circles (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  invite_code text not null unique,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index idx_circles_invite_code on public.circles(invite_code);

alter table public.circles enable row level security;

create policy "Authenticated users can view circles by invite code"
  on public.circles for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can create circles"
  on public.circles for insert
  with check (auth.uid() = created_by);

-- ============================================
-- CIRCLE MEMBERS
-- ============================================
create table public.circle_members (
  circle_id uuid not null references public.circles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);

alter table public.circle_members enable row level security;

create policy "Users can view members of their circles"
  on public.circle_members for select
  using (
    circle_id in (
      select circle_id from public.circle_members
      where user_id = auth.uid()
    )
  );

create policy "Users can join circles"
  on public.circle_members for insert
  with check (auth.uid() = user_id);

create policy "Users can leave circles"
  on public.circle_members for delete
  using (auth.uid() = user_id);

-- ============================================
-- CROSS-TABLE POLICIES (defined after all tables exist)
-- ============================================

-- Profiles visible to circle members
create policy "Circle members can view each other's profiles"
  on public.profiles for select
  using (
    id in (
      select cm2.user_id
      from public.circle_members cm1
      join public.circle_members cm2 on cm1.circle_id = cm2.circle_id
      where cm1.user_id = auth.uid()
    )
  );

-- Circle members can see each other's outfits
create policy "Circle members can view each other's outfits"
  on public.outfits for select
  using (
    user_id in (
      select cm2.user_id
      from public.circle_members cm1
      join public.circle_members cm2 on cm1.circle_id = cm2.circle_id
      where cm1.user_id = auth.uid()
    )
  );

-- Circle members can view their circles
create policy "Circle members can view their circles"
  on public.circles for select
  using (
    id in (
      select circle_id from public.circle_members
      where user_id = auth.uid()
    )
  );

-- ============================================
-- STORAGE BUCKET
-- ============================================
insert into storage.buckets (id, name, public)
values ('outfits', 'outfits', true)
on conflict (id) do nothing;

create policy "Users can upload their own outfit photos"
  on storage.objects for insert
  with check (
    bucket_id = 'outfits'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );

create policy "Anyone can view outfit photos"
  on storage.objects for select
  using (bucket_id = 'outfits');

create policy "Users can delete their own photos"
  on storage.objects for delete
  using (
    bucket_id = 'outfits'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );

-- ============================================
-- AUTO-UPDATE updated_at
-- ============================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_profiles_updated
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();
