drop policy if exists "user_usage_own_insert" on public.user_usage;

create policy "user_usage_own_insert"
  on public.user_usage for insert
  to authenticated
  with check (auth.uid() = user_id);
