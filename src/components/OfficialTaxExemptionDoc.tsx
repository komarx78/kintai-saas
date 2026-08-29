import React from 'react';

interface TaxExemptionDocProps {
  data: {
    year?: number;
    companyName: string;
    companyAddress?: string;
    corporateNumber?: string;
    taxOfficeName?: string;
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
    dependents?: Array<{
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
    }>;
    isDisability?: boolean;
    isDisabilitySpecial?: boolean;
    isSingleParent?: boolean;
    isWidow?: boolean;
    isWorkingStudent?: boolean;
    disabilityDetails?: string;
    appliedDate: string;
  };
}

export const OfficialTaxExemptionDoc: React.FC<TaxExemptionDocProps> = ({ data }) => {
  const year = data.year || 2026;
  const under16Dependents = (data.dependents || []).filter(d => d.isUnder16);
  const regularDependents = (data.dependents || []).filter(d => !d.isUnder16);

  // 4行分の空行補完
  const paddedRegular = [...regularDependents];
  while (paddedRegular.length < 4) {
    paddedRegular.push({
      name: '',
      relation: '',
      birthDate: '',
      incomeEstimate: undefined,
      isUnder16: false
    });
  }

  // 2行分の16歳未満空行補完
  const paddedUnder16 = [...under16Dependents];
  while (paddedUnder16.length < 2) {
    paddedUnder16.push({
      name: '',
      relation: '',
      birthDate: '',
      incomeEstimate: undefined,
      isUnder16: true
    });
  }

  return (
    <div className="bg-white text-black font-sans p-4 sm:p-6 max-w-[920px] mx-auto border-2 border-black print:border-none print:p-0 print:m-0 print:max-w-none print:w-full select-text text-[10px] leading-tight">
      {/* 印刷用スタイル */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm 8mm;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
            background: white !important;
          }
        }
      `}</style>

      {/* 最上部：タイトル ＆ 所轄税務署 */}
      <div className="flex items-center justify-between mb-1">
        <div className="w-1/4 border border-black p-1 text-[8px] space-y-0.5">
          <div className="flex justify-between border-b border-black pb-0.5">
            <span>所轄税務署長等</span>
            <span className="font-bold">{data.taxOfficeName || '〇〇'} 税務署長</span>
          </div>
          <div className="flex justify-between pt-0.5">
            <span>市区町村長</span>
            <span className="font-bold">〇〇 市区長</span>
          </div>
        </div>

        <div className="text-center flex-1">
          <h1 className="text-lg sm:text-xl font-black tracking-wider inline-block border-b-2 border-black pb-0.5">
            令和{year - 2018}年分　給与所得者の扶養控除等（異動）申告書
          </h1>
        </div>

        <div className="w-1/4 text-right flex items-center justify-end gap-2">
          <div className="border border-black p-1 text-[8px] text-center">
            従たる給与についての扶養控除等申告書の提出<br />
            <span className="text-[7px]">（提出している場合は○印を付けてください）</span>
          </div>
          <div className="w-7 h-7 rounded-full border-2 border-black flex items-center justify-center font-black text-sm">
            扶
          </div>
        </div>
      </div>

      {/* 会社情報 ＆ 本人情報（国税庁公式グリッド） */}
      <div className="border-2 border-black mb-1">
        <div className="grid grid-cols-12 border-b border-black">
          {/* 会社情報 */}
          <div className="col-span-6 border-r border-black p-1 space-y-0.5">
            <div className="flex items-center">
              <span className="w-24 text-[8px] text-slate-700">給与の支払者の名称(氏名)</span>
              <span className="font-black text-xs">{data.companyName}</span>
            </div>
            <div className="flex items-center">
              <span className="w-24 text-[8px] text-slate-700">給与の支払者の法人番号</span>
              <span className="font-mono font-bold text-[9px]">{data.corporateNumber || '―'}</span>
            </div>
            <div className="flex items-center">
              <span className="w-24 text-[8px] text-slate-700">給与の支払者の所在地</span>
              <span className="text-[9px] truncate">{data.companyAddress || '本社所在地'}</span>
            </div>
          </div>

          {/* 本人情報 */}
          <div className="col-span-6 p-1 space-y-0.5">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="text-[7px] text-slate-500">（フリガナ）{data.employeeNameKana || '―'}</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[8px] text-slate-700">あなたの氏名:</span>
                  <span className="font-black text-sm">{data.employeeName}</span>
                </div>
              </div>
              <div className="text-right text-[8px] border-l border-black pl-1.5 space-y-0.5">
                <div>あなたの生年月日: <span className="font-bold">{data.birthDate || '平成10年4月1日'}</span></div>
                <div>世帯主の氏名: <span className="font-bold">{data.householderName || data.employeeName}</span></div>
                <div>あなたとの続柄: <span className="font-bold">{data.householderRelation || '本人'}</span></div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 pt-0.5">
              <div className="flex items-center gap-2">
                <span className="text-[8px] text-slate-700">あなたの個人番号:</span>
                <span className="font-mono tracking-widest text-[9px]">{data.myNumber ? '************' : '届出済'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[8px]">配偶者の有無:</span>
                <span className="font-bold">{data.hasSpouse ? '【 有 】' : '【 無 】'}</span>
              </div>
            </div>
            <div className="text-[8px]">
              あなたの住所又は居所: <span className="font-bold">{data.employeeAddress}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="text-[7px] text-slate-600 mb-1">
        以下の各欄に記載する親族がなく、かつ、あなた自身が障害者、寡婦、ひとり親又は勤労学生のいずれにも該当しない場合には、上記の各欄を記載して給与の支払者に提出してください。
      </div>

      {/* A. 源泉控除対象配偶者 */}
      <div className="border-2 border-black mb-1">
        <div className="bg-slate-100 px-1 py-0.5 font-bold text-[8px] border-b border-black flex justify-between">
          <span>A. 源泉控除対象配偶者（あなたの所得が900万円以下かつ配偶者の所得が95万円以下）</span>
          <span>{data.hasSpouse ? '【該当あり】' : '【該当なし】'}</span>
        </div>

        <table className="w-full text-left text-[8px] border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-black text-[7px] text-center">
              <th className="p-1 border-r border-black w-24">氏名（フリガナ）</th>
              <th className="p-1 border-r border-black w-20">個人番号</th>
              <th className="p-1 border-r border-black w-14">生年月日</th>
              <th className="p-1 border-r border-black w-20">令和8年中所得の見積額</th>
              <th className="p-1 border-r border-black w-12">非居住者</th>
              <th className="p-1">住所又は居所</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="p-1 border-r border-black font-bold">
                {data.hasSpouse ? (data.spouseName || '配偶者氏名') : '―'}
              </td>
              <td className="p-1 border-r border-black text-center font-mono">
                {data.hasSpouse ? '************' : '―'}
              </td>
              <td className="p-1 border-r border-black text-center">
                {data.hasSpouse ? (data.spouseBirthDate || '登録済') : '―'}
              </td>
              <td className="p-1 border-r border-black text-right font-bold">
                {data.hasSpouse ? `¥${data.spouseIncomeEstimate?.toLocaleString() || 0}` : '―'}
              </td>
              <td className="p-1 border-r border-black text-center">
                {data.hasSpouse ? '□' : '―'}
              </td>
              <td className="p-1 truncate">
                {data.hasSpouse ? (data.spouseIsLivingTogether !== false ? '同居' : '別居') : '―'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* B. 控除対象扶養親族（16歳以上） */}
      <div className="border-2 border-black mb-1">
        <div className="bg-slate-100 px-1 py-0.5 font-bold text-[8px] border-b border-black flex justify-between">
          <span>B. 主たる給与から控除を受ける 控除対象扶養親族（16歳以上 / 平成23年1月1日以前生）</span>
          <span>該当人数: {regularDependents.length}名</span>
        </div>

        <table className="w-full text-left text-[8px] border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-black text-[7px] text-center">
              <th className="p-1 border-r border-black w-24">氏名（フリガナ）</th>
              <th className="p-1 border-r border-black w-12">続柄</th>
              <th className="p-1 border-r border-black w-14">生年月日</th>
              <th className="p-1 border-r border-black w-20">区分（特定・老人）</th>
              <th className="p-1 border-r border-black w-20">令和8年中所得見積額</th>
              <th className="p-1 border-r border-black w-12">非居住者</th>
              <th className="p-1">住所又は居所</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black">
            {paddedRegular.map((dep, idx) => (
              <tr key={idx} className="h-6">
                <td className="p-1 border-r border-black font-bold">{dep.name || ' '}</td>
                <td className="p-1 border-r border-black text-center">{dep.relation}</td>
                <td className="p-1 border-r border-black text-center">{dep.birthDate}</td>
                <td className="p-1 border-r border-black text-center text-[7px]">
                  {dep.name ? (dep.isSpecific ? '特定扶養' : dep.isElderly ? '老人扶養' : '一般扶養') : ''}
                </td>
                <td className="p-1 border-r border-black text-right font-bold">
                  {dep.name ? `¥${(dep.incomeEstimate || 0).toLocaleString()}` : ''}
                </td>
                <td className="p-1 border-r border-black text-center">{dep.name ? '□' : ''}</td>
                <td className="p-1">{dep.name ? (dep.isLivingTogether !== false ? '同居' : '別居') : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* C. 障害者、寡婦、ひとり親又は勤労学生 */}
      <div className="border-2 border-black mb-1">
        <div className="bg-slate-100 px-1 py-0.5 font-bold text-[8px] border-b border-black">
          C. 障害者、寡婦、ひとり親又は勤労学生
        </div>
        <div className="p-1.5 grid grid-cols-4 gap-2 text-[8px]">
          <div className={`p-1 border rounded ${data.isDisability ? 'bg-slate-100 border-black font-black' : 'border-slate-300 text-slate-400'}`}>
            [ {data.isDisability ? '✓' : ' '} ] 障害者（特別障害者）
          </div>
          <div className={`p-1 border rounded ${data.isWidow ? 'bg-slate-100 border-black font-black' : 'border-slate-300 text-slate-400'}`}>
            [ {data.isWidow ? '✓' : ' '} ] 寡婦控除
          </div>
          <div className={`p-1 border rounded ${data.isSingleParent ? 'bg-slate-100 border-black font-black' : 'border-slate-300 text-slate-400'}`}>
            [ {data.isSingleParent ? '✓' : ' '} ] ひとり親控除
          </div>
          <div className={`p-1 border rounded ${data.isWorkingStudent ? 'bg-slate-100 border-black font-black' : 'border-slate-300 text-slate-400'}`}>
            [ {data.isWorkingStudent ? '✓' : ' '} ] 勤労学生控除
          </div>
        </div>
      </div>

      {/* 住民税に関する事項（16歳未満の年少扶養親族） */}
      <div className="border-2 border-black mb-2">
        <div className="bg-slate-100 px-1 py-0.5 font-bold text-[8px] border-b border-black flex justify-between">
          <span>○ 住民税に関する事項（16歳未満の扶養親族 / 平成23年1月2日以後に生まれた方）</span>
          <span>該当人数: {under16Dependents.length}名</span>
        </div>

        <table className="w-full text-left text-[8px] border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-black text-[7px] text-center">
              <th className="p-1 border-r border-black w-28">氏名（フリガナ）</th>
              <th className="p-1 border-r border-black w-14">あなたとの続柄</th>
              <th className="p-1 border-r border-black w-16">生年月日</th>
              <th className="p-1 border-r border-black w-24">令和8年中所得見積額</th>
              <th className="p-1">住所又は居所</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black">
            {paddedUnder16.map((dep, idx) => (
              <tr key={idx} className="h-5">
                <td className="p-1 border-r border-black font-bold">{dep.name || ' '}</td>
                <td className="p-1 border-r border-black text-center">{dep.relation}</td>
                <td className="p-1 border-r border-black text-center">{dep.birthDate}</td>
                <td className="p-1 border-r border-black text-right">{dep.name ? '¥0' : ''}</td>
                <td className="p-1">{dep.name ? (dep.isLivingTogether !== false ? '同居' : '別居') : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 提出誓約フッター */}
      <div className="border border-black p-1.5 flex justify-between items-center text-[8px]">
        <div>
          申告年月日: <span className="font-bold">{data.appliedDate}</span>
        </div>
        <div>
          申告者氏名: <span className="font-black text-xs border-b border-black px-2">{data.employeeName}</span>
          <span className="text-[7px] text-slate-500 ml-1">（電子申告済・本人確認完了）</span>
        </div>
      </div>
    </div>
  );
};
