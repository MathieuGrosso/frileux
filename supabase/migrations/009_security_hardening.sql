-- ============================================
-- Frileux — Security hardening
-- ============================================
-- Restreindre uploads storage (MIME + taille) et reprogrammer le cron
-- avec une reference de secret au lieu d'un JWT en dur.

-- 1) Whitelist MIME + cap taille pour les buckets photos
update storage.buckets
  set allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic'],
      file_size_limit = 8388608  -- 8 MiB
  where id in ('outfits','wardrobe');

-- 2) Cron : remplacer le JWT service_role hardcode par une lecture vault
--    Pre-requis manuel cote ops : `select vault.create_secret('<SERVICE_ROLE_JWT>', 'service_role_jwt');`
--    Si le secret n'existe pas encore, le job sera no-op (extensions.http_post echoue silencieusement),
--    ce qui est preferable a une fuite.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'daily-outfit-notification') then
    perform cron.unschedule('daily-outfit-notification');
  end if;
end $$;

select cron.schedule(
  'daily-outfit-notification',
  '0 7 * * *',
  $cron$
    select extensions.http_post(
      url := 'https://qkghokrzqrbddqrsoksm.supabase.co/functions/v1/daily-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || coalesce(
          (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_jwt' limit 1),
          ''
        )
      ),
      body := '{}'::jsonb
    )
  $cron$
);
