-- Create babies table
CREATE TABLE public.babies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  drive_folder_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create entries table
CREATE TABLE public.entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  baby_id UUID NOT NULL REFERENCES public.babies(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('photo', 'video', 'audio', 'text')),
  description TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  drive_file_id TEXT,
  thumbnail_url TEXT,
  duration INTEGER, -- in seconds, for audio/video
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tags table
CREATE TABLE public.tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create entry_tags junction table
CREATE TABLE public.entry_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id UUID NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(entry_id, tag_id)
);

-- Create google_tokens table (single row for the single user)
CREATE TABLE public.google_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  access_token TEXT,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_babies_updated_at
  BEFORE UPDATE ON public.babies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_entries_updated_at
  BEFORE UPDATE ON public.entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_google_tokens_updated_at
  BEFORE UPDATE ON public.google_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS on all tables (but allow all access since single-user app)
ALTER TABLE public.babies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entry_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_tokens ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for single-user app (no auth required)
CREATE POLICY "Allow all access to babies" ON public.babies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to entries" ON public.entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to tags" ON public.tags FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to entry_tags" ON public.entry_tags FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to google_tokens" ON public.google_tokens FOR ALL USING (true) WITH CHECK (true);

-- Insert some default tags
INSERT INTO public.tags (name, color) VALUES
  ('milestone', '#10b981'),
  ('first time', '#f59e0b'),
  ('funny', '#ec4899'),
  ('family', '#8b5cf6'),
  ('outdoors', '#06b6d4');

-- Create indexes for better query performance
CREATE INDEX idx_entries_baby_id ON public.entries(baby_id);
CREATE INDEX idx_entries_date ON public.entries(date DESC);
CREATE INDEX idx_entries_type ON public.entries(type);
CREATE INDEX idx_entry_tags_entry_id ON public.entry_tags(entry_id);
CREATE INDEX idx_entry_tags_tag_id ON public.entry_tags(tag_id);