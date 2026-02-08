-- Create app_users table for simple password-based login
CREATE TABLE public.app_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  password TEXT NOT NULL,
  nickname TEXT NOT NULL,
  permission TEXT NOT NULL DEFAULT 'view_only' CHECK (permission IN ('full', 'view_only')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

-- No public access - only service role (edge functions) can read this table
-- This keeps passwords secure from frontend access
CREATE POLICY "No public access to app_users"
ON public.app_users
FOR ALL
USING (false)
WITH CHECK (false);