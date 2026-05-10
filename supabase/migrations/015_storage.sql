-- Create storage bucket for task photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'task-photos',
  'task-photos',
  true,
  10485760,  -- 10 MB
  ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone (authenticated or anon) to upload/read task photos
DROP POLICY IF EXISTS "task_photos_select" ON storage.objects;
DROP POLICY IF EXISTS "task_photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "task_photos_delete" ON storage.objects;

CREATE POLICY "task_photos_select" ON storage.objects FOR SELECT USING (bucket_id = 'task-photos');
CREATE POLICY "task_photos_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'task-photos');
CREATE POLICY "task_photos_delete" ON storage.objects FOR DELETE USING (bucket_id = 'task-photos');

-- Apply size limit and MIME restriction to maintenance-photos bucket too
UPDATE storage.buckets
SET
  file_size_limit    = 10485760,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']
WHERE id = 'maintenance-photos';
