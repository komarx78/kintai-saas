import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  DollarSign, ChevronLeft, ChevronRight,
  Edit3, CheckCircle2, Lock, Unlock, Printer, 
  Users, Sparkles, Loader2, X, FileSpreadsheet,
  Settings as SettingsIcon, Download, UserCheck, CreditCard, Building2, Save,
  ChevronDown, ChevronUp, Clock, Calendar, TrendingUp, MapPin, LayoutGrid, List, RotateCcw
} from 'lucide-react';
import { OfficialPayslipDoc } from './OfficialPayslipDoc';
import { 
  calculatePayroll, 
  type EmployeePayrollProfile, 
  type AttendanceSummary, 
  type PayrollSettings 
} from '../lib/payrollEngine';
import { PREFECTURES, getPrefectureRate, extractPrefectureCodeFromAddress, isNursingInsuranceApplicable } from '../lib/socialInsurance';

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
  paid_leave_remaining?: number;
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
    prefecture_code: '25', // デフォルト: 25 滋賀県
    employment_insurance_rate: 0.006,
    health_insurance_rate: 0.0494, // 滋賀県 9.88% の折半 4.94%
    nursing_insurance_rate: 0.008,
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

  // 勤怠・給与の内訳詳細アコーディオン展開中のユーザーID
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  // 表示モード（'card': 全詳細常時表示カードビュー / 'table': コンパクト表ビュー）
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');

  const updateLocalStorageBackup = (payload: any) => {
    if (!payload.tenant_id) return;
    const localKey = `mf_payslips_${payload.tenant_id}`;
    const existingLocalStr = localStorage.getItem(localKey);
    let localList: any[] = [];
    if (existingLocalStr) {
      try { localList = JSON.parse(existingLocalStr); } catch (e) {}
    }
    localList = localList.filter(p => !(p.user_id === payload.user_id && p.year_month === payload.year_month));
    localList.push(payload);
    localStorage.setItem(localKey, JSON.stringify(localList));
  };

  const sanitizePayslipPayload = (payload: any) => {
    return {
      tenant_id: payload.tenant_id,
      user_id: payload.user_id,
      year_month: payload.year_month,
      payment_date: payload.payment_date || `${payload.year_month}-25`,
      salary_type: payload.salary_type || 'monthly',
      work_days: Number(payload.work_days || 0),
      actual_hours: Number(payload.actual_hours || 0),
      overtime_hours: Number(payload.overtime_hours || 0),
      midnight_hours: Number(payload.midnight_hours || 0),
      holiday_hours: Number(payload.holiday_hours || 0),
      paid_leave_days: Number(payload.paid_leave_days || 0),
      absence_days: Number(payload.absence_days || 0),
      late_early_hours: Number(payload.late_early_hours || 0),
      base_salary: Math.round(payload.base_salary || 0),
      hourly_wage: Math.round(payload.hourly_wage || 0),
      overtime_allowance: Math.round(payload.overtime_allowance || 0),
      midnight_allowance: Math.round(payload.midnight_allowance || 0),
      holiday_allowance: Math.round(payload.holiday_allowance || 0),
      position_allowance: Math.round(payload.position_allowance || 0),
      qualification_allowance: Math.round(payload.qualification_allowance || 0),
      housing_allowance: Math.round(payload.housing_allowance || 0),
      family_allowance: Math.round(payload.family_allowance || 0),
      commuting_allowance: Math.round(payload.commuting_allowance || 0),
      special_allowance: Math.round(payload.special_allowance || 0),
      absence_deduction: Math.round(payload.absence_deduction || 0),
      late_early_deduction: Math.round(payload.late_early_deduction || 0),
      total_earnings: Math.round(payload.total_earnings || 0),
      health_insurance: Math.round(payload.health_insurance || 0),
      nursing_insurance: Math.round(payload.nursing_insurance || 0),
      pension_insurance: Math.round(payload.pension_insurance || 0),
      employment_insurance: Math.round(payload.employment_insurance || 0),
      income_tax: Math.round(payload.income_tax || 0),
      resident_tax: Math.round(payload.resident_tax || 0),
      other_deductions: Math.round(payload.other_deductions || 0),
      total_deductions: Math.round(payload.total_deductions || 0),
      net_salary: Math.round(payload.net_salary || 0),
      note: payload.note || '今月も勤務お疲れ様でした。',
      status: payload.status || 'draft',
      updated_at: new Date().toISOString()
    };
  };

  // 400エラー（UNIQUE制約不足や旧カラムスキーマ）を完全防護するセーフ保存
  const savePayslipSafe = async (rawPayload: any) => {
    const fullPayload = sanitizePayslipPayload(rawPayload);
    // 旧スキーマ対応用（新カラムを除外したペイロード）
    const { 
      salary_type, 
      hourly_wage, 
      absence_deduction, 
      late_early_deduction, 
      special_allowance, 
      position_allowance, 
      qualification_allowance, 
      housing_allowance, 
      family_allowance, 
      ...legacyPayload 
    } = fullPayload as any;

    try {
      // 1. まず完全版で upsert を試行
      const { error: upsertErr } = await supabase
        .from('payslips')
        .upsert(fullPayload, { onConflict: 'tenant_id,user_id,year_month' });

      if (!upsertErr) {
        updateLocalStorageBackup(fullPayload);
        return true;
      }

      // 2. カラム不一致エラー等の場合、レガシー対応版で upsert
      const { error: legacyUpsertErr } = await supabase
        .from('payslips')
        .upsert(legacyPayload, { onConflict: 'tenant_id,user_id,year_month' });

      if (!legacyUpsertErr) {
        updateLocalStorageBackup(fullPayload);
        return true;
      }

      // 3. フォールバック: 既存レコードの select + update / insert
      const { data: existRow } = await supabase
        .from('payslips')
        .select('id')
        .eq('tenant_id', fullPayload.tenant_id)
        .eq('user_id', fullPayload.user_id)
        .eq('year_month', fullPayload.year_month)
        .maybeSingle();

      if (existRow?.id) {
        const { error: updateErr } = await supabase
          .from('payslips')
          .update(legacyPayload)
          .eq('id', existRow.id);
        if (updateErr) console.warn('Payslip update fallback error:', updateErr.message);
      } else {
        const { error: insertErr } = await supabase
          .from('payslips')
          .insert([legacyPayload]);
        if (insertErr) console.warn('Payslip insert fallback error:', insertErr.message);
      }

      updateLocalStorageBackup(fullPayload);
      return true;
    } catch (e) {
      console.warn('savePayslipSafe exception:', e);
      updateLocalStorageBackup(fullPayload);
      return false;
    }
  };

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

      await savePayslipSafe(payload);

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
      birth_date: '',
      health_insurance_enabled: true,
      nursing_insurance_enabled: null,
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
      // 1. 会社情報取得 (tenants & company_master_settings & LocalStorage)
      const { data: tData } = await supabase.from('tenants').select('*').eq('id', tenantId).maybeSingle();
      const { data: cmsData } = await supabase.from('company_master_settings').select('*').eq('tenant_id', tenantId).maybeSingle();
      
      let companyAddress = cmsData?.address || tData?.address || '';
      if (!companyAddress) {
        try {
          const rawLocal = localStorage.getItem(`company_basic_settings_${tenantId}`) || 
                           localStorage.getItem(`company_settings_${tenantId}`) ||
                           localStorage.getItem('company_basic_info');
          if (rawLocal) {
            const parsed = JSON.parse(rawLocal);
            companyAddress = parsed.address || '';
          }
        } catch (e) {}
      }

      // 住所から都道府県コード（滋賀県 = '25' 等）をスマート自動検出！
      const detectedPrefCode = extractPrefectureCodeFromAddress(companyAddress) || 
                               (companyAddress?.includes('滋賀') ? '25' : null) || 
                               '25'; // 滋賀県を最優先デフォルトに！
      setTenantInfo({ ...tData, ...cmsData, address: companyAddress || '滋賀県大津市坂本3丁目21-16', prefecture_code: detectedPrefCode });

      // 2. 給与基本設定取得
      const { data: setRow } = await supabase.from('payroll_settings').select('*').eq('tenant_id', tenantId).maybeSingle();
      
      // 旧デフォルトの '13' (東京) が残っている場合でも、会社住所が滋賀県なら '25' (滋賀県) を優先適用！
      let activePrefCode = setRow?.prefecture_code;
      if (!activePrefCode || activePrefCode === '13') {
        activePrefCode = detectedPrefCode || '25';
      }
      const prefRateData = getPrefectureRate(activePrefCode);

      if (setRow) {
        setPayrollSettings({
          closing_day: setRow.closing_day || 'end_of_month',
          payment_month: setRow.payment_month || 'current',
          payment_day: setRow.payment_day || '25',
          prefecture_code: activePrefCode,
          employment_insurance_rate: setRow.employment_insurance_rate ?? 0.006,
          health_insurance_rate: Number((prefRateData.healthRate / 2).toFixed(5)),
          nursing_insurance_rate: setRow.nursing_insurance_rate ?? 0.008,
          pension_insurance_rate: setRow.pension_insurance_rate ?? 0.0915,
          rounding_method: setRow.rounding_method || 'floor'
        });
      } else {
        setPayrollSettings(prev => ({
          ...prev,
          prefecture_code: activePrefCode,
          health_insurance_rate: Number((prefRateData.healthRate / 2).toFixed(5))
        }));
      }

      // 3. 従業員一覧取得
      const { data: uData } = await supabase
        .from('users')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name');
      const usersList = uData || [];
      setEmployees(usersList);

      // 4. 【大元マスタ SSOT】入退社労務プロファイル取得 (employee_onboarding_profiles)
      let onbList: any[] = [];
      try {
        const { data: oData } = await supabase
          .from('employee_onboarding_profiles')
          .select('*')
          .eq('tenant_id', tenantId);
        onbList = oData || [];
      } catch (e) {
        console.warn('employee_onboarding_profiles fetch error:', e);
      }
      const onbMap = new Map(onbList.map(o => [o.user_id, o]));

      // 5. 従業員給与プロファイル取得 (employee_payroll_profiles)
      let profList: any[] = [];
      try {
        const { data: profData } = await supabase
          .from('employee_payroll_profiles')
          .select('*')
          .eq('tenant_id', tenantId);
        profList = profData || [];
      } catch (e) {
        console.warn('employee_payroll_profiles fetch error:', e);
      }
      const payMap = new Map(profList.map(p => [p.user_id, p]));
      
      const profileMap: Record<string, EmployeePayrollProfile> = {};

      // 大元労務マスタ（SSOT）を起点として各従業員の給与プロファイルを完全構築！
      usersList.forEach(u => {
        const onb: any = onbMap.get(u.id);
        const pay: any = payMap.get(u.id);

        let localBackup: any = null;
        try {
          const raw = localStorage.getItem(`employee_master_backup_${u.id}`);
          if (raw) localBackup = JSON.parse(raw);
        } catch (e) {}

        const bDate = onb?.birth_date || u.birth_date || pay?.birth_date || localBackup?.birth_date || '';
        
        // 給与形態：労務マスタ > 給与マスタ > バックアップ > 雇用形態判定
        const salType = onb?.salary_type || pay?.salary_type || localBackup?.salary_type || (u.employment_type === 'part-time' ? 'hourly' : 'monthly');
        // 基本給：労務マスタ > 給与マスタ > バックアップ > 250000
        const bSalary = onb?.base_salary ?? pay?.base_salary ?? localBackup?.base_salary ?? 250000;
        // 時給：労務マスタ > 給与マスタ > バックアップ > 1150
        const hWage = onb?.hourly_wage ?? pay?.hourly_wage ?? localBackup?.hourly_wage ?? 1150;
        // 役職手当
        const posAllow = onb?.position_allowance ?? pay?.position_allowance ?? localBackup?.position_allowance ?? 0;
        // 資格手当
        const qualAllow = onb?.qualification_allowance ?? pay?.qualification_allowance ?? localBackup?.qualification_allowance ?? 0;
        // 住宅手当
        const houseAllow = onb?.housing_allowance ?? pay?.housing_allowance ?? localBackup?.housing_allowance ?? 0;
        // 家族手当
        const famAllow = onb?.family_allowance ?? pay?.family_allowance ?? localBackup?.family_allowance ?? 0;
        // 通勤手当
        const comAllow = onb?.commuting_allowance ?? pay?.commuting_allowance ?? localBackup?.commuting_allowance ?? 15000;

        // 銀行口座情報（SSOT: バックアップ > 労務マスタ > 給与マスタ）
        const bName = localBackup?.bank_name || onb?.bank_name || pay?.bank_name || '';
        const brName = localBackup?.branch_name || onb?.branch_name || pay?.branch_name || '';
        const accType = localBackup?.account_type || onb?.account_type || pay?.account_type || 'ordinary';
        const accNum = localBackup?.account_number || onb?.account_number || pay?.account_number || '';
        const accHolder = localBackup?.account_holder || onb?.account_holder || pay?.account_holder || u.name || '';

        profileMap[u.id] = {
          tenant_id: tenantId,
          user_id: u.id,
          salary_type: salType,
          base_salary: bSalary,
          hourly_wage: hWage,
          position_allowance: posAllow,
          qualification_allowance: qualAllow,
          housing_allowance: houseAllow,
          family_allowance: famAllow,
          commuting_allowance: comAllow,
          commuting_taxable: pay?.commuting_taxable ?? false,
          fixed_overtime_hours: pay?.fixed_overtime_hours ?? 0,
          fixed_overtime_allowance: pay?.fixed_overtime_allowance ?? 0,
          dependents_count: pay?.dependents_count ?? localBackup?.dependents_count ?? 0,
          birth_date: bDate,
          health_insurance_enabled: onb?.health_insurance_joined ?? pay?.health_insurance_enabled ?? localBackup?.health_insurance_joined ?? true,
          nursing_insurance_enabled: pay?.nursing_insurance_enabled ?? null,
          pension_insurance_enabled: onb?.pension_insurance_joined ?? pay?.pension_insurance_enabled ?? localBackup?.pension_insurance_joined ?? true,
          employment_insurance_enabled: onb?.employment_insurance_joined ?? pay?.employment_insurance_enabled ?? localBackup?.employment_insurance_joined ?? true,
          resident_tax_monthly: pay?.resident_tax_monthly ?? 0,
          tax_bracket: pay?.tax_bracket || 'kou',
          bank_name: bName,
          branch_name: brName,
          account_type: accType,
          account_number: accNum,
          account_holder: accHolder
        };
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

      // 6. 各従業員の給与明細を大元労務マスタ（SSOT）に基づいて完全最新化
      const prefRateDataLatest = getPrefectureRate(activePrefCode);
      const latestPayrollSettings: any = {
        prefecture_code: activePrefCode,
        employment_insurance_rate: 0.006,
        health_insurance_rate: Number((prefRateDataLatest.healthRate / 2).toFixed(5)),
        nursing_insurance_rate: 0.008,
        pension_insurance_rate: 0.0915,
        rounding_method: 'floor'
      };

      const finalPayslips = usersList.map(u => {
        const prof = profileMap[u.id];
        const existingSlip = combinedPayslips.find(cp => cp.user_id === u.id);

        const isHourly = prof?.salary_type === 'hourly';
        const defaultWorkDays = isHourly ? 0 : 20;
        const defaultActualHours = isHourly ? 0 : 160;

        const attSummary: AttendanceSummary = {
          work_days: existingSlip?.work_days ?? defaultWorkDays,
          actual_hours: existingSlip?.actual_hours ?? defaultActualHours,
          overtime_hours: existingSlip?.overtime_hours ?? 0,
          midnight_hours: existingSlip?.midnight_hours ?? 0,
          holiday_hours: existingSlip?.holiday_hours ?? 0,
          paid_leave_days: existingSlip?.paid_leave_days ?? 0,
          absence_days: existingSlip?.absence_days ?? 0,
          late_early_hours: existingSlip?.late_early_hours ?? 0
        };

        // 大元労務マスタから最新の給与計算（個別基本給・各種手当＋生年月日の介護保険自動判定）を実行！
        const calculated = calculatePayroll(prof, attSummary, latestPayrollSettings);

        // 有給残日数（ユーザー基本情報の残日数、またはデフォルト付与日数）
        const userLeaveBal = u.paid_leave_balance !== undefined && u.paid_leave_balance !== null 
          ? Number(u.paid_leave_balance) 
          : (u.employment_type === 'part-time' ? 5.0 : 10.0);

        return {
          id: existingSlip?.id || `draft_${u.id}_${currentYearMonth}`,
          tenant_id: tenantId,
          user_id: u.id,
          year_month: currentYearMonth,
          payment_date: existingSlip?.payment_date || `${currentYearMonth}-25`,
          paid_leave_remaining: existingSlip?.paid_leave_remaining !== undefined && existingSlip?.paid_leave_remaining !== null 
            ? Number(existingSlip.paid_leave_remaining) 
            : userLeaveBal,
          ...calculated,
          note: existingSlip?.note || '今月も勤務お疲れ様でした。',
          status: existingSlip?.status || 'draft',
          user: u
        };
      });

      setPayslips(finalPayslips);
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
      // 締め日設定に基づく集計期間算出
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      let startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      let endDate = new Date(year, month, 0).toISOString().split('T')[0];

      if (payrollSettings.closing_day === '20') {
        const prevM = month === 1 ? 12 : month - 1;
        const prevY = month === 1 ? year - 1 : year;
        startDate = `${prevY}-${prevM.toString().padStart(2, '0')}-21`;
        endDate = `${year}-${month.toString().padStart(2, '0')}-20`;
      } else if (payrollSettings.closing_day === '25') {
        const prevM = month === 1 ? 12 : month - 1;
        const prevY = month === 1 ? year - 1 : year;
        startDate = `${prevY}-${prevM.toString().padStart(2, '0')}-26`;
        endDate = `${year}-${month.toString().padStart(2, '0')}-25`;
      }

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
        .gte('start_date', startDate)
        .lte('start_date', endDate);

      const records = attData || [];
      const shifts = shiftData || [];
      const requests = reqData || [];

      const activePrefecture = payrollSettings.prefecture_code || tenantInfo?.prefecture_code || '25';

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
              const breakM = r.break_minutes ?? (total >= 480 ? 60 : (total >= 360 ? 45 : 0));
              const work = Math.max(0, total - breakM);
              actualMins += work;
              
              // 残業時間の計算（明示残業分または8h超過分）
              if (r.overtime_minutes && r.overtime_minutes > 0) {
                overtimeMins += r.overtime_minutes;
              } else {
                overtimeMins += Math.max(0, work - 480);
              }

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
        const empRequests = requests.filter(r => 
          r.user_id === emp.id && 
          (r.status === '承認' || !r.status || r.status === 'approved') &&
          (r.type?.includes('有給') || r.type?.includes('年休') || r.leave_type?.includes('有給') || r.reason?.includes('有給'))
        );
        const paidLeaveDays = empRequests.length;

        // 従業員の給与マスタプロファイル
        const existingProf = payrollProfiles[emp.id];
        
        let localBackup: any = null;
        try {
          const raw = localStorage.getItem(`employee_master_backup_${emp.id}`);
          if (raw) localBackup = JSON.parse(raw);
        } catch (e) {}

        const empBirthDate = existingProf?.birth_date || emp.birth_date || localBackup?.birth_date || null;

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
          birth_date: empBirthDate,
          health_insurance_enabled: existingProf?.health_insurance_enabled ?? true,
          nursing_insurance_enabled: existingProf?.nursing_insurance_enabled,
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
        const empLeaveBal = emp.paid_leave_balance !== undefined && emp.paid_leave_balance !== null 
          ? Number(emp.paid_leave_balance) 
          : (emp.employment_type === 'part-time' ? 5.0 : 10.0);

        const payload: any = {
          tenant_id: tenantId,
          user_id: emp.id,
          year_month: currentYearMonth,
          payment_date: `${currentYearMonth}-${paymentDayStr.padStart(2, '0')}`,
          paid_leave_remaining: empLeaveBal,
          ...calculated,
          note: '今月も勤務お疲れ様でした。',
          status: 'draft',
          updated_at: new Date().toISOString()
        };

        await savePayslipSafe(payload);
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
    if (!confirm(`${currentYearMonth}度 の給与明細（全${payslips.length}件）を一括確定し、従業員へWeb公開しますか？`)) return;

    setIsSaving(true);
    try {
      // 画面上の全給与明細を確実に published として保存
      for (const slip of payslips) {
        const payload = {
          ...slip,
          tenant_id: tenantId,
          year_month: currentYearMonth,
          status: 'published' as const,
          updated_at: new Date().toISOString()
        };
        await savePayslipSafe(payload);
      }

      // Supabase 側の直接 update も実行
      try {
        await supabase
          .from('payslips')
          .update({ status: 'published', updated_at: new Date().toISOString() })
          .eq('tenant_id', tenantId)
          .eq('year_month', currentYearMonth);
      } catch (e) {}

      alert('🎉 全員の給与明細を一括確定・公開しました！\n従業員のWeb給与明細画面へ即時反映されました。');
      await fetchData();
    } catch (err: any) {
      console.error('Publish error:', err);
      alert('公開処理に失敗しました: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 一括下書きに戻す（Web公開取下げ）
  const handleUnpublishAll = async () => {
    if (payslips.length === 0) return;
    if (!confirm(`${currentYearMonth}度 の給与明細を一括で「下書き」に戻し、従業員へのWeb公開を取下げますか？`)) return;

    setIsSaving(true);
    try {
      for (const slip of payslips) {
        const payload = {
          ...slip,
          tenant_id: tenantId,
          year_month: currentYearMonth,
          status: 'draft' as const,
          updated_at: new Date().toISOString()
        };
        await savePayslipSafe(payload);
      }

      try {
        await supabase
          .from('payslips')
          .update({ status: 'draft', updated_at: new Date().toISOString() })
          .eq('tenant_id', tenantId)
          .eq('year_month', currentYearMonth);
      } catch (e) {}

      alert('🔄 全員の給与明細を「下書き」に戻しました。\n（従業員のWeb明細一覧からも非公開になりました）');
      await fetchData();
    } catch (err: any) {
      console.error('Unpublish error:', err);
      alert('下書き戻し処理に失敗しました: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 個別の確定公開 / 下書きトグル
  const handleTogglePublishSingle = async (slip: Payslip) => {
    if (!tenantId) return;
    const newStatus = slip.status === 'published' ? 'draft' : 'published';
    const actionName = newStatus === 'published' ? '確定公開' : '下書きに戻す';
    
    if (!confirm(`【${slip.user?.name || '従業員'}】の給与明細を「${actionName}」にしますか？`)) return;

    setIsSaving(true);
    try {
      const payload = {
        ...slip,
        tenant_id: tenantId,
        year_month: currentYearMonth,
        status: newStatus,
        updated_at: new Date().toISOString()
      };
      await savePayslipSafe(payload);
      await fetchData();
    } catch (e: any) {
      console.error('Toggle single publish error:', e);
      alert('更新に失敗しました: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 給与マスタプロファイル保存
  const handleSaveProfile = async (prof: EmployeePayrollProfile) => {
    if (!tenantId) return;
    setIsSaving(true);
    try {
      // 1. LocalStorage バックアップへのマージ保存（SSOT保護）
      let localMaster: any = {};
      try {
        const raw = localStorage.getItem(`employee_master_backup_${prof.user_id}`);
        if (raw) localMaster = JSON.parse(raw);
      } catch (e) {}

      localMaster = {
        ...localMaster,
        birth_date: prof.birth_date !== undefined ? prof.birth_date : localMaster.birth_date,
        salary_type: prof.salary_type,
        base_salary: prof.base_salary,
        hourly_wage: prof.hourly_wage,
        position_allowance: prof.position_allowance,
        qualification_allowance: prof.qualification_allowance,
        housing_allowance: prof.housing_allowance,
        family_allowance: prof.family_allowance,
        commuting_allowance: prof.commuting_allowance,
        bank_name: prof.bank_name !== undefined ? prof.bank_name : (localMaster.bank_name || ''),
        branch_name: prof.branch_name !== undefined ? prof.branch_name : (localMaster.branch_name || ''),
        account_type: prof.account_type || localMaster.account_type || 'ordinary',
        account_number: prof.account_number !== undefined ? prof.account_number : (localMaster.account_number || ''),
        account_holder: prof.account_holder !== undefined ? prof.account_holder : (localMaster.account_holder || ''),
        dependents_count: prof.dependents_count,
        updated_at: new Date().toISOString()
      };
      try {
        localStorage.setItem(`employee_master_backup_${prof.user_id}`, JSON.stringify(localMaster));
      } catch (e) {}

      // 2. employee_payroll_profiles への保存
      try {
        const { error } = await supabase
          .from('employee_payroll_profiles')
          .upsert(prof, { onConflict: 'tenant_id,user_id' });

        if (error) console.warn('Supabase payroll profile upsert error:', error.message);
      } catch (dbErr) {
        console.warn('Supabase payroll profile exception:', dbErr);
      }

      // 3. employee_onboarding_profiles にも口座情報を同期
      try {
        await supabase
          .from('employee_onboarding_profiles')
          .update({
            bank_name: prof.bank_name,
            branch_name: prof.branch_name,
            account_type: prof.account_type,
            account_number: prof.account_number,
            account_holder: prof.account_holder,
            updated_at: new Date().toISOString()
          })
          .eq('tenant_id', tenantId)
          .eq('user_id', prof.user_id);
      } catch (onbErr) {}

      // 3. users テーブル側にも生年月日を安全に同期
      if (prof.birth_date && prof.user_id) {
        try {
          await supabase
            .from('users')
            .update({ birth_date: prof.birth_date })
            .eq('id', prof.user_id);
        } catch (uErr) {
          console.warn('users birth_date update:', uErr);
        }
      }

      alert('従業員の給与マスタ設定（生年月日・口座・社保・手当）を保存しました！');
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

      alert('会社給与基本設定を保存しました！適用都道府県と保険料率が更新されました。');
      setSettingsModalOpen(false);
      await fetchData();
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

      {/* 📍 適用社会保険料率バッジバー */}
      {(() => {
        const prefCode = payrollSettings.prefecture_code || tenantInfo?.prefecture_code || '13';
        const prefData = getPrefectureRate(prefCode);
        return (
          <div className="bg-gradient-to-r from-indigo-50 via-blue-50 to-indigo-50/60 border border-indigo-200/80 rounded-2xl p-3.5 px-4.5 flex flex-wrap items-center justify-between gap-2 text-xs shadow-2xs">
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 rounded-xl bg-indigo-600 text-white font-bold shadow-xs">
                <MapPin className="w-4 h-4" />
              </span>
              <div>
                <span className="font-bold text-slate-700">適用社会保険料率: </span>
                <span className="font-black text-indigo-800 text-sm">{prefData.name}</span>
                <span className="text-indigo-600 font-bold ml-1.5">（健康保険 {(prefData.healthRate * 100).toFixed(2)}% / 折半 {(prefData.healthRate * 50).toFixed(3)}%）</span>
                <span className="text-slate-400 text-[11px] ml-2 font-mono">※厚生年金 18.30% / 雇用 0.6% / 介護 1.60%</span>
              </div>
            </div>
            <button
              onClick={() => setSettingsModalOpen(true)}
              className="text-[11px] bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <SettingsIcon className="w-3.5 h-3.5 text-indigo-600" />
              都道府県・設定を変更
            </button>
          </div>
        );
      })()}

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
            title="全員の給与明細を確定し、Web給与明細で従業員へ公開します"
          >
            <CheckCircle2 className="w-4 h-4" />
            一括確定 (Web公開)
          </button>

          <button
            onClick={handleUnpublishAll}
            disabled={isSaving || payslips.length === 0}
            className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold text-sm px-3.5 py-2.5 rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="全員の給与明細を一度下書きに戻し、従業員へのWeb公開を取下げます"
          >
            <RotateCcw className="w-4 h-4 text-amber-600" />
            一括下書きに戻す (公開取下げ)
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
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-white">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
            <h3 className="font-black text-slate-800 text-base">
              {currentYearMonth}度 給与明細一覧
            </h3>
            <span className="text-xs text-slate-400 font-bold ml-1">（全{payslips.length}名）</span>
          </div>

          {/* 表示形式切り替えタブ */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('card')}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'card' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              📑 全詳細カード一覧（標準・常時全開）
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'table' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              📋 コンパクト表
            </button>
          </div>
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
        ) : viewMode === 'card' ? (
          /* 📑 全詳細カード一覧（詳細を押さなくても常時全開！） */
          <div className="p-4 sm:p-6 space-y-6 bg-slate-50/60">
            {payslips.map(slip => {
              const prof = payrollProfiles[slip.user_id];
              const isHourly = prof?.salary_type === 'hourly' || slip.salary_type === 'hourly';
              const prefCode = payrollSettings.prefecture_code || tenantInfo?.prefecture_code || '25';
              const prefData = getPrefectureRate(prefCode);

              return (
                <div key={slip.user_id} className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs hover:shadow-md transition">
                  {/* カード上部: 社員基本情報 & 操作 */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 font-black text-lg flex items-center justify-center border border-indigo-100 shadow-2xs">
                        {(slip.user?.name || '員').substring(0, 1)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-black text-slate-800">{slip.user?.name || '従業員'}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                            isHourly ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}>
                            {isHourly ? '時給制' : '月給制'}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                            slip.status === 'published' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}>
                            {slip.status === 'published' ? '公開確定済' : '下書き'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2.5 mt-1.5">
                          <span className="font-bold text-slate-600">{slip.user?.department || '一般社員'}</span>
                          <span>•</span>
                          <span>{slip.user?.join_date ? `${slip.user.join_date} 入社` : '社員'}</span>
                          {prof?.birth_date ? (() => {
                            const bDate = new Date(prof.birth_date);
                            const now = new Date();
                            let age = now.getFullYear() - bDate.getFullYear();
                            const mDiff = now.getMonth() - bDate.getMonth();
                            if (mDiff < 0 || (mDiff === 0 && now.getDate() < bDate.getDate())) age--;
                            const isNursing = isNursingInsuranceApplicable(prof.birth_date, new Date());
                            return (
                              <>
                                <span>•</span>
                                <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold text-[11px] border border-indigo-100 flex items-center gap-1">
                                  🎂 {String(prof.birth_date).substring(0, 10)}生 ({age}歳 / {isNursing ? '🛡️介護保険対象' : '介護保険非対象'})
                                </span>
                              </>
                            );
                          })() : (
                            <>
                              <span>•</span>
                              <span className="text-slate-400 text-[11px]">生年月日未登録</span>
                            </>
                          )}
                          {prof?.bank_name ? (
                            <span className="text-[11px] text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded-lg">
                              🏦 {prof.bank_name} {prof.branch_name} ({prof.account_type === 'current' ? '当座' : '普通'} {prof.account_number})
                            </span>
                          ) : (
                            <span className="text-[11px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                              ⚠️ 口座未登録
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => handleTogglePublishSingle(slip)}
                        className={`text-xs font-bold px-3 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                          slip.status === 'published'
                            ? 'bg-emerald-50 hover:bg-rose-50 text-emerald-700 hover:text-rose-700 border border-emerald-200 hover:border-rose-200'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                        }`}
                        title={slip.status === 'published' ? 'クリックして下書きに戻す' : 'クリックして確定公開する'}
                      >
                        {slip.status === 'published' ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                        {slip.status === 'published' ? '公開中（下書きに戻す）' : '確定公開する'}
                      </button>

                      <button
                        onClick={() => setProfileModal({ isOpen: true, user: slip.user, profile: prof || getInitialProfile(tenantId || '', slip.user_id) })}
                        className="text-xs font-bold text-slate-600 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 border border-slate-200 px-3 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                        給与マスタ設定
                      </button>
                      <button
                        onClick={() => setEditModal({ isOpen: true, data: { ...slip } })}
                        className="text-xs font-bold text-slate-600 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 border border-slate-200 px-3 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                        個別編集
                      </button>
                      <button
                        onClick={() => setPreviewModal({ isOpen: true, payslip: slip })}
                        className="text-xs font-bold text-indigo-600 hover:text-white bg-indigo-50 hover:bg-indigo-600 border border-indigo-200 px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        明細プレビュー / 印刷
                      </button>
                    </div>
                  </div>

                  {/* カード中央: 3カラム全詳細グリッド（常時展開） */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                    {/* 1. 勤怠実績 */}
                    <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-200 space-y-2">
                      <div className="font-bold text-blue-900 flex items-center justify-between text-xs pb-2 border-b border-blue-200">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-blue-600" />
                          ① 勤怠・就業実績
                        </span>
                        <span className="text-xs text-blue-700 font-mono font-black">{slip.work_days}日 出勤</span>
                      </div>
                      <div className="space-y-2 text-slate-700 text-xs pt-1">
                        <div className="flex justify-between">
                          <span className="text-slate-500">総実労働時間:</span>
                          <span className="font-bold font-mono text-slate-800">{slip.actual_hours} 時間</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">普通残業時間:</span>
                          {slip.overtime_hours > 0 ? (
                            <span className="font-black font-mono text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md border border-rose-200 text-xs">
                              {slip.overtime_hours} 時間
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono">0 時間</span>
                          )}
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">深夜労働時間:</span>
                          <span className="font-mono text-slate-800">{slip.midnight_hours || 0} 時間</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">有給取得日数:</span>
                          {slip.paid_leave_days && slip.paid_leave_days > 0 ? (
                            <span className="font-black font-mono text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200 text-xs">
                              {slip.paid_leave_days} 日
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono">0 日</span>
                          )}
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">欠勤日数:</span>
                          <span className="font-mono text-slate-800">{slip.absence_days || 0} 日</span>
                        </div>
                        <div className="flex justify-between items-center bg-blue-100/80 px-2.5 py-1.5 rounded-xl border border-blue-200 mt-2">
                          <span className="font-black text-blue-900 text-xs">🏖️ 有休残日数:</span>
                          <span className="font-black font-mono text-blue-950 text-xs bg-white px-2 py-0.5 rounded-md border border-blue-300">
                            {(slip.paid_leave_remaining !== undefined && slip.paid_leave_remaining !== null ? Number(slip.paid_leave_remaining) : (slip.user?.paid_leave_balance ?? 10.0)).toFixed(1)} 日
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 2. 支給額明細 */}
                    <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200 space-y-2">
                      <div className="font-bold text-emerald-900 flex items-center justify-between text-xs pb-2 border-b border-emerald-200">
                        <span className="flex items-center gap-1.5">
                          <DollarSign className="w-4 h-4 text-emerald-600" />
                          ② 支給額の計算内訳
                        </span>
                        <span className="text-xs text-emerald-800 font-black">¥{(slip.total_earnings || 0).toLocaleString()}</span>
                      </div>
                      <div className="space-y-2 text-slate-700 text-xs pt-1">
                        <div className="flex justify-between">
                          <span className="text-slate-500">基本給:</span>
                          <span className="font-bold font-mono text-slate-800">¥{(slip.base_salary || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">残業手当 (割増):</span>
                          <span className={`font-black font-mono ${slip.overtime_allowance > 0 ? 'text-rose-600 text-xs' : 'text-slate-400'}`}>
                            ¥{(slip.overtime_allowance || 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">通勤手当 (非課税):</span>
                          <span className="font-mono text-slate-800">¥{(slip.commuting_allowance || 0).toLocaleString()}</span>
                        </div>
                        {((slip.position_allowance || 0) + (slip.qualification_allowance || 0) + (slip.housing_allowance || 0) + (slip.family_allowance || 0)) > 0 ? (
                          <div className="flex justify-between text-blue-700">
                            <span className="text-slate-500">役職・資格・諸手当:</span>
                            <span className="font-mono">¥{((slip.position_allowance || 0) + (slip.qualification_allowance || 0) + (slip.housing_allowance || 0) + (slip.family_allowance || 0)).toLocaleString()}</span>
                          </div>
                        ) : null}
                        <div className="border-t border-emerald-200 pt-1.5 flex justify-between font-black text-emerald-900 text-xs">
                          <span>総支給額（額面）:</span>
                          <span className="font-mono text-sm">¥{(slip.total_earnings || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* 3. 控除額明細 */}
                    <div className="bg-rose-50/60 p-4 rounded-2xl border border-rose-200 space-y-2">
                      <div className="font-bold text-rose-900 flex items-center justify-between text-xs pb-2 border-b border-rose-200">
                        <span className="flex items-center gap-1.5">
                          <TrendingUp className="w-4 h-4 text-rose-600" />
                          ③ 控除額の計算内訳
                        </span>
                        <span className="text-xs text-rose-800 font-black">-¥{(slip.total_deductions || 0).toLocaleString()}</span>
                      </div>
                      <div className="space-y-2 text-slate-700 text-xs pt-1">
                        <div className="flex justify-between">
                          <span className="text-slate-500">健康保険 ({prefData.name} {(prefData.healthRate * 50).toFixed(3)}%):</span>
                          <span className="font-bold font-mono text-slate-800">¥{(slip.health_insurance || 0).toLocaleString()}</span>
                        </div>
                        {slip.nursing_insurance && slip.nursing_insurance > 0 ? (
                          <div className="flex justify-between text-purple-700">
                            <span className="text-slate-500">介護保険 (40〜64歳):</span>
                            <span className="font-mono">¥{slip.nursing_insurance.toLocaleString()}</span>
                          </div>
                        ) : null}
                        <div className="flex justify-between">
                          <span className="text-slate-500">厚生年金保険料:</span>
                          <span className="font-mono text-slate-800">¥{(slip.pension_insurance || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">雇用保険料 (0.6%):</span>
                          <span className="font-mono text-slate-800">¥{(slip.employment_insurance || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-indigo-700 font-bold">
                          <span>所得税 (源泉徴収):</span>
                          <span className="font-mono">¥{(slip.income_tax || 0).toLocaleString()}</span>
                        </div>
                        <div className="border-t border-rose-200 pt-1.5 flex justify-between font-black text-rose-900 text-xs">
                          <span>控除合計額:</span>
                          <span className="font-mono text-sm">-¥{(slip.total_deductions || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* カード下部: 手取り振込額バナー */}
                  <div className="mt-4 bg-gradient-to-r from-indigo-600 via-indigo-700 to-blue-700 text-white rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-md shadow-indigo-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-amber-300" />
                      </div>
                      <div>
                        <div className="text-[11px] text-indigo-200 font-medium">差引支給額（従業員口座への実振込手取り額）</div>
                        <div className="text-xs font-bold text-white">
                          総支給 ¥{(slip.total_earnings || 0).toLocaleString()} − 控除 ¥{(slip.total_deductions || 0).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="text-2xl font-black tracking-tight text-amber-300 font-mono">
                      ¥{(slip.net_salary || 0).toLocaleString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[960px]">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3 px-4">従業員名</th>
                  <th className="py-3 px-3">給与形態</th>
                  <th className="py-3 px-3 text-right">📅 出勤/総労働</th>
                  <th className="py-3 px-3 text-right">⏰ 残業・時間外</th>
                  <th className="py-3 px-3 text-right">💰 総支給額</th>
                  <th className="py-3 px-3 text-right">📉 控除合計</th>
                  <th className="py-3 px-4 text-right">🎁 手取り支給額</th>
                  <th className="py-3 px-3 text-center">状態</th>
                  <th className="py-3 px-4 text-center">内訳 / 操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {payslips.map(slip => {
                  const prof = payrollProfiles[slip.user_id];
                  const isHourly = prof?.salary_type === 'hourly' || slip.salary_type === 'hourly';
                  const isExpanded = expandedUserId === slip.user_id;

                  return (
                    <React.Fragment key={slip.user_id}>
                      <tr 
                        className={`hover:bg-indigo-50/40 transition cursor-pointer ${isExpanded ? 'bg-indigo-50/30' : ''}`}
                        onClick={() => setExpandedUserId(isExpanded ? null : slip.user_id)}
                      >
                        <td className="py-3.5 px-4 font-bold text-slate-800">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 font-bold flex items-center justify-center text-xs">
                              {(slip.user?.name || '員').substring(0, 1)}
                            </div>
                            <div>
                              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                                {slip.user?.name || '従業員'}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedUserId(isExpanded ? null : slip.user_id);
                                  }}
                                  className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-normal transition flex items-center gap-0.5"
                                  title="勤怠・給与の内訳を展開"
                                >
                                  {isExpanded ? <ChevronUp className="w-3 h-3 text-indigo-600" /> : <ChevronDown className="w-3 h-3" />}
                                  内訳
                                </button>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setProfileModal({ isOpen: true, user: slip.user, profile: prof || getInitialProfile(tenantId || '', slip.user_id) });
                                }}
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
                          <div className="font-bold text-slate-800">{slip.work_days}日 出勤</div>
                          <div className="text-[10px] text-slate-400 font-mono">総労働 {slip.actual_hours}h</div>
                        </td>

                        <td className="py-3.5 px-3 text-right font-medium text-slate-700">
                          <div className="flex flex-col items-end gap-0.5">
                            {slip.overtime_hours > 0 ? (
                              <span className="bg-rose-50 text-rose-700 font-black px-2 py-0.5 rounded text-[11px] border border-rose-200">
                                残業 {slip.overtime_hours}h
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">残業なし</span>
                            )}
                            <div className="flex items-center gap-1 text-[10px] text-slate-400">
                              {slip.midnight_hours && slip.midnight_hours > 0 ? (
                                <span className="text-purple-600 font-bold">🌙深夜 {slip.midnight_hours}h</span>
                              ) : null}
                              {slip.paid_leave_days && slip.paid_leave_days > 0 ? (
                                <span className="text-emerald-600 font-bold">🏖️有給 {slip.paid_leave_days}日</span>
                              ) : null}
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-3 text-right">
                          <div className="font-bold text-slate-800">¥{(slip.total_earnings || 0).toLocaleString()}</div>
                          <div className="text-[10px] text-slate-400">
                            基本 ¥{(slip.base_salary || 0).toLocaleString()}
                          </div>
                        </td>

                        <td className="py-3.5 px-3 text-right font-medium text-rose-600">
                          <div className="font-bold">-¥{(slip.total_deductions || 0).toLocaleString()}</div>
                          <div className="text-[10px] text-slate-400">
                            社保 ¥{((slip.health_insurance || 0) + (slip.nursing_insurance || 0) + (slip.pension_insurance || 0) + (slip.employment_insurance || 0)).toLocaleString()}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <span className="font-black text-sm text-indigo-600">
                            ¥{(slip.net_salary || 0).toLocaleString()}
                          </span>
                        </td>

                        <td className="py-3.5 px-3 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTogglePublishSingle(slip);
                            }}
                            className={`text-[10px] font-bold px-2.5 py-1 rounded-full border flex items-center justify-center gap-1 w-fit mx-auto cursor-pointer transition ${
                              slip.status === 'published'
                                ? 'bg-emerald-50 hover:bg-rose-50 text-emerald-700 hover:text-rose-700 border-emerald-200 hover:border-rose-200'
                                : 'bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border-slate-200 hover:border-emerald-200'
                            }`}
                            title={slip.status === 'published' ? 'クリックして下書きに戻す' : 'クリックして確定公開する'}
                          >
                            {slip.status === 'published' ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                            {slip.status === 'published' ? '確定公開済' : '下書き'}
                          </button>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleTogglePublishSingle(slip)}
                              className={`p-1.5 rounded-lg transition cursor-pointer ${
                                slip.status === 'published'
                                  ? 'text-emerald-600 hover:bg-rose-50 hover:text-rose-600'
                                  : 'text-indigo-600 hover:bg-indigo-50'
                              }`}
                              title={slip.status === 'published' ? '下書きに戻す' : '確定公開する'}
                            >
                              {slip.status === 'published' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                            </button>
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

                      {/* 📋 行展開: 勤怠・支給・控除の超詳細アコーディオン */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90 border-b border-slate-200">
                          <td colSpan={9} className="p-4 sm:p-5">
                            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-4">
                              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-indigo-600" />
                                  【{slip.user?.name || '従業員'}】の当月 勤怠実績 ＆ 給与控除・手取り計算明細
                                </div>
                                <span className="text-[11px] text-slate-400">
                                  支給日: {slip.payment_date || `${currentYearMonth}-25`}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                                {/* 1. 勤怠実績 */}
                                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                                  <div className="font-bold text-slate-700 flex items-center gap-1.5 text-[11px]">
                                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                                    ① 勤怠・就業実績
                                  </div>
                                  <div className="space-y-1.5 text-slate-600 pt-1 text-[11px]">
                                    <div className="flex justify-between">
                                      <span>出勤日数:</span>
                                      <span className="font-bold text-slate-800">{slip.work_days} 日</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>総労働時間:</span>
                                      <span className="font-bold text-slate-800">{slip.actual_hours} 時間</span>
                                    </div>
                                    <div className="flex justify-between text-rose-600 font-bold">
                                      <span>普通残業時間:</span>
                                      <span>{slip.overtime_hours} 時間</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>深夜労働時間:</span>
                                      <span>{slip.midnight_hours || 0} 時間</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>休日労働時間:</span>
                                      <span>{slip.holiday_hours || 0} 時間</span>
                                    </div>
                                    <div className="flex justify-between text-emerald-600">
                                      <span>有給取得日数:</span>
                                      <span>{slip.paid_leave_days || 0} 日</span>
                                    </div>
                                    <div className="flex justify-between text-slate-400">
                                      <span>欠勤日数:</span>
                                      <span>{slip.absence_days || 0} 日</span>
                                    </div>
                                    <div className="flex justify-between items-center bg-blue-100/70 p-1.5 rounded-lg border border-blue-200 text-blue-900 font-bold mt-1.5">
                                      <span>🏖️ 有休残日数:</span>
                                      <span className="font-mono font-black text-xs">
                                        {(slip.paid_leave_remaining !== undefined && slip.paid_leave_remaining !== null ? Number(slip.paid_leave_remaining) : (slip.user?.paid_leave_balance ?? 10.0)).toFixed(1)} 日
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* 2. 支給明細 */}
                                <div className="bg-emerald-50/40 p-3.5 rounded-xl border border-emerald-200 space-y-2">
                                  <div className="font-bold text-emerald-800 flex items-center gap-1.5 text-[11px]">
                                    <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                                    ② 支給額の計算内訳
                                  </div>
                                  <div className="space-y-1.5 text-slate-600 pt-1 text-[11px]">
                                    <div className="flex justify-between">
                                      <span>基本給:</span>
                                      <span className="font-bold text-slate-800">¥{(slip.base_salary || 0).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-rose-600 font-bold">
                                      <span>残業手当（時間外割増）:</span>
                                      <span>¥{(slip.overtime_allowance || 0).toLocaleString()}</span>
                                    </div>
                                    {slip.midnight_allowance && slip.midnight_allowance > 0 ? (
                                      <div className="flex justify-between text-purple-600">
                                        <span>深夜割増手当:</span>
                                        <span>¥{slip.midnight_allowance.toLocaleString()}</span>
                                      </div>
                                    ) : null}
                                    <div className="flex justify-between">
                                      <span>通勤手当（非課税）:</span>
                                      <span>¥{(slip.commuting_allowance || 0).toLocaleString()}</span>
                                    </div>
                                    {((slip.position_allowance || 0) + (slip.qualification_allowance || 0) + (slip.housing_allowance || 0) + (slip.family_allowance || 0)) > 0 ? (
                                      <div className="flex justify-between text-blue-600">
                                        <span>役職・資格・諸手当:</span>
                                        <span>¥{((slip.position_allowance || 0) + (slip.qualification_allowance || 0) + (slip.housing_allowance || 0) + (slip.family_allowance || 0)).toLocaleString()}</span>
                                      </div>
                                    ) : null}
                                    <div className="border-t border-emerald-200 pt-1.5 mt-1 flex justify-between font-black text-emerald-700 text-xs">
                                      <span>総支給額（額面）:</span>
                                      <span>¥{(slip.total_earnings || 0).toLocaleString()}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* 3. 控除明細 */}
                                <div className="bg-rose-50/40 p-3.5 rounded-xl border border-rose-200 space-y-2">
                                  <div className="font-bold text-rose-800 flex items-center gap-1.5 text-[11px]">
                                    <TrendingUp className="w-3.5 h-3.5 text-rose-600" />
                                    ③ 控除額の計算内訳
                                  </div>
                                  <div className="space-y-1 text-slate-600 pt-1 text-[11px]">
                                    {(() => {
                                      const prefCode = payrollSettings.prefecture_code || tenantInfo?.prefecture_code || '25';
                                      const prefData = getPrefectureRate(prefCode);
                                      return (
                                        <div className="flex justify-between">
                                          <span>健康保険料 ({prefData.name} {(prefData.healthRate * 50).toFixed(3)}%):</span>
                                          <span className="font-bold text-slate-800">¥{(slip.health_insurance || 0).toLocaleString()}</span>
                                        </div>
                                      );
                                    })()}
                                    {slip.nursing_insurance && slip.nursing_insurance > 0 ? (
                                      <div className="flex justify-between text-purple-600">
                                        <span>介護保険料（40〜64歳 0.8%）:</span>
                                        <span>¥{slip.nursing_insurance.toLocaleString()}</span>
                                      </div>
                                    ) : null}
                                    <div className="flex justify-between">
                                      <span>厚生年金保険料:</span>
                                      <span>¥{(slip.pension_insurance || 0).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>雇用保険料（0.6%）:</span>
                                      <span>¥{(slip.employment_insurance || 0).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-indigo-700 font-bold">
                                      <span>所得税（源泉徴収税額）:</span>
                                      <span>¥{(slip.income_tax || 0).toLocaleString()}</span>
                                    </div>
                                    {slip.resident_tax && slip.resident_tax > 0 ? (
                                      <div className="flex justify-between">
                                        <span>住民税（特別徴収）:</span>
                                        <span>¥{slip.resident_tax.toLocaleString()}</span>
                                      </div>
                                    ) : null}
                                    <div className="border-t border-rose-200 pt-1.5 mt-1 flex justify-between font-black text-rose-700 text-xs">
                                      <span>控除合計額:</span>
                                      <span>-¥{(slip.total_deductions || 0).toLocaleString()}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* 差引手取り振込額バナー */}
                              <div className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl p-3.5 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                                    <CreditCard className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <div className="text-[10px] text-indigo-100 font-medium">差引支給額（従業員口座への実振込手取り額）</div>
                                    <div className="text-xs font-bold">総支給 ¥{(slip.total_earnings || 0).toLocaleString()} − 総控除 ¥{(slip.total_deductions || 0).toLocaleString()}</div>
                                  </div>
                                </div>
                                <div className="text-xl font-black tracking-tight text-amber-300">
                                  ¥{(slip.net_salary || 0).toLocaleString()}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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

              {/* 🎂 生年月日・年齢・介護保険判定 */}
              <div className="bg-indigo-50/60 p-4 rounded-2xl border border-indigo-200 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <label className="text-xs font-black text-indigo-900 flex items-center gap-1.5">
                      🎂 生年月日（西暦）
                    </label>
                    <span className="text-[10px] text-indigo-600 font-bold">※ 入退社労務書類管理システム（大元マスタ）と完全連動</span>
                  </div>
                  {profileModal.profile.birth_date ? (() => {
                    const bDate = new Date(profileModal.profile.birth_date);
                    const now = new Date();
                    let age = now.getFullYear() - bDate.getFullYear();
                    const mDiff = now.getMonth() - bDate.getMonth();
                    if (mDiff < 0 || (mDiff === 0 && now.getDate() < bDate.getDate())) age--;
                    const isNursing = isNursingInsuranceApplicable(profileModal.profile.birth_date, new Date());
                    return (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-700 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200">
                          {age} 歳
                        </span>
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-lg border ${
                          isNursing ? 'bg-purple-100 text-purple-700 border-purple-300' : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          {isNursing ? '🛡️ 介護保険 第2号被保険者（40〜64歳：自動徴収）' : '介護保険 対象外'}
                        </span>
                      </div>
                    );
                  })() : (
                    <span className="text-[11px] text-slate-400">※生年月日を入力すると介護保険該当（40〜64歳）を自動判定します</span>
                  )}
                </div>
                <input
                  type="date"
                  value={profileModal.profile.birth_date ? String(profileModal.profile.birth_date).substring(0, 10) : ''}
                  onChange={e => {
                    const bVal = e.target.value;
                    const isNursing = isNursingInsuranceApplicable(bVal, new Date());
                    setProfileModal({
                      ...profileModal,
                      profile: { 
                        ...profileModal.profile, 
                        birth_date: bVal,
                        nursing_insurance_enabled: isNursing
                      }
                    });
                  }}
                  className="w-full bg-white border border-indigo-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                />
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
                      checked={!!profileModal.profile.nursing_insurance_enabled}
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
              {/* 事業所所在地（都道府県） */}
              <div className="bg-indigo-50/60 p-3.5 rounded-2xl border border-indigo-200 space-y-1.5">
                <label className="text-xs font-black text-indigo-900 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-indigo-600" />
                  事業所の所在地（都道府県・協会けんぽ管轄）
                </label>
                <p className="text-[10px] text-slate-500">
                  選択した都道府県の協会けんぽ公式料率が、全従業員の健康保険料計算に自動適用されます。
                </p>
                <select
                  value={payrollSettings.prefecture_code || tenantInfo?.prefecture_code || '13'}
                  onChange={e => {
                    const code = e.target.value;
                    const pref = getPrefectureRate(code);
                    setPayrollSettings({
                      ...payrollSettings,
                      prefecture_code: code,
                      health_insurance_rate: Number((pref.healthRate / 2).toFixed(5))
                    });
                  }}
                  className="w-full bg-white border border-indigo-300 rounded-xl px-3 py-2 font-bold text-slate-800 text-xs mt-1"
                >
                  {PREFECTURES.map(p => (
                    <option key={p.code} value={p.code}>
                      {p.name} （健康保険 全額 {(p.healthRate * 100).toFixed(2)}% / 折半 {(p.healthRate * 50).toFixed(3)}%）
                    </option>
                  ))}
                </select>
              </div>

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
              <OfficialPayslipDoc 
                payslip={previewModal.payslip} 
                tenantName={tenantInfo?.name} 
                companySealUrl={(tenantInfo as any)?.company_seal_url || localStorage.getItem(`company_seal_image_${tenantInfo?.id}`) || localStorage.getItem('company_seal_image') || undefined}
              />
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
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
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
                    <label className="text-[10px] text-slate-500 block mb-0.5">有休取得 (日)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={editModal.data.paid_leave_days}
                      onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, paid_leave_days: parseFloat(e.target.value) || 0 } })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-blue-900 block mb-0.5">🏖️ 有休残日数 (日)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={editModal.data.paid_leave_remaining ?? 10.0}
                      onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, paid_leave_remaining: parseFloat(e.target.value) || 0 } })}
                      className="w-full bg-blue-50 border border-blue-300 rounded-lg px-2.5 py-1.5 font-bold text-blue-950"
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
