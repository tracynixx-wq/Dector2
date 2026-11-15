-- Private avatar storage. Authenticated users may read profile images;
-- only the owner of a uid-prefixed folder may write or delete its files.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do nothing;

drop policy if exists dector_avatars_authenticated_read on storage.objects;
create policy dector_avatars_authenticated_read
on storage.objects for select to authenticated
using (bucket_id = 'avatars');

drop policy if exists dector_avatars_owner_insert on storage.objects;
create policy dector_avatars_owner_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists dector_avatars_owner_update on storage.objects;
create policy dector_avatars_owner_update
on storage.objects for update to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists dector_avatars_owner_delete on storage.objects;
create policy dector_avatars_owner_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
