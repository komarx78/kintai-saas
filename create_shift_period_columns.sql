ALTER TABLE public.shift_settings
ADD COLUMN IF NOT EXISTS shift_period VARCHAR(20) DEFAULT '1week',
ADD COLUMN IF NOT EXISTS shift_start_day VARCHAR(20) DEFAULT 'monday';
