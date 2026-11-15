-- Dector2 setup adjustments. Safe to re-run.
-- The core public tables and their RLS policies were created separately.

drop policy if exists devices_select_public_keys on public.user_devices;
drop policy if exists devices_select_owner on public.user_devices;
drop policy if exists devices_select_active_public_keys on public.user_devices;
create policy devices_select_active_public_keys
on public.user_devices
for select
to authenticated
using (user_id = (select auth.uid()) or revoked_at is null);

alter publication supabase_realtime add table public.message_key_envelopes;

update storage.buckets
set public = true,
    file_size_limit = 3145728,
    allowed_mime_types = array['image/jpeg','image/png','image/webp']
where id = 'avatars';

drop policy if exists "Public avatar images" on storage.objects;
drop policy if exists "Users upload own avatars" on storage.objects;
drop policy if exists "Users update own avatars" on storage.objects;
drop policy if exists "Users delete own avatars" on storage.objects;

create policy "Public avatar images"
on storage.objects for select
to public using (bucket_id = 'avatars');

create policy "Users upload own avatars"
on storage.objects for insert
to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users update own avatars"
on storage.objects for update
to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users delete own avatars"
on storage.objects for delete
to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
