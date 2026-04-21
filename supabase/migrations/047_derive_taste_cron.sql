-- 047_derive_taste_cron.sql
-- Agent quotidien : relit taste_probes + feedbacks récents et reconstruit
-- profiles.derived_prefs pour chaque utilisatrice active. Même pattern que
-- daily-outfit-notification (002) : pg_cron → http_post → edge function.

alter table public.profiles
  add column if not exists derived_prefs_updated_at timestamptz;

-- 04:00 UTC = 06h Paris été, 05h Paris hiver. Avant la notif du matin (07:00 UTC).
select cron.schedule(
  'derive-taste-daily',
  '0 4 * * *',
  $$
    select extensions.http_post(
      url := 'https://qkghokrzqrbddqrsoksm.supabase.co/functions/v1/derive-taste',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrZ2hva3J6cXJiZGRxcnNva3NtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk4OTE4NCwiZXhwIjoyMDkxNTY1MTg0fQ.xkCHTPvn-jBLHAcoDHxv4EEhBuVIzpyp4f8-AbRXMAU"}'::jsonb,
      body := '{}'::jsonb
    )
  $$
);
