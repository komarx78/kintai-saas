import { useMemo } from 'react';

export interface SpouseDeductionDocData {
  year?: number;
  companyName: string;
  companyAddress: string;
  corporateNumber?: string;
  taxOfficeName?: string;
  employeeName: string;
  employeeNameKana?: string;
  employeeAddress: string;
  employeeMyNumber?: string;
  employeeIncomeEstimate?: number; // 本人の所得見積額
  hasSpouse: boolean;
  spouseName?: string;
  spouseNameKana?: string;
  spouseBirthDate?: string;
  spouseIncomeEstimate?: number; // 配偶者の所得見積額
  spouseAddress?: string;
  spouseMyNumber?: string;
  appliedDate?: string;
}

export default function OfficialSpouseDeductionDoc({ data }: { data: SpouseDeductionDocData }) {
  const year = data.year || 2026;
  const spIncome = data.spouseIncomeEstimate || 0;
  const empIncome = data.employeeIncomeEstimate || 3500000;

  // 1. 本人の区分判定（A: 900万以下, B: 900万超950万以下, C: 950万超1000万以下）
  const empCategory = useMemo(() => {
    if (empIncome <= 9000000) return { label: 'A (900万円以下)', code: 'A' };
    if (empIncome <= 9500000) return { label: 'B (900万円超950万円以下)', code: 'B' };
    if (empIncome <= 10000000) return { label: 'C (950万円超1000万円以下)', code: 'C' };
    return { label: '対象外 (1000万円超)', code: 'OUT' };
  }, [empIncome]);

  // 2. 配偶者の所得区分・控除額判定
  const spouseDeductionResult = useMemo(() => {
    if (!data.hasSpouse || !data.spouseName) {
      return {
        type: 'なし',
        bracket: '対象外',
        deductionAmount: 0,
        explanation: '配偶者なし、または未申告です。'
      };
    }

    if (empCategory.code === 'OUT') {
      return {
        type: '適用なし',
        bracket: '本人の所得上限超過',
        deductionAmount: 0,
        explanation: '申告者本人の合計所得金額が1,000万円（年収1,195万円）を超えるため、配偶者控除・特別控除は適用できません。'
      };
    }

    if (spIncome <= 480000) {
      return {
        type: '配偶者控除',
        bracket: '① 48万円以下（給与年収103万円以下）',
        deductionAmount: empCategory.code === 'A' ? 380000 : (empCategory.code === 'B' ? 260000 : 130000),
        explanation: '一般の配偶者控除が満額適用されます（毎月の源泉控除申告書A欄と連動）。'
      };
    }

    if (spIncome <= 950000) {
      return {
        type: '配偶者特別控除（満額）',
        bracket: '② 48万円超〜95万円以下（給与年収150万円以下）',
        deductionAmount: empCategory.code === 'A' ? 380000 : (empCategory.code === 'B' ? 260000 : 130000),
        explanation: '源泉控除対象配偶者として、配偶者特別控除の最高額（38万円）が満額適用されます。'
      };
    }

    if (spIncome <= 1000000) {
      return {
        type: '配偶者特別控除',
        bracket: '③ 95万円超〜100万円以下（年収155万円以下）',
        deductionAmount: empCategory.code === 'A' ? 380000 : (empCategory.code === 'B' ? 260000 : 130000),
        explanation: '配偶者特別控除が適用されます（年末調整時に本申告書で精算）。'
      };
    }

    if (spIncome <= 1050000) {
      return {
        type: '配偶者特別控除',
        bracket: '④ 100万円超〜105万円以下（年収160万円以下）',
        deductionAmount: empCategory.code === 'A' ? 360000 : (empCategory.code === 'B' ? 240000 : 120000),
        explanation: '配偶者特別控除（36万円）が適用されます。'
      };
    }

    if (spIncome <= 1100000) {
      return {
        type: '配偶者特別控除',
        bracket: '⑤ 105万円超〜110万円以下（年収166.7万円以下）',
        deductionAmount: empCategory.code === 'A' ? 310000 : (empCategory.code === 'B' ? 210000 : 110000),
        explanation: '配偶者特別控除（31万円）が適用されます。'
      };
    }

    if (spIncome <= 1150000) {
      return {
        type: '配偶者特別控除',
        bracket: '⑥ 110万円超〜115万円以下（年収175万円以下）',
        deductionAmount: empCategory.code === 'A' ? 260000 : (empCategory.code === 'B' ? 180000 : 90000),
        explanation: '配偶者特別控除（26万円）が適用されます。'
      };
    }

    if (spIncome <= 1200000) {
      return {
        type: '配偶者特別控除',
        bracket: '⑦ 115万円超〜120万円以下（年収183.3万円以下）',
        deductionAmount: empCategory.code === 'A' ? 210000 : (empCategory.code === 'B' ? 140000 : 70000),
        explanation: '配偶者特別控除（21万円）が適用されます。'
      };
    }

    if (spIncome <= 1250000) {
      return {
        type: '配偶者特別控除',
        bracket: '⑧ 120万円超〜125万円以下（年収190万円以下）',
        deductionAmount: empCategory.code === 'A' ? 160000 : (empCategory.code === 'B' ? 110000 : 60000),
        explanation: '配偶者特別控除（16万円）が適用されます。'
      };
    }

    if (spIncome <= 1300000) {
      return {
        type: '配偶者特別控除',
        bracket: '⑨ 125万円超〜130万円以下（年収196.7万円以下）',
        deductionAmount: empCategory.code === 'A' ? 110000 : (empCategory.code === 'B' ? 80000 : 40000),
        explanation: '配偶者特別控除（11万円）が適用されます。'
      };
    }

    if (spIncome <= 1330000) {
      return {
        type: '配偶者特別控除',
        bracket: '⑩ 130万円超〜133万円以下（年収201.6万円未満）',
        deductionAmount: empCategory.code === 'A' ? 30000 : (empCategory.code === 'B' ? 20000 : 10000),
        explanation: '配偶者特別控除（3万円）が適用されます。'
      };
    }

    return {
      type: '控除対象外',
      bracket: '⑪ 133万円超（給与年収201.6万円超）',
      deductionAmount: 0,
      explanation: '配偶者の所得が133万円（年収201.6万円）を超えるため、配偶者控除・配偶者特別控除ともに受けられません。'
    };
  }, [data.hasSpouse, data.spouseName, spIncome, empCategory]);

  return (
    <div className="bg-white text-slate-900 font-sans p-8 max-w-[800px] mx-auto border border-slate-300 rounded-xl shadow-lg print:border-none print:shadow-none print:p-0 print:m-0 text-xs">
      {/* 標題 */}
      <div className="text-center border-b-2 border-slate-900 pb-3 mb-4">
        <h2 className="text-lg font-black tracking-wider text-slate-900">
          令和{year - 2018}年分 給与所得者の配偶者控除等申告書
        </h2>
        <p className="text-[11px] text-slate-600 mt-0.5">
          兼 給与所得者の基礎控除申告書 兼 所得金額調整控除申告書
        </p>
      </div>

      {/* 会社・申告者 ヘッダー */}
      <div className="grid grid-cols-2 gap-4 border border-slate-400 p-3 rounded-lg mb-4 bg-slate-50/50">
        <div className="space-y-1">
          <div className="text-[10px] text-slate-500 font-bold">給与の支払者（会社）</div>
          <div className="font-bold text-sm text-slate-900">{data.companyName}</div>
          <div className="text-[11px] text-slate-600">{data.companyAddress}</div>
          {data.corporateNumber && <div className="text-[10px] text-slate-500 font-mono">法人番号: {data.corporateNumber}</div>}
        </div>
        <div className="space-y-1 border-l border-slate-300 pl-4">
          <div className="text-[10px] text-slate-500 font-bold">給与所得者（本人）</div>
          <div className="font-black text-sm text-slate-900">{data.employeeName} 殿</div>
          <div className="text-[11px] text-slate-600">{data.employeeAddress}</div>
          <div className="text-[10px] text-slate-500">本人の合計所得見積額: <b className="text-slate-900 font-mono">¥{empIncome.toLocaleString()}</b> (区分: {empCategory.code})</div>
        </div>
      </div>

      {/* 🌟 判定結果サマリーカード */}
      <div className={`p-4 rounded-xl border mb-4 ${
        spouseDeductionResult.deductionAmount > 0 
          ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950' 
          : 'bg-slate-100 border-slate-300 text-slate-800'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <span className="font-black text-sm flex items-center gap-1.5">
            {spouseDeductionResult.deductionAmount > 0 ? '✨ 配偶者控除・特別控除の判定結果' : 'ℹ️ 配偶者控除・特別控除の判定結果'}
          </span>
          <span className={`text-xs px-3 py-1 rounded-full font-bold border ${
            spouseDeductionResult.deductionAmount > 0 
              ? 'bg-emerald-600 text-white border-emerald-700' 
              : 'bg-slate-500 text-white border-slate-600'
          }`}>
            {spouseDeductionResult.type}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          <div className="bg-white/80 p-2 rounded-lg border border-slate-200">
            <span className="text-slate-500 block text-[10px]">所得区分</span>
            <span className="font-bold">{spouseDeductionResult.bracket}</span>
          </div>
          <div className="bg-white/80 p-2 rounded-lg border border-slate-200">
            <span className="text-slate-500 block text-[10px]">配偶者控除額（年末調整）</span>
            <span className="font-black text-indigo-700 text-sm font-mono">
              ¥{spouseDeductionResult.deductionAmount.toLocaleString()}
            </span>
          </div>
          <div className="bg-white/80 p-2 rounded-lg border border-slate-200 sm:col-span-1 col-span-2">
            <span className="text-slate-500 block text-[10px]">適用判定</span>
            <span className="font-bold text-[11px]">{spouseDeductionResult.explanation}</span>
          </div>
        </div>
      </div>

      {/* 配偶者明細フォーム（公式様式レイアウト） */}
      <div className="border border-slate-400 rounded-lg overflow-hidden mb-4">
        <div className="bg-slate-800 text-white font-bold px-3 py-1.5 text-xs flex justify-between items-center">
          <span>配偶者（特別）控除申告書 明細欄</span>
          <span className="text-[10px] text-slate-300 font-normal">国税庁 申告書式準拠</span>
        </div>
        
        <table className="w-full border-collapse text-xs">
          <tbody>
            <tr className="border-b border-slate-300">
              <th className="bg-slate-100 p-2.5 text-left w-1/4 font-bold border-r border-slate-300">配偶者の氏名（フリガナ）</th>
              <td className="p-2.5 font-bold text-slate-900">
                {data.spouseName || '未登録'}
                {data.spouseNameKana && <span className="text-slate-500 font-normal ml-2">({data.spouseNameKana})</span>}
              </td>
            </tr>
            <tr className="border-b border-slate-300">
              <th className="bg-slate-100 p-2.5 text-left font-bold border-r border-slate-300">配偶者の生年月日</th>
              <td className="p-2.5 font-bold font-mono">
                {data.spouseBirthDate || '未登録'}
              </td>
            </tr>
            <tr className="border-b border-slate-300">
              <th className="bg-slate-100 p-2.5 text-left font-bold border-r border-slate-300">本年中の所得の見積額</th>
              <td className="p-2.5 font-black font-mono text-sm text-indigo-800">
                ¥{spIncome.toLocaleString()}
                <span className="text-[10px] text-slate-500 font-normal ml-2">
                  (給与収入換算: 約 ¥{(spIncome > 0 ? (spIncome <= 550000 ? spIncome + 550000 : (spIncome <= 1800000 ? Math.round((spIncome + 100000) / 0.7) : spIncome + 1600000)) : 0).toLocaleString()})
                </span>
              </td>
            </tr>
            <tr className="border-b border-slate-300">
              <th className="bg-slate-100 p-2.5 text-left font-bold border-r border-slate-300">配偶者の住所又は居所</th>
              <td className="p-2.5 text-slate-700">
                {data.spouseAddress || data.employeeAddress || '同上（同居）'}
              </td>
            </tr>
            <tr>
              <th className="bg-slate-100 p-2.5 text-left font-bold border-r border-slate-300">控除額の計算根拠</th>
              <td className="p-2.5 text-slate-700 leading-relaxed">
                あなたの本年中の合計所得金額の見積額（{empCategory.code}区分）と、配偶者の本年中の合計所得金額の見積額（¥{spIncome.toLocaleString()}）に基づき、国税庁の控除額早見表により算出。
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* フッター署名欄 */}
      <div className="border-t border-slate-300 pt-3 flex justify-between items-center text-[10px] text-slate-500">
        <div>※ 年末調整時に本申告書により所得税および復興特別所得税の控除が確定されます。</div>
        <div>作成日: {data.appliedDate || new Date().toISOString().split('T')[0]}</div>
      </div>
    </div>
  );
}
