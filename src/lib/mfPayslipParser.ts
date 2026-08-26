// マネーフォワード給与（MF給与）CSV / TSV パーサー

export interface ParsedMFPayslip {
  employeeNumber: string;
  employeeName: string;
  department: string;
  contractType: string;
  workDays: number;
  totalWorkHours: number;
  paidLeaveDays: number;
  paidLeaveRemaining: number; // 有休残日数
  
  // 支給
  executiveSalary: number;    // 役員報酬
  baseSalary: number;         // 基本給
  overtimeAllowance: number;  // 残業手当
  positionAllowance: number;  // 役職手当
  housingAllowance: number;   // 住宅手当
  commutingTaxFree: number;   // 通勤手当（非課税）
  commutingTaxable: number;   // 通勤手当（課税）
  specialAllowance: number;   // 特別手当
  totalEarnings: number;      // 支給合計

  // 控除
  healthInsurance: number;    // 健康保険料
  nursingInsurance: number;   // 介護保険料
  childCareSupport: number;   // 子ども・子育て支援金
  pensionInsurance: number;   // 厚生年金保険料
  employmentInsurance: number;// 雇用保険料
  incomeTax: number;          // 所得税
  residentTax: number;        // 住民税
  socialInsuranceTotal: number;// 社会保険料合計
  totalDeductions: number;    // 控除合計

  // 差引手取り額
  netSalary: number;          // 差引支給合計
  transferAmount: number;     // 振込支給額合計
}

/**
 * マネーフォワード給与のCSV/TSVテキストを解析する
 */
export function parseMoneyForwardPayslipCsv(rawText: string): ParsedMFPayslip[] {
  const lines = rawText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  // カンマ区切りかタブ区切りかを自動判定
  const separator = lines[0].includes('\t') ? '\t' : ',';
  
  const headers = lines[0].split(separator).map(h => h.trim().replace(/^["']|["']$/g, ''));
  
  const results: ParsedMFPayslip[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(separator).map(cell => cell.trim().replace(/^["']|["']$/g, ''));
    if (row.length < 2) continue;

    // 「合計」行は除外
    const firstCell = row[0] || '';
    if (firstCell === '合計' || row[1] === '合計') continue;

    const getVal = (colName: string): string => {
      const idx = headers.indexOf(colName);
      return idx >= 0 && idx < row.length ? row[idx] : '';
    };

    const getNum = (colName: string): number => {
      const val = getVal(colName);
      if (!val) return 0;
      const num = Number(val.replace(/,/g, ''));
      return isNaN(num) ? 0 : num;
    };

    const empName = getVal('従業員') || getVal('氏名');
    if (!empName) continue;

    const execSalary = getNum('役員報酬(支給)');
    const baseSal = getNum('基本給(支給)');
    const totalEarn = getNum('支給合計') || (execSalary + baseSal);

    const health = getNum('健康保険料(控除)');
    const nursing = getNum('介護保険料(控除)');
    const childCare = getNum('子ども・子育て支援金(控除)');
    const pension = getNum('厚生年金保険料(控除)');
    const employment = getNum('雇用保険料(控除)');
    const incomeTax = getNum('所得税(控除)');
    const residentTax = getNum('住民税(控除)');
    const totalDeduct = getNum('控除合計') || (health + nursing + childCare + pension + employment + incomeTax + residentTax);
    
    const transferAmt = getNum('振込支給額合計') || getNum('振込支給残額') || getNum('差引支給合計') || (totalEarn - totalDeduct);
    const netSalary = getNum('差引支給合計') || transferAmt;

    results.push({
      employeeNumber: getVal('従業員番号') || '2',
      employeeName: empName,
      department: getVal('部門'),
      contractType: getVal('契約種別'),
      workDays: getNum('出勤日数（平日）') + getNum('出勤日数（所定休日）') + getNum('出勤日数（法定休日）'),
      totalWorkHours: getNum('総労働時間'),
      paidLeaveDays: getNum('有休取得日数'),
      paidLeaveRemaining: getNum('有休残日数') || 0.0,
      
      executiveSalary: execSalary,
      baseSalary: baseSal || execSalary,
      overtimeAllowance: getNum('残業手当(支給)') + getNum('深夜残業手当(支給)') + getNum('法定休日手当(支給)'),
      positionAllowance: getNum('役職手当(支給)'),
      housingAllowance: getNum('住宅手当(支給)'),
      commutingTaxFree: getNum('通勤手当/非課(支給)'),
      commutingTaxable: getNum('通勤手当/課税(支給)'),
      specialAllowance: getNum('特別手当(支給)') + getNum('立替経費(支給)'),
      totalEarnings: totalEarn,

      healthInsurance: health,
      nursingInsurance: nursing,
      childCareSupport: childCare,
      pensionInsurance: pension,
      employmentInsurance: employment,
      incomeTax: incomeTax,
      residentTax: residentTax,
      socialInsuranceTotal: getNum('社会保険料合計') || (health + nursing + childCare + pension + employment),
      totalDeductions: totalDeduct,

      netSalary: netSalary,
      transferAmount: transferAmt
    });
  }

  return results;
}
