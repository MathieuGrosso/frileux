-- ============================================
-- Fix infinite recursion in RLS policies
-- circle_members self-referencing policy caused 500s on profiles/outfits
-- ============================================

create or replace function public.user_circle_ids(uid uuid)
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select circle_id from public.circle_members where user_id = uid;
$$;

drop policy if exists "Users can view members of their circles" on public.circle_members;
create policy "Users can view members of their circles"
  on public.circle_members for select
  using (circle_id in (select public.user_circle_ids(auth.uid())));

drop policy if exists "Circle members can view each other's profiles" on public.profiles;
create policy "Circle members can view each other's profiles"
  on public.profiles for select
  using (
    id in (
      select user_id from public.circle_members
      where circle_id in (select public.user_circle_ids(auth.uid()))
    )
  );

drop policy if exists "Circle members can view each other's outfits" on public.outfits;
create policy "Circle members can view each other's outfits"
  on public.outfits for select
  using (
    user_id in (
      select user_id from public.circle_members
      where circle_id in (select public.user_circle_ids(auth.uid()))
    )
  );

drop policy if exists "Circle members can view their circles" on public.circles;
create policy "Circle members can view their circles"
  on public.circles for select
  using (id in (select public.user_circle_ids(auth.uid())));
