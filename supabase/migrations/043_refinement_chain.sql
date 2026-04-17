-- 043_refinement_chain.sql
-- Chaîne d'itérations de raffinement : relie les rejets successifs d'une même
-- session pour que suggest-outfit sache à quelle itération on est et quels
-- axes ont déjà été rejetés (pas juste le dernier steer).

alter table public.outfit_rejections
  add column if not exists parent_rejection_id uuid
    references public.outfit_rejections(id) on delete set null,
  add column if not exists iteration_number int not null default 1,
  add column if not exists steer_text text,
  add column if not exists steer_brands text[];

create index if not exists outfit_rejections_parent_idx
  on public.outfit_rejections (parent_rejection_id);

comment on column public.outfit_rejections.parent_rejection_id is
  'ID de la rejection précédente dans la même chaîne de raffinement (session). NULL = 1er rejet.';
comment on column public.outfit_rejections.iteration_number is
  'Rang dans la chaîne : 1 = 1er rejet, 2 = après 1 raffinement, etc.';
comment on column public.outfit_rejections.steer_text is
  'Directive texte envoyée à Claude lors du raffinement (ex: "plus chaud").';
comment on column public.outfit_rejections.steer_brands is
  'Marques citées comme ancres d''inspiration lors du raffinement.';
