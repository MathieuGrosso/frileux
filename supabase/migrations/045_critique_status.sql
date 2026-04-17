-- Observabilité de la critique IA : état explicite, erreur et tentatives.
-- La colonne `critique` seule était ambigüe (null = jamais demandée / en cours / échouée),
-- rendant tout debug impossible et empêchant le retry.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'critique_status') then
    create type critique_status as enum ('pending', 'running', 'done', 'failed');
  end if;
end $$;

alter table public.outfits
  add column if not exists critique_status critique_status,
  add column if not exists critique_error text,
  add column if not exists critique_attempts smallint not null default 0,
  add column if not exists critique_updated_at timestamptz;

create index if not exists idx_outfits_critique_status
  on public.outfits(user_id, critique_status)
  where critique_status in ('pending', 'running', 'failed');

-- Backfill : les tenues avec critique déjà stockée sont considérées "done".
update public.outfits
  set critique_status = 'done', critique_updated_at = coalesce(critique_updated_at, created_at)
  where critique is not null and critique_status is null;
