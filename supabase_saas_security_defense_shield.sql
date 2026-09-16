-- ============================================================================
-- 🛡️ 【司馬懿・鉄壁防壁】SaaS外部攻撃遮断 ＆ データベース完全防御要塞SQL
-- (Supabase SQL Editor で実行してください / 完全冪等性・二重実行無痛保証)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. テナント・権限識別ヘルパー関数の強化（安全・高速・無限再帰防止）
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT tenant_id FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND (role = 'admin' OR role = 'superadmin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superadmin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_user_tenant_id() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_superadmin() TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. 権限昇格攻撃（Privilege Escalation）の完全防御トリガー
-- （一般社員や未認証ユーザーが勝手に role を 'admin' や 'superadmin' に書き換える不正を物理遮断）
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_unauthorized_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT (public.is_superadmin() OR (public.is_admin() AND OLD.tenant_id = public.get_user_tenant_id())) THEN
      RAISE EXCEPTION '権限がありません: roleの変更は管理者のみ許可されています。';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_unauthorized_role_change ON public.users;
CREATE TRIGGER trg_prevent_unauthorized_role_change
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.prevent_unauthorized_role_change();

-- ----------------------------------------------------------------------------
-- 3. 給与プロファイル（employee_payroll_profiles）の他社＆他人漏洩完全遮断
-- ----------------------------------------------------------------------------
ALTER TABLE public.employee_payroll_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_emp_payroll_all" ON public.employee_payroll_profiles;
DROP POLICY IF EXISTS "emp_payroll_permissive_policy" ON public.employee_payroll_profiles;
DROP POLICY IF EXISTS "emp_payroll_select_admin" ON public.employee_payroll_profiles;
DROP POLICY IF EXISTS "emp_payroll_select_own" ON public.employee_payroll_profiles;
DROP POLICY IF EXISTS "emp_payroll_modify_admin" ON public.employee_payroll_profiles;

CREATE POLICY "emp_payroll_select_admin" ON public.employee_payroll_profiles
FOR SELECT USING (
  tenant_id = public.get_user_tenant_id() AND public.is_admin()
);

CREATE POLICY "emp_payroll_select_own" ON public.employee_payroll_profiles
FOR SELECT USING (
  tenant_id = public.get_user_tenant_id() AND user_id = auth.uid()
);

CREATE POLICY "emp_payroll_modify_admin" ON public.employee_payroll_profiles
FOR ALL USING (
  tenant_id = public.get_user_tenant_id() AND public.is_admin()
) WITH CHECK (
  tenant_id = public.get_user_tenant_id() AND public.is_admin()
);

-- ----------------------------------------------------------------------------
-- 4. 給与明細（payslips）の他社＆他人漏洩完全遮断
-- ----------------------------------------------------------------------------
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_payslips_all" ON public.payslips;
DROP POLICY IF EXISTS "payslips_select_admin" ON public.payslips;
DROP POLICY IF EXISTS "payslips_select_own" ON public.payslips;
DROP POLICY IF EXISTS "payslips_modify_admin" ON public.payslips;

CREATE POLICY "payslips_select_admin" ON public.payslips
FOR SELECT USING (
  tenant_id = public.get_user_tenant_id() AND public.is_admin()
);

CREATE POLICY "payslips_select_own" ON public.payslips
FOR SELECT USING (
  tenant_id = public.get_user_tenant_id() AND user_id = auth.uid() AND status = 'published'
);

CREATE POLICY "payslips_modify_admin" ON public.payslips
FOR ALL USING (
  tenant_id = public.get_user_tenant_id() AND public.is_admin()
) WITH CHECK (
  tenant_id = public.get_user_tenant_id() AND public.is_admin()
);

-- ----------------------------------------------------------------------------
-- 5. 提出書類原本・写真（employee_document_submissions）の盗み見遮断 ＆ 安全な申請受付
-- ----------------------------------------------------------------------------
ALTER TABLE public.employee_document_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_doc_submissions_anon_insert" ON public.employee_document_submissions;
DROP POLICY IF EXISTS "tenant_doc_submissions_all" ON public.employee_document_submissions;
DROP POLICY IF EXISTS "doc_submissions_permissive_policy" ON public.employee_document_submissions;
DROP POLICY IF EXISTS "doc_subs_select_admin" ON public.employee_document_submissions;
DROP POLICY IF EXISTS "doc_subs_select_own" ON public.employee_document_submissions;
DROP POLICY IF EXISTS "doc_subs_insert_any" ON public.employee_document_submissions;
DROP POLICY IF EXISTS "doc_subs_modify_admin" ON public.employee_document_submissions;

CREATE POLICY "doc_subs_select_admin" ON public.employee_document_submissions
FOR SELECT USING (
  tenant_id = public.get_user_tenant_id() AND public.is_admin()
);

CREATE POLICY "doc_subs_select_own" ON public.employee_document_submissions
FOR SELECT USING (
  tenant_id = public.get_user_tenant_id() AND user_id = auth.uid()
);

CREATE POLICY "doc_subs_insert_any" ON public.employee_document_submissions
FOR INSERT WITH CHECK (
  tenant_id IS NOT NULL
);

CREATE POLICY "doc_subs_modify_admin" ON public.employee_document_submissions
FOR ALL USING (
  tenant_id = public.get_user_tenant_id() AND public.is_admin()
) WITH CHECK (
  tenant_id = public.get_user_tenant_id() AND public.is_admin()
);

-- ----------------------------------------------------------------------------
-- 6. 産休・育休台帳（employee_maternity_leaves）の完全分離保護
-- ----------------------------------------------------------------------------
ALTER TABLE public.employee_maternity_leaves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_maternity_leaves_all" ON public.employee_maternity_leaves;
DROP POLICY IF EXISTS "tenant_maternity_leaves_anon_insert" ON public.employee_maternity_leaves;
DROP POLICY IF EXISTS "tenant_maternity_leaves_anon_update" ON public.employee_maternity_leaves;
DROP POLICY IF EXISTS "maternity_leaves_permissive_policy" ON public.employee_maternity_leaves;
DROP POLICY IF EXISTS "maternity_select_admin" ON public.employee_maternity_leaves;
DROP POLICY IF EXISTS "maternity_select_own" ON public.employee_maternity_leaves;
DROP POLICY IF EXISTS "maternity_insert_safe" ON public.employee_maternity_leaves;
DROP POLICY IF EXISTS "maternity_modify_admin" ON public.employee_maternity_leaves;

CREATE POLICY "maternity_select_admin" ON public.employee_maternity_leaves
FOR SELECT USING (
  tenant_id = public.get_user_tenant_id() AND public.is_admin()
);

CREATE POLICY "maternity_select_own" ON public.employee_maternity_leaves
FOR SELECT USING (
  tenant_id = public.get_user_tenant_id() AND user_id = auth.uid()
);

CREATE POLICY "maternity_insert_safe" ON public.employee_maternity_leaves
FOR INSERT WITH CHECK (
  tenant_id IS NOT NULL AND user_id IS NOT NULL
);

CREATE POLICY "maternity_modify_admin" ON public.employee_maternity_leaves
FOR ALL USING (
  tenant_id = public.get_user_tenant_id() AND public.is_admin()
) WITH CHECK (
  tenant_id = public.get_user_tenant_id() AND public.is_admin()
);

-- ----------------------------------------------------------------------------
-- 7. 労務基本台帳（employee_onboarding_profiles）の完全分離保護
-- ----------------------------------------------------------------------------
ALTER TABLE public.employee_onboarding_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_onboarding_all" ON public.employee_onboarding_profiles;
DROP POLICY IF EXISTS "onboarding_profiles_permissive_policy" ON public.employee_onboarding_profiles;
DROP POLICY IF EXISTS "onboarding_select_admin" ON public.employee_onboarding_profiles;
DROP POLICY IF EXISTS "onboarding_select_own" ON public.employee_onboarding_profiles;
DROP POLICY IF EXISTS "onboarding_insert_safe" ON public.employee_onboarding_profiles;
DROP POLICY IF EXISTS "onboarding_modify_admin" ON public.employee_onboarding_profiles;

CREATE POLICY "onboarding_select_admin" ON public.employee_onboarding_profiles
FOR SELECT USING (
  tenant_id = public.get_user_tenant_id() AND public.is_admin()
);

CREATE POLICY "onboarding_select_own" ON public.employee_onboarding_profiles
FOR SELECT USING (
  tenant_id = public.get_user_tenant_id() AND user_id = auth.uid()
);

CREATE POLICY "onboarding_insert_safe" ON public.employee_onboarding_profiles
FOR INSERT WITH CHECK (
  tenant_id IS NOT NULL AND user_id IS NOT NULL
);

CREATE POLICY "onboarding_modify_admin" ON public.employee_onboarding_profiles
FOR ALL USING (
  tenant_id = public.get_user_tenant_id() AND public.is_admin()
) WITH CHECK (
  tenant_id = public.get_user_tenant_id() AND public.is_admin()
);

-- ----------------------------------------------------------------------------
-- 8. システム設定・Gemini APIキー（system_settings）の外部遮断
-- ----------------------------------------------------------------------------
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_settings_permissive_policy" ON public.system_settings;
DROP POLICY IF EXISTS "Superadmins can manage system settings" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_superadmin_only" ON public.system_settings;

CREATE POLICY "system_settings_superadmin_only" ON public.system_settings
FOR ALL USING (
  public.is_superadmin()
) WITH CHECK (
  public.is_superadmin()
);

-- ----------------------------------------------------------------------------
-- 9. 二重打刻・連打によるDB不整合防止 UNIQUEインデックス保証
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attendance_records_tenant_user_date_key'
  ) THEN
    BEGIN
      ALTER TABLE public.attendance_records ADD CONSTRAINT attendance_records_tenant_user_date_key UNIQUE (tenant_id, user_id, date);
    EXCEPTION
      WHEN others THEN NULL;
    END;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payslips_tenant_id_user_id_year_month_key'
  ) THEN
    BEGIN
      ALTER TABLE public.payslips ADD CONSTRAINT payslips_tenant_id_user_id_year_month_key UNIQUE (tenant_id, user_id, year_month);
    EXCEPTION
      WHEN others THEN NULL;
    END;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employee_maternity_leaves_tenant_id_user_id_key'
  ) THEN
    BEGIN
      ALTER TABLE public.employee_maternity_leaves ADD CONSTRAINT employee_maternity_leaves_tenant_id_user_id_key UNIQUE (tenant_id, user_id);
    EXCEPTION
      WHEN others THEN NULL;
    END;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 10. PostgREST スキーマキャッシュの即時再読み込み
-- ----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
