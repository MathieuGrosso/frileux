-- 046_taste_probes_pieces.sql
-- Hello calibrage v2 : chaque option d'un duel peut embarquer une liste de
-- pièces fictives structurées (générées par Gemini, composées par Claude).
-- Les colonnes text/tags existantes restent pour le fallback côté client et
-- la rétrocompat avec les anciennes rows.

alter table public.taste_probes
  add column if not exists option_a_pieces jsonb,
  add column if not exists option_b_pieces jsonb;

comment on column public.taste_probes.option_a_pieces is
  'Liste structurée de pièces fictives (type/color/material/style_tags/description). Null = ancienne row ou fallback texte.';
comment on column public.taste_probes.option_b_pieces is
  'Liste structurée de pièces fictives (type/color/material/style_tags/description). Null = ancienne row ou fallback texte.';
