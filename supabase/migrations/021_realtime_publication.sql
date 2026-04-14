-- Ajoute les tables à la publication supabase_realtime pour que
-- Postgres diffuse les changements aux clients Realtime.
-- Sans ça, les .on('postgres_changes', ...) côté client ne reçoivent jamais rien.

alter publication supabase_realtime add table public.circle_messages;
alter publication supabase_realtime add table public.outfit_comments;
alter publication supabase_realtime add table public.outfits;

-- REPLICA IDENTITY FULL : garantit que le payload `old` contient toutes
-- les colonnes (utile pour les filtres côté client sur DELETE/UPDATE).
alter table public.circle_messages replica identity full;
alter table public.outfit_comments replica identity full;
alter table public.outfits         replica identity full;
