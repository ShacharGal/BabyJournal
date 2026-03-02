
-- Create a safe public view that excludes password
CREATE VIEW public.app_users_public
WITH (security_invoker = false) AS
  SELECT id, nickname, permission, created_at
  FROM public.app_users;

-- Grant access to the view
GRANT SELECT ON public.app_users_public TO anon, authenticated;
