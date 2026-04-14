-- Adoption d'une suggestion sans photo : la ligne est créée au moment où
-- l'utilisateur dit "je la porte", la photo est ajoutée plus tard (ou jamais).

alter table public.outfits
  alter column photo_url drop not null;

alter table public.outfits
  add column if not exists adopted boolean not null default false;

create index if not exists idx_outfits_user_adopted
  on public.outfits(user_id, date desc)
  where adopted = true;
