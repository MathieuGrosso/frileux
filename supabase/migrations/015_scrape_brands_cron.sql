-- Weekly cron job that triggers the scrape-brands Edge Function
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Unschedule prior runs (idempotent)
do $$
begin
  perform cron.unschedule(jobid)
    from cron.job where jobname = 'scrape-brands-weekly';
exception when others then null;
end $$;

select cron.schedule(
  'scrape-brands-weekly',
  '0 3 * * 1',
  $$
    select net.http_post(
      url := 'https://qkghokrzqrbddqrsoksm.supabase.co/functions/v1/scrape-brands',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'scrape_cron_secret')
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);
