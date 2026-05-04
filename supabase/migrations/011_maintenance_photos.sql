-- Add photos array to maintenance_reports
ALTER TABLE public.maintenance_reports
  ADD COLUMN IF NOT EXISTS photos text[] NOT NULL DEFAULT '{}';

-- Create storage bucket for maintenance photos (run once)
INSERT INTO storage.buckets (id, name, public)
VALUES ('maintenance-photos', 'maintenance-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone (authenticated or anon) to upload/read maintenance photos
CREATE POLICY "maint_photos_select" ON storage.objects FOR SELECT USING (bucket_id = 'maintenance-photos');
CREATE POLICY "maint_photos_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'maintenance-photos');
CREATE POLICY "maint_photos_delete" ON storage.objects FOR DELETE USING (bucket_id = 'maintenance-photos');
