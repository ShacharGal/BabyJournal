-- ============================================================
-- BabyJournal — Complete Database Setup
-- ============================================================
-- Copy this ENTIRE script and paste it into your Supabase
-- SQL Editor (see SETUP.md for instructions).
-- It is safe to run this on a fresh Supabase project.
-- ============================================================

-- ==========================================
-- 1. CORE TABLES
-- ==========================================

-- Babies table — one row per child you're tracking
CREATE TABLE public.babies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  date_of_birth DATE,
  drive_folder_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- App users table — simple password-based login (no email needed)
CREATE TABLE public.app_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  password TEXT NOT NULL,
  nickname TEXT NOT NULL,
  permission TEXT NOT NULL DEFAULT 'view_only'
    CHECK (permission IN ('full', 'view_only', 'add')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Entries table — each memory (photo, video, audio, or text)
CREATE TABLE public.entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  baby_id UUID NOT NULL REFERENCES public.babies(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('photo', 'video', 'audio', 'text')),
  description TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  drive_file_id TEXT,
  thumbnail_url TEXT,
  duration INTEGER,
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  post_type TEXT NOT NULL DEFAULT 'standard',
  created_by UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  audio_storage_path TEXT,
  audio_url TEXT,
  audio_file_name TEXT,
  audio_file_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Entry images — additional photos attached to an entry (up to 4)
CREATE TABLE public.entry_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id UUID NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  drive_file_id TEXT,
  thumbnail_url TEXT,
  file_name TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tags table — labels you can attach to memories
CREATE TABLE public.tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Junction table linking entries to tags
CREATE TABLE public.entry_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id UUID NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(entry_id, tag_id)
);

-- Google OAuth tokens (single row — one Google account per instance)
CREATE TABLE public.google_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  access_token TEXT,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ==========================================
-- 2. AUTO-UPDATE TIMESTAMPS
-- ==========================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_babies_updated_at
  BEFORE UPDATE ON public.babies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_entries_updated_at
  BEFORE UPDATE ON public.entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_google_tokens_updated_at
  BEFORE UPDATE ON public.google_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ==========================================

ALTER TABLE public.babies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entry_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entry_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

-- Public tables — open access (app handles permissions in code)
CREATE POLICY "Allow all access to babies"      ON public.babies      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to entries"      ON public.entries      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to entry_images" ON public.entry_images FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to tags"         ON public.tags         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to entry_tags"   ON public.entry_tags   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to google_tokens" ON public.google_tokens FOR ALL USING (true) WITH CHECK (true);

-- app_users is LOCKED DOWN — only edge functions (service role) can access
CREATE POLICY "No public access to app_users"
  ON public.app_users FOR ALL USING (false) WITH CHECK (false);

-- ==========================================
-- 4. SAFE PUBLIC VIEW (hides passwords)
-- ==========================================

CREATE VIEW public.app_users_public
WITH (security_invoker = false) AS
  SELECT id, nickname, permission, created_at
  FROM public.app_users;

GRANT SELECT ON public.app_users_public TO anon, authenticated;

-- ==========================================
-- 5. INDEXES
-- ==========================================

CREATE INDEX idx_entries_baby_id ON public.entries(baby_id);
CREATE INDEX idx_entries_date ON public.entries(date DESC);
CREATE INDEX idx_entries_type ON public.entries(type);
CREATE INDEX idx_entry_tags_entry_id ON public.entry_tags(entry_id);
CREATE INDEX idx_entry_tags_tag_id ON public.entry_tags(tag_id);

-- ==========================================
-- 6. STORAGE BUCKETS
-- ==========================================

-- Thumbnails bucket (public read)
INSERT INTO storage.buckets (id, name, public) VALUES ('thumbnails', 'thumbnails', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Thumbnails are publicly readable" ON storage.objects FOR SELECT USING (bucket_id = 'thumbnails');
CREATE POLICY "Anyone can upload thumbnails"     ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'thumbnails');
CREATE POLICY "Anyone can delete thumbnails"     ON storage.objects FOR DELETE USING (bucket_id = 'thumbnails');

-- Audio bucket (public read)
INSERT INTO storage.buckets (id, name, public) VALUES ('audio', 'audio', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access for audio"  ON storage.objects FOR SELECT USING (bucket_id = 'audio');
CREATE POLICY "Allow insert audio"            ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'audio');
CREATE POLICY "Allow update audio"            ON storage.objects FOR UPDATE USING (bucket_id = 'audio');
CREATE POLICY "Allow delete audio"            ON storage.objects FOR DELETE USING (bucket_id = 'audio');

-- ==========================================
-- 7. DEFAULT TAGS
-- ==========================================

INSERT INTO public.tags (name, color) VALUES
  ('milestone', '#10b981'),
  ('first time', '#f59e0b'),
  ('funny', '#ec4899'),
  ('family', '#8b5cf6'),
  ('outdoors', '#06b6d4');

-- ============================================================
-- DONE! Your database is ready.
-- ============================================================
