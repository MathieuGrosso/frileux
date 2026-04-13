-- ============================================
-- Frileux — Wardrobe & Onboarding
-- ============================================

alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false;

-- ============================================
-- WARDROBE ITEMS
-- ============================================
create table public.wardrobe_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  photo_url text,
  type text not null check (type in ('top', 'bottom', 'outerwear', 'shoes', 'accessory')),
  color text,
  material text,
  style_tags text[] not null default '{}',
  description text not null,
  created_at timestamptz not null default now()
);

create index idx_wardrobe_user on public.wardrobe_items(user_id, created_at desc);

alter table public.wardrobe_items enable row level security;

create policy "Users can view their own wardrobe"
  on public.wardrobe_items for select
  using (auth.uid() = user_id);

create policy "Users can insert their own wardrobe items"
  on public.wardrobe_items for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own wardrobe items"
  on public.wardrobe_items for update
  using (auth.uid() = user_id);

create policy "Users can delete their own wardrobe items"
  on public.wardrobe_items for delete
  using (auth.uid() = user_id);

-- ============================================
-- OUTFIT PREFERENCES (swipe feedback)
-- ============================================
create table public.outfit_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('combo', 'suggestion')),
  payload jsonb not null,
  accepted boolean not null,
  created_at timestamptz not null default now()
);

create index idx_outfit_prefs_user on public.outfit_preferences(user_id, created_at desc);

alter table public.outfit_preferences enable row level security;

create policy "Users can view their own preferences"
  on public.outfit_preferences for select
  using (auth.uid() = user_id);

create policy "Users can insert their own preferences"
  on public.outfit_preferences for insert
  with check (auth.uid() = user_id);

-- ============================================
-- STORAGE BUCKET (wardrobe photos)
-- ============================================
insert into storage.buckets (id, name, public)
values ('wardrobe', 'wardrobe', true)
on conflict (id) do nothing;

create policy "Users can upload their own wardrobe photos"
  on storage.objects for insert
  with check (
    bucket_id = 'wardrobe'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );

create policy "Anyone can view wardrobe photos"
  on storage.objects for select
  using (bucket_id = 'wardrobe');

create policy "Users can delete their own wardrobe photos"
  on storage.objects for delete
  using (
    bucket_id = 'wardrobe'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );
