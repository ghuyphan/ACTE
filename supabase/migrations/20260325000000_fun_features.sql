-- Migration to support Fun Features: Time Capsules and Geofenced Shared Posts

-- 1. Add location to shared_posts so friends can discover them via geofence
ALTER TABLE public.shared_posts 
ADD COLUMN latitude DOUBLE PRECISION,
ADD COLUMN longitude DOUBLE PRECISION;

-- 2. Add time capsule properties to notes
ALTER TABLE public.notes 
ADD COLUMN is_locked BOOLEAN DEFAULT false,
ADD COLUMN unlock_radius DOUBLE PRECISION DEFAULT 50;

-- 3. Add time capsule properties to shared_posts
ALTER TABLE public.shared_posts 
ADD COLUMN is_locked BOOLEAN DEFAULT false,
ADD COLUMN unlock_radius DOUBLE PRECISION DEFAULT 50;

-- Optional: Update view/functions if any depend on these directly, though standard SELECT * will pick them up.
