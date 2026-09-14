import React, { useState } from 'react';
import { Printer, Download, ArrowLeft, CheckCircle2 } from 'lucide-react';

export interface LaborInsuranceEmployee {
  id: string;
  name: string;
  department?: string;
  role: string;
  employment_type?: string; // 'full-time' | 'part-time' | 'executive'
  base_salary: number;
  is_retired?: boolean;
  employment_insurance_joined?: boolean;
  health_insurance_joined?: boolean;
}

export interface OfficialLaborInsuranceReportDocProps {
  companyInfo: {
    name: string;
    address: string;
    representative_name: string;
    phone_number: string;
    corporate_number?: string;
    company_seal_url?: string;
  };
  laborInsuranceNumber?: string; // 労働保険番号 (例: 25-1-02-123456-000)
  employees: LaborInsuranceEmployee[];
  targetFiscalYear?: number; // 対象年度 (例: 2026)
  onBack: () => void;
}

export const OfficialLaborInsuranceReportDoc: React.FC<OfficialLaborInsuranceReportDocProps> = ({
  companyInfo,
  laborInsuranceNumber = '25-1-02-123456-000',
  employees,
  targetFiscalYear = new Date().getFullYear(),
  onBack
}) => {
  const [fiscalYear, setFiscalYear] = useState<number>(targetFiscalYear);
  // 保険料率設定（初期値：一般事業の標準値）
  const accidentInsuranceRate = 3.0; // 労災保険率 3.0/1000 (千分率)
  const employmentInsuranceRate = 15.5; // 雇用保険率 15.5/1000 (一般事業)
  const generalContributionRate = 0.02; // 一般拠出金率 0.02/1000

  const handlePrint = () => {
    window.print();
  };

  // 全従業員の賃金集計（年間想定額）
  // 役員（executive）は労災・雇用対象外
  const eligibleEmployees = employees.map(emp => {
    const isExecutive = emp.employment_type === 'executive' || emp.role?.includes('役員') || emp.role?.includes('代表');
    const isPartTime = emp.employment_type === 'part-time';
    
    // 年間賃金概算（月給 × 12 + 賞与2ヶ月想定）
    const monthlyWage = emp.base_salary || 250000;
    const annualWage = monthlyWage * 14;

    const isAccidentEligible = !isExecutive; // 役員以外は全員労災対象
    const isEmploymentEligible = !isExecutive && (emp.employment_insurance_joined !== false); // 雇用保険加入者

    return {
      ...emp,
      isExecutive,
      isPartTime,
      annualWage,
      isAccidentEligible,
      isEmploymentEligible
    };
  });

  // 1. 労災保険対象
  const accidentWorkers = eligibleEmployees.filter(e => e.isAccidentEligible);
  const accidentTotalWage = accidentWorkers.reduce((sum, e) => sum + e.annualWage, 0);
  const accidentPremium = Math.floor((accidentTotalWage * accidentInsuranceRate) / 1000);

  // 2. 雇用保険対象
  const employmentWorkers = eligibleEmployees.filter(e => e.isEmploymentEligible);
  const employmentTotalWage = employmentWorkers.reduce((sum, e) => sum + e.annualWage, 0);
  const employmentPremium = Math.floor((employmentTotalWage * employmentInsuranceRate) / 1000);

  // 3. 一般拠出金 (労災対象賃金総額に掛かる)
  const generalContribution = Math.floor((accidentTotalWage * generalContributionRate) / 1000);

  // 確定保険料合計
  const totalDefinitePremium = accidentPremium + employmentPremium + generalContribution;

  // CSVダウンロード
  const handleExportCsv = () => {
    const headers = ['従業員名', '役職/種別', '年間賃金総額', '労災保険対象', '雇用保険対象'];
    const rows = eligibleEmployees.map(e => [
      e.name,
      e.isExecutive ? '役員' : e.isPartTime ? '短時間労働者' : '一般正社員',
      e.annualWage,
      e.isAccidentEligible ? '○' : '×',
      e.isEmploymentEligible ? '○' : '×'
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `労働保険料算定基礎資料_${fiscalYear}年度.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* 操作ヘッダー */}
      <div className="print:hidden bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
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
              <span className="text-xs px-2 py-0.5 rounded-full font-black bg-cyan-50 text-cyan-700 border border-cyan-200">
                労働基準監督署・労働局提出用
              </span>
              <span className="text-xs text-slate-400 font-bold">年1回 6〜7月申告</span>
            </div>
            <h2 className="text-lg font-black text-slate-800 mt-1">
              労働保険 概算・確定保険料 算定基礎資料（年度更新申告書転記シート）
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* 年度選択 */}
          <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
            <span className="text-xs font-bold text-slate-600">申告年度:</span>
            <select
              value={fiscalYear}
              onChange={(e) => setFiscalYear(Number(e.target.value))}
              className="bg-transparent font-black text-xs text-slate-800 outline-hidden cursor-pointer"
            >
              {[fiscalYear - 1, fiscalYear, fiscalYear + 1].map(y => (
                <option key={y} value={y}>令和{y - 2018}年度 ({y}年)</option>
              ))}
            </select>
          </div>

          {/* CSVボタン */}
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-500" />
            CSV出力
          </button>

          {/* 印刷ボタン */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-xl text-xs font-black shadow-xs transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            公式A4印刷 / PDF保存
          </button>
        </div>
      </div>

      {/* 印刷・公式A4原本コンテナ */}
      <div className="bg-slate-100 p-2 sm:p-6 rounded-2xl flex justify-center overflow-x-auto print:p-0 print:m-0 print:bg-white print:overflow-visible">
        <div className="w-[210mm] min-h-[297mm] bg-white p-[15mm] shadow-lg border border-slate-300 text-slate-900 font-sans print:shadow-none print:border-none print:p-0 print:w-full print:m-0 box-border text-[11px] leading-tight">

          {/* 表題部 */}
          <div className="border-b-2 border-slate-900 pb-3 mb-4">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold border border-slate-700 px-2 py-0.5">
                  労働保険年度更新 算定基礎様式準拠
                </span>
                <h1 className="text-xl font-black tracking-wider mt-2">
                  労働保険 確定・概算保険料 算定基礎賃金等の報告集計表
                </h1>
                <p className="text-[10px] text-slate-600 mt-0.5">
                  （令和{fiscalYear - 2018}年度 確定保険料申告 兼 令和{fiscalYear - 2017}年度 概算保険料申告用）
                </p>
              </div>

              <div className="text-right text-[10px] space-y-1">
                <div>算定対象期間: 令和{fiscalYear - 2019}年4月1日 〜 令和{fiscalYear - 2018}年3月31日</div>
                <div className="text-slate-600">所轄労働基準監督署長・都道府県労働局長 殿</div>
              </div>
            </div>
          </div>

          {/* 事業所情報 */}
          <div className="border border-slate-800 mb-4 p-3 rounded-xs relative">
            <div className="text-[10px] font-black bg-slate-800 text-white px-2 py-0.5 absolute -top-2.5 left-2">
              事業所情報
            </div>
            <div className="grid grid-cols-12 gap-2 mt-1">
              <div className="col-span-3">
                <span className="text-[9px] text-slate-500 block">労働保険番号</span>
                <span className="font-mono font-black text-sm tracking-widest">{laborInsuranceNumber}</span>
              </div>
              <div className="col-span-5">
                <span className="text-[9px] text-slate-500 block">事業所在地</span>
                <span className="font-bold">{companyInfo.address}</span>
              </div>
              <div className="col-span-4 relative">
                <span className="text-[9px] text-slate-500 block">事業の名称・事業主氏名</span>
                <span className="font-black block">{companyInfo.name}</span>
                <span className="font-bold text-xs">{companyInfo.representative_name} 印</span>
                {companyInfo.company_seal_url && (
                  <img
                    src={companyInfo.company_seal_url}
                    alt="社印"
                    className="absolute right-2 top-0 w-12 h-12 object-contain pointer-events-none opacity-85"
                  />
                )}
              </div>
            </div>
          </div>

          {/* 保険料算定サマリー（申告書そのまま転記ブロック） */}
          <div className="border-2 border-slate-900 mb-4 rounded-xs overflow-hidden">
            <div className="bg-slate-900 text-white p-2 font-black text-xs flex justify-between items-center">
              <span>【重要】申告書転記用 保険料算定内訳（確定額・概算額）</span>
              <span className="text-[10px] text-cyan-300 font-normal">全社給与データより自動集計済</span>
            </div>

            <table className="w-full text-[10px] border-collapse text-center">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 font-bold">
                  <th className="p-2 border-r border-slate-300 text-left">保険区分</th>
                  <th className="p-2 border-r border-slate-300 w-20">常時労働者数</th>
                  <th className="p-2 border-r border-slate-300">算定賃金総額 (千円未満切捨)</th>
                  <th className="p-2 border-r border-slate-300 w-24">適用料率</th>
                  <th className="p-2 text-right pr-4">保険料算定額</th>
                </tr>
              </thead>
              <tbody>
                {/* 1. 労災保険分 */}
                <tr className="border-b border-slate-300">
                  <td className="p-2 border-r border-slate-300 text-left font-bold bg-slate-50">
                    労災保険分（役員除く全労働者・短時間含む）
                  </td>
                  <td className="p-2 border-r border-slate-300 font-mono font-bold">{accidentWorkers.length} 名</td>
                  <td className="p-2 border-r border-slate-300 font-mono font-bold text-right pr-4">
                    ¥{accidentTotalWage.toLocaleString()}
                  </td>
                  <td className="p-2 border-r border-slate-300 font-mono">
                    {accidentInsuranceRate} / 1,000
                  </td>
                  <td className="p-2 font-mono font-black text-right pr-4 text-xs">
                    ¥{accidentPremium.toLocaleString()}
                  </td>
                </tr>

                {/* 2. 雇用保険分 */}
                <tr className="border-b border-slate-300">
                  <td className="p-2 border-r border-slate-300 text-left font-bold bg-slate-50">
                    雇用保険分（被保険者対象労働者のみ）
                  </td>
                  <td className="p-2 border-r border-slate-300 font-mono font-bold">{employmentWorkers.length} 名</td>
                  <td className="p-2 border-r border-slate-300 font-mono font-bold text-right pr-4">
                    ¥{employmentTotalWage.toLocaleString()}
                  </td>
                  <td className="p-2 border-r border-slate-300 font-mono">
                    {employmentInsuranceRate} / 1,000
                  </td>
                  <td className="p-2 font-mono font-black text-right pr-4 text-xs">
                    ¥{employmentPremium.toLocaleString()}
                  </td>
                </tr>

                {/* 3. 一般拠出金 */}
                <tr className="border-b border-slate-300">
                  <td className="p-2 border-r border-slate-300 text-left font-bold bg-slate-50">
                    一般拠出金（石綿健康被害救済法）
                  </td>
                  <td className="p-2 border-r border-slate-300 font-mono">{accidentWorkers.length} 名</td>
                  <td className="p-2 border-r border-slate-300 font-mono text-right pr-4">
                    ¥{accidentTotalWage.toLocaleString()}
                  </td>
                  <td className="p-2 border-r border-slate-300 font-mono">
                    0.02 / 1,000
                  </td>
                  <td className="p-2 font-mono font-bold text-right pr-4">
                    ¥{generalContribution.toLocaleString()}
                  </td>
                </tr>

                {/* 合計 */}
                <tr className="bg-cyan-50 font-black text-xs border-t-2 border-slate-900">
                  <td colSpan={4} className="p-2.5 border-r border-slate-300 text-right pr-4 text-cyan-950">
                    確定保険料・一般拠出金 申告納付合計額:
                  </td>
                  <td className="p-2.5 font-mono text-right pr-4 text-cyan-900 text-sm font-black">
                    ¥{totalDefinitePremium.toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 従業員別賃金内訳表 */}
          <div className="border border-slate-800 mb-4 rounded-xs overflow-hidden">
            <div className="bg-slate-100 border-b border-slate-800 p-2 font-black text-xs flex justify-between items-center">
              <span>対象従業員別 賃金内訳明細書</span>
              <span className="text-[10px] text-slate-500 font-normal">全 {employees.length} 名</span>
            </div>

            <table className="w-full text-[9px] border-collapse text-center">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-300 text-slate-600">
                  <th className="p-1 border-r border-slate-300 w-8">No</th>
                  <th className="p-1 border-r border-slate-300 text-left pl-2">氏名</th>
                  <th className="p-1 border-r border-slate-300">区分</th>
                  <th className="p-1 border-r border-slate-300 text-right pr-2">年間算定賃金額</th>
                  <th className="p-1 border-r border-slate-300 w-16">労災該否</th>
                  <th className="p-1 w-16">雇用該否</th>
                </tr>
              </thead>
              <tbody>
                {eligibleEmployees.map((emp, idx) => (
                  <tr key={emp.id} className="border-b border-slate-200">
                    <td className="p-1 border-r border-slate-300 font-mono">{idx + 1}</td>
                    <td className="p-1 border-r border-slate-300 text-left pl-2 font-bold">{emp.name}</td>
                    <td className="p-1 border-r border-slate-300 text-slate-500">
                      {emp.isExecutive ? '役員' : emp.isPartTime ? 'パート' : '正社員'}
                    </td>
                    <td className="p-1 border-r border-slate-300 font-mono text-right pr-2 font-bold">
                      ¥{emp.annualWage.toLocaleString()}
                    </td>
                    <td className="p-1 border-r border-slate-300">
                      {emp.isAccidentEligible ? (
                        <span className="text-emerald-700 font-bold">対象</span>
                      ) : (
                        <span className="text-slate-400">除外</span>
                      )}
                    </td>
                    <td className="p-1">
                      {emp.isEmploymentEligible ? (
                        <span className="text-cyan-700 font-bold">対象</span>
                      ) : (
                        <span className="text-slate-400">除外</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 法定案内事項 */}
          <div className="border border-slate-400 p-2 rounded-xs text-[9px] text-slate-600 space-y-1 mb-4 bg-slate-50/50">
            <div className="font-bold text-slate-800 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-cyan-600" />
              申告手続・納付案内
            </div>
            <p>1. 労働保険の年度更新期間は、毎年6月1日から7月10日までです。所轄の労働基準監督署、都道府県労働局、または金融機関窓口にて申告・納付してください。</p>
            <p>2. 法人の役員（業務執行権を有する取締役・代表者等）は、労災保険および雇用保険の対象から除外して算定しています。</p>
          </div>

          {/* 署名欄 */}
          <div className="border-t border-slate-300 pt-2 flex justify-between items-end text-[10px]">
            <div>
              算定作成担当者: ＿＿＿＿＿＿＿＿＿＿ 印
            </div>
            <div className="text-right text-slate-400 text-[9px]">
              自律開発要塞 SSOT労務管理システム 労働保険年度更新自動算定
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
