-- 038_outfit_intention.sql
-- Ajoute une colonne `intention` sur outfits pour capter le parti-pris de l'utilisatrice
-- (j'assume / pragmatique / flemme / test). Nourrit le prompt de critique pour adoucir
-- le ton quand le choix est assumé plutôt que subi.

alter table public.outfits
  add column if not exists intention text
  check (intention in ('assume', 'pragmatic', 'lazy', 'test'));

comment on column public.outfits.intention is
  'Parti-pris déclaré par l''utilisatrice au moment de logger : assume/pragmatic/lazy/test';
