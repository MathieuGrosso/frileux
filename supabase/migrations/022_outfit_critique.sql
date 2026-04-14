-- Critique d'une tenue loggée par l'utilisatrice : score /10, verdict, forces, améliorations.
alter table public.outfits
  add column if not exists critique jsonb,
  add column if not exists critique_score smallint check (critique_score between 1 and 10);

create index if not exists idx_outfits_critique_score
  on public.outfits(user_id, critique_score)
  where critique_score is not null;
