-- Allow circle creators to delete their circle.
-- circle_members and outfit_shares cascade automatically via FK on delete cascade.
-- Outfits themselves are owned by users, not circles: they stay, only their shares to this circle disappear.

create or replace function public.delete_circle(target_circle_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  creator uuid;
begin
  select created_by into creator from public.circles where id = target_circle_id;
  if creator is null then
    return false;
  end if;
  if creator <> auth.uid() then
    return false;
  end if;

  delete from public.circles where id = target_circle_id;
  return true;
end;
$$;

grant execute on function public.delete_circle(uuid) to authenticated;

-- Also add an explicit RLS delete policy as a belt-and-suspenders (bypassed by security definer RPC, but useful if client ever tries direct delete).
drop policy if exists "Creator can delete circle" on public.circles;
create policy "Creator can delete circle"
  on public.circles for delete
  using (created_by = auth.uid());
