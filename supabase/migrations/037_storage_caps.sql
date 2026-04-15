-- Migration 037 — Per-file storage size caps on Supabase buckets.
-- NOTE: per-user total quota (sum of sizes) needs a trigger on storage.objects;
-- keeping that as a follow-up because it requires heavier logic + testing.

update storage.buckets set file_size_limit = 5 * 1024 * 1024 where id = 'wardrobe'; -- 5MB
update storage.buckets set file_size_limit = 10 * 1024 * 1024 where id = 'outfits'; -- 10MB
