-- Validate that a pair row maps to a direct conversation created by the
-- caller and containing exactly the two users named by the pair key.
create or replace function private.is_valid_direct_pair(
  p_conversation_id uuid,
  p_user_low uuid,
  p_user_high uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and (p_user_low = (select auth.uid()) or p_user_high = (select auth.uid()))
    and exists (
      select 1
      from public.conversations c
      where c.id = p_conversation_id
        and c.kind = 'direct'
        and c.created_by = (select auth.uid())
        and exists (
          select 1 from public.conversation_members cm
          where cm.conversation_id = c.id and cm.user_id = p_user_low
        )
        and exists (
          select 1 from public.conversation_members cm
          where cm.conversation_id = c.id and cm.user_id = p_user_high
        )
    );
$$;
revoke all on function private.is_valid_direct_pair(uuid, uuid, uuid) from public, anon;
grant execute on function private.is_valid_direct_pair(uuid, uuid, uuid) to authenticated;

drop policy if exists direct_pairs_insert_members on public.direct_conversation_pairs;
create policy direct_pairs_insert_members on public.direct_conversation_pairs
for insert to authenticated
with check (
  private.is_valid_direct_pair(conversation_id, user_low, user_high)
);

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

  insert into public.conversation_members(conversation_id, user_id, role)
  values (v_new_conversation, v_user, 'owner'),
         (v_new_conversation, v_target, 'member');

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

  return v_new_conversation;
end;
$$;
revoke all on function public.create_direct_conversation(text) from public, anon;
grant execute on function public.create_direct_conversation(text) to authenticated;
