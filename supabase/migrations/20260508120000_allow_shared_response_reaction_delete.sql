drop policy if exists "shared_post_response_reactions_author_delete" on public.shared_post_response_reactions;
create policy "shared_post_response_reactions_author_delete"
  on public.shared_post_response_reactions
  for delete
  using (author_user_id = auth.uid());
