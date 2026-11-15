-- Validate every requested username, while allowing the creator to appear
-- in the input list without inserting a duplicate membership row.
create or replace function public.create_group_conversation(
  p_title text,
  p_usernames text[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_names text[];
  v_targets uuid[];
  v_conversation uuid;
  v_target uuid;
  v_own_username text;
  v_expected_count integer;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if length(trim(coalesce(p_title, ''))) < 1 or length(trim(p_title)) > 80 then
    raise exception 'Group title must be between 1 and 80 characters' using errcode = '22023';
  end if;

  select p.username into v_own_username
  from public.profiles p where p.id = v_user;

  select array_agg(distinct lower(trim(x)))
  into v_names
  from unnest(coalesce(p_usernames, array[]::text[])) as x
  where trim(x) <> '';

  if coalesce(cardinality(v_names), 0) < 1 or cardinality(v_names) > 100 then
    raise exception 'Add between 1 and 100 members' using errcode = '22023';
  end if;

  select count(*)::int into v_expected_count
  from unnest(v_names) as n
  where n <> lower(coalesce(v_own_username, ''));

  select array_agg(p.id order by p.id)
  into v_targets
  from public.profiles p
  where lower(p.username) = any(v_names)
    and p.id <> v_user;

  if coalesce(cardinality(v_targets), 0) <> v_expected_count then
    raise exception 'One or more usernames were not found' using errcode = 'P0002';
  end if;

  if coalesce(cardinality(v_targets), 0) < 1 then
    raise exception 'A group needs at least one other member' using errcode = '22023';
  end if;

  insert into public.conversations(kind, title, created_by)
  values ('group', trim(p_title), v_user)
  returning id into v_conversation;

  insert into public.conversation_members(conversation_id, user_id, role)
  values (v_conversation, v_user, 'owner');

  foreach v_target in array v_targets loop
    insert into public.conversation_members(conversation_id, user_id, role)
    values (v_conversation, v_target, 'member');
  end loop;

  return v_conversation;
end;
$$;
revoke all on function public.create_group_conversation(text, text[]) from public, anon;
grant execute on function public.create_group_conversation(text, text[]) to authenticated;
