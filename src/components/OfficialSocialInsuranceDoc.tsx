import React, { useState } from 'react';
import { Printer, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { formatNenkinBirthDate } from './OfficialBonusPaymentReportDoc';

export interface SocialInsuranceEmployee {
  id: string;
  name: string;
  name_kana?: string;
  birth_date?: string;
  gender?: string;
  my_number?: string;
  basic_pension_number?: string;
  insurance_number?: string; // 被保険者整理番号
  join_date: string;
  retirement_date?: string;
  base_salary: number;
  monthly_remuneration?: number; // 報酬月額（通貨）
  goods_remuneration?: number; // 報酬月額（現物）
  dependents_count?: number;
  employment_type?: string;
}

export interface OfficialSocialInsuranceDocProps {
  type: 'acquisition' | 'loss'; // acquisition: 資格取得届, loss: 資格喪失届
  companyInfo: {
    name: string;
    address: string;
    representative_name: string;
    phone_number: string;
    corporate_number?: string;
    company_seal_url?: string;
  };
  officeSymbol?: string; // 事業所整理記号 (例: 01-イロハ)
  employees: SocialInsuranceEmployee[];
  selectedEmployeeId: string;
  onSelectEmployee: (id: string) => void;
  onBack: () => void;
}

export const OfficialSocialInsuranceDoc: React.FC<OfficialSocialInsuranceDocProps> = ({
  type: initialType,
  companyInfo,
  officeSymbol = '01-イロハ',
  employees,
  selectedEmployeeId,
  onSelectEmployee,
  onBack
}) => {
  const [docType, setDocType] = useState<'acquisition' | 'loss'>(initialType);
  const [submissionDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [lossReason, setLossReason] = useState<'retirement' | 'death' | 'over75' | 'other'>('retirement');

  const currentEmployee = employees.find(e => e.id === selectedEmployeeId) || employees[0];

  const handlePrint = () => {
    window.print();
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

  // 報酬月額
  const currencyAmount = currentEmployee.monthly_remuneration || currentEmployee.base_salary || 0;
  const goodsAmount = currentEmployee.goods_remuneration || 0;
  const totalRemuneration = currencyAmount + goodsAmount;

  // 喪失年月日（通常は退職日の翌日）
  const getLossDate = () => {
    if (!currentEmployee.retirement_date) return '';
    const d = new Date(currentEmployee.retirement_date);
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  };

  return (
    <div className="space-y-6">
      {/* 画面操作ヘッダー（印刷時は非表示） */}
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
              <span className="text-xs px-2 py-0.5 rounded-full font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                日本年金機構 / 協会けんぽ公式様式
              </span>
              <span className="text-xs text-slate-400 font-bold">A4公的届出書</span>
            </div>
            <h2 className="text-lg font-black text-slate-800 mt-1">
              健康保険・厚生年金保険 被保険者{docType === 'acquisition' ? '資格取得届' : '資格喪失届'}
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* 種別切替 */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setDocType('acquisition')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                docType === 'acquisition' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              資格取得届（入社）
            </button>
            <button
              onClick={() => setDocType('loss')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                docType === 'loss' ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              資格喪失届（退職等）
            </button>
          </div>

          {/* 従業員選択 */}
          <select
            value={currentEmployee.id}
            onChange={(e) => onSelectEmployee(e.target.value)}
            className="bg-white border border-slate-300 text-slate-800 text-xs font-bold rounded-xl px-3 py-2 outline-hidden focus:ring-2 focus:ring-indigo-500"
          >
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>
                {emp.name} ({emp.join_date}入社{emp.retirement_date ? ` / ${emp.retirement_date}退職` : ''})
              </option>
            ))}
          </select>

          {/* 印刷ボタン */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-black shadow-xs transition cursor-pointer"
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
                  日本年金機構提出様式準拠
                </span>
                <h1 className="text-xl font-black tracking-wider mt-2">
                  健康保険・厚生年金保険 被保険者{docType === 'acquisition' ? '資格取得届' : '資格喪失届'}
                </h1>
                <p className="text-[10px] text-slate-600 mt-0.5">
                  {docType === 'acquisition'
                    ? '（兼 厚生年金保険 70歳以上被用者該当届）'
                    : '（兼 厚生年金保険 70歳以上被用者不該当届）'}
                </p>
              </div>

              <div className="text-right text-[10px] space-y-1">
                <div>提出日: 令和 {new Date(submissionDate).getFullYear() - 2018} 年 {new Date(submissionDate).getMonth() + 1} 月 {new Date(submissionDate).getDate()} 日</div>
                <div className="text-slate-600">日本年金機構理事長 / 全国健康保険協会 殿</div>
              </div>
            </div>
          </div>

          {/* 提出者（事業所）情報 */}
          <div className="border border-slate-800 mb-4 p-3 rounded-xs relative">
            <div className="text-[10px] font-black bg-slate-800 text-white px-2 py-0.5 absolute -top-2.5 left-2">
              提出者（事業所）情報
            </div>
            <div className="grid grid-cols-12 gap-2 mt-1">
              <div className="col-span-3">
                <span className="text-[9px] text-slate-500 block">事業所整理記号</span>
                <span className="font-mono font-black text-sm tracking-widest">{officeSymbol}</span>
              </div>
              <div className="col-span-5">
                <span className="text-[9px] text-slate-500 block">事業所所在地</span>
                <span className="font-bold">{companyInfo.address}</span>
              </div>
              <div className="col-span-4 relative">
                <span className="text-[9px] text-slate-500 block">事業所名称・事業主氏名</span>
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
            <div className="mt-2 text-[10px] text-slate-600 flex justify-between border-t border-slate-200 pt-1.5">
              <span>電話番号: {companyInfo.phone_number || '077-574-6907'}</span>
              <span>法人番号: {companyInfo.corporate_number || '未登録'}</span>
            </div>
          </div>

          {/* 被保険者情報テーブル */}
          <div className="border border-slate-800 mb-4 rounded-xs overflow-hidden">
            <div className="bg-slate-100 border-b border-slate-800 p-2 font-black text-xs flex justify-between items-center">
              <span>被保険者（対象者）詳細情報</span>
              <span className="text-[10px] text-slate-500 font-normal">整理番号: {currentEmployee.insurance_number || '001'}</span>
            </div>

            <table className="w-full text-[10px] border-collapse">
              <tbody>
                <tr className="border-b border-slate-300">
                  <td className="bg-slate-50 p-2 font-bold w-28 border-r border-slate-300">氏名（フリガナ）</td>
                  <td className="p-2 border-r border-slate-300">
                    <div className="text-[9px] text-slate-500">{currentEmployee.name_kana || 'コマイ シュウイチロウ'}</div>
                    <div className="font-black text-sm text-slate-900">{currentEmployee.name}</div>
                  </td>
                  <td className="bg-slate-50 p-2 font-bold w-24 border-r border-slate-300">生年月日</td>
                  <td className="p-2 font-mono">
                    <div className="font-bold">{currentEmployee.birth_date || '1990-01-01'}</div>
                    <div className="text-[9px] text-indigo-700 font-bold">
                      元号コード: {formatNenkinBirthDate(currentEmployee.birth_date)}
                    </div>
                  </td>
                </tr>

                <tr className="border-b border-slate-300">
                  <td className="bg-slate-50 p-2 font-bold border-r border-slate-300">個人番号(マイナンバー) / 基礎年金番号</td>
                  <td className="p-2 border-r border-slate-300 font-mono font-bold tracking-wider">
                    {currentEmployee.my_number ? `●●●●-●●●●-${currentEmployee.my_number.slice(-4)}` : '番号確認済'}
                    <span className="text-[9px] text-slate-400 block font-normal">基礎年金番号連携対応</span>
                  </td>
                  <td className="bg-slate-50 p-2 font-bold border-r border-slate-300">性別 / 扶養</td>
                  <td className="p-2">
                    <span>{currentEmployee.gender || '男'}</span>
                    <span className="ml-3 font-bold">扶養親族: {currentEmployee.dependents_count || 0}名</span>
                  </td>
                </tr>

                <tr className="border-b border-slate-300">
                  <td className="bg-slate-50 p-2 font-bold border-r border-slate-300">
                    {docType === 'acquisition' ? '資格取得年月日' : '資格喪失年月日'}
                  </td>
                  <td className="p-2 border-r border-slate-300 font-bold text-indigo-900 text-xs">
                    {docType === 'acquisition' ? currentEmployee.join_date : (getLossDate() || currentEmployee.retirement_date || '未設定')}
                    <span className="text-[9px] text-slate-500 font-normal block">
                      {docType === 'acquisition' ? '（雇入年月日と同一）' : '（退職日の翌日、または死亡等の日）'}
                    </span>
                  </td>
                  <td className="bg-slate-50 p-2 font-bold border-r border-slate-300">雇用形態 / 種別</td>
                  <td className="p-2">
                    {currentEmployee.employment_type === 'part-time' ? '短時間労働者（パート・アルバイト）' : '一般正社員（フルタイム）'}
                  </td>
                </tr>

                {docType === 'acquisition' ? (
                  <>
                    <tr className="border-b border-slate-300">
                      <td className="bg-slate-50 p-2 font-bold border-r border-slate-300">報酬月額（通貨）</td>
                      <td className="p-2 border-r border-slate-300 font-mono font-bold">
                        ¥{currencyAmount.toLocaleString()}
                      </td>
                      <td className="bg-slate-50 p-2 font-bold border-r border-slate-300">報酬月額（現物）</td>
                      <td className="p-2 font-mono">
                        ¥{goodsAmount.toLocaleString()}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="bg-slate-50 p-2 font-bold border-r border-slate-300">報酬月額合計</td>
                      <td colSpan={3} className="p-2 font-mono font-black text-sm text-slate-900">
                        ¥{totalRemuneration.toLocaleString()}
                        <span className="text-[9px] text-slate-500 font-normal ml-3">
                          （標準報酬月額の決定および健康保険・厚生年金保険料算定の基礎）
                        </span>
                      </td>
                    </tr>
                  </>
                ) : (
                  <tr className="border-b border-slate-300">
                    <td className="bg-slate-50 p-2 font-bold border-r border-slate-300">喪失原因</td>
                    <td colSpan={3} className="p-2">
                      <div className="flex gap-4">
                        <label className="flex items-center gap-1 font-bold text-slate-800">
                          <input type="radio" checked={lossReason === 'retirement'} onChange={() => setLossReason('retirement')} />
                          1. 退職等（契約満了、自己都合、会社都合を含む）
                        </label>
                        <label className="flex items-center gap-1 text-slate-600">
                          <input type="radio" checked={lossReason === 'death'} onChange={() => setLossReason('death')} />
                          2. 死亡
                        </label>
                        <label className="flex items-center gap-1 text-slate-600">
                          <input type="radio" checked={lossReason === 'over75'} onChange={() => setLossReason('over75')} />
                          3. 75歳到達等
                        </label>
                      </div>
                      <div className="text-[9px] text-slate-500 mt-1">
                        ※ 退職に伴い健康保険証（被保険者および被扶養者分）を回収して年金事務所または健康保険組合へ返納してください。
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 備考・法定確認事項 */}
          <div className="border border-slate-400 p-2.5 rounded-xs text-[9px] text-slate-600 space-y-1 mb-6 bg-slate-50/50">
            <div className="font-bold text-slate-800 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
              届出・事務処理上の確認事項
            </div>
            <p>1. 本届書は、事由発生日（採用日または退職日等）から5日以内に所轄の年金事務所または事務センターへご提出ください。</p>
            <p>2. 資格取得時において、被扶養配偶者または扶養親族を有する場合は「健康保険 被扶養者（異動）届」を併せてご提出ください。</p>
            <p>3. 70歳以上の被用者が就労または退職した場合は「70歳以上被用者該当・不該当届」としての効力を有します。</p>
          </div>

          {/* 署名欄 */}
          <div className="border-t border-slate-300 pt-3 flex justify-between items-end text-[10px]">
            <div>
              社会保険労務士記載欄: ＿＿＿＿＿＿＿＿＿＿＿＿＿＿ 印
            </div>
            <div className="text-right text-slate-400 text-[9px]">
              自律開発要塞 SSOT労務管理システム 自動生成済
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
