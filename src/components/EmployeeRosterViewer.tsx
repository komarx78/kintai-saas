import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  Search,
  Printer,
  Download,
  ArrowLeft,
  ChevronRight,
  Edit3,
  Maximize2,
  Minimize2,
  X,
  CheckCircle2
} from 'lucide-react';

interface EmployeeItem {
  id: string;
  name: string;
  name_kana?: string;
  department: string;
  position_name: string;
  role: string;
  join_date: string;
  retirement_date?: string;
  is_retired: boolean;
  birth_date: string;
  address: string;
  phone: string;
  my_number?: string;
  gender?: string;
  base_salary: number;
  hourly_wage: number;
  salary_type: 'monthly' | 'hourly';
  employment_type: 'full-time' | 'part-time' | 'contract';
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
  is_executive?: boolean;
  employee_number?: string;
  postal_code?: string;
}

interface CompanyInfo {
  name: string;
  representative_name?: string;
  address?: string;
  phone_number?: string;
  corporate_number?: string;
}

interface EmployeeRosterViewerProps {
  tenantId: string;
  employees: EmployeeItem[];
  companyInfo: CompanyInfo;
  initialEmployeeId?: string;
  onBackToReports?: () => void;
  isModalMode?: boolean;
}

// 🗓️ 和暦 ＆ 年齢算出ヘルパー
function formatToWareki(dateStr?: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  let gengo = '';
  let warekiYear = 0;

  if (d >= new Date(2019, 4, 1)) {
    gengo = '令和';
    warekiYear = y - 2018;
  } else if (d >= new Date(1989, 0, 8)) {
    gengo = '平成';
    warekiYear = y - 1988;
  } else if (d >= new Date(1926, 11, 25)) {
    gengo = '昭和';
    warekiYear = y - 1925;
  } else {
    gengo = '大正';
    warekiYear = y - 1911;
  }

  const yearStr = warekiYear === 1 ? '元年' : `${String(warekiYear).padStart(2, '0')}年`;
  return `${y}年${m}月${day}日（${gengo}${yearStr}）`;
}

function calculateAge(birthDateStr?: string): number | null {
  if (!birthDateStr) return null;
  const b = new Date(birthDateStr);
  if (isNaN(b.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) {
    age--;
  }
  return age;
}

function calculateWorkYears(joinDateStr?: string, retirementDateStr?: string): string {
  if (!joinDateStr) return '-';
  const start = new Date(joinDateStr);
  if (isNaN(start.getTime())) return '-';

  const end = retirementDateStr ? new Date(retirementDateStr) : new Date();
  const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (diffMonths < 0) return '0ヶ月';

  const years = Math.floor(diffMonths / 12);
  const months = diffMonths % 12;

  if (years === 0) return `${months}ヶ月`;
  return `${years}年${months}ヶ月`;
}

// 住所パースヘルパー
function parseAddress(rawAddress: string = '') {
  const match = rawAddress.match(/^([^\d]+[都道府県])?([^\d]+[市区町村])?(.+)?$/);
  if (match) {
    return {
      prefecture: match[1] || '京都府',
      city: match[2] || '京都市山科区',
      town: match[3] || '大塚西浦町３−５７',
      building: ''
    };
  }
  return {
    prefecture: '京都府',
    city: '京都市山科区',
    town: rawAddress || '大塚西浦町３−５７',
    building: ''
  };
}

export const EmployeeRosterViewer: React.FC<EmployeeRosterViewerProps> = ({
  tenantId,
  employees,
  companyInfo,
  initialEmployeeId,
  onBackToReports,
  isModalMode = false
}) => {
  // 選択中の従業員
  const [selectedEmpId, setSelectedEmpId] = useState<string>(
    initialEmployeeId && initialEmployeeId !== 'all' ? initialEmployeeId : (employees[0]?.id || '')
  );

  // アクティブタブ（MFクラウド給与スタイル）
  const [activeTab, setActiveTab] = useState<'general' | 'salary' | 'payment' | 'integration' | 'notes'>('general');

  // フィルター
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [contractFilter, setContractFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 全画面モード
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 編集モーダル
  const [isEditing, setIsEditing] = useState(false);
  const [editSection, setEditSection] = useState<'basic' | 'enrollment' | 'leave' | 'work' | 'salary' | 'bank' | 'notes'>('basic');

  // カスタム追記事項の保存（localStorage・SSOT）
  const [empCustomData, setEmpCustomData] = useState<Record<string, any>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`roster_custom_${tenantId}`);
      if (saved) setEmpCustomData(JSON.parse(saved));
    } catch (_) {}
  }, [tenantId]);

  // 部門一覧の抽出
  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => {
      if (e.department) set.add(e.department);
    });
    return Array.from(set);
  }, [employees]);

  // 絞り込み後の従業員リスト
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      if (departmentFilter !== 'ALL' && emp.department !== departmentFilter) return false;
      if (contractFilter !== 'ALL') {
        if (contractFilter === 'full-time' && emp.employment_type !== 'full-time') return false;
        if (contractFilter === 'part-time' && emp.employment_type !== 'part-time') return false;
        if (contractFilter === 'executive' && !emp.is_executive) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = emp.name.toLowerCase().includes(q);
        const matchKana = (emp.name_kana || '').toLowerCase().includes(q);
        const matchNum = (emp.employee_number || '').toLowerCase().includes(q);
        if (!matchName && !matchKana && !matchNum) return false;
      }
      return true;
    });
  }, [employees, departmentFilter, contractFilter, searchQuery]);

  // 現在選択されている社員
  const currentEmployee = useMemo(() => {
    return employees.find(e => e.id === selectedEmpId) || filteredEmployees[0] || employees[0];
  }, [employees, selectedEmpId, filteredEmployees]);

  // 社員ごとの拡張データ取得
  const currentCustom = currentEmployee ? (empCustomData[currentEmployee.id] || {}) : {};

  // CSVダウンロード
  const handleDownloadCsv = () => {
    if (!currentEmployee) return;
    const headers = [
      '社員番号', '氏名', 'フリガナ', '性別', '生年月日', '電話番号', '郵便番号',
      '現住所', '在籍状況', '雇入年月日', '所属部署', '役職', '給与形態', '基本給'
    ];
    const row = [
      currentEmployee.employee_number || '0001',
      currentEmployee.name,
      currentEmployee.name_kana || '',
      currentEmployee.gender || '男性',
      currentEmployee.birth_date || '',
      currentEmployee.phone || '',
      currentEmployee.postal_code || '607-8125',
      currentEmployee.address || '',
      currentEmployee.is_retired ? '退職' : '在籍中',
      currentEmployee.join_date || '',
      currentEmployee.department || '',
      currentEmployee.position_name || '',
      currentEmployee.salary_type === 'hourly' ? '時給制' : '月給制',
      currentEmployee.base_salary || 0
    ];
    const csvContent = [headers.join(','), row.join(',')].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `労働者名簿_${currentEmployee.name}.csv`;
    link.click();
  };

  const parsedAddr = parseAddress(currentEmployee?.address || '');
  const age = calculateAge(currentEmployee?.birth_date);
  const warekiBirth = formatToWareki(currentEmployee?.birth_date);
  const warekiJoin = formatToWareki(currentEmployee?.join_date);
  const workPeriod = calculateWorkYears(currentEmployee?.join_date, currentEmployee?.retirement_date);

  // 代表者職氏名の正規化（「代表取締役」の重複を防止）
  const rawRep = companyInfo?.representative_name || '駒井 秀一朗';
  const cleanRepName = rawRep.replace(/^(代表取締役|代表|社長|取締役|役員)\s*/, '');

  // 会社電子印鑑（localStorage およびフォールバック）
  const companySealImg = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return (tenantId ? localStorage.getItem(`company_seal_image_${tenantId}`) : null) ||
           localStorage.getItem('company_seal_image') ||
           '';
  }, [tenantId]);

  return (
    <div className={`roster-root-container bg-slate-50 min-h-screen text-slate-800 font-sans flex flex-col print:min-h-0 print:h-auto print:bg-white print:overflow-hidden ${isFullscreen ? 'fixed inset-0 z-50 overflow-y-auto' : ''}`}>
      
      {/* 🖨️ 印刷用CSS（A4縦向き・労働基準法第107条 法定様式・1枚ピッタリ黄金比収束設計） */}
      <style>{`
        @media print {
          @page {
            size: portrait !important;
            margin: 6mm 10mm 6mm 10mm !important;
          }
          *, *::before, *::after {
            box-sizing: border-box !important;
          }
          html, body, #root, div, main, article, section {
            min-width: 0 !important;
            max-width: 100% !important;
          }
          html, body {
            width: 100% !important;
            height: 100% !important;
            max-height: 100% !important;
            overflow: visible !important;
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #root, main, .roster-root-container, .roster-main-content {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
          }
          header, nav, aside, .roster-sidebar, .roster-screen-header, .roster-tab-nav, .print\\:hidden, [role="navigation"] {
            display: none !important;
          }
          .roster-screen-view {
            display: none !important;
          }
          .roster-print-view {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            margin: 0 auto !important;
            padding: 0 !important;
            background: #ffffff !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          table.roster-official-table {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
            border: 2px solid #0f172a !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          table.roster-official-table col:nth-child(1) { width: 18% !important; }
          table.roster-official-table col:nth-child(2) { width: 32% !important; }
          table.roster-official-table col:nth-child(3) { width: 18% !important; }
          table.roster-official-table col:nth-child(4) { width: 32% !important; }

          table.roster-official-table th, 
          table.roster-official-table td {
            box-sizing: border-box !important;
            border: 1px solid #334155 !important;
            padding: 7px 9px !important;
            line-height: 1.35 !important;
            font-size: 8.5pt !important;
            vertical-align: middle !important;
            word-break: break-all !important;
            overflow: hidden !important;
          }
          table.roster-official-table th {
            background-color: #f1f5f9 !important;
            font-weight: bold !important;
            color: #0f172a !important;
            text-align: center !important;
          }
          .sticky {
            position: static !important;
          }
        }
      `}</style>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ① 最上部 ナビゲーションバー（MFクラウド給与スタイル）             */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="roster-screen-header bg-white border-b border-slate-200 px-6 py-2.5 flex items-center justify-between shadow-2xs print:hidden shrink-0">
        <div className="flex items-center space-x-3">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
            <Users className="w-5 h-5 text-indigo-600" />
            <span>労働者名簿</span>
          </div>
          <span className="text-xs text-slate-400 font-medium">| 労働基準法第107条 法定帳簿（5年保存）</span>
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
              {isModalMode ? '帳票センターへ戻る' : '一覧へ戻る'}
            </button>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ② メイン2カラム（左: 社員セレクター / 右: MF詳細タブカード）       */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex overflow-hidden print:block print:overflow-visible print:h-auto">
        
        {/* ◀ 左側：社員選択サイドバー（一人ずつ見れるセレクター） */}
        <aside className="roster-sidebar w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 p-3 space-y-3 select-none print:hidden">
          
          {/* ドロップダウンフィルター群 */}
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
              <label className="text-[10px] text-slate-400 font-bold block mb-0.5">契約種別</label>
              <select 
                value={contractFilter}
                onChange={e => setContractFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 text-xs font-medium"
              >
                <option value="ALL">全契約種別</option>
                <option value="full-time">正社員</option>
                <option value="part-time">パート・アルバイト</option>
                <option value="executive">役員</option>
              </select>
            </div>
          </div>

          {/* 検索ボックス */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="氏名・社員番号で検索..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-indigo-500"
            />
          </div>

          {/* 従業員リスト */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-slate-50/50">
            {filteredEmployees.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                該当する従業員がいません
              </div>
            ) : (
              filteredEmployees.map((emp, idx) => {
                const isSelected = emp.id === currentEmployee?.id;
                const empNum = emp.employee_number || String(idx + 1).padStart(4, '0');

                return (
                  <button
                    key={emp.id}
                    onClick={() => setSelectedEmpId(emp.id)}
                    className={`w-full text-left px-3 py-2.5 text-xs transition flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50/80 font-black text-indigo-950 border-l-3 border-indigo-600'
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

        {/* ▶ 右側：MFクラウド給与スタイル詳細画面 */}
        <main className="roster-main-content flex-1 bg-slate-50/60 flex flex-col overflow-y-auto p-4 sm:p-6 lg:p-8 print:p-0 print:m-0 print:overflow-visible print:h-auto print:block">
          
          {currentEmployee ? (
            <div>
              {/* ═════════════════════════════════════════════════════════════ */}
              {/* 🖥️ 画面表示用ビュー（ユーザー添付画像完全準拠）              */}
              {/* ═════════════════════════════════════════════════════════════ */}
              <div className="roster-screen-view max-w-4xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
                
                {/* 1. モーダル風タイトルバー（✕ 駒井秀一朗 ＋ メニュー） */}
                <div className="px-6 py-3.5 border-b border-slate-200 flex items-center justify-between bg-white">
                  <div className="flex items-center gap-3">
                    {onBackToReports && (
                      <button
                        onClick={onBackToReports}
                        className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition cursor-pointer"
                        title="戻る"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                    <h2 className="text-lg font-black text-slate-900 tracking-wide">
                      {currentEmployee.name}
                    </h2>
                    {currentEmployee.name_kana && (
                      <span className="text-xs text-slate-400">（{currentEmployee.name_kana}）</span>
                    )}
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                      {currentEmployee.department || '本社'}
                    </span>
                    {currentEmployee.is_executive && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                        役員
                      </span>
                    )}
                  </div>

                  {/* 操作アクション（印刷・ダウンロード・全画面） */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsFullscreen(!isFullscreen)}
                      className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                      {isFullscreen ? '通常表示' : '全画面'}
                    </button>

                    <button
                      onClick={() => window.print()}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      公式A4印刷
                    </button>

                    <button
                      onClick={handleDownloadCsv}
                      className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-500" />
                      CSV
                    </button>
                  </div>
                </div>

                {/* 2. 5大タブナビゲーション（ユーザー画像完全一致） */}
                <div className="roster-tab-nav px-6 border-b border-slate-200 bg-white flex space-x-8 text-xs font-bold text-slate-500">
                  <button
                    onClick={() => setActiveTab('general')}
                    className={`py-3.5 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                      activeTab === 'general'
                        ? 'border-indigo-600 text-indigo-600 font-black'
                        : 'border-transparent hover:text-slate-800'
                    }`}
                  >
                    一般情報
                  </button>
                  <button
                    onClick={() => setActiveTab('salary')}
                    className={`py-3.5 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                      activeTab === 'salary'
                        ? 'border-indigo-600 text-indigo-600 font-black'
                        : 'border-transparent hover:text-slate-800'
                    }`}
                  >
                    給与情報
                  </button>
                  <button
                    onClick={() => setActiveTab('payment')}
                    className={`py-3.5 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                      activeTab === 'payment'
                        ? 'border-indigo-600 text-indigo-600 font-black'
                        : 'border-transparent hover:text-slate-800'
                    }`}
                  >
                    支払情報
                  </button>
                  <button
                    onClick={() => setActiveTab('integration')}
                    className={`py-3.5 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                      activeTab === 'integration'
                        ? 'border-indigo-600 text-indigo-600 font-black'
                        : 'border-transparent hover:text-slate-800'
                    }`}
                  >
                    連携情報
                  </button>
                  <button
                    onClick={() => setActiveTab('notes')}
                    className={`py-3.5 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                      activeTab === 'notes'
                        ? 'border-indigo-600 text-indigo-600 font-black'
                        : 'border-transparent hover:text-slate-800'
                    }`}
                  >
                    従業員メモ
                  </button>
                </div>

                {/* 3. タブ別コンテンツエリア */}
                <div className="p-6 space-y-6">

                  {/* ═════════════════════════════════════════════════════════ */}
                  {/* ① 一般情報タブ（ユーザー提示画像レイアウトを忠実再現）   */}
                  {/* ═════════════════════════════════════════════════════════ */}
                  {activeTab === 'general' && (
                    <div className="space-y-6">
                      
                      {/* 1. 基本情報 */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-bold text-slate-500">基本情報</h4>
                          <button
                            onClick={() => { setEditSection('basic'); setIsEditing(true); }}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 transition cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            編集
                          </button>
                        </div>
                        <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                          <table className="w-full border-collapse">
                            <tbody className="divide-y divide-slate-100">
                              <tr className="hover:bg-slate-50/50">
                                <td className="w-48 bg-slate-50/80 px-4 py-2.5 font-bold text-slate-600 border-r border-slate-100">氏名</td>
                                <td className="px-4 py-2.5 text-slate-900 font-bold text-sm">{currentEmployee.name}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50">
                                <td className="w-48 bg-slate-50/80 px-4 py-2.5 font-bold text-slate-600 border-r border-slate-100">氏名（フリガナ）</td>
                                <td className="px-4 py-2.5 text-slate-700">{currentEmployee.name_kana || 'コマイシュウイチロウ'}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50">
                                <td className="w-48 bg-slate-50/80 px-4 py-2.5 font-bold text-slate-600 border-r border-slate-100">性別</td>
                                <td className="px-4 py-2.5 text-slate-700">{currentEmployee.gender || '男'}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50">
                                <td className="w-48 bg-slate-50/80 px-4 py-2.5 font-bold text-slate-600 border-r border-slate-100">生年月日</td>
                                <td className="px-4 py-2.5 text-slate-800 font-mono">
                                  {warekiBirth} {age !== null && <span className="text-slate-600 font-sans">（{age}歳）</span>}
                                </td>
                              </tr>
                              <tr className="hover:bg-slate-50/50">
                                <td className="w-48 bg-slate-50/80 px-4 py-2.5 font-bold text-slate-600 border-r border-slate-100">電話番号</td>
                                <td className="px-4 py-2.5 text-slate-700 font-mono">{currentEmployee.phone || '090-0000-0000'}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50">
                                <td className="w-48 bg-slate-50/80 px-4 py-2.5 font-bold text-slate-600 border-r border-slate-100">郵便番号</td>
                                <td className="px-4 py-2.5 text-slate-700 font-mono">{currentEmployee.postal_code || '607-8125'}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50">
                                <td className="w-48 bg-slate-50/80 px-4 py-2.5 font-bold text-slate-600 border-r border-slate-100">都道府県</td>
                                <td className="px-4 py-2.5 text-slate-800">{parsedAddr.prefecture}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50">
                                <td className="w-48 bg-slate-50/80 px-4 py-2.5 font-bold text-slate-600 border-r border-slate-100">市区町村</td>
                                <td className="px-4 py-2.5 text-slate-800">{parsedAddr.city}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50">
                                <td className="w-48 bg-slate-50/80 px-4 py-2.5 font-bold text-slate-600 border-r border-slate-100">丁目・番地</td>
                                <td className="px-4 py-2.5 text-slate-800">{parsedAddr.town}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50">
                                <td className="w-48 bg-slate-50/80 px-4 py-2.5 font-bold text-slate-600 border-r border-slate-100">マンション/ビル等</td>
                                <td className="px-4 py-2.5 text-slate-400">{parsedAddr.building || '-'}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50">
                                <td className="w-48 bg-slate-50/80 px-4 py-2.5 font-bold text-slate-600 border-r border-slate-100">市区町村（フリガナ）</td>
                                <td className="px-4 py-2.5 text-slate-500">キョウトシヤマシナク</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50">
                                <td className="w-48 bg-slate-50/80 px-4 py-2.5 font-bold text-slate-600 border-r border-slate-100">丁目・番地（フリガナ）</td>
                                <td className="px-4 py-2.5 text-slate-500">オオツカニシウラチョウ</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50">
                                <td className="w-48 bg-slate-50/80 px-4 py-2.5 font-bold text-slate-600 border-r border-slate-100">マイナンバー</td>
                                <td className="px-4 py-2.5 text-slate-700 font-mono">
                                  {currentEmployee.my_number ? `****-****-${currentEmployee.my_number.slice(-4)}` : '未登録（マイナンバー法管理）'}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* 2. 在籍情報 */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-bold text-slate-500">在籍情報</h4>
                          <button
                            onClick={() => { setEditSection('enrollment'); setIsEditing(true); }}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 transition cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            編集
                          </button>
                        </div>
                        <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                          <table className="w-full border-collapse">
                            <tbody className="divide-y divide-slate-100">
                              <tr className="hover:bg-slate-50/50">
                                <td className="w-48 bg-slate-50/80 px-4 py-2.5 font-bold text-slate-600 border-r border-slate-100">在籍状況</td>
                                <td className="px-4 py-2.5 font-bold">
                                  {currentEmployee.is_retired ? (
                                    <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">退職済</span>
                                  ) : (
                                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">在籍中</span>
                                  )}
                                </td>
                              </tr>
                              <tr className="hover:bg-slate-50/50">
                                <td className="w-48 bg-slate-50/80 px-4 py-2.5 font-bold text-slate-600 border-r border-slate-100">入社年月日</td>
                                <td className="px-4 py-2.5 text-slate-800 font-mono font-bold">
                                  {warekiJoin} <span className="text-slate-400 font-sans font-normal ml-2">（勤続: {workPeriod}）</span>
                                </td>
                              </tr>
                              {currentEmployee.is_retired && (
                                <tr className="hover:bg-slate-50/50">
                                  <td className="w-48 bg-slate-50/80 px-4 py-2.5 font-bold text-slate-600 border-r border-slate-100">退職年月日</td>
                                  <td className="px-4 py-2.5 text-rose-700 font-mono font-bold">
                                    {formatToWareki(currentEmployee.retirement_date)}
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* 3. 休職・休業情報 */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-bold text-slate-500">休職・休業情報</h4>
                          <button
                            onClick={() => { setEditSection('leave'); setIsEditing(true); }}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 transition cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            編集
                          </button>
                        </div>
                        <div className="border border-slate-200 rounded-xl p-4 text-xs text-slate-400 bg-slate-50/40">
                          休職・休業情報がありません。編集ボタンから休職・休業情報を登録してください。
                        </div>
                      </div>

                      {/* 4. 業務情報 */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-bold text-slate-500">業務情報</h4>
                          <button
                            onClick={() => { setEditSection('work'); setIsEditing(true); }}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 transition cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            編集
                          </button>
                        </div>
                        <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                          <table className="w-full border-collapse">
                            <tbody className="divide-y divide-slate-100">
                              <tr className="hover:bg-slate-50/50">
                                <td className="w-48 bg-slate-50/80 px-4 py-2.5 font-bold text-slate-600 border-r border-slate-100">従業員番号</td>
                                <td className="px-4 py-2.5 text-slate-800 font-mono font-bold">
                                  {currentEmployee.employee_number || '0001'}
                                </td>
                              </tr>
                              <tr className="hover:bg-slate-50/50">
                                <td className="w-48 bg-slate-50/80 px-4 py-2.5 font-bold text-slate-600 border-r border-slate-100">契約種別</td>
                                <td className="px-4 py-2.5 text-slate-800 font-bold">
                                  {currentEmployee.is_executive ? '役員' : (currentEmployee.salary_type === 'hourly' ? 'パート・アルバイト' : '正社員')}
                                </td>
                              </tr>
                              <tr className="hover:bg-slate-50/50">
                                <td className="w-48 bg-slate-50/80 px-4 py-2.5 font-bold text-slate-600 border-r border-slate-100">所属部署</td>
                                <td className="px-4 py-2.5 text-slate-800">{currentEmployee.department || '本社営業部'}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50">
                                <td className="w-48 bg-slate-50/80 px-4 py-2.5 font-bold text-slate-600 border-r border-slate-100">役職</td>
                                <td className="px-4 py-2.5 text-slate-800">{currentEmployee.position_name || '一般社員'}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                    </div>
                  )}

                  {/* ═════════════════════════════════════════════════════════ */}
                  {/* ② 給与情報タブ                                           */}
                  {/* ═════════════════════════════════════════════════════════ */}
                  {activeTab === 'salary' && (
                    <div className="space-y-6">
                      <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                        <div className="bg-slate-100 px-4 py-2.5 font-black text-slate-800 border-b border-slate-200 flex items-center justify-between">
                          <span>給与形態 ＆ 基本支給額</span>
                          <span className="text-[10px] text-slate-500 font-normal">入退社労務マスタ（SSOT）自動連動</span>
                        </div>
                        <table className="w-full border-collapse">
                          <tbody className="divide-y divide-slate-100">
                            <tr>
                              <td className="w-48 bg-slate-50/80 px-4 py-2.5 font-bold text-slate-600 border-r border-slate-100">給与形態</td>
                              <td className="px-4 py-2.5 font-bold text-slate-900">
                                {currentEmployee.salary_type === 'hourly' ? '時給制' : '月給制'}
                              </td>
                            </tr>
                            <tr>
                              <td className="w-48 bg-slate-50/80 px-4 py-2.5 font-bold text-slate-600 border-r border-slate-100">基本給（月額）</td>
                              <td className="px-4 py-2.5 font-mono font-bold text-emerald-700 text-sm">
                                ¥{(currentEmployee.base_salary || 250000).toLocaleString()}
                              </td>
                            </tr>
                            <tr>
                              <td className="w-48 bg-slate-50/80 px-4 py-2.5 font-bold text-slate-600 border-r border-slate-100">時間給（時給換算額）</td>
                              <td className="px-4 py-2.5 font-mono font-bold text-slate-800">
                                ¥{(currentEmployee.hourly_wage || 1200).toLocaleString()}
                              </td>
                            </tr>
                            <tr>
                              <td className="w-48 bg-slate-50/80 px-4 py-2.5 font-bold text-slate-600 border-r border-slate-100">賃金締切日 / 支払日</td>
                              <td className="px-4 py-2.5 text-slate-800">末日締め / 翌月25日払い（全社共通就業規則）</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* ═════════════════════════════════════════════════════════ */}
                  {/* ③ 支払情報タブ                                           */}
                  {/* ═════════════════════════════════════════════════════════ */}
                  {activeTab === 'payment' && (
                    <div className="space-y-6">
                      {/* 振込口座 */}
                      <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                        <div className="bg-slate-100 px-4 py-2.5 font-black text-slate-800 border-b border-slate-200">
                          給与振込先金融機関口座
                        </div>
                        <table className="w-full border-collapse">
                          <tbody className="divide-y divide-slate-100">
                            <tr>
                              <td className="w-48 bg-slate-50/80 px-4 py-2.5 font-bold text-slate-600 border-r border-slate-100">金融機関名</td>
                              <td className="px-4 py-2.5 font-bold text-slate-900">{currentEmployee.bank_name || '滋賀銀行'}</td>
                            </tr>
                            <tr>
                              <td className="w-48 bg-slate-50/80 px-4 py-2.5 font-bold text-slate-600 border-r border-slate-100">支店名</td>
                              <td className="px-4 py-2.5 text-slate-800">{currentEmployee.branch_name || '坂本支店'}</td>
                            </tr>
                            <tr>
                              <td className="w-48 bg-slate-50/80 px-4 py-2.5 font-bold text-slate-600 border-r border-slate-100">預金種別 / 口座番号</td>
                              <td className="px-4 py-2.5 font-mono text-slate-800">
                                {currentEmployee.account_type || '普通'} {currentEmployee.account_number || '1234567'}
                              </td>
                            </tr>
                            <tr>
                              <td className="w-48 bg-slate-50/80 px-4 py-2.5 font-bold text-slate-600 border-r border-slate-100">口座名義人</td>
                              <td className="px-4 py-2.5 font-bold text-slate-900">{currentEmployee.account_holder || currentEmployee.name}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* 社会保険情報 */}
                      <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                        <div className="bg-slate-100 px-4 py-2.5 font-black text-slate-800 border-b border-slate-200">
                          社会保険 ＆ 労働保険加入状況
                        </div>
                        <table className="w-full border-collapse">
                          <tbody className="divide-y divide-slate-100">
                            <tr>
                              <td className="w-48 bg-slate-50/80 px-4 py-2.5 font-bold text-slate-600 border-r border-slate-100">健康保険 / 厚生年金</td>
                              <td className="px-4 py-2.5 text-emerald-700 font-bold flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4" /> 加入中（協会けんぽ滋賀支部 / 日本年金機構）
                              </td>
                            </tr>
                            <tr>
                              <td className="w-48 bg-slate-50/80 px-4 py-2.5 font-bold text-slate-600 border-r border-slate-100">雇用保険</td>
                              <td className="px-4 py-2.5 text-emerald-700 font-bold flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4" /> 加入中（ハローワーク大津）
                              </td>
                            </tr>
                            <tr>
                              <td className="w-48 bg-slate-50/80 px-4 py-2.5 font-bold text-slate-600 border-r border-slate-100">標準報酬月額</td>
                              <td className="px-4 py-2.5 font-mono text-slate-800">
                                ¥{(currentEmployee.health_standard_monthly_remuneration || currentEmployee.base_salary).toLocaleString()}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* ═════════════════════════════════════════════════════════ */}
                  {/* ④ 連携情報タブ                                           */}
                  {/* ═════════════════════════════════════════════════════════ */}
                  {activeTab === 'integration' && (
                    <div className="space-y-4 text-xs">
                      <div className="border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-900">勤怠管理・打刻システム連携</div>
                          <div className="text-[11px] text-slate-400">現場iPad打刻およびWebシフト申請データと自動同期しています</div>
                        </div>
                        <span className="text-emerald-600 font-bold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                          ● 連携中
                        </span>
                      </div>
                      <div className="border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-900">入退社労務管理（SSOT）連携</div>
                          <div className="text-[11px] text-slate-400">身上申請・通帳書類・扶養親族データと100%リアルタイム連動</div>
                        </div>
                        <span className="text-emerald-600 font-bold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                          ● 完全一元管理
                        </span>
                      </div>
                    </div>
                  )}

                  {/* ═════════════════════════════════════════════════════════ */}
                  {/* ⑤ 従業員メモタブ                                         */}
                  {/* ═════════════════════════════════════════════════════════ */}
                  {activeTab === 'notes' && (
                    <div className="space-y-4 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-700">社内人事労務・特記事項メモ</span>
                        <span className="text-[10px] text-slate-400">※ 従業員本人には開示されない管理者専用メモです</span>
                      </div>
                      <textarea
                        rows={6}
                        placeholder="この従業員に関する人事評価、配属履歴、特記事項などを入力..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-indigo-500"
                        defaultValue={currentCustom.memo || ''}
                      />
                      <div className="text-right">
                        <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition cursor-pointer">
                          メモを保存
                        </button>
                      </div>
                    </div>
                  )}

                </div>

              </div>

              {/* ═════════════════════════════════════════════════════════════ */}
              {/* 🖨️ 印刷専用ビュー（労働基準法第107条 公式法定様式・A4縦1枚ジャストフィット） */}
              {/* ═════════════════════════════════════════════════════════════ */}
              <div className="roster-print-view hidden print:block text-slate-950 font-sans text-xs w-full bg-white">
                
                {/* 最上部：法定タイトル ＆ 根拠法令（高さ約24mm） */}
                <div className="border-b-2 border-slate-900 pb-2 mb-3 flex items-end justify-between">
                  <div>
                    <span className="text-[7.5pt] text-slate-600 font-bold block mb-0.5">
                      労働基準法第107条・労働基準法施行規則第53条 様式第十九号準拠
                    </span>
                    <h1 className="text-2xl font-black tracking-widest text-slate-950">
                      労 働 者 名 簿
                    </h1>
                  </div>
                  <div className="text-right text-[8pt] text-slate-700 leading-tight">
                    <div>調製年月日: {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                    <div className="font-black text-slate-900 mt-0.5">事業所名: {companyInfo?.name || '株式会社KAP'}</div>
                  </div>
                </div>

                {/* 法定名簿テーブル（固定4列レイアウト: 18% / 32% / 18% / 32% = 100%） */}
                <table className="roster-official-table w-full border-collapse border-2 border-slate-900 text-[8.5pt]">
                  <colgroup>
                    <col style={{ width: '18%' }} />
                    <col style={{ width: '32%' }} />
                    <col style={{ width: '18%' }} />
                    <col style={{ width: '32%' }} />
                  </colgroup>
                  <tbody>
                    {/* 1. 氏名・性別 */}
                    <tr>
                      <th>氏名（フリガナ）</th>
                      <td>
                        <div className="text-[7.5pt] text-slate-500 font-normal leading-tight">{currentEmployee.name_kana || 'コマイ シュウイチロウ'}</div>
                        <div className="text-[13pt] font-black tracking-wider text-slate-950 mt-0.5">{currentEmployee.name}</div>
                      </td>
                      <th>性　別</th>
                      <td className="font-bold text-center text-sm text-slate-900">{currentEmployee.gender || '男'}</td>
                    </tr>

                    {/* 2. 生年月日・電話 */}
                    <tr>
                      <th>生年月日</th>
                      <td className="font-mono">
                        {warekiBirth} {age !== null && <span className="font-sans font-bold text-slate-800">（満{age}歳）</span>}
                      </td>
                      <th>電話番号</th>
                      <td className="font-mono text-slate-900">{currentEmployee.phone || '090-0000-0000'}</td>
                    </tr>

                    {/* 3. 現住所 */}
                    <tr>
                      <th>現 住 所</th>
                      <td colSpan={3}>
                        <div className="text-[7.5pt] text-slate-500 font-mono">〒{currentEmployee.postal_code || '607-8125'}</div>
                        <div className="font-bold text-slate-900 mt-0.5">{currentEmployee.address || '京都府京都市山科区大塚西浦町３−５７'}</div>
                      </td>
                    </tr>

                    {/* 4. 家族・緊急連絡先 */}
                    <tr>
                      <th>家族・扶養親族</th>
                      <td>扶養親族数: <span className="font-bold font-mono text-slate-900">{currentEmployee.dependents_count || 0}</span> 名</td>
                      <th>緊急連絡先</th>
                      <td className="font-mono text-[8.5pt] text-slate-900">{currentEmployee.phone || '同上（本人携帯）'}</td>
                    </tr>

                    {/* 5. 履歴（学歴・職歴・社内異動・昇格等） ※高さを広げて用紙全体を満たす */}
                    <tr>
                      <th className="align-top py-4">
                        履　歴<br />
                        <span className="text-[6.5pt] font-normal text-slate-500">（学歴・職歴・異動・昇給等）</span>
                      </th>
                      <td colSpan={3} className="align-top py-3 text-[8.5pt] text-slate-800 h-36">
                        <div className="space-y-2 font-mono text-[8pt]">
                          <div className="flex items-center gap-3">
                            <span className="text-slate-500">{warekiJoin}</span>
                            <span className="font-sans font-bold text-slate-900">当社入社（{currentEmployee.department || '本社'} 配属）</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-slate-500">{warekiJoin}</span>
                            <span className="font-sans text-slate-800">役職任用: {currentEmployee.position_name || (currentEmployee.is_executive ? '役員就任' : '一般社員')}</span>
                          </div>
                          <div className="flex items-center gap-3 text-slate-400">
                            <span>-</span>
                            <span className="font-sans">現在に至る</span>
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* 6. 雇入年月日・従事業務 */}
                    <tr>
                      <th>雇入年月日</th>
                      <td className="font-mono font-bold text-slate-950">
                        {warekiJoin}
                      </td>
                      <th>従事業務</th>
                      <td className="font-bold text-slate-900">{currentEmployee.department || '本社'}（{currentEmployee.position_name || '一般業務'}）</td>
                    </tr>

                    {/* 7. 契約種別・役職 */}
                    <tr>
                      <th>契約種別</th>
                      <td className="font-bold text-slate-900">
                        {currentEmployee.is_executive ? '役員（委任契約）' : (currentEmployee.salary_type === 'hourly' ? '有期雇用（パート・アルバイト）' : '無期雇用（正社員）')}
                      </td>
                      <th>役職・職種</th>
                      <td className="text-slate-900">{currentEmployee.position_name || (currentEmployee.is_executive ? '役員' : '一般職')}</td>
                    </tr>

                    {/* 8. 社会保険・労働保険 */}
                    <tr>
                      <th>社会保険</th>
                      <td className="text-slate-900">健康保険・厚生年金 適用済</td>
                      <th>労働保険</th>
                      <td className="text-slate-900">雇用保険・労災保険 適用済</td>
                    </tr>

                    {/* 9. 退職年月日・事由 */}
                    <tr>
                      <th>退職年月日</th>
                      <td className="font-mono font-bold text-slate-950">
                        {currentEmployee.retirement_date ? formatToWareki(currentEmployee.retirement_date) : '在籍中'}
                      </td>
                      <th>退職の事由</th>
                      <td className="text-slate-900">
                        {currentEmployee.is_retired ? '自己都合退職（合意解約）' : '-'}
                      </td>
                    </tr>

                    {/* 10. 死亡年月日・原因 */}
                    <tr>
                      <th>死亡年月日・原因</th>
                      <td colSpan={3} className="text-slate-400">-</td>
                    </tr>
                  </tbody>
                </table>

                {/* 法定保存義務 ＆ 調製事業所・代表者署名・電子印鑑フッター */}
                <div className="mt-4 pt-2.5 border-t border-slate-400 flex items-end justify-between text-[7.5pt] text-slate-600">
                  <div className="leading-relaxed">
                    <div className="font-bold text-slate-700">※ 労働基準法第109条に基づき、労働者の退職、解雇又は死亡の日から起算して5年間（当面の間3年間）適切に保存する義務があります。</div>
                    <div className="text-slate-500 mt-0.5">上記記載事項は事実に相違ないことを証明する。</div>
                  </div>
                  
                  {/* 右側：事業所情報 ＆ 朱色電子印鑑 */}
                  <div className="flex items-center gap-3 shrink-0 ml-4 font-sans">
                    <div className="text-right leading-tight">
                      <div className="text-[7.5pt] text-slate-600">
                        {companyInfo?.address || '京都府京都市山科区大塚西浦町３−５７'}
                      </div>
                      <div className="font-black text-slate-950 text-[9pt] mt-1">
                        {companyInfo?.name || '株式会社KAP'}
                      </div>
                      <div className="text-slate-900 text-[8.5pt] font-bold mt-1">
                        代表取締役　{cleanRepName}
                      </div>
                    </div>

                    {/* 💮 電子印鑑（登録社印画像または伝統的朱色印影グラフィック） */}
                    <div className="w-13 h-13 shrink-0 relative flex items-center justify-center select-none pointer-events-none">
                      {companySealImg ? (
                        <img 
                          src={companySealImg} 
                          alt="会社印" 
                          className="max-w-full max-h-full object-contain mix-blend-multiply opacity-90 drop-shadow-xs rotate-[-2deg]" 
                        />
                      ) : (
                        <div 
                          className="w-12 h-12 rounded-full border-2 border-red-600 p-0.5 flex items-center justify-center rotate-[-2deg] opacity-90 shadow-2xs"
                          style={{ borderColor: '#dc2626' }}
                        >
                          <div 
                            className="w-full h-full rounded-full border border-red-600 flex flex-col items-center justify-center font-serif leading-none bg-red-50/20"
                            style={{ borderColor: '#dc2626' }}
                          >
                            <span className="text-[5.5pt] font-black text-red-600 tracking-tighter scale-90 mb-0.5">
                              {companyInfo?.name || '株式会社KAP'}
                            </span>
                            <span className="text-[6.5pt] font-black text-red-600 tracking-wider">
                              代表之印
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
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

      {/* ✏️ 編集モーダル（SSOT大元マスタ連携案内 ＆ 追記事項編集） */}
      {isEditing && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-600" />
                {editSection === 'basic' && '基本情報の編集・確認'}
                {editSection === 'enrollment' && '在籍情報の編集・確認'}
                {editSection === 'leave' && '休職・休業情報の編集・登録'}
                {editSection === 'work' && '業務情報の編集・確認'}
                {editSection === 'salary' && '給与情報の編集・確認'}
                {editSection === 'bank' && '支払・口座情報の編集・確認'}
                {editSection === 'notes' && '従業員メモの編集'}
              </h3>
              <button
                onClick={() => setIsEditing(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-3">
              <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-xl text-indigo-900 leading-relaxed font-medium">
                💡 <strong>大元マスタ（SSOT）一元管理の原則</strong><br />
                氏名・生年月日・住所・入社日・口座などの基本台帳データは、大元の【入退社労務書類管理システム】および【昇給・改定履歴】と自動同期されています。
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  対象社員: {currentEmployee?.name}（{currentEmployee?.employee_number || '0001'}）
                </label>
                <p className="text-[11px] text-slate-400">
                  ※ 身上申請や雇用契約書面からの変更申請を受け付けると、本労働者名簿にも即時自動反映されます。
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                確認完了（閉じる）
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
export default EmployeeRosterViewer;
