-- Migration 036 — AI safety: per-user quotas, rate limit, weather cache, suggestion cache

-- 1. Daily per-user quota table
create table if not exists ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default (now() at time zone 'utc')::date,
  function_name text not null,
  count int not null default 0,
  tokens_in int not null default 0,
  tokens_out int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, day, function_name)
);
alter table ai_usage enable row level security;
drop policy if exists "ai_usage_read_own" on ai_usage;
create policy "ai_usage_read_own" on ai_usage for select using (auth.uid() = user_id);

create index if not exists ai_usage_day_idx on ai_usage (day);

-- 2. Short-term rate limit
create table if not exists ai_rate_limit (
  user_id uuid not null references auth.users(id) on delete cascade,
  function_name text not null,
  last_call_at timestamptz not null default now(),
  primary key (user_id, function_name)
);
alter table ai_rate_limit enable row level security;
-- no policies → only service_role can read/write

-- 3. Atomic quota check + increment
create or replace function increment_ai_usage(
  p_user_id uuid,
  p_function_name text,
  p_limit int
) returns table (allowed boolean, remaining int, current_count int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := (now() at time zone 'utc')::date;
  v_count int;
begin
  insert into ai_usage (user_id, day, function_name, count)
  values (p_user_id, v_day, p_function_name, 0)
  on conflict (user_id, day, function_name) do nothing;

  select count into v_count
  from ai_usage
  where user_id = p_user_id and day = v_day and function_name = p_function_name
  for update;

  if v_count >= p_limit then
    allowed := false;
    remaining := 0;
    current_count := v_count;
    return next;
    return;
  end if;

  update ai_usage
  set count = count + 1, updated_at = now()
  where user_id = p_user_id and day = v_day and function_name = p_function_name;

  allowed := true;
  remaining := p_limit - (v_count + 1);
  current_count := v_count + 1;
  return next;
end;
$$;

-- 4. Record tokens after success (best-effort, non-blocking)
create or replace function record_ai_tokens(
  p_user_id uuid,
  p_function_name text,
  p_tokens_in int,
  p_tokens_out int
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := (now() at time zone 'utc')::date;
begin
  update ai_usage
  set tokens_in = tokens_in + coalesce(p_tokens_in, 0),
      tokens_out = tokens_out + coalesce(p_tokens_out, 0),
      updated_at = now()
  where user_id = p_user_id and day = v_day and function_name = p_function_name;
end;
$$;

-- 5. Rate limit check (atomic upsert; returns false if last call < interval)
create or replace function check_rate_limit(
  p_user_id uuid,
  p_function_name text,
  p_min_interval_seconds int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last timestamptz;
begin
  select last_call_at into v_last
  from ai_rate_limit
  where user_id = p_user_id and function_name = p_function_name
  for update;

  if v_last is not null and now() - v_last < make_interval(secs => p_min_interval_seconds) then
    return false;
  end if;

  insert into ai_rate_limit (user_id, function_name, last_call_at)
  values (p_user_id, p_function_name, now())
  on conflict (user_id, function_name) do update set last_call_at = now();

  return true;
end;
$$;

grant execute on function increment_ai_usage(uuid, text, int) to service_role;
grant execute on function record_ai_tokens(uuid, text, int, int) to service_role;
grant execute on function check_rate_limit(uuid, text, int) to service_role;

-- 6. Weather cache (lat/lon rounded to ~11km grid, hourly bucket)
create table if not exists weather_cache (
  lat_key int not null,
  lon_key int not null,
  hour_bucket timestamptz not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (lat_key, lon_key, hour_bucket)
);
alter table weather_cache enable row level security;
-- no policies → service_role only (Edge Function calls it)

create index if not exists weather_cache_created_at_idx on weather_cache (created_at);

-- 7. Suggestion cache (skip AI call if same user/day/coldness/occasion already cached)
create table if not exists suggest_outfit_cache (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  coldness_bucket int not null,
  occasion_key text not null default '',
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, day, coldness_bucket, occasion_key)
);
alter table suggest_outfit_cache enable row level security;
drop policy if exists "suggest_cache_read_own" on suggest_outfit_cache;
create policy "suggest_cache_read_own" on suggest_outfit_cache for select using (auth.uid() = user_id);

-- 8. last_active_at on profiles (for daily-notification filtering)
alter table profiles add column if not exists last_active_at timestamptz;
create index if not exists profiles_last_active_at_idx on profiles (last_active_at);

-- 9. Embed dedup: hash column on outfits (optional; best-effort idempotency)
alter table outfits add column if not exists embedding_text_hash text;
create index if not exists outfits_embedding_hash_idx on outfits (embedding_text_hash) where embedding_text_hash is not null;
