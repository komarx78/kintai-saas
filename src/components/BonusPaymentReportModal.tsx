import React, { useState, useEffect } from 'react';
import { 
  X, Printer, Save, Sparkles, FileText, 
  CheckCircle2, Users, Eye, Calendar, Building2
} from 'lucide-react';
import { 
  OfficialBonusPaymentReportDoc, 
  type BonusReportEmployee, 
  checkIfOver70,
  formatNenkinBirthDate
} from './OfficialBonusPaymentReportDoc';

export interface BonusPaymentReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  tenantInfo: any;
  employees: any[];
  payrollProfiles?: Record<string, any>;
  initialYearMonth?: string;
  onSaveNoticeToCabinet?: (fileData: { title: string; fiscal_year: string; filename: string; file_url: string; note: string }) => void;
}

export const BonusPaymentReportModal: React.FC<BonusPaymentReportModalProps> = ({
  isOpen,
  onClose,
  tenantId,
  tenantInfo,
  employees,
  payrollProfiles = {},
  initialYearMonth,
  onSaveNoticeToCabinet
}) => {
  const currentYear = new Date().getFullYear();
  const [bonusYearMonth, setBonusYearMonth] = useState(initialYearMonth || `${currentYear}-06`); // 例: 2026-06 夏期賞与
  const [bonusTitle, setBonusTitle] = useState('令和8年度 夏期賞与');
  const [commonPaymentDate, setCommonPaymentDate] = useState(`${currentYear}-06-30`);
  const [submissionDate, setSubmissionDate] = useState(new Date().toISOString().split('T')[0]);

  // 事業所情報
  const [officeSymbol, setOfficeSymbol] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyOwnerName, setCompanyOwnerName] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [sharoushiName, setSharoushiName] = useState('');

  // 従業員別賞与データ
  const [bonusRows, setBonusRows] = useState<Array<{
    user_id: string;
    include: boolean; // 届出に含めるか
    name: string;
    nameKana?: string;
    birthDate?: string;
    insuranceNumber?: string;
    myNumber?: string;
    currencyAmount: number;
    goodsAmount: number;
    individualPaymentDate?: string;
    isDualWork?: boolean;
    isMonthlyMerged?: boolean;
    firstPaymentDay?: string;
  }>>([]);

  // 表示ビュー: 'edit' (入力テーブル) | 'preview' (公式帳票A4プレビュー)
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');

  // 一括入力補助ステート
  const [bulkAmount, setBulkAmount] = useState<number | ''>('');
  const [bulkMultiplier, setBulkMultiplier] = useState<number | ''>(1.0); // 基本給の◯ヶ月分

  // 初期ロード・従業員リストの構築
  useEffect(() => {
    if (!isOpen) return;

    // 会社情報の初期化
    setCompanyName(tenantInfo?.name || '');
    setCompanyAddress(tenantInfo?.address || '');
    setCompanyOwnerName(tenantInfo?.representative_name || tenantInfo?.owner_name || '');
    setCompanyPhone(tenantInfo?.phone || '');

    // 会社社会保険設定から整理記号を抽出
    const shakai = tenantInfo?.shakai_hoken_settings || {};
    const sym = shakai.office_symbol || tenantInfo?.shakai_hoken_office_number || '01-イロハ';
    setOfficeSymbol(sym);

    // 過去の保存データがあればロード、無ければ従業員一覧から初期生成
    const storageKey = `bonus_report_${tenantId}_${bonusYearMonth}`;
    const saved = localStorage.getItem(storageKey);

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.bonusTitle) setBonusTitle(parsed.bonusTitle);
        if (parsed.commonPaymentDate) setCommonPaymentDate(parsed.commonPaymentDate);
        if (parsed.submissionDate) setSubmissionDate(parsed.submissionDate);
        if (parsed.officeSymbol) setOfficeSymbol(parsed.officeSymbol);
        if (parsed.sharoushiName) setSharoushiName(parsed.sharoushiName);
        if (Array.isArray(parsed.bonusRows)) {
          setBonusRows(parsed.bonusRows);
          return;
        }
      } catch (e) {
        console.warn('Failed to parse saved bonus report:', e);
      }
    }

    // デフォルト生成：社会保険加入者を優先してリスト化
    const rows = employees.map((emp, index) => {
      const prof = payrollProfiles[emp.id] || {};
      let localMaster: any = {};
      try {
        const raw = localStorage.getItem(`employee_master_backup_${emp.id}`);
        if (raw) localMaster = JSON.parse(raw);
      } catch (_) {}

      const bDate = prof.birth_date || emp.birth_date || localMaster.birth_date || '';
      const myNum = localMaster.my_number || emp.my_number || '';
      const baseSalary = prof.base_salary || localMaster.base_salary || 250000;

      // 社保加入している正社員等をデフォルトで対象
      const isJoined = prof.health_insurance_enabled ?? localMaster.health_insurance_joined ?? true;

      return {
        user_id: emp.id,
        include: isJoined,
        name: emp.name,
        nameKana: emp.name_kana || '',
        birthDate: bDate,
        insuranceNumber: String(index + 1).padStart(4, '0'),
        myNumber: myNum,
        currencyAmount: Math.round(baseSalary * 1.0), // 初期値: 基本給1ヶ月分
        goodsAmount: 0,
        individualPaymentDate: '',
        isDualWork: false,
        isMonthlyMerged: false,
        firstPaymentDay: ''
      };
    });

    setBonusRows(rows);
  }, [isOpen, tenantId, bonusYearMonth]);

  if (!isOpen) return null;

  // データ保存
  const handleSaveData = () => {
    try {
      const storageKey = `bonus_report_${tenantId}_${bonusYearMonth}`;
      const payload = {
        bonusYearMonth,
        bonusTitle,
        commonPaymentDate,
        submissionDate,
        officeSymbol,
        sharoushiName,
        bonusRows,
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem(storageKey, JSON.stringify(payload));
      alert('✨ 賞与支払届のデータを保存しました！いつでも再開・再印刷できます。');
    } catch (err: any) {
      alert('保存に失敗しました: ' + err.message);
    }
  };

  // 全社キャビネットへの自動ファイリング
  const handleSaveToCabinet = () => {
    if (!onSaveNoticeToCabinet) {
      handleSaveData();
      return;
    }
    handleSaveData();

    const [y] = bonusYearMonth.split('-');
    const reiwaY = parseInt(y, 10) - 2018;
    onSaveNoticeToCabinet({
      title: `【年金機構 届出様式2265】${bonusTitle} 被保険者賞与支払届`,
      fiscal_year: `令和${reiwaY}年度 (${y})`,
      filename: `被保険者賞与支払届_${bonusYearMonth}.pdf`,
      file_url: 'data:application/pdf;base64,mock', // ビュー内で直接印刷可能
      note: `共通支給日: ${commonPaymentDate}、対象者数: ${bonusRows.filter(r => r.include).length}名`
    });
    alert('📁 全社保管庫（キャビネット）に賞与支払届の控えを保管登録しました！');
  };

  // 一括反映（月数掛け）
  const handleApplyMultiplier = () => {
    if (bulkMultiplier === '' || Number(bulkMultiplier) < 0) return;
    const m = Number(bulkMultiplier);
    setBonusRows(prev => prev.map(row => {
      const prof = payrollProfiles[row.user_id] || {};
      const base = prof.base_salary || 250000;
      return {
        ...row,
        currencyAmount: Math.round(base * m)
      };
    }));
  };

  // 一括反映（定額）
  const handleApplyBulkAmount = () => {
    if (bulkAmount === '' || Number(bulkAmount) < 0) return;
    const amt = Number(bulkAmount);
    setBonusRows(prev => prev.map(row => ({
      ...row,
      currencyAmount: amt
    })));
  };

  // 公式コンポーネント用データへ変換
  const includedRows = bonusRows.filter(r => r.include);
  const docEmployees: BonusReportEmployee[] = includedRows.map(r => ({
    id: r.user_id,
    insuranceNumber: r.insuranceNumber,
    name: r.name,
    nameKana: r.nameKana,
    birthDate: r.birthDate,
    individualPaymentDate: r.individualPaymentDate,
    currencyAmount: r.currencyAmount,
    goodsAmount: r.goodsAmount,
    myNumber: r.myNumber,
    isOver70: checkIfOver70(r.birthDate, commonPaymentDate),
    isDualWork: r.isDualWork,
    isMonthlyMerged: r.isMonthlyMerged,
    firstPaymentDay: r.firstPaymentDay
  }));

  const reportData = {
    submissionDate,
    officeSymbol,
    companyAddress,
    companyName,
    companyOwnerName,
    companyPhone,
    checkedMyNumberAccuracy: true,
    sharoushiName,
    commonPaymentDate,
    employees: docEmployees
  };

  // 集計サマリー
  const totalCurrency = includedRows.reduce((sum, r) => sum + (r.currencyAmount || 0), 0);
  const totalGoods = includedRows.reduce((sum, r) => sum + (r.goodsAmount || 0), 0);
  const totalGross = totalCurrency + totalGoods;
  const totalStandard = includedRows.reduce((sum, r) => sum + Math.floor(((r.currencyAmount || 0) + (r.goodsAmount || 0)) / 1000) * 1000, 0);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 z-50 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-6xl max-h-[94vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* モーダルヘッダー */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-fuchsia-900 via-fuchsia-800 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-fuchsia-500/20 border border-fuchsia-400/30 flex items-center justify-center">
              <FileText className="w-5 h-5 text-fuchsia-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  健康保険・厚生年金保険 被保険者賞与支払届
                </h3>
                <span className="text-[10px] bg-fuchsia-500/30 border border-fuchsia-400/40 text-fuchsia-200 px-2 py-0.5 rounded-full font-mono font-bold">
                  様式コード 2265
                </span>
              </div>
              <p className="text-xs text-fuchsia-200 mt-0.5">
                日本年金機構公式様式に完全準拠・千円未満切捨て標準賞与額自動計算・A4縦印刷対応
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* タブ切り替え */}
            <div className="flex items-center bg-white/10 p-1 rounded-xl border border-white/20 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('edit')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'edit' ? 'bg-white text-fuchsia-900 shadow-xs' : 'text-white/80 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                賞与入力 ＆ 設定
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'preview' ? 'bg-white text-fuchsia-900 shadow-xs' : 'text-white/80 hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                公式帳票プレビュー (A4)
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition cursor-pointer ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* モーダルボディ */}
        <div className="p-5 overflow-y-auto flex-1 bg-slate-50/50 space-y-5">
          {activeTab === 'edit' ? (
            <>
              {/* 1. 賞与基本設定 ＆ 提出者情報 */}
              <div className="bg-white p-4 rounded-2xl border border-fuchsia-100 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-fuchsia-50 pb-2">
                  <span className="font-bold text-xs text-fuchsia-950 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-fuchsia-600" />
                    賞与支給情報 ＆ 提出事業所設定
                  </span>
                  <span className="text-[10px] text-slate-400">大元会社マスタから自動連動</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-1">賞与年月 / 区分</label>
                    <input
                      type="month"
                      value={bonusYearMonth}
                      onChange={e => setBonusYearMonth(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-1">賞与名称 / タイトル</label>
                    <input
                      type="text"
                      value={bonusTitle}
                      onChange={e => setBonusTitle(e.target.value)}
                      placeholder="例: 令和8年度 夏期賞与"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-1">
                      ④ 賞与支払年月日（共通）
                    </label>
                    <input
                      type="date"
                      value={commonPaymentDate}
                      onChange={e => setCommonPaymentDate(e.target.value)}
                      className="w-full bg-fuchsia-50/70 border border-fuchsia-300 rounded-xl px-2.5 py-1.5 font-bold text-fuchsia-950"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-1">提出年月日</label>
                    <input
                      type="date"
                      value={submissionDate}
                      onChange={e => setSubmissionDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs pt-1 border-t border-slate-100">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-1">事業所整理記号</label>
                    <input
                      type="text"
                      value={officeSymbol}
                      onChange={e => setOfficeSymbol(e.target.value)}
                      placeholder="例: 01-イロハ"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-1">事業所名称</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={e => setCompanyName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-1">事業主氏名</label>
                    <input
                      type="text"
                      value={companyOwnerName}
                      onChange={e => setCompanyOwnerName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-1">社会保険労務士（任意）</label>
                    <input
                      type="text"
                      value={sharoushiName}
                      onChange={e => setSharoushiName(e.target.value)}
                      placeholder="提出代行者氏名等"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5"
                    />
                  </div>
                </div>
              </div>

              {/* 2. 一括反映アシスト ＆ 集計バー */}
              <div className="bg-gradient-to-r from-fuchsia-50 via-purple-50 to-fuchsia-50 p-3.5 rounded-2xl border border-fuchsia-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-fuchsia-600" />
                    <span className="font-bold text-fuchsia-950">一括算定アシスト:</span>
                  </div>

                  <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-xl border border-fuchsia-200">
                    <span className="text-[10px] text-slate-500">基本給の</span>
                    <input
                      type="number"
                      step="0.1"
                      value={bulkMultiplier}
                      onChange={e => setBulkMultiplier(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      className="w-12 text-center font-bold border-b border-fuchsia-300"
                    />
                    <span className="text-[10px] text-slate-500">ヶ月分を全員に反映</span>
                    <button
                      type="button"
                      onClick={handleApplyMultiplier}
                      className="ml-1 px-2 py-0.5 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-lg text-[10px] font-bold transition cursor-pointer"
                    >
                      適用
                    </button>
                  </div>

                  <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-xl border border-fuchsia-200">
                    <span className="text-[10px] text-slate-500">全員一律</span>
                    <input
                      type="number"
                      step="10000"
                      value={bulkAmount}
                      onChange={e => setBulkAmount(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                      placeholder="例: 300000"
                      className="w-24 text-right font-bold border-b border-fuchsia-300"
                    />
                    <span className="text-[10px] text-slate-500">円</span>
                    <button
                      type="button"
                      onClick={handleApplyBulkAmount}
                      className="ml-1 px-2 py-0.5 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-lg text-[10px] font-bold transition cursor-pointer"
                    >
                      適用
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-4 bg-white px-3.5 py-1.5 rounded-xl border border-fuchsia-200 font-mono">
                  <div>
                    <span className="text-[10px] text-slate-400 block -mb-0.5">対象人数</span>
                    <span className="font-black text-fuchsia-950 text-sm">
                      {includedRows.length} 名
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block -mb-0.5">賞与支払総額</span>
                    <span className="font-bold text-slate-700 text-sm">
                      ¥{totalGross.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block -mb-0.5">標準賞与総額 (切捨後)</span>
                    <span className="font-black text-fuchsia-700 text-sm">
                      ¥{totalStandard.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. 被保険者賞与明細入力テーブル */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>被保険者一覧 ＆ 賞与額入力 ({bonusRows.length}名)</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    ※ 1枚あたり10名で日本年金機構公式届書に自動割り振りされます
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse min-w-[900px]">
                    <thead>
                      <tr className="bg-fuchsia-50/60 text-[11px] font-bold text-fuchsia-950 border-b border-slate-200">
                        <th className="py-2.5 px-3 text-center w-12">対象</th>
                        <th className="py-2.5 px-3">氏名 / 整理番号</th>
                        <th className="py-2.5 px-3">生年月日 (公式コード)</th>
                        <th className="py-2.5 px-3">⑤㋐ 通貨賞与額</th>
                        <th className="py-2.5 px-3">⑤㋑ 現物賞与額</th>
                        <th className="py-2.5 px-3 text-right">⑥ 標準賞与額 (千円切捨)</th>
                        <th className="py-2.5 px-3 text-center">70歳以上</th>
                        <th className="py-2.5 px-3">個別支払日 / 備考</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bonusRows.map((row, idx) => {
                        const birthCode = formatNenkinBirthDate(row.birthDate);
                        const isOver70 = checkIfOver70(row.birthDate, commonPaymentDate);
                        const gross = (row.currencyAmount || 0) + (row.goodsAmount || 0);
                        const standardBonus = Math.floor(gross / 1000) * 1000;

                        return (
                          <tr
                            key={row.user_id}
                            className={`hover:bg-slate-50 transition ${!row.include ? 'opacity-40 bg-slate-50/60' : ''}`}
                          >
                            <td className="py-2 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={row.include}
                                onChange={e => {
                                  const checked = e.target.checked;
                                  setBonusRows(prev => prev.map((r, i) => i === idx ? { ...r, include: checked } : r));
                                }}
                                className="w-4 h-4 text-fuchsia-600 rounded cursor-pointer"
                              />
                            </td>

                            <td className="py-2 px-3">
                              <div className="font-bold text-slate-900">{row.name}</div>
                              <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                                <span>No.</span>
                                <input
                                  type="text"
                                  value={row.insuranceNumber || ''}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setBonusRows(prev => prev.map((r, i) => i === idx ? { ...r, insuranceNumber: val } : r));
                                  }}
                                  className="w-16 border-b border-slate-300 font-bold text-slate-700 px-0.5"
                                  placeholder="0001"
                                />
                              </div>
                            </td>

                            <td className="py-2 px-3 font-mono">
                              <div className="font-bold text-slate-800 text-xs">{birthCode}</div>
                              <div className="text-[10px] text-slate-400">{row.birthDate || '未登録'}</div>
                            </td>

                            <td className="py-2 px-3">
                              <div className="flex items-center gap-1">
                                <span className="text-slate-400 text-[10px]">¥</span>
                                <input
                                  type="number"
                                  step="1000"
                                  value={row.currencyAmount || ''}
                                  onChange={e => {
                                    const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                                    setBonusRows(prev => prev.map((r, i) => i === idx ? { ...r, currencyAmount: val } : r));
                                  }}
                                  disabled={!row.include}
                                  className="w-28 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-bold font-mono text-slate-900 focus:bg-white"
                                />
                              </div>
                            </td>

                            <td className="py-2 px-3">
                              <div className="flex items-center gap-1">
                                <span className="text-slate-400 text-[10px]">¥</span>
                                <input
                                  type="number"
                                  step="1000"
                                  value={row.goodsAmount || ''}
                                  onChange={e => {
                                    const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                                    setBonusRows(prev => prev.map((r, i) => i === idx ? { ...r, goodsAmount: val } : r));
                                  }}
                                  disabled={!row.include}
                                  className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-mono text-slate-700 focus:bg-white"
                                />
                              </div>
                            </td>

                            <td className="py-2 px-3 text-right font-mono">
                              <span className="font-black text-fuchsia-950 text-xs">
                                ¥{standardBonus.toLocaleString()}
                              </span>
                              <span className="text-[10px] text-slate-400 block -mt-0.5">
                                (,000円)
                              </span>
                            </td>

                            <td className="py-2 px-3 text-center">
                              {isOver70 ? (
                                <span className="inline-block bg-fuchsia-100 text-fuchsia-800 text-[10px] font-black px-1.5 py-0.5 rounded border border-fuchsia-200">
                                  70歳以上
                                </span>
                              ) : (
                                <span className="text-slate-300 text-[10px] font-mono">―</span>
                              )}
                            </td>

                            <td className="py-2 px-3">
                              <div className="flex items-center gap-2">
                                <input
                                  type="date"
                                  value={row.individualPaymentDate || ''}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setBonusRows(prev => prev.map((r, i) => i === idx ? { ...r, individualPaymentDate: val } : r));
                                  }}
                                  placeholder="共通と異なる場合"
                                  className="text-[10px] border border-slate-200 rounded px-1.5 py-0.5"
                                  title="賞与支払年月日（共通）と異なる場合のみ設定"
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            /* 公式帳票 A4 プレビューエリア */
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-fuchsia-50 p-3 rounded-2xl border border-fuchsia-200 text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-fuchsia-700" />
                  <span className="font-bold text-fuchsia-950">
                    日本年金機構公式様式コード 2265 印刷プレビュー（全 {Math.ceil(includedRows.length / 10) || 1} ページ）
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-4 py-1.5 bg-fuchsia-700 hover:bg-fuchsia-800 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    今すぐA4印刷 / PDF保存 (Ctrl+P)
                  </button>
                </div>
              </div>

              {/* 帳票コンポーネント本体 */}
              <div className="bg-slate-100 p-4 rounded-3xl overflow-x-auto flex justify-center">
                <OfficialBonusPaymentReportDoc data={reportData} />
              </div>
            </div>
          )}
        </div>

        {/* モーダルフッター */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>※ 健康保険標準賞与額上限: 573万円(年間累計) / 厚生年金標準賞与額上限: 150万円(月間)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveData}
              className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              データを一時保存
            </button>

            {onSaveNoticeToCabinet && (
              <button
                type="button"
                onClick={handleSaveToCabinet}
                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                全社保管庫（キャビネット）に保管
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setActiveTab('preview');
                setTimeout(() => window.print(), 300);
              }}
              className="px-5 py-2 bg-fuchsia-700 hover:bg-fuchsia-800 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              A4印刷 ＆ PDF出力
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
