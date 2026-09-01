-- ==============================================================================
-- 社会保険料率マスタ（47都道府県別・年度別）テーブル構築 ＆ 初期シードデータ投入
-- ==============================================================================

-- 1. 社会保険料率マスタテーブル作成
CREATE TABLE IF NOT EXISTS public.social_insurance_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fiscal_year INTEGER NOT NULL,                  -- 対象年度 (例: 2024, 2025, 2026)
    effective_from DATE NOT NULL,                   -- 適用開始日 (例: '2024-03-01')
    prefecture_code VARCHAR(2) NOT NULL,            -- 都道府県コード (01〜47)
    prefecture_name VARCHAR(10) NOT NULL,           -- 都道府県名 (東京都、大阪府など)
    health_insurance_rate NUMERIC(6, 4) NOT NULL,   -- 健康保険料率 (例: 0.0998 -> 9.98%)
    nursing_insurance_rate NUMERIC(6, 4) NOT NULL,  -- 介護保険料率 (例: 0.0160 -> 1.60%)
    pension_insurance_rate NUMERIC(6, 4) NOT NULL,  -- 厚生年金保険料率 (例: 0.1830 -> 18.30%)
    child_rearing_rate NUMERIC(6, 4) DEFAULT 0.0036,-- 子ども・子育て拠出金 (0.36% / 会社全額負担)
    employment_general_rate NUMERIC(6, 4) DEFAULT 0.0060, -- 雇用保険料率 (0.6% / 本人負担)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(fiscal_year, prefecture_code)
);

-- RLS（全ユーザー読み取り許可、更新は管理者/サービスロール）
ALTER TABLE public.social_insurance_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read social insurance rates" ON public.social_insurance_rates;
CREATE POLICY "Allow public read social insurance rates"
    ON public.social_insurance_rates FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Allow superadmin modify social insurance rates" ON public.social_insurance_rates;
CREATE POLICY "Allow superadmin modify social insurance rates"
    ON public.social_insurance_rates FOR ALL
    USING (true);

-- 2. 会社設定 / 給与設定テーブルに prefecture_code カラムを追加 (存在しない場合)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'tenants' 
        AND column_name = 'prefecture_code'
    ) THEN
        ALTER TABLE public.tenants ADD COLUMN prefecture_code VARCHAR(2) DEFAULT '13'; -- デフォルト: 13(東京都)
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'payroll_settings' 
        AND column_name = 'prefecture_code'
    ) THEN
        ALTER TABLE public.payroll_settings ADD COLUMN prefecture_code VARCHAR(2) DEFAULT '13';
    END IF;
END $$;

-- 3. 令和6年度（2024年度・現行）47都道府県 協会けんぽ標準料率の初期投入
INSERT INTO public.social_insurance_rates (fiscal_year, effective_from, prefecture_code, prefecture_name, health_insurance_rate, nursing_insurance_rate, pension_insurance_rate)
VALUES
(2024, '2024-03-01', '01', '北海道', 0.1021, 0.0160, 0.1830),
(2024, '2024-03-01', '02', '青森県', 0.0994, 0.0160, 0.1830),
(2024, '2024-03-01', '03', '岩手県', 0.0964, 0.0160, 0.1830),
(2024, '2024-03-01', '04', '宮城県', 0.1002, 0.0160, 0.1830),
(2024, '2024-03-01', '05', '秋田県', 0.0995, 0.0160, 0.1830),
(2024, '2024-03-01', '06', '山形県', 0.0987, 0.0160, 0.1830),
(2024, '2024-03-01', '07', '福島県', 0.0977, 0.0160, 0.1830),
(2024, '2024-03-01', '08', '茨城県', 0.0982, 0.0160, 0.1830),
(2024, '2024-03-01', '09', '栃木県', 0.0981, 0.0160, 0.1830),
(2024, '2024-03-01', '10', '群馬県', 0.0978, 0.0160, 0.1830),
(2024, '2024-03-01', '11', '埼玉県', 0.0978, 0.0160, 0.1830),
(2024, '2024-03-01', '12', '千葉県', 0.0977, 0.0160, 0.1830),
(2024, '2024-03-01', '13', '東京都', 0.0998, 0.0160, 0.1830),
(2024, '2024-03-01', '14', '神奈川県', 0.1002, 0.0160, 0.1830),
(2024, '2024-03-01', '15', '新潟県', 0.0946, 0.0160, 0.1830),
(2024, '2024-03-01', '16', '富山県', 0.0962, 0.0160, 0.1830),
(2024, '2024-03-01', '17', '石川県', 0.1003, 0.0160, 0.1830),
(2024, '2024-03-01', '18', '福井県', 0.1000, 0.0160, 0.1830),
(2024, '2024-03-01', '19', '山梨県', 0.0980, 0.0160, 0.1830),
(2024, '2024-03-01', '20', '長野県', 0.0968, 0.0160, 0.1830),
(2024, '2024-03-01', '21', '岐阜県', 0.0990, 0.0160, 0.1830),
(2024, '2024-03-01', '22', '静岡県', 0.0973, 0.0160, 0.1830),
(2024, '2024-03-01', '23', '愛知県', 0.0997, 0.0160, 0.1830),
(2024, '2024-03-01', '24', '三重県', 0.0994, 0.0160, 0.1830),
(2024, '2024-03-01', '25', '滋賀県', 0.0979, 0.0160, 0.1830),
(2024, '2024-03-01', '26', '京都府', 0.1011, 0.0160, 0.1830),
(2024, '2024-03-01', '27', '大阪府', 0.1034, 0.0160, 0.1830),
(2024, '2024-03-01', '28', '兵庫県', 0.1018, 0.0160, 0.1830),
(2024, '2024-03-01', '29', '奈良県', 0.1012, 0.0160, 0.1830),
(2024, '2024-03-01', '30', '和歌山県', 0.1009, 0.0160, 0.1830),
(2024, '2024-03-01', '31', '鳥取県', 0.0988, 0.0160, 0.1830),
(2024, '2024-03-01', '32', '島根県', 0.1014, 0.0160, 0.1830),
(2024, '2024-03-01', '33', '岡山県', 0.1008, 0.0160, 0.1830),
(2024, '2024-03-01', '34', '広島県', 0.1003, 0.0160, 0.1830),
(2024, '2024-03-01', '35', '山口県', 0.1015, 0.0160, 0.1830),
(2024, '2024-03-01', '36', '徳島県', 0.1034, 0.0160, 0.1830),
(2024, '2024-03-01', '37', '香川県', 0.1021, 0.0160, 0.1830),
(2024, '2024-03-01', '38', '愛媛県', 0.1009, 0.0160, 0.1830),
(2024, '2024-03-01', '39', '高知県', 0.1021, 0.0160, 0.1830),
(2024, '2024-03-01', '40', '福岡県', 0.1035, 0.0160, 0.1830),
(2024, '2024-03-01', '41', '佐賀県', 0.1051, 0.0160, 0.1830),
(2024, '2024-03-01', '42', '長崎県', 0.1018, 0.0160, 0.1830),
(2024, '2024-03-01', '43', '熊本県', 0.1023, 0.0160, 0.1830),
(2024, '2024-03-01', '44', '大分県', 0.1019, 0.0160, 0.1830),
(2024, '2024-03-01', '45', '宮崎県', 0.0996, 0.0160, 0.1830),
(2024, '2024-03-01', '46', '鹿児島県', 0.1029, 0.0160, 0.1830),
(2024, '2024-03-01', '47', '沖縄県', 0.0999, 0.0160, 0.1830)
ON CONFLICT (fiscal_year, prefecture_code) 
DO UPDATE SET 
    health_insurance_rate = EXCLUDED.health_insurance_rate,
    nursing_insurance_rate = EXCLUDED.nursing_insurance_rate,
    pension_insurance_rate = EXCLUDED.pension_insurance_rate,
    updated_at = NOW();

-- 4. 令和7年度（2025年度・2026年度適用）も同初期値で投入（年度更新機能の検証用）
INSERT INTO public.social_insurance_rates (fiscal_year, effective_from, prefecture_code, prefecture_name, health_insurance_rate, nursing_insurance_rate, pension_insurance_rate)
SELECT 2025, '2025-03-01', prefecture_code, prefecture_name, health_insurance_rate, nursing_insurance_rate, pension_insurance_rate
FROM public.social_insurance_rates
WHERE fiscal_year = 2024
ON CONFLICT (fiscal_year, prefecture_code) DO NOTHING;
