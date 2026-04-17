-- 044_taste_probes.sql
-- Hello calibrage : duels A/B proposés à l'ouverture de l'app pour calibrer
-- le goût rapidement. Chaque session = 1 batch de 5 duels (1 batch_id), l'IA
-- relit les jugements pour tous les prochains suggest-outfit.

create table if not exists public.taste_probes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  batch_id uuid not null,
  axis text not null,
  axis_label_fr text not null,
  option_a_text text not null,
  option_a_tags text[] not null default '{}'::text[],
  option_b_text text not null,
  option_b_tags text[] not null default '{}'::text[],
  chosen text check (chosen in ('a','b','none')),
  created_at timestamptz not null default now(),
  judged_at timestamptz
);

create index if not exists taste_probes_user_idx
  on public.taste_probes(user_id, created_at desc);

create index if not exists taste_probes_batch_idx
  on public.taste_probes(batch_id);

create index if not exists taste_probes_user_judged_idx
  on public.taste_probes(user_id, judged_at desc)
  where judged_at is not null;

alter table public.taste_probes enable row level security;

drop policy if exists "own taste probes select" on public.taste_probes;
create policy "own taste probes select" on public.taste_probes
  for select using (auth.uid() = user_id);

drop policy if exists "own taste probes insert" on public.taste_probes;
create policy "own taste probes insert" on public.taste_probes
  for insert with check (auth.uid() = user_id);

drop policy if exists "own taste probes update" on public.taste_probes;
create policy "own taste probes update" on public.taste_probes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

comment on table public.taste_probes is
  'Duels A/B pour calibrer le goût stylistique. Chaque jugement (chosen + judged_at) enrichit suggest-outfit via derived_prefs.';
