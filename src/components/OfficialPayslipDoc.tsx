import React from 'react';

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
    
    // 支給日のフォーマット
    let payFormatted = `${year} (令和${reiwaYear}) 年${monthStr}月31日`;
    if (payDate) {
      const pD = new Date(payDate);
      if (!isNaN(pD.getTime())) {
        const pY = pD.getFullYear();
        const pM = (pD.getMonth() + 1).toString().padStart(2, '0');
        const pDay = pD.getDate().toString().padStart(2, '0');
        const pR = (pY - 2018).toString().padStart(2, '0');
        payFormatted = `${pY} (令和${pR}) 年${pM}月${pDay}日`;
      }
    }

    return {
      titleYearMonth: `${year} (令和${reiwaYear}) 年${monthStr}月分`,
      payDateFormatted: payFormatted
    };
  };

  const { titleYearMonth, payDateFormatted } = getFormattedDates();

  const empName = userName || payslip.employee_name || payslip.user?.name || '駒井 秀一朗';
  const empNumber = payslip.employee_number || payslip.user?.employee_code || payslip.user?.id?.slice(0, 4) || '2';

  // 支給項目リスト
  const earningsList: { label: string; amount: number }[] = [];
  if (payslip.executive_salary && payslip.executive_salary > 0) {
    earningsList.push({ label: '役員報酬', amount: payslip.executive_salary });
  } else if (payslip.base_salary && payslip.base_salary > 0) {
    earningsList.push({ label: '基本給', amount: payslip.base_salary });
  }
  if (payslip.position_allowance && payslip.position_allowance > 0) earningsList.push({ label: '役職手当', amount: payslip.position_allowance });
  if (payslip.overtime_allowance && payslip.overtime_allowance > 0) earningsList.push({ label: '残業手当', amount: payslip.overtime_allowance });
  if (payslip.commuting_allowance && payslip.commuting_allowance > 0) earningsList.push({ label: '通勤手当', amount: payslip.commuting_allowance });
  if (payslip.housing_allowance && payslip.housing_allowance > 0) earningsList.push({ label: '住宅手当', amount: payslip.housing_allowance });
  if (payslip.special_allowance && payslip.special_allowance > 0) earningsList.push({ label: '特別手当', amount: payslip.special_allowance });

  if (earningsList.length === 0) {
    earningsList.push({ label: '役員報酬', amount: payslip.total_earnings || 169000 });
  }

  // 控除項目リスト
  const deductionsList: { label: string; amount: number }[] = [];
  if (payslip.health_insurance && payslip.health_insurance > 0) deductionsList.push({ label: '健康保険料', amount: payslip.health_insurance });
  if (payslip.nursing_insurance && payslip.nursing_insurance > 0) deductionsList.push({ label: '介護保険料', amount: payslip.nursing_insurance });
  if (payslip.child_care_support && payslip.child_care_support > 0) deductionsList.push({ label: '子ども・子育て支援金', amount: payslip.child_care_support });
  if (payslip.pension_insurance && payslip.pension_insurance > 0) deductionsList.push({ label: '厚生年金保険料', amount: payslip.pension_insurance });
  if (payslip.employment_insurance && payslip.employment_insurance > 0) deductionsList.push({ label: '雇用保険料', amount: payslip.employment_insurance });
  if (payslip.income_tax && payslip.income_tax > 0) deductionsList.push({ label: '所得税', amount: payslip.income_tax });
  if (payslip.resident_tax && payslip.resident_tax > 0) deductionsList.push({ label: '住民税', amount: payslip.resident_tax });
  if (payslip.other_deductions && payslip.other_deductions > 0) deductionsList.push({ label: 'その他控除', amount: payslip.other_deductions });

  // 勤怠項目リスト
  const attendanceList: { label: string; value: string }[] = [];
  attendanceList.push({ label: '有休残日数', value: (payslip.paid_leave_remaining !== undefined ? payslip.paid_leave_remaining : 0.0).toFixed(1) });
  if (payslip.work_days && payslip.work_days > 0) attendanceList.push({ label: '出勤日数', value: `${payslip.work_days} 日` });
  if (payslip.actual_hours && payslip.actual_hours > 0) attendanceList.push({ label: '総労働時間', value: `${payslip.actual_hours} 時間` });
  if (payslip.overtime_hours && payslip.overtime_hours > 0) attendanceList.push({ label: '残業時間', value: `${payslip.overtime_hours} 時間` });
  if (payslip.paid_leave_days && payslip.paid_leave_days > 0) attendanceList.push({ label: '有休取得日数', value: `${payslip.paid_leave_days} 日` });

  const totalEarnings = payslip.total_earnings || earningsList.reduce((sum, item) => sum + item.amount, 0);
  const totalDeductions = payslip.total_deductions || deductionsList.reduce((sum, item) => sum + item.amount, 0);
  const netSalary = payslip.net_salary || (totalEarnings - totalDeductions);

  return (
    <div className="bg-white p-8 sm:p-12 max-w-4xl mx-auto text-slate-900 font-sans leading-normal select-text print:p-0 print:m-0 print:max-w-none">
      
      {/* 1. 上部ヘッダー（年月・タイトル・氏名・社印枠） */}
      <div className="flex justify-between items-start mb-6">
        <div className="space-y-1.5">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            {titleYearMonth}　給与明細書
          </h1>
          <div className="text-xs text-slate-700 font-medium">
            支給日 : {payDateFormatted}
          </div>
          <div className="pt-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-wide">
              {empName} 様
            </h2>
            <div className="text-xs text-slate-700 font-medium mt-1">
              従業員番号 : {empNumber}
            </div>
          </div>
        </div>

        {/* 会社印・ロゴ用 角丸枠 */}
        <div className="flex flex-col items-end">
          <div className="w-28 h-20 sm:w-32 sm:h-24 border border-slate-400 rounded-xl bg-white flex flex-col items-center justify-center p-2 text-center shadow-2xs">
            <span className="text-[10px] text-slate-400 font-medium block">
              {tenantName || '株式会社cocotte'}
            </span>
            <span className="text-[9px] text-slate-300 block mt-1">社印</span>
          </div>
        </div>
      </div>

      {/* 2. 差引支給額ハイライト ＆ 境界線 */}
      <div className="flex justify-end items-baseline gap-3 mb-2 pr-2">
        <span className="text-xs font-bold text-slate-700">差引支給額</span>
        <span className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">
          {netSalary.toLocaleString()}
        </span>
        <span className="text-xs font-bold text-slate-700">円</span>
      </div>

      {/* 濃い青色の水平仕切り線 */}
      <div className="w-full h-1 bg-[#1e40af] mb-6 rounded-full" />

      {/* 3. 4カラム テーブレイアウト（勤怠・支給・控除・当月支払） */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 sm:gap-3 text-xs">
        
        {/* ========================================================================= */}
        {/* カラム 1: 勤怠                                                            */}
        {/* ========================================================================= */}
        <div className="border border-[#1e40af] rounded-sm overflow-hidden flex flex-col justify-between min-h-[380px] bg-white shadow-2xs">
          <div>
            <div className="bg-[#1e40af] text-white font-bold py-1.5 px-3 text-center text-xs tracking-wider">
              勤怠
            </div>
            <div className="divide-y divide-slate-200">
              {attendanceList.map((item, index) => (
                <div key={index} className="flex justify-between items-center text-[11px] h-7">
                  <span className="w-3/5 bg-slate-50 text-slate-700 px-2.5 h-full flex items-center border-r border-slate-200 font-medium">
                    {item.label}
                  </span>
                  <span className="w-2/5 text-right px-2.5 font-bold text-slate-900">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* カラム 2: 支給                                                            */}
        {/* ========================================================================= */}
        <div className="border border-[#1e40af] rounded-sm overflow-hidden flex flex-col justify-between min-h-[380px] bg-white shadow-2xs">
          <div>
            <div className="bg-[#1e40af] text-white font-bold py-1.5 px-3 text-center text-xs tracking-wider">
              支給
            </div>
            <div className="divide-y divide-slate-200">
              {earningsList.map((item, index) => (
                <div key={index} className="flex justify-between items-center text-[11px] h-7">
                  <span className="w-1/2 bg-slate-50 text-slate-700 px-2.5 h-full flex items-center border-r border-slate-200 font-medium">
                    {item.label}
                  </span>
                  <span className="w-1/2 text-right px-2.5 font-bold text-slate-900 font-mono">
                    {item.amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* フッター：支給合計 */}
          <div className="border-t-2 border-[#1e40af] bg-slate-100 flex justify-between items-center text-xs h-8 px-2 font-bold text-slate-900">
            <span>支給合計</span>
            <span className="font-mono text-sm">{totalEarnings.toLocaleString()}</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* カラム 3: 控除                                                            */}
        {/* ========================================================================= */}
        <div className="border border-[#1e40af] rounded-sm overflow-hidden flex flex-col justify-between min-h-[380px] bg-white shadow-2xs">
          <div>
            <div className="bg-[#1e40af] text-white font-bold py-1.5 px-3 text-center text-xs tracking-wider">
              控除
            </div>
            <div className="divide-y divide-slate-200">
              {deductionsList.map((item, index) => (
                <div key={index} className="flex justify-between items-center text-[11px] h-7">
                  <span className="w-3/5 bg-slate-50 text-slate-700 px-2 h-full flex items-center border-r border-slate-200 font-medium text-[10.5px]">
                    {item.label}
                  </span>
                  <span className="w-2/5 text-right px-2 font-bold text-slate-900 font-mono">
                    {item.amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* フッター：控除合計 */}
          <div className="border-t-2 border-[#1e40af] bg-slate-100 flex justify-between items-center text-xs h-8 px-2 font-bold text-slate-900">
            <span>控除合計</span>
            <span className="font-mono text-sm">{totalDeductions.toLocaleString()}</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* カラム 4: 当月支払                                                        */}
        {/* ========================================================================= */}
        <div className="border border-[#1e40af] rounded-sm overflow-hidden flex flex-col justify-between min-h-[380px] bg-white shadow-2xs">
          <div>
            <div className="bg-[#1e40af] text-white font-bold py-1.5 px-3 text-center text-xs tracking-wider">
              当月支払
            </div>
            <div className="divide-y divide-slate-200">
              <div className="flex justify-between items-center text-[11px] h-7">
                <span className="w-1/2 bg-slate-50 text-slate-700 px-2.5 h-full flex items-center border-r border-slate-200 font-medium">
                  振込支給額
                </span>
                <span className="w-1/2 text-right px-2.5 font-bold text-slate-900 font-mono">
                  {(payslip.transfer_amount || netSalary).toLocaleString()}
                </span>
              </div>
              {payslip.cash_amount && payslip.cash_amount > 0 && (
                <div className="flex justify-between items-center text-[11px] h-7">
                  <span className="w-1/2 bg-slate-50 text-slate-700 px-2.5 h-full flex items-center border-r border-slate-200 font-medium">
                    現金支給額
                  </span>
                  <span className="w-1/2 text-right px-2.5 font-bold text-slate-900 font-mono">
                    {payslip.cash_amount.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* 備考（存在する場合） */}
      {payslip.note && (
        <div className="mt-6 p-3 border border-slate-300 rounded-lg text-xs text-slate-700 bg-slate-50/50">
          <span className="font-bold text-slate-500 mr-2">【備考】</span>
          {payslip.note}
        </div>
      )}

    </div>
  );
};
