begin;

delete from public.shared_post_response_reactions reaction
 where not exists (
   select 1
     from public.shared_post_responses response
    where response.id = reaction.response_id
      and response.post_id = reaction.post_id
 );

update public.shared_post_responses response
   set reply_to_response_id = null
 where reply_to_response_id is not null
   and not exists (
     select 1
       from public.shared_post_responses parent
      where parent.id = response.reply_to_response_id
        and parent.post_id = response.post_id
   );

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'shared_post_responses_post_id_id_key'
       and conrelid = 'public.shared_post_responses'::regclass
  ) then
    alter table public.shared_post_responses
      add constraint shared_post_responses_post_id_id_key unique (post_id, id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'shared_post_response_reactions_post_response_fk'
       and conrelid = 'public.shared_post_response_reactions'::regclass
  ) then
    alter table public.shared_post_response_reactions
      add constraint shared_post_response_reactions_post_response_fk
      foreign key (post_id, response_id)
      references public.shared_post_responses(post_id, id)
      on delete cascade;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'shared_post_responses_reply_same_post_fk'
       and conrelid = 'public.shared_post_responses'::regclass
  ) then
    alter table public.shared_post_responses
      add constraint shared_post_responses_reply_same_post_fk
      foreign key (post_id, reply_to_response_id)
      references public.shared_post_responses(post_id, id);
  end if;
end;
$$;

drop policy if exists "shared_post_response_reactions_audience_insert" on public.shared_post_response_reactions;
create policy "shared_post_response_reactions_audience_insert"
  on public.shared_post_response_reactions
  for insert
  with check (
    author_user_id = auth.uid()
    and exists (
      select 1
        from public.shared_post_responses response
        join public.shared_posts post on post.id = response.post_id
       where response.id = shared_post_response_reactions.response_id
         and response.post_id = shared_post_response_reactions.post_id
         and (
           post.author_user_id = auth.uid()
           or post.audience_user_ids @> array[auth.uid()]::uuid[]
         )
    )
  );

alter table public.shared_posts
  drop constraint if exists shared_posts_direct_chat_key_check;

alter table public.shared_posts
  add constraint shared_posts_direct_chat_key_check
  check (
    (
      is_direct_chat
      and direct_chat_key is not null
      and source_note_id is null
      and type = 'text'
      and coalesce(text, '') = ''
      and photo_path is null
      and capture_variant is null
      and dual_primary_photo_path is null
      and dual_secondary_photo_path is null
      and dual_primary_facing is null
      and dual_secondary_facing is null
      and dual_layout_preset is null
      and is_live_photo is false
      and paired_video_path is null
      and cardinality(audience_user_ids) = 2
      and author_user_id = any(audience_user_ids)
      and direct_chat_key = least(audience_user_ids[1]::text, audience_user_ids[2]::text)
        || ':'
        || greatest(audience_user_ids[1]::text, audience_user_ids[2]::text)
    )
    or (
      not is_direct_chat
      and direct_chat_key is null
    )
  );

create or replace function public.enforce_direct_shared_chat_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  other_user_id uuid;
begin
  if not new.is_direct_chat then
    return new;
  end if;

  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  if auth.uid() is null or new.author_user_id is distinct from auth.uid() then
    raise exception 'Direct chat author must match the authenticated user.';
  end if;

  other_user_id := case
    when new.audience_user_ids[1] = auth.uid() then new.audience_user_ids[2]
    else new.audience_user_ids[1]
  end;

  if other_user_id is null or other_user_id = auth.uid() then
    raise exception 'Direct chat recipient required.';
  end if;

  if not exists (
    select 1
      from public.friendships friendship
     where friendship.user_id = auth.uid()
       and friendship.friend_user_id = other_user_id
  ) then
    raise exception 'Direct chats require an existing friendship.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_direct_shared_chat_integrity() from public;
revoke all on function public.enforce_direct_shared_chat_integrity() from anon;
revoke all on function public.enforce_direct_shared_chat_integrity() from authenticated;

drop trigger if exists enforce_direct_shared_chat_integrity_trigger on public.shared_posts;
create trigger enforce_direct_shared_chat_integrity_trigger
  before insert or update of
    is_direct_chat,
    direct_chat_key,
    audience_user_ids,
    author_user_id,
    source_note_id,
    type,
    text,
    photo_path,
    capture_variant,
    dual_primary_photo_path,
    dual_secondary_photo_path,
    dual_primary_facing,
    dual_secondary_facing,
    dual_layout_preset,
    is_live_photo,
    paired_video_path
  on public.shared_posts
  for each row
  execute function public.enforce_direct_shared_chat_integrity();

commit;
