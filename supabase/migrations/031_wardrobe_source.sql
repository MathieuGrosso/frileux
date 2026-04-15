-- ============================================
-- 024 · Wardrobe items source column
-- ============================================
-- Trace l'origine d'une pièce de garde-robe pour pouvoir filtrer/UI badges :
--   - 'manual'          : ajoutée via l'onboarding ou le formulaire wardrobe
--   - 'auto_extracted'  : extraite automatiquement depuis une photo de tenue loggée
--   - 'imported'        : réservé (ex : future import brand-products, scan liste de souhaits)

alter table public.wardrobe_items
  add column if not exists source text not null default 'manual'
    check (source in ('manual', 'auto_extracted', 'imported'));

create index if not exists idx_wardrobe_source
  on public.wardrobe_items(user_id, source);

comment on column public.wardrobe_items.source is
  'Origine de la pièce : manual (saisie utilisateur), auto_extracted (pipeline post-log), imported (futur).';
