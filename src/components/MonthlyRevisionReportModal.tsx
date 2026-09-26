import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Printer, Sparkles, 
  CheckCircle2, Users, FileText, 
  Building2, RefreshCw 
} from 'lucide-react';
import { 
  OfficialMonthlyRevisionDoc, 
  type MonthlyRevisionEmployeeDocData
} from './OfficialMonthlyRevisionDoc';
import { 
  detectMonthlyRevisionCandidates, 
  type MonthlyRevisionCandidate 
} from '../lib/monthlyRevisionEngine';
import type { EmployeePayrollProfile } from '../lib/payrollEngine';

export interface MonthlyRevisionReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  tenantInfo: any;
  employees: any[];
  payrollProfiles?: Record<string, EmployeePayrollProfile>;
  payslips?: any[];
  initialYearMonth?: string; // 改定年月 (例: '2026-09')
  onOpenInspector?: () => void;
}

export const MonthlyRevisionReportModal: React.FC<MonthlyRevisionReportModalProps> = ({
  isOpen,
  onClose,
  tenantId,
  tenantInfo,
  employees,
  payrollProfiles = {},
  payslips = [],
  initialYearMonth,
  onOpenInspector
}) => {
  const currentYear = new Date().getFullYear();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  
  // 改定年月（デフォルトは当月、または指定月）
  const [revisionYearMonth, setRevisionYearMonth] = useState(
    initialYearMonth || `${currentYear}-${currentMonth}`
  );
  const [submissionDate, setSubmissionDate] = useState(new Date().toISOString().split('T')[0]);

  // 事業所情報
  const [officeSymbol, setOfficeSymbol] = useState('');
  const [officeCityCode, setOfficeCityCode] = useState('');
  const [officeSymbolKana, setOfficeSymbolKana] = useState('');
  const [companyZip, setCompanyZip] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyOwnerName, setCompanyOwnerName] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');

  // 自動検出結果
  const [candidates, setCandidates] = useState<MonthlyRevisionCandidate[]>([]);
  // 各候補者の選択状態（届出書に載せるか）
  const [selectedUserIds, setSelectedUserIds] = useState<Record<string, boolean>>({});

  // 編集中の個別行データ
  const [editableRows, setEditableRows] = useState<Record<string, MonthlyRevisionEmployeeDocData>>({});

  // 表示タブ: 'candidates' (判定・選定) | 'preview' (公式2221 A4印刷)
  const [activeTab, setActiveTab] = useState<'candidates' | 'preview'>('candidates');

  // 初期ロード・会社情報の復元
  useEffect(() => {
    if (!isOpen) return;

    if (initialYearMonth) {
      setRevisionYearMonth(initialYearMonth);
    }

    setCompanyName(tenantInfo?.name || '');
    setCompanyAddress(tenantInfo?.address || '');
    setCompanyZip(tenantInfo?.zip_code || tenantInfo?.zip || '');
    setCompanyOwnerName(tenantInfo?.representative_name || tenantInfo?.owner_name || '');
    setCompanyPhone(tenantInfo?.phone || '');

    // 会社社会保険設定から整理記号を抽出
    const shakai = tenantInfo?.shakai_hoken_settings || {};
    let sym = shakai.office_symbol || tenantInfo?.shakai_hoken_office_number || '';
    if (!sym && tenantId) {
      try {
        const rawIns = localStorage.getItem(`company_insurance_settings_${tenantId}`);
        if (rawIns) {
          const parsedIns = JSON.parse(rawIns);
          if (parsedIns.shakai_hoken_office_symbol) sym = parsedIns.shakai_hoken_office_symbol;
        }
      } catch (e) {
        console.error(e);
      }
    }
    setOfficeSymbol(sym);
    if (sym.includes('-')) {
      const parts = sym.split('-');
      setOfficeCityCode(parts[0] || '');
      setOfficeSymbolKana(parts[1] || '');
    }
  }, [isOpen, tenantInfo, tenantId, initialYearMonth]);

  // 改定年月または給与データ変更時に自動判定エンジンを実行
  useEffect(() => {
    if (!isOpen) return;

    const detected = detectMonthlyRevisionCandidates({
      revisionYearMonth,
      employees,
      payrollProfiles,
      allPayslips: payslips
    });

    setCandidates(detected);

    // 該当者（isEligible = true）はデフォルトで選択状態に
    const newSelected: Record<string, boolean> = {};
    const newRows: Record<string, MonthlyRevisionEmployeeDocData> = {};

    detected.forEach(cand => {
      newSelected[cand.userId] = cand.isEligible;

      // 公式届出行形式にマッピング
      const m1 = cand.consecutiveMonths[0];
      const m2 = cand.consecutiveMonths[1];
      const m3 = cand.consecutiveMonths[2];

      const emp = employees.find(e => e.id === cand.userId);
      const profile = payrollProfiles[cand.userId];

      newRows[cand.userId] = {
        id: cand.userId,
        insuranceNumber: (profile as any)?.insurance_number || emp?.insurance_number || cand.employeeNumber || '',
        name: cand.userName,
        birthDate: cand.birthDate,
        revisionYearMonth: cand.revisionYearMonth,
        currentHealthStandard: cand.currentHealthStandard,
        currentPensionStandard: cand.currentPensionStandard,
        previousRevisionYM: cand.previousRevisionYM,
        wageChangeType: cand.changeType === '昇給' ? '1.昇給' : '2.降給',
        wageChangeYM: cand.changeMonth,
        retroactiveAmount: 0,
        month1: {
          ym: m1.yearMonth,
          monthNum: m1.monthNum,
          days: m1.baseDays,
          cash: m1.cashAmount,
          inKind: m1.inKindAmount,
          total: m1.totalAmount
        },
        month2: {
          ym: m2.yearMonth,
          monthNum: m2.monthNum,
          days: m2.baseDays,
          cash: m2.cashAmount,
          inKind: m2.inKindAmount,
          total: m2.totalAmount
        },
        month3: {
          ym: m3.yearMonth,
          monthNum: m3.monthNum,
          days: m3.baseDays,
          cash: m3.cashAmount,
          inKind: m3.inKindAmount,
          total: m3.totalAmount
        },
        totalWage: cand.totalWage,
        averageWage: cand.averageWage,
        modifiedAverageWage: cand.averageWage,
        myNumber: cand.myNumber,
        isOver70: cand.is70Over,
        isShortTimeWorker: cand.isShortTimeWorker,
        remarks: cand.remarks || (cand.isShortTimeWorker ? '短時間労働者' : '基本給改定のため'),
        remarksCircles: [
          ...(cand.is70Over ? [1] : []),
          ...(cand.isShortTimeWorker ? [3] : []),
          4
        ]
      };
    });

    setSelectedUserIds(newSelected);
    setEditableRows(newRows);
  }, [isOpen, revisionYearMonth, employees, payrollProfiles, payslips]);

  // 行編集ヘルパー
  const updateEmployeeRow = (userId: string, updates: Partial<MonthlyRevisionEmployeeDocData>) => {
    setEditableRows(prev => {
      const existing = prev[userId];
      if (!existing) return prev;
      return {
        ...prev,
        [userId]: {
          ...existing,
          ...updates
        }
      };
    });
  };

  // 備考欄〇印のトグル (1〜6)
  const toggleRemarksCircle = (userId: string, num: number) => {
    const current = editableRows[userId]?.remarksCircles || [];
    const updated = current.includes(num)
      ? current.filter(n => n !== num)
      : [...current, num].sort((a, b) => a - b);
    updateEmployeeRow(userId, { remarksCircles: updated });
  };

  // 選択中の届出対象者リスト
  const selectedDocEmployees = useMemo(() => {
    return candidates
      .filter(cand => selectedUserIds[cand.userId])
      .map(cand => editableRows[cand.userId])
      .filter((row): row is MonthlyRevisionEmployeeDocData => !!row);
  }, [candidates, selectedUserIds, editableRows]);

  // 判定対象の3ヶ月の表示文字列 (例: '6月・7月・8月')
  const target3MonthsText = useMemo(() => {
    if (candidates.length > 0 && candidates[0].consecutiveMonths.length === 3) {
      const months = candidates[0].consecutiveMonths;
      return `${months[0].monthNum}月・${months[1].monthNum}月・${months[2].monthNum}月`;
    }
    const [, m] = revisionYearMonth.split('-').map(Number);
    const m3 = m - 1 <= 0 ? m - 1 + 12 : m - 1;
    const m2 = m - 2 <= 0 ? m - 2 + 12 : m - 2;
    const m1 = m - 3 <= 0 ? m - 3 + 12 : m - 3;
    return `${m1}月・${m2}月・${m3}月`;
  }, [candidates, revisionYearMonth]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-hidden animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-7xl h-[95vh] flex flex-col shadow-2xl overflow-hidden">
        {/* ヘッダー */}
        <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600/20 border border-purple-500/30 text-purple-400 flex items-center justify-center font-black text-xl shadow-inner">
              📋
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  被保険者報酬月額変更届（兼 70歳以上被用者月額変更届）
                </h3>
                <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-mono font-bold">
                  日本年金機構 様式コード 2221
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                  自動判定連動
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                毎月の給与確定データ（実DB payslips）から随時改定（月変）対象者を全自動検出。公式原本OCR用紙への直印字・白紙A4印刷に完全対応。
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* 改定年月セレクタ */}
            <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/80 px-3 py-1.5 rounded-xl">
              <span className="text-xs font-bold text-purple-300">改定年月:</span>
              <input
                type="month"
                value={revisionYearMonth}
                onChange={(e) => setRevisionYearMonth(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-white font-bold text-xs rounded-lg px-2 py-1 outline-hidden focus:border-purple-500"
              />
            </div>

            {/* タブ切り替えボタン */}
            <div className="flex items-center p-1 bg-slate-800 border border-slate-700 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('candidates')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'candidates'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>① 月変判定・対象一覧 ({selectedDocEmployees.length}名)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'preview'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>② 公式用紙A4プレビュー・印刷</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* メインコンテンツ */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {activeTab === 'candidates' ? (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-950/60">
              {/* ガイダンスカード */}
              <div className="bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-slate-900 border border-purple-500/30 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-md">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm flex items-center gap-2">
                      {revisionYearMonth} 改定（{target3MonthsText} 支給実績）の随時改定判定結果
                    </h4>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      健康保険法第43条および厚生年金保険法第23条に基づき、
                      <strong className="text-purple-300">①固定的賃金の変動</strong>、
                      <strong className="text-purple-300">②変動後3ヶ月連続17日以上（短時間11日以上）の支払基礎日数</strong>、
                      <strong className="text-purple-300">③新旧標準報酬の2等級以上の差</strong>、
                      <strong className="text-purple-300">④変動方向の一致</strong>を全自動で判定しました。
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const detected = detectMonthlyRevisionCandidates({
                        revisionYearMonth,
                        employees,
                        payrollProfiles,
                        allPayslips: payslips
                      });
                      setCandidates(detected);
                    }}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>再判定実行</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('preview')}
                    disabled={selectedDocEmployees.length === 0}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>公式用紙（様式2221）を印刷へ進む →</span>
                  </button>
                </div>
              </div>

              {/* 事業所基本情報カード */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                  <h5 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-purple-400" />
                    届出先年金事務所・事業所情報（様式コード2221ヘッダー印字用）
                  </h5>
                  <span className="text-[11px] text-slate-400">提出日: {submissionDate}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">事業所整理記号</label>
                    <input
                      type="text"
                      value={officeSymbol}
                      onChange={(e) => {
                        setOfficeSymbol(e.target.value);
                        if (e.target.value.includes('-')) {
                          const p = e.target.value.split('-');
                          setOfficeCityCode(p[0] || '');
                          setOfficeSymbolKana(p[1] || '');
                        }
                      }}
                      placeholder="例: 25-カア"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">提出年月日</label>
                    <input
                      type="date"
                      value={submissionDate}
                      onChange={(e) => setSubmissionDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">事業所所在地</label>
                    <input
                      type="text"
                      value={companyAddress}
                      onChange={(e) => setCompanyAddress(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white truncate"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">事業主氏名</label>
                    <input
                      type="text"
                      value={companyOwnerName}
                      onChange={(e) => setCompanyOwnerName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                </div>
              </div>

              {/* 対象者一覧テーブル */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
                <div className="px-4 py-3 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">
                      従業員別 随時改定判定リスト
                    </span>
                    <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-bold">
                      全{candidates.length}名中 {selectedDocEmployees.length}名を届出対象として選択中
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const allSelected: Record<string, boolean> = {};
                        candidates.forEach(c => {
                          if (c.isEligible) allSelected[c.userId] = true;
                        });
                        setSelectedUserIds(allSelected);
                      }}
                      className="text-[11px] text-purple-300 hover:text-purple-200 underline cursor-pointer"
                    >
                      該当者のみ全選択
                    </button>
                    <span className="text-slate-600">|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedUserIds({})}
                      className="text-[11px] text-slate-400 hover:text-slate-300 underline cursor-pointer"
                    >
                      選択解除
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-950/80 text-slate-400 font-bold border-b border-slate-800 text-[11px]">
                        <th className="py-2.5 px-3 text-center w-10">印字</th>
                        <th className="py-2.5 px-3">氏名 / 整理番号</th>
                        <th className="py-2.5 px-3 text-center">変動内容</th>
                        <th className="py-2.5 px-3 text-right">従前標準報酬</th>
                        <th className="py-2.5 px-3 text-center">3ヶ月実績 ({target3MonthsText})</th>
                        <th className="py-2.5 px-3 text-right">3ヶ月平均額</th>
                        <th className="py-2.5 px-3 text-right">新標準報酬</th>
                        <th className="py-2.5 px-3 text-center">等級差</th>
                        <th className="py-2.5 px-3">判定理由 / 備考</th>
                        <th className="py-2.5 px-3 min-w-[280px]">届出用紙 印字設定（⑱ 備考〇印 ＆ 理由）</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-200">
                      {candidates.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="py-8 text-center text-slate-500">
                            対象データが存在しません。給与確定データ（実DB payslips）をご確認ください。
                          </td>
                        </tr>
                      ) : (
                        candidates.map((cand) => {
                          const isSelected = !!selectedUserIds[cand.userId];
                          const row = editableRows[cand.userId];
                          const m1 = cand.consecutiveMonths[0];
                          const m2 = cand.consecutiveMonths[1];
                          const m3 = cand.consecutiveMonths[2];

                          return (
                            <tr
                              key={cand.userId}
                              className={`transition ${
                                cand.isEligible
                                  ? isSelected
                                    ? 'bg-purple-950/20 hover:bg-purple-950/30'
                                    : 'bg-slate-900/50 hover:bg-slate-800/50'
                                  : 'opacity-60 hover:opacity-100 bg-slate-950/30'
                              }`}
                            >
                              {/* 選択チェックボックス */}
                              <td className="py-3 px-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    setSelectedUserIds(prev => ({
                                      ...prev,
                                      [cand.userId]: e.target.checked
                                    }));
                                  }}
                                  className="w-4 h-4 rounded-sm border-slate-700 bg-slate-900 text-purple-600 focus:ring-purple-500 cursor-pointer"
                                />
                              </td>

                              {/* 氏名 / 整理番号 */}
                              <td className="py-3 px-3">
                                <div className="font-bold text-white flex items-center gap-1.5">
                                  <span>{cand.userName}</span>
                                  {cand.is70Over && (
                                    <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1 py-0.2 rounded font-mono">
                                      70歳以上
                                    </span>
                                  )}
                                  {cand.isShortTimeWorker && (
                                    <span className="text-[9px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1 py-0.2 rounded">
                                      短時間
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  番: {row?.insuranceNumber || '未設定'} / {cand.birthDate || '生年月日未登録'}
                                </div>
                              </td>

                              {/* 変動内容 */}
                              <td className="py-3 px-3 text-center">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  cand.changeType === '昇給'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                }`}>
                                  {cand.changeType === '昇給' ? '📈 昇給' : '📉 降給'} ({cand.changeMonth})
                                </span>
                              </td>

                              {/* 従前標準報酬 */}
                              <td className="py-3 px-3 text-right">
                                <div className="font-mono font-bold text-slate-200">
                                  ¥{cand.currentHealthStandard.toLocaleString()}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {cand.currentHealthGrade}等級
                                </div>
                              </td>

                              {/* 3ヶ月実績 */}
                              <td className="py-3 px-3 text-center">
                                <div className="text-[10px] text-slate-300 font-mono space-y-0.5">
                                  <div>{m1.monthNum}月: {m1.baseDays}日 / ¥{m1.totalAmount.toLocaleString()}</div>
                                  <div>{m2.monthNum}月: {m2.baseDays}日 / ¥{m2.totalAmount.toLocaleString()}</div>
                                  <div>{m3.monthNum}月: {m3.baseDays}日 / ¥{m3.totalAmount.toLocaleString()}</div>
                                </div>
                              </td>

                              {/* 3ヶ月平均額 */}
                              <td className="py-3 px-3 text-right">
                                <div className="font-mono font-bold text-purple-300 text-sm">
                                  ¥{cand.averageWage.toLocaleString()}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  総計: ¥{cand.totalWage.toLocaleString()}
                                </div>
                              </td>

                              {/* 新標準報酬 */}
                              <td className="py-3 px-3 text-right">
                                <div className="font-mono font-bold text-emerald-400 text-sm">
                                  ¥{cand.newHealthStandard.toLocaleString()}
                                </div>
                                <div className="text-[10px] text-emerald-300">
                                  {cand.newHealthGrade}等級
                                </div>
                              </td>

                              {/* 等級差 */}
                              <td className="py-3 px-3 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded font-mono font-bold text-xs ${
                                  Math.abs(cand.healthGradeDiff) >= 2
                                    ? 'bg-purple-600 text-white shadow-xs'
                                    : 'bg-slate-800 text-slate-400'
                                }`}>
                                  {cand.healthGradeDiff > 0 ? `+${cand.healthGradeDiff}` : cand.healthGradeDiff}等級
                                </span>
                              </td>

                              {/* 判定理由・備考 */}
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-1.5">
                                  {cand.isEligible ? (
                                    <span className="text-emerald-400 flex items-center gap-1 font-bold text-xs">
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      随時改定 対象
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 text-xs">
                                      対象外
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                                  {cand.reason}
                                </p>
                              </td>

                              {/* 届出用紙 印字設定（⑱ 備考〇印 ＆ 理由） */}
                              <td className="py-2.5 px-3 bg-slate-950/40 border-l border-slate-800/80">
                                <div className="space-y-2">
                                  {/* ⑱ 備考丸囲み番号 (1〜6) */}
                                  <div>
                                    <div className="text-[10px] text-slate-400 font-bold mb-1 flex items-center justify-between">
                                      <span>⑱ 備考 〇印（複数選択可）:</span>
                                      <span className="text-[9px] text-purple-400 font-mono">
                                        {(row?.remarksCircles || []).length > 0 ? `選択中: ${(row?.remarksCircles || []).join(', ')}` : '未選択'}
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      {[
                                        { num: 1, label: '1. 70歳以上' },
                                        { num: 2, label: '2. 二以上' },
                                        { num: 3, label: '3. 短時間' },
                                        { num: 4, label: '4. 昇降給理由' },
                                        { num: 5, label: '5. 健保のみ' },
                                        { num: 6, label: '6. その他' },
                                      ].map(item => {
                                        const isCircleActive = (row?.remarksCircles || []).includes(item.num);
                                        return (
                                          <button
                                            key={item.num}
                                            type="button"
                                            onClick={() => toggleRemarksCircle(cand.userId, item.num)}
                                            className={`text-[10px] px-1.5 py-0.5 rounded border transition-all ${
                                              isCircleActive
                                                ? 'bg-purple-600 border-purple-400 text-white font-bold shadow-xs'
                                                : 'bg-slate-900 border-slate-700/80 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                                            }`}
                                            title={`届出用紙の⑱備考欄「${item.label}」に〇印を付けます`}
                                          >
                                            {isCircleActive ? `● ${item.label}` : item.label}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* 昇給・降給理由の入力 ＆ プリセット */}
                                  <div>
                                    <div className="text-[10px] text-slate-400 font-bold mb-1 flex items-center justify-between">
                                      <span>昇給・降給の理由（原本カッコ内に印字）:</span>
                                      <div className="inline-flex rounded border border-slate-700/80 overflow-hidden text-[9px]">
                                        <button
                                          type="button"
                                          onClick={() => updateEmployeeRow(cand.userId, { wageChangeType: '1.昇給' })}
                                          className={`px-1.5 py-0.5 ${
                                            row?.wageChangeType === '1.昇給'
                                              ? 'bg-emerald-600 text-white font-bold'
                                              : 'bg-slate-900 text-slate-400 hover:text-white'
                                          }`}
                                        >
                                          ⑦ 昇給
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => updateEmployeeRow(cand.userId, { wageChangeType: '2.降給' })}
                                          className={`px-1.5 py-0.5 ${
                                            row?.wageChangeType === '2.降給'
                                              ? 'bg-rose-600 text-white font-bold'
                                              : 'bg-slate-900 text-slate-400 hover:text-white'
                                          }`}
                                        >
                                          ⑦ 降給
                                        </button>
                                      </div>
                                    </div>
                                    <input
                                      type="text"
                                      value={row?.remarks || ''}
                                      onChange={(e) => updateEmployeeRow(cand.userId, { remarks: e.target.value })}
                                      placeholder="例: 基本給改定、定期昇給、ベースアップ"
                                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-purple-500"
                                    />
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {['基本給改定', '定期昇給', 'ベースアップ', '役職手当変更', '短時間労働者'].map((preset) => (
                                        <button
                                          key={preset}
                                          type="button"
                                          onClick={() => {
                                            const circles = row?.remarksCircles || [];
                                            const newCircles = circles.includes(4) ? circles : [...circles, 4].sort((a, b) => a - b);
                                            updateEmployeeRow(cand.userId, {
                                              remarks: preset,
                                              remarksCircles: newCircles
                                            });
                                          }}
                                          className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition"
                                        >
                                          + {preset}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            /* 公式用紙A4プレビュー・印刷ビュー */
            <div className="flex-1 overflow-hidden flex flex-col bg-slate-950">
              <OfficialMonthlyRevisionDoc
                data={{
                  submissionDate,
                  officeSymbol,
                  officeCityCode,
                  officeSymbolKana,
                  companyZip,
                  companyAddress,
                  companyName,
                  companyOwnerName,
                  companyPhone,
                  employees: selectedDocEmployees
                }}
                tenantId={tenantId}
                canEditCoordinates={true}
                onClose={() => setActiveTab('candidates')}
                onOpenInspector={onOpenInspector}
              />
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="px-6 py-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span>選択中の提出者: <strong className="text-white font-bold">{selectedDocEmployees.length}名</strong></span>
            <span>（全{candidates.length}名中）</span>
            {selectedDocEmployees.length > 0 && (
              <span className="text-purple-400">
                A4印刷枚数: 約{Math.ceil(selectedDocEmployees.length / 5)}枚（1枚最大5名）
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              閉じる
            </button>
            {activeTab === 'candidates' ? (
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                disabled={selectedDocEmployees.length === 0}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>A4印刷プレビューを開く →</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>この内容で印刷する（A4）</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
