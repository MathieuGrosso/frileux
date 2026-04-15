-- 025_wardrobe_only_mode.sql
-- Ajoute un flag `wardrobe_only_mode` sur profiles pour forcer suggest-outfit à
-- n'utiliser QUE les pièces réelles de la garde-robe (sinon : mode hybride).

alter table public.profiles
  add column if not exists wardrobe_only_mode boolean not null default false;

comment on column public.profiles.wardrobe_only_mode is
  'Si true, la suggestion quotidienne doit utiliser uniquement des pièces présentes dans wardrobe_items.';
