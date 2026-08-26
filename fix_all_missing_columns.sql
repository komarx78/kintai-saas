-- Ensure advanced_shift_requests has all necessary columns
ALTER TABLE public.advanced_shift_requests ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'submitted';

-- Ensure advanced_shifts has all necessary columns
ALTER TABLE public.advanced_shifts ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'confirmed';

NOTIFY pgrst, 'reload schema';