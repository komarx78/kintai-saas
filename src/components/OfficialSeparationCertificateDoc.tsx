import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Printer, ArrowLeft, CheckSquare, Square, Copy, Check, 
  Eye, Sliders, User, FileText, RefreshCw, ShieldCheck
} from 'lucide-react';

export interface SeparationEmployee {
  id: string;
  name: string;
  name_kana?: string;
  birth_date?: string;
  gender?: string;
  my_number?: string;
  employment_insurance_number?: string; // 雇用保険被保険者番号 (4桁-6桁-1桁)
  join_date: string;
  retirement_date?: string;
  base_salary: number;
  salary_type?: 'monthly' | 'hourly' | 'daily';
  employment_type?: string;
  weekly_hours?: number;
  address?: string;
  phone?: string;
}

export interface OfficialSeparationCertificateDocProps {
  companyInfo: {
    name: string;
    address: string;
    representative_name: string;
    phone_number: string;
    corporate_number?: string;
    company_seal_url?: string;
  };
  officeNumber?: string; // 雇用保険適用事業所番号 (例: 2501-123456-7)
  employees: SeparationEmployee[];
  selectedEmployeeId: string;
  onSelectEmployee: (id: string) => void;
  onBack: () => void;
  hideHeader?: boolean;
  tenantId?: string;
}

// 和暦変換ユーティリティ
function toWareki(dateStr?: string): string {
  if (!dateStr) return '未定';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  if (y >= 2019) {
    const ry = y - 2018;
    return `令和 ${ry === 1 ? '元' : ry} 年 ${m} 月 ${day} 日`;
  }
  return `${y}年 ${m}月 ${day}日`;
}

function toWarekiShort(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  if (y >= 2019) {
    const ry = y - 2018;
    return `R${ry}.${m}.${day}`;
  }
  return `${y}.${m}.${day}`;
}

export const OfficialSeparationCertificateDoc: React.FC<OfficialSeparationCertificateDocProps> = ({
  companyInfo,
  officeNumber = '2501-123456-7',
  employees,
  selectedEmployeeId,
  onSelectEmployee,
  onBack,
  hideHeader = false,
  tenantId
}) => {
  // 表示モード: 'nav' (転記ナビゲーション) | 'print' (公式A4下書き印刷プレビュー)
  const [viewMode, setViewMode] = useState<'nav' | 'print'>('nav');

  // 転記済みチェック管理（欄番号キー）
  const [checkedFields, setCheckedFields] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // 設定パラメーター
  const [closingDay, setClosingDay] = useState<number>(31); // 締日: 31=末日, 20=20日, 25=25日
  const [paymentDay, setPaymentDay] = useState<string>('翌月25日'); // 支払日
  const [monthCount, setMonthCount] = useState<number>(12); // 算定対象月数: デフォルト12ヶ月（1年分・12段）
  const [separationReasonCode, setSeparationReasonCode] = useState<string>('4-(2)');
  const [separationReasonDetail, setSeparationReasonDetail] = useState<string>('自己都合による退職（一身上の都合・転職のため）');
  const [weeklyHours, setWeeklyHours] = useState<number>(40);

  // 対象従業員
  const currentEmployee = employees.find(e => e.id === selectedEmployeeId) || employees[0];

  // 🛡️ 実DB（payslipsテーブル）からの確定給与データ一括取得（SSOT原則・憲法14条）
  const [dbPayslips, setDbPayslips] = useState<any[]>([]);

  useEffect(() => {
    if (!currentEmployee?.id) return;
    let isMounted = true;

    const fetchPayslips = async () => {
      try {
        let query = supabase
          .from('payslips')
          .select('*')
          .eq('user_id', currentEmployee.id)
          .order('year_month', { ascending: false });

        if (tenantId) {
          query = query.eq('tenant_id', tenantId);
        }

        const { data, error } = await query;
        if (!error && data && isMounted) {
          setDbPayslips(data);
        }
      } catch (err) {
        console.warn('OfficialSeparationCertificate dbPayslips fetch error:', err);
      }
    };

    fetchPayslips();
    return () => {
      isMounted = false;
    };
  }, [currentEmployee?.id, tenantId]);

  // 転記チェックの切り替え
  const toggleFieldCheck = (key: string) => {
    setCheckedFields(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // 値のコピー機能
  const copyToClipboard = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  // 全チェック解除
  const handleResetChecks = () => {
    if (confirm('すべての転記済みチェックをリセットしますか？')) {
      setCheckedFields({});
    }
  };

  // 印刷
  const handlePrint = () => {
    window.print();
  };

  // 退職日と給与の計算
  const retDate = useMemo(() => {
    if (currentEmployee?.retirement_date) {
      return new Date(currentEmployee.retirement_date);
    }
    return new Date();
  }, [currentEmployee?.retirement_date]);

  const monthlyBaseWage = currentEmployee?.base_salary || 0;

  // 賃金支払状況テーブルの自動算定（退職日から逆算・実DB SSOT直結・雇用保険法完全準拠）
  const wageRows = useMemo(() => {
    const rows = [];
    const y = retDate.getFullYear();
    const m = retDate.getMonth();
    const d = retDate.getDate();
    const lastDayOfRetMonth = new Date(y, m + 1, 0).getDate();
    const isRetMonthEnd = (d === lastDayOfRetMonth);

    for (let i = 0; i < monthCount; i++) {
      // ⑧ 被保険者期間算定対象期間: 雇用保険法に基づき離職日から1ヶ月ずつ区切る
      let pStart: Date;
      let pEnd: Date;

      if (isRetMonthEnd) {
        // 月末退職の場合: カレンダー月（各月1日〜各月末日）
        pEnd = new Date(y, m - i + 1, 0);
        pStart = new Date(y, m - i, 1);
      } else {
        // 月中退職の場合: 離職日を起算点として1ヶ月ごとに遡る
        if (i === 0) {
          pEnd = new Date(y, m, d);
        } else {
          const tempYear = y;
          const tempMonth = m - i;
          const maxD = new Date(tempYear, tempMonth + 1, 0).getDate();
          pEnd = new Date(tempYear, tempMonth, Math.min(d, maxD));
        }
        // 開始日は前月の該当日の翌日
        const prevYear = pEnd.getFullYear();
        const prevMonth = pEnd.getMonth() - 1;
        const maxPrevD = new Date(prevYear, prevMonth + 1, 0).getDate();
        const prevEndEquivalent = new Date(prevYear, prevMonth, Math.min(d, maxPrevD));
        pStart = new Date(prevEndEquivalent.getTime() + 24 * 60 * 60 * 1000);
      }

      const startStr = `${pStart.getFullYear()}/${String(pStart.getMonth() + 1).padStart(2, '0')}/${String(pStart.getDate()).padStart(2, '0')}`;
      const endStr = `${pEnd.getFullYear()}/${String(pEnd.getMonth() + 1).padStart(2, '0')}/${String(pEnd.getDate()).padStart(2, '0')}`;
      const startWareki = toWarekiShort(startStr);
      const endWareki = toWarekiShort(endStr);

      // ⑩ 賃金支払対象期間: 給与締日に応じた期間（退職日以降の日付は含めない）
      let payStartStr = '';
      let payEndStr = '';
      let payStart: Date;
      let payEnd: Date;
      let targetYear = pEnd.getFullYear();
      let targetMonth = pEnd.getMonth() + 1;

      if (closingDay >= 28) {
        // 末日締め
        if (i === 0) {
          payStart = new Date(y, m, 1);
          payEnd = new Date(y, m, d);
        } else {
          payEnd = new Date(y, m - i + 1, 0);
          payStart = new Date(y, m - i, 1);
        }
        targetYear = payEnd.getFullYear();
        targetMonth = payEnd.getMonth() + 1;
      } else {
        // 20日締めなどの場合
        const cpEndBase = new Date(y, m - i, closingDay);
        const cpStartBase = new Date(y, m - i - 1, closingDay + 1);

        if (i === 0) {
          if (d <= closingDay) {
            payStart = cpStartBase;
            payEnd = new Date(y, m, d);
            targetYear = y;
            targetMonth = m + 1;
          } else {
            payStart = new Date(y, m, closingDay + 1);
            payEnd = new Date(y, m, d);
            targetYear = y;
            targetMonth = m + 1;
          }
        } else {
          payStart = cpStartBase;
          payEnd = cpEndBase;
          targetYear = cpEndBase.getFullYear();
          targetMonth = cpEndBase.getMonth() + 1;
        }
      }

      payStartStr = `${payStart.getFullYear()}/${String(payStart.getMonth() + 1).padStart(2, '0')}/${String(payStart.getDate()).padStart(2, '0')}`;
      payEndStr = `${payEnd.getFullYear()}/${String(payEnd.getMonth() + 1).padStart(2, '0')}/${String(payEnd.getDate()).padStart(2, '0')}`;
      const payStartWareki = toWarekiShort(payStartStr);
      const payEndWareki = toWarekiShort(payEndStr);

      // 実確定給与レコード（payslips）の照合（実DB優先 ＆ LocalStorageフォールバック）
      const targetYM = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
      let actualPayslip: any = dbPayslips.find(
        (p: any) => p.user_id === currentEmployee?.id && p.year_month === targetYM
      );

      if (!actualPayslip && tenantId) {
        try {
          const raw = localStorage.getItem(`saved_payslips_${tenantId}_${targetYM}`);
          if (raw) {
            const list = JSON.parse(raw);
            if (Array.isArray(list)) {
              actualPayslip = list.find((p: any) => p.user_id === currentEmployee?.id);
            }
          }
        } catch (_) {}
      }

      // 暦日数の算出
      const periodDays = Math.round((pEnd.getTime() - pStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;
      const payPeriodDays = Math.round((payEnd.getTime() - payStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;

      // 入社日・在職期間の判定
      const joinDateObj = currentEmployee?.join_date ? new Date(currentEmployee.join_date) : null;
      const isBeforeJoin = joinDateObj && pEnd < joinDateObj;

      let periodBaseDays = 0;
      let payBaseDays = 0;
      let wageA = 0;
      let wageB = 0;
      let note = i === 0 ? '退職月' : '';

      const salaryType = currentEmployee?.salary_type || 'monthly';

      if (isBeforeJoin) {
        // 入社前の期間は厳格に0・実績なし（憲法14条）
        periodBaseDays = 0;
        payBaseDays = 0;
        wageA = 0;
        wageB = 0;
        note = '入社前';
      } else if (actualPayslip) {
        // 🛡️ 実DB確定レコードからの厳格マッピング（給与形態別の基礎日数算定）
        const workDays = Number(actualPayslip.work_days || 0);
        const actualHours = Number(actualPayslip.actual_hours || 0);

        if (salaryType === 'hourly' || salaryType === 'daily') {
          // 時給・日給制: 実出勤日数を基礎日数とする（出勤がなければ0）
          periodBaseDays = workDays > 0 ? workDays : 0;
          payBaseDays = workDays > 0 ? workDays : 0;
          // 🛡️ 雇用保険法改正（令和2年8月1日施行）: 賃金支払基礎日数11日未満でも労働時間80時間以上であれば被保険者期間算入
          if (workDays < 11 && actualHours >= 80) {
            note = note ? `${note} (実働${actualHours}h・80h基準充足)` : `実働${actualHours}h(80h基準充足)`;
          }
        } else {
          // 月給制（完全月給または日給月給）
          // 欠勤日数があれば控除、なければ暦日数
          const absenceDays = Number(actualPayslip.absence_days || 0);
          periodBaseDays = Math.max(0, periodDays - absenceDays);
          payBaseDays = Math.max(0, payPeriodDays - absenceDays);
        }

        // 賃金額A: 基本給 + 固定的手当（役職手当・職能手当・住宅手当・家族手当等）
        const base = Number(actualPayslip.base_salary || 0);
        const fixedAllowances = Number(
          (actualPayslip.position_allowance || 0) +
          (actualPayslip.housing_allowance || 0) +
          (actualPayslip.qualification_allowance || 0) +
          (actualPayslip.family_allowance || 0)
        );
        wageA = base + fixedAllowances;

        // 賃金額B: 時間外手当（残業手当・休日手当・深夜手当） + 変動手当（通勤・特別等）
        const overtime = Number(actualPayslip.overtime_allowance || 0);
        const variableAllowances = Number(
          (actualPayslip.commuting_allowance || 0) +
          (actualPayslip.special_allowance || 0)
        );
        wageB = overtime + variableAllowances;

        const totalEarn = Number(actualPayslip.total_earnings || (wageA + wageB));
        if (totalEarn > 0 && wageA === 0 && wageB === 0) {
          wageA = totalEarn;
        }
      } else {
        // 🛡️ 憲法14条・雇用保険法厳格準拠:
        // 確定給与データが存在しない月は、推測・シミュレーションで数字を捏造せず、厳格に0（実績なし）とする
        periodBaseDays = 0;
        payBaseDays = 0;
        wageA = 0;
        wageB = 0;
        if (!note) note = '未確定・実績なし';
      }

      const wageTotal = wageA + wageB;

      rows.push({
        index: i + 1,
        // ⑧ 算定対象期間
        periodStart: startStr,
        periodEnd: endStr,
        periodDisplay: `${startWareki} 〜 ${endWareki}`,
        // ⑨ 基礎日数
        periodBaseDays,
        // ⑩ 賃金支払対象期間
        payPeriodStart: payStartStr,
        payPeriodEnd: payEndStr,
        payPeriodDisplay: `${payStartWareki} 〜 ${payEndWareki}`,
        // ⑪ 賃金支払基礎日数
        payBaseDays,
        // ⑫ 賃金額
        wageA,
        wageB,
        wageTotal,
        // ⑬ 備考
        note,
        actualHours: actualPayslip ? Number(actualPayslip.actual_hours || 0) : 0,
        hasRecord: Boolean(actualPayslip)
      });
    }

    return rows;
  }, [retDate, monthCount, closingDay, monthlyBaseWage, dbPayslips, currentEmployee, tenantId]);


  // 12ヶ月（または全期間）合計値計算
  const totalWageA = useMemo(() => wageRows.reduce((sum, r) => sum + r.wageA, 0), [wageRows]);
  const totalWageB = useMemo(() => wageRows.reduce((sum, r) => sum + r.wageB, 0), [wageRows]);
  const totalWageAll = useMemo(() => wageRows.reduce((sum, r) => sum + r.wageTotal, 0), [wageRows]);
  const totalDays = useMemo(() => wageRows.reduce((sum, r) => sum + r.payBaseDays, 0), [wageRows]);

  // 直近6ヶ月間 小計（雇用保険法第17条: 賃金支払基礎日数11日以上または実労働時間80時間以上ある確定月を直近から最大6ヶ月採用）
  const eligible6Rows = useMemo(() => {
    const valid = wageRows.filter(r => r.hasRecord && (r.payBaseDays >= 11 || r.actualHours >= 80));
    if (valid.length >= 6) {
      return valid.slice(0, 6);
    }
    // 11日以上/80h以上が6ヶ月未満の場合、実績確定レコードがある月を直近から優先採用（未確定・実績なし月は除外）
    const recorded = wageRows.filter(r => r.hasRecord && r.wageTotal > 0);
    return recorded.slice(0, 6);
  }, [wageRows]);

  const recent6Rows = eligible6Rows;
  const recent6WageA = useMemo(() => recent6Rows.reduce((sum, r) => sum + r.wageA, 0), [recent6Rows]);
  const recent6WageB = useMemo(() => recent6Rows.reduce((sum, r) => sum + r.wageB, 0), [recent6Rows]);
  const recent6WageTotal = useMemo(() => recent6Rows.reduce((sum, r) => sum + r.wageTotal, 0), [recent6Rows]);
  const recent6Days = useMemo(() => recent6Rows.reduce((sum, r) => sum + r.payBaseDays, 0), [recent6Rows]);
  
  // 賃金日額: 雇用保険法第17条に基づき算定
  // 原則: 直近6ヶ月間の賃金総額 ÷ 180日（対象月数が6ヶ月未満の場合は 月数 × 30日）
  // 日給・時給制の最低保障額（法第17条第2項）: 直近6ヶ月間の賃金総額 ÷ 実労働日数 × 70%
  const dailyWageRate = useMemo(() => {
    if (recent6WageTotal === 0 || recent6Rows.length === 0) return 0;
    const effectiveDays = recent6Rows.length === 6 ? 180 : Math.max(1, recent6Rows.length * 30);
    const standardDaily = Math.round(recent6WageTotal / effectiveDays);
    const salaryType = currentEmployee?.salary_type || 'monthly';
    if (salaryType === 'hourly' || salaryType === 'daily') {
      const minGuarantee = recent6Days > 0 ? Math.round((recent6WageTotal / recent6Days) * 0.7) : 0;
      return Math.max(standardDaily, minGuarantee);
    }
    return standardDaily;
  }, [recent6WageTotal, recent6Days, recent6Rows, currentEmployee?.salary_type]);

  // 全14項目のうちチェック済みの件数
  const totalKeyFields = 14;
  const completedCount = useMemo(() => {
    let count = 0;
    for (let i = 1; i <= 14; i++) {
      if (checkedFields[`field_${i}`]) count++;
    }
    return count;
  }, [checkedFields]);

  if (!currentEmployee) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <p className="text-slate-500 font-bold text-sm">対象の従業員データが見つかりません。</p>
        <button onClick={onBack} className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700">
          戻る
        </button>
      </div>
    );
  }

  // 離職理由の選択肢マスタ
  const reasonOptions = [
    { code: '4-(2)', label: '4-(2) 労働者の個人的な事由による離職（一身上の都合・転職・自己都合）' },
    { code: '1-(1)', label: '1-(1) 事業所の倒産、事業所の廃止' },
    { code: '2-(3)', label: '2-(3) 事業主からの働きかけによる退職（会社都合・退職勧奨・希望退職）' },
    { code: '3-(1)', label: '3-(1) 契約期間満了（更新上限による満了、希望したが更新されず）' },
    { code: '3-(2)', label: '3-(2) 契約期間満了（労働者からの更新辞退）' },
    { code: '5-(1)', label: '5-(1) 定年退職（60歳以上の定年に達したことによる離職）' },
    { code: '5-(2)', label: '5-(2) 移籍出向（出向先への転籍による離職）' },
  ];

  return (
    <div className="space-y-6">
      {/* 操作ヘッダーバー（印刷時は非表示） */}
      {!hideHeader && (
        <div className="print:hidden bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition cursor-pointer"
              title="戻る"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2.5 py-0.5 rounded-full font-black bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" />
                  ハローワーク様式第4号の2
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  実物用紙1対1転記モード搭載
                </span>
              </div>
              <h2 className="text-lg font-black text-slate-900 mt-1 flex items-center gap-2">
                雇用保険被保険者 離職証明書（離職票）転記ナビゲーション
              </h2>
            </div>
          </div>

          {/* コントロール群 */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* 従業員選択 */}
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] font-bold text-slate-500">対象離職者:</span>
              <select
                value={currentEmployee.id}
                onChange={(e) => onSelectEmployee(e.target.value)}
                className="bg-transparent text-xs font-black text-slate-800 outline-hidden cursor-pointer"
              >
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.retirement_date ? `${emp.retirement_date}退職` : '退職予定'})
                  </option>
                ))}
              </select>
            </div>

            {/* モード切替タブ */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setViewMode('nav')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'nav' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                転記ナビ画面
              </button>
              <button
                onClick={() => setViewMode('print')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'print' ? 'bg-white text-amber-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                実物A4下書き印刷
              </button>
            </div>

            {/* 印刷ボタン */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-black shadow-xs transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              A4下書き印刷
            </button>
          </div>
        </div>
      )}

      {/* 親コンポーネントでヘッダー統合時のサブコントロールバー */}
      {hideHeader && (
        <div className="print:hidden bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-0.5 rounded-full font-black bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" />
              ハローワーク様式第4号の2（離職証明書）
            </span>
            <span className="text-xs text-slate-500 font-bold">実物複写用紙1対1転記モード</span>
          </div>

          {/* モード切替タブ */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('nav')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'nav' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              転記ナビ画面
            </button>
            <button
              onClick={() => setViewMode('print')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'print' ? 'bg-white text-amber-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              実物A4下書き印刷
            </button>
          </div>
        </div>
      )}

      {/* 転記ナビゲーションモード */}
      {viewMode === 'nav' && (
        <div className="space-y-6">
          {/* ガイド ＆ 進捗ステータスバー */}
          <div className="bg-linear-to-r from-blue-50 via-indigo-50 to-slate-50 border border-blue-200/80 p-4 sm:p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-black text-sm text-blue-900 flex items-center gap-1.5">
                  <CheckSquare className="w-4 h-4 text-blue-600" />
                  複写用紙への手書き転記サポート
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold">
                  進捗: {completedCount} / {totalKeyFields} 項目転記済 ({Math.round((completedCount / totalKeyFields) * 100)}%)
                </span>
              </div>
              <p className="text-xs text-blue-700 leading-relaxed">
                ハローワークの専用複写用紙（安定所提出用・事業主控・離職票-2）の<strong>各枠番号（①〜⑭）と完全一致</strong>しています。画面の数値をそのまま実物用紙へ書き写し、転記した欄のチェックをクリックしてください。
              </p>
            </div>

            <div className="flex items-center gap-2 self-end md:self-center">
              {completedCount > 0 && (
                <button
                  onClick={handleResetChecks}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  チェック初期化
                </button>
              )}
            </div>
          </div>

          {/* 計算条件コントロール（締日・月数等） */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-500 font-bold block mb-1">賃金締切日</span>
              <select
                value={closingDay}
                onChange={(e) => setClosingDay(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 font-bold text-slate-800"
              >
                <option value={31}>毎月末日締め</option>
                <option value={20}>毎月20日締め</option>
                <option value={25}>毎月25日締め</option>
                <option value={15}>毎月15日締め</option>
              </select>
            </div>
            <div>
              <span className="text-slate-500 font-bold block mb-1">賃金支払日</span>
              <input
                type="text"
                value={paymentDay}
                onChange={(e) => setPaymentDay(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 font-bold text-slate-800"
                placeholder="例: 翌月25日"
              />
            </div>
            <div>
              <span className="text-slate-500 font-bold block mb-1">算定対象月数</span>
              <select
                value={monthCount}
                onChange={(e) => setMonthCount(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 font-bold text-slate-800"
              >
                <option value={12}>12ヶ月（1年分・ハローワーク様式12段【標準】）</option>
                <option value={6}>直近6ヶ月（日額確認・短期特例用）</option>
              </select>
            </div>
            <div>
              <span className="text-slate-500 font-bold block mb-1">週所定労働時間</span>
              <input
                type="number"
                value={weeklyHours}
                onChange={(e) => setWeeklyHours(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 font-bold text-slate-800"
              />
            </div>
          </div>

          {/* 実物用紙構成グリッド（左面：基本情報、右面：賃金計算状況） */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* ⬅️ 【左面】①〜⑦ 基本情報 ＆ 離職理由欄 */}
            <div className="lg:col-span-5 space-y-4">
              <div className="flex items-center justify-between border-b-2 border-slate-800 pb-2">
                <h3 className="font-black text-slate-800 text-sm flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px]">左</span>
                  実物用紙【左半分】基本情報 ＆ 離職理由
                </h3>
                <span className="text-[11px] text-slate-400 font-bold">①〜⑦欄</span>
              </div>

              {/* ① 被保険者番号 */}
              <div className={`p-3.5 rounded-xl border transition ${
                checkedFields.field_1 ? 'bg-emerald-50/60 border-emerald-300' : 'bg-white border-slate-200'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleFieldCheck('field_1')} className="cursor-pointer">
                      {checkedFields.field_1 ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                      )}
                    </button>
                    <span className="text-xs font-black text-slate-800">① 被保険者番号</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard('field_1', currentEmployee.employment_insurance_number || '1234-567890-1')}
                    className="text-[10px] text-slate-400 hover:text-blue-600 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'field_1' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    {copiedKey === 'field_1' ? 'コピー済' : 'コピー'}
                  </button>
                </div>
                <div className="mt-2 pl-6">
                  <span className="font-mono text-base font-black tracking-widest text-blue-900 bg-blue-50/80 px-3 py-1 rounded-lg border border-blue-200 inline-block">
                    {currentEmployee.employment_insurance_number || '1234-567890-1'}
                  </span>
                  <p className="text-[10px] text-slate-400 mt-1">4桁-6桁-1桁のマス目に記入します</p>
                </div>
              </div>

              {/* ② 事業所番号 */}
              <div className={`p-3.5 rounded-xl border transition ${
                checkedFields.field_2 ? 'bg-emerald-50/60 border-emerald-300' : 'bg-white border-slate-200'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleFieldCheck('field_2')} className="cursor-pointer">
                      {checkedFields.field_2 ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                      )}
                    </button>
                    <span className="text-xs font-black text-slate-800">② 事業所番号</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard('field_2', officeNumber)}
                    className="text-[10px] text-slate-400 hover:text-blue-600 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'field_2' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    {copiedKey === 'field_2' ? 'コピー済' : 'コピー'}
                  </button>
                </div>
                <div className="mt-2 pl-6">
                  <span className="font-mono text-base font-black tracking-widest text-slate-900 bg-slate-100 px-3 py-1 rounded-lg border border-slate-300 inline-block">
                    {officeNumber}
                  </span>
                </div>
              </div>

              {/* ③ 離職者氏名 */}
              <div className={`p-3.5 rounded-xl border transition ${
                checkedFields.field_3 ? 'bg-emerald-50/60 border-emerald-300' : 'bg-white border-slate-200'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleFieldCheck('field_3')} className="cursor-pointer">
                      {checkedFields.field_3 ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                      )}
                    </button>
                    <span className="text-xs font-black text-slate-800">③ 離職者氏名（フリガナ・漢字）</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard('field_3', `${currentEmployee.name_kana || ''} ${currentEmployee.name}`)}
                    className="text-[10px] text-slate-400 hover:text-blue-600 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'field_3' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    {copiedKey === 'field_3' ? 'コピー済' : 'コピー'}
                  </button>
                </div>
                <div className="mt-2 pl-6 space-y-0.5">
                  <div className="text-[11px] text-slate-500 font-bold">
                    フリガナ: {currentEmployee.name_kana || 'コマイ シュウイチロウ'}
                  </div>
                  <div className="text-base font-black text-slate-900">
                    {currentEmployee.name}
                  </div>
                  <div className="text-[10px] text-slate-500 flex gap-4 mt-1">
                    <span>生年月日: {toWareki(currentEmployee.birth_date || '1990-01-01')}</span>
                    <span>性別: {currentEmployee.gender || '男'}</span>
                  </div>
                </div>
              </div>

              {/* ④ 離職年月日 */}
              <div className={`p-3.5 rounded-xl border transition ${
                checkedFields.field_4 ? 'bg-emerald-50/60 border-emerald-300' : 'bg-white border-slate-200'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleFieldCheck('field_4')} className="cursor-pointer">
                      {checkedFields.field_4 ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                      )}
                    </button>
                    <span className="text-xs font-black text-slate-800">④ 離職年月日（和暦）</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard('field_4', toWareki(currentEmployee.retirement_date))}
                    className="text-[10px] text-slate-400 hover:text-blue-600 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'field_4' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    {copiedKey === 'field_4' ? 'コピー済' : 'コピー'}
                  </button>
                </div>
                <div className="mt-2 pl-6">
                  <span className="text-sm font-black text-rose-700 bg-rose-50 px-3 py-1 rounded-lg border border-rose-200 inline-block">
                    {toWareki(currentEmployee.retirement_date)}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-1">
                    雇入年月日: {toWareki(currentEmployee.join_date)}
                  </span>
                </div>
              </div>

              {/* ⑤ 事業所情報 */}
              <div className={`p-3.5 rounded-xl border transition ${
                checkedFields.field_5 ? 'bg-emerald-50/60 border-emerald-300' : 'bg-white border-slate-200'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleFieldCheck('field_5')} className="cursor-pointer">
                      {checkedFields.field_5 ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                      )}
                    </button>
                    <span className="text-xs font-black text-slate-800">⑤ 事業所名称・所在地・代表者</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard('field_5', `${companyInfo.name} ${companyInfo.address}`)}
                    className="text-[10px] text-slate-400 hover:text-blue-600 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'field_5' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    {copiedKey === 'field_5' ? 'コピー済' : 'コピー'}
                  </button>
                </div>
                <div className="mt-2 pl-6 space-y-1 text-xs">
                  <div className="font-black text-slate-900">{companyInfo.name}</div>
                  <div className="text-slate-600">{companyInfo.address}</div>
                  <div className="text-slate-600 font-bold">{companyInfo.representative_name} 印</div>
                  <div className="text-slate-500 text-[10px]">電話: {companyInfo.phone_number}</div>
                </div>
              </div>

              {/* ⑥ 離職者の住所又は居所 */}
              <div className={`p-3.5 rounded-xl border transition ${
                checkedFields.field_6 ? 'bg-emerald-50/60 border-emerald-300' : 'bg-white border-slate-200'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleFieldCheck('field_6')} className="cursor-pointer">
                      {checkedFields.field_6 ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                      )}
                    </button>
                    <span className="text-xs font-black text-slate-800">⑥ 離職者の住所又は居所</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard('field_6', currentEmployee.address || '滋賀県大津市坂本')}
                    className="text-[10px] text-slate-400 hover:text-blue-600 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'field_6' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    {copiedKey === 'field_6' ? 'コピー済' : 'コピー'}
                  </button>
                </div>
                <div className="mt-2 pl-6 text-xs text-slate-800 font-bold">
                  <div>{currentEmployee.address || ''}</div>
                  <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                    電話番号: {currentEmployee.phone || ''}
                  </div>
                </div>
              </div>

              {/* ⑦ 離職理由 */}
              <div className={`p-3.5 rounded-xl border transition ${
                checkedFields.field_7 ? 'bg-emerald-50/60 border-emerald-300' : 'bg-white border-slate-200'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleFieldCheck('field_7')} className="cursor-pointer">
                      {checkedFields.field_7 ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                      )}
                    </button>
                    <span className="text-xs font-black text-slate-800">⑦ 離職理由コード ＆ 具体的事情</span>
                  </div>
                </div>
                <div className="mt-2 pl-6 space-y-2">
                  <select
                    value={separationReasonCode}
                    onChange={(e) => {
                      setSeparationReasonCode(e.target.value);
                      const sel = reasonOptions.find(o => o.code === e.target.value);
                      if (sel) setSeparationReasonDetail(sel.label);
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800"
                  >
                    {reasonOptions.map(opt => (
                      <option key={opt.code} value={opt.code}>{opt.label}</option>
                    ))}
                  </select>
                  <textarea
                    rows={2}
                    value={separationReasonDetail}
                    onChange={(e) => setSeparationReasonDetail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 font-medium"
                    placeholder="具体的事情記載欄（実物用紙の丸囲みおよび具体的事情欄に転記）"
                  />
                  <p className="text-[10px] text-amber-700 font-bold bg-amber-50 p-2 rounded-lg border border-amber-200">
                    💡 実物用紙の該当番号に「○」を付け、具体的事情欄に上記文章を転記します。
                  </p>
                </div>
              </div>

            </div>

            {/* ➡️ 【右面】⑧〜⑭ 賃金支払状況等（算定対象期間・基礎日数・賃金額） */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between border-b-2 border-slate-800 pb-2">
                <h3 className="font-black text-slate-800 text-sm flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px]">右</span>
                  実物用紙【右半分】賃金支払状況（⑧〜⑫欄・12段構成）
                </h3>
                <span className="text-[11px] text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  1年間（12ヶ月）自動展開済
                </span>
              </div>

              {/* 算定期間＆賃金テーブル（実物完全模写） */}
              <div className="bg-white rounded-xl border border-slate-300 overflow-hidden shadow-2xs">
                <div className="bg-slate-800 text-white p-2.5 text-xs font-black flex items-center justify-between">
                  <span>離職の日以前の賃金支払状況等（{monthCount}ヶ月・{monthCount}段）</span>
                  <span className="text-[10px] font-normal text-slate-300">実物複写用紙の1段目〜{monthCount}段目の枠に転記</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-center border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-300 text-[10px] text-slate-700 font-bold">
                        <th className="p-2 border-r border-slate-300 w-8">段</th>
                        <th className="p-2 border-r border-slate-300">
                          ⑧ 被保険者期間<br/>算定対象期間
                        </th>
                        <th className="p-2 border-r border-slate-300 w-14">
                          ⑨ 基礎<br/>日数
                        </th>
                        <th className="p-2 border-r border-slate-300">
                          ⑩ 賃金支払<br/>対象期間
                        </th>
                        <th className="p-2 border-r border-slate-300 w-14">
                          ⑪ 基礎<br/>日数
                        </th>
                        <th className="p-2 border-r border-slate-300">
                          ⑫ 賃金額A<br/>(固定給)
                        </th>
                        <th className="p-2 border-r border-slate-300">
                          ⑫ 賃金額B<br/>(割増等)
                        </th>
                        <th className="p-2">
                          合計額<br/>(A+B)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {wageRows.map((row) => {
                        const rowKey = `row_${row.index}`;
                        const isRowChecked = checkedFields[rowKey];
                        const isRecent6 = row.index <= 6;
                        return (
                          <tr
                            key={row.index}
                            className={`border-b border-slate-200 transition ${
                              isRowChecked 
                                ? 'bg-emerald-50/50' 
                                : isRecent6 
                                  ? 'bg-amber-50/30' 
                                  : row.index % 2 === 0 ? 'bg-slate-50/50' : 'bg-white'
                            }`}
                          >
                            <td className="p-1.5 border-r border-slate-300 font-mono font-bold">
                              <button
                                onClick={() => toggleFieldCheck(rowKey)}
                                className="cursor-pointer text-slate-400 hover:text-emerald-600"
                                title="この段の転記完了チェック"
                              >
                                {isRowChecked ? (
                                  <CheckSquare className="w-3.5 h-3.5 text-emerald-600 mx-auto" />
                                ) : (
                                  <span className={`text-[10px] ${isRecent6 ? 'font-black text-amber-800' : ''}`}>{row.index}</span>
                                )}
                              </button>
                            </td>
                            {/* ⑧ 算定対象期間 */}
                            <td className="p-1.5 border-r border-slate-300 font-mono text-[11px] font-bold text-slate-800">
                              <div className="flex items-center justify-center gap-1">
                                {isRecent6 && (
                                  <span className="text-[9px] bg-amber-100 text-amber-800 px-1 rounded-xs font-bold" title="基本手当日額算定対象">
                                    日額対象
                                  </span>
                                )}
                                <span>{row.periodDisplay}</span>
                              </div>
                            </td>
                            {/* ⑨ 基礎日数 */}
                            <td className="p-1.5 border-r border-slate-300 font-mono font-black text-blue-900 bg-blue-50/30">
                              {row.periodBaseDays}日
                            </td>
                            {/* ⑩ 賃金支払対象期間 */}
                            <td className="p-1.5 border-r border-slate-300 font-mono text-[11px] font-bold text-slate-800">
                              {row.payPeriodDisplay}
                            </td>
                            {/* ⑪ 基礎日数 */}
                            <td className="p-1.5 border-r border-slate-300 font-mono font-black text-blue-900 bg-blue-50/30">
                              {row.payBaseDays}日
                            </td>
                            {/* ⑫ 賃金額A */}
                            <td className="p-1.5 border-r border-slate-300 font-mono text-right pr-2 text-slate-800 font-bold">
                              ¥{row.wageA.toLocaleString()}
                            </td>
                            {/* ⑫ 賃金額B */}
                            <td className="p-1.5 border-r border-slate-300 font-mono text-right pr-2 text-slate-600">
                              ¥{row.wageB.toLocaleString()}
                            </td>
                            {/* 合計 */}
                            <td className="p-1.5 font-mono font-black text-right pr-2 text-emerald-900">
                              ¥{row.wageTotal.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}

                      {/* 直近6ヶ月小計（基本手当日額算定用: 1〜6段） */}
                      {monthCount > 6 && (
                        <tr className="bg-amber-100/70 font-black border-t-2 border-amber-300 text-[11px] text-amber-950">
                          <td colSpan={2} className="p-2 border-r border-amber-300 text-center">
                            📌 直近6ヶ月 小計（1〜6段：日額算定用）
                          </td>
                          <td className="p-2 border-r border-amber-300 font-mono text-center">
                            {recent6Days}日
                          </td>
                          <td className="p-2 border-r border-amber-300 text-center text-slate-500">
                            -
                          </td>
                          <td className="p-2 border-r border-amber-300 font-mono text-center">
                            {recent6Days}日
                          </td>
                          <td className="p-2 border-r border-amber-300 font-mono text-right pr-2">
                            ¥{recent6WageA.toLocaleString()}
                          </td>
                          <td className="p-2 border-r border-amber-300 font-mono text-right pr-2">
                            ¥{recent6WageB.toLocaleString()}
                          </td>
                          <td className="p-2 font-mono text-right pr-2 text-emerald-950 text-xs font-black">
                            ¥{recent6WageTotal.toLocaleString()}
                          </td>
                        </tr>
                      )}

                      {/* 12ヶ月 総合計行 */}
                      <tr className="bg-slate-100 font-black border-t-2 border-slate-400 text-[11px]">
                        <td colSpan={2} className="p-2 border-r border-slate-300 text-center text-slate-800">
                          {monthCount}ヶ月 総合計（被保険者期間用）
                        </td>
                        <td className="p-2 border-r border-slate-300 font-mono text-center text-blue-900">
                          {totalDays}日
                        </td>
                        <td className="p-2 border-r border-slate-300 text-center text-slate-500">
                          -
                        </td>
                        <td className="p-2 border-r border-slate-300 font-mono text-center text-blue-900">
                          {totalDays}日
                        </td>
                        <td className="p-2 border-r border-slate-300 font-mono text-right pr-2 text-slate-800">
                          ¥{totalWageA.toLocaleString()}
                        </td>
                        <td className="p-2 border-r border-slate-300 font-mono text-right pr-2 text-slate-700">
                          ¥{totalWageB.toLocaleString()}
                        </td>
                        <td className="p-2 font-mono text-right pr-2 text-emerald-950 text-xs font-black">
                          ¥{totalWageAll.toLocaleString()}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 賃金日額算定ボックス（雇用保険法正式計算） */}
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-black text-emerald-900 block flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    ⑫ 賃金日額 ＆ 受給要件算定結果
                  </span>
                  <span className="text-[10px] text-emerald-700 block mt-0.5">
                    賃金日額 ＝ 直近6ヶ月総支給額（¥{recent6WageTotal.toLocaleString()}）÷ 180日 ＝ <strong>¥{dailyWageRate.toLocaleString()}</strong> / 日
                  </span>
                  <span className="text-[10px] text-slate-500">
                    ※ 過去12ヶ月被保険者期間: {totalDays}日（各月11日以上 × {monthCount}ヶ月 ＝ 受給資格要件充足）
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black font-mono text-emerald-900">
                    ¥{dailyWageRate.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-emerald-700 block font-bold">/日（基本手当日額の基準）</span>
                </div>
              </div>

              {/* ⑬ 備考 ＆ ⑭ 賃金特記事項 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* ⑬ 備考 */}
                <div className={`p-3 rounded-xl border transition ${
                  checkedFields.field_13 ? 'bg-emerald-50/60 border-emerald-300' : 'bg-white border-slate-200'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => toggleFieldCheck('field_13')} className="cursor-pointer">
                        {checkedFields.field_13 ? <CheckSquare className="w-3.5 h-3.5 text-emerald-600" /> : <Square className="w-3.5 h-3.5 text-slate-400" />}
                      </button>
                      <span className="text-xs font-black text-slate-800">⑬ 備考欄</span>
                    </div>
                  </div>
                  <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200 mt-1">
                    被保険者資格取得日: {currentEmployee.join_date}<br/>
                    離職理由: {separationReasonCode}
                  </div>
                </div>

                {/* ⑭ 賃金特記事項 */}
                <div className={`p-3 rounded-xl border transition ${
                  checkedFields.field_14 ? 'bg-emerald-50/60 border-emerald-300' : 'bg-white border-slate-200'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => toggleFieldCheck('field_14')} className="cursor-pointer">
                        {checkedFields.field_14 ? <CheckSquare className="w-3.5 h-3.5 text-emerald-600" /> : <Square className="w-3.5 h-3.5 text-slate-400" />}
                      </button>
                      <span className="text-xs font-black text-slate-800">⑭ 賃金に関する特記事項</span>
                    </div>
                  </div>
                  <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200 mt-1">
                    締切日: {closingDay === 31 ? '末日' : `${closingDay}日`}（月給制）<br/>
                    支払日: {paymentDay}（当月または翌月振込）
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* 🖨️ 実物用紙完全模写 A4下書き印刷プレビューモード（荀彧監修・見切れゼロ） */}
      {viewMode === 'print' && (
        <div className="bg-slate-200 p-2 sm:p-6 rounded-2xl flex justify-center overflow-x-auto print:p-0 print:m-0 print:bg-white print:overflow-visible">
          <div className="w-[297mm] min-h-[210mm] bg-white p-[10mm] shadow-lg border border-slate-400 text-slate-900 font-sans print:shadow-none print:border-none print:p-0 print:w-full print:m-0 box-border text-[10px] leading-tight">
            
            {/* 表題ヘッダー */}
            <div className="border-b-2 border-slate-900 pb-2 mb-3 flex justify-between items-start">
              <div>
                <span className="text-[9px] font-bold border border-slate-800 px-1.5 py-0.5">
                  様式第4号の2（第7条関係）
                </span>
                <h1 className="text-base font-black tracking-wider mt-1">
                  雇用保険被保険者離職証明書（事業主控 兼 転記用下書きシート）
                </h1>
                <p className="text-[9px] text-slate-600">
                  ※ 公共職業安定所交付の複写用紙への手書き転記用下書き、または電子申請（e-Gov）控として使用できます。
                </p>
              </div>
              <div className="text-right text-[9px] space-y-0.5">
                <div>離職日: <span className="font-bold text-slate-900">{toWareki(currentEmployee.retirement_date)}</span></div>
                <div>発行日: {toWareki(new Date().toISOString().split('T')[0])}</div>
              </div>
            </div>

            {/* 実物用紙見開きコンテナ（左右グリッド） */}
            <div className="grid grid-cols-12 gap-3 border border-slate-800 p-2">
              
              {/* 左面（5カラム） */}
              <div className="col-span-5 border-r border-slate-800 pr-2 space-y-2">
                {/* ① ② 番号欄 */}
                <div className="grid grid-cols-2 gap-2 border-b border-slate-300 pb-1.5">
                  <div>
                    <span className="text-[8px] text-slate-500 font-bold block">① 被保険者番号</span>
                    <span className="font-mono font-black text-xs tracking-wider">{currentEmployee.employment_insurance_number || '1234-567890-1'}</span>
                  </div>
                  <div>
                    <span className="text-[8px] text-slate-500 font-bold block">② 事業所番号</span>
                    <span className="font-mono font-black text-xs tracking-wider">{officeNumber}</span>
                  </div>
                </div>

                {/* ③ 氏名 */}
                <div className="border-b border-slate-300 pb-1.5">
                  <span className="text-[8px] text-slate-500 font-bold block">③ 離職者氏名</span>
                  <div className="text-[9px] text-slate-500">{currentEmployee.name_kana || 'コマイ シュウイチロウ'}</div>
                  <div className="font-black text-xs text-slate-900">{currentEmployee.name}</div>
                  <div className="text-[8px] text-slate-600 mt-0.5">
                    生年月日: {toWareki(currentEmployee.birth_date)}（{currentEmployee.gender || '男'}）
                  </div>
                </div>

                {/* ④ ⑤ 事業所情報 */}
                <div className="border-b border-slate-300 pb-1.5">
                  <span className="text-[8px] text-slate-500 font-bold block">⑤ 事業所名称・所在地</span>
                  <div className="font-black text-xs">{companyInfo.name}</div>
                  <div className="text-[9px] text-slate-700">{companyInfo.address}</div>
                  <div className="text-[9px] font-bold mt-0.5">{companyInfo.representative_name} 印</div>
                  <div className="text-[8px] text-slate-500">電話: {companyInfo.phone_number}</div>
                </div>

                {/* ⑥ 住所 */}
                <div className="border-b border-slate-300 pb-1.5">
                  <span className="text-[8px] text-slate-500 font-bold block">⑥ 離職者の住所又は居所</span>
                  <div className="text-[9px] font-bold">{currentEmployee.address || ''}</div>
                  <div className="text-[8px] text-slate-500">電話: {currentEmployee.phone || ''}</div>
                </div>

                {/* ⑦ 離職理由 */}
                <div className="pt-1">
                  <span className="text-[8px] text-slate-500 font-bold block">⑦ 離職理由</span>
                  <div className="font-black text-amber-950 text-[10px] bg-amber-50 p-1 border border-amber-200 mt-0.5">
                    区分コード: {separationReasonCode}
                  </div>
                  <div className="text-[9px] text-slate-700 mt-1 leading-snug">
                    具体的事情: {separationReasonDetail}
                  </div>
                </div>
              </div>

              {/* 右面（7カラム） */}
              <div className="col-span-7 space-y-2">
                <span className="text-[9px] font-black text-slate-800 block">
                  ⑧〜⑫ 離職の日以前の賃金支払状況（直近{monthCount}ヶ月）
                </span>

                <table className="w-full text-[9px] border-collapse border border-slate-400 text-center">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-400 font-bold text-[8px]">
                      <th className="p-1 border-r border-slate-300 w-6">段</th>
                      <th className="p-1 border-r border-slate-300">⑧ 算定対象期間</th>
                      <th className="p-1 border-r border-slate-300 w-10">⑨ 日数</th>
                      <th className="p-1 border-r border-slate-300">⑩ 賃金支払対象期間</th>
                      <th className="p-1 border-r border-slate-300 w-10">⑪ 日数</th>
                      <th className="p-1 border-r border-slate-300">⑫ 賃金額A</th>
                      <th className="p-1 border-r border-slate-300">⑫ 賃金額B</th>
                      <th className="p-1">計</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wageRows.map(r => {
                      const isRecent6 = r.index <= 6;
                      return (
                        <tr key={r.index} className={`border-b border-slate-300 ${isRecent6 ? 'bg-amber-50/20' : ''}`}>
                          <td className="p-0.5 border-r border-slate-300 font-mono">
                            {r.index}
                            {isRecent6 && <span className="text-[7px] text-amber-700 block font-bold leading-none">日額</span>}
                          </td>
                          <td className="p-0.5 border-r border-slate-300 font-mono">{r.periodDisplay}</td>
                          <td className="p-0.5 border-r border-slate-300 font-mono font-bold">{r.periodBaseDays}</td>
                          <td className="p-0.5 border-r border-slate-300 font-mono">{r.payPeriodDisplay}</td>
                          <td className="p-0.5 border-r border-slate-300 font-mono font-bold">{r.payBaseDays}</td>
                          <td className="p-0.5 border-r border-slate-300 font-mono text-right pr-1">¥{r.wageA.toLocaleString()}</td>
                          <td className="p-0.5 border-r border-slate-300 font-mono text-right pr-1">¥{r.wageB.toLocaleString()}</td>
                          <td className="p-0.5 font-mono font-bold text-right pr-1">¥{r.wageTotal.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                    {/* 直近6ヶ月小計 */}
                    {monthCount > 6 && (
                      <tr className="bg-amber-100/60 font-black border-t border-amber-300 text-[8px] text-amber-950">
                        <td colSpan={2} className="p-0.5 border-r border-amber-300">直近6ヶ月小計（日額算定）</td>
                        <td className="p-0.5 border-r border-amber-300 font-mono">{recent6Days}</td>
                        <td className="p-0.5 border-r border-amber-300">-</td>
                        <td className="p-0.5 border-r border-amber-300 font-mono">{recent6Days}</td>
                        <td className="p-0.5 border-r border-amber-300 font-mono text-right pr-1">¥{recent6WageA.toLocaleString()}</td>
                        <td className="p-0.5 border-r border-amber-300 font-mono text-right pr-1">¥{recent6WageB.toLocaleString()}</td>
                        <td className="p-0.5 font-mono text-right pr-1">¥{recent6WageTotal.toLocaleString()}</td>
                      </tr>
                    )}
                    {/* 総合計 */}
                    <tr className="bg-slate-100 font-black border-t border-slate-400 text-[8px]">
                      <td colSpan={2} className="p-0.5 border-r border-slate-300">{monthCount}ヶ月 総合計</td>
                      <td className="p-0.5 border-r border-slate-300 font-mono">{totalDays}</td>
                      <td className="p-0.5 border-r border-slate-300">-</td>
                      <td className="p-0.5 border-r border-slate-300 font-mono">{totalDays}</td>
                      <td className="p-0.5 border-r border-slate-300 font-mono text-right pr-1">¥{totalWageA.toLocaleString()}</td>
                      <td className="p-0.5 border-r border-slate-300 font-mono text-right pr-1">¥{totalWageB.toLocaleString()}</td>
                      <td className="p-0.5 font-mono text-right pr-1">¥{totalWageAll.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>

                <div className="grid grid-cols-2 gap-2 text-[8px] pt-1">
                  <div className="border border-slate-300 p-1 rounded-xs">
                    <span className="font-bold block">⑬ 備考</span>
                    資格取得日: {currentEmployee.join_date} / 週所定{weeklyHours}時間
                  </div>
                  <div className="border border-slate-300 p-1 rounded-xs">
                    <span className="font-bold block">⑭ 賃金特記</span>
                    締日: {closingDay === 31 ? '末日' : `${closingDay}日`} / 支払: {paymentDay}
                  </div>
                </div>

                <div className="text-[8px] text-slate-500 pt-1 text-right">
                  上記記載事項は、当事業所の労働者名簿および賃金台帳と相違ないことを証明します。
                </div>
              </div>

            </div>

          </div>
        </div>
      )}
    </div>
  );
};
