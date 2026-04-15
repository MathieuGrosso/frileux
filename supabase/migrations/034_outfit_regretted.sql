-- 034_outfit_regretted.sql
-- Flag `regretted` sur outfits. Setté automatiquement quand une critique
-- renvoie un score ≤ 4. Les tenues regrettées sont remontées dans
-- suggest-outfit.avoid_reasons pour éviter la répétition.

alter table public.outfits
  add column if not exists regretted boolean not null default false;

create index if not exists outfits_user_regretted_idx
  on public.outfits(user_id, regretted)
  where regretted = true;

comment on column public.outfits.regretted is
  'True si la critique a été franchement négative (score ≤ 4). Injecté dans suggest-outfit.avoid_reasons.';
