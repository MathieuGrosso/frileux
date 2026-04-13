-- =====================================================================
-- Circle chat : messages courts par cercle, lecture/ecriture reservees
-- aux membres. Suivi du dernier message lu par membre (last_read_at).
-- =====================================================================

create table public.circle_messages (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(body) > 0 and length(body) <= 500),
  created_at timestamptz not null default now()
);

create index idx_circle_messages_circle_created
  on public.circle_messages(circle_id, created_at desc);

alter table public.circle_messages enable row level security;

-- Lecture : membre du cercle
create policy "Circle members can read messages"
  on public.circle_messages for select
  using (
    exists (
      select 1 from public.circle_members cm
      where cm.circle_id = circle_messages.circle_id
        and cm.user_id = auth.uid()
    )
  );

-- Envoi : membre du cercle et auteur = utilisateur courant
create policy "Circle members can send messages"
  on public.circle_messages for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.circle_members cm
      where cm.circle_id = circle_messages.circle_id
        and cm.user_id = auth.uid()
    )
  );

-- Suppression : auteur uniquement
create policy "Authors can delete their messages"
  on public.circle_messages for delete
  using (auth.uid() = user_id);

-- Suivi du dernier message lu par membre, pour le unread counter
alter table public.circle_members
  add column if not exists last_read_at timestamptz;

-- Les membres peuvent mettre a jour leur propre ligne (pour last_read_at)
create policy "Members can update their own membership"
  on public.circle_members for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
