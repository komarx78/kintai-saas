ALTER TABLE public.shift_settings
ADD COLUMN IF NOT EXISTS is_submission_locked BOOLEAN DEFAULT false;
