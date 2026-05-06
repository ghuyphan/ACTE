alter table public.shared_post_responses
  add column if not exists reply_to_response_id text
  references public.shared_post_responses(id)
  on delete set null;

create index if not exists idx_shared_post_responses_reply_to
  on public.shared_post_responses(reply_to_response_id);
