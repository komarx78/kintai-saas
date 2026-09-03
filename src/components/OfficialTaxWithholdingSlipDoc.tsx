import React from 'react';

export interface TaxWithholdingDocProps {
  data: {
    year?: number; // 2026
    // 受給者情報
    recipientAddress?: string;
    recipientKana?: string;
    recipientName?: string;
    recipientNumber?: string;
    recipientPosition?: string;
    myNumber?: string;
    birthDate?: string; // '1990-05-15'
    joinDate?: string;
    retirementDate?: string;
    isRetired?: boolean;

    // 金額サマリー
    totalPayment?: number; // 支払金額 (G03)
    deductionAfterPayment?: number; // 給与所得控除後の金額 (G05)
    totalIncomeDeduction?: number; // 所得控除の額の合計額 (G06)
    withholdingTaxAmount?: number; // 源泉徴収税額 (G07)

    // 控除・扶養
    hasSpouse?: boolean;
    spouseDeduction?: number; // 配偶者控除額 (G12)
    dependentsCount?: number; // 扶養親族数 (G13)
    under16Count?: number; // 16歳未満扶養数 (G20)
    socialInsuranceAmount?: number; // 社会保険料等の金額 (G25)
    lifeInsuranceDeduction?: number; // 生命保険料の控除額 (G27)
    earthquakeInsuranceDeduction?: number; // 地震保険料の控除額 (G28)
    housingLoanDeduction?: number; // 住宅借入金等特別控除の額 (G29)
    basicDeduction?: number; // 基礎控除の額 (G46: 480,000)

    // 摘要
    summaryNotes?: string;

    // 支払者情報
    companyAddress?: string;
    companyName?: string;
    companyPhone?: string;
    corporateNumber?: string;
    companySealUrl?: string;
  };
}

export const OfficialTaxWithholdingSlipDoc: React.FC<TaxWithholdingDocProps> = ({ data }) => {
  const year = data.year || new Date().getFullYear();
  const reiwaYear = year - 2018;

  // 生年月日元号分解
  const parseEraDate = (dateStr?: string) => {
    if (!dateStr) return { era: '令', y: '', m: '', d: '' };
    const [y, m, d] = dateStr.split('-');
    const numY = parseInt(y, 10);
    if (numY >= 2019) return { era: '令', y: String(numY - 2018), m: String(parseInt(m, 10)), d: String(parseInt(d, 10)) };
    if (numY >= 1989) return { era: '平', y: String(numY - 1988), m: String(parseInt(m, 10)), d: String(parseInt(d, 10)) };
    if (numY >= 1926) return { era: '昭', y: String(numY - 1925), m: String(parseInt(m, 10)), d: String(parseInt(d, 10)) };
    return { era: '令', y: '', m: '', d: '' };
  };

  const birthParsed = parseEraDate(data.birthDate);
  const retireParsed = parseEraDate(data.retirementDate);

  // 金額フォーマット
  const fmt = (n?: number) => (n !== undefined && n !== null && n > 0 ? n.toLocaleString() : '');

  return (
    <div className="bg-white text-black font-sans p-4 sm:p-6 max-w-[840px] mx-auto select-text print:p-0 print:m-0 print:max-w-none text-[10px] leading-tight border border-slate-300 shadow-sm print:shadow-none print:border-none">
      
      {/* 印刷・A4最適化CSS */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm 8mm 6mm 8mm;
          }
          body {
            background: white !important;
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }
          .tax-slip-container {
            border: 2px solid black !important;
            padding: 0 !important;
            margin: 0 auto !important;
            width: 100% !important;
            box-shadow: none !important;
          }
          table, tr, td, th {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      <div className="tax-slip-container border-2 border-black p-2 bg-white">
        
        {/* ===================================================================== */}
        {/* 最上部ヘッダー（様式ID、QRコード、タイトル、元号）                  */}
        {/* ===================================================================== */}
        <div className="flex items-start justify-between mb-1 pb-1">
          {/* 左側: 無効区分 */}
          <div className="flex items-center gap-1">
            <div className="border border-black px-1.5 py-0.5 text-[8px] font-bold text-center">
              <div>無効区分</div>
              <div className="font-mono text-[7px] text-slate-400">G01</div>
            </div>
          </div>

          {/* 中央: 表題 */}
          <div className="text-center flex-1 px-2">
            <div className="flex items-baseline justify-center gap-1.5">
              <span className="border-b border-black px-1 font-serif text-[11px]">
                元号 <strong className="text-xs">{reiwaYear}</strong> 年
              </span>
              <span className="font-mono text-[8px] text-slate-400 border border-slate-300 px-0.5">L01</span>
              <h1 className="text-base sm:text-lg font-black tracking-widest text-black inline-block mx-2">
                給与所得の源泉徴収票
              </h1>
              <span className="font-serif text-[11px]">年分</span>
            </div>
          </div>

          {/* 右側: 様式ID ＆ QRコード */}
          <div className="flex items-center gap-2">
            <div className="border border-black px-1 py-0.5 text-[9px] font-mono font-bold text-right tracking-tight">
              <span className="text-[7px] text-slate-500 mr-1">様式ID</span>
              NTAOHSZ062010060
            </div>
            {/* 国税庁公式QRコード風グラフィック */}
            <div className="w-9 h-9 border border-black p-0.5 flex flex-col justify-between shrink-0 bg-white">
              <div className="flex justify-between">
                <div className="w-2.5 h-2.5 bg-black border border-white"></div>
                <div className="w-2.5 h-2.5 bg-black border border-white"></div>
              </div>
              <div className="flex justify-center gap-0.5">
                <div className="w-1 h-1 bg-black"></div>
                <div className="w-1 h-1 bg-black"></div>
              </div>
              <div className="flex justify-between">
                <div className="w-2.5 h-2.5 bg-black border border-white"></div>
                <div className="w-2.5 h-2.5 bg-black/60"></div>
              </div>
            </div>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* 1. 支払を受ける者（受給者情報）テーブル                               */}
        {/* ===================================================================== */}
        <div className="border border-black mb-1">
          <div className="bg-slate-100 text-[8px] text-center font-bold border-b border-black py-0.5">
            支払を受ける者
          </div>
          
          <div className="grid grid-cols-12 text-[9px]">
            {/* 住所又は居所 */}
            <div className="col-span-2 border-r border-b border-black p-1 bg-slate-50 flex items-center justify-between">
              <span>住所又は居所</span>
              <span className="text-[7px] text-slate-400 font-mono">E01</span>
            </div>
            <div className="col-span-10 border-b border-black p-1 font-medium truncate">
              {data.recipientAddress || '滋賀県大津市'}
            </div>

            {/* フリガナ / 受給者番号 */}
            <div className="col-span-2 border-r border-b border-black p-1 bg-slate-50 flex items-center justify-between">
              <span>フリガナ</span>
              <span className="text-[7px] text-slate-400 font-mono">E02</span>
            </div>
            <div className="col-span-6 border-r border-b border-black p-1 font-mono text-[8px]">
              {data.recipientKana || 'コマイ シュウイチロウ'}
            </div>
            <div className="col-span-2 border-r border-b border-black p-1 bg-slate-50 flex items-center justify-between">
              <span>(受給者番号)</span>
              <span className="text-[7px] text-slate-400 font-mono">E04</span>
            </div>
            <div className="col-span-2 border-b border-black p-1 font-mono text-[8px]">
              {data.recipientNumber || 'EMP-001'}
            </div>

            {/* 氏名 / 役職名 */}
            <div className="col-span-2 border-r border-b border-black p-1 bg-slate-50 flex items-center justify-between">
              <span>氏名</span>
              <span className="text-[7px] text-slate-400 font-mono">E03</span>
            </div>
            <div className="col-span-6 border-r border-b border-black p-1 font-bold text-xs">
              {data.recipientName || '駒井 秀一朗'}
            </div>
            <div className="col-span-2 border-r border-b border-black p-1 bg-slate-50 flex items-center justify-between">
              <span>(役職名)</span>
              <span className="text-[7px] text-slate-400 font-mono">E05</span>
            </div>
            <div className="col-span-2 border-b border-black p-1 text-[8.5px]">
              {data.recipientPosition || '一般社員'}
            </div>

            {/* 個人番号 */}
            <div className="col-span-2 border-r border-black p-1 bg-slate-50 flex items-center justify-between">
              <span>個人番号</span>
              <span className="text-[7px] text-slate-400 font-mono">G02</span>
            </div>
            <div className="col-span-10 p-1 font-mono tracking-widest text-[9px]">
              {data.myNumber ? data.myNumber.replace(/.(?=.{4})/g, '*') : '************'}
            </div>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* 2. 主要税額サマリー行（支払金額、控除後、所得控除計、源泉税額）     */}
        {/* ===================================================================== */}
        <div className="border border-black mb-1">
          <table className="w-full border-collapse text-center text-[8.5px]">
            <thead>
              <tr className="bg-slate-50 border-b border-black">
                <th className="p-1 border-r border-black w-14">
                  <div>種別</div>
                  <span className="text-[7px] text-slate-400 font-mono font-normal">F06</span>
                </th>
                <th className="p-1 border-r border-black">
                  <div>支払金額</div>
                  <span className="text-[7px] text-slate-400 font-mono font-normal">円 G03/G04</span>
                </th>
                <th className="p-1 border-r border-black">
                  <div>給与所得控除後の金額<br /><span className="text-[7.5px] font-normal">(調整控除後)</span></div>
                  <span className="text-[7px] text-slate-400 font-mono font-normal">円 G05</span>
                </th>
                <th className="p-1 border-r border-black">
                  <div>所得控除の額の合計額</div>
                  <span className="text-[7px] text-slate-400 font-mono font-normal">円 G06</span>
                </th>
                <th className="p-1">
                  <div>源泉徴収税額</div>
                  <span className="text-[7px] text-slate-400 font-mono font-normal">円 G07/G08</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="font-mono text-[10px] font-bold h-7">
                <td className="p-1 border-r border-black font-sans font-normal text-[9px]">給与・賞与</td>
                <td className="p-1 border-r border-black text-right pr-2">
                  {fmt(data.totalPayment) || '3,600,000'}
                </td>
                <td className="p-1 border-r border-black text-right pr-2">
                  {fmt(data.deductionAfterPayment) || '2,440,000'}
                </td>
                <td className="p-1 border-r border-black text-right pr-2">
                  {fmt(data.totalIncomeDeduction) || '1,011,000'}
                </td>
                <td className="p-1 text-right pr-2 font-black text-xs">
                  {fmt(data.withholdingTaxAmount) || '73,200'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ===================================================================== */}
        {/* 3. 控除対象配偶者・扶養親族・社会保険料等控除サマリー行               */}
        {/* ===================================================================== */}
        <div className="border border-black mb-1">
          <table className="w-full border-collapse text-center text-[7.5px]">
            <thead>
              <tr className="bg-slate-50 border-b border-black">
                <th colSpan={3} className="p-0.5 border-r border-black">
                  (源泉)控除対象配偶者の有無等
                </th>
                <th rowSpan={2} className="p-0.5 border-r border-black w-16">
                  配偶者(特別)<br />控除の額
                  <div className="text-[6.5px] font-mono text-slate-400">G12</div>
                </th>
                <th colSpan={5} className="p-0.5 border-r border-black">
                  控除対象扶養親族の数 (配偶者を除く。)
                </th>
                <th colSpan={2} className="p-0.5 border-r border-black">
                  16歳未満の扶養親族の数
                </th>
                <th colSpan={3} className="p-0.5 border-r border-black">
                  障害者の数 (本人を除く。)
                </th>
                <th rowSpan={2} className="p-0.5 border-r border-black w-8">
                  非居住者<br />親族数
                </th>
              </tr>
              <tr className="bg-slate-50 border-b border-black text-[7px]">
                <th className="p-0.5 border-r border-black w-6">有</th>
                <th className="p-0.5 border-r border-black w-6">従有</th>
                <th className="p-0.5 border-r border-black w-6">老人</th>
                <th className="p-0.5 border-r border-black w-6">特定</th>
                <th className="p-0.5 border-r border-black w-6">老人</th>
                <th className="p-0.5 border-r border-black w-6">その他</th>
                <th className="p-0.5 border-r border-black w-6">特親</th>
                <th className="p-0.5 border-r border-black w-6">従人</th>
                <th className="p-0.5 border-r border-black w-6">人</th>
                <th className="p-0.5 border-r border-black w-6">従人</th>
                <th className="p-0.5 border-r border-black w-6">特別</th>
                <th className="p-0.5 border-r border-black w-6">その他</th>
                <th className="p-0.5 border-r border-black w-6">特別</th>
              </tr>
            </thead>
            <tbody>
              <tr className="font-mono text-[9px] h-5 border-b border-black">
                <td className="border-r border-black">{data.hasSpouse ? '○' : ''}</td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black text-right pr-0.5">{fmt(data.spouseDeduction) || ''}</td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black">{data.dependentsCount ? String(data.dependentsCount) : ''}</td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black">{data.under16Count ? String(data.under16Count) : ''}</td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td></td>
              </tr>
            </tbody>
          </table>

          {/* 各種控除額（社保、生命保険、地震保険、住宅ローン） */}
          <table className="w-full border-collapse text-center text-[7.5px]">
            <thead>
              <tr className="bg-slate-50 border-b border-black">
                <th className="p-1 border-r border-black w-24">特定親族特別控除の額</th>
                <th className="p-1 border-r border-black">
                  <div>社会保険料等の金額</div>
                  <span className="text-[6.5px] font-mono text-slate-400">G25/G26</span>
                </th>
                <th className="p-1 border-r border-black">
                  <div>生命保険料の控除額</div>
                  <span className="text-[6.5px] font-mono text-slate-400">G27</span>
                </th>
                <th className="p-1 border-r border-black">
                  <div>地震保険料の控除額</div>
                  <span className="text-[6.5px] font-mono text-slate-400">G28</span>
                </th>
                <th className="p-1">
                  <div>住宅借入金等特別控除の額</div>
                  <span className="text-[6.5px] font-mono text-slate-400">G29</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="font-mono text-[9.5px] font-bold h-6">
                <td className="border-r border-black"></td>
                <td className="border-r border-black text-right pr-2">
                  {fmt(data.socialInsuranceAmount) || '531,000'}
                </td>
                <td className="border-r border-black text-right pr-2">
                  {fmt(data.lifeInsuranceDeduction) || ''}
                </td>
                <td className="border-r border-black text-right pr-2">
                  {fmt(data.earthquakeInsuranceDeduction) || ''}
                </td>
                <td className="text-right pr-2">
                  {fmt(data.housingLoanDeduction) || ''}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ===================================================================== */}
        {/* 4. 摘要欄 (E07)                                                      */}
        {/* ===================================================================== */}
        <div className="border border-black mb-1">
          <div className="bg-slate-50 border-b border-black text-[7.5px] font-bold px-1.5 py-0.5 flex justify-between">
            <span>(摘要)</span>
            <span className="text-[7px] font-mono text-slate-400">E07</span>
          </div>
          <div className="p-1.5 min-h-[38px] text-[8.5px] text-slate-700 leading-normal">
            {data.summaryNotes || (
              <>
                {data.isRetired && <div>・中途退職: {data.retirementDate || '2026-08-31'}</div>}
                <div>・社会保険料控除内訳: 健康保険・厚生年金・雇用保険</div>
                <div>・電磁的方法による交付（国税庁様式ID: NTAOHSZ062010060 準拠）</div>
              </>
            )}
          </div>
        </div>

        {/* ===================================================================== */}
        {/* 5. 保険料・住宅借入金等・配偶者・扶養親族等の明細グリッド             */}
        {/* ===================================================================== */}
        <div className="border border-black mb-1">
          {/* 生命保険料の内訳 */}
          <table className="w-full border-collapse text-center text-[7px] border-b border-black">
            <thead>
              <tr className="bg-slate-50 border-b border-black">
                <th className="p-0.5 border-r border-black w-14">生命保険料の金額の内訳</th>
                <th className="p-0.5 border-r border-black">新生命保険料 G30</th>
                <th className="p-0.5 border-r border-black">旧生命保険料 G31</th>
                <th className="p-0.5 border-r border-black">介護医療保険料 G32</th>
                <th className="p-0.5 border-r border-black">新個人年金保険料 G33</th>
                <th className="p-0.5">旧個人年金保険料 G34</th>
              </tr>
            </thead>
            <tbody>
              <tr className="font-mono text-[8.5px] h-4">
                <td className="border-r border-black"></td>
                <td className="border-r border-black text-right pr-1"></td>
                <td className="border-r border-black text-right pr-1"></td>
                <td className="border-r border-black text-right pr-1"></td>
                <td className="border-r border-black text-right pr-1"></td>
                <td className="text-right pr-1"></td>
              </tr>
            </tbody>
          </table>

          {/* 配偶者・基礎控除等の行 */}
          <div className="grid grid-cols-12 text-[7.5px] border-b border-black">
            <div className="col-span-2 border-r border-black p-0.5 bg-slate-50 flex items-center justify-between">
              <span>(源泉・特別)控除配偶者</span>
              <span className="text-[6px] font-mono text-slate-400">E08</span>
            </div>
            <div className="col-span-3 border-r border-black p-0.5 truncate font-bold text-[8.5px]">
              {data.hasSpouse ? '駒井 花子' : ''}
            </div>
            <div className="col-span-2 border-r border-black p-0.5 bg-slate-50 text-center">
              配偶者の合計所得
            </div>
            <div className="col-span-1 border-r border-black p-0.5 text-right font-mono">
              {data.hasSpouse ? '0' : ''}
            </div>
            <div className="col-span-2 border-r border-black p-0.5 bg-slate-50 text-center">
              基礎控除の額 G46
            </div>
            <div className="col-span-2 p-0.5 text-right font-mono font-bold">
              480,000
            </div>
          </div>

          {/* 控除対象扶養親族・16歳未満明細 */}
          <div className="grid grid-cols-2 text-[7.5px]">
            {/* 左側: 控除対象扶養親族等 */}
            <div className="border-r border-black p-1">
              <div className="bg-slate-100 font-bold p-0.5 mb-0.5 text-center text-[7px]">
                控除対象扶養親族等 (氏名・個人番号)
              </div>
              <div className="space-y-1 font-mono text-[8px]">
                <div className="flex justify-between border-b border-slate-200 pb-0.5">
                  <span className="font-sans font-bold">{data.dependentsCount ? '駒井 一郎' : '-'}</span>
                  <span>{data.dependentsCount ? '区分 G48' : ''}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-0.5">
                  <span className="font-sans font-bold">-</span>
                  <span></span>
                </div>
              </div>
            </div>

            {/* 右側: 16歳未満の扶養親族 */}
            <div className="p-1">
              <div className="bg-slate-100 font-bold p-0.5 mb-0.5 text-center text-[7px]">
                16歳未満の扶養親族 (氏名)
              </div>
              <div className="space-y-1 font-mono text-[8px]">
                <div className="flex justify-between border-b border-slate-200 pb-0.5">
                  <span className="font-sans font-bold">{data.under16Count ? '駒井 二郎' : '-'}</span>
                  <span>{data.under16Count ? '区分 G56' : ''}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-0.5">
                  <span className="font-sans font-bold">-</span>
                  <span></span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* 6. 最下部チェック欄（未成年、中途退職、受給者生年月日）              */}
        {/* ===================================================================== */}
        <div className="border border-black mb-1">
          <table className="w-full border-collapse text-center text-[7px]">
            <thead>
              <tr className="bg-slate-50 border-b border-black">
                <th className="p-0.5 border-r border-black w-7">未成年</th>
                <th className="p-0.5 border-r border-black w-7">外国人</th>
                <th className="p-0.5 border-r border-black w-7">死亡退職</th>
                <th className="p-0.5 border-r border-black w-7">災害者</th>
                <th className="p-0.5 border-r border-black w-7">乙欄</th>
                <th className="p-0.5 border-r border-black w-10">障害者</th>
                <th className="p-0.5 border-r border-black w-7">寡婦</th>
                <th className="p-0.5 border-r border-black w-8">ひとり親</th>
                <th className="p-0.5 border-r border-black w-8">勤労学生</th>
                <th colSpan={2} className="p-0.5 border-r border-black">中途就・退職 N03</th>
                <th className="p-0.5">受給者生年月日 N04</th>
              </tr>
            </thead>
            <tbody>
              <tr className="font-mono text-[8px] h-5">
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black w-10 text-[7px] font-sans">
                  {data.isRetired ? <strong className="text-rose-700">退職</strong> : '就職'}
                </td>
                <td className="border-r border-black text-left pl-1">
                  {data.isRetired && retireParsed.y ? `${retireParsed.era}${retireParsed.y}.${retireParsed.m}.${retireParsed.d}` : ''}
                </td>
                <td className="text-center font-bold font-sans">
                  {birthParsed.era}{birthParsed.y}年 {birthParsed.m}月 {birthParsed.d}日
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ===================================================================== */}
        {/* 7. 支払者（事業主情報 ＆ 公式角印捺印枠）                             */}
        {/* ===================================================================== */}
        <div className="border border-black relative">
          <div className="grid grid-cols-12 text-[8.5px]">
            <div className="col-span-2 border-r border-b border-black p-1 bg-slate-50 flex items-center justify-between">
              <span>住所(居所)又は所在地</span>
              <span className="text-[6.5px] font-mono text-slate-400">F06</span>
            </div>
            <div className="col-span-10 border-b border-black p-1 truncate">
              {data.companyAddress || '滋賀県大津市坂本3丁目21-16'}
            </div>

            <div className="col-span-2 border-r border-b border-black p-1 bg-slate-50 flex items-center justify-between">
              <span>氏名又は名称</span>
              <span className="text-[6.5px] font-mono text-slate-400">F04</span>
            </div>
            <div className="col-span-6 border-r border-b border-black p-1 font-bold text-xs">
              {data.companyName || '株式会社KAP'}
            </div>
            <div className="col-span-2 border-r border-b border-black p-1 bg-slate-50 flex items-center justify-between">
              <span>電話番号</span>
              <span className="text-[6.5px] font-mono text-slate-400">F07</span>
            </div>
            <div className="col-span-2 border-b border-black p-1 font-mono text-[8px]">
              {data.companyPhone || '077-574-6907'}
            </div>

            <div className="col-span-2 border-r border-black p-1 bg-slate-50 flex items-center justify-between">
              <span>法人番号又は個人番号</span>
              <span className="text-[6.5px] font-mono text-slate-400">F02</span>
            </div>
            <div className="col-span-10 p-1 font-mono tracking-widest text-[9px]">
              {data.corporateNumber || '1010001999999'}
            </div>
          </div>

          {/* 🏢 公式朱肉角印（株式会社KAP之印）自動捺印 */}
          <div className="absolute right-3 top-1 pointer-events-none">
            {data.companySealUrl ? (
              <img
                src={data.companySealUrl}
                alt="社印"
                className="w-14 h-14 object-contain mix-blend-multiply opacity-85 select-none rotate-[-2deg]"
              />
            ) : (
              <div className="w-12 h-12 border-2 border-red-600 bg-red-50/40 rounded flex flex-col items-center justify-center text-red-600 font-serif select-none rotate-[-2deg] shadow-2xs">
                <span className="text-[8px] font-black leading-tight">株式</span>
                <span className="text-[8px] font-black leading-tight">会社印</span>
              </div>
            )}
          </div>
        </div>

      </div>

      <div className="mt-1 text-right text-[8px] text-slate-400 font-mono print:text-[7px]">
        国税庁公式様式 ID: NTAOHSZ062010060 準拠 / 本書面は所得税法第226条の規定に基づき交付する公式源泉徴収票です。
      </div>

    </div>
  );
};
