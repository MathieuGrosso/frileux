-- DM avec photos : attachment_url + attachment_kind.
-- Bucket privé dm_media, RLS restreinte aux 2 participants du thread.

alter table public.dm_messages
  add column attachment_url text null,
  add column attachment_kind text null
    check (attachment_kind is null or attachment_kind in ('image'));

alter table public.dm_messages
  alter column body drop not null;

alter table public.dm_messages
  add constraint dm_messages_has_content
  check (
    attachment_url is not null
    or (body is not null and length(trim(body)) > 0)
  );

-- Bucket privé : public=false, select via RLS sur objects.
insert into storage.buckets (id, name, public, file_size_limit)
values ('dm_media', 'dm_media', false, 8 * 1024 * 1024)
on conflict (id) do nothing;

-- Path convention : {thread_id}/{user_id}/{uuid}.jpg
-- Insert : la personne qui upload doit être un participant du thread.
create policy "DM members can upload media"
  on storage.objects for insert
  with check (
    bucket_id = 'dm_media'
    and auth.uid()::text = (string_to_array(name, '/'))[2]
    and exists (
      select 1 from public.dm_threads t
      where t.id::text = (string_to_array(name, '/'))[1]
        and (t.user_a = auth.uid() or t.user_b = auth.uid())
    )
  );

-- Select : les 2 participants du thread peuvent lire.
create policy "DM members can read media"
  on storage.objects for select
  using (
    bucket_id = 'dm_media'
    and exists (
      select 1 from public.dm_threads t
      where t.id::text = (string_to_array(name, '/'))[1]
        and (t.user_a = auth.uid() or t.user_b = auth.uid())
    )
  );

-- Delete : uploader seul.
create policy "DM sender can delete own media"
  on storage.objects for delete
  using (
    bucket_id = 'dm_media'
    and auth.uid()::text = (string_to_array(name, '/'))[2]
  );

-- Mise à jour du trigger de preview : fallback "[photo]" si body null.
create or replace function public.dm_bump_thread()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.dm_threads
    set last_message_at = new.created_at,
        last_message_preview = coalesce(
          substring(new.body from 1 for 120),
          case when new.attachment_kind = 'image' then '[photo]' else null end
        )
    where id = new.thread_id;
  return new;
end;
$$;
