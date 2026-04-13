-- =====================================================================
-- Circle management: owner can rename, regen invite_code, kick members.
-- =====================================================================

-- Only the creator of a circle can update it (name, invite_code)
create policy "Circle creator can update circle"
  on public.circles for update
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

-- Circle creator can remove any member (except themselves via this policy;
-- they still use the existing "Users can leave circles" for their own row).
create policy "Circle creator can kick members"
  on public.circle_members for delete
  using (
    exists (
      select 1 from public.circles c
      where c.id = circle_members.circle_id
        and c.created_by = auth.uid()
    )
  );
