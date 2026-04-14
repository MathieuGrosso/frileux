-- Atomic join-circle-by-code RPC.
-- Resolves invite_code + inserts membership in a single security-definer call,
-- so clients don't need a permissive SELECT policy on circles to read a circle
-- they haven't joined yet.

create or replace function public.join_circle_by_code(code text)
returns public.circles
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.circles;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into c
  from public.circles
  where invite_code = upper(btrim(code));

  if not found then
    return null;
  end if;

  insert into public.circle_members (circle_id, user_id)
  values (c.id, uid)
  on conflict (circle_id, user_id) do nothing;

  return c;
end
$$;

revoke all on function public.join_circle_by_code(text) from public;
grant execute on function public.join_circle_by_code(text) to authenticated;
