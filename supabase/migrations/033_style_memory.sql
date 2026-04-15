-- 033_style_memory.sql
-- Mémoire long-terme du style de l'utilisateur.
-- Alimentée après chaque critique d'outfit : extrait 0-2 faits mémorables
-- (pièce récurrente, combinaison gagnante, erreur à éviter) et les stocke.
-- Lue par loadProfileBundle → injectée dans suggest-outfit via derived_prefs.

create table if not exists public.style_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fact text not null,
  kind text not null check (kind in ('strength', 'avoid', 'pattern')),
  source_outfit_id uuid references public.outfits(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists style_memory_user_created_idx
  on public.style_memory(user_id, created_at desc);

alter table public.style_memory enable row level security;

drop policy if exists "read own style_memory" on public.style_memory;
create policy "read own style_memory" on public.style_memory
  for select using (auth.uid() = user_id);

drop policy if exists "insert own style_memory" on public.style_memory;
create policy "insert own style_memory" on public.style_memory
  for insert with check (auth.uid() = user_id);

drop policy if exists "delete own style_memory" on public.style_memory;
create policy "delete own style_memory" on public.style_memory
  for delete using (auth.uid() = user_id);

comment on table public.style_memory is
  'Faits stylistiques appris au fil des critiques. Injectés dans suggest-outfit pour continuité.';
