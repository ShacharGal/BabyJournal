
-- Add audio columns to entries table
ALTER TABLE public.entries
  ADD COLUMN audio_storage_path text,
  ADD COLUMN audio_url text,
  ADD COLUMN audio_file_name text,
  ADD COLUMN audio_file_size integer;

-- Create audio storage bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio', 'audio', true);

-- Allow public read access to audio bucket
CREATE POLICY "Public read access for audio"
ON storage.objects FOR SELECT
USING (bucket_id = 'audio');

-- Allow authenticated insert/update/delete (all users can manage audio)
CREATE POLICY "Allow insert audio"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'audio');

CREATE POLICY "Allow update audio"
ON storage.objects FOR UPDATE
USING (bucket_id = 'audio');

CREATE POLICY "Allow delete audio"
ON storage.objects FOR DELETE
USING (bucket_id = 'audio');
