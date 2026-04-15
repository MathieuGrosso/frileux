-- ============================================
-- Frileux — Daily challenges (thème éditorial du jour)
-- ============================================

create table if not exists public.daily_challenges (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  theme_fr text not null check (char_length(theme_fr) between 1 and 60),
  prompt_fr text check (prompt_fr is null or char_length(prompt_fr) <= 160),
  created_at timestamptz not null default now()
);

alter table public.daily_challenges enable row level security;

drop policy if exists "Challenges readable by all authenticated" on public.daily_challenges;
create policy "Challenges readable by all authenticated"
  on public.daily_challenges for select
  using (auth.role() = 'authenticated');

-- Seed a few themes so the UI has content immediately
insert into public.daily_challenges (date, theme_fr, prompt_fr) values
  (current_date,          'MONOCHROME',       'Une seule couleur, trois nuances.'),
  (current_date - 1,      'LAYERING',         'Trois couches, trois textures.'),
  (current_date - 2,      'WHITE SNEAKERS',   'Un look qui ancre des blanches.'),
  (current_date - 3,      'OVERSIZE',         'Une pièce deux tailles trop grande.'),
  (current_date - 4,      'TAILORING',        'Un seul élément tailoring dans un look casual.')
on conflict (date) do nothing;

-- ============================================
-- Entries : opt-in, tagger sa tenue au challenge
-- ============================================
create table if not exists public.challenge_entries (
  outfit_id uuid primary key references public.outfits(id) on delete cascade,
  challenge_id uuid not null references public.daily_challenges(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  submitted_at timestamptz not null default now()
);

create index if not exists idx_challenge_entries_challenge on public.challenge_entries(challenge_id, submitted_at desc);

alter table public.challenge_entries enable row level security;

drop policy if exists "Entries readable by all authenticated" on public.challenge_entries;
create policy "Entries readable by all authenticated"
  on public.challenge_entries for select
  using (auth.role() = 'authenticated');

drop policy if exists "Entries insertable by owner" on public.challenge_entries;
create policy "Entries insertable by owner"
  on public.challenge_entries for insert
  with check (auth.uid() = user_id);

drop policy if exists "Entries deletable by owner" on public.challenge_entries;
create policy "Entries deletable by owner"
  on public.challenge_entries for delete
  using (auth.uid() = user_id);

-- ============================================
-- Streak : maintenu via trigger à chaque submit
-- ============================================
alter table public.profiles
  add column if not exists challenge_streak int not null default 0,
  add column if not exists challenge_last_submitted date;

create or replace function public.bump_challenge_streak()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.profiles;
  d date := (select date from public.daily_challenges where id = new.challenge_id);
begin
  select * into p from public.profiles where id = new.user_id;
  if not found then
    return new;
  end if;

  if p.challenge_last_submitted is null then
    update public.profiles set challenge_streak = 1, challenge_last_submitted = d where id = new.user_id;
  elsif p.challenge_last_submitted = d then
    -- same day re-submit, no-op
    null;
  elsif p.challenge_last_submitted = d - 1 then
    update public.profiles
      set challenge_streak = challenge_streak + 1, challenge_last_submitted = d
      where id = new.user_id;
  else
    update public.profiles
      set challenge_streak = 1, challenge_last_submitted = d
      where id = new.user_id;
  end if;

  return new;
end;
$$;

drop trigger if exists bump_streak_trigger on public.challenge_entries;
create trigger bump_streak_trigger
  after insert on public.challenge_entries
  for each row execute procedure public.bump_challenge_streak();
