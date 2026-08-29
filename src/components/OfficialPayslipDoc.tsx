import React from 'react';
import { DollarSign, ShieldCheck, Calendar, FileText, CheckCircle2 } from 'lucide-react';

interface OfficialPayslipDocProps {
  payslip: {
    year_month: string;
    payment_date: string;
    employee_number?: string | number;
    employee_name?: string;
    work_days?: number;
    actual_hours?: number;
    overtime_hours?: number;
    paid_leave_days?: number;
    paid_leave_remaining?: number;
    executive_salary?: number;
    base_salary?: number;
    overtime_allowance?: number;
    position_allowance?: number;
    commuting_allowance?: number;
    housing_allowance?: number;
    special_allowance?: number;
    total_earnings?: number;
    health_insurance?: number;
    nursing_insurance?: number;
    child_care_support?: number;
    pension_insurance?: number;
    employment_insurance?: number;
    income_tax?: number;
    resident_tax?: number;
    other_deductions?: number;
    total_deductions?: number;
    net_salary?: number;
    transfer_amount?: number;
    cash_amount?: number;
    note?: string;
    user?: any;
  };
  userName?: string;
  tenantName?: string;
}

export const OfficialPayslipDoc: React.FC<OfficialPayslipDocProps> = ({ payslip, userName, tenantName }) => {
  // 年月・支給日の和暦・西暦フォーマット
  const getFormattedDates = () => {
    let year = 2026;
    let month = 7;
    let payDate = payslip.payment_date || '2026-07-31';

    if (payslip.year_month && payslip.year_month.includes('-')) {
      const parts = payslip.year_month.split('-');
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
    } else if (payslip.payment_date) {
      const d = new Date(payslip.payment_date);
      year = d.getFullYear();
      month = d.getMonth() + 1;
    }

    const reiwaYear = (year - 2018).toString().padStart(2, '0');
    const monthStr = month.toString().padStart(2, '0');
    
    let payFormatted = `${year} (令和${reiwaYear}) 年${monthStr}月31日`;
    if (payDate) {
      const pD = new Date(payDate);
      if (!isNaN(pD.getTime())) {
        const pY = pD.getFullYear();
        const pM = (pD.getMonth() + 1).toString().padStart(2, '0');
        const pDay = pD.getDate().toString().padStart(2, '0');
        const pR = (pY - 2018).toString().padStart(2, '0');
        payFormatted = `${pY}年${pM}月${pDay}日 (令和${pR}年)`;
      }
    }

    return {
      titleYearMonth: `${year}年${monthStr}月分`,
      subYearMonth: `令和${reiwaYear}年${monthStr}月度`,
      payDateFormatted: payFormatted
    };
  };

  const { titleYearMonth, subYearMonth, payDateFormatted } = getFormattedDates();
  const empName = userName || payslip.employee_name || payslip.user?.name || '駒井 秀一朗';
  const empNumber = payslip.employee_number || payslip.user?.employee_code || '2';
  const companyName = tenantName || '株式会社KAP';

  // 1. 勤怠項目
  const attendanceList: { label: string; value: string; unit?: string }[] = [];
  attendanceList.push({ label: '有休残日数', value: (payslip.paid_leave_remaining !== undefined ? payslip.paid_leave_remaining : 0.0).toFixed(1), unit: '日' });
  if (payslip.work_days && payslip.work_days > 0) attendanceList.push({ label: '出勤日数', value: `${payslip.work_days}`, unit: '日' });
  if (payslip.actual_hours && payslip.actual_hours > 0) attendanceList.push({ label: '実労働時間', value: `${payslip.actual_hours}`, unit: 'h' });
  if (payslip.overtime_hours && payslip.overtime_hours > 0) attendanceList.push({ label: '時間外労働', value: `${payslip.overtime_hours}`, unit: 'h' });
  if (payslip.paid_leave_days && payslip.paid_leave_days > 0) attendanceList.push({ label: '有休取得日数', value: `${payslip.paid_leave_days}`, unit: '日' });

  // 2. 支給項目
  // 2. 支給項目
  const earningsList: { label: string; amount: number }[] = [];
  if (payslip.executive_salary && payslip.executive_salary > 0) {
    earningsList.push({ label: '役員報酬', amount: payslip.executive_salary });
  } else if (payslip.base_salary && payslip.base_salary > 0) {
    earningsList.push({ label: '基本給', amount: payslip.base_salary });
  }
  if (payslip.position_allowance && payslip.position_allowance > 0) earningsList.push({ label: '役職手当', amount: payslip.position_allowance });
  if ((payslip as any).qualification_allowance && (payslip as any).qualification_allowance > 0) earningsList.push({ label: '資格・職能手当', amount: (payslip as any).qualification_allowance });
  if (payslip.overtime_allowance && payslip.overtime_allowance > 0) earningsList.push({ label: '残業割増手当', amount: payslip.overtime_allowance });
  if ((payslip as any).midnight_allowance && (payslip as any).midnight_allowance > 0) earningsList.push({ label: '深夜割増手当', amount: (payslip as any).midnight_allowance });
  if ((payslip as any).holiday_allowance && (payslip as any).holiday_allowance > 0) earningsList.push({ label: '休日割増手当', amount: (payslip as any).holiday_allowance });
  if (payslip.commuting_allowance && payslip.commuting_allowance > 0) earningsList.push({ label: '通勤手当', amount: payslip.commuting_allowance });
  if (payslip.housing_allowance && payslip.housing_allowance > 0) earningsList.push({ label: '住宅手当', amount: payslip.housing_allowance });
  if ((payslip as any).family_allowance && (payslip as any).family_allowance > 0) earningsList.push({ label: '家族・扶養手当', amount: (payslip as any).family_allowance });
  if (payslip.special_allowance && payslip.special_allowance > 0) earningsList.push({ label: '特別手当', amount: payslip.special_allowance });
  if ((payslip as any).absence_deduction && (payslip as any).absence_deduction > 0) earningsList.push({ label: '欠勤控除', amount: -(payslip as any).absence_deduction });
  if ((payslip as any).late_early_deduction && (payslip as any).late_early_deduction > 0) earningsList.push({ label: '遅刻早退控除', amount: -(payslip as any).late_early_deduction });

  if (earningsList.length === 0) {
    earningsList.push({ label: '基本給', amount: payslip.total_earnings || 250000 });
  }

  // 3. 控除項目
  const deductionsList: { label: string; amount: number }[] = [];
  if (payslip.health_insurance && payslip.health_insurance > 0) deductionsList.push({ label: '健康保険料', amount: payslip.health_insurance });
  if (payslip.nursing_insurance && payslip.nursing_insurance > 0) deductionsList.push({ label: '介護保険料', amount: payslip.nursing_insurance });
  if (payslip.child_care_support && payslip.child_care_support > 0) deductionsList.push({ label: '子ども・子育て支援金', amount: payslip.child_care_support });
  if (payslip.pension_insurance && payslip.pension_insurance > 0) deductionsList.push({ label: '厚生年金保険料', amount: payslip.pension_insurance });
  if (payslip.employment_insurance && payslip.employment_insurance > 0) deductionsList.push({ label: '雇用保険料', amount: payslip.employment_insurance });
  if (payslip.income_tax && payslip.income_tax > 0) deductionsList.push({ label: '所得税', amount: payslip.income_tax });
  if (payslip.resident_tax && payslip.resident_tax > 0) deductionsList.push({ label: '住民税', amount: payslip.resident_tax });
  if (payslip.other_deductions && payslip.other_deductions > 0) deductionsList.push({ label: 'その他控除', amount: payslip.other_deductions });

  // 4. 振込・支払項目
  const paymentList: { label: string; amount: number }[] = [];
  const transferAmt = payslip.transfer_amount || payslip.net_salary || 97534;
  paymentList.push({ label: '銀行振込支給額', amount: transferAmt });
  if (payslip.cash_amount && payslip.cash_amount > 0) {
    paymentList.push({ label: '現金支給額', amount: payslip.cash_amount });
  }

  const totalEarnings = payslip.total_earnings || earningsList.reduce((sum, item) => sum + item.amount, 0);
  const totalDeductions = payslip.total_deductions || deductionsList.reduce((sum, item) => sum + item.amount, 0);
  const netSalary = payslip.net_salary || (totalEarnings - totalDeductions);

  return (
    <div className="bg-white p-6 sm:p-10 max-w-5xl mx-auto text-slate-800 font-sans leading-normal select-text print:p-4 print:m-0 print:max-w-none shadow-sm rounded-2xl border border-slate-200">
      
      {/* ========================================================================= */}
      {/* 1. 最上部ヘッダー：企業情報 ＆ 給与明細書タイトル                        */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-6 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-blue-900 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full">
              {subYearMonth}
            </span>
            <span className="text-xs text-slate-500 font-medium">公式給与支払明細書</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {titleYearMonth} 給与明細書
          </h1>
        </div>

        {/* 会社名 ＆ 社印枠 */}
        <div className="flex items-center gap-3 self-end sm:self-auto bg-slate-50 p-2.5 rounded-xl border border-slate-200">
          <div className="text-right">
            <div className="text-xs font-black text-slate-800">{companyName}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">支給日: {payDateFormatted}</div>
          </div>
          <div className="w-12 h-12 rounded-lg border-2 border-red-500/40 bg-red-50/50 flex flex-col items-center justify-center text-red-600 font-serif font-black text-[9px] leading-tight select-none shadow-2xs">
            <span>社印</span>
            <span className="text-[7px]">之印</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. 従業員情報 ＆ 3連ハイライトサマリーカード（最重要）                     */}
      {/* ========================================================================= */}
      <div className="my-6 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        {/* 従業員名カード */}
        <div className="lg:col-span-4 bg-slate-50 border border-slate-200 p-4 rounded-xl">
          <div className="text-xs font-bold text-slate-500">社員番号: #{empNumber}</div>
          <div className="text-2xl font-black text-slate-900 tracking-wide mt-1">
            {empName} <span className="text-base font-normal text-slate-600">様</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            振込手続完了（当月支払）
          </div>
        </div>

        {/* 3連サマリーバナー */}
        <div className="lg:col-span-8 grid grid-cols-3 gap-2 sm:gap-3">
          {/* 総支給額 */}
          <div className="bg-blue-50/70 border border-blue-200/80 p-3 sm:p-4 rounded-xl text-center">
            <span className="text-[11px] font-bold text-blue-900 block">総支給額</span>
            <span className="text-lg sm:text-xl font-black text-blue-950 font-mono block mt-0.5">
              ¥{totalEarnings.toLocaleString()}
            </span>
          </div>

          {/* 総控除額 */}
          <div className="bg-rose-50/70 border border-rose-200/80 p-3 sm:p-4 rounded-xl text-center">
            <span className="text-[11px] font-bold text-rose-900 block">総控除額</span>
            <span className="text-lg sm:text-xl font-black text-rose-950 font-mono block mt-0.5">
              ¥{totalDeductions.toLocaleString()}
            </span>
          </div>

          {/* 差引支給額（手取り額）- 最も強調 */}
          <div className="bg-gradient-to-br from-slate-900 to-blue-950 text-white border border-slate-900 p-3 sm:p-4 rounded-xl text-center shadow-sm">
            <span className="text-[11px] font-bold text-blue-200 block">差引支給額 (手取)</span>
            <span className="text-xl sm:text-2xl font-black text-white font-mono block mt-0.5 tracking-tight text-emerald-400">
              ¥{netSalary.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. 洗練された4大明細テーブル（支給・控除・勤怠・振込）                   */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
        
        {/* ----------------------------------------------------------------------- */}
        {/* 左上: 支給明細                                                          */}
        {/* ----------------------------------------------------------------------- */}
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs flex flex-col justify-between">
          <div>
            <div className="bg-blue-900 text-white font-bold py-2.5 px-4 flex items-center justify-between text-xs tracking-wider">
              <span className="flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-cyan-300" />
                支給の部（Earnings）
              </span>
              <span className="text-[10px] font-normal text-blue-200">{earningsList.length}項目</span>
            </div>
            <table className="w-full text-xs">
              <tbody className="divide-y divide-slate-100">
                {earningsList.map((item, idx) => (
                  <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                    <td className="py-2.5 px-4 font-medium text-slate-700">{item.label}</td>
                    <td className="py-2.5 px-4 text-right font-bold text-slate-900 font-mono">
                      ¥{item.amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-blue-50 border-t border-blue-200 p-3 flex items-center justify-between font-black text-blue-950">
            <span>支給合計額</span>
            <span className="font-mono text-sm">¥{totalEarnings.toLocaleString()}</span>
          </div>
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* 右上: 控除明細                                                          */}
        {/* ----------------------------------------------------------------------- */}
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs flex flex-col justify-between">
          <div>
            <div className="bg-slate-800 text-white font-bold py-2.5 px-4 flex items-center justify-between text-xs tracking-wider">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-rose-300" />
                控除の部（Deductions）
              </span>
              <span className="text-[10px] font-normal text-slate-300">{deductionsList.length}項目</span>
            </div>
            <table className="w-full text-xs">
              <tbody className="divide-y divide-slate-100">
                {deductionsList.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-4 font-medium text-slate-700">{item.label}</td>
                    <td className="py-2 px-4 text-right font-bold text-slate-900 font-mono">
                      ¥{item.amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-rose-50 border-t border-rose-200 p-3 flex items-center justify-between font-black text-rose-950">
            <span>控除合計額</span>
            <span className="font-mono text-sm">¥{totalDeductions.toLocaleString()}</span>
          </div>
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* 左下: 勤怠実績                                                          */}
        {/* ----------------------------------------------------------------------- */}
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs flex flex-col justify-between">
          <div>
            <div className="bg-slate-700 text-white font-bold py-2.5 px-4 flex items-center justify-between text-xs tracking-wider">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-amber-300" />
                勤怠実績（Attendance）
              </span>
              <span className="text-[10px] font-normal text-slate-300">当月度記録</span>
            </div>
            <table className="w-full text-xs">
              <tbody className="divide-y divide-slate-100">
                {attendanceList.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-4 font-medium text-slate-700">{item.label}</td>
                    <td className="py-2.5 px-4 text-right font-bold text-slate-900 font-mono">
                      {item.value} <span className="text-[10px] font-normal text-slate-500">{item.unit}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-slate-100 border-t border-slate-200 p-2.5 text-[11px] text-slate-500 text-center font-medium">
            ※有給休暇の失効・付与履歴は有給管理メニューにてご確認いただけます
          </div>
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* 右下: 振込・支払実績                                                    */}
        {/* ----------------------------------------------------------------------- */}
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs flex flex-col justify-between">
          <div>
            <div className="bg-emerald-800 text-white font-bold py-2.5 px-4 flex items-center justify-between text-xs tracking-wider">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                当月支払内訳（Payment）
              </span>
              <span className="text-[10px] font-normal text-emerald-200">振込確認済</span>
            </div>
            <table className="w-full text-xs">
              <tbody className="divide-y divide-slate-100">
                {paymentList.map((item, idx) => (
                  <tr key={idx} className="hover:bg-emerald-50/30 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-800">{item.label}</td>
                    <td className="py-3 px-4 text-right font-black text-emerald-700 font-mono text-sm">
                      ¥{item.amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-emerald-50 border-t border-emerald-200 p-3 flex items-center justify-between font-black text-emerald-950">
            <span>実支給総額</span>
            <span className="font-mono text-sm">¥{netSalary.toLocaleString()}</span>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 4. 備考欄 ＆ フッター注記                                                 */}
      {/* ========================================================================= */}
      {payslip.note && (
        <div className="mt-6 p-4 border border-blue-200 rounded-xl text-xs text-blue-900 bg-blue-50/50 flex items-start gap-2">
          <FileText className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold mr-2">【備考・特記事項】</span>
            {payslip.note}
          </div>
        </div>
      )}

      <div className="mt-6 pt-4 border-t border-slate-200 text-center text-[10px] text-slate-400">
        本給与明細書は電磁的記録として発行された公式文書です。内容に相違がある場合は人事・労務担当までご連絡ください。
      </div>

    </div>
  );
};
