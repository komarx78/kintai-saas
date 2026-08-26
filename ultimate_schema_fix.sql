-- Create or update advanced_shift_requests
CREATE TABLE IF NOT EXISTS public.advanced_shift_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    target_date DATE NOT NULL,
    available_start_time TIME,
    available_end_time TIME,
    status VARCHAR(50) DEFAULT 'submitted',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist
ALTER TABLE public.advanced_shift_requests ADD COLUMN IF NOT EXISTS target_date DATE;
ALTER TABLE public.advanced_shift_requests ADD COLUMN IF NOT EXISTS available_start_time TIME;
ALTER TABLE public.advanced_shift_requests ADD COLUMN IF NOT EXISTS available_end_time TIME;
ALTER TABLE public.advanced_shift_requests ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'submitted';

-- Create or update advanced_shifts
CREATE TABLE IF NOT EXISTS public.advanced_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    target_date DATE NOT NULL,
    role VARCHAR(100),
    start_time TIME,
    end_time TIME,
    status VARCHAR(50) DEFAULT 'confirmed',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist
ALTER TABLE public.advanced_shifts ADD COLUMN IF NOT EXISTS target_date DATE;
ALTER TABLE public.advanced_shifts ADD COLUMN IF NOT EXISTS role VARCHAR(100);
ALTER TABLE public.advanced_shifts ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE public.advanced_shifts ADD COLUMN IF NOT EXISTS end_time TIME;
ALTER TABLE public.advanced_shifts ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'confirmed';

NOTIFY pgrst, 'reload schema';