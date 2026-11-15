-- Permit a sender to create encrypted key envelopes for every active
-- device belonging to a member of the conversation, not just their own devices.
create or replace function private.can_add_key_envelope(p_message_id uuid, p_device_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.messages m
    join public.conversation_members cm
      on cm.conversation_id = m.conversation_id
    join public.user_devices d
      on d.id = p_device_id
     and d.user_id = cm.user_id
     and d.revoked_at is null
    where m.id = p_message_id
      and m.sender_id = (select auth.uid())
  );
$$;
revoke all on function private.can_add_key_envelope(uuid, uuid) from public, anon;
grant execute on function private.can_add_key_envelope(uuid, uuid) to authenticated;

-- Restrict edits to message content/state fields; sender identity, chat id,
-- client id and creation timestamp are immutable to ordinary clients.
revoke update on public.messages from authenticated;
grant update (ciphertext, nonce, content_type, reply_to, edited_at, deleted_at)
  on public.messages to authenticated;

drop policy if exists messages_update_sender on public.messages;
create policy messages_update_sender on public.messages
for update to authenticated
using (
  sender_id = (select auth.uid())
  and private.is_conversation_member(conversation_id)
)
with check (
  sender_id = (select auth.uid())
  and private.is_conversation_member(conversation_id)
);
