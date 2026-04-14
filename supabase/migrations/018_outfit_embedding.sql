-- Stores a text embedding (float array) for each outfit's description.
-- Used to detect semantically-similar silhouettes across days and avoid repetition.
-- Stored as jsonb to keep pgvector optional; cosine similarity is computed client-side.

alter table public.outfits
  add column if not exists embedding jsonb,
  add column if not exists embedding_source text check (embedding_source in ('worn', 'suggested', null));

create index if not exists outfits_user_embedding_idx
  on public.outfits (user_id, date desc)
  where embedding is not null;
