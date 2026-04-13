-- Add `occasion` classification to outfits.
-- Values constrained to a small editorial set; nullable when the user
-- doesn't tag it.

alter table public.outfits
  add column if not exists occasion text
  check (occasion in ('casual', 'travail', 'sortie', 'soiree', 'sport', 'repos'));

create index if not exists outfits_occasion_idx on public.outfits (occasion);
