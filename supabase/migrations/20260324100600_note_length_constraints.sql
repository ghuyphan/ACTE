-- Enforce 300 character limit on primary text fields
alter table public.notes add constraint notes_content_length check (char_length(content) <= 300);
alter table public.shared_posts add constraint shared_posts_text_length check (char_length(text) <= 300);
alter table public.room_posts add constraint room_posts_text_length check (char_length(text) <= 300);

-- Enforce 100 character limit on location fields
alter table public.notes add constraint notes_location_length check (location_name is null or char_length(location_name) <= 100);
alter table public.shared_posts add constraint shared_posts_place_length check (place_name is null or char_length(place_name) <= 100);
alter table public.room_posts add constraint room_posts_place_length check (place_name is null or char_length(place_name) <= 100);
