-- Coach chat : conversation persistante user ↔ IA stylist.
-- Un seul thread par utilisateur (pas de thread_id côté MVP).
-- Slash commands stockés à côté du body pour traçabilité (/feedback, /coach,
-- /tenue) — la commande peut être null pour un échange free-text.

create table public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  body text not null,
  command text check (command is null or command in ('feedback', 'coach', 'tenue', 'effacer')),
  command_arg text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index coach_messages_user_created_idx
  on public.coach_messages (user_id, created_at desc);

alter table public.coach_messages enable row level security;

create policy "users read own coach messages"
  on public.coach_messages
  for select
  using (auth.uid() = user_id);

create policy "users insert own coach messages"
  on public.coach_messages
  for insert
  with check (auth.uid() = user_id);

create policy "users delete own coach messages"
  on public.coach_messages
  for delete
  using (auth.uid() = user_id);
