drop policy if exists "shared_post_responses_author_delete" on public.shared_post_responses;
create policy "shared_post_responses_author_delete"
  on public.shared_post_responses
  for delete
  using (author_user_id = auth.uid());
