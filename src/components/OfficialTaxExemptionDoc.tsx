import React, { useState } from 'react';

interface DependentItem {
  name: string;
  nameKana?: string;
  myNumber?: string;
  relation: string;
  birthDate: string;
  isLivingTogether?: boolean;
  incomeEstimate?: number;
  isUnder16?: boolean;
  isSpecific?: boolean;
  isElderly?: boolean;
  isNonResident?: boolean;
  nonResidentReason?: '16_30_70' | 'study_abroad' | 'disabled' | 'payment_380k';
  livingTogetherFact?: string;
  address?: string;
  changeDateReason?: string;
}

interface TaxExemptionDocProps {
  data: {
    year?: number;
    companyName: string;
    companyAddress?: string;
    corporateNumber?: string;
    taxOfficeName?: string;
    municipalityName?: string;
    employeeName: string;
    employeeNameKana?: string;
    employeeAddress: string;
    postalCode?: string;
    myNumber?: string;
    birthDate?: string;
    householderName?: string;
    householderRelation?: string;
    hasSpouse?: boolean;
    spouseName?: string;
    spouseNameKana?: string;
    spouseMyNumber?: string;
    spouseBirthDate?: string;
    spouseIncomeEstimate?: number;
    spouseIsLivingTogether?: boolean;
    spouseIsNonResident?: boolean;
    spouseAddress?: string;
    spouseChangeDateReason?: string;
    dependents?: DependentItem[];
    // C. 障害者、寡婦、ひとり親又は勤労学生
    isDisability?: boolean;
    disabilityType?: 'general' | 'special' | 'living_special';
    disabilityTarget?: 'self' | 'spouse' | 'dependent';
    disabilityCount?: number;
    isWidow?: boolean;
    isSingleParent?: boolean;
    isWorkingStudent?: boolean;
    disabilityDetails?: string;
    workingStudentSchool?: string;
    // D. 他の所得者が控除を受ける扶養親族等
    otherTaxPayerDependents?: Array<{
      dependentName: string;
      relation: string;
      birthDate: string;
      address: string;
      otherTaxPayerName: string;
      otherTaxPayerRelation: string;
      otherTaxPayerAddress: string;
      changeDateReason?: string;
    }>;
    // 住民税: 退職手当等を有する配偶者・扶養親族
    retirementDependents?: Array<{
      name: string;
      nameKana?: string;
      myNumber?: string;
      relation: string;
      birthDate: string;
      address: string;
      incomeEstimate?: number;
      isDisability?: boolean;
      changeDateReason?: string;
    }>;
    appliedDate: string;
    isSecondarySalary?: boolean; // 従たる給与の提出フラグ
  };
}

/**
 * 西暦日付（YYYY-MM-DD 等）を国税庁様式の和暦（元号・年・月・日）に分解
 */
function parseJapaneseEraDate(dateStr?: string): { era: string; year: string; month: string; day: string } {
  if (!dateStr) return { era: '令', year: ' ', month: ' ', day: ' ' };
  
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    // 文字列から直接パース試行
    const parts = dateStr.replace(/[^0-9]/g, ' ').trim().split(/\s+/);
    if (parts.length >= 3) {
      const y = parseInt(parts[0], 10);
      const m = parts[1];
      const day = parts[2];
      if (y >= 2019) return { era: '令', year: String(y - 2018), month: m, day };
      if (y >= 1989) return { era: '平', year: String(y - 1988), month: m, day };
      if (y >= 1926) return { era: '昭', year: String(y - 1925), month: m, day };
    }
    return { era: '令', year: ' ', month: ' ', day: ' ' };
  }

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1);
  const day = String(d.getDate());

  if (y >= 2019) return { era: '令', year: String(y - 2018 === 1 ? '元' : y - 2018), month: m, day };
  if (y >= 1989) return { era: '平', year: String(y - 1988 === 1 ? '元' : y - 1988), month: m, day };
  if (y >= 1926) return { era: '昭', year: String(y - 1925 === 1 ? '元' : y - 1925), month: m, day };
  if (y >= 1912) return { era: '大', year: String(y - 1911 === 1 ? '元' : y - 1911), month: m, day };
  return { era: '明', year: String(y - 1867), month: m, day };
}

export const OfficialTaxExemptionDoc: React.FC<TaxExemptionDocProps> = ({ data }) => {
  const [activePage, setActivePage] = useState<'front' | 'back'>('front');
  const year = data.year || 2026;
  const reiwaYear = year - 2018;

  const under16Dependents = (data.dependents || []).filter(d => d.isUnder16);
  const regularDependents = (data.dependents || []).filter(d => !d.isUnder16);

  // B欄: 4行分の枠を確保
  const bRows: Array<DependentItem | null> = [...regularDependents.slice(0, 4)];
  while (bRows.length < 4) {
    bRows.push(null);
  }

  // 住民税16歳未満: 2行分の枠を確保
  const u16Rows: Array<DependentItem | null> = [...under16Dependents.slice(0, 2)];
  while (u16Rows.length < 2) {
    u16Rows.push(null);
  }

  const empBirth = parseJapaneseEraDate(data.birthDate);
  const spouseBirth = parseJapaneseEraDate(data.spouseBirthDate);

  return (
    <div className="w-full bg-slate-100 py-4 print:bg-white print:py-0 select-text">
      {/* 印刷用CSSスタイル（国税庁 A4横向き印刷に完全準拠） */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 4mm 5mm;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          .tax-doc-container {
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            width: 100% !important;
            max-width: none !important;
          }
        }
      `}</style>

      {/* 画面プレビュー時の表面・裏面切り替えタブ */}
      <div className="max-w-[1060px] mx-auto mb-3 flex items-center justify-between no-print px-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActivePage('front')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer ${
              activePage === 'front'
                ? 'bg-indigo-600 text-white shadow-indigo-200'
                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            表面（申告書 本紙・令和{reiwaYear}年分 国税庁様式 2026bun_01）
          </button>
          <button
            type="button"
            onClick={() => setActivePage('back')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer ${
              activePage === 'back'
                ? 'bg-indigo-600 text-white shadow-indigo-200'
                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            裏面（記載についてのご注意・扶養親族等の範囲）
          </button>
        </div>
        <div className="text-[11px] text-slate-500 font-bold flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          国税庁公式様式（2026bun_01）完全再現モード
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════════════ */}
      {/* 📄 表面（申告書 本紙） */}
      {/* ══════════════════════════════════════════════════════════════════════════════════ */}
      {activePage === 'front' && (
        <div className="tax-doc-container bg-white text-black max-w-[1060px] mx-auto p-4 border border-slate-300 shadow-xl print:shadow-none print:border-none print:p-0 font-serif leading-tight text-[9px]">
          
          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {/* ① タイトル・ヘッダー枠 */}
          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <div className="relative mb-1">
            <div className="text-center pb-1">
              <h1 className="text-lg font-black tracking-widest inline-block border-b-2 border-black pb-0.5 px-4 font-sans">
                令和{reiwaYear}年分　給与所得者の扶養控除等（異動）申告書
              </h1>
            </div>
            {/* 右上「扶」丸印 */}
            <div className="absolute right-0 top-0 w-8 h-8 rounded-full border-2 border-black flex items-center justify-center font-black text-base font-sans">
              扶
            </div>
          </div>

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {/* ② 給与支払者 ＆ 申告者本人 情報ヘッダーグリッド */}
          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <div className="border border-black grid grid-cols-12 mb-1 text-[8.5px]">
            {/* 左側：所轄税務署長等 */}
            <div className="col-span-2 border-r border-black flex flex-col justify-between p-1 bg-slate-50/50">
              <div className="border-b border-black pb-1">
                <div className="text-[7.5px] text-slate-600">所轄税務署長等</div>
                <div className="font-bold text-right pt-1">{data.taxOfficeName || '　　'} 税務署長</div>
              </div>
              <div className="pt-1">
                <div className="text-[7.5px] text-slate-600">市区町村長</div>
                <div className="font-bold text-right pt-0.5">{data.municipalityName || '　　'} 市区町村長</div>
              </div>
            </div>

            {/* 中左：給与の支払者（会社） */}
            <div className="col-span-4 border-r border-black p-1 space-y-1">
              <div className="text-[7px] text-slate-500 italic">※この申告書の提出を受けた給与の支払者が記載してください。</div>
              <div className="grid grid-cols-12 gap-1 items-center">
                <span className="col-span-4 text-[8px] text-slate-700">給与の支払者の名称（氏名）</span>
                <span className="col-span-8 font-bold text-xs truncate">{data.companyName}</span>
              </div>
              <div className="grid grid-cols-12 gap-1 items-center">
                <span className="col-span-4 text-[8px] text-slate-700">給与の支払者の法人（個人）番号</span>
                <span className="col-span-8 font-mono font-bold tracking-wider">{data.corporateNumber || '―'}</span>
              </div>
              <div className="grid grid-cols-12 gap-1 items-center">
                <span className="col-span-4 text-[8px] text-slate-700">給与の支払者の所在地（住所）</span>
                <span className="col-span-8 text-[8px] truncate">{data.companyAddress || '本社所在地'}</span>
              </div>
            </div>

            {/* 中右：あなたの情報（氏名・個人番号・住所） */}
            <div className="col-span-4 border-r border-black p-1 space-y-1">
              <div>
                <div className="text-[7.5px] text-slate-500">（フリガナ）{data.employeeNameKana || '　'}</div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[8px] text-slate-700">あなたの氏名</span>
                  <span className="font-black text-sm pr-4 font-sans">{data.employeeName}</span>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-0.5">
                <span className="text-[8px] text-slate-700">あなたの個人番号</span>
                <span className="font-mono tracking-widest font-bold text-[9px] pr-2">
                  {data.myNumber ? data.myNumber.slice(0, 12) : '届出済（会社保管）'}
                </span>
              </div>
              <div className="border-t border-slate-200 pt-0.5">
                <div className="text-[7.5px] text-slate-500">あなたの住所又は居所（郵便番号 〒 {data.postalCode || '　　-　　'}）</div>
                <div className="font-bold truncate text-[8.5px]">{data.employeeAddress}</div>
              </div>
            </div>

            {/* 右側：生年月日・世帯主・配偶者・従たる給与 */}
            <div className="col-span-2 p-1 flex flex-col justify-between bg-slate-50/30">
              <div className="space-y-0.5 text-[8px]">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">生年月日</span>
                  <span className="font-bold">{empBirth.era}{empBirth.year}年{empBirth.month}月{empBirth.day}日</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-200 pt-0.5">
                  <span className="text-slate-600">世帯主の氏名</span>
                  <span className="font-bold truncate max-w-[70px]">{data.householderName || data.employeeName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">あなたとの続柄</span>
                  <span className="font-bold">{data.householderRelation || '本人'}</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-200 pt-0.5">
                  <span className="text-slate-600">配偶者の有無</span>
                  <span className="font-bold font-sans">{data.hasSpouse ? '【 有 】' : '【 無 】'}</span>
                </div>
              </div>

              <div className="border-t border-black pt-1 text-[7px] text-center text-slate-600">
                従たる給与の提出: {data.isSecondarySalary ? '【 ○ 提出あり 】' : '【 提出なし 】'}
              </div>
            </div>
          </div>

          {/* 注意書きバー */}
          <div className="text-[7px] text-slate-600 px-1 mb-1 leading-tight">
            以下の各欄に記載する親族がなく、かつ、あなた自身が障害者、寡婦、ひとり親又は勤労学生のいずれにも該当しない場合には、上記の各欄を記載して給与の支払者に提出してください。
          </div>

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {/* ③ 主たる給与から控除を受ける（A配偶者・B扶養親族・C障害者等・D他の所得者） */}
          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <div className="border border-black flex mb-1">
            {/* 左側：縦書き見出し */}
            <div className="w-5 border-r border-black bg-slate-100 flex items-center justify-center p-1 text-center font-bold text-[8px] leading-snug">
              主たる給与から控除を受ける
            </div>

            {/* 右側：各控除テーブル */}
            <div className="flex-1">
              
              {/* ───────────────────────────────────────────────────────────── */}
              {/* A. 源泉控除対象配偶者 */}
              {/* ───────────────────────────────────────────────────────────── */}
              <table className="w-full border-collapse text-[8px]">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-black text-center text-[7.5px]">
                    <th className="border-r border-black w-8 py-0.5">区分等</th>
                    <th className="border-r border-black w-28 py-0.5">（フリガナ）<br />氏　　名</th>
                    <th className="border-r border-black w-24 py-0.5">個　人　番　号</th>
                    <th className="border-r border-black w-14 py-0.5">あなたとの<br />続　柄</th>
                    <th className="border-r border-black w-24 py-0.5">生　年　月　日</th>
                    <th className="border-r border-black w-20 py-0.5">令和８年中の<br />所得の見積額</th>
                    <th className="border-r border-black w-14 py-0.5">非居住者である親族</th>
                    <th className="border-r border-black py-0.5">生計を一にする事実</th>
                    <th className="border-r border-black w-36 py-0.5">住　所　又　は　居　所</th>
                    <th className="w-16 py-0.5">異動月日及び事由</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="h-7 border-b border-black">
                    <td className="border-r border-black text-center font-bold bg-slate-50">
                      Ａ<br /><span className="text-[6.5px] font-normal leading-none">源泉控除対象配偶者</span>
                    </td>
                    <td className="border-r border-black px-1">
                      {data.hasSpouse && data.spouseName ? (
                        <div>
                          <div className="text-[6.5px] text-slate-500">（{data.spouseNameKana || '　'}）</div>
                          <div className="font-bold text-[9px]">{data.spouseName}</div>
                        </div>
                      ) : <span className="text-slate-300">―</span>}
                    </td>
                    <td className="border-r border-black text-center font-mono text-[8px]">
                      {data.hasSpouse ? (data.spouseMyNumber ? data.spouseMyNumber : '************') : '―'}
                    </td>
                    <td className="border-r border-black text-center font-bold">
                      {data.hasSpouse ? '妻' : '―'}
                    </td>
                    <td className="border-r border-black text-center text-[7.5px]">
                      {data.hasSpouse && data.spouseBirthDate ? (
                        <span>{spouseBirth.era}{spouseBirth.year}年{spouseBirth.month}月{spouseBirth.day}日</span>
                      ) : '―'}
                    </td>
                    <td className="border-r border-black text-right px-1 font-bold">
                      {data.hasSpouse && data.spouseIncomeEstimate !== undefined ? (
                        <span>{data.spouseIncomeEstimate.toLocaleString()} 円</span>
                      ) : '―'}
                    </td>
                    <td className="border-r border-black text-center">
                      {data.hasSpouse && data.spouseIsNonResident ? '○' : ''}
                    </td>
                    <td className="border-r border-black text-center text-[7px]">
                      {data.hasSpouse ? (data.spouseIsLivingTogether !== false ? '同居' : '別居送金') : ''}
                    </td>
                    <td className="border-r border-black px-1 text-[7.5px] truncate max-w-[140px]">
                      {data.hasSpouse ? (data.spouseAddress || data.employeeAddress) : ''}
                    </td>
                    <td className="text-center text-[7px] text-slate-500">
                      {data.spouseChangeDateReason || ''}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* ───────────────────────────────────────────────────────────── */}
              {/* B. 控除対象扶養親族（16歳以上 / 平23.1.1以前生） */}
              {/* ───────────────────────────────────────────────────────────── */}
              <table className="w-full border-collapse text-[8px]">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-black text-center text-[7.5px]">
                    <th className="border-r border-black w-8 py-0.5">区分等</th>
                    <th className="border-r border-black w-28 py-0.5">（フリガナ）<br />氏　　名</th>
                    <th className="border-r border-black w-24 py-0.5">個　人　番　号</th>
                    <th className="border-r border-black w-14 py-0.5">あなたとの<br />続　柄</th>
                    <th className="border-r border-black w-24 py-0.5">生　年　月　日</th>
                    <th className="border-r border-black w-24 py-0.5">老人扶養親族（昭32.1.1以前生）<br />特定扶養親族・特定親族</th>
                    <th className="border-r border-black w-20 py-0.5">令和８年中の<br />所得の見積額</th>
                    <th className="border-r border-black w-20 py-0.5">非居住者である親族</th>
                    <th className="border-r border-black py-0.5">生計を一にする事実</th>
                    <th className="border-r border-black w-36 py-0.5">住　所　又　は　居　所</th>
                    <th className="w-16 py-0.5">異動月日及び事由</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black">
                  {bRows.map((dep, idx) => {
                    const bDate = dep ? parseJapaneseEraDate(dep.birthDate) : null;
                    return (
                      <tr key={idx} className="h-6">
                        {idx === 0 && (
                          <td rowSpan={4} className="border-r border-black text-center font-bold bg-slate-50 w-8">
                            Ｂ<br /><span className="text-[6.5px] font-normal leading-none">控除対象扶養親族<br />（16歳以上）</span>
                          </td>
                        )}
                        <td className="border-r border-black px-1">
                          {dep ? (
                            <div>
                              <div className="text-[6.5px] text-slate-500">（{dep.nameKana || '　'}）</div>
                              <div className="font-bold text-[8.5px]">{dep.name}</div>
                            </div>
                          ) : ''}
                        </td>
                        <td className="border-r border-black text-center font-mono text-[8px]">
                          {dep ? (dep.myNumber ? dep.myNumber : '************') : ''}
                        </td>
                        <td className="border-r border-black text-center font-bold">
                          {dep?.relation || ''}
                        </td>
                        <td className="border-r border-black text-center text-[7.5px]">
                          {bDate ? `${bDate.era}${bDate.year}年${bDate.month}月${bDate.day}日` : ''}
                        </td>
                        {/* 老人・特定親族チェックボックス */}
                        <td className="border-r border-black px-1 text-[7px] space-y-0.5">
                          <div className="flex items-center gap-1">
                            <span>{dep?.isElderly ? '☑' : '□'} 同居老親等</span>
                            <span>{dep?.isElderly ? '□' : '□'} その他</span>
                          </div>
                          <div className="flex items-center gap-1 border-t border-slate-200 pt-0.2">
                            <span>{dep?.isSpecific ? '☑' : '□'} 特定扶養</span>
                            <span>□ 特定親族</span>
                          </div>
                        </td>
                        <td className="border-r border-black text-right px-1 font-bold">
                          {dep && dep.incomeEstimate !== undefined ? `${dep.incomeEstimate.toLocaleString()} 円` : ''}
                        </td>
                        {/* 非居住者区分 */}
                        <td className="border-r border-black text-[6.5px] px-0.5 leading-tight">
                          <div>{dep?.nonResidentReason === '16_30_70' ? '☑' : '□'} 16-30未満/70以上</div>
                          <div>{dep?.nonResidentReason === 'study_abroad' ? '☑' : '□'} 留学</div>
                          <div>{dep?.nonResidentReason === 'disabled' ? '☑' : '□'} 障害者</div>
                          <div>{dep?.nonResidentReason === 'payment_380k' ? '☑' : '□'} 38万以上支払</div>
                        </td>
                        <td className="border-r border-black text-center text-[7px]">
                          {dep ? (dep.isLivingTogether !== false ? '同居' : (dep.livingTogetherFact || '別居送金')) : ''}
                        </td>
                        <td className="border-r border-black px-1 text-[7.5px] truncate max-w-[140px]">
                          {dep ? (dep.address || data.employeeAddress) : ''}
                        </td>
                        <td className="text-center text-[7px] text-slate-500">
                          {dep?.changeDateReason || ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* ───────────────────────────────────────────────────────────── */}
              {/* C. 障害者、寡婦、ひとり親又は勤労学生 */}
              {/* ───────────────────────────────────────────────────────────── */}
              <div className="border-t border-black grid grid-cols-12 text-[7.5px]">
                <div className="col-span-1 border-r border-black bg-slate-50 flex items-center justify-center font-bold text-center p-1">
                  Ｃ<br />障害者等
                </div>
                
                {/* 区分チェック欄 */}
                <div className="col-span-5 border-r border-black p-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{data.isDisability ? '☑' : '□'} 障害者</span>
                    <span className="font-bold">{data.isWidow ? '☑' : '□'} 寡婦</span>
                    <span className="font-bold">{data.isSingleParent ? '☑' : '□'} ひとり親</span>
                    <span className="font-bold">{data.isWorkingStudent ? '☑' : '□'} 勤労学生</span>
                  </div>
                  <div className="border-t border-slate-200 pt-0.5 text-[6.5px] grid grid-cols-3 gap-0.5">
                    <div>一般障害: 本人({data.isDisability && data.disabilityType === 'general' ? 1 : 0})人</div>
                    <div>特別障害: 本人({data.isDisability && data.disabilityType === 'special' ? 1 : 0})人</div>
                    <div>同居特別: 家族({data.isDisability && data.disabilityType === 'living_special' ? 1 : 0})人</div>
                  </div>
                </div>

                {/* 障害者又は勤労学生の内容 */}
                <div className="col-span-4 border-r border-black p-1">
                  <div className="text-[6.5px] text-slate-500">障害者又は勤労学生の内容</div>
                  <div className="font-bold text-[8px] pt-0.5">
                    {data.disabilityDetails || (data.isWorkingStudent ? `学校名: ${data.workingStudentSchool || '〇〇大学'}` : '該当なし')}
                  </div>
                </div>

                {/* 異動月日及び事由 */}
                <div className="col-span-2 p-1 text-center text-[7px] text-slate-400 flex items-center justify-center">
                  ―
                </div>
              </div>

              {/* ───────────────────────────────────────────────────────────── */}
              {/* D. 他の所得者が控除を受ける扶養親族等 */}
              {/* ───────────────────────────────────────────────────────────── */}
              <div className="border-t border-black grid grid-cols-12 text-[7.5px] bg-slate-50/30">
                <div className="col-span-1 border-r border-black bg-slate-50 flex items-center justify-center font-bold text-center p-1">
                  Ｄ<br />他の所得者
                </div>
                <div className="col-span-11 p-1 text-[7px] flex justify-between items-center text-slate-500">
                  <span>他の所得者が控除を受ける扶養親族等（氏名・続柄・生年月日・住所 / 控除を受ける他の所得者）</span>
                  <span className="font-bold text-slate-700">{data.otherTaxPayerDependents?.length ? `${data.otherTaxPayerDependents.length}名記載あり` : '【 該当なし 】'}</span>
                </div>
              </div>

            </div>
          </div>

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {/* ④ 住民税に関する事項（16歳未満の扶養親族 ＆ 退職手当等を有する配偶者） */}
          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <div className="border border-black mb-1">
            <div className="bg-slate-100 px-1 py-0.5 font-bold text-[8px] border-b border-black flex justify-between items-center">
              <span>○ 住民税に関する事項（地方税法第45条の3の2及び第317条の3の2に基づき市区町村長に提出する申告書を兼ねています）</span>
              <span className="text-[7px] font-normal text-slate-600">※16歳未満の扶養親族 / 退職所得を有する配偶者・扶養親族</span>
            </div>

            {/* 16歳未満の扶養親族（平23.1.2以後生） */}
            <table className="w-full border-collapse text-[7.5px]">
              <thead>
                <tr className="bg-slate-50 border-b border-black text-center text-[7px]">
                  <th className="border-r border-black w-24 py-0.5">区分</th>
                  <th className="border-r border-black w-28 py-0.5">（フリガナ）氏　名</th>
                  <th className="border-r border-black w-24 py-0.5">個　人　番　号</th>
                  <th className="border-r border-black w-14 py-0.5">あなたとの続柄</th>
                  <th className="border-r border-black w-24 py-0.5">生　年　月　日</th>
                  <th className="border-r border-black py-0.5">住　所　又　は　居　所</th>
                  <th className="border-r border-black w-20 py-0.5">控除対象外国外親族</th>
                  <th className="border-r border-black w-20 py-0.5">令和８年中の所得見積額</th>
                  <th className="w-16 py-0.5">異動月日及び事由</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black">
                {u16Rows.map((dep, idx) => {
                  const u16Date = dep ? parseJapaneseEraDate(dep.birthDate) : null;
                  return (
                    <tr key={idx} className="h-5">
                      {idx === 0 && (
                        <td rowSpan={2} className="border-r border-black text-center font-bold bg-slate-50 w-24 text-[7px]">
                          16歳未満の扶養親族<br />（平23.1.2以後生）
                        </td>
                      )}
                      <td className="border-r border-black px-1">
                        {dep ? (
                          <div>
                            <span className="text-[6px] text-slate-500">（{dep.nameKana || '　'}）</span>
                            <span className="font-bold text-[8px] ml-1">{dep.name}</span>
                          </div>
                        ) : ''}
                      </td>
                      <td className="border-r border-black text-center font-mono text-[7.5px]">
                        {dep ? (dep.myNumber ? dep.myNumber : '************') : ''}
                      </td>
                      <td className="border-r border-black text-center font-bold">
                        {dep?.relation || ''}
                      </td>
                      <td className="border-r border-black text-center text-[7px]">
                        {u16Date ? `${u16Date.era}${u16Date.year}年${u16Date.month}月${u16Date.day}日` : ''}
                      </td>
                      <td className="border-r border-black px-1 text-[7px] truncate max-w-[180px]">
                        {dep ? (dep.address || data.employeeAddress) : ''}
                      </td>
                      <td className="border-r border-black text-center text-[7px]">
                        {dep?.isNonResident ? '○' : ''}
                      </td>
                      <td className="border-r border-black text-right px-1 font-bold">
                        {dep ? '0 円' : ''}
                      </td>
                      <td className="text-center text-[6.5px] text-slate-400">
                        ―
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* 退職手当等を有する配偶者・扶養親族 */}
            <div className="border-t border-black bg-slate-50/40 p-1 text-[7px] flex justify-between items-center text-slate-500">
              <span>退職手当等を有する配偶者・扶養親族・特定親族の記載欄</span>
              <span className="font-bold text-slate-700">{data.retirementDependents?.length ? `${data.retirementDependents.length}名記載あり` : '【 該当なし 】'}</span>
            </div>
          </div>

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {/* ⑤ フッター提出署名枠 */}
          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <div className="border border-black p-1 flex justify-between items-center text-[7.5px] bg-slate-50/50">
            <div>
              申告年月日: <span className="font-bold font-sans text-[8.5px]">{data.appliedDate}</span>
            </div>
            <div className="flex items-center gap-3">
              <div>
                申告者氏名: <span className="font-black text-xs border-b border-black px-2 font-sans">{data.employeeName}</span>
                <span className="text-[6.5px] text-slate-500 ml-1">（電磁的方法による申告受領済）</span>
              </div>
              <div className="w-12 h-6 border border-dashed border-slate-400 text-[6px] text-slate-400 flex items-center justify-center">
                給与支払者印
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════════════ */}
      {/* 📄 裏面（記載についてのご注意・扶養親族等の範囲） */}
      {/* ══════════════════════════════════════════════════════════════════════════════════ */}
      {activePage === 'back' && (
        <div className="tax-doc-container bg-white text-black max-w-[1060px] mx-auto p-4 border border-slate-300 shadow-xl print:shadow-none print:border-none print:p-0 font-sans leading-tight text-[8px]">
          <div className="border-b-2 border-black pb-1 mb-2 flex justify-between items-center">
            <h2 className="font-bold text-sm tracking-wider">
              給与所得者の扶養控除等（異動）申告書　裏面
            </h2>
            <span className="text-[10px] text-slate-600 font-serif">国税庁 令和８年分 申告手引</span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-[7.5px] leading-relaxed">
            {/* 左カラム：申告・記載のご注意 */}
            <div className="space-y-2">
              <div className="border border-slate-400 p-2 rounded">
                <h3 className="font-bold text-[8.5px] border-b border-slate-300 pb-0.5 mb-1 text-slate-900">
                  １　申告についてのご注意
                </h3>
                <p className="text-slate-700">
                  (1) この申告書は、令和８年の最初の給与の支払を受ける日の前日までに、給与の支払者に提出してください。<br />
                  (2) ２か所以上から給与の支払を受け、１か所から受ける給与だけでは控除額の全額が控除しきれない場合には、「従たる給与についての扶養控除等申告書」を提出することができます。<br />
                  (3) この申告書の提出後、記載内容に異動があったときは、別に異動申告書を提出するか、この申告書の該当項目を異動後の内容に補正してください。
                </p>
              </div>

              <div className="border border-slate-400 p-2 rounded">
                <h3 className="font-bold text-[8.5px] border-b border-slate-300 pb-0.5 mb-1 text-slate-900">
                  ２　記載についてのご注意
                </h3>
                <p className="text-slate-700 space-y-1">
                  (1) 「あなたの個人番号」欄には、あなたのマイナンバーを記載してください。<br />
                  (2) 「令和８年中の所得の見積額」欄には、収入金額から給与所得控除額等を差し引いた金額を記載してください。<br />
                  (3) 源泉控除対象配偶者が非居住者である場合には、「非居住者である親族」欄に○印を付けてください。
                </p>
              </div>
            </div>

            {/* 右カラム：扶養親族等の範囲 */}
            <div className="space-y-2">
              <div className="border border-slate-400 p-2 rounded">
                <h3 className="font-bold text-[8.5px] border-b border-slate-300 pb-0.5 mb-1 text-slate-900">
                  ４　扶養親族等の範囲（令和８年分）
                </h3>
                <div className="space-y-1 text-slate-700">
                  <div>
                    <strong className="text-slate-900">【同一生計配偶者】</strong> 所得者と生計を一にする配偶者で、令和８年中の所得見積額が58万円以下（給与のみの場合123万円以下）の人。
                  </div>
                  <div>
                    <strong className="text-slate-900">【源泉控除対象配偶者】</strong> 所得者（所得900万円以下）と生計を一にする配偶者で、所得見積額が95万円以下（給与のみの場合160万円以下）の人。
                  </div>
                  <div>
                    <strong className="text-slate-900">【控除対象扶養親族】</strong> 扶養親族のうち、年齢16歳以上の人（平成23年1月1日以前に生まれた人）。
                  </div>
                  <div>
                    <strong className="text-slate-900">【特定扶養親族】</strong> 控除対象扶養親族のうち、年齢19歳以上23歳未満の人（平成16年1月2日から平成20年1月1日までの間に生まれた人）。
                  </div>
                  <div>
                    <strong className="text-slate-900">【老人扶養親族】</strong> 控除対象扶養親族のうち、年齢70歳以上の人（昭和32年1月1日以前に生まれた人）。
                  </div>
                  <div>
                    <strong className="text-slate-900">【障害者・寡婦・ひとり親・勤労学生】</strong> それぞれ法定の要件を満たす人。
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
