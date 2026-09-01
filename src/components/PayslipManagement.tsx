import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  DollarSign, ChevronLeft, ChevronRight,
  Edit3, CheckCircle2, Lock, Unlock, Printer, 
  Users, Sparkles, Loader2, X, FileSpreadsheet,
  Settings as SettingsIcon, Download, UserCheck, CreditCard, Building2, Save
} from 'lucide-react';
import { OfficialPayslipDoc } from './OfficialPayslipDoc';
import { 
  calculatePayroll, 
  type EmployeePayrollProfile, 
  type AttendanceSummary, 
  type PayrollSettings 
} from '../lib/payrollEngine';

interface PayslipManagementProps {
  tenantId: string | null;
}

export interface Payslip {
  id?: string;
  tenant_id: string;
  user_id: string;
  year_month: string;
  payment_date: string;
  salary_type?: 'monthly' | 'hourly' | 'daily';
  
  work_days: number;
  actual_hours: number;
  overtime_hours: number;
  midnight_hours?: number;
  holiday_hours?: number;
  paid_leave_days: number;
  absence_days: number;
  late_early_hours?: number;

  base_salary: number;
  hourly_wage?: number;
  overtime_allowance: number;
  midnight_allowance?: number;
  holiday_allowance?: number;
  position_allowance: number;
  qualification_allowance?: number;
  commuting_allowance: number;
  housing_allowance: number;
  family_allowance?: number;
  special_allowance: number;
  absence_deduction?: number;
  late_early_deduction?: number;
  total_earnings: number;

  health_insurance: number;
  nursing_insurance: number;
  pension_insurance: number;
  employment_insurance: number;
  income_tax: number;
  resident_tax: number;
  other_deductions: number;
  total_deductions: number;

  net_salary: number;
  note: string;
  pdf_data_base64?: string;
  status: 'draft' | 'published';
  user?: any;
}

export const PayslipManagement: React.FC<PayslipManagementProps> = ({ tenantId }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [employees, setEmployees] = useState<any[]>([]);
  const [payrollProfiles, setPayrollProfiles] = useState<Record<string, EmployeePayrollProfile>>({});
  const [payrollSettings, setPayrollSettings] = useState<PayrollSettings>({
    closing_day: 'end_of_month',
    payment_month: 'current',
    payment_day: '25',
    employment_insurance_rate: 0.006,
    health_insurance_rate: 0.05,
    nursing_insurance_rate: 0.009,
    pension_insurance_rate: 0.0915,
    rounding_method: 'floor'
  });
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [tenantInfo, setTenantInfo] = useState<any>(null);

  // モーダル State
  const [profileModal, setProfileModal] = useState<{
    isOpen: boolean;
    user: any | null;
    profile: EmployeePayrollProfile;
  }>({
    isOpen: false,
    user: null,
    profile: getInitialProfile('', '')
  });

  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    data: Payslip;
  }>({
    isOpen: false,
    data: getInitialPayslipData('', '')
  });

  const [previewModal, setPreviewModal] = useState<{
    isOpen: boolean;
    payslip: Payslip | null;
  }>({
    isOpen: false,
    payslip: null
  });

  // 明細の個別編集保存
  const handleSaveEditedPayslip = async (data: Payslip) => {
    if (!tenantId) return;
    setIsSaving(true);
    try {
      const totalEarnings = Math.max(0, 
        (data.base_salary || 0) + 
        (data.overtime_allowance || 0) + 
        (data.midnight_allowance || 0) + 
        (data.holiday_allowance || 0) + 
        (data.position_allowance || 0) + 
        (data.qualification_allowance || 0) + 
        (data.housing_allowance || 0) + 
        (data.family_allowance || 0) + 
        (data.commuting_allowance || 0) + 
        (data.special_allowance || 0) - 
        (data.absence_deduction || 0) - 
        (data.late_early_deduction || 0)
      );

      const totalDeductions = (
        (data.health_insurance || 0) + 
        (data.nursing_insurance || 0) + 
        (data.pension_insurance || 0) + 
        (data.employment_insurance || 0) + 
        (data.income_tax || 0) + 
        (data.resident_tax || 0) + 
        (data.other_deductions || 0)
      );

      const netSalary = Math.max(0, totalEarnings - totalDeductions);

      const payload = {
        ...data,
        tenant_id: tenantId,
        total_earnings: totalEarnings,
        total_deductions: totalDeductions,
        net_salary: netSalary,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('payslips')
        .upsert(payload, { onConflict: 'tenant_id,user_id,year_month' });

      if (error) throw error;

      alert('給与明細の変更を保存しました！');
      setEditModal(prev => ({ ...prev, isOpen: false }));
      await fetchData();
    } catch (err: any) {
      console.error('Save edited payslip error:', err);
      alert('保存に失敗しました: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  function getInitialProfile(tId: string, uId: string): EmployeePayrollProfile {
    return {
      tenant_id: tId,
      user_id: uId,
      salary_type: 'monthly',
      base_salary: 250000,
      hourly_wage: 1100,
      position_allowance: 0,
      qualification_allowance: 0,
      housing_allowance: 0,
      family_allowance: 0,
      commuting_allowance: 15000,
      commuting_taxable: false,
      fixed_overtime_hours: 0,
      fixed_overtime_allowance: 0,
      dependents_count: 0,
      health_insurance_enabled: true,
      nursing_insurance_enabled: false,
      pension_insurance_enabled: true,
      employment_insurance_enabled: true,
      resident_tax_monthly: 0,
      tax_bracket: 'kou',
      bank_name: '',
      branch_name: '',
      account_type: 'ordinary',
      account_number: '',
      account_holder: ''
    };
  }

  function getInitialPayslipData(userId: string, targetMonth: string): Payslip {
    const defaultPayDate = `${targetMonth}-25`;
    return {
      tenant_id: tenantId || '',
      user_id: userId,
      year_month: targetMonth,
      payment_date: defaultPayDate,
      salary_type: 'monthly',
      work_days: 20,
      actual_hours: 160,
      overtime_hours: 0,
      midnight_hours: 0,
      holiday_hours: 0,
      paid_leave_days: 0,
      absence_days: 0,
      late_early_hours: 0,
      base_salary: 250000,
      overtime_allowance: 0,
      midnight_allowance: 0,
      holiday_allowance: 0,
      position_allowance: 0,
      qualification_allowance: 0,
      commuting_allowance: 15000,
      housing_allowance: 0,
      family_allowance: 0,
      special_allowance: 0,
      absence_deduction: 0,
      late_early_deduction: 0,
      total_earnings: 265000,
      health_insurance: 13000,
      nursing_insurance: 0,
      pension_insurance: 24000,
      employment_insurance: 1590,
      income_tax: 6000,
      resident_tax: 0,
      other_deductions: 0,
      total_deductions: 44590,
      net_salary: 220410,
      note: '今月も勤務お疲れ様でした。',
      status: 'draft'
    };
  }

  const currentYearMonth = `${currentMonth.getFullYear()}-${(currentMonth.getMonth() + 1).toString().padStart(2, '0')}`;

  const fetchData = async () => {
    if (!tenantId) return;
    setIsLoading(true);
    try {
      // 1. 会社情報取得
      const { data: tData } = await supabase.from('tenants').select('*').eq('id', tenantId).maybeSingle();
      setTenantInfo(tData);

      // 2. 給与基本設定取得
      const { data: setRow } = await supabase.from('payroll_settings').select('*').eq('tenant_id', tenantId).maybeSingle();
      if (setRow) {
        setPayrollSettings({
          closing_day: setRow.closing_day || 'end_of_month',
          payment_month: setRow.payment_month || 'current',
          payment_day: setRow.payment_day || '25',
          employment_insurance_rate: setRow.employment_insurance_rate ?? 0.006,
          health_insurance_rate: setRow.health_insurance_rate ?? 0.05,
          nursing_insurance_rate: setRow.nursing_insurance_rate ?? 0.009,
          pension_insurance_rate: setRow.pension_insurance_rate ?? 0.0915,
          rounding_method: setRow.rounding_method || 'floor'
        });
      }

      // 3. 従業員一覧取得
      const { data: uData } = await supabase
        .from('users')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name');
      const usersList = uData || [];
      setEmployees(usersList);

      // 4. 従業員給与マスタ取得
      const { data: profData } = await supabase
        .from('employee_payroll_profiles')
        .select('*')
        .eq('tenant_id', tenantId);
      
      const profileMap: Record<string, EmployeePayrollProfile> = {};
      (profData || []).forEach((p: any) => {
        profileMap[p.user_id] = p;
      });
      setPayrollProfiles(profileMap);

      // 5. 当月の給与明細取得
      let combinedPayslips: any[] = [];

      try {
        const { data: pData, error: pErr } = await supabase
          .from('payslips')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('year_month', currentYearMonth);
        if (!pErr && pData) {
          combinedPayslips = [...pData];
        }
      } catch (dbErr) {
        console.warn('Supabase payslips fetch:', dbErr);
      }

      // LocalStorage からのマージ（オフライン/バックアップ対応）
      const localKey = `mf_payslips_${tenantId}`;
      const storedLocal = localStorage.getItem(localKey);
      if (storedLocal) {
        try {
          const parsedLocal: any[] = JSON.parse(storedLocal);
          const monthLocal = parsedLocal.filter(p => p.year_month === currentYearMonth);
          monthLocal.forEach(lp => {
            if (!combinedPayslips.some(cp => cp.user_id === lp.user_id && cp.year_month === lp.year_month)) {
              combinedPayslips.push(lp);
            }
          });
        } catch (e) {
          console.error('LocalStorage parse error:', e);
        }
      }

      const enriched = combinedPayslips.map(p => ({
        ...p,
        user: usersList.find(u => u.id === p.user_id) || p.user || { name: p.employee_name || '従業員' }
      }));
      setPayslips(enriched);
    } catch (e) {
      console.error('Error fetching payslips:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tenantId, currentMonth]);

  // 前月・次月・今月切り替え
  const handlePrevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  const handleCurrentMonth = () => setCurrentMonth(new Date());

  // 勤怠実績から当月の給与を一括自動計算
  const handleAutoGenerateFromAttendance = async () => {
    if (!tenantId || employees.length === 0) return;

    setIsSaving(true);
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];

      // 1. 当月の打刻データ取得 (attendance_records)
      const { data: attData } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('date', startDate)
        .lte('date', endDate);

      // 2. 当月の確定シフトデータ取得 (advanced_shifts: フォールバック用)
      const { data: shiftData } = await supabase
        .from('advanced_shifts')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('target_date', startDate)
        .lte('target_date', endDate);

      // 3. 当月の有給申請データ取得 (leave_requests)
      const { data: reqData } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', '承認')
        .gte('start_date', startDate)
        .lte('start_date', endDate);

      const records = attData || [];
      const shifts = shiftData || [];
      const requests = reqData || [];

      const activePrefecture = payrollSettings.prefecture_code || tenantInfo?.prefecture_code || '13';

      for (const emp of employees) {
        const empRecords = records.filter(r => r.user_id === emp.id);
        const empShifts = shifts.filter(s => s.user_id === emp.id);

        let workDays = 0;
        let actualMins = 0;
        let overtimeMins = 0;
        let midnightMins = 0;
        let holidayHours = 0;

        if (empRecords.length > 0) {
          // ① 打刻実績データが存在する場合
          workDays = empRecords.filter(r => r.check_in_time).length;
          empRecords.forEach(r => {
            if (r.check_in_time && r.check_out_time) {
              const [inH, inM] = r.check_in_time.split(':').map(Number);
              const [outH, outM] = r.check_out_time.split(':').map(Number);
              let inTotal = inH * 60 + inM;
              let outTotal = outH * 60 + outM;
              if (outTotal < inTotal) outTotal += 24 * 60;

              const total = Math.max(0, outTotal - inTotal);
              const breakM = total >= 480 ? 60 : (total >= 360 ? 45 : 0);
              const work = Math.max(0, total - breakM);
              actualMins += work;
              overtimeMins += Math.max(0, work - 480);

              // 深夜時間（22:00〜翌5:00）
              for (let m = inTotal; m < outTotal; m++) {
                const h = Math.floor(m / 60) % 24;
                if (h >= 22 || h < 5) midnightMins++;
              }
            }
          });
        } else if (empShifts.length > 0) {
          // ② 打刻がまだないが確定シフトが存在する場合
          workDays = empShifts.length;
          empShifts.forEach(s => {
            if (s.start_time && s.end_time) {
              const [inH, inM] = s.start_time.split(':').map(Number);
              const [outH, outM] = s.end_time.split(':').map(Number);
              let inTotal = inH * 60 + inM;
              let outTotal = outH * 60 + outM;
              if (outTotal < inTotal) outTotal += 24 * 60;

              const total = Math.max(0, outTotal - inTotal);
              const breakM = total >= 480 ? 60 : (total >= 360 ? 45 : 0);
              const work = Math.max(0, total - breakM);
              actualMins += work;
              overtimeMins += Math.max(0, work - 480);
            }
          });
        }

        // 有給休暇日数集計
        const empRequests = requests.filter(r => r.user_id === emp.id && (r.type?.includes('有給') || r.type?.includes('年休')));
        const paidLeaveDays = empRequests.length;

        // 従業員の給与マスタプロファイル
        const existingProf = payrollProfiles[emp.id];
        const profile: EmployeePayrollProfile = {
          tenant_id: tenantId,
          user_id: emp.id,
          salary_type: existingProf?.salary_type || ((emp.employment_type === 'part-time' || emp.role?.includes('パート')) ? 'hourly' : 'monthly'),
          base_salary: existingProf?.base_salary ?? 250000,
          hourly_wage: existingProf?.hourly_wage ?? 1150,
          position_allowance: existingProf?.position_allowance ?? 0,
          qualification_allowance: existingProf?.qualification_allowance ?? 0,
          housing_allowance: existingProf?.housing_allowance ?? 0,
          family_allowance: existingProf?.family_allowance ?? 0,
          commuting_allowance: existingProf?.commuting_allowance ?? 15000,
          commuting_taxable: existingProf?.commuting_taxable ?? false,
          fixed_overtime_hours: existingProf?.fixed_overtime_hours ?? 0,
          fixed_overtime_allowance: existingProf?.fixed_overtime_allowance ?? 0,
          dependents_count: existingProf?.dependents_count ?? 0,
          birth_date: emp.birth_date || existingProf?.birth_date || null,
          health_insurance_enabled: existingProf?.health_insurance_enabled ?? true,
          nursing_insurance_enabled: existingProf?.nursing_insurance_enabled ?? null,
          pension_insurance_enabled: existingProf?.pension_insurance_enabled ?? true,
          employment_insurance_enabled: existingProf?.employment_insurance_enabled ?? true,
          resident_tax_monthly: existingProf?.resident_tax_monthly ?? 0,
          tax_bracket: existingProf?.tax_bracket || 'kou'
        };

        const isHourly = profile.salary_type === 'hourly';
        const defaultWorkDays = isHourly ? 0 : 20;
        const defaultActualHours = isHourly ? 0 : 160;

        const attSummary: AttendanceSummary = {
          work_days: workDays || defaultWorkDays,
          actual_hours: actualMins > 0 ? Number((actualMins / 60).toFixed(1)) : defaultActualHours,
          overtime_hours: Number((overtimeMins / 60).toFixed(1)),
          midnight_hours: Number((midnightMins / 60).toFixed(1)),
          holiday_hours: holidayHours,
          paid_leave_days: paidLeaveDays,
          absence_days: 0,
          late_early_hours: 0
        };

        // 給与計算エンジンの実行（都道府県・生年月日・社保料率・税金完全自動連動）
        const calculated = calculatePayroll(profile, attSummary, {
          ...payrollSettings,
          prefecture_code: activePrefecture
        });

        const paymentDayStr = payrollSettings.payment_day === 'end_of_month' ? '28' : String(payrollSettings.payment_day);
        const payload: any = {
          tenant_id: tenantId,
          user_id: emp.id,
          year_month: currentYearMonth,
          payment_date: `${currentYearMonth}-${paymentDayStr.padStart(2, '0')}`,
          ...calculated,
          note: '今月も勤務お疲れ様でした。',
          status: 'draft',
          updated_at: new Date().toISOString()
        };

        await supabase
          .from('payslips')
          .upsert(payload, { onConflict: 'tenant_id,user_id,year_month' });
      }

      await fetchData();
    } catch (err: any) {
      console.error('Auto generate error:', err);
      alert('給与自動計算中にエラーが発生しました: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 🪄 テスト用勤怠打刻・有給データの一括投入 ＆ 給与即時自動計算
  const handleSeedDummyAttendanceAndCalculate = async () => {
    if (!tenantId || employees.length === 0) return;
    if (!confirm(`【${currentMonth.getFullYear()}年${currentMonth.getMonth() + 1}月度】のテスト用勤怠打刻データ（平日9:00〜18:00、残業・深夜・有給含む）を一括生成し、即座に給与を自動計算します。よろしいですか？`)) return;

    setIsSaving(true);
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      const daysInMonth = new Date(year, month, 0).getDate();

      const attendanceRecordsToInsert: any[] = [];
      const dummyRequestsToInsert: any[] = [];

      for (const emp of employees) {
        let workedDaysCount = 0;

        for (let d = 1; d <= daysInMonth; d++) {
          const dateObj = new Date(year, month - 1, d);
          const dayOfWeek = dateObj.getDay();
          const dateStr = `${year}-${month.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;

          // 土日は除外（平日のみ）
          if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            workedDaysCount++;

            // 15日は有給休暇テスト
            if (d === 15) {
              dummyRequestsToInsert.push({
                tenant_id: tenantId,
                user_id: emp.id,
                type: '有給休暇（全休）',
                start_date: dateStr,
                end_date: dateStr,
                status: '承認',
                reason: 'テスト有給申請'
              });
              continue;
            }

            // 通常の打刻データ（時々残業・深夜あり）
            const hasOvertime = workedDaysCount % 4 === 0;
            const hasMidnight = workedDaysCount % 7 === 0;

            const checkIn = '09:00';
            let checkOut = '18:00';
            if (hasOvertime) checkOut = '20:00'; // 2h残業
            if (hasMidnight) checkOut = '23:00'; // 4h残業 + 1h深夜

            attendanceRecordsToInsert.push({
              tenant_id: tenantId,
              user_id: emp.id,
              date: dateStr,
              check_in_time: checkIn,
              check_out_time: checkOut,
              status: '退勤済',
              note: 'テスト自動生成打刻'
            });
          }
        }
      }

      // 既存データを一度クリアして再投入
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];

      await supabase
        .from('attendance_records')
        .delete()
        .eq('tenant_id', tenantId)
        .gte('date', startDate)
        .lte('date', endDate);

      if (attendanceRecordsToInsert.length > 0) {
        await supabase
          .from('attendance_records')
          .insert(attendanceRecordsToInsert);
      }

      if (dummyRequestsToInsert.length > 0) {
        await supabase
          .from('leave_requests')
          .insert(dummyRequestsToInsert);
      }

      // 直ちに給与自動計算を実行！
      await handleAutoGenerateFromAttendance();
      alert('🪄 テスト用勤怠打刻データ（出勤・残業・深夜・有給）を投入し、全員分の給与計算（社保・所得税・手取り）が完了しました！');
    } catch (err: any) {
      console.error('Seed attendance error:', err);
      alert('テスト勤怠データ投入エラー: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 一括確定（Web公開）
  const handlePublishAll = async () => {
    if (payslips.length === 0) {
      alert('確定対象の給与明細データがありません。');
      return;
    }
    if (!confirm(`${currentYearMonth}度 の給与明細（全${payslips.length}件）を一括確定し、従業員へ公開しますか？`)) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('payslips')
        .update({ status: 'published', updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId)
        .eq('year_month', currentYearMonth);

      if (error) throw error;

      alert('🎉 給与明細を一括確定・公開しました！従業員ポータルから閲覧・印刷できます。');
      await fetchData();
    } catch (err: any) {
      console.error('Publish error:', err);
      alert('公開処理に失敗しました: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 給与マスタプロファイル保存
  const handleSaveProfile = async (prof: EmployeePayrollProfile) => {
    if (!tenantId) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('employee_payroll_profiles')
        .upsert(prof, { onConflict: 'tenant_id,user_id' });

      if (error) throw error;

      alert('従業員の給与マスタ設定を保存しました！');
      setProfileModal(prev => ({ ...prev, isOpen: false }));
      await fetchData();
    } catch (err: any) {
      console.error('Save profile error:', err);
      alert('給与設定の保存に失敗しました: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 会社給与基本設定の保存
  const handleSavePayrollSettings = async () => {
    if (!tenantId) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('payroll_settings')
        .upsert({
          tenant_id: tenantId,
          ...payrollSettings,
          updated_at: new Date().toISOString()
        }, { onConflict: 'tenant_id' });

      if (error) throw error;

      alert('会社給与基本設定を保存しました！');
      setSettingsModalOpen(false);
    } catch (err: any) {
      console.error('Save settings error:', err);
      alert('設定保存に失敗しました: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 銀行振込用CSVエクスポート
  const handleExportBankTransferCsv = () => {
    if (payslips.length === 0) {
      alert('出力対象の給与データがありません。');
      return;
    }

    let csvContent = '従業員コード,氏名,銀行名,支店名,口座種別,口座番号,受取人名,差引支給額(手取り振込額)\n';
    payslips.forEach(p => {
      const prof = payrollProfiles[p.user_id];
      const name = p.user?.name || '従業員';
      const bName = prof?.bank_name || '';
      const brName = prof?.branch_name || '';
      const accType = prof?.account_type === 'current' ? '当座' : '普通';
      const accNum = prof?.account_number || '';
      const accHolder = prof?.account_holder || name;
      const amount = p.net_salary || 0;

      csvContent += `"${p.user_id}","${name}","${bName}","${brName}","${accType}","${accNum}","${accHolder}",${amount}\n`;
    });

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `給与振込データ_${currentYearMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // サマリー集計
  const totalGrossEarnings = payslips.reduce((sum, p) => sum + (p.total_earnings || 0), 0);
  const totalDeductionSum = payslips.reduce((sum, p) => sum + (p.total_deductions || 0), 0);
  const totalNetSalarySum = payslips.reduce((sum, p) => sum + (p.net_salary || 0), 0);
  const publishedCount = payslips.filter(p => p.status === 'published').length;

  return (
    <div className="space-y-6">
      {/* 上部ヘッダー・月度ナビゲーション */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-2xl flex items-center justify-center text-white shadow-md shadow-indigo-100">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
              クラウド給与計算・明細管理
              <span className="text-xs bg-indigo-50 text-indigo-700 font-bold px-2.5 py-1 rounded-full border border-indigo-100">
                勤怠100%自動連動
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">打刻データからのワンクリック自動計算、割増手当・社保・税金控除、Web明細発行</p>
          </div>
        </div>

        {/* 年月セレクター */}
        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
          <button onClick={handlePrevMonth} className="p-2 hover:bg-white rounded-xl transition text-slate-600 hover:shadow-xs cursor-pointer">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-black text-slate-800 text-base px-3 min-w-[130px] text-center">
            {currentMonth.getFullYear()}年 {currentMonth.getMonth() + 1}月度
          </span>
          <button onClick={handleNextMonth} className="p-2 hover:bg-white rounded-xl transition text-slate-600 hover:shadow-xs cursor-pointer">
            <ChevronRight className="w-5 h-5" />
          </button>
          <button onClick={handleCurrentMonth} className="text-xs font-bold bg-white text-indigo-600 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-indigo-50 transition cursor-pointer">
            今月
          </button>
        </div>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">対象従業員数</span>
            <Users className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-800">{payslips.length}</span>
            <span className="text-xs text-slate-400 font-bold">/ 全{employees.length}名</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>確定公開済: {publishedCount}名</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">総支給額 合計</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600">
            ¥{totalGrossEarnings.toLocaleString()}
          </div>
          <div className="mt-2 text-[11px] text-slate-400">基本給 + 各種割増 + 手当</div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">総控除額 合計</span>
            <Building2 className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-600">
            ¥{totalDeductionSum.toLocaleString()}
          </div>
          <div className="mt-2 text-[11px] text-slate-400">社保 + 雇用保険 + 所得税 + 住民税</div>
        </div>

        <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-5 text-white shadow-md shadow-indigo-100">
          <div className="flex items-center justify-between text-indigo-200 mb-2">
            <span className="text-xs font-bold">差引支給額 (振込合計)</span>
            <CreditCard className="w-4 h-4 text-amber-300" />
          </div>
          <div className="text-2xl font-black text-white">
            ¥{totalNetSalarySum.toLocaleString()}
          </div>
          <div className="mt-2 text-[11px] text-indigo-100">従業員手取り振込総額</div>
        </div>
      </div>

      {/* アクションツールバー */}
      <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSeedDummyAttendanceAndCalculate}
            disabled={isSaving || employees.length === 0}
            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black text-xs px-3.5 py-2.5 rounded-xl transition shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="ワンクリックで当月の平日打刻・有給データを生成し、給与を即座に自動計算します"
          >
            <Sparkles className="w-4 h-4 text-amber-100" />
            🪄 テスト用勤怠投入＆一括計算
          </button>

          <button
            onClick={handleAutoGenerateFromAttendance}
            disabled={isSaving || employees.length === 0}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm px-4 py-2.5 rounded-xl transition shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-300" />}
            ⚡ 勤怠から一括自動計算
          </button>

          <button
            onClick={handlePublishAll}
            disabled={isSaving || payslips.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            一括確定 (Web公開)
          </button>

          <button
            onClick={handleExportBankTransferCsv}
            disabled={payslips.length === 0}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm px-3.5 py-2.5 rounded-xl transition border border-slate-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            振込CSV出力
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSettingsModalOpen(true)}
            className="bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs px-3 py-2 rounded-xl transition border border-slate-200 flex items-center gap-1.5 cursor-pointer"
          >
            <SettingsIcon className="w-3.5 h-3.5 text-slate-500" />
            会社給与設定
          </button>
        </div>
      </div>

      {/* 給与台帳テーブル */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
            {currentYearMonth}度 給与明細一覧
          </h3>
          <span className="text-xs text-slate-400">クリックで個別編集・詳細確認が可能です</span>
        </div>

        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
            <span className="text-xs">給与データを読み込み中...</span>
          </div>
        ) : payslips.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <DollarSign className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="font-bold text-slate-600 text-sm">当月の給与データがまだありません</p>
            <p className="text-xs text-slate-400 mt-1 mb-4">「⚡ 勤怠から一括自動計算」ボタンを押すと、全員の給与を一瞬で自動試算します。</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={handleSeedDummyAttendanceAndCalculate}
                className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <Sparkles className="w-4 h-4" />
                🪄 テスト用勤怠を投入して即時計算
              </button>
              <button
                onClick={handleAutoGenerateFromAttendance}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                ⚡ 実績勤怠から自動計算する
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3 px-4">従業員名</th>
                  <th className="py-3 px-3">給与形態</th>
                  <th className="py-3 px-3 text-right">出勤/時間</th>
                  <th className="py-3 px-3 text-right">残業時間</th>
                  <th className="py-3 px-3 text-right">総支給額</th>
                  <th className="py-3 px-3 text-right">控除合計</th>
                  <th className="py-3 px-4 text-right">手取り支給額</th>
                  <th className="py-3 px-3 text-center">状態</th>
                  <th className="py-3 px-4 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {payslips.map(slip => {
                  const prof = payrollProfiles[slip.user_id];
                  const isHourly = prof?.salary_type === 'hourly' || slip.salary_type === 'hourly';

                  return (
                    <tr key={slip.user_id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4 font-bold text-slate-800">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 font-bold flex items-center justify-center text-xs">
                            {(slip.user?.name || '員').substring(0, 1)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800">{slip.user?.name || '従業員'}</div>
                            <button
                              onClick={() => setProfileModal({ isOpen: true, user: slip.user, profile: prof || getInitialProfile(tenantId || '', slip.user_id) })}
                              className="text-[10px] text-indigo-600 hover:underline flex items-center gap-0.5 cursor-pointer mt-0.5"
                            >
                              <UserCheck className="w-2.5 h-2.5" />
                              給与マスタ設定
                            </button>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                          isHourly ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {isHourly ? '時給制' : '月給制'}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 text-right font-medium text-slate-700">
                        <div>{slip.work_days}日</div>
                        <div className="text-[10px] text-slate-400">{slip.actual_hours}h</div>
                      </td>

                      <td className="py-3.5 px-3 text-right font-medium text-slate-700">
                        {slip.overtime_hours > 0 ? (
                          <span className="font-bold text-rose-600">{slip.overtime_hours}h</span>
                        ) : (
                          <span className="text-slate-400">0h</span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 text-right font-bold text-slate-800">
                        ¥{(slip.total_earnings || 0).toLocaleString()}
                      </td>

                      <td className="py-3.5 px-3 text-right font-medium text-rose-600">
                        -¥{(slip.total_deductions || 0).toLocaleString()}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <span className="font-black text-sm text-indigo-600">
                          ¥{(slip.net_salary || 0).toLocaleString()}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 text-center">
                        {slip.status === 'published' ? (
                          <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200 flex items-center justify-center gap-1 w-fit mx-auto">
                            <Lock className="w-2.5 h-2.5" /> 確定公開
                          </span>
                        ) : (
                          <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-200 flex items-center justify-center gap-1 w-fit mx-auto">
                            <Unlock className="w-2.5 h-2.5" /> 下書き
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setPreviewModal({ isOpen: true, payslip: slip })}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                            title="A4明細プレビュー・印刷"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditModal({ isOpen: true, data: slip })}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                            title="金額の微調整・編集"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 従業員給与マスタ設定モーダル */}
      {profileModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-indigo-600" />
                {profileModal.user?.name || '従業員'} の給与マスタ設定
              </h3>
              <button onClick={() => setProfileModal(prev => ({ ...prev, isOpen: false }))} className="p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              {/* 給与形態・基本給 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">給与形態</label>
                  <select
                    value={profileModal.profile.salary_type}
                    onChange={e => setProfileModal({
                      ...profileModal,
                      profile: { ...profileModal.profile, salary_type: e.target.value as any }
                    })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                  >
                    <option value="monthly">月給制（正社員・契約社員）</option>
                    <option value="hourly">時給制（パート・アルバイト）</option>
                    <option value="daily">日給制</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">
                    {profileModal.profile.salary_type === 'hourly' ? '時給単価 (円)' : '基本給 (円)'}
                  </label>
                  <input
                    type="number"
                    value={profileModal.profile.salary_type === 'hourly' ? profileModal.profile.hourly_wage : profileModal.profile.base_salary}
                    onChange={e => {
                      const val = parseInt(e.target.value, 10) || 0;
                      setProfileModal({
                        ...profileModal,
                        profile: profileModal.profile.salary_type === 'hourly' 
                          ? { ...profileModal.profile, hourly_wage: val }
                          : { ...profileModal.profile, base_salary: val }
                      });
                    }}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                  />
                </div>
              </div>

              {/* 手当設定 */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <h4 className="text-xs font-bold text-slate-700 mb-3">各種手当設定（月額）</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">役職手当</label>
                    <input
                      type="number"
                      value={profileModal.profile.position_allowance}
                      onChange={e => setProfileModal({
                        ...profileModal,
                        profile: { ...profileModal.profile, position_allowance: parseInt(e.target.value, 10) || 0 }
                      })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">資格・職能手当</label>
                    <input
                      type="number"
                      value={profileModal.profile.qualification_allowance}
                      onChange={e => setProfileModal({
                        ...profileModal,
                        profile: { ...profileModal.profile, qualification_allowance: parseInt(e.target.value, 10) || 0 }
                      })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">住宅手当</label>
                    <input
                      type="number"
                      value={profileModal.profile.housing_allowance}
                      onChange={e => setProfileModal({
                        ...profileModal,
                        profile: { ...profileModal.profile, housing_allowance: parseInt(e.target.value, 10) || 0 }
                      })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">家族・扶養手当</label>
                    <input
                      type="number"
                      value={profileModal.profile.family_allowance}
                      onChange={e => setProfileModal({
                        ...profileModal,
                        profile: { ...profileModal.profile, family_allowance: parseInt(e.target.value, 10) || 0 }
                      })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">通勤手当（非課税）</label>
                    <input
                      type="number"
                      value={profileModal.profile.commuting_allowance}
                      onChange={e => setProfileModal({
                        ...profileModal,
                        profile: { ...profileModal.profile, commuting_allowance: parseInt(e.target.value, 10) || 0 }
                      })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">扶養親族等の数 (人)</label>
                    <input
                      type="number"
                      value={profileModal.profile.dependents_count}
                      onChange={e => setProfileModal({
                        ...profileModal,
                        profile: { ...profileModal.profile, dependents_count: parseInt(e.target.value, 10) || 0 }
                      })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* 社会保険・税金 */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <h4 className="text-xs font-bold text-slate-700 mb-3">社会保険・税金設定</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={profileModal.profile.health_insurance_enabled}
                      onChange={e => setProfileModal({
                        ...profileModal,
                        profile: { ...profileModal.profile, health_insurance_enabled: e.target.checked }
                      })}
                      className="rounded text-indigo-600"
                    />
                    <span className="text-[11px] font-bold text-slate-700">健康保険</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={profileModal.profile.nursing_insurance_enabled}
                      onChange={e => setProfileModal({
                        ...profileModal,
                        profile: { ...profileModal.profile, nursing_insurance_enabled: e.target.checked }
                      })}
                      className="rounded text-indigo-600"
                    />
                    <span className="text-[11px] font-bold text-slate-700">介護保険 (40歳~)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={profileModal.profile.pension_insurance_enabled}
                      onChange={e => setProfileModal({
                        ...profileModal,
                        profile: { ...profileModal.profile, pension_insurance_enabled: e.target.checked }
                      })}
                      className="rounded text-indigo-600"
                    />
                    <span className="text-[11px] font-bold text-slate-700">厚生年金</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={profileModal.profile.employment_insurance_enabled}
                      onChange={e => setProfileModal({
                        ...profileModal,
                        profile: { ...profileModal.profile, employment_insurance_enabled: e.target.checked }
                      })}
                      className="rounded text-indigo-600"
                    />
                    <span className="text-[11px] font-bold text-slate-700">雇用保険</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">住民税 特別徴収月額 (円)</label>
                    <input
                      type="number"
                      value={profileModal.profile.resident_tax_monthly}
                      onChange={e => setProfileModal({
                        ...profileModal,
                        profile: { ...profileModal.profile, resident_tax_monthly: parseInt(e.target.value, 10) || 0 }
                      })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">税額表区分</label>
                    <select
                      value={profileModal.profile.tax_bracket}
                      onChange={e => setProfileModal({
                        ...profileModal,
                        profile: { ...profileModal.profile, tax_bracket: e.target.value as any }
                      })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    >
                      <option value="kou">甲欄 (本業・主たる給与)</option>
                      <option value="otsu">乙欄 (副業・従たる給与)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 振込先銀行口座 */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <h4 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                  振込先銀行口座情報
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">銀行名</label>
                    <input
                      type="text"
                      placeholder="例: 三井住友銀行"
                      value={profileModal.profile.bank_name || ''}
                      onChange={e => setProfileModal({
                        ...profileModal,
                        profile: { ...profileModal.profile, bank_name: e.target.value }
                      })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">支店名</label>
                    <input
                      type="text"
                      placeholder="例: 新宿支店"
                      value={profileModal.profile.branch_name || ''}
                      onChange={e => setProfileModal({
                        ...profileModal,
                        profile: { ...profileModal.profile, branch_name: e.target.value }
                      })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">口座番号</label>
                    <input
                      type="text"
                      placeholder="例: 1234567"
                      value={profileModal.profile.account_number || ''}
                      onChange={e => setProfileModal({
                        ...profileModal,
                        profile: { ...profileModal.profile, account_number: e.target.value }
                      })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">口座名義人 (カナ)</label>
                    <input
                      type="text"
                      placeholder="例: ヤマダ タロウ"
                      value={profileModal.profile.account_holder || ''}
                      onChange={e => setProfileModal({
                        ...profileModal,
                        profile: { ...profileModal.profile, account_holder: e.target.value }
                      })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                onClick={() => setProfileModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                キャンセル
              </button>
              <button
                onClick={() => handleSaveProfile(profileModal.profile)}
                disabled={isSaving}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                給与マスタを保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 会社給与基本設定モーダル */}
      {settingsModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <SettingsIcon className="w-5 h-5 text-indigo-600" />
                会社給与基本設定
              </h3>
              <button onClick={() => setSettingsModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">締め日</label>
                  <select
                    value={payrollSettings.closing_day}
                    onChange={e => setPayrollSettings({ ...payrollSettings, closing_day: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
                  >
                    <option value="end_of_month">月末締め</option>
                    <option value="20">20日締め</option>
                    <option value="25">25日締め</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">支給日</label>
                  <select
                    value={payrollSettings.payment_day}
                    onChange={e => setPayrollSettings({ ...payrollSettings, payment_day: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
                  >
                    <option value="25">当月25日支給</option>
                    <option value="end_of_month">当月末日支給</option>
                    <option value="10">翌月10日支給</option>
                  </select>
                </div>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2.5">
                <h4 className="font-bold text-slate-700 text-xs">標準社会保険料率（従業員負担分）</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">雇用保険料率</label>
                    <input
                      type="number"
                      step="0.001"
                      value={payrollSettings.employment_insurance_rate}
                      onChange={e => setPayrollSettings({ ...payrollSettings, employment_insurance_rate: parseFloat(e.target.value) || 0.006 })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">健康保険料率</label>
                    <input
                      type="number"
                      step="0.001"
                      value={payrollSettings.health_insurance_rate}
                      onChange={e => setPayrollSettings({ ...payrollSettings, health_insurance_rate: parseFloat(e.target.value) || 0.05 })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">厚生年金保険料率</label>
                    <input
                      type="number"
                      step="0.001"
                      value={payrollSettings.pension_insurance_rate}
                      onChange={e => setPayrollSettings({ ...payrollSettings, pension_insurance_rate: parseFloat(e.target.value) || 0.0915 })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">端数処理方法</label>
                    <select
                      value={payrollSettings.rounding_method}
                      onChange={e => setPayrollSettings({ ...payrollSettings, rounding_method: e.target.value as any })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 font-bold"
                    >
                      <option value="floor">50銭未満切捨（通常）</option>
                      <option value="round">四捨五入</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 pt-4 border-t border-slate-100">
              <button onClick={() => setSettingsModalOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer">
                閉じる
              </button>
              <button onClick={handleSavePayrollSettings} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer">
                設定を保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 公式A4給与明細プレビューモーダル */}
      {previewModal.isOpen && previewModal.payslip && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-slate-100 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <Printer className="w-5 h-5 text-indigo-600" />
                給与明細書 プレビュー・印刷（{previewModal.payslip.user?.name || '従業員'}）
              </h3>
              <button onClick={() => setPreviewModal({ isOpen: false, payslip: null })} className="p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden p-6 bg-slate-50/50">
              <OfficialPayslipDoc payslip={previewModal.payslip} tenantName={tenantInfo?.name} />
            </div>

            <div className="mt-6 flex justify-end gap-2 pt-4 border-t border-slate-100">
              <button onClick={() => setPreviewModal({ isOpen: false, payslip: null })} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer">
                閉じる
              </button>
              <button onClick={() => window.print()} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer">
                <Printer className="w-4 h-4" />
                A4印刷 / PDF保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 明細個別編集モーダル */}
      {editModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-100 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-600" />
                給与明細の個別修正（{editModal.data.user?.name || '従業員'} - {editModal.data.year_month}度）
              </h3>
              <button onClick={() => setEditModal(prev => ({ ...prev, isOpen: false }))} className="p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 text-xs">
              {/* 勤怠項目 */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <h4 className="font-bold text-slate-700 mb-2">勤怠実績の修正</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">出勤日数 (日)</label>
                    <input
                      type="number"
                      value={editModal.data.work_days}
                      onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, work_days: parseFloat(e.target.value) || 0 } })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">実労働時間 (h)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={editModal.data.actual_hours}
                      onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, actual_hours: parseFloat(e.target.value) || 0 } })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">残業時間 (h)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={editModal.data.overtime_hours}
                      onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, overtime_hours: parseFloat(e.target.value) || 0 } })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-rose-600"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">有給取得日数 (日)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={editModal.data.paid_leave_days}
                      onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, paid_leave_days: parseFloat(e.target.value) || 0 } })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-emerald-600"
                    />
                  </div>
                </div>
              </div>

              {/* 支給項目 */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <h4 className="font-bold text-slate-700 mb-2">支給項目の修正 (円)</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">基本給</label>
                    <input
                      type="number"
                      value={editModal.data.base_salary}
                      onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, base_salary: parseInt(e.target.value, 10) || 0 } })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">残業割増手当</label>
                    <input
                      type="number"
                      value={editModal.data.overtime_allowance}
                      onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, overtime_allowance: parseInt(e.target.value, 10) || 0 } })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-rose-600"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">役職手当</label>
                    <input
                      type="number"
                      value={editModal.data.position_allowance}
                      onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, position_allowance: parseInt(e.target.value, 10) || 0 } })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">通勤手当</label>
                    <input
                      type="number"
                      value={editModal.data.commuting_allowance}
                      onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, commuting_allowance: parseInt(e.target.value, 10) || 0 } })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">住宅手当</label>
                    <input
                      type="number"
                      value={editModal.data.housing_allowance}
                      onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, housing_allowance: parseInt(e.target.value, 10) || 0 } })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">特別手当 / インセンティブ</label>
                    <input
                      type="number"
                      value={editModal.data.special_allowance}
                      onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, special_allowance: parseInt(e.target.value, 10) || 0 } })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* 控除項目 */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <h4 className="font-bold text-slate-700 mb-2">控除項目の修正 (円)</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">健康保険料</label>
                    <input
                      type="number"
                      value={editModal.data.health_insurance}
                      onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, health_insurance: parseInt(e.target.value, 10) || 0 } })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">厚生年金保険料</label>
                    <input
                      type="number"
                      value={editModal.data.pension_insurance}
                      onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, pension_insurance: parseInt(e.target.value, 10) || 0 } })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">雇用保険料</label>
                    <input
                      type="number"
                      value={editModal.data.employment_insurance}
                      onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, employment_insurance: parseInt(e.target.value, 10) || 0 } })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">所得税</label>
                    <input
                      type="number"
                      value={editModal.data.income_tax}
                      onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, income_tax: parseInt(e.target.value, 10) || 0 } })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">住民税</label>
                    <input
                      type="number"
                      value={editModal.data.resident_tax}
                      onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, resident_tax: parseInt(e.target.value, 10) || 0 } })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">その他控除</label>
                    <input
                      type="number"
                      value={editModal.data.other_deductions}
                      onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, other_deductions: parseInt(e.target.value, 10) || 0 } })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                onClick={() => setEditModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                キャンセル
              </button>
              <button
                onClick={() => handleSaveEditedPayslip(editModal.data)}
                disabled={isSaving}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <Save className="w-4 h-4" />
                変更を確定保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
