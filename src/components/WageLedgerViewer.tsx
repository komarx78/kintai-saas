import React, { useState, useMemo } from 'react';
import { 
  Printer, Download, ArrowLeftRight, Search, 
  ChevronRight, Maximize2, Minimize2, ArrowLeft,
  FileSpreadsheet
} from 'lucide-react';

export interface WageLedgerViewerProps {
  tenantId: string;
  employees: any[];
  companyInfo: any;
  initialYear?: number;
  initialEmployeeId?: string;
  onBackToReports?: () => void;
  isModalMode?: boolean;
}

// 賃金台帳の1ヶ月分の集計行データ
interface MonthlyWageItem {
  month: number;
  label: string; // '1月度'
  period: string; // '12/21 - 1/20' 等
  workDays: number;
  totalWorkHours: number;
  prescribedHours: number;
  paidLeaveRemaining: number;
  baseSalary: number;
  overtimePay: number;
  allowanceTotal: number;
  taxableEarnings: number;
  totalEarnings: number;
  socialTargetTotal: number;
  fixedWageTotal: number;
  executiveRemunerationTotal: number;
  healthInsurance: number;
  nursingInsurance: number;
  pensionInsurance: number;
  employmentInsurance: number;
  incomeTax: number;
  childCareContribution: number;
  socialInsuranceTotal: number;
  deductionTotal: number;
  afterSocialTotal: number;
  netPayment: number;
  bankTransferRemaining: number;
}

export const WageLedgerViewer: React.FC<WageLedgerViewerProps> = ({
  tenantId: _tenantId,
  employees,
  companyInfo,
  initialYear = new Date().getFullYear(),
  initialEmployeeId,
  onBackToReports,
  isModalMode: _isModalMode = false
}) => {
  const [selectedYear, setSelectedYear] = useState<number>(initialYear);
  const [selectedEmpId, setSelectedEmpId] = useState<string>(() => {
    if (initialEmployeeId && initialEmployeeId !== 'all') return initialEmployeeId;
    return employees.length > 0 ? employees[0].id : '';
  });

  // フィルター
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [contractFilter, setContractFilter] = useState<string>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // 表示設定
  const [isTransposed, setIsTransposed] = useState<boolean>(false); // 行列入れ替え
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false); // 大きな画面で表示

  // 部署一覧の抽出
  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => {
      if (e.department) set.add(e.department);
    });
    return Array.from(set);
  }, [employees]);

  // 従業員の絞り込み
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      // 部署フィルター
      if (departmentFilter !== 'ALL' && emp.department !== departmentFilter) {
        return false;
      }
      // 契約種別フィルター
      if (contractFilter !== 'ALL') {
        const isPart = emp.employment_type === 'part-time' || emp.salary_type === 'hourly';
        if (contractFilter === 'full-time' && isPart) return false;
        if (contractFilter === 'part-time' && !isPart) return false;
        if (contractFilter === 'executive' && emp.role !== 'admin' && !emp.is_executive) return false;
      }
      // 検索キーワード
      if (searchKeyword.trim()) {
        const q = searchKeyword.trim().toLowerCase();
        const num = (emp.employee_number || emp.insurance_number || '').toLowerCase();
        const name = (emp.name || '').toLowerCase();
        const kana = (emp.name_kana || '').toLowerCase();
        if (!num.includes(q) && !name.includes(q) && !kana.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [employees, departmentFilter, contractFilter, searchKeyword]);

  // 選択中の従業員オブジェクト
  const currentEmployee = useMemo(() => {
    return employees.find(e => e.id === selectedEmpId) || filteredEmployees[0] || employees[0] || null;
  }, [employees, selectedEmpId, filteredEmployees]);

  // 選択中従業員の年間12ヶ月分の賃金データを生成・集計
  const monthlyDataList = useMemo<MonthlyWageItem[]>(() => {
    if (!currentEmployee) return [];

    const isPartTime = currentEmployee.employment_type === 'part-time' || currentEmployee.salary_type === 'hourly';
    const isExecutive = currentEmployee.is_executive || currentEmployee.department?.includes('役員') || currentEmployee.name === '駒井 秀一朗';
    const base = Number(currentEmployee.base_salary) || (isPartTime ? 1200 : 250000);

    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      // MFクラウド給与風締め期間（例: 20日締め翌月10日払い等の期間表示）
      const prevM = m === 1 ? 12 : m - 1;
      const period = `${prevM}/21 - ${m}/20`;

      // 勤怠シミュレーション・実績
      const workDays = isPartTime ? 16.0 : (20 + (m % 3 === 0 ? 2 : m % 2 === 0 ? 1 : 0));
      const prescribedHours = isPartTime ? workDays * 6 : workDays * 8;
      const otHours = (!isExecutive && !isPartTime && m % 2 === 0) ? 12 : 0;
      const totalWorkHours = prescribedHours + otHours;
      const paidLeaveRemaining = Math.max(0, 10.0 - Math.floor(m / 4));

      // 支給項目
      let basePay = isPartTime ? Math.round(base * totalWorkHours) : base;
      const overtimePay = otHours > 0 ? Math.round((base / 160) * 1.25 * otHours) : 0;
      const allowanceTotal = (!isPartTime && !isExecutive) ? 15000 : 0; // 通勤手当等
      const gross = basePay + overtimePay + allowanceTotal;
      const taxable = gross;

      // 控除項目（社会保険・税金）
      const healthJoined = currentEmployee.health_insurance_joined !== false;
      const pensionJoined = currentEmployee.pension_insurance_joined !== false;
      const empInsJoined = currentEmployee.employment_insurance_joined !== false;

      const health = healthJoined ? Math.round(gross * 0.0494) : 0;
      const nursing = (healthJoined && currentEmployee.birth_date && new Date().getFullYear() - new Date(currentEmployee.birth_date).getFullYear() >= 40)
        ? Math.round(gross * 0.008)
        : 0;
      const pension = pensionJoined ? Math.round(gross * 0.0915) : 0;
      const empIns = (empInsJoined && !isExecutive) ? Math.round(gross * 0.006) : 0;
      const childCare = isExecutive ? 925 : 0;

      const socTotal = health + nursing + pension + empIns;
      const depCount = currentEmployee.dependents_count || 0;
      const taxableForIncomeTax = Math.max(0, gross - socTotal);
      const taxRate = Math.max(0.02, 0.05 - (depCount * 0.01));
      const incomeTax = Math.round(taxableForIncomeTax * taxRate);
      const dedTotal = socTotal + incomeTax + childCare;
      const afterSoc = gross - socTotal;
      const net = gross - dedTotal;

      return {
        month: m,
        label: `${m}月度`,
        period,
        workDays,
        totalWorkHours,
        prescribedHours,
        paidLeaveRemaining,
        baseSalary: isExecutive ? 0 : basePay,
        overtimePay,
        allowanceTotal,
        taxableEarnings: taxable,
        totalEarnings: gross,
        socialTargetTotal: gross,
        fixedWageTotal: basePay,
        executiveRemunerationTotal: isExecutive ? basePay : 0,
        healthInsurance: health,
        nursingInsurance: nursing,
        pensionInsurance: pension,
        employmentInsurance: empIns,
        incomeTax,
        childCareContribution: childCare,
        socialInsuranceTotal: socTotal,
        deductionTotal: dedTotal,
        afterSocialTotal: afterSoc,
        netPayment: net,
        bankTransferRemaining: net
      };
    });
  }, [currentEmployee]);

  // 年間合計の算出
  const annualTotal = useMemo(() => {
    return monthlyDataList.reduce((acc, cur) => {
      acc.workDays += cur.workDays;
      acc.totalWorkHours += cur.totalWorkHours;
      acc.prescribedHours += cur.prescribedHours;
      acc.baseSalary += cur.baseSalary;
      acc.overtimePay += cur.overtimePay;
      acc.allowanceTotal += cur.allowanceTotal;
      acc.taxableEarnings += cur.taxableEarnings;
      acc.totalEarnings += cur.totalEarnings;
      acc.socialTargetTotal += cur.socialTargetTotal;
      acc.fixedWageTotal += cur.fixedWageTotal;
      acc.executiveRemunerationTotal += cur.executiveRemunerationTotal;
      acc.healthInsurance += cur.healthInsurance;
      acc.nursingInsurance += cur.nursingInsurance;
      acc.pensionInsurance += cur.pensionInsurance;
      acc.employmentInsurance += cur.employmentInsurance;
      acc.incomeTax += cur.incomeTax;
      acc.childCareContribution += cur.childCareContribution;
      acc.socialInsuranceTotal += cur.socialInsuranceTotal;
      acc.deductionTotal += cur.deductionTotal;
      acc.afterSocialTotal += cur.afterSocialTotal;
      acc.netPayment += cur.netPayment;
      acc.bankTransferRemaining += cur.bankTransferRemaining;
      return acc;
    }, {
      workDays: 0,
      totalWorkHours: 0,
      prescribedHours: 0,
      paidLeaveRemaining: monthlyDataList.length > 0 ? monthlyDataList[monthlyDataList.length - 1].paidLeaveRemaining : 0,
      baseSalary: 0,
      overtimePay: 0,
      allowanceTotal: 0,
      taxableEarnings: 0,
      totalEarnings: 0,
      socialTargetTotal: 0,
      fixedWageTotal: 0,
      executiveRemunerationTotal: 0,
      healthInsurance: 0,
      nursingInsurance: 0,
      pensionInsurance: 0,
      employmentInsurance: 0,
      incomeTax: 0,
      childCareContribution: 0,
      socialInsuranceTotal: 0,
      deductionTotal: 0,
      afterSocialTotal: 0,
      netPayment: 0,
      bankTransferRemaining: 0
    });
  }, [monthlyDataList]);

  // 表示する項目一覧定義（MFクラウド給与の行順を忠実に再現）
  const tableRows = useMemo(() => {
    return [
      { id: 'workDays', name: '出勤日数（平日）', format: (v: number) => v.toFixed(1), category: 'attendance' },
      { id: 'totalWorkHours', name: '総労働時間（平日）', format: (v: number) => v.toFixed(2), category: 'attendance' },
      { id: 'prescribedHours', name: '所定時間（平日）', format: (v: number) => v.toFixed(2), category: 'attendance' },
      { id: 'paidLeaveRemaining', name: '有休残日数', format: (v: number) => v.toFixed(1), category: 'attendance' },
      
      { id: 'baseSalary', name: '基本給（支給）', format: (v: number) => v > 0 ? v.toLocaleString() : '-', category: 'earnings' },
      { id: 'executiveRemunerationTotal', name: '役員報酬（支給）', format: (v: number) => v > 0 ? v.toLocaleString() : '-', category: 'earnings' },
      { id: 'taxableEarnings', name: '課税支給合計', format: (v: number) => v.toLocaleString(), isSubtotal: true, category: 'earnings' },
      { id: 'totalEarnings', name: '支給合計', format: (v: number) => v.toLocaleString(), isMajor: true, category: 'earnings' },
      { id: 'socialTargetTotal', name: '社保対象合計（金銭）', format: (v: number) => v.toLocaleString(), category: 'earnings' },
      { id: 'fixedWageTotal', name: '固定賃金合計', format: (v: number) => v.toLocaleString(), category: 'earnings' },
      
      { id: 'healthInsurance', name: '健康保険料（控除）', format: (v: number) => v.toLocaleString(), category: 'deduction' },
      { id: 'nursingInsurance', name: '介護保険料（控除）', format: (v: number) => v.toLocaleString(), category: 'deduction' },
      { id: 'pensionInsurance', name: '厚生年金保険料（控除）', format: (v: number) => v.toLocaleString(), category: 'deduction' },
      { id: 'employmentInsurance', name: '雇用保険料（控除）', format: (v: number) => v.toLocaleString(), category: 'deduction' },
      { id: 'incomeTax', name: '所得税（控除）', format: (v: number) => v.toLocaleString(), category: 'deduction' },
      { id: 'childCareContribution', name: '子ども・子育て拠出金（控除）', format: (v: number) => v > 0 ? v.toLocaleString() : '-', category: 'deduction' },
      { id: 'socialInsuranceTotal', name: '社会保険料合計', format: (v: number) => v.toLocaleString(), isSubtotal: true, category: 'deduction' },
      { id: 'deductionTotal', name: '控除合計', format: (v: number) => v.toLocaleString(), isMajor: true, category: 'deduction' },
      
      { id: 'afterSocialTotal', name: '社保控除後合計', format: (v: number) => v.toLocaleString(), isSubtotal: true, category: 'net' },
      { id: 'netPayment', name: '差引支給合計', format: (v: number) => v.toLocaleString(), isHighlight: true, category: 'net' },
      { id: 'bankTransferRemaining', name: '振込支給残額', format: (v: number) => v.toLocaleString(), isHighlight: true, category: 'net' }
    ];
  }, []);

  // CSVダウンロード
  const handleDownloadCsv = () => {
    if (!currentEmployee) return;
    const headers = ['項目名', ...monthlyDataList.map(m => m.label), '年間合計'];
    const rows = tableRows.map(row => {
      const vals = monthlyDataList.map(m => (m as any)[row.id]);
      const tot = (annualTotal as any)[row.id];
      return [row.name, ...vals, tot];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `賃金台帳_${selectedYear}年_${currentEmployee.name}.csv`;
    link.click();
  };

  return (
    <div className={`mf-wage-ledger-root bg-slate-50 min-h-screen text-slate-800 font-sans flex flex-col print:min-h-0 print:h-auto print:bg-white print:overflow-hidden ${isFullscreen ? 'fixed inset-0 z-50 overflow-y-auto' : ''}`}>
      
      {/* 印刷用CSS（A4横向き・1枚完結黄金比ピッタリ収束レイアウト） */}
      <style>{`
        @media print {
          @page {
            size: landscape !important;
            margin: 4.5mm 6mm 4.5mm 6mm !important;
          }
          *, *::before, *::after {
            box-sizing: border-box !important;
          }
          html, body {
            width: 100% !important;
            height: 100% !important;
            max-height: 100% !important;
            overflow: hidden !important;
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #root, .mf-wage-ledger-root {
            height: 100% !important;
            max-height: 100% !important;
            overflow: hidden !important;
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          header, nav, aside, .mf-wage-ledger-sidebar, .mf-wage-ledger-header-actions, .mf-app-nav, .print\\:hidden, [role="navigation"] {
            display: none !important;
          }
          .mf-wage-ledger-main {
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            overflow: visible !important;
            display: block !important;
            height: auto !important;
          }
          .mf-table-container {
            overflow: visible !important;
            border: 1px solid #475569 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          table {
            width: 100% !important;
            min-width: 0 !important;
            max-width: 100% !important;
            border-collapse: collapse !important;
            font-size: 8pt !important;
            line-height: 1.2 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            height: auto !important;
          }
          th, td {
            min-width: 0 !important;
            padding-top: 3.2px !important;
            padding-bottom: 3.2px !important;
            padding-left: 3px !important;
            padding-right: 3px !important;
            font-size: 8pt !important;
            line-height: 1.2 !important;
            border: 1px solid #64748b !important;
            white-space: nowrap !important;
          }
          th div {
            font-size: 7.2pt !important;
            line-height: 1.15 !important;
          }
          .sticky {
            position: static !important;
          }
          .mf-wage-ledger-footer {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
        }
      `}</style>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ① 最上部 ナビゲーションバー（MFクラウド給与スタイル）             */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white border-b border-slate-200 px-6 py-2.5 flex items-center justify-between shadow-2xs print:hidden">
        <div className="flex items-center space-x-3">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
            <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
            <span>賃金台帳</span>
          </div>
          <span className="text-xs text-slate-400 font-medium">| 労働基準法第108条 法定三帳簿</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right text-xs">
            <span className="font-bold text-slate-800">{companyInfo?.name || '株式会社KAP'}</span>
            <span className="text-slate-400 ml-2">担当: {companyInfo?.representative_name || '駒井 秀一朗'}</span>
          </div>
          {onBackToReports && (
            <button
              onClick={onBackToReports}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              帳票センターへ戻る
            </button>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ② メイン2カラムコンテンツ（左: 社員選択サイドバー / 右: 賃金台帳） */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex overflow-hidden print:block print:overflow-visible print:h-auto">
        
        {/* ◀ 左側：社員選択サイドバー（一人ずつ見れるセレクター） */}
        <aside className="mf-wage-ledger-sidebar w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 p-3 space-y-3 select-none print:hidden">
          
          {/* 帳票一覧へ戻るリンク */}
          {onBackToReports && (
            <button
              onClick={onBackToReports}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 py-1 transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              帳票一覧へ戻る
            </button>
          )}

          {/* ドロップダウンフィルター群（MF完全一致） */}
          <div className="space-y-1.5 text-xs">
            <div>
              <label className="text-[10px] text-slate-400 font-bold block mb-0.5">事業所</label>
              <select className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 text-xs font-medium">
                <option value="all">全社</option>
                <option value="main">本社</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 font-bold block mb-0.5">部門</label>
              <select 
                value={departmentFilter}
                onChange={e => setDepartmentFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 text-xs font-medium"
              >
                <option value="ALL">全部門</option>
                {departments.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 font-bold block mb-0.5">役職・職種</label>
              <select className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 text-xs font-medium">
                <option value="ALL">全職種</option>
                <option value="sales">営業</option>
                <option value="admin">事務</option>
                <option value="field">現場</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 font-bold block mb-0.5">契約種別</label>
              <select 
                value={contractFilter}
                onChange={e => setContractFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 text-xs font-medium"
              >
                <option value="ALL">全契約種別</option>
                <option value="full-time">正社員（月給制）</option>
                <option value="part-time">パート・アルバイト（時給制）</option>
                <option value="executive">役員</option>
              </select>
            </div>
          </div>

          {/* 検索ボックス */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="従業員番号 / 氏名"
              value={searchKeyword}
              onChange={e => setSearchKeyword(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 font-medium"
            />
          </div>

          {/* 従業員リスト（縦並び・一人ずつ選択可能） */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-slate-50/50">
            {filteredEmployees.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                該当する従業員がいません
              </div>
            ) : (
              filteredEmployees.map((emp, idx) => {
                const isSelected = emp.id === currentEmployee?.id;
                const empNum = emp.employee_number || emp.insurance_number || idx;

                return (
                  <button
                    key={emp.id}
                    onClick={() => setSelectedEmpId(emp.id)}
                    className={`w-full text-left px-3 py-2.5 text-xs transition flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-slate-200 font-black text-slate-900 border-l-3 border-indigo-600'
                        : 'hover:bg-slate-100/80 text-slate-700'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <span className="font-mono text-slate-400 text-[11px] mr-1">{empNum} /</span>
                      <span className="truncate">{emp.name}</span>
                    </div>
                    {isSelected && (
                      <ChevronRight className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="text-[10px] text-slate-400 text-center">
            全 {filteredEmployees.length} 名中 1名表示中
          </div>
        </aside>

        {/* ▶ 右側：賃金台帳メインエリア（MFクラウド給与スタイル） */}
        <main className="mf-wage-ledger-main flex-1 bg-white flex flex-col overflow-y-auto p-4 sm:p-6 lg:p-8 print:p-0 print:m-0 print:overflow-visible print:h-auto print:block">
          
          {/* 上部タイトル ＆ アクションバー */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4 mb-4 print:hidden">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                賃金台帳
                <span className="text-xs font-normal text-slate-500 font-mono">
                  ({selectedYear}年01月01日 〜 {selectedYear}年12月31日)
                </span>
              </h2>
            </div>

            {/* 右上操作ボタン群（MF完全一致） */}
            <div className="mf-wage-ledger-header-actions flex items-center gap-2 flex-wrap print:hidden text-xs">
              {/* 期間変更（年度切替） */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 px-1">年度:</span>
                {[2024, 2025, 2026, 2027].map(y => (
                  <button
                    key={y}
                    onClick={() => setSelectedYear(y)}
                    className={`px-2 py-0.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      selectedYear === y ? 'bg-white shadow-2xs text-indigo-600' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {y}年
                  </button>
                ))}
              </div>

              {/* 行列入れ替え */}
              <button
                onClick={() => setIsTransposed(!isTransposed)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                  isTransposed 
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700' 
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
                title="月度と項目名の縦横を入れ替えて表示します"
              >
                <ArrowLeftRight className="w-3.5 h-3.5 text-slate-500" />
                行列入れ替え
              </button>

              {/* 全社一括印刷 */}
              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl font-bold flex items-center gap-1 cursor-pointer transition shadow-2xs"
              >
                <Printer className="w-3.5 h-3.5" />
                一括印刷
              </button>
            </div>
          </div>

          {/* 選択中の社員ヘッダー ＆ 個別操作バー */}
          {currentEmployee ? (
            <div>
              {/* 🖨️ 印刷専用スリム法定ヘッダー（A4横1枚ピッタリ収束仕様） */}
              <div className="hidden print:block mb-2 pb-1 border-b-2 border-slate-900">
                <div className="flex justify-between items-end mb-1">
                  <div className="flex items-baseline gap-3">
                    <h1 className="text-base font-black text-slate-900 tracking-wider">
                      令和{selectedYear - 2018}年度 賃金台帳
                    </h1>
                    <span className="text-[8pt] text-slate-600 font-sans">
                      （労働基準法第108条・施行規則第54条 準拠）
                    </span>
                  </div>
                  <div className="text-[8pt] text-slate-600 font-sans text-right">
                    <span>対象期間: {selectedYear}年01月01日 〜 {selectedYear}年12月31日</span>
                    <span className="ml-3 font-bold text-slate-900">事業所名: {companyInfo?.name || '株式会社KAP'}</span>
                  </div>
                </div>

                {/* 社員情報スリム枠 */}
                <div className="bg-slate-100 border border-slate-400 px-3 py-1.5 flex items-center justify-between text-[8pt] font-sans">
                  <div className="flex items-center gap-4">
                    <span><strong className="text-slate-600 font-bold">氏名:</strong> <strong className="text-slate-950 font-black text-[9pt]">{currentEmployee.name}</strong> {currentEmployee.name_kana && <span className="text-slate-500 font-normal">（{currentEmployee.name_kana}）</span>}</span>
                    <span><strong className="text-slate-600 font-bold">社員番号:</strong> <span className="font-mono font-bold">{currentEmployee.employee_number || '0001'}</span></span>
                    <span><strong className="text-slate-600 font-bold">所属:</strong> <span className="font-bold">{currentEmployee.department || '本社'}</span></span>
                    <span><strong className="text-slate-600 font-bold">役職:</strong> <span>{currentEmployee.position_name || (currentEmployee.is_executive ? '役員' : '一般社員')}</span></span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span><strong className="text-slate-600 font-bold">雇入年月日:</strong> <span className="font-mono">{currentEmployee.join_date || `${selectedYear}-04-01`}</span></span>
                    <span><strong className="text-slate-600 font-bold">給与形態:</strong> <span className="font-bold">{currentEmployee.salary_type === 'hourly' ? '時給制' : '月給制'}</span></span>
                    <span><strong className="text-slate-600 font-bold">扶養親族:</strong> <span>{currentEmployee.dependents_count || 0}名</span></span>
                  </div>
                </div>
              </div>

              {/* 画面用社員情報カード */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200 mb-4 print:hidden">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-xs">
                    {currentEmployee.name.slice(0, 1)}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                      {currentEmployee.name}
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600">
                        {currentEmployee.department || '所属なし'}
                      </span>
                      {currentEmployee.is_executive && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300">
                          役員
                        </span>
                      )}
                    </h3>
                    <div className="text-xs text-slate-400 flex items-center gap-3 mt-0.5 font-mono">
                      <span>社員番号: {currentEmployee.employee_number || '0001'}</span>
                      <span>雇入日: {currentEmployee.join_date || `${selectedYear}-04-01`}</span>
                      <span>給与形態: {currentEmployee.salary_type === 'hourly' ? '時給制' : '月給制'}</span>
                    </div>
                  </div>
                </div>

                {/* 個別操作ボタン（MF完全準拠: 大きな画面で表示 / 印刷 / CSVダウンロード） */}
                <div className="flex items-center gap-2 print:hidden">
                  <button
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    {isFullscreen ? '通常画面に戻す' : '大きな画面で表示'}
                  </button>

                  <button
                    onClick={() => window.print()}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    印刷
                  </button>

                  <button
                    onClick={handleDownloadCsv}
                    className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    CSVダウンロード
                  </button>
                </div>
              </div>

              {/* ═════════════════════════════════════════════════════════════ */}
              {/* ③ 賃金台帳マトリクステーブル（MFクラウド給与スタイル）       */}
              {/* ═════════════════════════════════════════════════════════════ */}
              <div className="mf-table-container border border-slate-300 rounded-2xl overflow-x-auto shadow-sm bg-white">
                
                {!isTransposed ? (
                  // 通常表示: 縦に項目、横に1月度〜12月度 ＋ 年間合計（ユーザー画像スタイル）
                  <table className="w-full border-collapse text-xs text-right select-text min-w-[1100px]">
                    <thead>
                      <tr className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-300">
                        <th className="p-2.5 text-left border-r border-slate-300 sticky left-0 bg-slate-100 z-10 min-w-[180px]">
                          項目名
                        </th>
                        {monthlyDataList.map(m => (
                          <th key={m.month} className="p-2 border-r border-slate-200 min-w-[76px] text-center font-mono">
                            <div className="text-[11px] font-black text-slate-900">{m.label}</div>
                            <div className="text-[9px] font-normal text-slate-400">{m.period}</div>
                          </th>
                        ))}
                        <th className="p-2 bg-slate-200/70 text-slate-950 font-black min-w-[95px] text-right pr-3">
                          年間合計
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-mono">
                      {tableRows.map(row => {
                        const isMajor = row.isMajor;
                        const isSubtotal = row.isSubtotal;
                        const isHighlight = row.isHighlight;

                        let rowBg = 'hover:bg-slate-50/80';
                        if (isHighlight) rowBg = 'bg-emerald-50/50 hover:bg-emerald-50 font-bold text-emerald-950';
                        else if (isMajor) rowBg = 'bg-slate-100/60 font-bold text-slate-900';
                        else if (isSubtotal) rowBg = 'bg-slate-50/40 text-slate-800';

                        return (
                          <tr key={row.id} className={`${rowBg} transition`}>
                            {/* 項目名（左端固定） */}
                            <td className={`p-2 text-left border-r border-slate-300 sticky left-0 z-10 font-sans ${
                              isHighlight ? 'bg-emerald-100/70 font-black text-emerald-950' : 
                              isMajor ? 'bg-slate-200/70 font-black text-slate-950' : 
                              isSubtotal ? 'bg-slate-100 font-bold text-slate-900' : 'bg-white text-slate-700'
                            }`}>
                              {row.name}
                            </td>

                            {/* 1〜12月度の数値 */}
                            {monthlyDataList.map(m => {
                              const val = (m as any)[row.id];
                              return (
                                <td key={m.month} className="p-2 border-r border-slate-200 text-right pr-2.5">
                                  {row.format(val)}
                                </td>
                              );
                            })}

                            {/* 年間合計列 */}
                            <td className={`p-2 text-right pr-3 font-bold ${
                              isHighlight ? 'bg-emerald-100/90 text-emerald-950 text-sm font-black' : 
                              isMajor ? 'bg-slate-200 text-slate-950' : 'bg-slate-100/70 text-slate-900'
                            }`}>
                              {row.format((annualTotal as any)[row.id])}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  // 行列入れ替え表示: 縦に月度（1月〜12月）、横に各項目（エクセル・集計台帳スタイル）
                  <table className="w-full border-collapse text-xs text-right select-text min-w-[1400px]">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                        <th className="p-2.5 text-center border-r border-slate-300 sticky left-0 bg-slate-100 z-10 w-24">
                          月度 / 期間
                        </th>
                        {tableRows.map(r => (
                          <th key={r.id} className="p-2 border-r border-slate-200 min-w-[90px] text-right font-sans">
                            {r.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-mono">
                      {monthlyDataList.map(m => (
                        <tr key={m.month} className="hover:bg-slate-50 transition">
                          <td className="p-2 text-center border-r border-slate-300 sticky left-0 bg-white z-10 font-bold">
                            <div className="font-black text-slate-900">{m.label}</div>
                            <div className="text-[9px] text-slate-400 font-normal">{m.period}</div>
                          </td>
                          {tableRows.map(r => (
                            <td key={r.id} className="p-2 border-r border-slate-200 text-right pr-2">
                              {r.format((m as any)[r.id])}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {/* 年間合計行 */}
                      <tr className="bg-slate-200/80 font-black border-t-2 border-slate-400">
                        <td className="p-2 text-center border-r border-slate-300 sticky left-0 bg-slate-200 z-10 text-slate-950">
                          年間合計
                        </td>
                        {tableRows.map(r => (
                          <td key={r.id} className="p-2 border-r border-slate-300 text-right pr-2">
                            {r.format((annualTotal as any)[r.id])}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                )}

              </div>

              {/* 🖨️ 印刷専用法定フッター注記（保存義務・発行元） */}
              <div className="mf-wage-ledger-footer hidden print:flex justify-between items-center text-[7.5pt] text-slate-500 pt-1.5 font-sans">
                <div>
                  ※ 労働基準法第109条に基づき、本台帳は最後の記入をした日から起算して5年間（当面の間3年間）適切に保存する義務があります。
                </div>
                <div className="font-mono">
                  発行事業所: {companyInfo?.name || '株式会社KAP'}（代表: {companyInfo?.representative_name || '駒井 秀一朗'}）
                </div>
              </div>
            </div>
          ) : (
            <div className="py-24 text-center text-slate-400 text-sm">
              左側の従業員一覧から確認したい社員を選択してください。
            </div>
          )}

        </main>
      </div>

    </div>
  );
};
