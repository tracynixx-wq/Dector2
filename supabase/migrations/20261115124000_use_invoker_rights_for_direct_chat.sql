-- Use invoker rights for the public RPC. Its table operations are now
-- explicitly authorized by narrow RLS policies.
drop policy if exists direct_pairs_select_members on public.direct_conversation_pairs;
create policy direct_pairs_select_members on public.direct_conversation_pairs
for select to authenticated
using (user_low = (select auth.uid()) or user_high = (select auth.uid()));

drop policy if exists direct_pairs_insert_members on public.direct_conversation_pairs;
create policy direct_pairs_insert_members on public.direct_conversation_pairs
for insert to authenticated
with check (user_low = (select auth.uid()) or user_high = (select auth.uid()));

grant select, insert on public.direct_conversation_pairs to authenticated;
create index if not exists direct_conversation_pairs_user_high_idx
  on public.direct_conversation_pairs(user_high);

drop policy if exists conversations_delete_creator on public.conversations;
create policy conversations_delete_creator on public.conversations
for delete to authenticated
using (created_by = (select auth.uid()));

create or replace function public.create_direct_conversation(p_username text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_target uuid;
  v_low uuid;
  v_high uuid;
  v_conversation uuid;
  v_new_conversation uuid;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select p.id into v_target
  from public.profiles p
  where lower(p.username) = lower(trim(p_username));

  if v_target is null then
    raise exception 'User not found' using errcode = 'P0002';
  end if;
  if v_target = v_user then
    raise exception 'Cannot create a chat with yourself' using errcode = '22023';
  end if;

  v_low := least(v_user, v_target);
  v_high := greatest(v_user, v_target);

  select d.conversation_id into v_conversation
  from public.direct_conversation_pairs d
  where d.user_low = v_low and d.user_high = v_high;

  if v_conversation is not null then
    return v_conversation;
  end if;

  insert into public.conversations(kind, created_by)
  values ('direct', v_user)
  returning id into v_new_conversation;

  insert into public.direct_conversation_pairs(user_low, user_high, conversation_id)
  values (v_low, v_high, v_new_conversation)
  on conflict (user_low, user_high) do nothing;

  if not found then
    delete from public.conversations where id = v_new_conversation;
    select d.conversation_id into v_conversation
    from public.direct_conversation_pairs d
    where d.user_low = v_low and d.user_high = v_high;
    return v_conversation;
  end if;

  insert into public.conversation_members(conversation_id, user_id, role)
  values (v_new_conversation, v_user, 'owner'),
         (v_new_conversation, v_target, 'member');

  return v_new_conversation;
end;
$$;

revoke all on function public.create_direct_conversation(text) from public, anon;
grant execute on function public.create_direct_conversation(text) to authenticated;
