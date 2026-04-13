-- Notation enrichie : ressenti thermique de la tenue portee.
-- Permet de donner du feedback a l'IA pour ajuster les futures
-- suggestions selon le coldness_level reel.

alter table public.outfits
  add column if not exists thermal_feeling text
  check (thermal_feeling in ('too_cold', 'just_right', 'too_warm'));

create index if not exists outfits_thermal_feeling_idx
  on public.outfits (thermal_feeling);
