ALTER TABLE public.shift_settings
ADD COLUMN IF NOT EXISTS auto_lock_day INTEGER;
