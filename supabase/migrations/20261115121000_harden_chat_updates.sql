-- Prevent users from escalating their own membership role.
revoke update on public.conversation_members from authenticated;
grant update (last_read_at) on public.conversation_members to authenticated;

-- A sender may edit a message only while remaining a member of its destination chat.
drop policy if exists messages_update_sender on public.messages;
create policy messages_update_sender on public.messages
for update to authenticated
using (sender_id = (select auth.uid()))
with check (
  sender_id = (select auth.uid())
  and private.is_conversation_member(conversation_id)
);
