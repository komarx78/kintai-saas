-- 勤怠記録（attendance_records）テーブルをアプリの仕様に合わせて再構築するSQL

-- 1. 古いテーブルを削除
DROP TABLE IF EXISTS public.attendance_records CASCADE;

-- 2. 新しいテーブル（1日1レコード形式）を作成
CREATE TABLE public.attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    check_in_time TIME,
    check_out_time TIME,
    break_minutes INT DEFAULT 60,
    status VARCHAR(50) DEFAULT '勤務中',
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, date) -- 同じ日に2重で出勤記録が作られないように制限
);

-- 3. セキュリティポリシー（RLS）の再設定
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tenant attendance" ON public.attendance_records FOR SELECT USING (
  tenant_id = get_user_tenant_id()
);

CREATE POLICY "Users can insert own attendance" ON public.attendance_records FOR INSERT WITH CHECK (
  user_id = auth.uid() AND tenant_id = get_user_tenant_id()
);

-- 退勤時のUPDATEを許可するポリシー
CREATE POLICY "Users can update own attendance" ON public.attendance_records FOR UPDATE USING (
  user_id = auth.uid() AND tenant_id = get_user_tenant_id()
);

-- 管理者は全ての記録を更新できるポリシー（修正申請などで使用）
CREATE POLICY "Admins can update tenant attendance" ON public.attendance_records FOR UPDATE USING (
  is_admin() AND tenant_id = get_user_tenant_id()
);
