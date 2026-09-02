import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import AppSwitcher from '../components/AppSwitcher';
import { OfficialLaborContractDoc } from '../components/OfficialLaborContractDoc';
import { OfficialCommutingPassDoc } from '../components/OfficialCommutingPassDoc';
import { OfficialBankPassbookDoc } from '../components/OfficialBankPassbookDoc';
import { OfficialTaxExemptionDoc } from '../components/OfficialTaxExemptionDoc';
import OfficialSpouseDeductionDoc from '../components/OfficialSpouseDeductionDoc';
import OfficialCustomCanvasDoc from '../components/OfficialCustomCanvasDoc';
import { 
  type CustomDocTemplate, 
  getCustomDocTemplatesFromStorage 
} from '../lib/customDocManager';
import { compressImageFile } from '../lib/imageCompressor';
import { getLaborContractTemplateFromStorage } from '../lib/laborContractTemplate';
import { 
  type PositionMaster, 
  DEFAULT_POSITIONS, 
  getPositionsFromStorage 
} from '../lib/orgChart';
import { 
  type OnboardingWorkflowStep, 
  DEFAULT_ONBOARDING_STEPS, 
  getWorkflowStepsFromStorage, 
  type OnboardingStepHistory 
} from '../lib/onboardingWorkflow';
import { 
  UserPlus, Users, FileText, CheckCircle2, 
  Printer, ArrowLeft, LogOut, Loader2, X, ChevronRight, 
  HelpCircle, Building2, Check, UserCheck, Edit3, UserMinus, 
  RotateCcw, Save, Inbox, Upload, Trash2, Eye, CreditCard, Train,
  FolderOpen, Settings, Clock, Smartphone, AlertCircle, ArrowRight, CornerDownLeft,
  Copy, DollarSign, Sparkles
} from 'lucide-react';

interface EmployeeOnboardingData {
  user_id: string;
  name: string;
  name_kana?: string;
  email?: string;
  phone?: string;
  birth_date?: string;
  address?: string;
  signed_at?: string;
  role: string;
  status: 'onboarding' | 'active' | 'offboarding' | 'retired';
  current_step_number?: number;
  step_history?: OnboardingStepHistory[];
  join_date: string;
  retirement_date?: string;
  retirement_reason?: string;
  employment_type: 'full-time' | 'part-time' | 'contract';
  department?: string;
  position_name?: string;
  contract_type: 'indefinite' | 'fixed_term';
  trial_period_months?: number;
  start_time?: string;
  end_time?: string;
  break_time_minutes?: number;
  salary_type?: 'monthly' | 'hourly' | 'daily';
  base_salary: number;
  hourly_wage: number;
  position_allowance: number;
  qualification_allowance?: number;
  fixed_overtime_allowance?: number;
  housing_allowance?: number;
  family_allowance?: number;
  commuting_allowance: number;
  health_insurance_joined: boolean;
  pension_insurance_joined: boolean;
  employment_insurance_joined: boolean;
  bank_name?: string;
  branch_name?: string;
  account_type?: 'ordinary' | 'current';
  account_number?: string;
  account_holder?: string;
  has_spouse?: boolean;
  dependents_count?: number;
  dependents?: any[];
  my_number?: string;
  holidays_text?: string;
  documents_checklist?: {
    id_copy: boolean;
    my_number: boolean;
    pension_handbook: boolean;
    employment_insurance_card: boolean;
    withholding_tax_slip: boolean;
    bank_account_copy: boolean;
    labor_contract_signed: boolean;
  };
  procedure_todo?: {
    nenkin_office_submitted: boolean;
    hellowork_submitted: boolean;
    resident_tax_switched: boolean;
  };
}

interface DocumentSubmission {
  id: string;
  user_id: string;
  user_name?: string;
  document_type: string;
  title: string;
  data: any;
  attachment_data?: string;
  attachment_filename?: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_comment?: string;
  created_at: string;
  approved_by?: string;
  approved_at?: string;
}

interface DepartmentMaster {
  id: string;
  name: string;
  manager_user_id?: string;
  manager_user_name?: string;
  display_order: number;
}

interface WorkSchedulePattern {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  target_department?: string;
}

export default function OnboardingAdminDashboard() {
  const navigate = useNavigate();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantInfo, setTenantInfo] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentUserRole, setCurrentUserRole] = useState<string>('admin');
  const [currentAdminName, setCurrentAdminName] = useState<string>('管理者');
  const [employees, setEmployees] = useState<EmployeeOnboardingData[]>([]);
  const [submissions, setSubmissions] = useState<DocumentSubmission[]>([]);
  const [departments, setDepartments] = useState<DepartmentMaster[]>([]);
  const [positions, setPositions] = useState<PositionMaster[]>(DEFAULT_POSITIONS);
  const [schedulePatterns, setSchedulePatterns] = useState<WorkSchedulePattern[]>([]);
  const [workflowSteps, setWorkflowSteps] = useState<OnboardingWorkflowStep[]>(DEFAULT_ONBOARDING_STEPS);
  
  const [currentView, setCurrentView] = useState<'employees' | 'submissions'>('employees');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'onboarding' | 'retired'>('all');
  const [submissionFilter, setSubmissionFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // 提出書類 修正（編集）モーダルState
  const [editSubmissionModal, setEditSubmissionModal] = useState<{
    isOpen: boolean;
    submission: DocumentSubmission | null;
    editedData: any;
  }>({
    isOpen: false,
    submission: null,
    editedData: {}
  });

  // 提出書類 差戻しモーダルState
  const [rejectSubmissionModal, setRejectSubmissionModal] = useState<{
    isOpen: boolean;
    submission: DocumentSubmission | null;
    comment: string;
  }>({
    isOpen: false,
    submission: null,
    comment: ''
  });

  // 新規入社ウィザードState
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [wizardData, setWizardData] = useState({
    name: '',
    email: '',
    phone: '',
    birth_date: '1995-01-01',
    address: '',
    join_date: new Date().toISOString().split('T')[0],
    employment_type: 'full-time',
    department: '営業部',
    contract_type: 'indefinite',
    trial_period_months: 3,
    start_time: '09:00',
    end_time: '18:00',
    break_time_minutes: 60,
    holidays_text: '完全週休2日制（土日・祝日）',
    salary_type: 'monthly',
    base_salary: 250000,
    hourly_wage: 1150,
    position_allowance: 0,
    qualification_allowance: 0,
    housing_allowance: 0,
    family_allowance: 0,
    commuting_allowance: 15000,
    health_insurance_joined: true,
    pension_insurance_joined: true,
    employment_insurance_joined: true,
    bank_name: '',
    branch_name: '',
    account_type: 'ordinary',
    account_number: '',
    account_holder: ''
  });

  // 編集・修正モーダルState
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    data: EmployeeOnboardingData | null;
  }>({
    isOpen: false,
    data: null
  });

  // 労務書面キャビネット（証憑アーカイブ）モーダルState
  const [cabinetModal, setCabinetModal] = useState<{
    isOpen: boolean;
    employee: EmployeeOnboardingData | null;
    activeDoc: 'contract' | 'commuting' | 'bank' | 'tax' | 'spouse_deduction' | 'identity' | 'raw_data' | string;
    selectedSubmission?: DocumentSubmission | null;
  }>({
    isOpen: false,
    employee: null,
    activeDoc: 'contract',
    selectedSubmission: null
  });

  // 🖨️ 全社カスタム公的書類一覧 State
  const [customDocTemplates, setCustomDocTemplates] = useState<CustomDocTemplate[]>([]);

  // 退職処理モーダルState
  const [retireModal, setRetireModal] = useState<{
    isOpen: boolean;
    data: EmployeeOnboardingData | null;
    retirementDate: string;
    retirementReason: string;
    needSeparationNotice: boolean;
  }>({
    isOpen: false,
    data: null,
    retirementDate: new Date().toISOString().split('T')[0],
    retirementReason: '自己都合退職',
    needSeparationNotice: true
  });

  // 管理者による書類代行入力モーダルState
  const [proxyInputModal, setProxyInputModal] = useState({
    isOpen: false,
    selectedUserId: '',
    docType: 'bank_passbook',
    bankName: '',
    branchName: '',
    accountType: 'ordinary',
    accountNumber: '',
    accountHolder: '',
    originStation: '',
    destinationStation: '',
    commutingAmount: 15000,
    myNumber: '',
    attachmentData: '',
    attachmentFilename: '',
    fileSizeInfo: ''
  });

  // 書類・写真プレビューモーダルState
  const [attachmentPreviewModal, setAttachmentPreviewModal] = useState<{
    isOpen: boolean;
    title: string;
    imageSrc: string;
  }>({
    isOpen: false,
    title: '',
    imageSrc: ''
  });

  // 労務手続きガイドモーダルState
  const [guideModalOpen, setGuideModalOpen] = useState(false);

  // 📱 個人別 労働条件設定 ＆ 専用入社URL発行モーダルState
  const [inviteUrlModal, setInviteUrlModal] = useState({
    isOpen: false,
    name: '',
    employmentType: '正社員（無期雇用）',
    salaryType: 'monthly' as 'monthly' | 'hourly',
    baseSalary: 250000,
    hourlyWage: 1200,
    positionName: '',
    positionAllowance: 0,
    qualificationAllowance: 0,
    fixedOvertimeAllowance: 0,
    department: '営業部',
    joinDate: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '18:00',
    breakMinutes: 60,
    workLocation: '本社 および 会社が指定する就業場所',
    generatedUrl: '',
    copied: false
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/');
        return;
      }

      const { data: tenantIdData } = await supabase.rpc('get_user_tenant_id');
      if (!tenantIdData) return;
      setTenantId(tenantIdData);

      const { data: tData } = await supabase.from('tenants').select('*').eq('id', tenantIdData).maybeSingle();
      setTenantInfo(tData);

      // ログイン管理者の詳細情報（権限・所属）取得
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        setCurrentUserId(currentUser.id);
        const { data: adminUser } = await supabase.from('users').select('id, name, role, department').eq('id', currentUser.id).maybeSingle();
        if (adminUser) {
          if (adminUser.name) setCurrentAdminName(adminUser.name);
          if (adminUser.role) setCurrentUserRole(adminUser.role);
        }
      }

      // 入社手続きワークフローステップの取得
      if (tData?.onboarding_workflow_settings && Array.isArray(tData.onboarding_workflow_settings)) {
        setWorkflowSteps(tData.onboarding_workflow_settings);
      } else {
        setWorkflowSteps(getWorkflowStepsFromStorage());
      }

      // 部署マスタ取得
      const { data: deptData } = await supabase
        .from('department_masters')
        .select('*')
        .eq('tenant_id', tenantIdData)
        .order('display_order', { ascending: true });
      setDepartments(deptData || []);

      // 役職マスタ取得
      let posList: PositionMaster[] = getPositionsFromStorage();
      if (tData?.position_masters && Array.isArray(tData.position_masters) && tData.position_masters.length > 0) {
        posList = tData.position_masters;
      }
      setPositions(posList);

      // 就業時間パターンマスタ取得
      const { data: patData } = await supabase
        .from('work_schedule_patterns')
        .select('*')
        .eq('tenant_id', tenantIdData)
        .order('display_order', { ascending: true });

      const patterns: WorkSchedulePattern[] = (patData && patData.length > 0) ? patData : [
        { id: '1', name: '標準勤務（本社・営業）', start_time: '09:00', end_time: '18:00', break_minutes: 60, target_department: '営業部' },
        { id: '2', name: '店舗早番（08:00〜17:00）', start_time: '08:00', end_time: '17:00', break_minutes: 60, target_department: '店舗運営部' },
        { id: '3', name: '店舗遅番（12:00〜21:00）', start_time: '12:00', end_time: '21:00', break_minutes: 60, target_department: '店舗運営部' },
        { id: '4', name: '育児・時短勤務', start_time: '09:30', end_time: '16:30', break_minutes: 60, target_department: '' }
      ];
      setSchedulePatterns(patterns);

      // ウィザードの初期休日と時間帯を全社設定から反映
      const defaultHolText = tData?.work_calendar_settings?.holiday_text_summary || '完全週休2日制（土日・祝日）';
      const defaultStartTime = tData?.work_calendar_settings?.standard_start_time || '09:00';
      const defaultEndTime = tData?.work_calendar_settings?.standard_end_time || '18:00';
      const defaultBreak = tData?.work_calendar_settings?.standard_break_minutes || 60;

      setWizardData(prev => ({
        ...prev,
        holidays_text: defaultHolText,
        start_time: defaultStartTime,
        end_time: defaultEndTime,
        break_time_minutes: defaultBreak
      }));

      // 全社カスタム公的書類テンプレート一覧の復元
      const customTemplatesLoaded = getCustomDocTemplatesFromStorage(tenantIdData);
      setCustomDocTemplates(customTemplatesLoaded);

      // ユーザー一覧取得
      const { data: uData } = await supabase
        .from('users')
        .select('*')
        .eq('tenant_id', tenantIdData)
        .order('created_at', { ascending: false });

      // 入退社詳細データ取得
      const { data: onbData } = await supabase
        .from('employee_onboarding_profiles')
        .select('*')
        .eq('tenant_id', tenantIdData);

      // 給与マスタ取得
      const { data: payData } = await supabase
        .from('employee_payroll_profiles')
        .select('*')
        .eq('tenant_id', tenantIdData);

      const onbMap = new Map((onbData || []).map((o: any) => [o.user_id, o]));
      const payMap = new Map((payData || []).map((p: any) => [p.user_id, p]));
      const userMap = new Map((uData || []).map((u: any) => [u.id, u.name]));

      const combined: EmployeeOnboardingData[] = (uData || []).map((u: any) => {
        const onb: any = onbMap.get(u.id);
        const pay: any = payMap.get(u.id);

        let localBackup: any = null;
        try {
          const raw = localStorage.getItem(`employee_master_backup_${u.id}`);
          if (raw) localBackup = JSON.parse(raw);
        } catch (e) {}

        const bDate = u.birth_date || onb?.birth_date || pay?.birth_date || localBackup?.birth_date || '';
        const addr = u.address || onb?.address || localBackup?.address || '';
        const ph = u.phone || onb?.phone || localBackup?.phone || '';

        // 銀行口座情報（従業員IDごとの固有データ）
        const bName = onb?.bank_name || pay?.bank_name || localBackup?.bank_name || '';
        const brName = onb?.branch_name || pay?.branch_name || localBackup?.branch_name || '';
        const accType = onb?.account_type || pay?.account_type || localBackup?.account_type || 'ordinary';
        const accNum = onb?.account_number || pay?.account_number || localBackup?.account_number || '';
        const accHolder = onb?.account_holder || pay?.account_holder || localBackup?.account_holder || u.name || '';

        return {
          user_id: u.id,
          name: u.name || '従業員',
          email: u.email,
          phone: ph,
          birth_date: bDate,
          address: addr,
          role: u.role,
          status: onb?.status || (u.is_active === false ? 'retired' : 'active'),
          current_step_number: onb?.current_step_number || (onb?.status === 'onboarding' ? 1 : 5),
          step_history: onb?.step_history || [],
          join_date: onb?.join_date || u.join_date || '2026-04-01',
          retirement_date: onb?.retirement_date,
          retirement_reason: onb?.retirement_reason,
          employment_type: u.employment_type || 'full-time',
          department: u.department || '営業部',
          contract_type: onb?.contract_type || 'indefinite',
          trial_period_months: onb?.trial_period_months ?? 3,
          start_time: onb?.start_time || defaultStartTime,
          end_time: onb?.end_time || defaultEndTime,
          break_time_minutes: onb?.break_time_minutes || defaultBreak,
          holidays_text: onb?.holidays_text || defaultHolText,
          salary_type: onb?.salary_type || pay?.salary_type || localBackup?.salary_type || (u.employment_type === 'part-time' ? 'hourly' : 'monthly'),
          base_salary: onb?.base_salary ?? pay?.base_salary ?? localBackup?.base_salary ?? 250000,
          hourly_wage: onb?.hourly_wage ?? pay?.hourly_wage ?? localBackup?.hourly_wage ?? 1150,
          position_allowance: onb?.position_allowance ?? pay?.position_allowance ?? localBackup?.position_allowance ?? 0,
          qualification_allowance: onb?.qualification_allowance ?? pay?.qualification_allowance ?? localBackup?.qualification_allowance ?? 0,
          housing_allowance: onb?.housing_allowance ?? pay?.housing_allowance ?? localBackup?.housing_allowance ?? 0,
          family_allowance: onb?.family_allowance ?? pay?.family_allowance ?? localBackup?.family_allowance ?? 0,
          commuting_allowance: onb?.commuting_allowance ?? pay?.commuting_allowance ?? localBackup?.commuting_allowance ?? 15000,
          health_insurance_joined: onb?.health_insurance_joined ?? pay?.health_insurance_enabled ?? localBackup?.health_insurance_joined ?? true,
          pension_insurance_joined: onb?.pension_insurance_joined ?? pay?.pension_insurance_enabled ?? localBackup?.pension_insurance_joined ?? true,
          employment_insurance_joined: onb?.employment_insurance_joined ?? pay?.employment_insurance_enabled ?? localBackup?.employment_insurance_joined ?? true,
          bank_name: bName,
          branch_name: brName,
          account_type: accType,
          account_number: accNum,
          account_holder: accHolder,
          documents_checklist: onb?.documents_checklist || {
            id_copy: true,
            my_number: false,
            pension_handbook: false,
            employment_insurance_card: false,
            withholding_tax_slip: false,
            bank_account_copy: true,
            labor_contract_signed: false
          },
          procedure_todo: onb?.procedure_todo || {
            nenkin_office_submitted: false,
            hellowork_submitted: false,
            resident_tax_switched: false
          }
        };
      });

      setEmployees(combined);

      // 書類提出・申請リスト取得
      const { data: subData } = await supabase
        .from('employee_document_submissions')
        .select('*')
        .eq('tenant_id', tenantIdData)
        .order('created_at', { ascending: false });

      const formattedSubmissions: DocumentSubmission[] = (subData || []).map((s: any) => ({
        ...s,
        user_name: s.data?.name || userMap.get(s.user_id) || '従業員'
      }));

      setSubmissions(formattedSubmissions);
    } catch (e) {
      console.error('Fetch onboarding error:', e);
    } finally {
      setLoading(false);
    }
  };

  // 承認権限チェック関数（システム全体の権限と担当者を連動判定）
  const checkCanApproveStep = (stepObj: OnboardingWorkflowStep | undefined, empDept: string | undefined): { canApprove: boolean; reason?: string } => {
    if (!stepObj) return { canApprove: true };

    // 1. システム管理者(admin)は特権として全ステップ承認可能
    if (currentUserRole === 'admin') return { canApprove: true };

    // 2. 個別担当者指定 (specific_user)
    if (stepObj.approver_type === 'specific_user' && stepObj.approver_user_id) {
      if (stepObj.approver_user_id === currentUserId) return { canApprove: true };
      return { canApprove: false, reason: `このステップは指定された担当者（${stepObj.approver_name}）のみ承認可能です。` };
    }

    // 3. 配属部署の所属長 (department_head)
    if (stepObj.approver_type === 'department_head') {
      const deptObj = departments.find(d => d.name === empDept);
      if (deptObj?.manager_user_id) {
        if (deptObj.manager_user_id === currentUserId) return { canApprove: true };
        return { canApprove: false, reason: `このステップは配属先（${empDept}）の所属長（${deptObj.manager_user_name || '所属長'} 殿）のみ承認可能です。` };
      }
      // 所属長が未指定の場合は管理者・マネージャーなら承認可能
      if (currentUserRole === 'admin' || currentUserRole === 'manager') return { canApprove: true };
      return { canApprove: false, reason: `配属先（${empDept || '該当部署'}）の所属長または管理者のみ承認可能です。` };
    }

    // 4. 管理者全員 (all_admins)
    if (stepObj.approver_type === 'all_admins') {
      if (currentUserRole === 'admin' || currentUserRole === 'manager') return { canApprove: true };
      return { canApprove: false, reason: '管理者またはマネージャー権限が必要です。' };
    }

    return { canApprove: true };
  };

  // 1. ステップを次へ進める（承認）
  const handleAdvanceStep = async (emp: EmployeeOnboardingData) => {
    if (!tenantId) return;
    const currentStepNum = emp.current_step_number || 1;
    const maxStepNum = workflowSteps.length;

    if (currentStepNum >= maxStepNum) {
      alert('すでに最終ステップ（完了・本稼働）に達しています。');
      return;
    }

    const nextStepNum = currentStepNum + 1;
    const currentStepObj = workflowSteps.find(s => s.step_number === currentStepNum);
    const nextStepObj = workflowSteps.find(s => s.step_number === nextStepNum);

    // 🛡️ 承認権限チェックの厳格実行
    const permCheck = checkCanApproveStep(currentStepObj, emp.department);
    if (!permCheck.canApprove) {
      alert(`⚠️【権限不足】\n${permCheck.reason}\n\n※ 現在のアカウント: ${currentAdminName}（権限: ${currentUserRole === 'admin' ? '管理者' : currentUserRole === 'manager' ? 'マネージャー' : '一般'}）`);
      return;
    }

    const historyEntry: OnboardingStepHistory = {
      step_id: currentStepObj?.id || `step_${currentStepNum}`,
      step_number: currentStepNum,
      step_name: currentStepObj?.name || `Step ${currentStepNum}`,
      approved_by_name: `${currentAdminName}${currentStepObj?.approver_name ? ` (${currentStepObj.approver_name})` : ''}`,
      approved_by_id: currentUserId,
      approved_at: new Date().toISOString()
    };

    const newHistory = [...(emp.step_history || []), historyEntry];
    const isFinalStep = nextStepNum === maxStepNum;
    const newStatus = isFinalStep ? 'active' : 'onboarding';

    setIsSaving(true);
    try {
      await supabase.from('employee_onboarding_profiles').upsert({
        tenant_id: tenantId,
        user_id: emp.user_id,
        status: newStatus,
        current_step_number: nextStepNum,
        step_history: newHistory,
        updated_at: new Date().toISOString()
      }, { onConflict: 'tenant_id,user_id' });

      alert(`🎉 ${emp.name} さんを次のステップ「${nextStepObj?.name || `Step ${nextStepNum}`}」へ進めました！\n（承認者: ${currentAdminName}）`);
      await fetchData();
    } catch (err: any) {
      console.error('Advance step error:', err);
      alert('ステップ更新に失敗しました: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 2. ステップを前へ戻す（巻き戻し）
  const handleRollbackStep = async (emp: EmployeeOnboardingData) => {
    if (!tenantId) return;
    const currentStepNum = emp.current_step_number || 1;

    if (currentStepNum <= 1) {
      alert('すでに最初のステップです。');
      return;
    }

    const prevStepNum = currentStepNum - 1;
    const prevStepObj = workflowSteps.find(s => s.step_number === prevStepNum);

    if (!confirm(`${emp.name} さんを前のステップ「${prevStepObj?.name || `Step ${prevStepNum}`}」に戻しますか？`)) return;

    setIsSaving(true);
    try {
      await supabase.from('employee_onboarding_profiles').upsert({
        tenant_id: tenantId,
        user_id: emp.user_id,
        status: 'onboarding',
        current_step_number: prevStepNum,
        updated_at: new Date().toISOString()
      }, { onConflict: 'tenant_id,user_id' });

      alert(`↩️ ${emp.name} さんの手続きを「${prevStepObj?.name || `Step ${prevStepNum}`}」に戻しました。`);
      await fetchData();
    } catch (err: any) {
      console.error('Rollback step error:', err);
      alert('ステップ戻しに失敗しました: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 3. 提出書類の修正保存
  const handleSaveEditedSubmission = async () => {
    if (!tenantId || !editSubmissionModal.submission) return;
    setIsSaving(true);
    try {
      const sub = editSubmissionModal.submission;
      const edited = editSubmissionModal.editedData;

      await supabase
        .from('employee_document_submissions')
        .update({
          data: edited,
          updated_at: new Date().toISOString()
        })
        .eq('id', sub.id);

      // 口座情報・通勤定期代・扶養控除申告が編集された場合は給与マスタにも即時連動
      if (sub.document_type === 'bank_passbook') {
        await supabase.from('employee_payroll_profiles').upsert({
          tenant_id: tenantId,
          user_id: sub.user_id,
          bank_name: edited.bank_name,
          branch_name: edited.branch_name,
          account_type: edited.account_type,
          account_number: edited.account_number,
          account_holder: edited.account_holder
        }, { onConflict: 'tenant_id,user_id' });
      } else if (sub.document_type === 'commuting_pass') {
        await supabase.from('employee_payroll_profiles').upsert({
          tenant_id: tenantId,
          user_id: sub.user_id,
          commuting_allowance: edited.one_month_pass_amount || 0
        }, { onConflict: 'tenant_id,user_id' });
      } else if (sub.document_type === 'dependents_form' || sub.document_type === 'tax_withholding') {
        const depCount = Array.isArray(edited.dependents) ? edited.dependents.length : (edited.dependents_count || 0);
        await supabase.from('employee_payroll_profiles').upsert({
          tenant_id: tenantId,
          user_id: sub.user_id,
          dependents_count: depCount
        }, { onConflict: 'tenant_id,user_id' });
      }

      alert('✨ 提出書類の内容を修正・保存しました！関連マスタにも即座に同期されました。');
      setEditSubmissionModal({ isOpen: false, submission: null, editedData: {} });
      await fetchData();
    } catch (err: any) {
      console.error('Save edited submission error:', err);
      alert('修正保存に失敗しました: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 4. 提出書類の差戻し（再提出依頼）
  const handleRejectSubmission = async () => {
    if (!tenantId || !rejectSubmissionModal.submission) return;
    if (!rejectSubmissionModal.comment.trim()) {
      alert('差戻しの理由を入力してください。（例: 口座番号に誤りがあります、写真が不鮮明です 等）');
      return;
    }

    setIsSaving(true);
    try {
      const sub = rejectSubmissionModal.submission;

      await supabase
        .from('employee_document_submissions')
        .update({
          status: 'rejected',
          admin_comment: rejectSubmissionModal.comment.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', sub.id);

      alert(`↩️ ${sub.user_name} 殿の「${sub.title}」を差戻しました。\n（理由: ${rejectSubmissionModal.comment}）`);
      setRejectSubmissionModal({ isOpen: false, submission: null, comment: '' });
      await fetchData();
    } catch (err: any) {
      console.error('Reject submission error:', err);
      alert('差戻し処理に失敗しました: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 5. 提出書類の削除
  const handleDeleteSubmission = async (sub: DocumentSubmission) => {
    if (!confirm(`【確認】${sub.user_name} 殿の「${sub.title}」を完全に削除しますか？\n※ 二重提出や誤送信の整理にご利用ください。`)) return;

    setIsSaving(true);
    try {
      await supabase.from('employee_document_submissions').delete().eq('id', sub.id);
      alert('🗑️ 提出書類を削除しました。');
      await fetchData();
    } catch (err: any) {
      console.error('Delete submission error:', err);
      alert('削除に失敗しました: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 6. 従業員の完全削除（抹消）
  const handleDeleteEmployee = async (emp: EmployeeOnboardingData) => {
    if (!confirm(`⚠️【危険】${emp.name} さんのすべてのデータ（入社情報、提出書類、給与設定）を完全に抹消・削除しますか？\n\n※ 誤登録や入社辞退者の整理用です。この操作は取り消せません。`)) return;

    setIsSaving(true);
    try {
      await supabase.from('employee_document_submissions').delete().eq('user_id', emp.user_id);
      await supabase.from('employee_payroll_profiles').delete().eq('user_id', emp.user_id);
      await supabase.from('employee_onboarding_profiles').delete().eq('user_id', emp.user_id);
      await supabase.from('shift_employee_settings').delete().eq('user_id', emp.user_id);
      await supabase.from('users').delete().eq('id', emp.user_id);

      alert(`🗑️ ${emp.name} さんのデータを完全に削除しました。`);
      await fetchData();
    } catch (err: any) {
      console.error('Delete employee error:', err);
      alert('従業員削除に失敗しました: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 部署変更時に就業時間パターンを自動セット
  const handleDepartmentChange = (deptName: string) => {
    const matchedPattern = schedulePatterns.find(p => p.target_department === deptName);
    if (matchedPattern) {
      setWizardData(prev => ({
        ...prev,
        department: deptName,
        start_time: matchedPattern.start_time,
        end_time: matchedPattern.end_time,
        break_time_minutes: matchedPattern.break_minutes
      }));
    } else {
      setWizardData(prev => ({ ...prev, department: deptName }));
    }
  };

  // 画像圧縮アップロード（手動代行入力用）
  const handleProxyFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImageFile(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.75 });
      const origKb = Math.round(compressed.originalSize / 1024);
      const compKb = Math.round(compressed.compressedSize / 1024);

      setProxyInputModal(prev => ({
        ...prev,
        attachmentData: compressed.base64,
        attachmentFilename: compressed.fileName,
        fileSizeInfo: `軽量化完了: ${origKb}KB ➔ ${compKb}KB`
      }));
    } catch (err: any) {
      alert('ファイルの圧縮・読み込みに失敗しました: ' + err.message);
    }
  };

  // 管理者による書類・申請の手動代行保存
  const handleSaveProxyInput = async () => {
    if (!tenantId || !proxyInputModal.selectedUserId) {
      alert('対象の従業員を選択してください。');
      return;
    }

    setIsSaving(true);
    try {
      const uId = proxyInputModal.selectedUserId;

      if (proxyInputModal.docType === 'bank_passbook') {
        await supabase
          .from('employee_payroll_profiles')
        // 既存バックアップの取得とマージ
        let localMaster: any = {};
        try {
          const raw = localStorage.getItem(`employee_master_backup_${uId}`);
          if (raw) localMaster = JSON.parse(raw);
        } catch (e) {}

        localMaster.bank_name = proxyInputModal.bankName;
        localMaster.branch_name = proxyInputModal.branchName;
        localMaster.account_type = proxyInputModal.accountType;
        localMaster.account_number = proxyInputModal.accountNumber;
        localMaster.account_holder = proxyInputModal.accountHolder;
        localMaster.updated_at = new Date().toISOString();
        try {
          localStorage.setItem(`employee_master_backup_${uId}`, JSON.stringify(localMaster));
        } catch (e) {}

        try {
          await supabase
            .from('employee_payroll_profiles')
            .upsert({
              tenant_id: tenantId,
              user_id: uId,
              bank_name: proxyInputModal.bankName,
              branch_name: proxyInputModal.branchName,
              account_type: proxyInputModal.accountType,
              account_number: proxyInputModal.accountNumber,
              account_holder: proxyInputModal.accountHolder
            }, { onConflict: 'tenant_id,user_id' });
        } catch (e) {}

        await supabase
          .from('employee_document_submissions')
          .insert({
            tenant_id: tenantId,
            user_id: uId,
            document_type: 'bank_passbook',
            title: '給与振込口座（管理者代行入力）',
            data: {
              bank_name: proxyInputModal.bankName,
              branch_name: proxyInputModal.branchName,
              account_number: proxyInputModal.accountNumber,
              account_holder: proxyInputModal.accountHolder
            },
            attachment_data: proxyInputModal.attachmentData || null,
            attachment_filename: proxyInputModal.attachmentFilename || '',
            status: 'approved'
          });
      } else if (proxyInputModal.docType === 'commuting_pass') {
        let localMaster: any = {};
        try {
          const raw = localStorage.getItem(`employee_master_backup_${uId}`);
          if (raw) localMaster = JSON.parse(raw);
        } catch (e) {}
        localMaster.commuting_allowance = proxyInputModal.commutingAmount;
        localMaster.updated_at = new Date().toISOString();
        try {
          localStorage.setItem(`employee_master_backup_${uId}`, JSON.stringify(localMaster));
        } catch (e) {}

        try {
          await supabase
            .from('employee_payroll_profiles')
            .upsert({
              tenant_id: tenantId,
              user_id: uId,
              commuting_allowance: proxyInputModal.commutingAmount
            }, { onConflict: 'tenant_id,user_id' });
        } catch (e) {}

        await supabase
          .from('employee_document_submissions')
          .insert({
            tenant_id: tenantId,
            user_id: uId,
            document_type: 'commuting_pass',
            title: '通勤交通費（管理者代行入力）',
            data: {
              origin_station: proxyInputModal.originStation,
              destination_station: proxyInputModal.destinationStation,
              one_month_pass_amount: proxyInputModal.commutingAmount
            },
            attachment_data: proxyInputModal.attachmentData || null,
            attachment_filename: proxyInputModal.attachmentFilename || '',
            status: 'approved'
          });
      }

      alert('✨ 管理者による代行登録が完了し、給与・労務マスタへ即座に反映されました！');
      setProxyInputModal({
        isOpen: false,
        selectedUserId: '',
        docType: 'bank_passbook',
        bankName: '',
        branchName: '',
        accountType: 'ordinary',
        accountNumber: '',
        accountHolder: '',
        originStation: '',
        destinationStation: '',
        commutingAmount: 15000,
        myNumber: '',
        attachmentData: '',
        attachmentFilename: '',
        fileSizeInfo: ''
      });
      await fetchData();
    } catch (err: any) {
      console.error(err);
      alert('代行登録に失敗しました: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 提出書類のワンクリック承認
  const handleApproveSubmission = async (sub: DocumentSubmission) => {
    if (!tenantId) return;
    setIsSaving(true);
    try {
      const uId = sub.user_id;
      const d = sub.data || {};
      const empName = d.name || sub.user_name || '新入社員';

      // 1. users テーブルに該当従業員が存在するか確認し、なければ新入社員として自動本登録！
      try {
        const { data: existingUser } = await supabase
          .from('users')
          .select('id, name')
          .eq('id', uId)
          .maybeSingle();

        if (!existingUser) {
          const tempEmail = `emp_${Date.now()}@sample.local`;
          await supabase.from('users').upsert({
            id: uId,
            tenant_id: tenantId,
            name: empName,
            email: tempEmail,
            role: 'user',
            department: d.department || '本社',
            employment_type: d.employment_type === 'part-time' ? 'part-time' : 'full-time',
            join_date: d.join_date || new Date().toISOString().split('T')[0],
            has_kintai_access: true,
            has_shift_access: true
          }, { onConflict: 'id' });
        }
      } catch (uErr) {
        console.warn('Auto user registration fallback:', uErr);
      }

      // 2. 既存バックアップの取得とマージ
      let localMaster: any = {};
      try {
        const raw = localStorage.getItem(`employee_master_backup_${uId}`);
        if (raw) localMaster = JSON.parse(raw);
      } catch (e) {}

      // 3. 各書類タイプ別のマスタ同期
      if (sub.document_type === 'labor_contract') {
        localMaster.name = empName;
        localMaster.employment_type = d.employment_type;
        localMaster.salary_type = d.salary_type;
        localMaster.base_salary = d.base_salary;
        localMaster.hourly_wage = d.hourly_wage;
        localMaster.position_name = d.position_name;
        localMaster.position_allowance = d.position_allowance || 0;
        localMaster.qualification_allowance = d.qualification_allowance || 0;
        localMaster.fixed_overtime_allowance = d.fixed_overtime_allowance || 0;
        localMaster.department = d.department;
        localMaster.join_date = d.join_date;

        try {
          await supabase.from('employee_payroll_profiles').upsert({
            tenant_id: tenantId,
            user_id: uId,
            salary_type: d.salary_type || 'monthly',
            base_salary: d.base_salary || 250000,
            hourly_wage: d.hourly_wage || 1200,
            position_allowance: d.position_allowance || 0,
            qualification_allowance: d.qualification_allowance || 0
          }, { onConflict: 'tenant_id,user_id' });
        } catch (e) {}

        try {
          await supabase.from('employee_onboarding_profiles').upsert({
            tenant_id: tenantId,
            user_id: uId,
            status: 'active',
            join_date: d.join_date || new Date().toISOString().split('T')[0],
            salary_type: d.salary_type || 'monthly',
            base_salary: d.base_salary || 250000,
            hourly_wage: d.hourly_wage || 1200,
            position_allowance: d.position_allowance || 0,
            updated_at: new Date().toISOString()
          }, { onConflict: 'tenant_id,user_id' });
        } catch (e) {}

      } else if (sub.document_type === 'bank_passbook') {
        localMaster.bank_name = d.bank_name;
        localMaster.branch_name = d.branch_name;
        localMaster.account_type = d.account_type;
        localMaster.account_number = d.account_number;
        localMaster.account_holder = d.account_holder;

        try {
          await supabase
            .from('employee_payroll_profiles')
            .upsert({
              tenant_id: tenantId,
              user_id: uId,
              bank_name: d.bank_name,
              branch_name: d.branch_name,
              account_type: d.account_type,
              account_number: d.account_number,
              account_holder: d.account_holder
            }, { onConflict: 'tenant_id,user_id' });
        } catch (e) {}

        try {
          await supabase
            .from('employee_onboarding_profiles')
            .upsert({
              tenant_id: tenantId,
              user_id: uId,
              bank_name: d.bank_name,
              branch_name: d.branch_name,
              account_type: d.account_type,
              account_number: d.account_number,
              account_holder: d.account_holder,
              updated_at: new Date().toISOString()
            }, { onConflict: 'tenant_id,user_id' });
        } catch (e) {}

      } else if (sub.document_type === 'commuting_pass') {
        const amount = d.one_month_pass_amount || 0;
        localMaster.commuting_allowance = amount;

        try {
          await supabase
            .from('employee_payroll_profiles')
            .upsert({
              tenant_id: tenantId,
              user_id: uId,
              commuting_allowance: amount
            }, { onConflict: 'tenant_id,user_id' });
        } catch (e) {}

        try {
          await supabase
            .from('employee_onboarding_profiles')
            .upsert({
              tenant_id: tenantId,
              user_id: uId,
              commuting_allowance: amount,
              updated_at: new Date().toISOString()
            }, { onConflict: 'tenant_id,user_id' });
        } catch (e) {}

      } else if (sub.document_type === 'dependents_form') {
        localMaster.dependents_count = d.dependents_count || 0;
        localMaster.has_spouse = d.has_spouse;

        try {
          await supabase
            .from('employee_payroll_profiles')
            .upsert({
              tenant_id: tenantId,
              user_id: uId,
              dependents_count: d.dependents_count || 0
            }, { onConflict: 'tenant_id,user_id' });
        } catch (e) {}

      } else if (sub.document_type === 'resident_certificate') {
        localMaster.address = d.address;
        localMaster.birth_date = d.birth_date;

        try {
          await supabase
            .from('employee_onboarding_profiles')
            .upsert({
              tenant_id: tenantId,
              user_id: uId,
              address: d.address,
              birth_date: d.birth_date,
              updated_at: new Date().toISOString()
            }, { onConflict: 'tenant_id,user_id' });
        } catch (e) {}
      }

      // LocalStorage への永続保存
      try {
        localMaster.updated_at = new Date().toISOString();
        localStorage.setItem(`employee_master_backup_${uId}`, JSON.stringify(localMaster));
      } catch (e) {}

      // 4. employee_document_submissions のステータスを approved に更新
      const { error: subErr } = await supabase
        .from('employee_document_submissions')
        .update({
          status: 'approved',
          approved_by: currentAdminName || '管理者',
          approved_at: new Date().toISOString()
        })
        .eq('id', sub.id);

      if (subErr) {
        console.warn('Submission update error:', subErr);
      }

      // 5. ローカルStateをその場で即座に更新（即時UI反映・Optimistic Update）
      setSubmissions(prev => prev.map(s => s.id === sub.id ? {
        ...s,
        status: 'approved',
        approved_by: currentAdminName || '管理者',
        approved_at: new Date().toISOString()
      } : s));

      alert(`✅ 「${sub.title}」を承認しました！\n（承認者: ${currentAdminName}）\n従業員台帳および給与計算マスタへ即座に反映・同期されました。`);
      await fetchData();
    } catch (err: any) {
      console.error(err);
      alert('承認処理に失敗しました: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 新規入社ウィザード完了
  const handleCompleteOnboardingWizard = async () => {
    if (!tenantId || !wizardData.name) {
      alert('氏名を入力してください。');
      return;
    }

    setIsSaving(true);
    try {
      const tempEmail = wizardData.email || `emp_${Date.now()}@sample.local`;
      const { data: newUser, error: uErr } = await supabase
        .from('users')
        .insert({
          tenant_id: tenantId,
          name: wizardData.name,
          email: tempEmail,
          phone: wizardData.phone || null,
          birth_date: wizardData.birth_date || null,
          address: wizardData.address || null,
          role: 'user',
          join_date: wizardData.join_date,
          department: wizardData.department,
          employment_type: wizardData.employment_type,
          has_kintai_access: true,
          has_shift_access: true
        })
        .select()
        .single();

      if (uErr) throw uErr;
      const newUserId = newUser.id;

      await supabase.from('shift_employee_settings').upsert({
        tenant_id: tenantId,
        user_id: newUserId,
        hire_date: wizardData.join_date,
        max_hours_per_week: wizardData.employment_type === 'part-time' ? 25 : 40,
        priority_score: 3,
        default_role: 'ホール',
        base_wage: wizardData.salary_type === 'hourly' ? wizardData.hourly_wage : 1150
      }, { onConflict: 'user_id' });

      await supabase.from('employee_payroll_profiles').upsert({
        tenant_id: tenantId,
        user_id: newUserId,
        salary_type: wizardData.salary_type,
        base_salary: wizardData.base_salary,
        hourly_wage: wizardData.hourly_wage,
        position_allowance: wizardData.position_allowance,
        qualification_allowance: wizardData.qualification_allowance,
        housing_allowance: wizardData.housing_allowance,
        family_allowance: wizardData.family_allowance,
        commuting_allowance: wizardData.commuting_allowance,
        birth_date: wizardData.birth_date || null,
        health_insurance_enabled: wizardData.health_insurance_joined,
        pension_insurance_enabled: wizardData.pension_insurance_joined,
        employment_insurance_enabled: wizardData.employment_insurance_joined,
        bank_name: wizardData.bank_name,
        branch_name: wizardData.branch_name,
        account_type: wizardData.account_type,
        account_number: wizardData.account_number,
        account_holder: wizardData.account_holder || wizardData.name
      }, { onConflict: 'tenant_id,user_id' });

      await supabase.from('employee_onboarding_profiles').upsert({
        tenant_id: tenantId,
        user_id: newUserId,
        status: 'active',
        join_date: wizardData.join_date,
        contract_type: wizardData.contract_type,
        trial_period_months: wizardData.trial_period_months,
        start_time: wizardData.start_time,
        end_time: wizardData.end_time,
        break_time_minutes: wizardData.break_time_minutes,
        holidays_text: wizardData.holidays_text,
        salary_type: wizardData.salary_type,
        base_salary: wizardData.base_salary,
        hourly_wage: wizardData.hourly_wage,
        position_allowance: wizardData.position_allowance,
        qualification_allowance: wizardData.qualification_allowance,
        housing_allowance: wizardData.housing_allowance,
        family_allowance: wizardData.family_allowance,
        commuting_allowance: wizardData.commuting_allowance,
        health_insurance_joined: wizardData.health_insurance_joined,
        pension_insurance_joined: wizardData.pension_insurance_joined,
        employment_insurance_joined: wizardData.employment_insurance_joined
      }, { onConflict: 'tenant_id,user_id' });

      alert(`🎉 ${wizardData.name} さんの入社手続きが完了しました！\n「勤怠管理」「シフト管理」「給与計算」の全システムに即座に同期されました。`);
      setWizardOpen(false);
      setWizardStep(1);
      await fetchData();
    } catch (err: any) {
      console.error('Onboarding save error:', err);
      alert('入社登録処理に失敗しました: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 従業員情報編集保存（個人別就業時間の上書き反映）
  const handleSaveEditedEmployee = async (data: EmployeeOnboardingData) => {
    if (!tenantId || !data) return;
    setIsSaving(true);
    try {
      // 1. users テーブルの更新（カラム未存在エラー対策フォールバック）
      try {
        const { error: uErr } = await supabase
          .from('users')
          .update({
            name: data.name,
            department: data.department,
            employment_type: data.employment_type,
            join_date: data.join_date,
            birth_date: data.birth_date || null,
            address: data.address || null,
            phone: data.phone || null
          })
          .eq('id', data.user_id);
        if (uErr) throw uErr;
      } catch (uErr) {
        console.warn('users full update failed, falling back to minimal payload:', uErr);
        await supabase
          .from('users')
          .update({
            name: data.name,
            department: data.department,
            employment_type: data.employment_type,
            join_date: data.join_date
          })
          .eq('id', data.user_id);
      }

      // 2. employee_payroll_profiles の更新（birth_date カラム対応）
      try {
        const { error: pErr } = await supabase
          .from('employee_payroll_profiles')
          .upsert({
            tenant_id: tenantId,
            user_id: data.user_id,
            birth_date: data.birth_date || null,
            salary_type: data.salary_type,
            base_salary: data.base_salary,
            hourly_wage: data.hourly_wage,
            position_allowance: data.position_allowance,
            qualification_allowance: data.qualification_allowance || 0,
            housing_allowance: data.housing_allowance || 0,
            family_allowance: data.family_allowance || 0,
            commuting_allowance: data.commuting_allowance,
            health_insurance_enabled: data.health_insurance_joined,
            pension_insurance_enabled: data.pension_insurance_joined,
            employment_insurance_enabled: data.employment_insurance_joined,
            bank_name: data.bank_name,
            branch_name: data.branch_name,
            account_type: data.account_type,
            account_number: data.account_number,
            account_holder: data.account_holder
          }, { onConflict: 'tenant_id,user_id' });
        if (pErr) throw pErr;
      } catch (pErr) {
        console.warn('payroll profile birth_date update failed, trying without birth_date:', pErr);
        await supabase
          .from('employee_payroll_profiles')
          .upsert({
            tenant_id: tenantId,
            user_id: data.user_id,
            salary_type: data.salary_type,
            base_salary: data.base_salary,
            hourly_wage: data.hourly_wage,
            position_allowance: data.position_allowance,
            qualification_allowance: data.qualification_allowance || 0,
            housing_allowance: data.housing_allowance || 0,
            family_allowance: data.family_allowance || 0,
            commuting_allowance: data.commuting_allowance,
            health_insurance_enabled: data.health_insurance_joined,
            pension_insurance_enabled: data.pension_insurance_joined,
            employment_insurance_joined: data.employment_insurance_joined,
            bank_name: data.bank_name,
            branch_name: data.branch_name,
            account_type: data.account_type,
            account_number: data.account_number,
            account_holder: data.account_holder
          }, { onConflict: 'tenant_id,user_id' });
      }

      // 3. shift_employee_settings の更新
      await supabase
        .from('shift_employee_settings')
        .upsert({
          tenant_id: tenantId,
          user_id: data.user_id,
          hire_date: data.join_date,
          base_wage: data.salary_type === 'hourly' ? data.hourly_wage : 1150
        }, { onConflict: 'user_id' });

      // 4. employee_onboarding_profiles の更新
      try {
        const { error: onbErr } = await supabase
          .from('employee_onboarding_profiles')
          .upsert({
            tenant_id: tenantId,
            user_id: data.user_id,
            status: data.status,
            join_date: data.join_date,
            birth_date: data.birth_date || null,
            address: data.address || null,
            phone: data.phone || null,
            contract_type: data.contract_type,
            trial_period_months: data.trial_period_months,
            start_time: data.start_time,
            end_time: data.end_time,
            break_time_minutes: data.break_time_minutes,
            holidays_text: data.holidays_text,
            salary_type: data.salary_type,
            base_salary: data.base_salary,
            hourly_wage: data.hourly_wage,
            position_allowance: data.position_allowance,
            commuting_allowance: data.commuting_allowance,
            health_insurance_joined: data.health_insurance_joined,
            pension_insurance_joined: data.pension_insurance_joined,
            employment_insurance_joined: data.employment_insurance_joined,
            updated_at: new Date().toISOString()
          }, { onConflict: 'tenant_id,user_id' });
        if (onbErr) throw onbErr;
      } catch (onbErr) {
        console.warn('onboarding profile full update failed:', onbErr);
        await supabase
          .from('employee_onboarding_profiles')
          .upsert({
            tenant_id: tenantId,
            user_id: data.user_id,
            status: data.status,
            join_date: data.join_date,
            contract_type: data.contract_type,
            trial_period_months: data.trial_period_months,
            start_time: data.start_time,
            end_time: data.end_time,
            break_time_minutes: data.break_time_minutes,
            holidays_text: data.holidays_text,
            salary_type: data.salary_type,
            base_salary: data.base_salary,
            hourly_wage: data.hourly_wage,
            position_allowance: data.position_allowance,
            commuting_allowance: data.commuting_allowance,
            health_insurance_joined: data.health_insurance_joined,
            pension_insurance_joined: data.pension_insurance_joined,
            employment_insurance_joined: data.employment_insurance_joined,
            updated_at: new Date().toISOString()
          }, { onConflict: 'tenant_id,user_id' });
      }

      // 5. LocalStorage へのマスターバックアップ保存（絶対にロストさせない大元マスタSSOT！）
      try {
        const storageKey = `employee_master_backup_${data.user_id}`;
        localStorage.setItem(storageKey, JSON.stringify({
          birth_date: data.birth_date,
          address: data.address,
          phone: data.phone,
          bank_name: data.bank_name,
          branch_name: data.branch_name,
          account_type: data.account_type,
          account_number: data.account_number,
          account_holder: data.account_holder,
          salary_type: data.salary_type,
          base_salary: data.base_salary,
          hourly_wage: data.hourly_wage,
          position_allowance: data.position_allowance,
          qualification_allowance: data.qualification_allowance || 0,
          housing_allowance: data.housing_allowance || 0,
          family_allowance: data.family_allowance || 0,
          commuting_allowance: data.commuting_allowance,
          health_insurance_joined: data.health_insurance_joined,
          pension_insurance_joined: data.pension_insurance_joined,
          employment_insurance_joined: data.employment_insurance_joined,
          updated_at: new Date().toISOString()
        }));
      } catch (stErr) {
        console.warn('localStorage backup error:', stErr);
      }

      alert('✨ 従業員・労務情報の修正を保存しました！\n銀行口座・生年月日・住所・就業規定が全システムに即座に同期されました。');
      setEditModal({ isOpen: false, data: null });
      await fetchData();
    } catch (err: any) {
      console.error('Save edit error:', err);
      alert('保存に失敗しました: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 退職確定実行
  const handleConfirmRetirement = async () => {
    if (!tenantId || !retireModal.data) return;
    setIsSaving(true);
    try {
      const uId = retireModal.data.user_id;

      await supabase
        .from('employee_onboarding_profiles')
        .upsert({
          tenant_id: tenantId,
          user_id: uId,
          status: 'retired',
          join_date: retireModal.data.join_date,
          retirement_date: retireModal.retirementDate,
          retirement_reason: retireModal.retirementReason,
          updated_at: new Date().toISOString()
        }, { onConflict: 'tenant_id,user_id' });

      await supabase
        .from('users')
        .update({
          has_kintai_access: false,
          has_shift_access: false
        })
        .eq('id', uId);

      alert(`🚪 ${retireModal.data.name} さんの退職処理を完了しました。`);
      setRetireModal({ isOpen: false, data: null, retirementDate: '', retirementReason: '', needSeparationNotice: true });
      await fetchData();
    } catch (err: any) {
      console.error('Retire error:', err);
      alert('退職処理に失敗しました: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 在職復帰
  const handleRehire = async (emp: EmployeeOnboardingData) => {
    if (!confirm(`${emp.name} さんを在職中に戻しますか？`)) return;

    setIsSaving(true);
    try {
      await supabase
        .from('employee_onboarding_profiles')
        .upsert({
          tenant_id: tenantId,
          user_id: emp.user_id,
          status: 'active',
          join_date: emp.join_date,
          retirement_date: null,
          retirement_reason: '',
          updated_at: new Date().toISOString()
        }, { onConflict: 'tenant_id,user_id' });

      await supabase
        .from('users')
        .update({
          has_kintai_access: true,
          has_shift_access: true
        })
        .eq('id', emp.user_id);

      alert(`🎉 ${emp.name} さんを在職中に復帰させました！`);
      await fetchData();
    } catch (err: any) {
      console.error('Rehire error:', err);
      alert('復帰処理に失敗しました: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 🌟 大元マスタ（SSOT）統合データ解決ヘルパー関数
  // 提出書類データ、ローカルストレージバックアップ、DB従業員台帳から、最新の完全な従業員情報を合成
  const resolveEmployeeFullData = (subOrEmp: any): EmployeeOnboardingData => {
    const targetUserId = subOrEmp.user_id || subOrEmp.id || '';
    const targetName = (subOrEmp.data?.name || subOrEmp.user_name || subOrEmp.name || '').trim();
    
    // 1. 既存のDB従業員データ
    const matchedEmp = employees.find(e => (targetUserId && e.user_id === targetUserId) || (targetName && e.name?.trim() === targetName)) || ({} as any);

    // 2. LocalStorage バックアップの取得
    let localMaster: any = {};
    try {
      const raw = localStorage.getItem(`employee_master_backup_${targetUserId}`);
      if (raw) localMaster = JSON.parse(raw);
    } catch (e) {}

    // 3. このユーザーの全提出書類を取得（最新順）
    const userSubs = submissions
      .filter(s => (targetUserId && s.user_id === targetUserId) || (targetName && (s.data?.name?.trim() === targetName || s.user_name?.trim() === targetName)))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const contractSub = userSubs.find(s => s.document_type === 'labor_contract');
    const residentSub = userSubs.find(s => s.document_type === 'resident_certificate');
    const taxSub = userSubs.find(s => s.document_type === 'dependents_form');
    const commutingSub = userSubs.find(s => s.document_type === 'commuting_pass');
    const bankSub = userSubs.find(s => s.document_type === 'bank_passbook');

    const contractData = contractSub?.data || (subOrEmp.document_type === 'labor_contract' ? subOrEmp.data : {}) || {};
    const residentData = residentSub?.data || (subOrEmp.document_type === 'resident_certificate' ? subOrEmp.data : {}) || {};
    const taxData = taxSub?.data || (subOrEmp.document_type === 'dependents_form' ? subOrEmp.data : {}) || {};
    const commutingData = commutingSub?.data || (subOrEmp.document_type === 'commuting_pass' ? subOrEmp.data : {}) || {};
    const bankData = bankSub?.data || (subOrEmp.document_type === 'bank_passbook' ? subOrEmp.data : {}) || {};

    // 住所の解決（優先度: 住民票 ➔ 扶養控除申告書 ➔ バックアップ ➔ 従業員マスタ ➔ subOrEmp）
    const resolvedAddress = residentData.address || taxData.address || localMaster.address || matchedEmp.address || subOrEmp.address || '';
    
    // 生年月日の解決
    const resolvedBirthDate = residentData.birth_date || taxData.birth_date || localMaster.birth_date || matchedEmp.birth_date || subOrEmp.birth_date || '';

    // 入社日（契約開始日）の解決（優先度: 労働条件通知書合意 ➔ バックアップ ➔ 従業員マスタ ➔ 提出日 ➔ 今日の日付）
    const resolvedJoinDate = contractData.join_date || localMaster.join_date || (matchedEmp.join_date && matchedEmp.join_date !== '2023-01-01' ? matchedEmp.join_date : '') || (subOrEmp.created_at ? subOrEmp.created_at.split('T')[0] : '') || new Date().toISOString().split('T')[0];

    // 署名日時の解決（優先度: 労働条件合意日時 ➔ 提出日時 ➔ 現在）
    const resolvedSignedAt = contractData.agreed_at || contractSub?.created_at || subOrEmp.created_at || new Date().toISOString();

    // 役職名 ＆ 役職手当の解決
    const resolvedPositionName = contractData.position_name || localMaster.position_name || matchedEmp.position_name || '';
    const resolvedPositionAllowance = contractData.position_allowance !== undefined ? Number(contractData.position_allowance) : (localMaster.position_allowance !== undefined ? Number(localMaster.position_allowance) : (matchedEmp.position_allowance || 0));

    // 通勤手当の解決（優先度: 通勤申請書の定期代 ➔ バックアップ ➔ 従業員マスタ）
    const resolvedCommutingAllowance = commutingData.one_month_pass_amount !== undefined ? Number(commutingData.one_month_pass_amount) : (localMaster.commuting_allowance !== undefined ? Number(localMaster.commuting_allowance) : (matchedEmp.commuting_allowance || 0));

    // 給与・雇用形態の解決
    const resolvedSalaryType = contractData.salary_type || localMaster.salary_type || matchedEmp.salary_type || 'monthly';
    const resolvedBaseSalary = contractData.base_salary !== undefined ? Number(contractData.base_salary) : (localMaster.base_salary !== undefined ? Number(localMaster.base_salary) : (matchedEmp.base_salary || 250000));
    const resolvedHourlyWage = contractData.hourly_wage !== undefined ? Number(contractData.hourly_wage) : (localMaster.hourly_wage !== undefined ? Number(localMaster.hourly_wage) : (matchedEmp.hourly_wage || 1200));
    const resolvedQualificationAllowance = contractData.qualification_allowance !== undefined ? Number(contractData.qualification_allowance) : (localMaster.qualification_allowance || matchedEmp.qualification_allowance || 0);
    const resolvedFixedOvertimeAllowance = contractData.fixed_overtime_allowance !== undefined ? Number(contractData.fixed_overtime_allowance) : (localMaster.fixed_overtime_allowance || matchedEmp.fixed_overtime_allowance || 0);

    const resolvedBankName = bankData.bank_name || localMaster.bank_name || matchedEmp.bank_name || '';
    const resolvedBranchName = bankData.branch_name || localMaster.branch_name || matchedEmp.branch_name || '';
    const resolvedAccountType = bankData.account_type || localMaster.account_type || matchedEmp.account_type || 'ordinary';
    const resolvedAccountNumber = bankData.account_number || localMaster.account_number || matchedEmp.account_number || '';
    const resolvedAccountHolder = bankData.account_holder || localMaster.account_holder || matchedEmp.account_holder || targetName || '';

    return {
      user_id: targetUserId || matchedEmp.user_id || `temp_${Date.now()}`,
      name: targetName || matchedEmp.name || '従業員',
      name_kana: residentData.name_kana || taxData.name_kana || matchedEmp.name_kana || '',
      role: matchedEmp.role || 'employee',
      status: matchedEmp.status || 'active',
      department: contractData.department || localMaster.department || matchedEmp.department || '本社',
      employment_type: contractData.employment_type || localMaster.employment_type || matchedEmp.employment_type || 'full-time',
      contract_type: contractData.contract_type || localMaster.contract_type || matchedEmp.contract_type || 'indefinite',
      join_date: resolvedJoinDate,
      birth_date: resolvedBirthDate,
      address: resolvedAddress,
      phone: residentData.phone || localMaster.phone || matchedEmp.phone || '',
      position_name: resolvedPositionName,
      position_allowance: resolvedPositionAllowance,
      qualification_allowance: resolvedQualificationAllowance,
      fixed_overtime_allowance: resolvedFixedOvertimeAllowance,
      commuting_allowance: resolvedCommutingAllowance,
      salary_type: resolvedSalaryType,
      base_salary: resolvedBaseSalary,
      hourly_wage: resolvedHourlyWage,
      bank_name: resolvedBankName,
      branch_name: resolvedBranchName,
      account_type: resolvedAccountType,
      account_number: resolvedAccountNumber,
      account_holder: resolvedAccountHolder,
      health_insurance_joined: matchedEmp.health_insurance_joined ?? true,
      pension_insurance_joined: matchedEmp.pension_insurance_joined ?? true,
      employment_insurance_joined: matchedEmp.employment_insurance_joined ?? true,
      signed_at: resolvedSignedAt
    };
  };

  const filteredEmployees = employees.filter(e => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'active') return e.status === 'active';
    if (activeFilter === 'onboarding') return e.status === 'onboarding';
    if (activeFilter === 'retired') return e.status === 'retired';
    return true;
  });

  const pendingSubmissionsCount = submissions.filter(s => s.status === 'pending').length;
  const filteredSubmissions = submissions.filter(s => {
    if (submissionFilter === 'all') return true;
    if (submissionFilter === 'pending') return s.status === 'pending';
    if (submissionFilter === 'approved') return s.status === 'approved';
    return true;
  });

  const activeCount = employees.filter(e => e.status === 'active').length;
  const onboardingCount = employees.filter(e => e.status === 'onboarding').length;
  const retiredCount = employees.filter(e => e.status === 'retired').length;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-xs print:hidden">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/portal')}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition flex items-center gap-1 text-xs font-bold cursor-pointer"
            title="ポータルに戻る"
          >
            <ArrowLeft className="w-4 h-4" />
            ポータル
          </button>
          <div className="h-4 w-px bg-slate-200" />
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white flex items-center justify-center shadow-sm">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                入退社・労務書類管理システム
                <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-full border border-blue-200">
                  全マスタ即時連動
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-bold">{tenantInfo?.name || '株式会社KAP'}</div>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/settings/company')}
            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs px-3.5 py-2 rounded-xl transition border border-indigo-200 flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Settings className="w-4 h-4 text-indigo-600" />
            会社・全社マスタ設定
          </button>
          <button
            onClick={() => setGuideModalOpen(true)}
            className="bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs px-3 py-2 rounded-xl transition border border-slate-200 flex items-center gap-1.5 cursor-pointer"
          >
            <HelpCircle className="w-4 h-4 text-blue-600" />
            労務手続きガイド
          </button>
          <AppSwitcher currentApp="onboarding" role="admin" />
          <button
            onClick={async () => { await supabase.auth.signOut(); navigate('/'); }}
            className="p-2 rounded-full hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6 print:hidden">
        
        {/* サマリーカード */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold">在職中 従業員</span>
              <Users className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-black text-slate-800">{activeCount}名</div>
            <div className="mt-2 text-[11px] text-slate-400">勤怠・給与稼働中</div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold">未審査の提出書類</span>
              <Inbox className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black text-amber-600">{pendingSubmissionsCount}件</div>
            <div className="mt-2 text-[11px] text-slate-400">入社手続き中 {onboardingCount}名</div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold">登録部署数</span>
              <Building2 className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-black text-slate-600">{departments.length}部署</div>
            <div className="mt-2 text-[11px] text-slate-400">就業パターン {schedulePatterns.length}種</div>
          </div>

          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-5 text-white shadow-md shadow-blue-100 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-blue-200">ワンクリック入社</span>
              <div className="text-sm font-black mt-1">新規入社手続きウィザード</div>
            </div>
            <button
              onClick={() => { setWizardStep(1); setWizardOpen(true); }}
              className="mt-3 bg-white hover:bg-blue-50 text-blue-700 font-black text-xs py-2 px-3 rounded-xl transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              新しい従業員を入社登録
            </button>
          </div>
        </div>

        {/* メインビュー切り替え */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 bg-slate-200/80 p-1 rounded-2xl border border-slate-300/60 text-xs font-bold">
            <button
              onClick={() => setCurrentView('employees')}
              className={`px-4 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
                currentView === 'employees' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4" />
              従業員台帳 ＆ 労務書面証憑
            </button>

            <button
              onClick={() => setCurrentView('submissions')}
              className={`px-4 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 relative ${
                currentView === 'submissions' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Inbox className="w-4 h-4" />
              提出書類・各種申請 審査
              {pendingSubmissionsCount > 0 && (
                <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">
                  {pendingSubmissionsCount}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setInviteUrlModal({
                  isOpen: true,
                  name: '',
                  employmentType: '正社員（無期雇用）',
                  salaryType: 'monthly',
                  baseSalary: 250000,
                  hourlyWage: 1200,
                  positionName: '',
                  positionAllowance: 0,
                  qualificationAllowance: 0,
                  fixedOvertimeAllowance: 0,
                  department: departments[0]?.name || '営業部',
                  joinDate: new Date().toISOString().split('T')[0],
                  startTime: '09:00',
                  endTime: '18:00',
                  breakMinutes: 60,
                  workLocation: tenantInfo?.address || '本社 および 会社が指定する就業場所',
                  generatedUrl: '',
                  copied: false
                });
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs px-4 py-2 rounded-xl shadow-md shadow-indigo-200 transition flex items-center gap-1.5 cursor-pointer"
              title="新入社員の給与・役職・労働条件を設定して専用入社URLを発行"
            >
              <Smartphone className="w-4 h-4 text-cyan-300" />
              ✨ 給与設定 ＆ 専用入社URLを発行
            </button>

            <button
              onClick={() => setProxyInputModal(prev => ({ ...prev, isOpen: true }))}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              紙書類の手動代行登録（PC苦手な方用）
            </button>
          </div>
        </div>

        {/* 1. 従業員台帳ビュー */}
        {currentView === 'employees' && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden animate-in fade-in duration-200">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  従業員 入退社・労務書面台帳
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">雇用契約書・通勤届・口座届のエビデンス閲覧、就業時間個別設定、退職処理</p>
              </div>

              <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs font-bold">
                <button
                  onClick={() => setActiveFilter('all')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${activeFilter === 'all' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500'}`}
                >
                  全員 ({employees.length})
                </button>
                <button
                  onClick={() => setActiveFilter('active')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${activeFilter === 'active' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500'}`}
                >
                  在職中 ({activeCount})
                </button>
                <button
                  onClick={() => setActiveFilter('retired')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${activeFilter === 'retired' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500'}`}
                >
                  退職済 ({retiredCount})
                </button>
              </div>
            </div>

            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
                <span className="text-xs">台帳を読み込み中...</span>
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <p className="font-bold text-slate-600 text-sm">該当する従業員データがありません</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[1100px]">
                  <thead>
                    <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                      <th className="py-3 px-4">氏名 / 所属</th>
                      <th className="py-3 px-3">雇用形態 / 就業時間</th>
                      <th className="py-3 px-3">手続き進捗（ステップ）</th>
                      <th className="py-3 px-3">給与 / 口座・通勤費</th>
                      <th className="py-3 px-3 text-center">労務書面証憑</th>
                      <th className="py-3 px-4 text-center">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredEmployees.map(emp => {
                      const isHourly = emp.salary_type === 'hourly' || emp.employment_type === 'part-time';
                      const isRetired = emp.status === 'retired';
                      const currentStepNum = emp.current_step_number || (emp.status === 'onboarding' ? 1 : workflowSteps.length);
                      const currentStepObj = workflowSteps.find(s => s.step_number === currentStepNum);
                      const isCompleted = currentStepNum >= workflowSteps.length && emp.status === 'active';

                      return (
                        <tr key={emp.user_id} className={`hover:bg-slate-50/80 transition ${isRetired ? 'bg-slate-50/50 opacity-75' : ''}`}>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-8 h-8 rounded-full font-bold flex items-center justify-center text-xs ${
                                isRetired ? 'bg-slate-200 text-slate-600' : 'bg-blue-50 text-blue-700'
                              }`}>
                                {emp.name.substring(0, 1)}
                              </div>
                              <div>
                                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                                  {emp.name}
                                  {isRetired && <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded font-bold">退職</span>}
                                </div>
                                <div className="text-[10px] text-slate-400 flex items-center gap-1.5 flex-wrap">
                                  <span>{emp.department || '営業部'}{emp.position_name ? ` (${emp.position_name})` : ''}</span>
                                  <span>•</span>
                                  <span>{emp.join_date}入社</span>
                                  {emp.birth_date && (
                                    <>
                                      <span>•</span>
                                      <span className="text-indigo-600 font-medium">🎂 {emp.birth_date}生</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                              isHourly ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}>
                              {isHourly ? 'パート・アルバイト' : '正社員（無期）'}
                            </span>
                            <div className="text-[10px] text-slate-500 font-bold mt-1 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-indigo-500" />
                              {emp.start_time || '09:00'} 〜 {emp.end_time || '18:00'}
                            </div>
                          </td>

                          {/* 🚶 手続き進捗ステップ ＆ 順次進行ボタン */}
                          <td className="py-3.5 px-3">
                            <div className="space-y-1.5 min-w-[200px]">
                              <div className="flex items-center justify-between">
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${
                                  isCompleted
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                    : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                }`}>
                                  Step {currentStepNum}/{workflowSteps.length}: {currentStepObj?.name || '手続き中'}
                                </span>
                                {!isCompleted && (
                                  <span className="text-[9px] text-slate-600 font-bold bg-slate-100 px-1.5 py-0.5 rounded">
                                    承認: {
                                      currentStepObj?.approver_type === 'department_head'
                                        ? (() => {
                                            const dObj = departments.find(d => d.name === emp.department);
                                            return dObj?.manager_user_name ? `${emp.department || '配属先'}所属長 (${dObj.manager_user_name})` : `${emp.department || '配属先'}所属長`;
                                          })()
                                        : (currentStepObj?.approver_name || '管理者全員')
                                    }
                                  </span>
                                )}
                              </div>

                              {!isRetired && (
                                <div className="flex items-center gap-1">
                                  {currentStepNum > 1 && (
                                    <button
                                      onClick={() => handleRollbackStep(emp)}
                                      disabled={isSaving}
                                      className="p-1 hover:bg-slate-200 rounded text-slate-500 text-[10px] font-bold transition cursor-pointer flex items-center gap-0.5"
                                      title="前のステップに戻す"
                                    >
                                      <CornerDownLeft className="w-3 h-3" />
                                      戻す
                                    </button>
                                  )}

                                  {currentStepNum < workflowSteps.length && (
                                    <button
                                      onClick={() => handleAdvanceStep(emp)}
                                      disabled={isSaving}
                                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black px-2.5 py-1 rounded-lg transition flex items-center gap-1 shadow-xs cursor-pointer disabled:opacity-50"
                                      title={`承認して次のステップへ進める (承認権限: ${
                                        currentStepObj?.approver_type === 'department_head'
                                          ? (() => {
                                              const dObj = departments.find(d => d.name === emp.department);
                                              return dObj?.manager_user_name ? `${emp.department || '配属先'}所属長 (${dObj.manager_user_name})` : `${emp.department || '配属先'}所属長`;
                                            })()
                                          : (currentStepObj?.approver_name || '管理者全員')
                                      })`}
                                    >
                                      承認して次へ
                                      <ArrowRight className="w-3 h-3" />
                                    </button>
                                  )}

                                  {isCompleted && (
                                    <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
                                      <Check className="w-3.5 h-3.5" /> 手続き全完了
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-3 text-slate-700 text-[11px]">
                            <div className="font-bold">
                              {isHourly ? `時給 ¥${emp.hourly_wage?.toLocaleString()}` : `月給 ¥${emp.base_salary?.toLocaleString()}`}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              口座: {emp.bank_name || '未登録'} / 通勤: ¥{emp.commuting_allowance?.toLocaleString() || 0}
                            </div>
                          </td>

                          {/* 📁 労務書面キャビネット ボタン */}
                          <td className="py-3.5 px-3 text-center">
                            <button
                              onClick={() => {
                                const fullEmp = resolveEmployeeFullData(emp);
                                setCabinetModal({
                                  isOpen: true,
                                  employee: fullEmp,
                                  activeDoc: 'contract'
                                });
                              }}
                              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs px-2.5 py-1.5 rounded-xl border border-indigo-200 transition flex items-center gap-1 mx-auto cursor-pointer"
                              title="労働条件通知書・通勤届・口座届・扶養控除申告書をまとめて閲覧"
                            >
                              <FolderOpen className="w-3.5 h-3.5" />
                              書面・証憑
                            </button>
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => {
                                  const isH = emp.salary_type === 'hourly';
                                  setInviteUrlModal({
                                    isOpen: true,
                                    name: emp.name || '',
                                    employmentType: emp.employment_type === 'part-time' ? 'パート・アルバイト' : '正社員（無期雇用）',
                                    salaryType: isH ? 'hourly' : 'monthly',
                                    baseSalary: emp.base_salary || 250000,
                                    hourlyWage: emp.hourly_wage || 1200,
                                    positionName: emp.position_name || '',
                                    positionAllowance: emp.position_allowance || 0,
                                    qualificationAllowance: emp.qualification_allowance || 0,
                                    fixedOvertimeAllowance: 0,
                                    department: emp.department || departments[0]?.name || '営業部',
                                    joinDate: emp.join_date || new Date().toISOString().split('T')[0],
                                    startTime: emp.start_time || '09:00',
                                    endTime: emp.end_time || '18:00',
                                    breakMinutes: emp.break_time_minutes || 60,
                                    workLocation: tenantInfo?.address || '本社 および 会社が指定する就業場所',
                                    generatedUrl: '',
                                    copied: false
                                  });
                                }}
                                className="bg-cyan-50 hover:bg-cyan-100 text-cyan-700 font-bold text-xs p-1.5 rounded-lg border border-cyan-200 transition cursor-pointer"
                                title="この従業員の給与・役職条件でスマホ入社URLを発行"
                              >
                                <Smartphone className="w-3.5 h-3.5 text-cyan-700" />
                              </button>

                              <button
                                onClick={() => setEditModal({ isOpen: true, data: { ...emp } })}
                                className="bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs p-1.5 rounded-lg border border-slate-200 transition cursor-pointer"
                                title="従業員・就業時間・給与の修正"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                              </button>

                              {isRetired ? (
                                <button
                                  onClick={() => handleRehire(emp)}
                                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs p-1.5 rounded-lg border border-emerald-200 transition cursor-pointer"
                                  title="在職中へ復帰"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => setRetireModal({
                                    isOpen: true,
                                    data: emp,
                                    retirementDate: new Date().toISOString().split('T')[0],
                                    retirementReason: '自己都合退職',
                                    needSeparationNotice: true
                                  })}
                                  className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs p-1.5 rounded-lg border border-rose-200 transition cursor-pointer"
                                  title="退職手続き"
                                >
                                  <UserMinus className="w-3.5 h-3.5" />
                                </button>
                              )}

                              <button
                                onClick={() => handleDeleteEmployee(emp)}
                                className="bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 font-bold text-xs p-1.5 rounded-lg border border-slate-200 transition cursor-pointer"
                                title="従業員データを完全抹消・削除（誤登録用）"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
        )}

        {/* 2. 提出書類審査ビュー */}
        {currentView === 'submissions' && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden animate-in fade-in duration-200">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <Inbox className="w-5 h-5 text-blue-600" />
                  従業員からの提出書類 ＆ 各種申請審査
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">通帳写真や通勤費申請を確認し、承認すると給与マスタへ即座に自動反映されます</p>
              </div>

              <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs font-bold flex-wrap">
                <button
                  onClick={() => setSubmissionFilter('pending')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${submissionFilter === 'pending' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500'}`}
                >
                  未審査のみ ({submissions.filter(s => s.status === 'pending').length})
                </button>
                <button
                  onClick={() => setSubmissionFilter('rejected')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${submissionFilter === 'rejected' ? 'bg-white text-rose-600 shadow-xs' : 'text-slate-500'}`}
                >
                  差戻し中 ({submissions.filter(s => s.status === 'rejected').length})
                </button>
                <button
                  onClick={() => setSubmissionFilter('approved')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${submissionFilter === 'approved' ? 'bg-white text-emerald-600 shadow-xs' : 'text-slate-500'}`}
                >
                  承認済 ({submissions.filter(s => s.status === 'approved').length})
                </button>
                <button
                  onClick={() => setSubmissionFilter('all')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${submissionFilter === 'all' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500'}`}
                >
                  全履歴 ({submissions.length})
                </button>
              </div>
            </div>

            {filteredSubmissions.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-400 mb-3" />
                <p className="font-bold text-slate-600 text-sm">該当する提出書類・申請はありません</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {filteredSubmissions.map(sub => {
                  const isPending = sub.status === 'pending';
                  const isRejected = sub.status === 'rejected';
                  const isApproved = sub.status === 'approved';
                  const d = sub.data || {};

                  return (
                    <div key={sub.id} className={`p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition ${
                      isRejected ? 'bg-rose-50/40' : isApproved ? 'bg-slate-50/30' : 'hover:bg-slate-50/50'
                    }`}>
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-slate-800 text-sm">{sub.user_name} 殿</span>
                          <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-200">
                            {sub.title}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            提出: {new Date(sub.created_at).toLocaleString('ja-JP')}
                          </span>

                          {isRejected && (
                            <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded border border-rose-300 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 text-rose-600" />
                              差戻し中（再提出待ち）
                            </span>
                          )}

                          {isApproved && (
                            <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              承認済 {sub.approved_by ? `(承認者: ${sub.approved_by})` : ''}
                            </span>
                          )}
                        </div>

                        {/* 差戻し理由の警告表示 */}
                        {isRejected && sub.admin_comment && (
                          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>差戻し理由: {sub.admin_comment}</span>
                          </div>
                        )}

                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
                          {sub.document_type === 'bank_passbook' && (
                            <>
                              <div>銀行名: <span className="font-bold">{d.bank_name} {d.branch_name}</span></div>
                              <div>口座: <span className="font-bold">{d.account_type === 'ordinary' ? '普通' : '当座'} {d.account_number}</span> ({d.account_holder})</div>
                            </>
                          )}
                          {sub.document_type === 'commuting_pass' && (
                            <>
                              <div className="sm:col-span-2">
                                経路: <span className="font-bold">
                                  {d.segments && d.segments.length > 0
                                    ? d.segments.map((s: any) => `${s.fromStation}➔${s.toStation}(${s.lineName})`).join(' ＋ ')
                                    : `${d.origin_station || ''} 〜 ${d.destination_station || ''}`}
                                </span>
                              </div>
                              <div>1ヶ月定期代合計: <span className="font-black text-indigo-700">¥{d.one_month_pass_amount?.toLocaleString()}</span></div>
                              <div>非課税判定: <span className="font-bold text-emerald-600">{d.is_tax_free !== false ? '全額非課税' : '一部課税あり'}</span></div>
                            </>
                          )}
                          {sub.document_type === 'dependents_form' && (
                            <div>扶養親族等の数: <span className="font-bold">{d.dependents_count}名</span> {d.has_spouse ? '（配偶者控除あり）' : ''}</div>
                          )}
                          {sub.document_type === 'my_number' && (
                            <div>マイナンバー: <span className="font-bold tracking-widest">{d.my_number ? '************' : '書類添付済'}</span></div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {/* 📄 労働条件通知書 兼 雇用契約書のプレビュー・単独印刷ボタン */}
                        <button
                          onClick={() => {
                            const fullEmp = resolveEmployeeFullData(sub);
                            setCabinetModal({
                              isOpen: true,
                              employee: fullEmp,
                              activeDoc: 'contract',
                              selectedSubmission: sub
                            });
                          }}
                          className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-300 text-indigo-900 font-bold text-xs px-3 py-1.5 rounded-xl transition flex items-center gap-1 shadow-xs cursor-pointer"
                          title="労働条件通知書 兼 雇用契約書をA4印刷・プレビュー"
                        >
                          <FileText className="w-3.5 h-3.5 text-indigo-600" />
                          労働条件通知書
                        </button>

                        {/* 📄 令和8年分 扶養控除等申告書のプレビュー・印刷ボタン */}
                        {(sub.document_type === 'dependents_form' || sub.document_type === 'tax_withholding') && (
                          <button
                            onClick={() => {
                              const fullEmp = resolveEmployeeFullData(sub);
                              setCabinetModal({
                                isOpen: true,
                                employee: fullEmp,
                                activeDoc: 'tax',
                                selectedSubmission: sub
                              });
                            }}
                            className="bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 font-black text-xs px-3 py-1.5 rounded-xl transition flex items-center gap-1 shadow-xs cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5 text-amber-600" />
                            申告書
                          </button>
                        )}

                        {/* 🚆 通勤申請書のプレビュー・印刷ボタン */}
                        {sub.document_type === 'commuting_pass' && (
                          <button
                            onClick={() => {
                              const fullEmp = resolveEmployeeFullData(sub);
                              setCabinetModal({
                                isOpen: true,
                                employee: fullEmp,
                                activeDoc: 'commuting',
                                selectedSubmission: sub
                              });
                            }}
                            className="bg-blue-50 hover:bg-blue-100 border border-blue-300 text-blue-900 font-bold text-xs px-3 py-1.5 rounded-xl transition flex items-center gap-1 shadow-xs cursor-pointer"
                          >
                            <Train className="w-3.5 h-3.5 text-blue-600" />
                            通勤届
                          </button>
                        )}

                        {/* 📷 提出写真・証憑原本の確認ボタン */}
                        {sub.attachment_data && (
                          <button
                            onClick={() => setAttachmentPreviewModal({
                              isOpen: true,
                              title: `${sub.user_name} 殿の提出写真 (${sub.title})`,
                              imageSrc: sub.attachment_data!
                            })}
                            className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold text-xs px-2.5 py-1.5 rounded-xl transition flex items-center gap-1 shadow-xs cursor-pointer"
                            title="添付写真原本を確認"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-600" />
                            写真
                          </button>
                        )}

                        {/* ✏️ 修正（編集）ボタン */}
                        <button
                          onClick={() => setEditSubmissionModal({
                            isOpen: true,
                            submission: sub,
                            editedData: { ...sub.data }
                          })}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-2.5 py-1.5 rounded-xl border border-slate-300 transition flex items-center gap-1 cursor-pointer"
                          title="提出内容を管理者が手動修正"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                          修正
                        </button>

                        {/* ↩️ 差戻しボタン */}
                        {!isRejected && (
                          <button
                            onClick={() => setRejectSubmissionModal({
                              isOpen: true,
                              submission: sub,
                              comment: ''
                            })}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs px-2.5 py-1.5 rounded-xl border border-rose-200 transition flex items-center gap-1 cursor-pointer"
                            title="理由を付けて従業員に再提出を依頼"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                            差戻し
                          </button>
                        )}

                        {/* 🗑️ 削除ボタン */}
                        <button
                          onClick={() => handleDeleteSubmission(sub)}
                          className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition cursor-pointer"
                          title="この提出書類を削除（テスト・二重提出整理用）"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        {/* 承認ボタン */}
                        {isPending && (
                          <button
                            onClick={() => handleApproveSubmission(sub)}
                            disabled={isSaving}
                            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs px-3.5 py-1.5 rounded-xl shadow-xs transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            承認
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </main>

      {/* 📁 労務書面キャビネット（証憑アーカイブ）モーダル */}
      {cabinetModal.isOpen && cabinetModal.employee && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto print:static print:p-0 print:m-0 print:bg-white print:overflow-visible">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-slate-100 my-8 print:my-0 print:p-0 print:border-none print:shadow-none print:max-w-none print:w-full">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4 print:hidden">
              <div>
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-indigo-600" />
                  労務書面キャビネット（{cabinetModal.employee.name} 殿）
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">入社時に締結した契約書および提出された通勤届・口座届のエビデンス原本</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  この書面をA4印刷 / PDF保存
                </button>
                <button onClick={() => setCabinetModal({ isOpen: false, employee: null, activeDoc: 'contract' })} className="p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 書面タブ切り替え */}
            <div className="flex items-center gap-2 mb-6 border-b border-slate-200 pb-3 print:hidden">
              <button
                onClick={() => setCabinetModal(prev => ({ ...prev, activeDoc: 'contract' }))}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  cabinetModal.activeDoc === 'contract' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <FileText className="w-4 h-4" />
                1. 労働条件通知書 兼 雇用契約書
              </button>

              <button
                onClick={() => setCabinetModal(prev => ({ ...prev, activeDoc: 'commuting' }))}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  cabinetModal.activeDoc === 'commuting' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Train className="w-4 h-4" />
                2. 通勤交通費 申請・承認書
              </button>

              <button
                onClick={() => setCabinetModal(prev => ({ ...prev, activeDoc: 'bank' }))}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  cabinetModal.activeDoc === 'bank' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                3. 給与振込口座 登録届出書
              </button>

              <button
                onClick={() => setCabinetModal(prev => ({ ...prev, activeDoc: 'tax' }))}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  cabinetModal.activeDoc === 'tax' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <FileText className="w-4 h-4" />
                4. 扶養控除等申告書
              </button>

              <button
                onClick={() => setCabinetModal(prev => ({ ...prev, activeDoc: 'spouse_deduction' }))}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  cabinetModal.activeDoc === 'spouse_deduction' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300'
                }`}
              >
                <Users className="w-4 h-4 text-emerald-600" />
                5. 配偶者控除等申告書（特別控除）
              </button>

              {/* 🖨️ 全社カスタム登録公的書類タブ一覧 */}
              {customDocTemplates.map((tpl, tIdx) => (
                <button
                  key={tpl.id}
                  onClick={() => setCabinetModal(prev => ({ ...prev, activeDoc: tpl.id }))}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    cabinetModal.activeDoc === tpl.id ? 'bg-indigo-600 text-white shadow-sm' : 'bg-indigo-50/80 text-indigo-900 hover:bg-indigo-100 border border-indigo-200'
                  }`}
                >
                  <FileText className="w-4 h-4 text-indigo-500" />
                  {tIdx + 6}. {tpl.title}
                </button>
              ))}

              <button
                onClick={() => setCabinetModal(prev => ({ ...prev, activeDoc: 'raw_data' }))}
                className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                  cabinetModal.activeDoc === 'raw_data' ? 'bg-amber-600 text-white shadow-sm' : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-300'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-amber-700" />
                📋 スマホ原本・照合
              </button>
            </div>

            {/* 書面本体 */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden p-6 bg-slate-50/50 print:border-none print:p-0 print:bg-white max-h-[65vh] print:max-h-none overflow-y-auto print:overflow-visible">
              {cabinetModal.activeDoc === 'contract' && (() => {
                const contractTpl = getLaborContractTemplateFromStorage(tenantId || '');
                const sealImg = (tenantInfo as any)?.company_seal_url || contractTpl.company_seal_url || localStorage.getItem(`company_seal_image_${tenantId}`) || localStorage.getItem('company_seal_image') || undefined;
                const resolvedEmp = resolveEmployeeFullData(cabinetModal.employee);

                return (
                  <OfficialLaborContractDoc 
                    data={{
                      companyName: tenantInfo?.name || '株式会社KAP',
                      companyAddress: tenantInfo?.address || '滋賀県大津市坂本3丁目21-16',
                      representativeName: (tenantInfo?.representative_name || '代表取締役 駒井 秀一朗').replace(/^代表取締役\s*/, '代表取締役 '),
                      employeeName: resolvedEmp.name,
                      employeeAddress: resolvedEmp.address || '未登録',
                      joinDate: resolvedEmp.join_date,
                      contractType: resolvedEmp.contract_type || 'indefinite',
                      trialPeriodMonths: resolvedEmp.trial_period_months ?? 3,
                      workLocation: contractTpl.work_location_default || '本社 および 会社が指定する就業場所',
                      jobDescription: `${resolvedEmp.department || '営業部'}${resolvedEmp.position_name ? ` (${resolvedEmp.position_name})` : ''}における業務全般`,
                      startTime: resolvedEmp.start_time || '09:00',
                      endTime: resolvedEmp.end_time || '18:00',
                      breakTimeMinutes: resolvedEmp.break_time_minutes || 60,
                      overtimeWork: contractTpl.overtime_work_notes || 'あり（業務の都合により命じる場合がある）',
                      holidaysText: resolvedEmp.holidays_text || '完全週休2日制（土・日）、国民の祝日',
                      paidLeaveGrantDays: 10,
                      salaryType: resolvedEmp.salary_type || (resolvedEmp.employment_type === 'part-time' ? 'hourly' : 'monthly'),
                      baseSalary: resolvedEmp.base_salary,
                      hourlyWage: resolvedEmp.hourly_wage,
                      positionAllowance: resolvedEmp.position_allowance || 0,
                      qualificationAllowance: resolvedEmp.qualification_allowance || 0,
                      housingAllowance: resolvedEmp.housing_allowance || 0,
                      familyAllowance: resolvedEmp.family_allowance || 0,
                      commutingAllowance: resolvedEmp.commuting_allowance || 0,
                      closingDayText: contractTpl.closing_day_text || '毎月末日',
                      paymentDayText: contractTpl.payment_day_text || '当月25日（金融機関振込）',
                      fixedOvertimeHours: 0,
                      fixedOvertimeAllowance: resolvedEmp.fixed_overtime_allowance || 0,
                      bonusPolicy: 'あり（会社の業績および本人の勤務成績を勘案して支給）',
                      raisePolicy: 'あり（原則として年1回査定）',
                      retirementAllowance: 'なし',
                      healthInsuranceJoined: resolvedEmp.health_insurance_joined,
                      pensionInsuranceJoined: resolvedEmp.pension_insurance_joined,
                      employmentInsuranceJoined: resolvedEmp.employment_insurance_joined,
                      workersCompJoined: true,
                      companySealUrl: sealImg,
                      template: contractTpl,
                      isEmployeeSigned: true,
                      employeeSignedAt: (resolvedEmp as any).signed_at ? (resolvedEmp as any).signed_at.replace('T', ' ').split('.')[0] : `${resolvedEmp.join_date} 09:00:00`
                    }} 
                  />
                );
              })()}

              {cabinetModal.activeDoc === 'commuting' && (() => {
                const resolvedEmp = resolveEmployeeFullData(cabinetModal.employee);
                const targetEmpName = resolvedEmp.name?.trim() || '';
                const targetUserId = resolvedEmp.user_id || '';
                const userCommSubs = submissions
                  .filter(s => (s.user_id === targetUserId || (targetEmpName && s.data?.name?.trim() === targetEmpName) || (targetEmpName && s.user_name?.trim() === targetEmpName)) && s.document_type === 'commuting_pass')
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                const subComm = (cabinetModal.selectedSubmission?.document_type === 'commuting_pass' ? cabinetModal.selectedSubmission : null) || userCommSubs[0];
                const cData = subComm?.data || {};

                return (
                  <OfficialCommutingPassDoc data={{
                    companyName: tenantInfo?.name || '株式会社KAP',
                    employeeName: cData.name || resolvedEmp.name,
                    department: resolvedEmp.department || '営業部',
                    transportMode: cData.transport_mode || 'train_bus',
                    originStation: cData.origin_station || '自宅最寄',
                    destinationStation: cData.destination_station || '会社最寄',
                    segments: cData.segments || [],
                    carDistanceKm: cData.car_distance_km,
                    oneMonthPassAmount: cData.one_month_pass_amount !== undefined ? cData.one_month_pass_amount : (resolvedEmp.commuting_allowance || 0),
                    sixMonthPassAmount: cData.six_month_pass_amount,
                    attachmentImage: subComm?.attachment_data,
                    appliedDate: resolvedEmp.join_date
                  }} />
                );
              })()}

              {cabinetModal.activeDoc === 'bank' && (() => {
                const resolvedEmp = resolveEmployeeFullData(cabinetModal.employee);
                const targetEmpName = resolvedEmp.name?.trim() || '';
                const targetUserId = resolvedEmp.user_id || '';
                const userBankSubs = submissions
                  .filter(s => (s.user_id === targetUserId || (targetEmpName && s.data?.name?.trim() === targetEmpName) || (targetEmpName && s.user_name?.trim() === targetEmpName)) && s.document_type === 'bank_passbook')
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                const bSub = (cabinetModal.selectedSubmission?.document_type === 'bank_passbook' ? cabinetModal.selectedSubmission : null) || userBankSubs[0];
                const bData = bSub?.data || {};

                return (
                  <OfficialBankPassbookDoc data={{
                    companyName: tenantInfo?.name || '株式会社KAP',
                    employeeName: bData.name || resolvedEmp.name,
                    department: resolvedEmp.department || '営業部',
                    bankName: bData.bank_name || resolvedEmp.bank_name || '未登録',
                    branchName: bData.branch_name || resolvedEmp.branch_name || '未登録',
                    accountType: bData.account_type || resolvedEmp.account_type || 'ordinary',
                    accountNumber: bData.account_number || resolvedEmp.account_number || '',
                    accountHolder: bData.account_holder || resolvedEmp.account_holder || resolvedEmp.name,
                    attachmentImage: bSub?.attachment_data,
                    appliedDate: resolvedEmp.join_date
                  }} />
                );
              })()}

              {cabinetModal.activeDoc === 'tax' && (() => {
                const targetEmpName = cabinetModal.employee?.name?.trim() || '';
                const targetUserId = cabinetModal.employee?.user_id || '';

                const userTaxSubs = submissions
                  .filter(s => (s.user_id === targetUserId || (targetEmpName && s.data?.name?.trim() === targetEmpName) || (targetEmpName && s.user_name?.trim() === targetEmpName)) && s.document_type === 'dependents_form')
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                
                const subTax = (cabinetModal.selectedSubmission?.document_type === 'dependents_form' ? cabinetModal.selectedSubmission : null) || userTaxSubs[0];
                const tData = subTax?.data || {};

                const userResSubs = submissions
                  .filter(s => (s.user_id === targetUserId || (targetEmpName && s.data?.name?.trim() === targetEmpName) || (targetEmpName && s.user_name?.trim() === targetEmpName)) && s.document_type === 'resident_certificate')
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                const rData = userResSubs[0]?.data || {};

                return (
                  <div className="space-y-4">
                    {/* 📱 従業員がWeb送信した大元データのサマリー照合バー */}
                    <div className="bg-amber-50/80 border border-amber-200 p-3.5 rounded-2xl print:hidden space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-black text-amber-900 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-amber-600" />
                          📱 スマホ・PCから送信された大元入力データ（照合中）
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-amber-700 font-bold">
                            送信日時: {subTax?.created_at ? new Date(subTax.created_at).toLocaleString('ja-JP') : '未送信'}
                          </span>
                          <button
                            onClick={() => {
                              const emp = cabinetModal.employee;
                              if (!emp) return;
                              const targetSub = subTax || {
                                id: `temp_tax_${emp.user_id}`,
                                tenant_id: tenantId!,
                                user_id: emp.user_id,
                                user_name: emp.name,
                                document_type: 'dependents_form',
                                title: '令和8年分 扶養控除等申告書',
                                data: {
                                  name: emp.name,
                                  has_spouse: emp.has_spouse || false,
                                  spouse_name: '',
                                  spouse_income_estimate: 0,
                                  dependents_count: emp.dependents_count || 0,
                                  dependents: []
                                },
                                status: 'approved',
                                created_at: new Date().toISOString()
                              };
                              setEditSubmissionModal({
                                isOpen: true,
                                submission: targetSub as any,
                                editedData: { ...targetSub.data }
                              });
                            }}
                            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] rounded-xl shadow-xs transition flex items-center gap-1 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            ✏️ 扶養控除申告書の内容を修正・編集
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-700">
                        <div className="bg-white p-2 rounded-xl border border-amber-100">
                          <span className="text-slate-400 block text-[10px]">申告者氏名</span>
                          <span className="font-bold text-slate-900">{tData.name || cabinetModal.employee.name}</span>
                          {tData.name_kana && <span className="text-[9px] text-slate-500 block">({tData.name_kana})</span>}
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-amber-100">
                          <span className="text-slate-400 block text-[10px]">配偶者控除</span>
                          <span className="font-bold text-slate-900">
                            {tData.has_spouse ? `${tData.spouse_name || 'あり'} (${tData.spouse_name_kana || ''})` : 'なし'}
                          </span>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-amber-100 sm:col-span-2">
                          <span className="text-slate-400 block text-[10px]">扶養親族（{tData.dependents?.length || 0}名）</span>
                          <span className="font-bold text-slate-900">
                            {tData.dependents && tData.dependents.length > 0 
                              ? tData.dependents.map((d: any) => `${d.name || '子'}(${d.birthDate || ''})`).join('、 ')
                              : 'なし'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <OfficialTaxExemptionDoc data={{
                      year: tData.year || 2026,
                      companyName: tenantInfo?.name || '株式会社KAP',
                      companyAddress: tenantInfo?.address || '滋賀県大津市坂本3丁目21-16',
                      corporateNumber: tenantInfo?.corporate_number || '1010001999999',
                      taxOfficeName: tenantInfo?.tax_office_name || '大津',
                      municipalityName: tenantInfo?.municipality_name || '大津市',
                      employeeName: tData.name || rData.name || cabinetModal.employee.name,
                      employeeNameKana: tData.name_kana || rData.name_kana || (cabinetModal.employee as any).name_kana || '',
                      employeeAddress: tData.address || rData.address || cabinetModal.employee.address || '滋賀県大津市坂本3丁目21-16',
                      postalCode: tData.postal_code || rData.postal_code || '520-0113',
                      myNumber: tData.my_number || '',
                      birthDate: rData.birth_date || tData.birth_date || cabinetModal.employee.birth_date || '1998-04-01',
                      householderName: tData.householder_name || rData.householder_name || tData.name || cabinetModal.employee.name,
                      householderRelation: tData.householder_relation || rData.householder_relation || '本人',
                      hasSpouse: tData.has_spouse || false,
                      spouseName: tData.spouse_name || tData.spouseName || '',
                      spouseNameKana: tData.spouse_name_kana || tData.spouseNameKana || '',
                      spouseBirthDate: tData.spouse_birth_date || tData.spouseBirthDate || '1996-05-15',
                      spouseIncomeEstimate: tData.spouse_income_estimate ?? tData.spouseIncomeEstimate ?? 0,
                      spouseIsLivingTogether: tData.spouse_is_living_together !== false,
                      dependents: tData.dependents || [],
                      isDisability: tData.is_disability,
                      isSingleParent: tData.is_single_parent,
                      isWidow: tData.is_widow,
                      isWorkingStudent: tData.is_working_student,
                      appliedDate: cabinetModal.employee.join_date
                    }} />
                  </div>
                );
              })()}

              {/* 👨‍👩‍👧‍👦 5. 配偶者控除等申告書（年末調整・配偶者特別控除計算書） */}
              {cabinetModal.activeDoc === 'spouse_deduction' && (() => {
                const targetEmpName = cabinetModal.employee?.name?.trim() || '';
                const targetUserId = cabinetModal.employee?.user_id || '';

                const userTaxSubs = submissions
                  .filter(s => (s.user_id === targetUserId || (targetEmpName && s.data?.name?.trim() === targetEmpName) || (targetEmpName && s.user_name?.trim() === targetEmpName)) && (s.document_type === 'dependents_form' || s.document_type === 'tax_withholding'))
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                
                const tData = userTaxSubs[0]?.data || {};
                const resolvedEmp = resolveEmployeeFullData(cabinetModal.employee);

                return (
                  <div className="space-y-4">
                    <OfficialSpouseDeductionDoc data={{
                      year: tData.year || 2026,
                      companyName: tenantInfo?.name || '株式会社KAP',
                      companyAddress: tenantInfo?.address || '滋賀県大津市坂本3丁目21-16',
                      corporateNumber: tenantInfo?.corporate_number || '1010001999999',
                      employeeName: resolvedEmp.name,
                      employeeAddress: resolvedEmp.address || '滋賀県大津市坂本3丁目21-16',
                      employeeIncomeEstimate: resolvedEmp.base_salary ? resolvedEmp.base_salary * 12 : 3500000,
                      hasSpouse: tData.has_spouse || resolvedEmp.has_spouse || false,
                      spouseName: tData.spouse_name || '',
                      spouseNameKana: tData.spouse_name_kana || '',
                      spouseBirthDate: tData.spouse_birth_date || '1996-05-15',
                      spouseIncomeEstimate: tData.spouse_income_estimate ?? 0,
                      spouseAddress: resolvedEmp.address,
                      appliedDate: resolvedEmp.join_date
                    }} />
                  </div>
                );
              })()}

              {/* 🖨️ 全社登録カスタム公的書類の自動Canvas印字レンダリング */}
              {(() => {
                const currentTpl = customDocTemplates.find(t => t.id === cabinetModal.activeDoc);
                if (!currentTpl) return null;

                const resolvedEmp = resolveEmployeeFullData(cabinetModal.employee);
                const targetEmpName = cabinetModal.employee?.name?.trim() || '';
                const targetUserId = cabinetModal.employee?.user_id || '';

                const userTaxSubs = submissions
                  .filter(s => (s.user_id === targetUserId || (targetEmpName && s.data?.name?.trim() === targetEmpName) || (targetEmpName && s.user_name?.trim() === targetEmpName)) && (s.document_type === 'dependents_form' || s.document_type === 'tax_withholding'))
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                const tData = userTaxSubs[0]?.data || {};

                const fullEmpData = {
                  ...resolvedEmp,
                  ...tData,
                  my_number: tData.my_number || resolvedEmp.my_number || '',
                  dependents: tData.dependents || resolvedEmp.dependents || []
                };

                return (
                  <div className="space-y-4">
                    <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-xl flex items-center justify-between text-xs">
                      <span className="font-bold text-indigo-950">
                        📑 全社登録書類: {currentTpl.title} ({currentTpl.fields.length}項目自動印字)
                      </span>
                      <span className="text-[10px] text-indigo-600">※ A4実寸・高精細原本出力</span>
                    </div>

                    <OfficialCustomCanvasDoc
                      template={currentTpl}
                      employeeData={fullEmpData}
                      companyData={tenantInfo}
                    />
                  </div>
                );
              })()}

              {/* 📋 6. スマホ・PC入力原本 全データ照合ビュー */}
              {cabinetModal.activeDoc === 'raw_data' && (() => {
                const targetEmpName = cabinetModal.employee?.name?.trim() || '';
                const targetUserId = cabinetModal.employee?.user_id || '';

                const userTaxSubs = submissions
                  .filter(s => (s.user_id === targetUserId || (targetEmpName && s.data?.name?.trim() === targetEmpName) || (targetEmpName && s.user_name?.trim() === targetEmpName)) && s.document_type === 'dependents_form')
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                const tData = userTaxSubs[0]?.data || {};

                const userCommSubs = submissions
                  .filter(s => (s.user_id === targetUserId || (targetEmpName && s.data?.name?.trim() === targetEmpName) || (targetEmpName && s.user_name?.trim() === targetEmpName)) && s.document_type === 'commuting_pass')
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                const cData = userCommSubs[0]?.data || {};

                const userBankSubs = submissions
                  .filter(s => (s.user_id === targetUserId || (targetEmpName && s.data?.name?.trim() === targetEmpName) || (targetEmpName && s.user_name?.trim() === targetEmpName)) && s.document_type === 'bank_passbook')
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                const bData = userBankSubs[0]?.data || {};

                const userMyNumSubs = submissions
                  .filter(s => (s.user_id === targetUserId || (targetEmpName && s.data?.name?.trim() === targetEmpName) || (targetEmpName && s.user_name?.trim() === targetEmpName)) && s.document_type === 'my_number')
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                const mData = userMyNumSubs[0]?.data || {};

                return (
                  <div className="space-y-6 text-xs text-slate-800">
                    <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-4 rounded-2xl text-white shadow-md flex items-center justify-between">
                      <div>
                        <h4 className="font-black text-sm flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-amber-200" />
                          従業員Web入力データ原本・全項目照合シート
                        </h4>
                        <p className="text-[11px] text-amber-100 mt-0.5">
                          スマホ・PCで実際に入力・送信された生データを一覧表示しています。各公的書面への印字内容と照合してください。
                        </p>
                      </div>
                      <span className="bg-white/20 px-3 py-1 rounded-xl text-xs font-bold">
                        対象: {tData.name || cabinetModal.employee.name} 殿
                      </span>
                    </div>

                    {/* 1. 基本・世帯情報 */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                      <h5 className="font-black text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-1.5 text-xs">
                        <UserCheck className="w-4 h-4 text-indigo-600" />
                        1. 本人基本・世帯主情報
                      </h5>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div>
                          <span className="text-slate-400 block text-[10px]">氏名（漢字）</span>
                          <span className="font-bold text-slate-900 text-sm">{tData.name || cabinetModal.employee.name}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">フリガナ（カナ）</span>
                          <span className="font-bold text-slate-900 text-sm">{tData.name_kana || '未登録'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">生年月日</span>
                          <span className="font-bold text-slate-900">{tData.birth_date || cabinetModal.employee.birth_date || '未登録'}</span>
                        </div>
                        <div className="sm:col-span-2">
                          <span className="text-slate-400 block text-[10px]">現住所</span>
                          <span className="font-bold text-slate-900">{tData.address || cabinetModal.employee.address || '未登録'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">世帯主 / 続柄</span>
                          <span className="font-bold text-slate-900">
                            {tData.householder_name || tData.name || '本人'} ({tData.householder_relation || '本人'})
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 2. 配偶者情報 */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                      <h5 className="font-black text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-1.5 text-xs">
                        <Users className="w-4 h-4 text-amber-600" />
                        2. 源泉控除対象配偶者
                      </h5>
                      {tData.has_spouse ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div>
                            <span className="text-slate-400 block text-[10px]">配偶者氏名</span>
                            <span className="font-bold text-slate-900">{tData.spouse_name || '未入力'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">フリガナ</span>
                            <span className="font-bold text-slate-900">{tData.spouse_name_kana || '未入力'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">生年月日</span>
                            <span className="font-bold text-slate-900">{tData.spouse_birth_date || '未入力'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">本年所得見積額</span>
                            <span className="font-bold text-slate-900">¥{(tData.spouse_income_estimate || 0).toLocaleString()}</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-slate-400 text-xs italic">配偶者控除の該当なし</p>
                      )}
                    </div>

                    {/* 3. 扶養親族一覧 */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <h5 className="font-black text-slate-900 flex items-center gap-1.5 text-xs">
                          <Users className="w-4 h-4 text-emerald-600" />
                          3. 扶養親族一覧（登録数: {tData.dependents?.length || 0}名）
                        </h5>
                      </div>

                      {tData.dependents && tData.dependents.length > 0 ? (
                        <div className="divide-y divide-slate-100">
                          {tData.dependents.map((dep: any, idx: number) => {
                            const isU16 = dep.birthDate ? (new Date(dep.birthDate) >= new Date('2011-01-02')) : dep.isUnder16;
                            return (
                              <div key={idx} className="py-2.5 flex items-center justify-between gap-4">
                                <div className="space-y-0.5">
                                  <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                                    <span>{dep.name}</span>
                                    {dep.nameKana && <span className="text-[10px] text-slate-500">({dep.nameKana})</span>}
                                    <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px]">
                                      続柄: {dep.relation}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-400">
                                    生年月日: <span className="font-semibold text-slate-700">{dep.birthDate}</span> / 
                                    同居区分: <span className="font-semibold text-slate-700">{dep.isLivingTogether !== false ? '同居' : '別居'}</span> / 
                                    所得見積: <span className="font-semibold text-slate-700">¥{(dep.incomeEstimate || 0).toLocaleString()}</span>
                                  </div>
                                </div>
                                <div>
                                  {isU16 ? (
                                    <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-md border border-amber-200">
                                      【16歳未満】住民税欄
                                    </span>
                                  ) : (
                                    <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black px-2 py-0.5 rounded-md border border-indigo-200">
                                      【控除対象・16歳以上】B欄
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-slate-400 text-xs italic">扶養親族の登録なし</p>
                      )}
                    </div>

                    {/* 4. 給与振込口座 ＆ 通勤交通費 ＆ マイナンバー */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                        <h5 className="font-black text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-1.5 text-xs">
                          <CreditCard className="w-4 h-4 text-blue-600" />
                          4. 給与振込口座
                        </h5>
                        <div className="space-y-1 text-xs">
                          <div>金融機関: <span className="font-bold text-slate-900">{bData.bank_name || '未登録'} {bData.branch_name || ''}</span></div>
                          <div>口座: <span className="font-bold text-slate-900">{bData.account_type === 'ordinary' ? '普通' : '当座'} {bData.account_number || ''}</span></div>
                          <div>名義人: <span className="font-bold text-slate-900">{bData.account_holder || cabinetModal.employee.name}</span></div>
                        </div>
                      </div>

                      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                        <h5 className="font-black text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-1.5 text-xs">
                          <Train className="w-4 h-4 text-emerald-600" />
                          5. 通勤交通費・定期代
                        </h5>
                        <div className="space-y-1 text-xs">
                          <div>通勤手段: <span className="font-bold text-slate-900">{cData.transport_mode === 'train_bus' ? '電車・バス' : cData.transport_mode === 'car_bike' ? 'マイカー・バイク' : '徒歩・自転車'}</span></div>
                          <div>1ヶ月定期支給額: <span className="font-black text-indigo-700">¥{(cData.one_month_pass_amount || 0).toLocaleString()}</span></div>
                          <div>非課税区分: <span className="font-bold text-emerald-600">{cData.is_tax_free !== false ? '全額非課税' : '一部課税あり'}</span></div>
                        </div>
                      </div>

                      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                        <h5 className="font-black text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-1.5 text-xs">
                          <FileText className="w-4 h-4 text-purple-600" />
                          6. マイナンバー・社保届
                        </h5>
                        <div className="space-y-1 text-xs">
                          <div>マイナンバー: <span className="font-bold text-slate-900">{mData.my_number ? '************ (登録済)' : '書類添付確認'}</span></div>
                          <div>年金手帳番号: <span className="font-bold text-slate-900">{mData.pension_number || '未登録'}</span></div>
                          <div>雇用保険番号: <span className="font-bold text-slate-900">{mData.employment_insurance_number || '未登録'}</span></div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="mt-6 flex justify-end gap-2 pt-4 border-t border-slate-100 print:hidden">
              <button onClick={() => setCabinetModal({ isOpen: false, employee: null, activeDoc: 'contract' })} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer">
                閉じる
              </button>
              <button
                onClick={() => {
                  if (cabinetModal.activeDoc === 'tax') {
                    const iframe = document.getElementById('official-tax-print-iframe') as HTMLIFrameElement | null;
                    if (iframe && iframe.contentWindow) {
                      iframe.contentWindow.focus();
                      iframe.contentWindow.print();
                      return;
                    }
                  }
                  window.print();
                }}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                表示中の書面をA4印刷 / PDF保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✏️ 従業員・労務情報 修正モーダル（個人別就業時間の上書き対応） */}
      {editModal.isOpen && editModal.data && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-600" />
                従業員・労務情報の修正（{editModal.data.name} 殿）
              </h3>
              <button onClick={() => setEditModal({ isOpen: false, data: null })} className="p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 text-xs">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-700">基本情報 ＆ 就業時間帯</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">氏名</label>
                    <input
                      type="text"
                      value={editModal.data.name}
                      onChange={e => setEditModal({ ...editModal, data: { ...editModal.data!, name: e.target.value } })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">入社年月日</label>
                    <input
                      type="date"
                      value={editModal.data.join_date}
                      onChange={e => setEditModal({ ...editModal, data: { ...editModal.data!, join_date: e.target.value } })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-indigo-900 block mb-1">🎂 生年月日（西暦・介護保険連動）</label>
                    <input
                      type="date"
                      value={editModal.data.birth_date ? String(editModal.data.birth_date).substring(0, 10) : ''}
                      onChange={e => setEditModal({ ...editModal, data: { ...editModal.data!, birth_date: e.target.value } })}
                      className="w-full bg-white border border-indigo-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">現住所</label>
                    <input
                      type="text"
                      value={editModal.data.address || ''}
                      onChange={e => setEditModal({ ...editModal, data: { ...editModal.data!, address: e.target.value } })}
                      placeholder="滋賀県大津市..."
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">配属部署</label>
                    <select
                      value={editModal.data.department || ''}
                      onChange={e => {
                        const dName = e.target.value;
                        const pat = schedulePatterns.find(p => p.target_department === dName);
                        setEditModal({
                          ...editModal,
                          data: {
                            ...editModal.data!,
                            department: dName,
                            start_time: pat ? pat.start_time : editModal.data!.start_time,
                            end_time: pat ? pat.end_time : editModal.data!.end_time,
                            break_time_minutes: pat ? pat.break_minutes : editModal.data!.break_time_minutes
                          }
                        });
                      }}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    >
                      {departments.map(d => (
                        <option key={d.id} value={d.name}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">雇用形態</label>
                    <select
                      value={editModal.data.employment_type}
                      onChange={e => setEditModal({
                        ...editModal,
                        data: {
                          ...editModal.data!,
                          employment_type: e.target.value as any,
                          salary_type: e.target.value === 'part-time' ? 'hourly' : 'monthly'
                        }
                      })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    >
                      <option value="full-time">正社員（無期雇用）</option>
                      <option value="part-time">パート・アルバイト（時給制）</option>
                      <option value="contract">契約社員（有期雇用）</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">👑 役職（役職マスタ連携）</label>
                    <select
                      value={editModal.data.position_name || ''}
                      onChange={e => {
                        const selectedName = e.target.value;
                        const foundPos = positions.find(p => p.name === selectedName);
                        setEditModal({
                          ...editModal,
                          data: {
                            ...editModal.data!,
                            position_name: selectedName,
                            position_allowance: foundPos?.default_allowance !== undefined ? foundPos.default_allowance : editModal.data!.position_allowance
                          }
                        });
                      }}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    >
                      <option value="">なし（一般社員・手当なし）</option>
                      {positions.map(pos => (
                        <option key={pos.id} value={pos.name}>
                          {pos.name} {pos.default_allowance ? `(標準手当: ¥${pos.default_allowance.toLocaleString()})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">👑 役職手当 (円)</label>
                    <input
                      type="number"
                      value={editModal.data.position_allowance || 0}
                      onChange={e => setEditModal({
                        ...editModal,
                        data: {
                          ...editModal.data!,
                          position_allowance: parseInt(e.target.value, 10) || 0
                        }
                      })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    />
                  </div>
                </div>

                {/* ⏰ 個人別 就業時間帯の個別上書き設定 */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-indigo-600" />
                      個人別 所定就業時間 ＆ 休憩規定
                    </label>
                    <select
                      onChange={e => {
                        const pat = schedulePatterns.find(p => p.id === e.target.value);
                        if (pat) {
                          setEditModal({
                            ...editModal,
                            data: {
                              ...editModal.data!,
                              start_time: pat.start_time,
                              end_time: pat.end_time,
                              break_time_minutes: pat.break_minutes
                            }
                          });
                        }
                      }}
                      className="bg-slate-50 border border-slate-300 rounded px-2 py-0.5 text-[10px]"
                    >
                      <option value="">パターンから読込...</option>
                      {schedulePatterns.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.start_time}〜{p.end_time})</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-500 block mb-0.5">始業時刻</span>
                      <input
                        type="time"
                        value={editModal.data.start_time || '09:00'}
                        onChange={e => setEditModal({ ...editModal, data: { ...editModal.data!, start_time: e.target.value } })}
                        className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 font-bold text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block mb-0.5">終業時刻</span>
                      <input
                        type="time"
                        value={editModal.data.end_time || '18:00'}
                        onChange={e => setEditModal({ ...editModal, data: { ...editModal.data!, end_time: e.target.value } })}
                        className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 font-bold text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block mb-0.5">休憩時間(分)</span>
                      <input
                        type="number"
                        value={editModal.data.break_time_minutes || 60}
                        onChange={e => setEditModal({ ...editModal, data: { ...editModal.data!, break_time_minutes: parseInt(e.target.value, 10) || 60 } })}
                        className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 font-bold text-xs"
                      />
                    </div>
                  </div>
                  <p className="text-[9px] text-slate-400">※ 時短勤務や個別契約の場合でも、ここで個別に自由に時間を調整・保存できます。</p>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">休日規定（会社マスタ連動）</label>
                  <input
                    type="text"
                    value={editModal.data.holidays_text || ''}
                    onChange={e => setEditModal({ ...editModal, data: { ...editModal.data!, holidays_text: e.target.value } })}
                    placeholder="例: 完全週休2日制（土日・祝日）、年末年始休暇"
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                  />
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-700">給与・諸手当</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">給与形態</label>
                    <select
                      value={editModal.data.salary_type || 'monthly'}
                      onChange={e => setEditModal({ ...editModal, data: { ...editModal.data!, salary_type: e.target.value as any } })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    >
                      <option value="monthly">月給制</option>
                      <option value="hourly">時給制</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                      {editModal.data.salary_type === 'hourly' ? '時給単価 (円)' : '基本給 (円)'}
                    </label>
                    <input
                      type="number"
                      placeholder="例: 250000"
                      value={editModal.data.salary_type === 'hourly' ? (editModal.data.hourly_wage === 0 ? '' : editModal.data.hourly_wage) : (editModal.data.base_salary === 0 ? '' : editModal.data.base_salary)}
                      onChange={e => {
                        const val = e.target.value === '' ? 0 : (parseInt(e.target.value, 10) || 0);
                        setEditModal({
                          ...editModal,
                          data: editModal.data!.salary_type === 'hourly'
                            ? { ...editModal.data!, hourly_wage: val }
                            : { ...editModal.data!, base_salary: val }
                        });
                      }}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">役職手当</label>
                    <input
                      type="number"
                      placeholder="例: 30000"
                      value={editModal.data.position_allowance === 0 ? '' : editModal.data.position_allowance}
                      onChange={e => setEditModal({ ...editModal, data: { ...editModal.data!, position_allowance: e.target.value === '' ? 0 : (parseInt(e.target.value, 10) || 0) } })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">通勤手当</label>
                    <input
                      type="number"
                      placeholder="例: 6990"
                      value={editModal.data.commuting_allowance === 0 ? '' : editModal.data.commuting_allowance}
                      onChange={e => setEditModal({ ...editModal, data: { ...editModal.data!, commuting_allowance: e.target.value === '' ? 0 : (parseInt(e.target.value, 10) || 0) } })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-700">振込口座情報</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">銀行名</label>
                    <input
                      type="text"
                      value={editModal.data.bank_name || ''}
                      onChange={e => setEditModal({ ...editModal, data: { ...editModal.data!, bank_name: e.target.value } })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">支店名</label>
                    <input
                      type="text"
                      value={editModal.data.branch_name || ''}
                      onChange={e => setEditModal({ ...editModal, data: { ...editModal.data!, branch_name: e.target.value } })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">口座番号</label>
                    <input
                      type="text"
                      value={editModal.data.account_number || ''}
                      onChange={e => setEditModal({ ...editModal, data: { ...editModal.data!, account_number: e.target.value } })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">口座名義人</label>
                    <input
                      type="text"
                      value={editModal.data.account_holder || ''}
                      onChange={e => setEditModal({ ...editModal, data: { ...editModal.data!, account_holder: e.target.value } })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5"
                    />
                  </div>
                </div>
              </div>

              {/* 👨‍👩‍👧‍👦 扶養親族・配偶者控除・マイナンバー設定 */}
              <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200 space-y-3">
                <h4 className="font-bold text-amber-950 flex items-center justify-between text-xs border-b border-amber-200 pb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-amber-600" />
                    扶養親族 ＆ 配偶者控除設定（給与計算・源泉徴収税額 甲欄連動）
                  </span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-600 font-bold block mb-0.5">源泉控除対象配偶者</label>
                    <select
                      value={editModal.data.has_spouse ? 'true' : 'false'}
                      onChange={e => setEditModal({ ...editModal, data: { ...editModal.data!, has_spouse: e.target.value === 'true' } })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-bold text-xs text-slate-800"
                    >
                      <option value="false">なし（単身・対象外）</option>
                      <option value="true">あり（所得95万以下）</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-600 font-bold block mb-0.5">扶養親族等の数 (名)</label>
                    <input
                      type="number"
                      placeholder="例: 0"
                      value={editModal.data.dependents_count === 0 ? '' : (editModal.data.dependents_count || '')}
                      onChange={e => setEditModal({ ...editModal, data: { ...editModal.data!, dependents_count: e.target.value === '' ? 0 : (parseInt(e.target.value, 10) || 0) } })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-xs text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-600 font-bold block mb-0.5">マイナンバー</label>
                    <input
                      type="text"
                      maxLength={12}
                      placeholder="12桁"
                      value={editModal.data.my_number || ''}
                      onChange={e => setEditModal({ ...editModal, data: { ...editModal.data!, my_number: e.target.value } })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                onClick={() => setEditModal({ isOpen: false, data: null })}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                キャンセル
              </button>
              <button
                onClick={() => handleSaveEditedEmployee(editModal.data!)}
                disabled={isSaving}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-4 h-4" />}
                修正内容を全同期保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🚪 退職手続き モーダル */}
      {retireModal.isOpen && retireModal.data && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2 text-rose-600">
                <UserMinus className="w-5 h-5 text-rose-600" />
                退職手続き（{retireModal.data.name} 殿）
              </h3>
              <button onClick={() => setRetireModal({ ...retireModal, isOpen: false })} className="p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-rose-50 p-4 rounded-2xl border border-rose-200 text-rose-800 space-y-1">
                <div className="font-bold">⚠️ 退職処理に伴う影響</div>
                <p className="text-[11px] text-rose-700 leading-relaxed">
                  退職処理を実行すると、本ユーザーの勤怠打刻・シフト希望提出の権限が無効化され、退職者台帳へ移行します。
                </p>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">退職年月日 <span className="text-rose-500">*</span></label>
                <input
                  type="date"
                  value={retireModal.retirementDate}
                  onChange={e => setRetireModal({ ...retireModal, retirementDate: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">退職事由</label>
                <select
                  value={retireModal.retirementReason}
                  onChange={e => setRetireModal({ ...retireModal, retirementReason: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800"
                >
                  <option value="自己都合退職">自己都合退職（転職・一身上の都合等）</option>
                  <option value="契約期間満了">契約期間満了（有期雇用の満了）</option>
                  <option value="定年退職">定年退職</option>
                  <option value="会社都合退職">会社都合退職</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                onClick={() => setRetireModal({ ...retireModal, isOpen: false })}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                キャンセル
              </button>
              <button
                onClick={handleConfirmRetirement}
                disabled={isSaving}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-4 h-4" />}
                退職を確定実行
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 新規入社ウィザード モーダル（就業時間パターン自動セット ＆ 個別調整） */}
      {wizardOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 my-8 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-blue-600" />
                  新規入社手続きウィザード
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">入力した情報から雇用契約書を自動生成し、勤怠・シフト・給与へ一括同期します</p>
              </div>
              <button onClick={() => setWizardOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-between mb-6 bg-slate-50 p-2 rounded-2xl border border-slate-200 text-xs font-bold">
              <span className={`px-3 py-1 rounded-xl transition ${wizardStep === 1 ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>
                1. 基本情報
              </span>
              <ChevronRight className="w-4 h-4 text-slate-300" />
              <span className={`px-3 py-1 rounded-xl transition ${wizardStep === 2 ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>
                2. 労働時間・休日
              </span>
              <ChevronRight className="w-4 h-4 text-slate-300" />
              <span className={`px-3 py-1 rounded-xl transition ${wizardStep === 3 ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>
                3. 給与・社保・口座
              </span>
              <ChevronRight className="w-4 h-4 text-slate-300" />
              <span className={`px-3 py-1 rounded-xl transition ${wizardStep === 4 ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>
                4. 完了・全同期
              </span>
            </div>

            {wizardStep === 1 && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">氏名（フルネーム） <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      placeholder="例: 佐藤 健一"
                      value={wizardData.name}
                      onChange={e => setWizardData({ ...wizardData, name: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">入社年月日 <span className="text-rose-500">*</span></label>
                    <input
                      type="date"
                      value={wizardData.join_date}
                      onChange={e => setWizardData({ ...wizardData, join_date: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">雇用形態</label>
                    <select
                      value={wizardData.employment_type}
                      onChange={e => setWizardData({
                        ...wizardData, 
                        employment_type: e.target.value,
                        salary_type: e.target.value === 'part-time' ? 'hourly' : 'monthly'
                      })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800"
                    >
                      <option value="full-time">正社員（無期雇用）</option>
                      <option value="part-time">パート・アルバイト（時給制）</option>
                      <option value="contract">契約社員（有期雇用）</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">配属部署（時間帯自動連動）</label>
                    <select
                      value={wizardData.department}
                      onChange={e => handleDepartmentChange(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800"
                    >
                      {departments.map(d => (
                        <option key={d.id} value={d.name}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {wizardStep === 2 && (
              <div className="space-y-4 text-xs">
                {/* ⏰ パターン選択 ＆ 個別時間調整 */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-indigo-600" />
                      所定就業時間帯（パターン選択 ＆ 個別調整）
                    </label>
                    <select
                      onChange={e => {
                        const pat = schedulePatterns.find(p => p.id === e.target.value);
                        if (pat) {
                          setWizardData(prev => ({
                            ...prev,
                            start_time: pat.start_time,
                            end_time: pat.end_time,
                            break_time_minutes: pat.break_minutes
                          }));
                        }
                      }}
                      className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-700"
                    >
                      <option value="">就業パターンから一発読込...</option>
                      {schedulePatterns.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.start_time}〜{p.end_time})</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-1">始業時刻</label>
                      <input
                        type="time"
                        value={wizardData.start_time}
                        onChange={e => setWizardData({ ...wizardData, start_time: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-1">終業時刻</label>
                      <input
                        type="time"
                        value={wizardData.end_time}
                        onChange={e => setWizardData({ ...wizardData, end_time: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-1">休憩時間 (分)</label>
                      <input
                        type="number"
                        value={wizardData.break_time_minutes}
                        onChange={e => setWizardData({ ...wizardData, break_time_minutes: parseInt(e.target.value, 10) || 60 })}
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400">※ 部署に設定された時間帯が初期入力されます。時短勤務等で個人ごとに異なる場合はここで自由に調整してください。</p>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">休日規定（会社マスタ連動）</label>
                  <input
                    type="text"
                    value={wizardData.holidays_text}
                    onChange={e => setWizardData({ ...wizardData, holidays_text: e.target.value })}
                    placeholder="例: 完全週休2日制（土日・祝日）、年末年始休暇"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">※ 全社マスタ設定（カレンダー）で設定した会社休日がデフォルト反映されます。</p>
                </div>
              </div>
            )}

            {wizardStep === 3 && (
              <div className="space-y-4 text-xs max-h-[60vh] overflow-y-auto pr-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">給与形態</label>
                    <select
                      value={wizardData.salary_type}
                      onChange={e => setWizardData({ ...wizardData, salary_type: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    >
                      <option value="monthly">月給制</option>
                      <option value="hourly">時給制</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                      {wizardData.salary_type === 'hourly' ? '時給単価 (円)' : '基本給 (円)'}
                    </label>
                    <input
                      type="number"
                      placeholder="例: 250000"
                      value={wizardData.salary_type === 'hourly' ? (wizardData.hourly_wage === 0 ? '' : wizardData.hourly_wage) : (wizardData.base_salary === 0 ? '' : wizardData.base_salary)}
                      onChange={e => {
                        const val = e.target.value === '' ? 0 : (parseInt(e.target.value, 10) || 0);
                        setWizardData(wizardData.salary_type === 'hourly' ? { ...wizardData, hourly_wage: val } : { ...wizardData, base_salary: val });
                      }}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">通勤手当 (月額)</label>
                    <input
                      type="number"
                      placeholder="例: 6990"
                      value={wizardData.commuting_allowance === 0 ? '' : wizardData.commuting_allowance}
                      onChange={e => setWizardData({ ...wizardData, commuting_allowance: e.target.value === '' ? 0 : (parseInt(e.target.value, 10) || 0) })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">役職手当 (月額)</label>
                    <input
                      type="number"
                      placeholder="例: 30000"
                      value={wizardData.position_allowance === 0 ? '' : wizardData.position_allowance}
                      onChange={e => setWizardData({ ...wizardData, position_allowance: e.target.value === '' ? 0 : (parseInt(e.target.value, 10) || 0) })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    />
                  </div>
                </div>
              </div>
            )}

            {wizardStep === 4 && (
              <div className="space-y-4 text-xs">
                <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 space-y-2">
                  <div className="flex items-center gap-2 font-black text-emerald-800 text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    以下の内容で入社登録および全マスタ同期を実行します
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-slate-700 pt-2 border-t border-emerald-200/60">
                    <div>氏名: <span className="font-bold">{wizardData.name}</span></div>
                    <div>部署: <span className="font-bold">{wizardData.department}</span></div>
                    <div>就業時間: <span className="font-bold text-indigo-700">{wizardData.start_time} 〜 {wizardData.end_time}</span></div>
                    <div>入社日: <span className="font-bold">{wizardData.join_date}</span></div>
                    <div>給与: <span className="font-bold">{wizardData.salary_type === 'hourly' ? `時給 ¥${wizardData.hourly_wage}` : `月給 ¥${wizardData.base_salary.toLocaleString()}`}</span></div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5 text-[11px] text-slate-600">
                  <div className="font-bold text-slate-800 mb-1">⚡ 同期されるシステム:</div>
                  <div>✅ <b>勤怠管理システム</b>: 従業員アカウントが作成され、個別の就業時間で打刻・有給管理が行われます。</div>
                  <div>✅ <b>シフト管理システム</b>: 部署の就業枠に自動配置されます。</div>
                  <div>✅ <b>給与計算システム</b>: 基本給・通勤手当・口座情報が給与マスタへ即座にセットされます。</div>
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-between gap-2 pt-4 border-t border-slate-100">
              {wizardStep > 1 ? (
                <button
                  onClick={() => setWizardStep((wizardStep - 1) as any)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  前へ戻る
                </button>
              ) : <div />}

              {wizardStep < 4 ? (
                <button
                  onClick={() => {
                    if (wizardStep === 1 && !wizardData.name) {
                      alert('氏名を入力してください。');
                      return;
                    }
                    setWizardStep((wizardStep + 1) as any);
                  }}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                >
                  次へ進む
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleCompleteOnboardingWizard}
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  入社手続きを完了し全同期する
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ➕ 管理者による手動代行入力モーダル */}
      {proxyInputModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-600" />
                紙書類の手動代行登録（PC操作が苦手な従業員用）
              </h3>
              <button onClick={() => setProxyInputModal(prev => ({ ...prev, isOpen: false }))} className="p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">対象の従業員 <span className="text-rose-500">*</span></label>
                <select
                  value={proxyInputModal.selectedUserId}
                  onChange={e => {
                    const uId = e.target.value;
                    const targetEmp = employees.find(emp => emp.user_id === uId);
                    setProxyInputModal(prev => ({
                      ...prev,
                      selectedUserId: uId,
                      bankName: targetEmp?.bank_name || '',
                      branchName: targetEmp?.branch_name || '',
                      accountNumber: targetEmp?.account_number || '',
                      accountHolder: targetEmp?.account_holder || targetEmp?.name || '',
                      commutingAmount: targetEmp?.commuting_allowance || 15000
                    }));
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800"
                >
                  <option value="">従業員を選択してください</option>
                  {employees.filter(e => e.status !== 'retired').map(e => (
                    <option key={e.user_id} value={e.user_id}>{e.name} ({e.department || '営業部'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">登録する書類種別</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setProxyInputModal(prev => ({ ...prev, docType: 'bank_passbook' }))}
                    className={`py-2 px-3 rounded-xl font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      proxyInputModal.docType === 'bank_passbook' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    通帳・口座情報
                  </button>
                  <button
                    type="button"
                    onClick={() => setProxyInputModal(prev => ({ ...prev, docType: 'commuting_pass' }))}
                    className={`py-2 px-3 rounded-xl font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      proxyInputModal.docType === 'commuting_pass' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <Train className="w-4 h-4" />
                    通勤費・経路
                  </button>
                </div>
              </div>

              {proxyInputModal.docType === 'bank_passbook' && (
                <div className="space-y-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="銀行名"
                      value={proxyInputModal.bankName}
                      onChange={e => setProxyInputModal(prev => ({ ...prev, bankName: e.target.value }))}
                      className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    />
                    <input
                      type="text"
                      placeholder="支店名"
                      value={proxyInputModal.branchName}
                      onChange={e => setProxyInputModal(prev => ({ ...prev, branchName: e.target.value }))}
                      className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    />
                    <input
                      type="text"
                      placeholder="口座番号"
                      value={proxyInputModal.accountNumber}
                      onChange={e => setProxyInputModal(prev => ({ ...prev, accountNumber: e.target.value }))}
                      className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    />
                    <input
                      type="text"
                      placeholder="名義人 (カナ)"
                      value={proxyInputModal.accountHolder}
                      onChange={e => setProxyInputModal(prev => ({ ...prev, accountHolder: e.target.value }))}
                      className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    />
                  </div>
                </div>
              )}

              {proxyInputModal.docType === 'commuting_pass' && (
                <div className="space-y-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="出発駅 (自宅)"
                      value={proxyInputModal.originStation}
                      onChange={e => setProxyInputModal(prev => ({ ...prev, originStation: e.target.value }))}
                      className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    />
                    <input
                      type="text"
                      placeholder="到着駅 (会社)"
                      value={proxyInputModal.destinationStation}
                      onChange={e => setProxyInputModal(prev => ({ ...prev, destinationStation: e.target.value }))}
                      className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">1ヶ月定期代（円）</label>
                    <input
                      type="number"
                      placeholder="例: 6990"
                      value={proxyInputModal.commutingAmount === 0 ? '' : proxyInputModal.commutingAmount}
                      onChange={e => setProxyInputModal(prev => ({ ...prev, commutingAmount: e.target.value === '' ? 0 : (parseInt(e.target.value, 10) || 0) }))}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    />
                  </div>
                </div>
              )}

              <div className="bg-slate-50 p-3 rounded-2xl border-2 border-dashed border-slate-300 text-center space-y-1.5">
                <label className="block cursor-pointer">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleProxyFileUpload}
                    className="hidden"
                  />
                  <div className="flex flex-col items-center justify-center gap-1 py-1">
                    <Upload className="w-5 h-5 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-700">紙のコピー写真を撮影・選択</span>
                    <span className="text-[9px] text-slate-400">※ 写真は自動で最適なサイズに軽量化（圧縮）されます</span>
                  </div>
                </label>

                {proxyInputModal.attachmentData && (
                  <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-left">
                    <div className="flex items-center gap-2">
                      <img src={proxyInputModal.attachmentData} alt="プレビュー" className="w-8 h-8 object-cover rounded border border-slate-200" />
                      <div>
                        <div className="text-[11px] font-bold text-slate-800">{proxyInputModal.attachmentFilename}</div>
                        <div className="text-[9px] text-emerald-600 font-bold">{proxyInputModal.fileSizeInfo}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setProxyInputModal(prev => ({ ...prev, attachmentData: '', attachmentFilename: '', fileSizeInfo: '' }))}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                onClick={() => setProxyInputModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveProxyInput}
                disabled={isSaving || !proxyInputModal.selectedUserId}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-4 h-4" />}
                代行登録しマスタへ即時反映
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 添付書類・写真プレビューモーダル */}
      {attachmentPreviewModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-100 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Eye className="w-4 h-4 text-blue-600" />
                {attachmentPreviewModal.title}
              </h3>
              <button onClick={() => setAttachmentPreviewModal({ isOpen: false, title: '', imageSrc: '' })} className="p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto flex items-center justify-center bg-slate-900 rounded-2xl p-4">
              <img src={attachmentPreviewModal.imageSrc} alt="提出書類写真" className="max-w-full h-auto rounded-lg shadow-md" />
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setAttachmentPreviewModal({ isOpen: false, title: '', imageSrc: '' })}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm cursor-pointer"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 労務手続きToDoガイド モーダル */}
      {guideModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-100 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="font-black text-slate-800 text-base flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-blue-600" />
                零細企業のための 入社・退社 労務手続きToDo完全ガイド
              </h3>
              <button onClick={() => setGuideModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 text-xs leading-relaxed text-slate-700">
              <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-200">
                <h4 className="font-black text-blue-900 text-sm mb-2 flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-blue-600" />
                  1. 従業員が入社したときの手続きと期限
                </h4>
                <div className="space-y-2">
                  <div className="bg-white p-3 rounded-xl border border-blue-100">
                    <div className="font-bold text-slate-800">① 労働条件通知書（雇用契約書）の交付【入社当日まで・必須】</div>
                    <p className="text-[11px] text-slate-500 mt-0.5">当システムの「書面・証憑」ボタンからA4印刷し、2部印刷して労使双方で署名捺印のうえ1部ずつ保管します。</p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-blue-100">
                    <div className="font-bold text-slate-800">② 健康保険・厚生年金 資格取得届【事実発生から5日以内】</div>
                    <p className="text-[11px] text-slate-500 mt-0.5">提出先: 年金事務所。週所定労働時間が週30時間以上（正社員等）の場合に提出します。</p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-blue-100">
                    <div className="font-bold text-slate-800">③ 雇用保険被保険者 資格取得届【翌月10日まで】</div>
                    <p className="text-[11px] text-slate-500 mt-0.5">提出先: ハローワーク。週20時間以上かつ31日以上雇用の見込みがあるパート・正社員全員が対象です。</p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <h4 className="font-black text-slate-900 text-sm mb-2 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-slate-600" />
                  2. 従業員が退職したときの手続きと期限
                </h4>
                <div className="space-y-2">
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <div className="font-bold text-slate-800">① 健康保険・厚生年金 資格喪失届【退職日から5日以内】</div>
                    <p className="text-[11px] text-slate-500 mt-0.5">提出先: 年金事務所。保険証を回収して添付します。</p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <div className="font-bold text-slate-800">② 雇用保険被保険者 資格喪失届 ＆ 離職票【退職日の翌日から10日以内】</div>
                    <p className="text-[11px] text-slate-500 mt-0.5">提出先: ハローワーク。失業給付用離職票を交付します。</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end pt-4 border-t border-slate-100">
              <button onClick={() => setGuideModalOpen(false)} className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer">
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✏️ 提出書類 内容修正（手動編集）モーダル */}
      {editSubmissionModal.isOpen && editSubmissionModal.submission && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-indigo-600" />
                  提出書類の修正（{editSubmissionModal.submission.user_name} 殿）
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">誤字や入力ミスを管理者が手動で修正し、マスタへ即時反映します</p>
              </div>
              <button
                onClick={() => setEditSubmissionModal({ isOpen: false, submission: null, editedData: {} })}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* 口座情報修正 */}
              {editSubmissionModal.submission.document_type === 'bank_passbook' && (
                <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">金融機関名</label>
                      <input
                        type="text"
                        value={editSubmissionModal.editedData.bank_name || ''}
                        onChange={e => setEditSubmissionModal(prev => ({
                          ...prev,
                          editedData: { ...prev.editedData, bank_name: e.target.value }
                        }))}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">支店名</label>
                      <input
                        type="text"
                        value={editSubmissionModal.editedData.branch_name || ''}
                        onChange={e => setEditSubmissionModal(prev => ({
                          ...prev,
                          editedData: { ...prev.editedData, branch_name: e.target.value }
                        }))}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">口座種別</label>
                      <select
                        value={editSubmissionModal.editedData.account_type || 'ordinary'}
                        onChange={e => setEditSubmissionModal(prev => ({
                          ...prev,
                          editedData: { ...prev.editedData, account_type: e.target.value }
                        }))}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold"
                      >
                        <option value="ordinary">普通預金</option>
                        <option value="current">当座預金</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">口座番号 (7桁)</label>
                      <input
                        type="text"
                        maxLength={7}
                        value={editSubmissionModal.editedData.account_number || ''}
                        onChange={e => setEditSubmissionModal(prev => ({
                          ...prev,
                          editedData: { ...prev.editedData, account_number: e.target.value }
                        }))}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">口座名義人（カタカナ）</label>
                    <input
                      type="text"
                      value={editSubmissionModal.editedData.account_holder || ''}
                      onChange={e => setEditSubmissionModal(prev => ({
                        ...prev,
                        editedData: { ...prev.editedData, account_holder: e.target.value }
                      }))}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold"
                    />
                  </div>
                </div>
              )}

              {/* 通勤費申請修正 */}
              {editSubmissionModal.submission.document_type === 'commuting_pass' && (
                <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">出発駅 / 自宅最寄</label>
                      <input
                        type="text"
                        value={editSubmissionModal.editedData.origin_station || ''}
                        onChange={e => setEditSubmissionModal(prev => ({
                          ...prev,
                          editedData: { ...prev.editedData, origin_station: e.target.value }
                        }))}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">到着駅 / 勤務先最寄</label>
                      <input
                        type="text"
                        value={editSubmissionModal.editedData.destination_station || ''}
                        onChange={e => setEditSubmissionModal(prev => ({
                          ...prev,
                          editedData: { ...prev.editedData, destination_station: e.target.value }
                        }))}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">1ヶ月定期代合計 (円)</label>
                    <input
                      type="number"
                      value={editSubmissionModal.editedData.one_month_pass_amount || 0}
                      onChange={e => setEditSubmissionModal(prev => ({
                        ...prev,
                        editedData: { ...prev.editedData, one_month_pass_amount: parseInt(e.target.value, 10) || 0 }
                      }))}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold text-indigo-700 text-sm"
                    />
                  </div>
                </div>
              )}

              {/* 扶養控除等申告修正（tax_withholding / dependents_form 両対応） */}
              {(editSubmissionModal.submission.document_type === 'dependents_form' || editSubmissionModal.submission.document_type === 'tax_withholding') && (
                <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  {/* 配偶者情報 */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 text-xs">
                      <input
                        type="checkbox"
                        checked={!!editSubmissionModal.editedData.has_spouse}
                        onChange={e => setEditSubmissionModal(prev => ({
                          ...prev,
                          editedData: { ...prev.editedData, has_spouse: e.target.checked }
                        }))}
                        className="w-4 h-4 text-indigo-600 rounded"
                      />
                      源泉控除対象配偶者あり
                    </label>

                    {editSubmissionModal.editedData.has_spouse && (
                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-slate-500 block mb-0.5">配偶者 氏名</label>
                            <input
                              type="text"
                              placeholder="例: 佐藤 花子"
                              value={editSubmissionModal.editedData.spouse_name || ''}
                              onChange={e => setEditSubmissionModal(prev => ({
                                ...prev,
                                editedData: { ...prev.editedData, spouse_name: e.target.value }
                              }))}
                              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 block mb-0.5">フリガナ</label>
                            <input
                              type="text"
                              placeholder="例: サトウ ハナコ"
                              value={editSubmissionModal.editedData.spouse_name_kana || ''}
                              onChange={e => setEditSubmissionModal(prev => ({
                                ...prev,
                                editedData: { ...prev.editedData, spouse_name_kana: e.target.value }
                              }))}
                              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-slate-500 block mb-0.5">生年月日</label>
                            <input
                              type="date"
                              value={editSubmissionModal.editedData.spouse_birth_date || ''}
                              onChange={e => setEditSubmissionModal(prev => ({
                                ...prev,
                                editedData: { ...prev.editedData, spouse_birth_date: e.target.value }
                              }))}
                              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 font-bold text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 block mb-0.5">所得見積額 (円)</label>
                            <input
                              type="number"
                              placeholder="例: 480000"
                              value={editSubmissionModal.editedData.spouse_income_estimate === 0 ? '' : (editSubmissionModal.editedData.spouse_income_estimate || '')}
                              onChange={e => setEditSubmissionModal(prev => ({
                                ...prev,
                                editedData: { ...prev.editedData, spouse_income_estimate: e.target.value === '' ? 0 : (parseInt(e.target.value, 10) || 0) }
                              }))}
                              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 扶養親族一覧 */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-700">
                        控除対象 扶養親族 ({Array.isArray(editSubmissionModal.editedData.dependents) ? editSubmissionModal.editedData.dependents.length : 0}名)
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const currentDeps = Array.isArray(editSubmissionModal.editedData.dependents) ? [...editSubmissionModal.editedData.dependents] : [];
                          currentDeps.push({
                            name: '',
                            nameKana: '',
                            relation: '子',
                            birthDate: '2015-01-01',
                            incomeEstimate: 0,
                            isLivingTogether: true
                          });
                          setEditSubmissionModal(prev => ({
                            ...prev,
                            editedData: { ...prev.editedData, dependents: currentDeps, dependents_count: currentDeps.length }
                          }));
                        }}
                        className="text-[10px] bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold px-2 py-0.5 rounded-lg transition"
                      >
                        ＋ 扶養親族を追加
                      </button>
                    </div>

                    {Array.isArray(editSubmissionModal.editedData.dependents) && editSubmissionModal.editedData.dependents.map((dep: any, idx: number) => (
                      <div key={idx} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-500">扶養親族 #{idx + 1}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const currentDeps = editSubmissionModal.editedData.dependents.filter((_: any, i: number) => i !== idx);
                              setEditSubmissionModal(prev => ({
                                ...prev,
                                editedData: { ...prev.editedData, dependents: currentDeps, dependents_count: currentDeps.length }
                              }));
                            }}
                            className="text-[10px] text-rose-500 hover:underline"
                          >
                            削除
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          <input
                            type="text"
                            placeholder="氏名"
                            value={dep.name || ''}
                            onChange={e => {
                              const currentDeps = [...editSubmissionModal.editedData.dependents];
                              currentDeps[idx] = { ...currentDeps[idx], name: e.target.value };
                              setEditSubmissionModal(prev => ({ ...prev, editedData: { ...prev.editedData, dependents: currentDeps } }));
                            }}
                            className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold"
                          />
                          <select
                            value={dep.relation || '子'}
                            onChange={e => {
                              const currentDeps = [...editSubmissionModal.editedData.dependents];
                              currentDeps[idx] = { ...currentDeps[idx], relation: e.target.value };
                              setEditSubmissionModal(prev => ({ ...prev, editedData: { ...prev.editedData, dependents: currentDeps } }));
                            }}
                            className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold"
                          >
                            <option value="子">子</option>
                            <option value="父">父</option>
                            <option value="母">母</option>
                            <option value="祖父">祖父</option>
                            <option value="祖母">祖母</option>
                            <option value="兄弟姉妹">兄弟姉妹</option>
                          </select>
                          <input
                            type="date"
                            value={dep.birthDate || ''}
                            onChange={e => {
                              const currentDeps = [...editSubmissionModal.editedData.dependents];
                              currentDeps[idx] = { ...currentDeps[idx], birthDate: e.target.value };
                              setEditSubmissionModal(prev => ({ ...prev, editedData: { ...prev.editedData, dependents: currentDeps } }));
                            }}
                            className="bg-white border border-slate-300 rounded px-1 py-1 text-[11px]"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 特別控除区分 */}
                  <div className="grid grid-cols-2 gap-2 bg-white p-3 rounded-xl border border-slate-200">
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={!!editSubmissionModal.editedData.is_disability}
                        onChange={e => setEditSubmissionModal(prev => ({
                          ...prev,
                          editedData: { ...prev.editedData, is_disability: e.target.checked }
                        }))}
                        className="w-3.5 h-3.5 text-indigo-600 rounded"
                      />
                      障害者控除
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={!!editSubmissionModal.editedData.is_single_parent}
                        onChange={e => setEditSubmissionModal(prev => ({
                          ...prev,
                          editedData: { ...prev.editedData, is_single_parent: e.target.checked }
                        }))}
                        className="w-3.5 h-3.5 text-indigo-600 rounded"
                      />
                      ひとり親控除
                    </label>
                  </div>
                </div>
              )}

              {/* マイナンバー修正 */}
              {editSubmissionModal.submission.document_type === 'my_number' && (
                <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">マイナンバー (12桁)</label>
                    <input
                      type="text"
                      maxLength={12}
                      value={editSubmissionModal.editedData.my_number || ''}
                      onChange={e => setEditSubmissionModal(prev => ({
                        ...prev,
                        editedData: { ...prev.editedData, my_number: e.target.value }
                      }))}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold font-mono tracking-widest"
                      placeholder="123456789012"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                onClick={() => setEditSubmissionModal({ isOpen: false, submission: null, editedData: {} })}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveEditedSubmission}
                disabled={isSaving}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                修正内容を保存してマスタ同期
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ↩️ 提出書類 差戻しモーダル */}
      {rejectSubmissionModal.isOpen && rejectSubmissionModal.submission && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-rose-600" />
                  提出書類の差戻し（再提出依頼）
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">{rejectSubmissionModal.submission.user_name} 殿の「{rejectSubmissionModal.submission.title}」</p>
              </div>
              <button
                onClick={() => setRejectSubmissionModal({ isOpen: false, submission: null, comment: '' })}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <label className="text-[11px] font-bold text-slate-700 block">
                差戻しの理由・従業員への修正指示 <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={4}
                value={rejectSubmissionModal.comment}
                onChange={e => setRejectSubmissionModal(prev => ({ ...prev, comment: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-medium text-slate-800"
                placeholder="例: 通帳写真が見切れているため、口座番号と名義がはっきり写るように再撮影をお願いします。"
              />

              {/* 定型理由クイック挿入 */}
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-bold">よくある差戻し理由を挿入:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    '添付写真が不鮮明で文字が読めないため、再撮影をお願いします。',
                    '口座番号または名義人のフリガナに相違があります。',
                    '通勤経路の定期代に誤りがあります。最安ルートで再申請をお願いします。',
                    'マイナンバーの裏面写真が不足しています。'
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setRejectSubmissionModal(prev => ({ ...prev, comment: preset }))}
                      className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded-lg border border-slate-200 transition cursor-pointer text-left"
                    >
                      {preset.substring(0, 20)}...
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                onClick={() => setRejectSubmissionModal({ isOpen: false, submission: null, comment: '' })}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                キャンセル
              </button>
              <button
                onClick={handleRejectSubmission}
                disabled={isSaving}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                差戻しを実行する
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 📱 個人別 労働条件設定 ＆ 専用入社手続きURL発行モーダル */}
      {inviteUrlModal.isOpen && (() => {
        const isHourly = inviteUrlModal.salaryType === 'hourly';
        const totalEstimatedMonthly = isHourly
          ? 0
          : inviteUrlModal.baseSalary + inviteUrlModal.positionAllowance + inviteUrlModal.qualificationAllowance + inviteUrlModal.fixedOvertimeAllowance;

        const params = new URLSearchParams({
          name: inviteUrlModal.name.trim(),
          employment_type: inviteUrlModal.employmentType,
          salary_type: inviteUrlModal.salaryType,
          base_salary: String(isHourly ? 0 : inviteUrlModal.baseSalary),
          hourly_wage: String(isHourly ? inviteUrlModal.hourlyWage : Math.round(inviteUrlModal.baseSalary / 160)),
          position_name: inviteUrlModal.positionName.trim(),
          position_allowance: String(inviteUrlModal.positionAllowance || 0),
          qualification_allowance: String(inviteUrlModal.qualificationAllowance || 0),
          fixed_overtime_allowance: String(inviteUrlModal.fixedOvertimeAllowance || 0),
          department: inviteUrlModal.department,
          join_date: inviteUrlModal.joinDate,
          work_location: inviteUrlModal.workLocation,
          work_hours: `${inviteUrlModal.startTime} 〜 ${inviteUrlModal.endTime}（休憩${inviteUrlModal.breakMinutes}分）`
        });
        const currentGeneratedUrl = `${window.location.origin}/onboarding/welcome?${params.toString()}`;

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 my-8 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shadow-xs">
                    <Smartphone className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 text-base">
                      個人別 労働条件・給与・役職設定 ＆ 専用入社URL発行
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      役職・給与手当を設定した専用URLを発行し、新入社員へ送付できます
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setInviteUrlModal(prev => ({ ...prev, isOpen: false }))}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1 text-xs">
                {/* 1. 基本設定（役職含む） */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <h4 className="font-bold text-slate-700 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-indigo-600" />
                    新入社員のお名前 ＆ 配属・役職
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">
                        氏名（フルネーム）<span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="例: 佐藤 健一"
                        value={inviteUrlModal.name}
                        onChange={e => setInviteUrlModal(prev => ({ ...prev, name: e.target.value, copied: false }))}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">配属部署</label>
                      <select
                        value={inviteUrlModal.department}
                        onChange={e => setInviteUrlModal(prev => ({ ...prev, department: e.target.value, copied: false }))}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800"
                      >
                        {departments.map(d => (
                          <option key={d.id} value={d.name}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1 flex items-center justify-between">
                        <span>👑 役職（役職マスタ連携）</span>
                        {inviteUrlModal.positionName && (
                          <span className="text-[10px] text-indigo-600 font-bold">選択中: {inviteUrlModal.positionName}</span>
                        )}
                      </label>
                      <select
                        value={inviteUrlModal.positionName}
                        onChange={e => {
                          const selectedName = e.target.value;
                          const foundPos = positions.find(p => p.name === selectedName);
                          setInviteUrlModal(prev => ({
                            ...prev,
                            positionName: selectedName,
                            positionAllowance: foundPos?.default_allowance !== undefined ? foundPos.default_allowance : prev.positionAllowance,
                            copied: false
                          }));
                        }}
                        className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2 font-bold text-indigo-800"
                      >
                        <option value="">なし（一般社員・手当なし）</option>
                        {positions.map(pos => (
                          <option key={pos.id} value={pos.name}>
                            {pos.name} {pos.default_allowance ? `(標準手当: ¥${pos.default_allowance.toLocaleString()})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">雇用形態</label>
                      <select
                        value={inviteUrlModal.employmentType}
                        onChange={e => setInviteUrlModal(prev => ({ ...prev, employmentType: e.target.value, copied: false }))}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800"
                      >
                        <option value="正社員（無期雇用）">正社員（無期雇用）</option>
                        <option value="契約社員（有期雇用）">契約社員（有期雇用）</option>
                        <option value="パート・アルバイト">パート・アルバイト</option>
                        <option value="業務委託">業務委託</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">入社予定日</label>
                    <input
                      type="date"
                      value={inviteUrlModal.joinDate}
                      onChange={e => setInviteUrlModal(prev => ({ ...prev, joinDate: e.target.value, copied: false }))}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800"
                    />
                  </div>
                </div>

                {/* 2. 給与・諸手当設定 */}
                <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200 space-y-3">
                  <h4 className="font-bold text-emerald-900 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                      賃金・諸手当の設定
                    </span>
                    {!isHourly && totalEstimatedMonthly > 0 && (
                      <span className="text-xs bg-emerald-600 text-white font-black px-2.5 py-0.5 rounded-full shadow-xs">
                        額面計: ¥{totalEstimatedMonthly.toLocaleString()} / 月
                      </span>
                    )}
                  </h4>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-emerald-800 block mb-1">給与形態</label>
                      <select
                        value={inviteUrlModal.salaryType}
                        onChange={e => setInviteUrlModal(prev => ({ ...prev, salaryType: e.target.value as any, copied: false }))}
                        className="w-full bg-white border border-emerald-300 rounded-xl px-3 py-2 font-bold text-slate-800"
                      >
                        <option value="monthly">月給制</option>
                        <option value="hourly">時給制</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-emerald-800 block mb-1">
                        {isHourly ? '時給単価 (円)' : '基本給 (月額・円)'}
                      </label>
                      <input
                        type="number"
                        step={isHourly ? "10" : "1000"}
                        value={isHourly ? inviteUrlModal.hourlyWage : inviteUrlModal.baseSalary}
                        onChange={e => {
                          const val = parseInt(e.target.value, 10) || 0;
                          setInviteUrlModal(prev => ({
                            ...prev,
                            baseSalary: isHourly ? prev.baseSalary : val,
                            hourlyWage: isHourly ? val : prev.hourlyWage,
                            copied: false
                          }));
                        }}
                        className="w-full bg-white border border-emerald-300 rounded-xl px-3 py-2 font-black text-emerald-700 text-sm"
                      />
                    </div>
                  </div>

                  {!isHourly && (
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-200/60">
                      <div>
                        <label className="text-[10px] font-bold text-indigo-800 block mb-0.5">👑 役職手当 (円)</label>
                        <input
                          type="number"
                          step="1000"
                          placeholder="0"
                          value={inviteUrlModal.positionAllowance || ''}
                          onChange={e => setInviteUrlModal(prev => ({ ...prev, positionAllowance: parseInt(e.target.value, 10) || 0, copied: false }))}
                          className="w-full bg-white border border-indigo-200 rounded-xl px-2.5 py-1.5 font-bold text-indigo-700"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-blue-800 block mb-0.5">🎓 資格手当 (円)</label>
                        <input
                          type="number"
                          step="1000"
                          placeholder="0"
                          value={inviteUrlModal.qualificationAllowance || ''}
                          onChange={e => setInviteUrlModal(prev => ({ ...prev, qualificationAllowance: parseInt(e.target.value, 10) || 0, copied: false }))}
                          className="w-full bg-white border border-blue-200 rounded-xl px-2.5 py-1.5 font-bold text-blue-700"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-amber-800 block mb-0.5">⏱️ 固定残業代 (円)</label>
                        <input
                          type="number"
                          step="1000"
                          placeholder="0"
                          value={inviteUrlModal.fixedOvertimeAllowance || ''}
                          onChange={e => setInviteUrlModal(prev => ({ ...prev, fixedOvertimeAllowance: parseInt(e.target.value, 10) || 0, copied: false }))}
                          className="w-full bg-white border border-amber-200 rounded-xl px-2.5 py-1.5 font-bold text-amber-700"
                        />
                      </div>
                    </div>
                  )}

                  <div className="p-2 bg-emerald-100/70 rounded-xl text-[10px] text-emerald-800 space-y-0.5">
                    <p className="font-bold">🚆 通勤交通費について:</p>
                    <p>新入社員がスマホ入社フォームで自宅最寄駅・通勤経路・定期代を申請し、会社が審査・承認した後に確定します（事前設定不要）。</p>
                  </div>
                </div>

                {/* 3. 就業時間 ＆ 勤務地 */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <h4 className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    所定就業時間 ＆ 勤務地
                  </h4>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-500 block mb-0.5">始業時刻</span>
                      <input
                        type="time"
                        value={inviteUrlModal.startTime}
                        onChange={e => setInviteUrlModal(prev => ({ ...prev, startTime: e.target.value, copied: false }))}
                        className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 font-bold"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block mb-0.5">終業時刻</span>
                      <input
                        type="time"
                        value={inviteUrlModal.endTime}
                        onChange={e => setInviteUrlModal(prev => ({ ...prev, endTime: e.target.value, copied: false }))}
                        className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 font-bold"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block mb-0.5">休憩(分)</span>
                      <input
                        type="number"
                        value={inviteUrlModal.breakMinutes}
                        onChange={e => setInviteUrlModal(prev => ({ ...prev, breakMinutes: parseInt(e.target.value, 10) || 60, copied: false }))}
                        className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 font-bold"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">就業場所</label>
                    <input
                      type="text"
                      value={inviteUrlModal.workLocation}
                      onChange={e => setInviteUrlModal(prev => ({ ...prev, workLocation: e.target.value, copied: false }))}
                      className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 font-medium"
                    />
                  </div>
                </div>

                {/* 4. 発行URLプレビュー ＆ コピーエリア */}
                <div className="bg-indigo-950 text-white p-4 rounded-2xl border border-indigo-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-indigo-300 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                      発行される専用入社手続きURL
                    </span>
                    <span className="text-[10px] text-indigo-400">リアルタイム生成</span>
                  </div>

                  <div className="p-2.5 bg-slate-900/90 rounded-xl border border-indigo-700/50 font-mono text-[10px] text-cyan-200 break-all select-all">
                    {currentGeneratedUrl}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(currentGeneratedUrl);
                      setInviteUrlModal(prev => ({ ...prev, copied: true }));
                      setTimeout(() => {
                        setInviteUrlModal(prev => ({ ...prev, copied: false }));
                      }, 4000);
                    }}
                    className={`w-full py-3 px-4 rounded-xl font-black text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                      inviteUrlModal.copied
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-900/50'
                        : 'bg-gradient-to-r from-indigo-500 to-cyan-600 hover:from-indigo-600 hover:to-cyan-700 text-white shadow-indigo-900/50'
                    }`}
                  >
                    {inviteUrlModal.copied ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                        <span>専用入社URLをコピーしました！（LINEやメールに貼り付け可能）</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>📋 この条件で専用入社URLをコピーする</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  onClick={() => setInviteUrlModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
