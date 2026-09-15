import { supabase } from './supabase';

export interface MaternityChecklist {
  internal_maternity_app_1: boolean;      // 産前産後休業取得（変更）申請書① (休業前)
  internal_maternity_app_2: boolean;      // 産前産後休業取得（変更）申請書② (休業後・実出産日確定時)
  internal_childcare_app_1: boolean;      // 育児休業取得（変更）申請書① (産休明け)
  internal_childcare_app_2: boolean;      // 育児休業取得（変更）申請書② (延長時等)
  attached_maternal_handbook_1: boolean;  // 母子手帳① (表紙・予定日ページ)
  attached_maternal_handbook_2: boolean;  // 母子手帳② (出生届出済証明ページ)
  attached_child_mynumber: boolean;       // 子のマイナンバー (住民票等)
  external_maternity_notice_1: boolean;   // 年金事務所：産休取得者申出書① (産前提出)
  external_maternity_notice_2: boolean;   // 年金事務所：産休取得者変更届② (出産後提出)
  external_childcare_notice_1: boolean;   // 年金事務所：育休等取得者申出書①
  external_childcare_notice_2: boolean;   // 年金事務所：育休等取得者申出書② (延長時)
  dependent_health_insurance_added: boolean; // 子の健康保険被扶養者異動届
}

export interface ResidentTaxAdvanceYearRecord {
  year: number;
  monthlyAmounts: { [month: number]: number }; // 1〜12月
  subtotal: number;
  isSettled?: boolean; // 精算完了フラグ
}

export interface ResidentTaxAdvanceData {
  startDate: string;
  records: ResidentTaxAdvanceYearRecord[];
  totalAmount: number;
  settledAmount: number;
  settlementMethod?: 'lump_sum' | 'payroll_deduction' | 'bank_transfer';
  remarks?: string;
}

export interface MaternityLeaveRecord {
  id?: string;
  tenant_id: string;
  user_id: string;
  application_date: string;
  pregnancy_type: 'single' | 'multiple';
  expected_birth_date: string;
  actual_birth_date?: string;
  maternity_leave_start_date: string;
  maternity_leave_end_date: string;
  childcare_leave_start_date?: string;
  childcare_leave_end_date?: string;
  return_to_work_date?: string;
  childcare_extended?: 'none' | '1_year_6_months' | '2_years';
  child_name?: string;
  child_birth_date?: string;
  child_relationship?: string;
  child_my_number?: string;
  contact_phone?: string;
  contact_email?: string;
  contact_line_id?: string;
  remarks?: string;
  checklist: MaternityChecklist;
  attachment_handbook_url?: string;
  attachment_handbook_filename?: string;
  attachment_certificate_url?: string;
  attachment_certificate_filename?: string;
  attachment_mynumber_url?: string;
  attachment_mynumber_filename?: string;
  resident_tax_advance: ResidentTaxAdvanceData;
  created_at?: string;
  updated_at?: string;
}

export const DEFAULT_MATERNITY_CHECKLIST: MaternityChecklist = {
  internal_maternity_app_1: false,
  internal_maternity_app_2: false,
  internal_childcare_app_1: false,
  internal_childcare_app_2: false,
  attached_maternal_handbook_1: false,
  attached_maternal_handbook_2: false,
  attached_child_mynumber: false,
  external_maternity_notice_1: false,
  external_maternity_notice_2: false,
  external_childcare_notice_1: false,
  external_childcare_notice_2: false,
  dependent_health_insurance_added: false
};

// 日付ヘルパー: YYYY-MM-DD
function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

// 産前産後・育児休業期間の法令自動計算エンジン
export function calculateMaternityDates(params: {
  expectedBirthDate: string;
  pregnancyType: 'single' | 'multiple';
  actualBirthDate?: string;
  childcareExtended?: 'none' | '1_year_6_months' | '2_years';
}) {
  const { expectedBirthDate, pregnancyType, actualBirthDate, childcareExtended = 'none' } = params;
  if (!expectedBirthDate) {
    return {
      maternityLeaveStartDate: '',
      maternityLeaveEndDate: '',
      childcareLeaveStartDate: '',
      childcareLeaveEndDate: '',
      returnToWorkDate: '',
      isDelayed: false,
      isEarly: false,
      diffDays: 0
    };
  }

  // 1. 産前休業開始日: 単胎42日前(6週)、多胎98日前(14週)
  const prenatalDays = pregnancyType === 'multiple' ? 98 : 42;
  const maternityLeaveStartDate = addDays(expectedBirthDate, -(prenatalDays - 1));

  // 2. 出産日決定 (実出産日があればそちらを採用)
  const baseBirthDate = actualBirthDate || expectedBirthDate;

  // 予定日と実出産日の差異判定
  let isDelayed = false;
  let isEarly = false;
  let diffDays = 0;
  if (actualBirthDate) {
    const expTime = new Date(expectedBirthDate + 'T00:00:00').getTime();
    const actTime = new Date(actualBirthDate + 'T00:00:00').getTime();
    diffDays = Math.round((actTime - expTime) / (1000 * 60 * 60 * 24));
    if (diffDays > 0) isDelayed = true;
    if (diffDays < 0) isEarly = true;
  }

  // 3. 産後休業期間: 出産日の翌日から56日後(8週 = 56日)
  // 出産翌日から数えて56日目まで
  const maternityLeaveEndDate = addDays(baseBirthDate, 56);

  // 4. 育児休業期間: 産後休業終了の翌日から原則満1歳の誕生日の前日まで
  const childcareLeaveStartDate = addDays(maternityLeaveEndDate, 1);

  // 子の満1歳の誕生日前日
  const bDate = new Date(baseBirthDate + 'T00:00:00');
  let targetYear = bDate.getFullYear() + 1;
  let targetMonth = bDate.getMonth();
  let targetDay = bDate.getDate();

  if (childcareExtended === '1_year_6_months') {
    // 1歳6ヶ月
    targetMonth += 6;
  } else if (childcareExtended === '2_years') {
    // 2歳
    targetYear += 1;
  }

  const endBirthTarget = new Date(targetYear, targetMonth, targetDay);
  // 誕生日前日
  endBirthTarget.setDate(endBirthTarget.getDate() - 1);
  const childcareLeaveEndDate = formatDate(endBirthTarget);

  // 5. 復職予定日: 育休終了の翌日
  const returnToWorkDate = addDays(childcareLeaveEndDate, 1);

  return {
    maternityLeaveStartDate,
    maternityLeaveEndDate,
    childcareLeaveStartDate,
    childcareLeaveEndDate,
    returnToWorkDate,
    isDelayed,
    isEarly,
    diffDays
  };
}

// 住民税立替スケジュールの自動生成
export function generateResidentTaxAdvanceSchedule(params: {
  leaveStartDate: string;
  leaveEndDate: string;
  monthlyResidentTax: number;
  monthlyDetails?: Record<string, number>;
  existingRecords?: ResidentTaxAdvanceYearRecord[];
}): ResidentTaxAdvanceData {
  const { leaveStartDate, leaveEndDate, monthlyResidentTax, monthlyDetails, existingRecords = [] } = params;
  if (!leaveStartDate || !leaveEndDate) {
    return {
      startDate: leaveStartDate || '',
      records: existingRecords,
      totalAmount: 0,
      settledAmount: 0
    };
  }

  const start = new Date(leaveStartDate + 'T00:00:00');
  const end = new Date(leaveEndDate + 'T00:00:00');

  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  const records: ResidentTaxAdvanceYearRecord[] = [];

  for (let yr = startYear; yr <= endYear; yr++) {
    const existing = existingRecords.find(r => r.year === yr);
    const monthlyAmounts: { [m: number]: number } = {};
    let subtotal = 0;

    for (let m = 1; m <= 12; m++) {
      // 該当月が休職期間内かどうか
      const monthStart = new Date(yr, m - 1, 1);
      const monthEnd = new Date(yr, m, 0); // 月末
      const inRange = monthEnd >= start && monthStart <= end;

      if (inRange) {
        if (existing?.monthlyAmounts && existing.monthlyAmounts[m] !== undefined) {
          monthlyAmounts[m] = Number(existing.monthlyAmounts[m]);
        } else {
          // 月別詳細(6月〜翌5月)があればそこから、なければ月額固定
          const detailKey = `${m}月`;
          const amount = (monthlyDetails && monthlyDetails[detailKey] !== undefined)
            ? Number(monthlyDetails[detailKey])
            : Number(monthlyResidentTax || 0);
          monthlyAmounts[m] = amount;
        }
      } else {
        monthlyAmounts[m] = 0;
      }
      subtotal += monthlyAmounts[m];
    }

    records.push({
      year: yr,
      monthlyAmounts,
      subtotal,
      isSettled: existing ? existing.isSettled : false
    });
  }

  const totalAmount = records.reduce((sum, r) => sum + r.subtotal, 0);
  const settledAmount = records.filter(r => r.isSettled).reduce((sum, r) => sum + r.subtotal, 0);

  return {
    startDate: leaveStartDate,
    records,
    totalAmount,
    settledAmount
  };
}

// DB取得
export async function fetchMaternityLeaveRecord(tenantId: string, userId: string): Promise<MaternityLeaveRecord | null> {
  try {
    const { data, error } = await supabase
      .from('employee_maternity_leaves')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.warn('fetchMaternityLeaveRecord warning:', error.message);
      return null;
    }
    return data as MaternityLeaveRecord;
  } catch (err) {
    console.error('fetchMaternityLeaveRecord error:', err);
    return null;
  }
}

// DB保存 (Upsert)
export async function saveMaternityLeaveRecord(record: MaternityLeaveRecord): Promise<{ success: boolean; error?: any }> {
  try {
    const { error } = await supabase
      .from('employee_maternity_leaves')
      .upsert({
        ...record,
        updated_at: new Date().toISOString()
      }, { onConflict: 'tenant_id,user_id' });

    if (error) {
      console.error('saveMaternityLeaveRecord error:', error);
      return { success: false, error };
    }
    return { success: true };
  } catch (err) {
    console.error('saveMaternityLeaveRecord catch:', err);
    return { success: false, error: err };
  }
}
