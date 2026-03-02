
-- Create thumbnails bucket (public read for displaying in feed)
INSERT INTO storage.buckets (id, name, public)
VALUES ('thumbnails', 'thumbnails', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read
CREATE POLICY "Thumbnails are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'thumbnails');

-- Allow authenticated inserts via service role (edge functions bypass RLS anyway)
-- But also allow anon inserts so the client can upload directly
CREATE POLICY "Anyone can upload thumbnails"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'thumbnails');

-- Allow deleting thumbnails
CREATE POLICY "Anyone can delete thumbnails"
ON storage.objects FOR DELETE
USING (bucket_id = 'thumbnails');
