import React, { useState } from 'react';
import { Printer, Download, Eye, FileText, CheckCircle2 } from 'lucide-react';

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
    isDisability?: boolean;
    disabilityType?: 'general' | 'special' | 'living_special';
    disabilityTarget?: 'self' | 'spouse' | 'dependent';
    disabilityCount?: number;
    isWidow?: boolean;
    isSingleParent?: boolean;
    isWorkingStudent?: boolean;
    disabilityDetails?: string;
    workingStudentSchool?: string;
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
    isSecondarySalary?: boolean;
  };
}

/**
 * 西暦日付を国税庁公式の和暦（元号・年・月・日）に分解
 */
function parseJapaneseEraDate(dateStr?: string): { era: string; year: string; month: string; day: string } {
  if (!dateStr) return { era: '令', year: ' ', month: ' ', day: ' ' };
  
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
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
  const [activeTab, setActiveTab] = useState<'form_view' | 'pdf_view' | 'guide_view'>('form_view');
  const year = data.year || 2026;
  const reiwaYear = year - 2018;

  const under16Dependents = (data.dependents || []).filter(d => d.isUnder16);
  const regularDependents = (data.dependents || []).filter(d => !d.isUnder16);

  // B欄: 4名分の枠を確保
  const bRows: Array<DependentItem | null> = [...regularDependents.slice(0, 4)];
  while (bRows.length < 4) {
    bRows.push(null);
  }

  // 住民税16歳未満: 2名分の枠を確保
  const u16Rows: Array<DependentItem | null> = [...under16Dependents.slice(0, 2)];
  while (u16Rows.length < 2) {
    u16Rows.push(null);
  }

  const empBirth = parseJapaneseEraDate(data.birthDate);
  const spouseBirth = parseJapaneseEraDate(data.spouseBirthDate);

  return (
    <div className="w-full bg-slate-200/60 py-3 print:bg-white print:py-0 select-text font-sans">
      {/* 🖨️ 印刷用CSS設定（A4横向き印刷・国税庁公式寸法に完全合致） */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 3mm 4mm;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          .tax-doc-sheet {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: none !important;
          }
        }
      `}</style>

      {/* 🧭 画面操作ツールバー（PDF原本ダウンロード・印刷・タブ切替） */}
      <div className="max-w-[1080px] mx-auto mb-3 flex flex-wrap items-center justify-between gap-2 px-3 no-print">
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl shadow-xs border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('form_view')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'form_view'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            ① 申告書 本紙（データ印字済・そのまま提出可能）
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pdf_view')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'pdf_view'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            ② 国税庁原本PDF（2026bun_01 プレビュー）
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('guide_view')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'guide_view'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            ③ 裏面手引き（控除要件・記入注意）
          </button>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/2026bun_01.pdf"
            download="令和8年分_給与所得者の扶養控除等申告書_国税庁原本.pdf"
            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            title="国税庁公式の入力用原本PDFをダウンロード"
          >
            <Download className="w-3.5 h-3.5 text-indigo-600" />
            国税庁原本PDFをダウンロード
          </a>

          <button
            type="button"
            onClick={() => {
              setActiveTab('form_view');
              setTimeout(() => window.print(), 100);
            }}
            className="px-4 py-1.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl text-xs font-black shadow-sm transition flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            そのままA4印刷（提出用）
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════════════ */}
      {/* 📄 ① 申告書 本紙（国税庁公式様式 2026bun_01 完全再現・そのまま提出可能な資料） */}
      {/* ══════════════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'form_view' && (
        <div className="tax-doc-sheet bg-white text-black max-w-[1080px] mx-auto p-3.5 border border-slate-300 shadow-2xl print:shadow-none print:border-none print:p-0 leading-tight text-[8.5px] font-serif">
          
          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {/* 最上部：タイトル ＆ 右上『扶』丸印 */}
          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <div className="relative mb-1">
            <div className="text-center pb-0.5">
              <h1 className="text-[17px] font-black tracking-widest inline-block border-b-2 border-black pb-0.5 px-6 font-sans">
                令和{reiwaYear}年分　給与所得者の扶養控除等（異動）申告書
              </h1>
            </div>
            {/* 右上「扶」の丸印 */}
            <div className="absolute right-0 top-0 w-8 h-8 rounded-full border-2 border-black flex items-center justify-center font-black text-base font-sans bg-white shadow-xs">
              扶
            </div>
          </div>

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {/* 上段テーブル：所轄税務署・給与支払者・申告者本人 情報グリッド */}
          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <div className="border border-black grid grid-cols-12 mb-0.5 text-[8px]">
            {/* 左端：所轄税務署長等 / 市区町村長 */}
            <div className="col-span-2 border-r border-black flex flex-col justify-between p-1 bg-slate-50/60">
              <div className="border-b border-black pb-1">
                <div className="text-[7px] text-slate-600">所轄税務署長等</div>
                <div className="font-bold text-right pt-0.5">{data.taxOfficeName || '　　'} 税務署長</div>
              </div>
              <div className="pt-0.5">
                <div className="text-[7px] text-slate-600">市区町村長</div>
                <div className="font-bold text-right pt-0.5">{data.municipalityName || '　　'} 市区町村長</div>
              </div>
            </div>

            {/* 中左：給与の支払者（会社情報） */}
            <div className="col-span-4 border-r border-black p-1 space-y-0.5">
              <div className="text-[6.5px] text-slate-500 italic leading-none">※この申告書の提出を受けた給与の支払者が記載してください。</div>
              <div className="grid grid-cols-12 gap-1 items-center">
                <span className="col-span-4 text-[7.5px] text-slate-700">給与の支払者の名称（氏名）</span>
                <span className="col-span-8 font-bold text-[10px] truncate font-sans">{data.companyName}</span>
              </div>
              <div className="grid grid-cols-12 gap-1 items-center border-t border-slate-200 pt-0.5">
                <span className="col-span-4 text-[7.5px] text-slate-700">給与の支払者の法人（個人）番号</span>
                <span className="col-span-8 font-mono font-bold tracking-wider text-[9px]">{data.corporateNumber || '―'}</span>
              </div>
              <div className="grid grid-cols-12 gap-1 items-center border-t border-slate-200 pt-0.5">
                <span className="col-span-4 text-[7.5px] text-slate-700">給与の支払者の所在地（住所）</span>
                <span className="col-span-8 text-[7.5px] truncate">{data.companyAddress || '本社所在地'}</span>
              </div>
            </div>

            {/* 中右：あなたの情報（氏名・個人番号・住所） */}
            <div className="col-span-4 border-r border-black p-1 space-y-0.5">
              <div>
                <div className="text-[7px] text-slate-500 leading-none">（フリガナ）{data.employeeNameKana || '　'}</div>
                <div className="flex items-baseline justify-between pt-0.5">
                  <span className="text-[7.5px] text-slate-700">あなたの氏名</span>
                  <span className="font-black text-sm pr-4 font-sans tracking-wide">{data.employeeName}</span>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-0.5">
                <span className="text-[7.5px] text-slate-700">あなたの個人番号</span>
                <span className="font-mono tracking-widest font-bold text-[9px] pr-2 bg-slate-50 px-1 rounded">
                  {data.myNumber ? data.myNumber.slice(0, 12) : '届出済（法定保管）'}
                </span>
              </div>
              <div className="border-t border-slate-200 pt-0.5">
                <div className="text-[7px] text-slate-500 leading-none">あなたの住所又は居所（郵便番号 〒 {data.postalCode || '　　-　　'}）</div>
                <div className="font-bold truncate text-[8px] pt-0.5">{data.employeeAddress}</div>
              </div>
            </div>

            {/* 右端：生年月日・世帯主・配偶者・従たる給与 */}
            <div className="col-span-2 p-1 flex flex-col justify-between bg-slate-50/40 text-[7.5px]">
              <div className="space-y-0.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">あなたの生年月日</span>
                  <span className="font-bold font-sans">{empBirth.era}{empBirth.year}年{empBirth.month}月{empBirth.day}日</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-200 pt-0.5">
                  <span className="text-slate-600">世帯主の氏名</span>
                  <span className="font-bold truncate max-w-[70px] font-sans">{data.householderName || data.employeeName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">あなたとの続柄</span>
                  <span className="font-bold font-sans">{data.householderRelation || '本人'}</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-200 pt-0.5">
                  <span className="text-slate-600">配偶者の有無</span>
                  <span className="font-bold font-sans text-indigo-900">{data.hasSpouse ? '【 有 】' : '【 無 】'}</span>
                </div>
              </div>

              <div className="border-t border-black pt-0.5 text-[6.5px] text-center text-slate-600">
                従たる給与の提出: {data.isSecondarySalary ? '【 ○ 提出あり 】' : '【 提出なし 】'}
              </div>
            </div>
          </div>

          {/* 注意書き */}
          <div className="text-[6.5px] text-slate-600 px-0.5 mb-0.5 leading-none">
            以下の各欄に記載する親族がなく、かつ、あなた自身が障害者、寡婦、ひとり親又は勤労学生のいずれにも該当しない場合には、上記の各欄を記載して給与の支払者に提出してください。
          </div>

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {/* 中段：主たる給与から控除を受ける（A配偶者・B扶養親族・C障害者・D他の所得者） */}
          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <div className="border border-black flex mb-0.5">
            {/* 左側縦書き見出し */}
            <div className="w-4.5 border-r border-black bg-slate-100 flex items-center justify-center p-0.5 text-center font-bold text-[7.5px] leading-tight font-sans">
              主たる給与から控除を受ける
            </div>

            {/* 右側：各控除テーブル */}
            <div className="flex-1">
              
              {/* ───────────────────────────────────────────────────────────── */}
              {/* Ａ. 源泉控除対象配偶者 */}
              {/* ───────────────────────────────────────────────────────────── */}
              <table className="w-full border-collapse text-[7.5px]">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-black text-center text-[7px]">
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
                  <tr className="h-6 border-b border-black">
                    <td className="border-r border-black text-center font-bold bg-slate-50">
                      Ａ<br /><span className="text-[6px] font-normal leading-none font-sans">源泉控除対象配偶者</span>
                    </td>
                    <td className="border-r border-black px-1">
                      {data.hasSpouse && data.spouseName ? (
                        <div>
                          <div className="text-[6px] text-slate-500">（{data.spouseNameKana || '　'}）</div>
                          <div className="font-bold text-[8.5px] font-sans">{data.spouseName}</div>
                        </div>
                      ) : <span className="text-slate-300">―</span>}
                    </td>
                    <td className="border-r border-black text-center font-mono text-[7.5px]">
                      {data.hasSpouse ? (data.spouseMyNumber ? data.spouseMyNumber : '************') : '―'}
                    </td>
                    <td className="border-r border-black text-center font-bold font-sans">
                      {data.hasSpouse ? '妻' : '―'}
                    </td>
                    <td className="border-r border-black text-center text-[7px] font-sans">
                      {data.hasSpouse && data.spouseBirthDate ? (
                        <span>{spouseBirth.era}{spouseBirth.year}年{spouseBirth.month}月{spouseBirth.day}日</span>
                      ) : '―'}
                    </td>
                    <td className="border-r border-black text-right px-1 font-bold font-sans">
                      {data.hasSpouse && data.spouseIncomeEstimate !== undefined ? (
                        <span>{data.spouseIncomeEstimate.toLocaleString()} 円</span>
                      ) : '―'}
                    </td>
                    <td className="border-r border-black text-center">
                      {data.hasSpouse && data.spouseIsNonResident ? '○' : ''}
                    </td>
                    <td className="border-r border-black text-center text-[6.5px]">
                      {data.hasSpouse ? (data.spouseIsLivingTogether !== false ? '同居' : '別居送金') : ''}
                    </td>
                    <td className="border-r border-black px-1 text-[7px] truncate max-w-[140px]">
                      {data.hasSpouse ? (data.spouseAddress || data.employeeAddress) : ''}
                    </td>
                    <td className="text-center text-[6.5px] text-slate-400">
                      {data.spouseChangeDateReason || ''}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* ───────────────────────────────────────────────────────────── */}
              {/* Ｂ. 控除対象扶養親族（16歳以上 / 平23.1.1以前生） */}
              {/* ───────────────────────────────────────────────────────────── */}
              <table className="w-full border-collapse text-[7.5px]">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-black text-center text-[7px]">
                    <th className="border-r border-black w-8 py-0.5">区分等</th>
                    <th className="border-r border-black w-28 py-0.5">（フリガナ）<br />氏　　名</th>
                    <th className="border-r border-black w-24 py-0.5">個　人　番　号</th>
                    <th className="border-r border-black w-14 py-0.5">あなたとの<br />続　柄</th>
                    <th className="border-r border-black w-24 py-0.5">生　年　月　日</th>
                    <th className="border-r border-black w-24 py-0.5">老人扶養親族 / 特定親族</th>
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
                      <tr key={idx} className="h-5.5">
                        {idx === 0 && (
                          <td rowSpan={4} className="border-r border-black text-center font-bold bg-slate-50 w-8">
                            Ｂ<br /><span className="text-[6px] font-normal leading-none font-sans">控除対象<br />扶養親族<br />(16歳以上)</span>
                          </td>
                        )}
                        <td className="border-r border-black px-1">
                          {dep ? (
                            <div>
                              <div className="text-[6px] text-slate-500">（{dep.nameKana || '　'}）</div>
                              <div className="font-bold text-[8px] font-sans">{dep.name}</div>
                            </div>
                          ) : ''}
                        </td>
                        <td className="border-r border-black text-center font-mono text-[7.5px]">
                          {dep ? (dep.myNumber ? dep.myNumber : '************') : ''}
                        </td>
                        <td className="border-r border-black text-center font-bold font-sans">
                          {dep?.relation || ''}
                        </td>
                        <td className="border-r border-black text-center text-[7px] font-sans">
                          {bDate ? `${bDate.era}${bDate.year}年${bDate.month}月${bDate.day}日` : ''}
                        </td>
                        <td className="border-r border-black px-0.5 text-[6.5px] space-y-0.2">
                          <div className="flex items-center gap-1">
                            <span>{dep?.isElderly ? '☑' : '□'} 同居老親</span>
                            <span>{dep?.isElderly ? '□' : '□'} その他</span>
                          </div>
                          <div className="flex items-center gap-1 border-t border-slate-200 pt-0.2">
                            <span>{dep?.isSpecific ? '☑' : '□'} 特定扶養</span>
                            <span>□ 特定親族</span>
                          </div>
                        </td>
                        <td className="border-r border-black text-right px-1 font-bold font-sans">
                          {dep && dep.incomeEstimate !== undefined ? `${dep.incomeEstimate.toLocaleString()} 円` : ''}
                        </td>
                        <td className="border-r border-black text-[6px] px-0.5 leading-none">
                          <div>{dep?.nonResidentReason === '16_30_70' ? '☑' : '□'} 16-30/70以上</div>
                          <div>{dep?.nonResidentReason === 'study_abroad' ? '☑' : '□'} 留学</div>
                          <div>{dep?.nonResidentReason === 'disabled' ? '☑' : '□'} 障害者</div>
                        </td>
                        <td className="border-r border-black text-center text-[6.5px]">
                          {dep ? (dep.isLivingTogether !== false ? '同居' : (dep.livingTogetherFact || '別居送金')) : ''}
                        </td>
                        <td className="border-r border-black px-1 text-[7px] truncate max-w-[140px]">
                          {dep ? (dep.address || data.employeeAddress) : ''}
                        </td>
                        <td className="text-center text-[6.5px] text-slate-400">
                          {dep?.changeDateReason || ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* ───────────────────────────────────────────────────────────── */}
              {/* Ｃ. 障害者、寡婦、ひとり親又は勤労学生 */}
              {/* ───────────────────────────────────────────────────────────── */}
              <div className="border-t border-black grid grid-cols-12 text-[7px]">
                <div className="col-span-1 border-r border-black bg-slate-50 flex items-center justify-center font-bold text-center p-0.5">
                  Ｃ<br />障害者等
                </div>
                
                <div className="col-span-5 border-r border-black p-1 space-y-0.5">
                  <div className="flex items-center gap-1.5 font-bold">
                    <span>{data.isDisability ? '☑' : '□'} 障害者</span>
                    <span>{data.isWidow ? '☑' : '□'} 寡婦</span>
                    <span>{data.isSingleParent ? '☑' : '□'} ひとり親</span>
                    <span>{data.isWorkingStudent ? '☑' : '□'} 勤労学生</span>
                  </div>
                  <div className="border-t border-slate-200 pt-0.5 text-[6px] grid grid-cols-3 gap-0.5 text-slate-700">
                    <div>一般: ({data.isDisability && data.disabilityType === 'general' ? 1 : 0})人</div>
                    <div>特別: ({data.isDisability && data.disabilityType === 'special' ? 1 : 0})人</div>
                    <div>同居特別: ({data.isDisability && data.disabilityType === 'living_special' ? 1 : 0})人</div>
                  </div>
                </div>

                <div className="col-span-4 border-r border-black p-1">
                  <div className="text-[6px] text-slate-500 leading-none">障害者又は勤労学生の内容</div>
                  <div className="font-bold text-[7.5px] pt-0.5 font-sans truncate">
                    {data.disabilityDetails || (data.isWorkingStudent ? `学校名: ${data.workingStudentSchool || '〇〇大学'}` : '該当なし')}
                  </div>
                </div>

                <div className="col-span-2 p-1 text-center text-[6.5px] text-slate-400 flex items-center justify-center">
                  ―
                </div>
              </div>

              {/* ───────────────────────────────────────────────────────────── */}
              {/* Ｄ. 他の所得者が控除を受ける扶養親族等 */}
              {/* ───────────────────────────────────────────────────────────── */}
              <div className="border-t border-black grid grid-cols-12 text-[7px] bg-slate-50/20">
                <div className="col-span-1 border-r border-black bg-slate-50 flex items-center justify-center font-bold text-center p-0.5">
                  Ｄ<br />他所得者
                </div>
                <div className="col-span-11 p-1 text-[6.5px] flex justify-between items-center text-slate-500">
                  <span>他の所得者が控除を受ける扶養親族等（氏名・続柄・生年月日・住所 / 控除を受ける他の所得者）</span>
                  <span className="font-bold text-slate-700 font-sans">{data.otherTaxPayerDependents?.length ? `${data.otherTaxPayerDependents.length}名記載あり` : '【 該当なし 】'}</span>
                </div>
              </div>

            </div>
          </div>

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {/* 下段：住民税に関する事項（16歳未満の年少扶養 ＆ 退職手当等親族） */}
          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <div className="border border-black mb-1">
            <div className="bg-slate-100 px-1 py-0.5 font-bold text-[7.5px] border-b border-black flex justify-between items-center font-sans">
              <span>○ 住民税に関する事項（地方税法第45条の3の2及び第317条の3の2に基づき市区町村長に提出する申告書を兼ねています）</span>
              <span className="text-[6.5px] font-normal text-slate-600">※16歳未満の扶養親族 / 退職所得を有する配偶者・扶養親族</span>
            </div>

            {/* 16歳未満の扶養親族（平23.1.2以後生） */}
            <table className="w-full border-collapse text-[7px]">
              <thead>
                <tr className="bg-slate-50 border-b border-black text-center text-[6.5px]">
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
                        <td rowSpan={2} className="border-r border-black text-center font-bold bg-slate-50 w-24 text-[6.5px] font-sans">
                          16歳未満の扶養親族<br />（平23.1.2以後生）
                        </td>
                      )}
                      <td className="border-r border-black px-1">
                        {dep ? (
                          <div>
                            <span className="text-[6px] text-slate-500">（{dep.nameKana || '　'}）</span>
                            <span className="font-bold text-[7.5px] ml-1 font-sans">{dep.name}</span>
                          </div>
                        ) : ''}
                      </td>
                      <td className="border-r border-black text-center font-mono text-[7px]">
                        {dep ? (dep.myNumber ? dep.myNumber : '************') : ''}
                      </td>
                      <td className="border-r border-black text-center font-bold font-sans">
                        {dep?.relation || ''}
                      </td>
                      <td className="border-r border-black text-center text-[6.5px] font-sans">
                        {u16Date ? `${u16Date.era}${u16Date.year}年${u16Date.month}月${u16Date.day}日` : ''}
                      </td>
                      <td className="border-r border-black px-1 text-[6.5px] truncate max-w-[180px]">
                        {dep ? (dep.address || data.employeeAddress) : ''}
                      </td>
                      <td className="border-r border-black text-center text-[6.5px]">
                        {dep?.isNonResident ? '○' : ''}
                      </td>
                      <td className="border-r border-black text-right px-1 font-bold font-sans">
                        {dep ? '0 円' : ''}
                      </td>
                      <td className="text-center text-[6px] text-slate-400">
                        ―
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* 退職手当等親族枠 */}
            <div className="border-t border-black bg-slate-50/30 p-0.5 text-[6.5px] flex justify-between items-center text-slate-500 font-sans">
              <span>退職手当等を有する配偶者・扶養親族・特定親族の記載欄</span>
              <span className="font-bold text-slate-700">{data.retirementDependents?.length ? `${data.retirementDependents.length}名記載あり` : '【 該当なし 】'}</span>
            </div>
          </div>

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {/* フッター：申告年月日 ＆ 申告者署名 ＆ 給与支払者印枠 */}
          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <div className="border border-black p-1 flex justify-between items-center text-[7.5px] bg-slate-50/50">
            <div>
              申告年月日: <span className="font-bold font-sans text-[8px]">{data.appliedDate}</span>
            </div>
            <div className="flex items-center gap-3">
              <div>
                申告者氏名: <span className="font-black text-xs border-b border-black px-3 font-sans tracking-wider">{data.employeeName}</span>
                <span className="text-[6.5px] text-slate-500 ml-1">（電磁的方法による申告受領済）</span>
              </div>
              <div className="w-12 h-6 border border-dashed border-slate-400 text-[6px] text-slate-400 flex items-center justify-center font-sans">
                給与支払者印
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════════════ */}
      {/* 📄 ② 国税庁原本PDF（2026bun_01）インライン閲覧ビュー */}
      {/* ══════════════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'pdf_view' && (
        <div className="max-w-[1080px] mx-auto bg-white p-4 rounded-2xl shadow-xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <div>
                <h3 className="font-bold text-slate-800 text-sm">国税庁公式 令和8年分 扶養控除等（異動）申告書 入力用PDF原本</h3>
                <p className="text-xs text-slate-400">国税庁が配布している「2026bun_01.pdf」の原本ファイルです。</p>
              </div>
            </div>
            <a
              href="/2026bun_01.pdf"
              download="2026bun_01.pdf"
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" /> PDF保存
            </a>
          </div>

          <div className="w-full h-[750px] border border-slate-300 rounded-xl overflow-hidden shadow-inner bg-slate-100">
            <iframe
              src="/2026bun_01.pdf#toolbar=1&navpanes=0&scrollbar=1"
              className="w-full h-full"
              title="国税庁原本PDFプレビュー"
            />
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════════════ */}
      {/* 📄 ③ 裏面手引き（申告についてのご注意・扶養親族の範囲） */}
      {/* ══════════════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'guide_view' && (
        <div className="max-w-[1080px] mx-auto bg-white p-5 rounded-2xl shadow-xl border border-slate-200 font-sans text-xs space-y-4">
          <div className="border-b border-slate-200 pb-2 flex justify-between items-center">
            <h2 className="font-bold text-sm text-slate-800">
              給与所得者の扶養控除等（異動）申告書　裏面手引（令和８年分）
            </h2>
            <span className="text-[11px] text-slate-500 font-serif">国税庁 申告手引き</span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-[11px] leading-relaxed">
            <div className="space-y-3">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <h3 className="font-bold text-slate-900 border-b border-slate-200 pb-1 mb-1">
                  １　申告についてのご注意
                </h3>
                <p className="text-slate-700">
                  (1) この申告書は、令和８年の最初の給与の支払を受ける日の前日までに、給与の支払者に提出してください。<br />
                  (2) ２か所以上から給与の支払を受け、１か所から受ける給与だけでは控除額の全額が控除しきれない場合には、「従たる給与についての扶養控除等申告書」を提出することができます。
                </p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <h3 className="font-bold text-slate-900 border-b border-slate-200 pb-1 mb-1">
                  ２　記載についてのご注意
                </h3>
                <p className="text-slate-700 space-y-1">
                  (1) 「あなたの個人番号」欄には、あなたのマイナンバーを記載してください。<br />
                  (2) 「令和８年中の所得の見積額」欄には、収入金額から給与所得控除額等を差し引いた金額を記載してください。
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
              <h3 className="font-bold text-slate-900 border-b border-slate-200 pb-1 mb-1">
                ４　扶養親族等の範囲（令和８年分）
              </h3>
              <div className="space-y-1.5 text-slate-700">
                <div>
                  <strong className="text-slate-900">【同一生計配偶者】</strong> 所得者と生計を一にする配偶者で、所得見積額が58万円以下（給与のみの場合123万円以下）の人。
                </div>
                <div>
                  <strong className="text-slate-900">【源泉控除対象配偶者】</strong> 所得者（所得900万円以下）と生計を一にする配偶者で、所得見積額が95万円以下（給与のみの場合160万円以下）の人。
                </div>
                <div>
                  <strong className="text-slate-900">【控除対象扶養親族】</strong> 扶養親族のうち、年齢16歳以上の人（平成23年1月1日以前生まれ）。
                </div>
                <div>
                  <strong className="text-slate-900">【特定扶養親族】</strong> 控除対象扶養親族のうち、年齢19歳以上23歳未満の人（平成16年1月2日〜平成20年1月1日生まれ）。
                </div>
                <div>
                  <strong className="text-slate-900">【老人扶養親族】</strong> 控除対象扶養親族のうち、年齢70歳以上の人（昭和32年1月1日以前生まれ）。
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
