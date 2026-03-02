ALTER TABLE public.app_users DROP CONSTRAINT app_users_permission_check;
ALTER TABLE public.app_users ADD CONSTRAINT app_users_permission_check CHECK (permission IN ('full', 'view_only', 'add'));