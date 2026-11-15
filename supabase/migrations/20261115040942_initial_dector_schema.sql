-- Initial Dector2 backend schema.
-- Message bodies and per-device key envelopes are ciphertext only.
-- Private signing/identity keys must remain on user devices.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  display_name text not null default '',
  bio text not null default '',
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-zA-Z0-9_]{3,32}$')
);
create unique index if not exists profiles_username_lower_uidx on public.profiles (lower(username));

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('direct','group')),
  title text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);
create index if not exists conversation_members_user_idx on public.conversation_members(user_id, conversation_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete restrict,
  client_message_id uuid not null,
  ciphertext text not null,
  nonce text not null,
  encryption_version smallint not null default 1 check (encryption_version > 0),
  content_type text not null default 'text' check (content_type in ('text','image','video','file','audio','system')),
  reply_to uuid references public.messages(id) on delete set null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  unique (sender_id, client_message_id)
);
create index if not exists messages_conversation_created_idx on public.messages(conversation_id, created_at desc, id desc);

create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_name text not null default '',
  identity_key_public text not null,
  signed_prekey_public text not null,
  signed_prekey_signature text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at timestamptz,
  unique (user_id, id)
);
create index if not exists user_devices_active_idx on public.user_devices(user_id) where revoked_at is null;

create table if not exists public.message_key_envelopes (
  message_id uuid not null references public.messages(id) on delete cascade,
  recipient_device_id uuid not null references public.user_devices(id) on delete cascade,
  encrypted_key text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, recipient_device_id)
);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    'user_' || substr(replace(new.id::text, '-', ''), 1, 12),
    coalesce(new.raw_user_meta_data ->> 'display_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists conversations_set_updated_at on public.conversations;
create trigger conversations_set_updated_at before update on public.conversations
for each row execute function public.set_updated_at();

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.is_conversation_member(p_conversation_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = p_conversation_id and cm.user_id = (select auth.uid())
  );
$$;

create or replace function private.is_conversation_creator(p_conversation_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id and c.created_by = (select auth.uid())
  );
$$;

create or replace function private.can_add_key_envelope(p_message_id uuid, p_device_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.messages m
    join public.conversation_members cm on cm.conversation_id = m.conversation_id
    join public.user_devices d on d.id = p_device_id
      and d.user_id = cm.user_id and d.revoked_at is null
    where m.id = p_message_id and m.sender_id = (select auth.uid())
      and cm.user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_conversation_member(uuid) from public, anon;
revoke all on function private.is_conversation_creator(uuid) from public, anon;
revoke all on function private.can_add_key_envelope(uuid, uuid) from public, anon;
grant execute on function private.is_conversation_member(uuid) to authenticated;
grant execute on function private.is_conversation_creator(uuid) to authenticated;
grant execute on function private.can_add_key_envelope(uuid, uuid) to authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;

alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.user_devices enable row level security;
alter table public.message_key_envelopes enable row level security;

drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated on public.profiles
for select to authenticated using (true);
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
for update to authenticated using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists conversations_select_members on public.conversations;
create policy conversations_select_members on public.conversations
for select to authenticated using (private.is_conversation_member(id));
drop policy if exists conversations_insert_creator on public.conversations;
create policy conversations_insert_creator on public.conversations
for insert to authenticated with check (created_by = (select auth.uid()));
drop policy if exists conversations_update_owner on public.conversations;
create policy conversations_update_owner on public.conversations
for update to authenticated using (created_by = (select auth.uid()))
with check (created_by = (select auth.uid()));

drop policy if exists members_select_conversation_members on public.conversation_members;
create policy members_select_conversation_members on public.conversation_members
for select to authenticated using (private.is_conversation_member(conversation_id));
drop policy if exists members_insert_self_or_creator on public.conversation_members;
create policy members_insert_self_or_creator on public.conversation_members
for insert to authenticated with check (
  user_id = (select auth.uid()) or private.is_conversation_creator(conversation_id)
);
drop policy if exists members_update_self on public.conversation_members;
create policy members_update_self on public.conversation_members
for update to authenticated using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
drop policy if exists members_delete_self_or_creator on public.conversation_members;
create policy members_delete_self_or_creator on public.conversation_members
for delete to authenticated using (
  user_id = (select auth.uid()) or private.is_conversation_creator(conversation_id)
);

drop policy if exists messages_select_members on public.messages;
create policy messages_select_members on public.messages
for select to authenticated using (private.is_conversation_member(conversation_id));
drop policy if exists messages_insert_members on public.messages;
create policy messages_insert_members on public.messages
for insert to authenticated with check (
  sender_id = (select auth.uid()) and private.is_conversation_member(conversation_id)
);
drop policy if exists messages_update_sender on public.messages;
create policy messages_update_sender on public.messages
for update to authenticated using (sender_id = (select auth.uid()))
with check (sender_id = (select auth.uid()));
drop policy if exists messages_delete_sender on public.messages;
create policy messages_delete_sender on public.messages
for delete to authenticated using (sender_id = (select auth.uid()));

drop policy if exists devices_select_owner on public.user_devices;
create policy devices_select_owner on public.user_devices
for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists devices_insert_owner on public.user_devices;
create policy devices_insert_owner on public.user_devices
for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists devices_update_owner on public.user_devices;
create policy devices_update_owner on public.user_devices
for update to authenticated using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
drop policy if exists devices_delete_owner on public.user_devices;
create policy devices_delete_owner on public.user_devices
for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists key_envelopes_select_recipient on public.message_key_envelopes;
create policy key_envelopes_select_recipient on public.message_key_envelopes
for select to authenticated using (exists (
  select 1 from public.user_devices d
  where d.id = recipient_device_id and d.user_id = (select auth.uid())
));
drop policy if exists key_envelopes_insert_sender_member on public.message_key_envelopes;
create policy key_envelopes_insert_sender_member on public.message_key_envelopes
for insert to authenticated with check (
  private.can_add_key_envelope(message_id, recipient_device_id)
);

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.conversations to authenticated;
grant select, insert, update, delete on public.conversation_members to authenticated;
grant select, insert, update, delete on public.messages to authenticated;
grant select, insert, update, delete on public.user_devices to authenticated;
grant select, insert on public.message_key_envelopes to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversation_members'
  ) then
    alter publication supabase_realtime add table public.conversation_members;
  end if;
end;
$$;
