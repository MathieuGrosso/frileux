-- ============================================
-- Frileux — Cleanup orphelin de 040_feed_global
-- ============================================
-- Migration 040 a drop la table public.circles mais a oublié
-- le trigger bump_circle_activity_on_outfit (et sa fonction)
-- créés en 023_public_circles. Le trigger fire à chaque insert
-- sur public.outfits et plante sur UPDATE public.circles (42P01).
-- ============================================

drop trigger if exists bump_circle_activity_on_outfit on public.outfits;
drop function if exists public.bump_circle_activity_from_outfit() cascade;
