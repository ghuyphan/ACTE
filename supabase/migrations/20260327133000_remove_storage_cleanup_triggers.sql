-- Supabase Storage now blocks direct SQL deletes against storage.objects.
-- Media cleanup must happen through the Storage API before the owning row is removed.

DROP TRIGGER IF EXISTS tr_delete_note_media ON public.notes;
DROP TRIGGER IF EXISTS tr_delete_shared_post_media ON public.shared_posts;
DROP TRIGGER IF EXISTS tr_delete_room_post_media ON public.room_posts;

DROP FUNCTION IF EXISTS public.delete_note_media_on_delete();
DROP FUNCTION IF EXISTS public.delete_shared_post_media_on_delete();
DROP FUNCTION IF EXISTS public.delete_room_post_media_on_delete();
