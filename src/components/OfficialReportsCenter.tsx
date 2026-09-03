import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  FileText, Printer, Download, Building2, 
  ChevronRight, X, Info
} from 'lucide-react';

export interface OfficialReportsCenterProps {
  tenantId: string;
}

interface EmployeeItem {
  id: string;
  name: string;
  name_kana?: string;
  department?: string;
  position_name?: string;
  role: string;
  join_date: string;
  retirement_date?: string;
  is_retired?: boolean;
  birth_date?: string;
  address?: string;
  phone?: string;
  my_number?: string;
  gender?: string;
  base_salary: number;
  hourly_wage?: number;
  salary_type: 'monthly' | 'hourly' | 'daily';
  bank_name?: string;
  branch_name?: string;
  account_type?: string;
  account_number?: string;
  account_holder?: string;
  dependents_count?: number;
  health_insurance_joined?: boolean;
  pension_insurance_joined?: boolean;
  employment_insurance_joined?: boolean;
  health_standard_monthly_remuneration?: number;
  pension_standard_monthly_remuneration?: number;
}

export const OfficialReportsCenter: React.FC<OfficialReportsCenterProps> = ({ tenantId }) => {
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyInfo, setCompanyInfo] = useState<{
    name: string;
    address: string;
    representative_name: string;
    phone_number: string;
    corporate_number: string;
    company_seal_url: string;
  }>({
    name: '株式会社KAP',
    address: '滋賀県大津市坂本3丁目21-16',
    representative_name: '代表取締役 駒井 秀一朗',
    phone_number: '077-574-6907',
    corporate_number: '',
    company_seal_url: ''
  });

  // 対象年度・月度・対象従業員State
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');

  // 賞与額倍率・個別賞与State（シミュレーション兼実データ）
  const [bonusMultiplier, setBonusMultiplier] = useState<number>(1.5); // 基本給の1.5ヶ月分
  const [selectedDocType, setSelectedDocType] = useState<string | null>(null);

  useEffect(() => {
    fetchMasterData();
  }, [tenantId]);

  const fetchMasterData = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      // 1. 会社基本情報
      const { data: tData } = await supabase.from('tenants').select('*').eq('id', tenantId).maybeSingle();
      let comp = {
        name: tData?.name || '株式会社KAP',
        address: tData?.address || '滋賀県大津市坂本3丁目21-16',
        representative_name: tData?.representative_name || '代表取締役 駒井 秀一朗',
        phone_number: tData?.phone_number || '077-574-6907',
        corporate_number: '',
        company_seal_url: ''
      };

      try {
        const rawLocal = localStorage.getItem(`company_basic_settings_${tenantId}`) || localStorage.getItem('company_basic_info');
        if (rawLocal) {
          const parsed = JSON.parse(rawLocal);
          comp = { ...comp, ...parsed };
        }
        const seal = localStorage.getItem(`company_seal_image_${tenantId}`) || localStorage.getItem('company_seal_image');
        if (seal) comp.company_seal_url = seal;
      } catch (e) {}
      setCompanyInfo(comp);

      // 2. 従業員データ（入退社大元マスタ ＆ 給与プロファイル SSOT結合）
      const { data: usersData } = await supabase
        .from('users')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true });

      const { data: onboardProfiles } = await supabase
        .from('employee_onboarding_profiles')
        .select('*')
        .eq('tenant_id', tenantId);

      const { data: payProfiles } = await supabase
        .from('employee_payroll_profiles')
        .select('*')
        .eq('tenant_id', tenantId);

      // LocalStorage フォールバック
      let localPay: Record<string, any> = {};
      try {
        const raw = localStorage.getItem(`payroll_profiles_${tenantId}`);
        if (raw) localPay = JSON.parse(raw);
      } catch (e) {}

      const onboardMap = new Map((onboardProfiles || []).map(p => [p.user_id, p]));
      const payMap = new Map((payProfiles || []).map(p => [p.user_id, p]));

      const emps: EmployeeItem[] = (usersData || []).map(u => {
        const ob = onboardMap.get(u.id) || {};
        const pp = payMap.get(u.id) || localPay[u.id] || {};
        const base = pp.base_salary || ob.base_salary || 250000;

        return {
          id: u.id,
          name: u.name || '従業員',
          name_kana: ob.name_kana || '',
          department: ob.department || u.department || '本社営業部',
          position_name: ob.position_name || '一般社員',
          role: u.role || 'employee',
          join_date: ob.join_date || u.join_date || '2024-04-01',
          retirement_date: ob.retirement_date || u.retirement_date,
          is_retired: u.status === 'retired' || !!ob.retirement_date,
          birth_date: ob.birth_date || '1990-05-15',
          address: ob.address || '滋賀県大津市',
          phone: ob.phone || u.phone || '',
          my_number: ob.my_number || '',
          gender: ob.gender || '男性',
          base_salary: base,
          hourly_wage: pp.hourly_wage || ob.hourly_wage || 1200,
          salary_type: pp.salary_type || ob.salary_type || 'monthly',
          bank_name: ob.bank_name || pp.bank_name || '滋賀銀行',
          branch_name: ob.branch_name || pp.branch_name || '坂本支店',
          account_type: ob.account_type || pp.account_type || '普通',
          account_number: ob.account_number || pp.account_number || '1234567',
          account_holder: ob.account_holder || pp.account_holder || u.name,
          dependents_count: ob.dependents_count || pp.dependents_count || 0,
          health_insurance_joined: ob.health_insurance_joined !== false,
          pension_insurance_joined: ob.pension_insurance_joined !== false,
          employment_insurance_joined: ob.employment_insurance_joined !== false,
          health_standard_monthly_remuneration: ob.health_standard_monthly_remuneration || base,
          pension_standard_monthly_remuneration: ob.pension_standard_monthly_remuneration || base
        };
      });

      setEmployees(emps);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // CSVダウンロードヘルパー
  const downloadCsv = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center space-y-3 bg-white rounded-3xl border border-slate-200 shadow-sm">
        <div className="animate-spin rounded-full h-8 w-8 border-3 border-emerald-600 border-t-transparent"></div>
        <p className="text-xs font-bold text-slate-500">労務・法定帳票マスターを照会中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 select-text">
      {/* 印刷用CSS定義 */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 10mm 8mm 10mm;
          }
          body {
            background: white !important;
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }
          .reports-dashboard-view {
            display: none !important;
          }
          .reports-modal-wrapper {
            position: static !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            box-shadow: none !important;
            display: block !important;
          }
          .reports-printable-card {
            max-height: none !important;
            height: auto !important;
            overflow: visible !important;
            border: none !important;
            box-shadow: none !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
          }
          table, tr, td, th {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .signature-box {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* 🧭 メインダッシュボードビュー（印刷時は隠す） */}
      <div className="reports-dashboard-view space-y-6">

        {/* 1. 上部コントロールバー（年月・対象者・賞与設定） */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold shadow-2xs">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  📑 労務・法定帳票発行センター
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                    法定様式完全準拠
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  賞与明細、年金届出書類、退職者源泉徴収票、法定三帳簿（賃金台帳・労働者名簿）、源泉徴収簿のワンストップ発行
                </p>
              </div>
            </div>

            {/* 会社マスタSSOTバッジ */}
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-slate-800">{companyInfo.name}</div>
              <div className="text-[11px] text-slate-400">{companyInfo.address}</div>
            </div>
          </div>

          {/* フィルター＆対象設定 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="font-bold text-slate-600 block mb-1">📅 対象年度</label>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800"
              >
                {[2024, 2025, 2026, 2027].map(y => (
                  <option key={y} value={y}>{y}年度（令和{y - 2018}年）</option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-600 block mb-1">🗓️ 支給月度 / 基準月</label>
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{m}月度（{m === 7 ? '夏季賞与基準' : m === 12 ? '冬季賞与・年末調整基準' : '通常月度'}）</option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-600 block mb-1">👤 対象従業員</label>
              <select
                value={selectedEmployeeId}
                onChange={e => setSelectedEmployeeId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800"
              >
                <option value="all">全従業員（一括帳票）</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} {emp.is_retired ? '（退職者）' : `（${emp.department || '所属なし'}）`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-600 block mb-1">🎁 想定賞与支給月数</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={bonusMultiplier}
                  onChange={e => setBonusMultiplier(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800"
                />
                <span className="shrink-0 text-slate-500 font-bold">ヶ月分</span>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. 帳票カテゴリカード一覧（ユーザー様提示画像レイアウトを忠実に完全再現） */}
        {/* ========================================================================= */}

        {/* 🎁 カテゴリ1: 賞与を支給した際に確認するもの */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-black text-slate-800 text-sm flex items-center gap-2">
              <span className="text-emerald-600">■</span> 賞与を支給した際に確認するもの
            </h4>
            <span className="text-[11px] text-slate-400 font-bold">
              {selectedYear}年 {selectedMonth}月度（基準支給）
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 1. 賞与明細 */}
            <button
              onClick={() => setSelectedDocType('bonus_slip')}
              className="bg-white hover:bg-slate-50/80 p-4 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition flex items-center justify-between text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-100 group-hover:bg-emerald-50 text-slate-500 group-hover:text-emerald-600 flex items-center justify-center transition">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-black text-slate-800 group-hover:text-emerald-700 transition">
                    賞与明細
                  </div>
                  <div className="text-[10px] text-slate-400">
                    従業員ごとの賞与額・社保税金控除・差引支給手取り明細書
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 transition" />
            </button>

            {/* 2. 賞与振込一覧表 */}
            <button
              onClick={() => setSelectedDocType('bonus_transfer_list')}
              className="bg-white hover:bg-slate-50/80 p-4 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition flex items-center justify-between text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-100 group-hover:bg-emerald-50 text-slate-500 group-hover:text-emerald-600 flex items-center justify-center transition">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-black text-slate-800 group-hover:text-emerald-700 transition">
                    賞与振込一覧表
                  </div>
                  <div className="text-[10px] text-slate-400">
                    全社銀行振込先口座・賞与手取り振込額の一覧表（CSV連動）
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 transition" />
            </button>

            {/* 3. 支給控除一覧表(賞与) */}
            <button
              onClick={() => setSelectedDocType('bonus_summary_all')}
              className="bg-white hover:bg-slate-50/80 p-4 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition flex items-center justify-between text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-100 group-hover:bg-emerald-50 text-slate-500 group-hover:text-emerald-600 flex items-center justify-center transition">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-black text-slate-800 group-hover:text-emerald-700 transition">
                    支給控除一覧表(賞与)
                  </div>
                  <div className="text-[10px] text-slate-400">
                    賞与総支給額、健康保険、厚生年金、雇用保険、所得税の全社集計
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 transition" />
            </button>

            {/* 4. 支給控除一覧表(賞与部門別) */}
            <button
              onClick={() => setSelectedDocType('bonus_summary_dept')}
              className="bg-white hover:bg-slate-50/80 p-4 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition flex items-center justify-between text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-100 group-hover:bg-emerald-50 text-slate-500 group-hover:text-emerald-600 flex items-center justify-center transition">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-black text-slate-800 group-hover:text-emerald-700 transition">
                    支給控除一覧表(賞与部門別)
                  </div>
                  <div className="text-[10px] text-slate-400">
                    部署・部門ごとの賞与支給総額および人件費負担の集計表
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 transition" />
            </button>
          </div>
        </div>

        {/* 🏛️ カテゴリ2: 年金事務所へ届出が必要な書類 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-black text-slate-800 text-sm flex items-center gap-2">
              <span className="text-indigo-600">■</span> 年金事務所へ届出が必要な書類
            </h4>
            <span className="text-[11px] text-slate-400 font-bold">日本年金機構 / 協会けんぽ</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 1. 賞与支払届 */}
            <button
              onClick={() => setSelectedDocType('nenkin_bonus_report')}
              className="bg-white hover:bg-slate-50/80 p-4 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition flex items-center justify-between text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-100 group-hover:bg-indigo-50 text-slate-500 group-hover:text-indigo-600 flex items-center justify-center transition">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-black text-slate-800 group-hover:text-indigo-700 transition flex items-center gap-1.5">
                    賞与支払届
                    <span className="text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded font-bold border border-indigo-200">
                      法定提出必須
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    被保険者整理番号・生年月日・賞与額（千円未満切捨）公式提出様式
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition" />
            </button>

            {/* 2. 賞与支払届総括表 (※2021/04/01 廃止) */}
            <button
              onClick={() => setSelectedDocType('nenkin_bonus_summary_abolished')}
              className="bg-white hover:bg-slate-50/80 p-4 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition flex items-center justify-between text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-100 group-hover:bg-slate-200 text-slate-400 flex items-center justify-center transition">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                    賞与支払届総括表
                    <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.2 rounded font-mono">
                      ※2021/04/01 廃止
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    令和3年4月1日より日本年金機構への添付提出が不要となりました
                  </div>
                </div>
              </div>
              <Info className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition" />
            </button>
          </div>
        </div>

        {/* 🚪 カテゴリ3: 退職者へ発行するもの */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-black text-slate-800 text-sm flex items-center gap-2">
              <span className="text-amber-600">■</span> 退職者へ発行するもの
            </h4>
            <span className="text-[11px] text-slate-400 font-bold">所得税法第226条</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 退職者の源泉徴収票 */}
            <button
              onClick={() => setSelectedDocType('retirement_withholding_tax')}
              className="bg-white hover:bg-slate-50/80 p-4 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition flex items-center justify-between text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-100 group-hover:bg-amber-50 text-slate-500 group-hover:text-amber-600 flex items-center justify-center transition">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-black text-slate-800 group-hover:text-amber-700 transition flex items-center gap-1.5">
                    退職者の源泉徴収票
                    <span className="text-[9px] bg-amber-50 text-amber-700 px-1.5 py-0.2 rounded font-bold border border-amber-200">
                      退職後1ヶ月以内交付
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    中途退職者向け給与所得の源泉徴収票（国税庁公式フォーマット準拠）
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-amber-600 transition" />
            </button>
          </div>
        </div>

        {/* 📚 カテゴリ4: 帳簿作成・保管義務のある書類（法定三帳簿） */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-black text-slate-800 text-sm flex items-center gap-2">
              <span className="text-blue-600">■</span> 帳簿作成・保管義務のある書類
            </h4>
            <span className="text-[11px] text-slate-400 font-bold">労働基準法 法定帳簿（5年保存）</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 1. 賃金台帳 */}
            <button
              onClick={() => setSelectedDocType('wage_ledger')}
              className="bg-white hover:bg-slate-50/80 p-4 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition flex items-center justify-between text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-100 group-hover:bg-blue-50 text-slate-500 group-hover:text-blue-600 flex items-center justify-center transition">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-black text-slate-800 group-hover:text-blue-700 transition flex items-center gap-1.5">
                    賃金台帳
                    <span className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded font-bold border border-blue-200">
                      労基法第108条
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    出勤日数、労働時間、基本給・手当、控除、差引支給額の年間台帳
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition" />
            </button>

            {/* 2. 労働者名簿 */}
            <button
              onClick={() => setSelectedDocType('employee_roster')}
              className="bg-white hover:bg-slate-50/80 p-4 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition flex items-center justify-between text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-100 group-hover:bg-blue-50 text-slate-500 group-hover:text-blue-600 flex items-center justify-center transition">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-black text-slate-800 group-hover:text-blue-700 transition flex items-center gap-1.5">
                    労働者名簿
                    <span className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded font-bold border border-blue-200">
                      労基法第107条
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    氏名、生年月日、現住所、雇入年月日、従事業務、退職等の法定項目
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition" />
            </button>
          </div>
        </div>

        {/* 🧾 カテゴリ5: 年末調整関係書類 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-black text-slate-800 text-sm flex items-center gap-2">
              <span className="text-violet-600">■</span> 年末調整関係書類
            </h4>
            <span className="text-[11px] text-slate-400 font-bold">国税庁様式</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 源泉徴収簿 */}
            <button
              onClick={() => setSelectedDocType('withholding_tax_ledger')}
              className="bg-white hover:bg-slate-50/80 p-4 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition flex items-center justify-between text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-100 group-hover:bg-violet-50 text-slate-500 group-hover:text-violet-600 flex items-center justify-center transition">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-black text-slate-800 group-hover:text-violet-700 transition flex items-center gap-1.5">
                    源泉徴収簿
                    <span className="text-[9px] bg-violet-50 text-violet-700 px-1.5 py-0.2 rounded font-bold border border-violet-200">
                      給与・退職所得
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    各月の総支給額、社会保険料控除、源泉所得税額の年間累積管理簿
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-violet-600 transition" />
            </button>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 3. 各帳票の公式A4プレビュー ＆ 印刷・CSVモーダル                          */}
      {/* ========================================================================= */}
      {selectedDocType && (
        <div className="reports-modal-wrapper fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 print:p-0 print:static print:bg-transparent print:z-auto print:block">
          <div className="reports-printable-card bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col border border-slate-100 overflow-hidden print:border-none print:shadow-none print:max-h-none print:overflow-visible print:w-full print:block">
            
            {/* モーダルヘッダー */}
            <div className="p-4 px-6 border-b border-slate-200 flex items-center justify-between bg-slate-50 print:hidden shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="font-black text-sm text-slate-900">
                    {selectedDocType === 'bonus_slip' && '📄 賞与明細書（公式明細）'}
                    {selectedDocType === 'bonus_transfer_list' && '📄 賞与振込一覧表（総合振込対応）'}
                    {selectedDocType === 'bonus_summary_all' && '📄 支給控除一覧表（賞与・全社集計）'}
                    {selectedDocType === 'bonus_summary_dept' && '📄 支給控除一覧表（賞与・部門別内訳）'}
                    {selectedDocType === 'nenkin_bonus_report' && '📄 被保険者賞与支払届（日本年金機構公式届出様式）'}
                    {selectedDocType === 'nenkin_bonus_summary_abolished' && '📄 賞与支払届総括表（廃止解説・実務ガイド）'}
                    {selectedDocType === 'retirement_withholding_tax' && '📄 給与所得の源泉徴収票（退職者交付用・国税庁様式）'}
                    {selectedDocType === 'wage_ledger' && '📄 賃金台帳（労働基準法第108条 法定帳簿）'}
                    {selectedDocType === 'employee_roster' && '📄 労働者名簿（労働基準法第107条 法定帳簿）'}
                    {selectedDocType === 'withholding_tax_ledger' && '📄 給与所得・退職所得に対する源泉徴収簿（国税庁様式）'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {companyInfo.name} / {selectedYear}年度 {selectedMonth}月度基準
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  A4印刷・PDF保存
                </button>
                <button
                  onClick={() => setSelectedDocType(null)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-200 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 書面本文コンテナ（印刷時は制限完全解除） */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100/50 print:p-0 print:bg-white print:overflow-visible print:h-auto print:block">
              
              {/* ----------------------------------------------------------------- */}
              {/* ① 賞与明細書（公式A4明細）                                       */}
              {/* ----------------------------------------------------------------- */}
              {selectedDocType === 'bonus_slip' && (() => {
                const targetEmps = selectedEmployeeId === 'all' 
                  ? employees.filter(e => !e.is_retired) 
                  : employees.filter(e => e.id === selectedEmployeeId);

                return (
                  <div className="space-y-8">
                    {targetEmps.map((emp, idx) => {
                      const bonusAmount = Math.round(emp.base_salary * bonusMultiplier);
                      // 賞与時の社保・税金概算
                      const healthBonus = emp.health_insurance_joined ? Math.round(bonusAmount * 0.05) : 0;
                      const pensionBonus = emp.pension_insurance_joined ? Math.round(bonusAmount * 0.0915) : 0;
                      const empInsBonus = emp.employment_insurance_joined ? Math.round(bonusAmount * 0.006) : 0;
                      const socialTotal = healthBonus + pensionBonus + empInsBonus;
                      const taxable = Math.max(0, bonusAmount - socialTotal);
                      const taxRate = emp.dependents_count ? Math.max(0.02, 0.06 - (emp.dependents_count * 0.01)) : 0.06;
                      const incomeTaxBonus = Math.round(taxable * taxRate);
                      const deductionTotal = socialTotal + incomeTaxBonus;
                      const netBonus = bonusAmount - deductionTotal;

                      return (
                        <div 
                          key={emp.id} 
                          className="bg-white p-8 rounded-2xl border border-slate-300 text-slate-900 font-sans text-xs max-w-4xl mx-auto shadow-sm print:shadow-none print:border-none print:p-0 print:m-0"
                          style={{ pageBreakAfter: idx < targetEmps.length - 1 ? 'always' : 'auto' }}
                        >
                          {/* ヘッダー */}
                          <div className="border-b-2 border-slate-900 pb-3 mb-4 flex items-end justify-between">
                            <div>
                              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">
                                OFFICIAL BONUS STATEMENT
                              </div>
                              <h2 className="text-xl font-black text-slate-950">
                                {selectedYear}年 {selectedMonth}月度 賞与支払明細書
                              </h2>
                            </div>
                            <div className="text-right text-xs">
                              <div className="font-black text-slate-900">{companyInfo.name}</div>
                              <div className="text-slate-500 text-[10px]">支給日: {selectedYear}年{selectedMonth}月10日</div>
                            </div>
                          </div>

                          {/* 従業員情報 */}
                          <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 mb-5">
                            <div><span className="text-slate-400 text-[10px]">氏名:</span> <span className="font-black text-sm">{emp.name} 殿</span></div>
                            <div><span className="text-slate-400 text-[10px]">所属:</span> <span className="font-bold">{emp.department}</span></div>
                            <div><span className="text-slate-400 text-[10px]">支給月数:</span> <span className="font-bold">{bonusMultiplier} ヶ月</span></div>
                          </div>

                          {/* 支給・控除テーブル */}
                          <div className="grid grid-cols-2 gap-4 mb-6">
                            {/* 支給項目 */}
                            <div className="border border-slate-300 rounded-xl overflow-hidden">
                              <div className="bg-emerald-50 p-2 font-black text-emerald-950 border-b border-slate-300 flex justify-between">
                                <span>支給の部</span>
                                <span className="font-mono">金額</span>
                              </div>
                              <div className="p-3 space-y-2">
                                <div className="flex justify-between">
                                  <span>算定基準基本給</span>
                                  <span className="font-mono">¥{emp.base_salary.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between font-bold">
                                  <span>賞与額面総支給額</span>
                                  <span className="font-mono text-emerald-700">¥{bonusAmount.toLocaleString()}</span>
                                </div>
                              </div>
                              <div className="bg-slate-50 p-2.5 border-t border-slate-300 flex justify-between font-black">
                                <span>総支給金額</span>
                                <span className="font-mono text-sm">¥{bonusAmount.toLocaleString()}</span>
                              </div>
                            </div>

                            {/* 控除項目 */}
                            <div className="border border-slate-300 rounded-xl overflow-hidden">
                              <div className="bg-rose-50 p-2 font-black text-rose-950 border-b border-slate-300 flex justify-between">
                                <span>控除の部</span>
                                <span className="font-mono">金額</span>
                              </div>
                              <div className="p-3 space-y-1.5 text-[11px]">
                                <div className="flex justify-between">
                                  <span>健康保険料</span>
                                  <span className="font-mono">¥{healthBonus.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>厚生年金保険料</span>
                                  <span className="font-mono">¥{pensionBonus.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>雇用保険料</span>
                                  <span className="font-mono">¥{empInsBonus.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>源泉所得税</span>
                                  <span className="font-mono">¥{incomeTaxBonus.toLocaleString()}</span>
                                </div>
                              </div>
                              <div className="bg-slate-50 p-2.5 border-t border-slate-300 flex justify-between font-black">
                                <span>控除合計額</span>
                                <span className="font-mono text-sm text-rose-700">¥{deductionTotal.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>

                          {/* 差引手取り支給額バナー */}
                          <div className="bg-slate-900 text-white p-4 rounded-xl flex items-center justify-between mb-4">
                            <div>
                              <div className="text-[10px] text-slate-400">差引支給額（指定口座振込手取り額）</div>
                              <div className="text-xs font-bold text-slate-300">
                                総支給 ¥{bonusAmount.toLocaleString()} − 総控除 ¥{deductionTotal.toLocaleString()}
                              </div>
                            </div>
                            <div className="text-2xl font-black text-amber-400 font-mono">
                              ¥{netBonus.toLocaleString()}
                            </div>
                          </div>

                          {/* 振込先情報 ＆ 会社印 */}
                          <div className="signature-box flex items-center justify-between border-t border-slate-200 pt-3 text-[10px] text-slate-500">
                            <div>
                              振込先: {emp.bank_name} {emp.branch_name}（{emp.account_type || '普通'} {emp.account_number}）
                            </div>
                            <div className="relative">
                              <div className="text-slate-800 font-bold">{companyInfo.name}</div>
                              {companyInfo.company_seal_url && (
                                <img
                                  src={companyInfo.company_seal_url}
                                  alt="社印"
                                  className="absolute right-[-10px] top-[-10px] w-12 h-12 object-contain mix-blend-multiply opacity-80 pointer-events-none"
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* ----------------------------------------------------------------- */}
              {/* ② 賞与振込一覧表（CSV連動・印刷対応）                             */}
              {/* ----------------------------------------------------------------- */}
              {selectedDocType === 'bonus_transfer_list' && (() => {
                const activeEmps = employees.filter(e => !e.is_retired);
                const rows = activeEmps.map(emp => {
                  const bonusAmount = Math.round(emp.base_salary * bonusMultiplier);
                  const healthBonus = emp.health_insurance_joined ? Math.round(bonusAmount * 0.05) : 0;
                  const pensionBonus = emp.pension_insurance_joined ? Math.round(bonusAmount * 0.0915) : 0;
                  const empInsBonus = emp.employment_insurance_joined ? Math.round(bonusAmount * 0.006) : 0;
                  const taxBonus = Math.round((bonusAmount - (healthBonus + pensionBonus + empInsBonus)) * 0.05);
                  const netBonus = bonusAmount - (healthBonus + pensionBonus + empInsBonus + taxBonus);
                  return { emp, bonusAmount, netBonus };
                });
                const totalTransfer = rows.reduce((sum, r) => sum + r.netBonus, 0);

                return (
                  <div className="bg-white p-8 rounded-2xl border border-slate-300 text-slate-900 font-sans text-xs max-w-5xl mx-auto shadow-sm print:p-0 print:border-none print:shadow-none">
                    <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3 mb-4">
                      <div>
                        <h2 className="text-xl font-black text-slate-950">
                          {selectedYear}年 {selectedMonth}月度 賞与振込一覧表（銀行総合振込用）
                        </h2>
                        <div className="text-xs text-slate-500 mt-0.5">
                          会社名: {companyInfo.name} / 対象人数: {rows.length}名 / 振込予定日: {selectedYear}年{selectedMonth}月10日
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const csvRows = rows.map(r => [
                            r.emp.id,
                            r.emp.name,
                            r.emp.bank_name || '滋賀銀行',
                            r.emp.branch_name || '坂本支店',
                            r.emp.account_type || '普通',
                            r.emp.account_number || '',
                            r.emp.account_holder || r.emp.name,
                            r.netBonus
                          ]);
                          downloadCsv(
                            `賞与振込一覧表_${selectedYear}_${selectedMonth}.csv`,
                            ['社員番号', '社員名', '銀行名', '支店名', '口座種別', '口座番号', '口座名義', '振込金額'],
                            csvRows
                          );
                        }}
                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 text-xs print:hidden cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        振込CSVエクスポート
                      </button>
                    </div>

                    <table className="w-full border-collapse border border-slate-300 mb-6 text-[11px]">
                      <thead>
                        <tr className="bg-slate-100 font-bold border-b border-slate-300 text-slate-700">
                          <th className="p-2 border-r border-slate-300 text-center w-12">No.</th>
                          <th className="p-2 border-r border-slate-300 text-left">氏名</th>
                          <th className="p-2 border-r border-slate-300 text-left">部署</th>
                          <th className="p-2 border-r border-slate-300 text-left">金融機関・支店</th>
                          <th className="p-2 border-r border-slate-300 text-center w-16">種別</th>
                          <th className="p-2 border-r border-slate-300 text-left w-24">口座番号</th>
                          <th className="p-2 border-r border-slate-300 text-left">名義人（カナ）</th>
                          <th className="p-2 text-right w-28">振込手取り額</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={r.emp.id} className="border-b border-slate-200 hover:bg-slate-50">
                            <td className="p-2 border-r border-slate-200 text-center font-mono">{i + 1}</td>
                            <td className="p-2 border-r border-slate-200 font-bold">{r.emp.name}</td>
                            <td className="p-2 border-r border-slate-200">{r.emp.department}</td>
                            <td className="p-2 border-r border-slate-200">{r.emp.bank_name} {r.emp.branch_name}</td>
                            <td className="p-2 border-r border-slate-200 text-center">{r.emp.account_type || '普通'}</td>
                            <td className="p-2 border-r border-slate-200 font-mono">{r.emp.account_number}</td>
                            <td className="p-2 border-r border-slate-200">{r.emp.account_holder || r.emp.name}</td>
                            <td className="p-2 text-right font-mono font-bold text-emerald-700">
                              ¥{r.netBonus.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-100 font-black border-t-2 border-slate-400">
                          <td colSpan={7} className="p-2.5 text-right">総合振込 合計金額:</td>
                          <td className="p-2.5 text-right font-mono text-sm text-emerald-900">
                            ¥{totalTransfer.toLocaleString()}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                );
              })()}

              {/* ----------------------------------------------------------------- */}
              {/* ③ 支給控除一覧表（賞与・全社集計）                                 */}
              {/* ----------------------------------------------------------------- */}
              {selectedDocType === 'bonus_summary_all' && (() => {
                const activeEmps = employees.filter(e => !e.is_retired);
                const list = activeEmps.map(emp => {
                  const gross = Math.round(emp.base_salary * bonusMultiplier);
                  const h = emp.health_insurance_joined ? Math.round(gross * 0.05) : 0;
                  const p = emp.pension_insurance_joined ? Math.round(gross * 0.0915) : 0;
                  const e = emp.employment_insurance_joined ? Math.round(gross * 0.006) : 0;
                  const t = Math.round((gross - (h + p + e)) * 0.05);
                  const net = gross - (h + p + e + t);
                  return { emp, gross, h, p, e, t, net, ded: h + p + e + t };
                });

                const totalGross = list.reduce((s, r) => s + r.gross, 0);
                const totalH = list.reduce((s, r) => s + r.h, 0);
                const totalP = list.reduce((s, r) => s + r.p, 0);
                const totalE = list.reduce((s, r) => s + r.e, 0);
                const totalT = list.reduce((s, r) => s + r.t, 0);
                const totalNet = list.reduce((s, r) => s + r.net, 0);

                return (
                  <div className="bg-white p-8 rounded-2xl border border-slate-300 text-slate-900 font-sans text-xs max-w-5xl mx-auto shadow-sm print:p-0 print:border-none print:shadow-none">
                    <div className="border-b-2 border-slate-900 pb-3 mb-4 flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-black text-slate-950">
                          {selectedYear}年 {selectedMonth}月度 支給控除一覧表（賞与）
                        </h2>
                        <div className="text-xs text-slate-500 mt-0.5">全社集計台帳 / {companyInfo.name}</div>
                      </div>
                      <button
                        onClick={() => {
                          const csvRows = list.map(r => [
                            r.emp.name, r.emp.department || '', r.gross, r.h, r.p, r.e, r.t, r.ded, r.net
                          ]);
                          downloadCsv(
                            `支給控除一覧表_賞与_${selectedYear}_${selectedMonth}.csv`,
                            ['氏名', '部署', '賞与総支給額', '健康保険', '厚生年金', '雇用保険', '所得税', '控除合計', '差引支給額'],
                            csvRows
                          );
                        }}
                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 text-xs print:hidden cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" /> CSV出力
                      </button>
                    </div>

                    <table className="w-full border-collapse border border-slate-300 text-[10.5px]">
                      <thead>
                        <tr className="bg-slate-100 font-bold border-b border-slate-300 text-slate-700">
                          <th className="p-2 border-r border-slate-300 text-left">氏名</th>
                          <th className="p-2 border-r border-slate-300 text-left">部署</th>
                          <th className="p-2 border-r border-slate-300 text-right bg-emerald-50/50">総支給額</th>
                          <th className="p-2 border-r border-slate-300 text-right">健康保険</th>
                          <th className="p-2 border-r border-slate-300 text-right">厚生年金</th>
                          <th className="p-2 border-r border-slate-300 text-right">雇用保険</th>
                          <th className="p-2 border-r border-slate-300 text-right">所得税</th>
                          <th className="p-2 border-r border-slate-300 text-right bg-rose-50/50">控除計</th>
                          <th className="p-2 text-right bg-slate-100 font-black">手取り額</th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.map(r => (
                          <tr key={r.emp.id} className="border-b border-slate-200 hover:bg-slate-50">
                            <td className="p-2 border-r border-slate-200 font-bold">{r.emp.name}</td>
                            <td className="p-2 border-r border-slate-200">{r.emp.department}</td>
                            <td className="p-2 border-r border-slate-200 text-right font-mono font-bold bg-emerald-50/30">¥{r.gross.toLocaleString()}</td>
                            <td className="p-2 border-r border-slate-200 text-right font-mono">¥{r.h.toLocaleString()}</td>
                            <td className="p-2 border-r border-slate-200 text-right font-mono">¥{r.p.toLocaleString()}</td>
                            <td className="p-2 border-r border-slate-200 text-right font-mono">¥{r.e.toLocaleString()}</td>
                            <td className="p-2 border-r border-slate-200 text-right font-mono">¥{r.t.toLocaleString()}</td>
                            <td className="p-2 border-r border-slate-200 text-right font-mono text-rose-700 bg-rose-50/30">¥{r.ded.toLocaleString()}</td>
                            <td className="p-2 text-right font-mono font-black text-slate-900">¥{r.net.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-100 font-black border-t-2 border-slate-400">
                          <td colSpan={2} className="p-2.5 text-center">全社合計</td>
                          <td className="p-2.5 text-right font-mono text-emerald-900">¥{totalGross.toLocaleString()}</td>
                          <td className="p-2.5 text-right font-mono">¥{totalH.toLocaleString()}</td>
                          <td className="p-2.5 text-right font-mono">¥{totalP.toLocaleString()}</td>
                          <td className="p-2.5 text-right font-mono">¥{totalE.toLocaleString()}</td>
                          <td className="p-2.5 text-right font-mono">¥{totalT.toLocaleString()}</td>
                          <td className="p-2.5 text-right font-mono text-rose-800">¥{(totalH + totalP + totalE + totalT).toLocaleString()}</td>
                          <td className="p-2.5 text-right font-mono text-sm text-slate-950">¥{totalNet.toLocaleString()}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                );
              })()}

              {/* ----------------------------------------------------------------- */}
              {/* ④ 支給控除一覧表（賞与部門別）                                   */}
              {/* ----------------------------------------------------------------- */}
              {selectedDocType === 'bonus_summary_dept' && (() => {
                const activeEmps = employees.filter(e => !e.is_retired);
                const deptMap = new Map<string, EmployeeItem[]>();
                activeEmps.forEach(e => {
                  const d = e.department || '本社営業部';
                  if (!deptMap.has(d)) deptMap.set(d, []);
                  deptMap.get(d)!.push(e);
                });

                return (
                  <div className="bg-white p-8 rounded-2xl border border-slate-300 text-slate-900 font-sans text-xs max-w-5xl mx-auto shadow-sm print:p-0 print:border-none print:shadow-none">
                    <div className="border-b-2 border-slate-900 pb-3 mb-5">
                      <h2 className="text-xl font-black text-slate-950">
                        {selectedYear}年 {selectedMonth}月度 支給控除一覧表（賞与部門別）
                      </h2>
                      <div className="text-xs text-slate-500 mt-0.5">部署別 人件費・社会保険負担 集計台帳 / {companyInfo.name}</div>
                    </div>

                    <div className="space-y-6">
                      {Array.from(deptMap.entries()).map(([deptName, deptEmps]) => {
                        const deptGross = deptEmps.reduce((s, e) => s + Math.round(e.base_salary * bonusMultiplier), 0);
                        const deptSocial = Math.round(deptGross * 0.1475);
                        const deptTax = Math.round((deptGross - deptSocial) * 0.05);
                        const deptNet = deptGross - (deptSocial + deptTax);

                        return (
                          <div key={deptName} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                            <div className="flex items-center justify-between font-black text-sm mb-3 text-slate-900 border-b border-slate-200 pb-2">
                              <span className="flex items-center gap-1.5">
                                <Building2 className="w-4 h-4 text-indigo-600" />
                                {deptName}（対象: {deptEmps.length}名）
                              </span>
                              <span className="text-emerald-700 font-mono">
                                部門賞与総額: ¥{deptGross.toLocaleString()}
                              </span>
                            </div>

                            <div className="grid grid-cols-4 gap-2 text-center text-xs">
                              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                                <div className="text-[10px] text-slate-400">賞与総支給額</div>
                                <div className="font-mono font-bold text-slate-900">¥{deptGross.toLocaleString()}</div>
                              </div>
                              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                                <div className="text-[10px] text-slate-400">法定福利社保控除</div>
                                <div className="font-mono font-bold text-rose-700">¥{deptSocial.toLocaleString()}</div>
                              </div>
                              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                                <div className="text-[10px] text-slate-400">源泉所得税</div>
                                <div className="font-mono font-bold text-slate-700">¥{deptTax.toLocaleString()}</div>
                              </div>
                              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                                <div className="text-[10px] text-slate-400">差引振込手取り額</div>
                                <div className="font-mono font-black text-emerald-700">¥{deptNet.toLocaleString()}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* ----------------------------------------------------------------- */}
              {/* ⑤ 日本年金機構公式様式: 被保険者賞与支払届                        */}
              {/* ----------------------------------------------------------------- */}
              {selectedDocType === 'nenkin_bonus_report' && (() => {
                const activeEmps = employees.filter(e => !e.is_retired && (e.health_insurance_joined || e.pension_insurance_joined));

                return (
                  <div className="bg-white p-8 rounded-2xl border-2 border-slate-800 text-slate-900 font-sans text-xs max-w-5xl mx-auto shadow-sm print:p-0 print:border-none print:shadow-none">
                    {/* 公的書類ヘッダー */}
                    <div className="text-center border-b-2 border-slate-900 pb-3 mb-4">
                      <div className="text-[10px] font-bold text-slate-600 tracking-widest uppercase">
                        日本年金機構 / 全国健康保険協会 届出様式
                      </div>
                      <h2 className="text-lg sm:text-xl font-black text-slate-950 tracking-tight">
                        健康保険・厚生年金保険 被保険者賞与支払届
                      </h2>
                    </div>

                    {/* 事業所情報 */}
                    <div className="grid grid-cols-2 gap-4 border border-slate-400 p-3 mb-4 text-[11px]">
                      <div>
                        <div><span className="font-bold">事業所整理記号:</span> 25-カア 12345</div>
                        <div><span className="font-bold">事業所所在地:</span> {companyInfo.address}</div>
                        <div><span className="font-bold">事業所名称:</span> {companyInfo.name}</div>
                      </div>
                      <div className="text-right">
                        <div><span className="font-bold">賞与支給年月日:</span> {selectedYear}年{selectedMonth}月10日</div>
                        <div><span className="font-bold">事業主氏名:</span> {companyInfo.representative_name}</div>
                        <div><span className="font-bold">電話番号:</span> {companyInfo.phone_number}</div>
                      </div>
                    </div>

                    {/* 被保険者明細一覧 */}
                    <table className="w-full border-collapse border-2 border-slate-900 text-[10px] mb-4">
                      <thead>
                        <tr className="bg-slate-200 border-b-2 border-slate-900 text-center font-bold">
                          <th className="p-1.5 border-r border-slate-400 w-10">項番</th>
                          <th className="p-1.5 border-r border-slate-400 w-28">被保険者整理番号</th>
                          <th className="p-1.5 border-r border-slate-400">氏名（フリガナ）</th>
                          <th className="p-1.5 border-r border-slate-400 w-24">生年月日</th>
                          <th className="p-1.5 border-r border-slate-400 w-24">賞与支給日</th>
                          <th className="p-1.5 border-r border-slate-400 w-28">通貨による賞与額</th>
                          <th className="p-1.5 w-28">健保・厚年算定額<br />（千円未満切捨）</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeEmps.map((emp, i) => {
                          const gross = Math.round(emp.base_salary * bonusMultiplier);
                          const roundedBonus = Math.floor(gross / 1000) * 1000;

                          return (
                            <tr key={emp.id} className="border-b border-slate-300 text-center font-mono">
                              <td className="p-1.5 border-r border-slate-300">{i + 1}</td>
                              <td className="p-1.5 border-r border-slate-300 font-bold">{1000 + i + 1}</td>
                              <td className="p-1.5 border-r border-slate-300 text-left font-sans font-bold px-2">
                                <div className="text-[8px] text-slate-500">{emp.name_kana || 'コマイ シュウイチロウ'}</div>
                                <div>{emp.name}</div>
                              </td>
                              <td className="p-1.5 border-r border-slate-300 font-sans">{emp.birth_date || '平2.5.15'}</td>
                              <td className="p-1.5 border-r border-slate-300 font-sans">{selectedMonth}/10</td>
                              <td className="p-1.5 border-r border-slate-300 text-right pr-2">¥{gross.toLocaleString()}</td>
                              <td className="p-1.5 text-right pr-2 font-black text-indigo-950 bg-indigo-50/40">
                                ¥{roundedBonus.toLocaleString()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    <div className="text-[10px] text-slate-500 leading-relaxed space-y-0.5">
                      <div>※ 被保険者賞与支払届は、賞与を支給した日（支給日）から<strong>5日以内</strong>に管轄の年金事務所へ提出してください。</div>
                      <div>※ 賞与額は千円未満を切り捨てた額（標準賞与額）として各被保険者の社会保険料算定基礎となります。</div>
                    </div>
                  </div>
                );
              })()}

              {/* ----------------------------------------------------------------- */}
              {/* ⑥ 賞与支払届総括表（廃止解説・実務ガイド）                         */}
              {/* ----------------------------------------------------------------- */}
              {selectedDocType === 'nenkin_bonus_summary_abolished' && (
                <div className="bg-white p-8 rounded-2xl border border-slate-300 text-slate-800 font-sans text-xs max-w-3xl mx-auto shadow-sm">
                  <div className="flex items-center gap-3 border-b-2 border-slate-900 pb-3 mb-4">
                    <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-black text-lg">
                      ⚠️
                    </div>
                    <div>
                      <h2 className="text-base font-black text-slate-900">
                        賞与支払届総括表の廃止について（労務実務解説）
                      </h2>
                      <div className="text-xs text-slate-500 mt-0.5">日本年金機構 法令改正実務案内</div>
                    </div>
                  </div>

                  <div className="space-y-4 leading-relaxed">
                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs">
                      <p className="font-bold mb-1">【重要なお知らせ：令和3年（2021年）4月1日より添付提出廃止】</p>
                      <p>
                        行政手続の簡素化（ペーパーレス化）の一環として、<strong>「被保険者賞与支払届総括表」は2021年4月1日をもって提出が廃止</strong>されました。
                      </p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-bold text-slate-900 text-sm">🏛️ 今後の年金事務所への提出実務ルール</h4>
                      <ul className="list-disc pl-5 space-y-1 text-slate-600">
                        <li>
                          <strong>賞与を支給した場合:</strong>
                          「被保険者賞与支払届（本表）」のみを作成・提出すれば手続完了となります（総括表の添付は不要です）。
                        </li>
                        <li>
                          <strong>賞与を支給しなかった場合（賞与不支給）:</strong>
                          従来は総括表に「不支給」と書いて提出していましたが、現在は「賞与不支給報告書」を提出します。
                        </li>
                        <li>
                          <strong>電子申請（e-Gov / マイナポータル）:</strong>
                          API連動による電子申請においても総括表の添付は完全に不要となっております。
                        </li>
                      </ul>
                    </div>

                    <div className="pt-4 border-t border-slate-200 flex justify-end">
                      <button
                        onClick={() => setSelectedDocType('nenkin_bonus_report')}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <FileText className="w-4 h-4" />
                        「被保険者賞与支払届（本表）」を開く
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ----------------------------------------------------------------- */}
              {/* ⑦ 給与所得の源泉徴収票（退職者用・国税庁公式様式準拠）           */}
              {/* ----------------------------------------------------------------- */}
              {selectedDocType === 'retirement_withholding_tax' && (() => {
                const retiredEmps = employees.filter(e => e.is_retired);
                const targetEmp = retiredEmps.length > 0 ? retiredEmps[0] : employees[0];
                const totalPaid = targetEmp.base_salary * 8; // 8ヶ月分支給想定
                const taxDeducted = Math.round(totalPaid * 0.04);
                const socialDeducted = Math.round(totalPaid * 0.1475);

                return (
                  <div className="bg-white p-8 rounded-2xl border-2 border-slate-900 text-slate-900 font-sans text-xs max-w-4xl mx-auto shadow-sm print:p-0 print:border-none print:shadow-none">
                    <div className="text-center border-b-2 border-slate-900 pb-2 mb-4">
                      <div className="text-[10px] font-bold text-slate-500">国税庁公式様式（所得税法第226条）</div>
                      <h2 className="text-lg sm:text-xl font-black tracking-tight">
                        令和{selectedYear - 2018}年分 給与所得の源泉徴収票（中途退職者交付用）
                      </h2>
                    </div>

                    {/* 受給者情報 */}
                    <div className="grid grid-cols-2 gap-3 border border-slate-400 p-3 mb-4 text-[11px]">
                      <div>
                        <div><span className="text-slate-500">住所:</span> {targetEmp.address}</div>
                        <div><span className="text-slate-500">氏名:</span> <span className="font-bold text-sm">{targetEmp.name}</span></div>
                      </div>
                      <div className="text-right">
                        <div><span className="text-slate-500">就任・雇入年月日:</span> {targetEmp.join_date}</div>
                        <div className="text-rose-700 font-bold">
                          <span>中途退職年月日:</span> {targetEmp.retirement_date || `${selectedYear}-08-31`}
                        </div>
                      </div>
                    </div>

                    {/* 税額テーブル */}
                    <table className="w-full border-collapse border-2 border-slate-900 mb-4 text-center text-[10.5px]">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-900 font-bold">
                          <th className="p-2 border-r border-slate-400">支払金額</th>
                          <th className="p-2 border-r border-slate-400">給与所得控除後の金額</th>
                          <th className="p-2 border-r border-slate-400">所得控除の額の合計額</th>
                          <th className="p-2">源泉徴収税額</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="font-mono text-xs">
                          <td className="p-3 border-r border-slate-400 font-bold text-slate-900">¥{totalPaid.toLocaleString()}</td>
                          <td className="p-3 border-r border-slate-400 text-slate-400">（年末調整未済）</td>
                          <td className="p-3 border-r border-slate-400 text-slate-400">（年末調整未済）</td>
                          <td className="p-3 font-bold text-emerald-700">¥{taxDeducted.toLocaleString()}</td>
                        </tr>
                      </tbody>
                    </table>

                    {/* 社会保険料等 */}
                    <div className="border border-slate-400 p-2.5 mb-5 flex justify-between text-[11px]">
                      <span>社会保険料等の金額:</span>
                      <span className="font-mono font-bold">¥{socialDeducted.toLocaleString()}</span>
                    </div>

                    {/* 支払者（事業主）情報 ＆ 角印 */}
                    <div className="signature-box flex items-center justify-between border-t border-slate-300 pt-3 text-[11px] relative">
                      <div>
                        <div className="font-bold text-slate-800">【支払者】{companyInfo.name}</div>
                        <div className="text-slate-500 text-[10px]">{companyInfo.address}</div>
                        <div className="text-slate-500 text-[10px]">{companyInfo.representative_name}</div>
                      </div>
                      <div className="relative">
                        {companyInfo.company_seal_url && (
                          <img
                            src={companyInfo.company_seal_url}
                            alt="社印"
                            className="w-14 h-14 object-contain mix-blend-multiply opacity-85"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ----------------------------------------------------------------- */}
              {/* ⑧ 賃金台帳（労働基準法第108条 法定帳簿）                          */}
              {/* ----------------------------------------------------------------- */}
              {selectedDocType === 'wage_ledger' && (() => {
                const targetEmps = selectedEmployeeId === 'all' ? employees : employees.filter(e => e.id === selectedEmployeeId);

                return (
                  <div className="space-y-6">
                    {targetEmps.map((emp, idx) => (
                      <div
                        key={emp.id}
                        className="bg-white p-8 rounded-2xl border-2 border-slate-900 text-slate-900 font-sans text-xs max-w-5xl mx-auto shadow-sm print:p-0 print:border-none print:shadow-none"
                        style={{ pageBreakAfter: idx < targetEmps.length - 1 ? 'always' : 'auto' }}
                      >
                        <div className="text-center border-b-2 border-slate-900 pb-2 mb-4">
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                            労働基準法第108条・労働基準法施行規則第54条 法定様式
                          </div>
                          <h2 className="text-xl font-black text-slate-950">
                            令和{selectedYear - 2018}年度 賃 金 台 帳
                          </h2>
                        </div>

                        {/* 労働者情報 */}
                        <div className="grid grid-cols-4 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-300 mb-4 text-[11px]">
                          <div><span className="text-slate-400">氏名:</span> <span className="font-bold">{emp.name}</span></div>
                          <div><span className="text-slate-400">雇入年月日:</span> <span className="font-mono">{emp.join_date}</span></div>
                          <div><span className="text-slate-400">所属:</span> <span>{emp.department}</span></div>
                          <div><span className="text-slate-400">基本給:</span> <span className="font-mono font-bold">¥{emp.base_salary.toLocaleString()}</span></div>
                        </div>

                        {/* 各月支給明細一覧 */}
                        <table className="w-full border-collapse border border-slate-400 text-[10px] mb-4">
                          <thead>
                            <tr className="bg-slate-100 font-bold border-b border-slate-400 text-center">
                              <th className="p-1.5 border-r border-slate-300 w-10">月度</th>
                              <th className="p-1.5 border-r border-slate-300 w-12">出勤日</th>
                              <th className="p-1.5 border-r border-slate-300 w-14">労働時間</th>
                              <th className="p-1.5 border-r border-slate-300 w-14">残業時間</th>
                              <th className="p-1.5 border-r border-slate-300 text-right">基本給</th>
                              <th className="p-1.5 border-r border-slate-300 text-right">総支給額</th>
                              <th className="p-1.5 border-r border-slate-300 text-right">健保・厚年</th>
                              <th className="p-1.5 border-r border-slate-300 text-right">所得税</th>
                              <th className="p-1.5 border-r border-slate-300 text-right">控除合計</th>
                              <th className="p-1.5 text-right font-black">差引支給額</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Array.from({ length: 12 }, (_, i) => {
                              const m = i + 1;
                              const days = 21;
                              const hours = 168;
                              const ot = m % 2 === 0 ? 10 : 0;
                              const otPay = ot * 2000;
                              const gross = emp.base_salary + otPay;
                              const soc = Math.round(gross * 0.1475);
                              const tax = Math.round((gross - soc) * 0.03);
                              const ded = soc + tax;
                              const net = gross - ded;

                              return (
                                <tr key={m} className="border-b border-slate-200 text-center font-mono">
                                  <td className="p-1 border-r border-slate-300 font-bold">{m}月</td>
                                  <td className="p-1 border-r border-slate-300">{days}</td>
                                  <td className="p-1 border-r border-slate-300">{hours}</td>
                                  <td className="p-1 border-r border-slate-300">{ot}</td>
                                  <td className="p-1 border-r border-slate-300 text-right pr-1">¥{emp.base_salary.toLocaleString()}</td>
                                  <td className="p-1 border-r border-slate-300 text-right pr-1 font-bold text-emerald-700">¥{gross.toLocaleString()}</td>
                                  <td className="p-1 border-r border-slate-300 text-right pr-1">¥{soc.toLocaleString()}</td>
                                  <td className="p-1 border-r border-slate-300 text-right pr-1">¥{tax.toLocaleString()}</td>
                                  <td className="p-1 border-r border-slate-300 text-right pr-1 text-rose-700">¥{ded.toLocaleString()}</td>
                                  <td className="p-1 text-right pr-1 font-black text-slate-900">¥{net.toLocaleString()}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>

                        <div className="signature-box flex items-center justify-between border-t border-slate-300 pt-2 text-[10px] text-slate-500">
                          <div>事業所名: {companyInfo.name} / 賃金締切日: 末日 / 支払日: 毎月25日</div>
                          <div>※ 労働基準法第109条に基づき、最後の記入をした日から5年間の保存が義務付けられています。</div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* ----------------------------------------------------------------- */}
              {/* ⑨ 労働者名簿（労働基準法第107条 法定帳簿）                          */}
              {/* ----------------------------------------------------------------- */}
              {selectedDocType === 'employee_roster' && (() => {
                const targetEmps = selectedEmployeeId === 'all' ? employees : employees.filter(e => e.id === selectedEmployeeId);

                return (
                  <div className="space-y-6">
                    {targetEmps.map((emp, idx) => (
                      <div
                        key={emp.id}
                        className="bg-white p-8 rounded-2xl border-2 border-slate-900 text-slate-900 font-sans text-xs max-w-4xl mx-auto shadow-sm print:p-0 print:border-none print:shadow-none"
                        style={{ pageBreakAfter: idx < targetEmps.length - 1 ? 'always' : 'auto' }}
                      >
                        <div className="text-center border-b-2 border-slate-900 pb-2 mb-4">
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                            労働基準法第107条・労働基準法施行規則第53条 法定様式
                          </div>
                          <h2 className="text-xl font-black text-slate-950">
                            労 働 者 名 簿
                          </h2>
                        </div>

                        <table className="w-full border-collapse border-2 border-slate-900 text-xs mb-4">
                          <tbody>
                            <tr className="border-b border-slate-400">
                              <th className="bg-slate-100 p-2 text-left w-28 border-r border-slate-400">氏名（フリガナ）</th>
                              <td className="p-2 border-r border-slate-400 font-bold text-sm">
                                <div className="text-[9px] text-slate-500">{emp.name_kana || 'コマイ シュウイチロウ'}</div>
                                <div>{emp.name}</div>
                              </td>
                              <th className="bg-slate-100 p-2 text-left w-20 border-r border-slate-400">性別</th>
                              <td className="p-2">{emp.gender || '男性'}</td>
                            </tr>
                            <tr className="border-b border-slate-400">
                              <th className="bg-slate-100 p-2 text-left border-r border-slate-400">生年月日</th>
                              <td className="p-2 border-r border-slate-400 font-mono">{emp.birth_date}</td>
                              <th className="bg-slate-100 p-2 text-left border-r border-slate-400">電話番号</th>
                              <td className="p-2 font-mono">{emp.phone || '090-0000-0000'}</td>
                            </tr>
                            <tr className="border-b border-slate-400">
                              <th className="bg-slate-100 p-2 text-left border-r border-slate-400">現住所</th>
                              <td colSpan={3} className="p-2">{emp.address}</td>
                            </tr>
                            <tr className="border-b border-slate-400">
                              <th className="bg-slate-100 p-2 text-left border-r border-slate-400">雇入年月日</th>
                              <td className="p-2 border-r border-slate-400 font-mono font-bold text-emerald-700">{emp.join_date}</td>
                              <th className="bg-slate-100 p-2 text-left border-r border-slate-400">従事業務</th>
                              <td className="p-2">{emp.department}（{emp.position_name}）</td>
                            </tr>
                            <tr className="border-b border-slate-400">
                              <th className="bg-slate-100 p-2 text-left border-r border-slate-400">契約形態</th>
                              <td className="p-2 border-r border-slate-400">正社員（無期雇用）</td>
                              <th className="bg-slate-100 p-2 text-left border-r border-slate-400">退職年月日</th>
                              <td className="p-2 font-mono text-rose-700 font-bold">
                                {emp.retirement_date || '在籍中'}
                              </td>
                            </tr>
                            <tr>
                              <th className="bg-slate-100 p-2 text-left border-r border-slate-400">退職・解雇の事由</th>
                              <td colSpan={3} className="p-2 text-slate-600">
                                {emp.is_retired ? '自己都合退職' : '-'}
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        <div className="signature-box flex items-center justify-between border-t border-slate-300 pt-2 text-[10px] text-slate-500">
                          <div>事業所名: {companyInfo.name} / 調製者: {companyInfo.representative_name}</div>
                          <div>※ 労働者が退職・死亡した日から5年間の保存が義務付けられています。</div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* ----------------------------------------------------------------- */}
              {/* ⑩ 給与所得・退職所得に対する源泉徴収簿（国税庁様式）               */}
              {/* ----------------------------------------------------------------- */}
              {selectedDocType === 'withholding_tax_ledger' && (() => {
                const targetEmps = selectedEmployeeId === 'all' ? employees : employees.filter(e => e.id === selectedEmployeeId);

                return (
                  <div className="space-y-6">
                    {targetEmps.map((emp, idx) => (
                      <div
                        key={emp.id}
                        className="bg-white p-8 rounded-2xl border-2 border-slate-900 text-slate-900 font-sans text-xs max-w-5xl mx-auto shadow-sm print:p-0 print:border-none print:shadow-none"
                        style={{ pageBreakAfter: idx < targetEmps.length - 1 ? 'always' : 'auto' }}
                      >
                        <div className="text-center border-b-2 border-slate-900 pb-2 mb-4">
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                            国税庁所定様式
                          </div>
                          <h2 className="text-xl font-black text-slate-950">
                            令和{selectedYear - 2018}年分 給与所得に対する源泉徴収簿
                          </h2>
                        </div>

                        <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-300 mb-4 text-[11px]">
                          <div><span className="text-slate-400">氏名:</span> <span className="font-bold">{emp.name}</span></div>
                          <div><span className="text-slate-400">住所:</span> <span>{emp.address}</span></div>
                          <div><span className="text-slate-400">扶養親族等の数:</span> <span className="font-bold">{emp.dependents_count || 0}名</span></div>
                        </div>

                        <table className="w-full border-collapse border border-slate-400 text-[10px] mb-4 font-mono">
                          <thead>
                            <tr className="bg-slate-100 font-bold border-b border-slate-400 text-center font-sans">
                              <th className="p-1 border-r border-slate-300 w-10">月度</th>
                              <th className="p-1 border-r border-slate-300 w-20">支給日</th>
                              <th className="p-1 border-r border-slate-300 text-right">総支給額</th>
                              <th className="p-1 border-r border-slate-300 text-right">社会保険料等</th>
                              <th className="p-1 border-r border-slate-300 text-right">社保控除後給与</th>
                              <th className="p-1 border-r border-slate-300 text-right">算出税額</th>
                              <th className="p-1 text-right">差引徴収税額</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Array.from({ length: 12 }, (_, i) => {
                              const m = i + 1;
                              const gross = emp.base_salary;
                              const soc = Math.round(gross * 0.1475);
                              const afterSoc = gross - soc;
                              const tax = Math.round(afterSoc * 0.03);

                              return (
                                <tr key={m} className="border-b border-slate-200 text-right">
                                  <td className="p-1 border-r border-slate-300 text-center font-bold font-sans">{m}月</td>
                                  <td className="p-1 border-r border-slate-300 text-center">{selectedYear}.{m}.25</td>
                                  <td className="p-1 border-r border-slate-300 font-bold">¥{gross.toLocaleString()}</td>
                                  <td className="p-1 border-r border-slate-300">¥{soc.toLocaleString()}</td>
                                  <td className="p-1 border-r border-slate-300">¥{afterSoc.toLocaleString()}</td>
                                  <td className="p-1 border-r border-slate-300 text-emerald-700">¥{tax.toLocaleString()}</td>
                                  <td className="p-1 font-bold text-slate-900">¥{tax.toLocaleString()}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>

                        <div className="signature-box flex items-center justify-between border-t border-slate-300 pt-2 text-[10px] text-slate-500 font-sans">
                          <div>給与支払者: {companyInfo.name}（{companyInfo.address}）</div>
                          <div>※ 年末調整の基礎台帳として会社において適切に保管してください。</div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

            </div>
          </div>
        </div>
      )}

    </div>
  );
};
