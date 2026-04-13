-- Add worn_description: AI-generated description of what the user actually wore
-- (analyzed from their saved photo, to compare vs the ai_suggestion they got in the morning).

alter table public.outfits
  add column if not exists worn_description text;
