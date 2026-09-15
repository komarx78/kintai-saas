import React, { useState, useMemo, useEffect } from 'react';
import { 
  Printer, ArrowLeft, Search, Calendar, 
  RotateCcw, UserCheck, Users 
} from 'lucide-react';
import { OfficialSeparationCertificateDoc } from './OfficialSeparationCertificateDoc';
import { OfficialEmploymentAcquisitionDoc } from './OfficialEmploymentAcquisitionDoc';
import { OfficialEmploymentLossDoc } from './OfficialEmploymentLossDoc';

export interface EmploymentInsuranceEmployee {
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
  contract_type?: string;
  retirement_reason?: string;
}

export interface OfficialEmploymentInsuranceDocProps {
  initialType?: 'acquisition' | 'loss' | 'separation'; // separation: 離職証明書(離職票)
  companyInfo: {
    name: string;
    address: string;
    representative_name: string;
    phone_number: string;
    corporate_number?: string;
    company_seal_url?: string;
  };
  officeNumber?: string; // 労働保険・雇用保険適用事業所番号 (例: 2501-123456-7)
  employees: EmploymentInsuranceEmployee[];
  selectedEmployeeId: string;
  onSelectEmployee: (id: string) => void;
  onBack: () => void;
}

export const OfficialEmploymentInsuranceDoc: React.FC<OfficialEmploymentInsuranceDocProps> = ({
  initialType = 'separation',
  companyInfo,
  officeNumber = '2501-123456-7',
  employees,
  selectedEmployeeId,
  onSelectEmployee,
  onBack
}) => {
  const [docType, setDocType] = useState<'acquisition' | 'loss' | 'separation'>(initialType);
  
  // 🔍 検索・フィルタリングState
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [selectedRetirementMonth, setSelectedRetirementMonth] = useState<string>('all');
  // 喪失届・離職票はデフォルトで退職者のみ、取得届は全員（在職・新入社優先）
  const [onlyRetired, setOnlyRetired] = useState<boolean>(initialType !== 'acquisition');

  // 書式タブ切り替え時に適切な退職者フィルタ状態へ自動適応
  const handleTabChange = (type: 'acquisition' | 'loss' | 'separation') => {
    setDocType(type);
    if (type === 'acquisition') {
      setOnlyRetired(false);
    } else {
      setOnlyRetired(true);
    }
  };

  // 全従業員中の退職者総数カウント
  const retiredCount = useMemo(() => {
    return employees.filter(e => !!e.retirement_date && e.retirement_date.trim() !== '').length;
  }, [employees]);

  // 従業員データから退職年月（YYYY-MM）の一覧を重複排除して降順ソート
  const retirementMonths = useMemo(() => {
    const monthSet = new Set<string>();
    employees.forEach(emp => {
      if (emp.retirement_date) {
        const ym = emp.retirement_date.slice(0, 7);
        if (ym.match(/^\d{4}-\d{2}$/)) {
          monthSet.add(ym);
        }
      }
    });
    return Array.from(monthSet).sort().reverse();
  }, [employees]);

  // 🎯 フィルタリング＆ソートされた従業員リスト
  const filteredEmployees = useMemo(() => {
    let list = [...employees];

    // 1. 退職者フィルタ（喪失届・離職票の時は退職手続き済みのみ）
    if (onlyRetired) {
      list = list.filter(emp => !!emp.retirement_date && emp.retirement_date.trim() !== '');
    }

    // 2. 退職月絞り込み
    if (selectedRetirementMonth !== 'all') {
      list = list.filter(emp => emp.retirement_date && emp.retirement_date.startsWith(selectedRetirementMonth));
    }

    // 3. 社員名・カナのインクリメンタル検索
    if (searchKeyword.trim()) {
      const q = searchKeyword.trim().toLowerCase();
      list = list.filter(emp => {
        const name = (emp.name || '').toLowerCase();
        const kana = (emp.name_kana || '').toLowerCase();
        return name.includes(q) || kana.includes(q);
      });
    }

    // 4. ソート順（取得届は入社日降順、喪失届・離職票は退職日降順）
    if (docType === 'acquisition') {
      list.sort((a, b) => (b.join_date || '').localeCompare(a.join_date || ''));
    } else {
      list.sort((a, b) => (b.retirement_date || '').localeCompare(a.retirement_date || ''));
    }

    return list;
  }, [employees, onlyRetired, selectedRetirementMonth, searchKeyword, docType]);

  // 現在選択中の従業員を安全に決定
  const currentEmployee = useMemo(() => {
    if (filteredEmployees.length > 0) {
      return filteredEmployees.find(e => e.id === selectedEmployeeId) || filteredEmployees[0];
    }
    return employees.find(e => e.id === selectedEmployeeId) || employees[0];
  }, [filteredEmployees, selectedEmployeeId, employees]);

  // 絞り込み等で選択対象が外れた場合、自動的にフィルタ後リストの先頭へ連動
  useEffect(() => {
    if (currentEmployee && currentEmployee.id !== selectedEmployeeId) {
      onSelectEmployee(currentEmployee.id);
    }
  }, [currentEmployee?.id, selectedEmployeeId, onSelectEmployee]);

  const handlePrint = () => {
    window.print();
  };

  // 検索条件リセット
  const handleResetFilter = () => {
    setSearchKeyword('');
    setSelectedRetirementMonth('all');
    if (docType === 'acquisition') {
      setOnlyRetired(false);
    } else {
      setOnlyRetired(true);
    }
  };

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

  return (
    <div className="space-y-4 print:space-y-0 print:m-0 print:p-0">
      {/* 画面操作ヘッダー（印刷時は非表示） */}
      <div className="print:hidden bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        {/* 上段: タイトル・タブ切替・印刷ボタン */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-3 border-b border-slate-100">
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
                <span className="text-xs px-2.5 py-0.5 rounded-full font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                  ハローワーク（公共職業安定所）公式様式
                </span>
                <span className="text-xs text-slate-500 font-bold">A4公的届出書（原本直接入力＆自動転記）</span>
              </div>
              <h2 className="text-lg font-black text-slate-800 mt-1">
                雇用保険 {docType === 'acquisition' ? '被保険者資格取得届（公式原本入力＆印刷）' : docType === 'loss' ? '被保険者資格喪失届' : '被保険者離職証明書（離職票）'}
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* 書式種別切替タブ */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => handleTabChange('acquisition')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                  docType === 'acquisition' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                取得届
              </button>
              <button
                onClick={() => handleTabChange('loss')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                  docType === 'loss' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                喪失届
              </button>
              <button
                onClick={() => handleTabChange('separation')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                  docType === 'separation' ? 'bg-white text-amber-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                離職証明書（離職票）
              </button>
            </div>

            {/* 印刷ボタン */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-black shadow-xs transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              公式A4印刷 / PDF保存
            </button>
          </div>
        </div>

        {/* 下段: 🔍 検索・退職月絞り込み・退職者限定・従業員選択ツールバー */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1 text-xs">
          {/* 社員名・カナのインクリメンタル検索 */}
          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="社員名・カナで検索..."
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
            />
          </div>

          {/* 退職年月絞り込みドロップダウン */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[11px] font-bold text-slate-500">退職月:</span>
            <select
              value={selectedRetirementMonth}
              onChange={(e) => setSelectedRetirementMonth(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 outline-hidden cursor-pointer"
            >
              <option value="all">すべての退職月</option>
              {retirementMonths.map(ym => (
                <option key={ym} value={ym}>
                  {ym.replace('-', '年')}月退職
                </option>
              ))}
            </select>
          </div>

          {/* 退職手続き済みのみトグル */}
          <label className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-xl px-3 py-2 cursor-pointer select-none transition">
            <input
              type="checkbox"
              checked={onlyRetired}
              onChange={(e) => setOnlyRetired(e.target.checked)}
              className="w-3.5 h-3.5 text-emerald-600 rounded-sm focus:ring-emerald-500 border-slate-300 cursor-pointer"
            />
            <span className="font-black text-slate-700 text-xs flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
              退職者のみ表示
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full font-bold">
                {retiredCount}名
              </span>
            </span>
          </label>

          {/* 検索・絞り込み条件リセット */}
          {(searchKeyword || selectedRetirementMonth !== 'all' || (docType === 'acquisition' && onlyRetired) || (docType !== 'acquisition' && !onlyRetired)) && (
            <button
              onClick={handleResetFilter}
              className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition cursor-pointer"
              title="絞り込み条件をリセット"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          {/* 従業員選択ドロップダウン（フィルタ後件数表示付き） */}
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              対象者:
            </span>
            <select
              value={currentEmployee.id}
              onChange={(e) => onSelectEmployee(e.target.value)}
              className="bg-white border-2 border-emerald-500 text-slate-900 text-xs font-black rounded-xl px-3 py-2 outline-hidden shadow-2xs cursor-pointer max-w-[280px] truncate"
            >
              {filteredEmployees.length === 0 ? (
                <option value="">該当する従業員なし</option>
              ) : (
                filteredEmployees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} {emp.retirement_date ? `(${emp.retirement_date}退職)` : `(${emp.join_date}入社)`}
                  </option>
                ))
              )}
            </select>
            <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
              ({filteredEmployees.length} / {employees.length}名)
            </span>
          </div>
        </div>
      </div>

      {/* 離職票、資格取得届、資格喪失届の完全分離 */}
      {docType === 'separation' ? (
        <OfficialSeparationCertificateDoc
          companyInfo={companyInfo}
          officeNumber={officeNumber}
          employees={(filteredEmployees.length > 0 ? filteredEmployees : employees) as any}
          selectedEmployeeId={currentEmployee.id}
          onSelectEmployee={onSelectEmployee}
          onBack={onBack}
          hideHeader={true}
        />
      ) : docType === 'acquisition' ? (
        <OfficialEmploymentAcquisitionDoc
          companyInfo={companyInfo}
          officeNumber={officeNumber}
          employees={(filteredEmployees.length > 0 ? filteredEmployees : employees) as any}
          selectedEmployeeId={currentEmployee.id}
          onSelectEmployee={onSelectEmployee}
          onBack={onBack}
          hideHeader={true}
        />
      ) : (
        <OfficialEmploymentLossDoc
          companyInfo={companyInfo}
          officeNumber={officeNumber}
          employees={(filteredEmployees.length > 0 ? filteredEmployees : employees) as any}
          selectedEmployeeId={currentEmployee.id}
          onSelectEmployee={onSelectEmployee}
          onBack={onBack}
          hideHeader={true}
        />
      )}
    </div>
  );
};
