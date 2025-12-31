-- Add User Images Migration
-- Add image_url fields to pilots and mechs tables
-- Create storage bucket for user-uploaded images with RLS policies

-- ============================================================================
-- PART 1: ADD IMAGE_URL COLUMNS
-- ============================================================================

-- Add image_url to pilots table
ALTER TABLE pilots ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add image_url to mechs table
ALTER TABLE mechs ADD COLUMN IF NOT EXISTS image_url TEXT;

-- ============================================================================
-- PART 2: CREATE STORAGE BUCKET
-- ============================================================================

-- Create the user-images bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-images',
  'user-images',
  true, -- Public bucket so images can be accessed via URL
  5242880, -- 5MB file size limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- PART 3: STORAGE RLS POLICIES
-- ============================================================================

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Users can upload images to their own folder
CREATE POLICY "Users can upload their own images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can update their own images
CREATE POLICY "Users can update their own images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'user-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'user-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can delete their own images
CREATE POLICY "Users can delete their own images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'user-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Anyone can view images (public bucket)
CREATE POLICY "Anyone can view images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'user-images');

-- ============================================================================
-- VERIFICATION QUERIES (commented out - run manually to verify)
-- ============================================================================

-- Verify image_url column added to pilots
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'pilots' AND column_name = 'image_url';

-- Verify image_url column added to mechs
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'mechs' AND column_name = 'image_url';

-- Verify bucket exists
-- SELECT * FROM storage.buckets WHERE id = 'user-images';

-- Verify policies exist
-- SELECT * FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';

