import React from 'react';
import type { LaborContractTemplate } from '../lib/laborContractTemplate';
import { DEFAULT_LABOR_CONTRACT_TEMPLATE } from '../lib/laborContractTemplate';

export interface LaborContractData {
  companyName: string;
  companyAddress: string;
  representativeName: string;
  employeeName: string;
  employeeAddress?: string;
  joinDate: string;
  contractType: 'indefinite' | 'fixed_term';
  contractStartDate?: string;
  contractEndDate?: string;
  contractRenewType?: string;
  trialPeriodMonths: number;
  workLocation: string;
  jobDescription: string;
  startTime: string;
  endTime: string;
  breakTimeMinutes: number;
  overtimeWork: string;
  holidaysText: string;
  paidLeaveGrantDays: number;
  salaryType: 'monthly' | 'hourly' | 'daily';
  baseSalary: number;
  hourlyWage: number;
  positionAllowance: number;
  qualificationAllowance: number;
  housingAllowance: number;
  familyAllowance: number;
  commutingAllowance: number;
  fixedOvertimeHours: number;
  fixedOvertimeAllowance: number;
  closingDayText?: string;
  paymentDayText?: string;
  bonusPolicy: string;
  raisePolicy: string;
  retirementAllowance: string;
  healthInsuranceJoined: boolean;
  pensionInsuranceJoined: boolean;
  employmentInsuranceJoined: boolean;
  workersCompJoined: boolean;
  createdDate?: string;
  companySealUrl?: string; // 社印・角印の印影画像
  template?: Partial<LaborContractTemplate>; // 全社マスタ条文テンプレート
  // 📝 電子署名・電磁的合意情報
  isEmployeeSigned?: boolean; // 労働者による電子署名・合意の有無
  employeeSignedAt?: string; // 電子署名日時（タイムスタンプ）
  employeeSignIp?: string; // 承諾時IPアドレス
  employeeSignatureImage?: string; // 手書き署名または認印画像
}

interface OfficialLaborContractDocProps {
  data: LaborContractData;
}

export const OfficialLaborContractDoc: React.FC<OfficialLaborContractDocProps> = ({ data }) => {
  const isFixedTerm = data.contractType === 'fixed_term';
  const isHourly = data.salaryType === 'hourly';

  const tpl: LaborContractTemplate = {
    ...DEFAULT_LABOR_CONTRACT_TEMPLATE,
    ...(data.template || {})
  };

  const rawSeal = data.companySealUrl || tpl.company_seal_url;
  const isValidImage = (src?: string) => !!src && (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:image/'));
  const sealImg = isValidImage(rawSeal) ? rawSeal : undefined;

  const docDate = data.createdDate || new Date().toISOString().split('T')[0];
  const [docY, docM, docD] = docDate.split('-');

  // 労働者の姓（印鑑用）
  const empLastName = (data.employeeName || '印').trim().split(/[\s　]+/)[0] || '印';

  return (
    <div className="bg-white p-6 sm:p-10 max-w-4xl mx-auto text-slate-800 font-sans text-xs leading-relaxed select-text print:p-0 print:m-0 print:max-w-none shadow-sm rounded-2xl border border-slate-200">
      
      {/* 表題 */}
      <div className="text-center pb-4 border-b-2 border-slate-900 mb-6">
        <div className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-1">
          労働基準法第15条および労働基準法施行規則第5条に基づく
        </div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          労働条件通知書 兼 雇用契約書
        </h1>
        <p className="text-[10px] text-slate-500 mt-1">
          {data.companyName}（以下「甲」という）と {data.employeeName}（以下「乙」という）は、以下の条件により雇用契約を締結する。
        </p>
      </div>

      {/* 契約当事者ヘッダー */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div>
          <span className="text-[10px] font-bold text-slate-500 block">【雇用者（甲）】</span>
          <div className="font-bold text-slate-800 text-sm mt-0.5">{data.companyName}</div>
          <div className="text-[11px] text-slate-600 mt-0.5">{data.companyAddress || '本社所在地'}</div>
          <div className="text-[11px] text-slate-600">{data.representativeName || '代表取締役'}</div>
        </div>
        <div>
          <span className="text-[10px] font-bold text-slate-500 block">【労働者（乙）】</span>
          <div className="font-bold text-slate-800 text-sm mt-0.5">{data.employeeName} 殿</div>
          <div className="text-[11px] text-slate-600 mt-0.5">{data.employeeAddress || '住所未記入'}</div>
          <div className="text-[11px] text-slate-600 mt-0.5">入社日（契約開始日）: {data.joinDate}</div>
        </div>
      </div>

      {/* 労働条件 明細テーブル */}
      <table className="w-full border-collapse border border-slate-300 mb-6 text-slate-800">
        <tbody>
          {/* 1. 契約期間 */}
          <tr className="border-b border-slate-200">
            <th className="w-1/4 bg-slate-100 p-2.5 font-bold text-left border-r border-slate-300">
              1. 契約期間
            </th>
            <td className="p-2.5">
              {isFixedTerm ? (
                <div>
                  <span className="font-bold">期間の定めあり:</span> {data.contractStartDate || data.joinDate} 〜 {data.contractEndDate || '未定'}
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    契約更新の有無: {data.contractRenewType || '自動更新する / 契約満了時の業務量・勤務成績により判断'}
                  </div>
                </div>
              ) : (
                <div>
                  <span className="font-bold">期間の定めなし（無期雇用）</span>
                  <div className="text-[11px] text-slate-600 mt-0.5">契約開始日: {data.joinDate}</div>
                </div>
              )}
              {data.trialPeriodMonths > 0 && (
                <div className="text-[11px] text-slate-600 mt-1 bg-amber-50 p-1.5 rounded border border-amber-200">
                  ※ 試用期間: 入社日より {data.trialPeriodMonths} ヶ月間（労働条件・賃金の変更なし）
                </div>
              )}
            </td>
          </tr>

          {/* 2. 就業場所・従事する業務 */}
          <tr className="border-b border-slate-200">
            <th className="bg-slate-100 p-2.5 font-bold text-left border-r border-slate-300">
              2. 就業場所 及び<br />従事すべき業務
            </th>
            <td className="p-2.5">
              <div className="mb-1">
                <span className="font-bold text-slate-700">就業場所:</span> {data.workLocation || tpl.work_location_default}
              </div>
              <div>
                <span className="font-bold text-slate-700">業務内容:</span> {data.jobDescription || tpl.job_description_default}
              </div>
              <div className="text-[10px] text-slate-500 mt-1 bg-slate-50 p-1.5 rounded border border-slate-200">
                ・{tpl.work_location_scope}<br />
                ・{tpl.job_description_scope}
              </div>
            </td>
          </tr>

          {/* 3. 労働時間・休憩 */}
          <tr className="border-b border-slate-200">
            <th className="bg-slate-100 p-2.5 font-bold text-left border-r border-slate-300">
              3. 始業・終業時刻<br />休憩・時間外労働
            </th>
            <td className="p-2.5">
              <div className="font-bold">
                始業 {data.startTime || '09:00'} 〜 終業 {data.endTime || '18:00'} （休憩時間 {data.breakTimeMinutes || 60}分）
              </div>
              <div className="text-[11px] text-slate-600 mt-0.5">
                時間外労働（残業）: <span className="font-bold">{data.overtimeWork || tpl.overtime_work_notes}</span>
              </div>
              {tpl.work_time_special_notes && (
                <div className="text-[10px] text-slate-500 mt-0.5">
                  ※ {tpl.work_time_special_notes}
                </div>
              )}
            </td>
          </tr>

          {/* 4. 休日・休暇 */}
          <tr className="border-b border-slate-200">
            <th className="bg-slate-100 p-2.5 font-bold text-left border-r border-slate-300">
              4. 休日・休暇
            </th>
            <td className="p-2.5">
              <div className="font-bold">{data.holidaysText || '完全週休2日制（土・日）、国民の祝日、年末年始休暇'}</div>
              <div className="text-[11px] text-slate-600 mt-0.5">
                {tpl.paid_leave_rules_article || `年次有給休暇: 雇入れの日から6ヶ月継続勤務し、所定労働日の8割以上出勤した場合に法定通り付与（初年度 ${data.paidLeaveGrantDays || 10}日）`}
              </div>
              {tpl.holidays_special_notes && (
                <div className="text-[10px] text-slate-500 mt-0.5">
                  ※ 特記事項: {tpl.holidays_special_notes}
                </div>
              )}
            </td>
          </tr>

          {/* 5. 賃金（基本給・手当） */}
          <tr className="border-b border-slate-200">
            <th className="bg-slate-100 p-2.5 font-bold text-left border-r border-slate-300">
              5. 賃金（給与）
            </th>
            <td className="p-2.5">
              <div className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-bold text-slate-700">{isHourly ? '基本時給:' : '基本月給:'}</span>
                  <span className="text-sm font-black text-indigo-700">
                    ¥{isHourly ? data.hourlyWage.toLocaleString() : data.baseSalary.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-slate-500">{isHourly ? '円 / 時間' : '円 / 月'}</span>
                </div>

                {/* 各種手当 */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-slate-600 pt-1 border-t border-slate-100">
                  {data.positionAllowance > 0 && <div>・役職手当: ¥{data.positionAllowance.toLocaleString()}</div>}
                  {data.qualificationAllowance > 0 && <div>・資格職能手当: ¥{data.qualificationAllowance.toLocaleString()}</div>}
                  {data.housingAllowance > 0 && <div>・住宅手当: ¥{data.housingAllowance.toLocaleString()}</div>}
                  {data.familyAllowance > 0 && <div>・家族手当: ¥{data.familyAllowance.toLocaleString()}</div>}
                  <div className="col-span-2">
                    ・通勤手当: {data.commutingAllowance > 0 
                      ? `¥${data.commutingAllowance.toLocaleString()}（${tpl.commuting_allowance_notes || '実費支給・非課税上限内'}）` 
                      : `${tpl.commuting_allowance_notes || '実費支給（非課税限度額内、月額上限150,000円まで・申請承認後に確定支給）'}`}
                  </div>
                </div>

                {data.fixedOvertimeHours > 0 && (
                  <div className="text-[10px] text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-200 mt-1">
                    ※ 固定残業手当: ¥{data.fixedOvertimeAllowance.toLocaleString()}（時間外労働 {data.fixedOvertimeHours} 時間分を含み、超過分は追加支給する。{tpl.fixed_overtime_clause}）
                  </div>
                )}

                <div className="text-[11px] text-slate-600 pt-1">
                  ・賃金締切日: {data.closingDayText || '毎月末日'} / 支払日: {data.paymentDayText || '当月25日（金融機関振込）'}
                </div>
                <div className="text-[11px] text-slate-600">
                  ・昇給・賞与・退職金: {tpl.raise_bonus_notes || `昇給: ${data.raisePolicy} / 賞与: ${data.bonusPolicy} / 退職金: ${data.retirementAllowance}`}
                </div>
              </div>
            </td>
          </tr>

          {/* 6. 社会保険等 */}
          <tr className="border-b border-slate-200">
            <th className="bg-slate-100 p-2.5 font-bold text-left border-r border-slate-300">
              6. 社会保険の適用
            </th>
            <td className="p-2.5">
              <div className="flex flex-wrap gap-3">
                <span className={`inline-flex items-center gap-1 font-bold ${data.healthInsuranceJoined ? 'text-emerald-700' : 'text-slate-400'}`}>
                  {data.healthInsuranceJoined ? '☑' : '☐'} 健康保険
                </span>
                <span className={`inline-flex items-center gap-1 font-bold ${data.pensionInsuranceJoined ? 'text-emerald-700' : 'text-slate-400'}`}>
                  {data.pensionInsuranceJoined ? '☑' : '☐'} 厚生年金
                </span>
                <span className={`inline-flex items-center gap-1 font-bold ${data.employmentInsuranceJoined ? 'text-emerald-700' : 'text-slate-400'}`}>
                  {data.employmentInsuranceJoined ? '☑' : '☐'} 雇用保険
                </span>
                <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                  ☑ 労災保険
                </span>
              </div>
            </td>
          </tr>

          {/* 7. 退職・解雇・定年に関する事項（就業規則連動） */}
          <tr>
            <th className="bg-slate-100 p-2.5 font-bold text-left border-r border-slate-300">
              7. 退職・解雇・定年<br />に関する事項
            </th>
            <td className="p-2.5 text-[11px] text-slate-600 space-y-1">
              <div>・{tpl.resignation_procedure_text} <span className="font-mono text-[10px] text-slate-400">（{tpl.resignation_rules_article}）</span></div>
              <div>・{tpl.retirement_age_text} <span className="font-mono text-[10px] text-slate-400">（{tpl.retirement_rules_article}）</span></div>
              <div>・{tpl.dismissal_procedure_text} <span className="font-mono text-[10px] text-slate-400">（{tpl.dismissal_rules_article}）</span></div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* 署名欄 */}
      <div className="pt-4 border-t border-slate-300">
        <p className="text-[11px] text-slate-600 mb-4">
          本書面の交付を受け、労働条件について説明を受け合意のうえ、本雇用契約を締結いたします。
        </p>

        <div className="text-right text-[11px] text-slate-600 mb-4">
          締結日: {docY}年 {docM}月 {docD}日
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* 甲 署名 */}
          <div className="border border-slate-300 p-3.5 rounded-xl relative bg-slate-50/40 min-h-[92px] flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-500 block mb-0.5">【事業主（甲）署名捺印】</span>
              <div className="text-xs font-bold text-slate-800">{data.companyName}</div>
              <div className="text-xs text-slate-700 mt-1 flex items-center justify-between">
                <span>{data.representativeName || '代表取締役 〇〇 〇〇'}</span>
                <span className="text-slate-400 font-serif text-[11px] pr-2">印</span>
              </div>
            </div>
            
            {/* 社印・印影画像 */}
            {sealImg ? (
              <div className="absolute right-3 top-3 w-16 h-16 pointer-events-none flex items-center justify-center">
                <img 
                  src={sealImg} 
                  alt="社印" 
                  className="max-w-full max-h-full object-contain mix-blend-multiply opacity-90 drop-shadow-xs select-none rotate-[-2deg]" 
                />
              </div>
            ) : (
              <div className="absolute right-4 top-4 w-10 h-10 border border-red-400/50 rounded flex items-center justify-center text-red-500 text-[8px] font-serif select-none">
                社印
              </div>
            )}
          </div>

          {/* 乙 署名 */}
          <div className="border border-slate-300 p-3.5 rounded-xl relative bg-slate-50/40 min-h-[92px] flex flex-col justify-between">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] font-bold text-slate-500 block">【労働者（乙）署名捺印】</span>
              {(data.isEmployeeSigned || data.employeeSignedAt) && (
                <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.2 rounded">
                  ✅ 電子合意締結済
                </span>
              )}
            </div>

            {(data.isEmployeeSigned || data.employeeSignedAt) ? (
              <div className="space-y-1">
                <div className="text-[11px] text-slate-600 truncate">
                  <span className="text-slate-400">ご住所:</span> {data.employeeAddress || '（会社登録住所に準拠）'}
                </div>
                <div className="text-xs font-bold text-slate-800 flex items-center justify-between relative pr-2">
                  <div><span className="text-slate-400 font-normal">ご署名:</span> {data.employeeName}</div>
                  <span className="text-slate-300 font-serif text-[11px]">印</span>

                  {/* 労働者の電子認印グラフィック（「印」の文字に美しく重ねる） */}
                  <div className="absolute right-0 top-[-6px] w-10 h-10 rounded-full border-2 border-red-600/90 bg-red-50/50 flex flex-col items-center justify-center text-red-600 font-serif select-none pointer-events-none rotate-[-4deg] shadow-2xs">
                    <span className="text-[9px] font-black leading-none">{empLastName.substring(0, 2)}</span>
                    <span className="text-[7px] font-bold leading-none scale-90">之印</span>
                  </div>
                </div>
                <div className="text-[9px] text-slate-400 font-mono pt-1 border-t border-slate-200 flex items-center justify-between">
                  <span>電子署名日時: {data.employeeSignedAt || `${docY}-${docM}-${docD}`}</span>
                  <span>電磁的合意記録済</span>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="text-[11px] text-slate-400">ご住所: {data.employeeAddress || '_____________________________________'}</div>
                <div className="text-xs text-slate-400">ご署名: ___________________________　　　　印</div>
                <p className="text-[9px] text-slate-400">※印刷して自筆署名・捺印、またはWebマイページにて電子同意を行ってください。</p>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};
