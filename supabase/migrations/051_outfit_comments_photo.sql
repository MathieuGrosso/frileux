-- Mirror reply : un commentaire peut être texte, photo, ou les deux.

alter table public.outfit_comments
  add column photo_url text null;

alter table public.outfit_comments
  alter column body drop not null;

alter table public.outfit_comments
  add constraint outfit_comments_has_content
  check (
    photo_url is not null
    or (body is not null and length(trim(body)) > 0)
  );

-- Bucket dédié aux photos-réponses (public pour lecture, écriture restreinte).
insert into storage.buckets (id, name, public, file_size_limit)
values ('outfit_replies', 'outfit_replies', true, 5 * 1024 * 1024)
on conflict (id) do nothing;

create policy "Users can upload their own outfit reply photos"
  on storage.objects for insert
  with check (
    bucket_id = 'outfit_replies'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );

create policy "Anyone can view outfit reply photos"
  on storage.objects for select
  using (bucket_id = 'outfit_replies');

create policy "Users can delete their own outfit reply photos"
  on storage.objects for delete
  using (
    bucket_id = 'outfit_replies'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );
