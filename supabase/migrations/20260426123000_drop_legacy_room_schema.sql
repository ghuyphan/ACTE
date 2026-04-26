begin;

drop policy if exists "room_post_media_select_member" on storage.objects;
drop policy if exists "room_post_media_insert_member" on storage.objects;
drop policy if exists "room_post_media_update_member" on storage.objects;
drop policy if exists "room_post_media_delete_author_or_owner" on storage.objects;

drop function if exists public.create_room_with_owner(text, text);
drop function if exists public.join_room_by_invite(text, text, text);
drop function if exists public.remove_room_member(text, uuid);
drop function if exists public.is_room_member(text, uuid);
drop function if exists public.is_room_owner(text, uuid);
drop function if exists public.touch_room_after_post();
drop function if exists public.delete_room_post_media_on_delete();

drop table if exists public.room_posts cascade;
drop table if exists public.room_invites cascade;
drop table if exists public.room_members cascade;
drop table if exists public.rooms cascade;

delete from storage.objects
 where bucket_id = 'room-post-media';

delete from storage.buckets
 where id = 'room-post-media';

commit;
