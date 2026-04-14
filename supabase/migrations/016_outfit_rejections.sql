-- Outfit rejections: captures suggestions the user refused and why.
-- Used to derive learning signals (aggregated patterns fed back into prompt).

create table if not exists outfit_rejections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null default current_date,
  suggestion_text text not null,
  reason text not null,
  reason_note text,
  weather_data jsonb,
  occasion text,
  created_at timestamptz not null default now()
);

create index if not exists outfit_rejections_user_date_idx
  on outfit_rejections (user_id, date desc);

alter table outfit_rejections enable row level security;

drop policy if exists "own rejections select" on outfit_rejections;
create policy "own rejections select" on outfit_rejections
  for select using (auth.uid() = user_id);

drop policy if exists "own rejections insert" on outfit_rejections;
create policy "own rejections insert" on outfit_rejections
  for insert with check (auth.uid() = user_id);

drop policy if exists "own rejections delete" on outfit_rejections;
create policy "own rejections delete" on outfit_rejections
  for delete using (auth.uid() = user_id);
