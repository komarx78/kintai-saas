ALTER TABLE public.shift_roles ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
NOTIFY pgrst, 'reload schema';