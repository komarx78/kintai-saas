import React from 'react';

interface TaxExemptionDocProps {
  data: {
    year?: number;
    companyName: string;
    companyAddress?: string;
    corporateNumber?: string;
    employeeName: string;
    employeeNameKana?: string;
    employeeAddress: string;
    myNumber?: string;
    birthDate?: string;
    householderName?: string;
    householderRelation?: string;
    hasSpouse?: boolean;
    spouseName?: string;
    spouseIncomeEstimate?: number;
    dependents?: Array<{
      name: string;
      relation: string;
      birthDate: string;
      isLivingTogether?: boolean;
      incomeEstimate?: number;
      isUnder16?: boolean;
    }>;
    isDisability?: boolean;
    isSingleParent?: boolean;
    isWidow?: boolean;
    isWorkingStudent?: boolean;
    appliedDate: string;
  };
}

export const OfficialTaxExemptionDoc: React.FC<TaxExemptionDocProps> = ({ data }) => {
  const year = data.year || 2026;
  const under16Dependents = (data.dependents || []).filter(d => d.isUnder16);
  const regularDependents = (data.dependents || []).filter(d => !d.isUnder16);

  return (
    <div className="bg-white text-slate-900 font-sans p-6 max-w-[840px] mx-auto border border-slate-300 print:border-none print:p-0 print:m-0 print:max-w-none print:w-full print:text-black">
      {/* 印刷用スタイル */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 10mm;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>

      {/* 表題部 */}
      <div className="border-b-2 border-slate-900 pb-2 mb-3 flex items-end justify-between">
        <div>
          <div className="text-[10px] font-black text-slate-500 tracking-widest uppercase">
            所得税法第194条・国税庁公式準拠様式
          </div>
          <h1 className="text-xl font-black text-slate-950 tracking-tight">
            令和{year - 2018}年分 給与所得者の扶養控除等（異動）申告書
          </h1>
          <p className="text-[10px] text-slate-500 mt-0.5">
            （主たる給与の支払者へ提出 / 源泉徴収税額表の甲欄適用申告）
          </p>
        </div>

        <div className="text-right border border-slate-300 p-1 rounded text-[10px]">
          <div className="text-[8px] text-slate-400 font-bold">給与支払者（会社）受付印</div>
          <div className="w-16 h-10 flex items-center justify-center font-bold text-slate-300 text-xs">
            受付印
          </div>
        </div>
      </div>

      {/* 会社情報 ＆ 本人情報 テーブル */}
      <div className="border border-slate-900 text-xs mb-3">
        <div className="grid grid-cols-12 border-b border-slate-300 bg-slate-50 font-bold text-[10px]">
          <div className="col-span-6 p-1.5 border-r border-slate-300">給与の支払者（会社）の名称・所在地</div>
          <div className="col-span-6 p-1.5">給与所得者（あなた）の氏名・住所</div>
        </div>

        <div className="grid grid-cols-12 text-xs">
          <div className="col-span-6 p-2 border-r border-slate-300 space-y-1">
            <div className="text-[10px] text-slate-500">法人名 / 屋号:</div>
            <div className="font-black text-sm">{data.companyName}</div>
            <div className="text-[10px] text-slate-500">所在地: {data.companyAddress || '本社所在地'}</div>
            <div className="text-[10px] text-slate-400">法人番号: {data.corporateNumber || '未登録'}</div>
          </div>

          <div className="col-span-6 p-2 space-y-1">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-[9px] text-slate-400">フリガナ: {data.employeeNameKana || '―'}</div>
                <div className="font-black text-base">{data.employeeName}</div>
              </div>
              <div className="text-right text-[10px]">
                <div className="text-slate-400">世帯主: <span className="font-bold text-slate-800">{data.householderName || data.employeeName}</span></div>
                <div className="text-slate-400">続柄: <span className="font-bold text-slate-800">{data.householderRelation || '本人'}</span></div>
              </div>
            </div>
            <div className="text-[10px] text-slate-600">住所: {data.employeeAddress}</div>
            <div className="text-[10px] text-slate-500">マイナンバー: <span className="font-mono tracking-widest">{data.myNumber ? '************' : '届出済'}</span></div>
          </div>
        </div>
      </div>

      {/* A. 源泉控除対象配偶者 */}
      <div className="border border-slate-900 text-xs mb-3">
        <div className="bg-slate-100 p-1 font-bold text-[10px] border-b border-slate-300 flex justify-between">
          <span>A. 源泉控除対象配偶者（あなたの合計所得が900万円以下かつ配偶者の所得が95万円以下）</span>
          <span>{data.hasSpouse ? '【該当あり】' : '【該当なし】'}</span>
        </div>

        {data.hasSpouse ? (
          <div className="p-2 grid grid-cols-4 gap-2 text-xs">
            <div>
              <span className="text-[9px] text-slate-500 block">配偶者の氏名</span>
              <span className="font-bold">{data.spouseName || '―'}</span>
            </div>
            <div>
              <span className="text-[9px] text-slate-500 block">続柄</span>
              <span className="font-bold">妻 / 夫</span>
            </div>
            <div>
              <span className="text-[9px] text-slate-500 block">生年月日</span>
              <span className="font-bold">登録済</span>
            </div>
            <div>
              <span className="text-[9px] text-slate-500 block">本年中の所得の見積額</span>
              <span className="font-bold">¥{data.spouseIncomeEstimate?.toLocaleString() || 0}</span>
            </div>
          </div>
        ) : (
          <div className="p-2 text-center text-slate-400 text-xs font-bold">該当する配偶者はいません</div>
        )}
      </div>

      {/* B. 控除対象扶養親族（16歳以上） */}
      <div className="border border-slate-900 text-xs mb-3">
        <div className="bg-slate-100 p-1 font-bold text-[10px] border-b border-slate-300 flex justify-between">
          <span>B. 控除対象扶養親族（平成23年1月1日以前に生まれた方・所得48万円以下）</span>
          <span>該当: {regularDependents.length}名</span>
        </div>

        {regularDependents.length > 0 ? (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[9px] border-b border-slate-300 text-slate-600">
                <th className="p-1.5">氏名</th>
                <th className="p-1.5">続柄</th>
                <th className="p-1.5">生年月日</th>
                <th className="p-1.5">同居区分</th>
                <th className="p-1.5 text-right">所得見積額</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {regularDependents.map((dep, idx) => (
                <tr key={idx}>
                  <td className="p-1.5 font-bold">{dep.name}</td>
                  <td className="p-1.5">{dep.relation}</td>
                  <td className="p-1.5">{dep.birthDate}</td>
                  <td className="p-1.5">{dep.isLivingTogether ? '同居' : '別居'}</td>
                  <td className="p-1.5 text-right">¥{dep.incomeEstimate?.toLocaleString() || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-2 text-center text-slate-400 text-xs font-bold">該当する控除対象扶養親族はいません</div>
        )}
      </div>

      {/* C. 障害者・寡婦・ひとり親・勤労学生控除 */}
      <div className="border border-slate-900 text-xs mb-3">
        <div className="bg-slate-100 p-1 font-bold text-[10px] border-b border-slate-300">
          C. 障害者、寡婦、ひとり親又は勤労学生
        </div>
        <div className="p-2 grid grid-cols-4 gap-2 text-xs text-center font-bold">
          <div className={`p-1.5 rounded border ${data.isDisability ? 'bg-indigo-50 border-indigo-400 text-indigo-800' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
            障害者控除: {data.isDisability ? '該当' : '非該当'}
          </div>
          <div className={`p-1.5 rounded border ${data.isSingleParent ? 'bg-indigo-50 border-indigo-400 text-indigo-800' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
            ひとり親控除: {data.isSingleParent ? '該当' : '非該当'}
          </div>
          <div className={`p-1.5 rounded border ${data.isWidow ? 'bg-indigo-50 border-indigo-400 text-indigo-800' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
            寡婦控除: {data.isWidow ? '該当' : '非該当'}
          </div>
          <div className={`p-1.5 rounded border ${data.isWorkingStudent ? 'bg-indigo-50 border-indigo-400 text-indigo-800' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
            勤労学生控除: {data.isWorkingStudent ? '該当' : '非該当'}
          </div>
        </div>
      </div>

      {/* 住民税に関する事項（16歳未満の年少扶養親族） */}
      <div className="border border-slate-900 text-xs mb-4">
        <div className="bg-slate-100 p-1 font-bold text-[10px] border-b border-slate-300 flex justify-between">
          <span>16歳未満の扶養親族（住民税に関する事項 / 平成23年1月2日以後に生まれた方）</span>
          <span>該当: {under16Dependents.length}名</span>
        </div>

        {under16Dependents.length > 0 ? (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[9px] border-b border-slate-300 text-slate-600">
                <th className="p-1.5">氏名</th>
                <th className="p-1.5">続柄</th>
                <th className="p-1.5">生年月日</th>
                <th className="p-1.5">同居区分</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {under16Dependents.map((dep, idx) => (
                <tr key={idx}>
                  <td className="p-1.5 font-bold">{dep.name}</td>
                  <td className="p-1.5">{dep.relation}</td>
                  <td className="p-1.5">{dep.birthDate}</td>
                  <td className="p-1.5">{dep.isLivingTogether ? '同居' : '別居'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-2 text-center text-slate-400 text-xs font-bold">16歳未満の扶養親族はいません</div>
        )}
      </div>

      {/* 申告誓約署名枠 */}
      <div className="border border-slate-300 p-3 bg-slate-50 rounded text-xs space-y-2">
        <p className="text-[10px] text-slate-600 leading-relaxed">
          私は、所得税法第194条第1項から第3項までの規定に基づき、上記のとおり申告いたします。また、本申告書に記載した事項は事実に相違ありません。
        </p>
        <div className="flex justify-between items-end pt-1">
          <div className="text-[10px] text-slate-500">
            提出日: <span className="font-bold text-slate-800">{data.appliedDate}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-slate-500">申告者（従業員氏名）:</span>
            <span className="font-black text-sm border-b border-slate-900 px-3 pb-0.5">{data.employeeName}</span>
            <span className="text-[10px] text-slate-400">（電子申告済）</span>
          </div>
        </div>
      </div>
    </div>
  );
};
