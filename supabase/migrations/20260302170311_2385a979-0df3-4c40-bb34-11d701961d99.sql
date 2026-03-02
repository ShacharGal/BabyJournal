
-- Add created_by column to entries, referencing app_users
ALTER TABLE public.entries
ADD COLUMN created_by uuid REFERENCES public.app_users(id) ON DELETE SET NULL;
