INSERT INTO public.user_roles (user_id, role) VALUES ('652a3387-2b36-4fb4-a5f5-6565d2ba6dfd', 'admin') ON CONFLICT (user_id, role) DO NOTHING;

UPDATE auth.users SET email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE id = '652a3387-2b36-4fb4-a5f5-6565d2ba6dfd';