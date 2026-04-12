-- ============================================
-- Frileux — Push Notifications
-- ============================================

-- Add push notification fields to profiles
alter table public.profiles
  add column if not exists push_token text,
  add column if not exists last_latitude decimal(9,6),
  add column if not exists last_longitude decimal(9,6);

-- Enable pg_net for HTTP calls from pg_cron
create extension if not exists pg_net with schema extensions;

-- Enable pg_cron
create extension if not exists pg_cron with schema pg_catalog;

-- Schedule daily notification at 7:00 UTC (= 8h Paris hiver, 9h été)
select cron.schedule(
  'daily-outfit-notification',
  '0 7 * * *',
  $$
    select extensions.http_post(
      url := 'https://qkghokrzqrbddqrsoksm.supabase.co/functions/v1/daily-notification',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrZ2hva3J6cXJiZGRxcnNva3NtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk4OTE4NCwiZXhwIjoyMDkxNTY1MTg0fQ.xkCHTPvn-jBLHAcoDHxv4EEhBuVIzpyp4f8-AbRXMAU"}'::jsonb,
      body := '{}'::jsonb
    )
  $$
);
