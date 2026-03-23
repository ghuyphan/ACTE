-- Migration to automatically delete files from Supabase Storage when the corresponding database row is deleted.

-- 1. Notes Cleanup Trigger
CREATE OR REPLACE FUNCTION public.delete_note_media_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.photo_path IS NOT NULL THEN
    DELETE FROM storage.objects WHERE bucket_id = 'note-media' AND name = OLD.photo_path;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS tr_delete_note_media ON public.notes;
CREATE TRIGGER tr_delete_note_media
  AFTER DELETE ON public.notes
  FOR EACH ROW
  EXECUTE PROCEDURE public.delete_note_media_on_delete();


-- 2. Shared Posts Cleanup Trigger
CREATE OR REPLACE FUNCTION public.delete_shared_post_media_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.photo_path IS NOT NULL THEN
    DELETE FROM storage.objects WHERE bucket_id = 'shared-post-media' AND name = OLD.photo_path;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS tr_delete_shared_post_media ON public.shared_posts;
CREATE TRIGGER tr_delete_shared_post_media
  AFTER DELETE ON public.shared_posts
  FOR EACH ROW
  EXECUTE PROCEDURE public.delete_shared_post_media_on_delete();


-- 3. Room Posts Cleanup Trigger
CREATE OR REPLACE FUNCTION public.delete_room_post_media_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.photo_path IS NOT NULL THEN
    DELETE FROM storage.objects WHERE bucket_id = 'room-post-media' AND name = OLD.photo_path;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS tr_delete_room_post_media ON public.room_posts;
CREATE TRIGGER tr_delete_room_post_media
  AFTER DELETE ON public.room_posts
  FOR EACH ROW
  EXECUTE PROCEDURE public.delete_room_post_media_on_delete();
