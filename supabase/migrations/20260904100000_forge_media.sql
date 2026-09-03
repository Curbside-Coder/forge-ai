insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'forge-media',
  'forge-media',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Forge users read their media" on storage.objects;
create policy "Forge users read their media"
on storage.objects for select
to authenticated
using (
  bucket_id = 'forge-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Forge users upload their media" on storage.objects;
create policy "Forge users upload their media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'forge-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Forge users update their media" on storage.objects;
create policy "Forge users update their media"
on storage.objects for update
to authenticated
using (
  bucket_id = 'forge-media'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'forge-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Forge users delete their media" on storage.objects;
create policy "Forge users delete their media"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'forge-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);
