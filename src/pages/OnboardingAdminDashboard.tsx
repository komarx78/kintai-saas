import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import AppSwitcher from '../components/AppSwitcher';
import { OfficialLaborContractDoc } from '../components/OfficialLaborContractDoc';
import { OfficialCommutingPassDoc } from '../components/OfficialCommutingPassDoc';
import { OfficialBankPassbookDoc } from '../components/OfficialBankPassbookDoc';
import { OfficialTaxExemptionDoc } from '../components/OfficialTaxExemptionDoc';
import { compressImageFile } from '../lib/imageCompressor';
import { 
  UserPlus, Users, FileText, CheckCircle2, 
  Printer, ArrowLeft, LogOut, Loader2, X, ChevronRight, 
  HelpCircle, Building2, Check, UserCheck, Edit3, UserMinus, 
  RotateCcw, Save, Inbox, Upload, Trash2, Eye, CreditCard, Train,
  FolderOpen, Settings, Clock, Smartphone
} from 'lucide-react';

interface EmployeeOnboardingData {
  user_id: string;
  name: string;
  email?: string;
  role: string;
  status: 'onboarding' | 'active' | 'offboarding' | 'retired';
  join_date: string;
  retirement_date?: string;
  retirement_reason?: string;
  employment_type: 'full-time' | 'part-time' | 'contract';
  department?: string;
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
}

interface DepartmentMaster {
  id: string;
  name: string;
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
  const [employees, setEmployees] = useState<EmployeeOnboardingData[]>([]);
  const [submissions, setSubmissions] = useState<DocumentSubmission[]>([]);
  const [departments, setDepartments] = useState<DepartmentMaster[]>([]);
  const [schedulePatterns, setSchedulePatterns] = useState<WorkSchedulePattern[]>([]);
  
  const [currentView, setCurrentView] = useState<'employees' | 'submissions'>('employees');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'onboarding' | 'retired'>('all');
  const [submissionFilter, setSubmissionFilter] = useState<'all' | 'pending' | 'approved'>('pending');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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
    activeDoc: 'contract' | 'commuting' | 'bank' | 'tax' | 'identity';
  }>({
    isOpen: false,
    employee: null,
    activeDoc: 'contract'
  });

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

      // 部署マスタ取得
      const { data: deptData } = await supabase
        .from('department_masters')
        .select('*')
        .eq('tenant_id', tenantIdData)
        .order('display_order', { ascending: true });
      setDepartments(deptData || []);

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

        return {
          user_id: u.id,
          name: u.name || '従業員',
          email: u.email,
          role: u.role,
          status: onb?.status || (u.is_active === false ? 'retired' : 'active'),
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
          salary_type: pay?.salary_type || onb?.salary_type || (u.employment_type === 'part-time' ? 'hourly' : 'monthly'),
          base_salary: pay?.base_salary || onb?.base_salary || 250000,
          hourly_wage: pay?.hourly_wage || onb?.hourly_wage || 1150,
          position_allowance: pay?.position_allowance || 0,
          qualification_allowance: pay?.qualification_allowance || 0,
          housing_allowance: pay?.housing_allowance || 0,
          family_allowance: pay?.family_allowance || 0,
          commuting_allowance: pay?.commuting_allowance || 15000,
          health_insurance_joined: pay?.health_insurance_enabled ?? true,
          pension_insurance_joined: pay?.pension_insurance_enabled ?? true,
          employment_insurance_joined: pay?.employment_insurance_enabled ?? true,
          bank_name: pay?.bank_name || '',
          branch_name: pay?.branch_name || '',
          account_type: pay?.account_type || 'ordinary',
          account_number: pay?.account_number || '',
          account_holder: pay?.account_holder || '',
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
        user_name: userMap.get(s.user_id) || '従業員'
      }));

      setSubmissions(formattedSubmissions);
    } catch (e) {
      console.error('Fetch onboarding error:', e);
    } finally {
      setLoading(false);
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
          .upsert({
            tenant_id: tenantId,
            user_id: uId,
            bank_name: proxyInputModal.bankName,
            branch_name: proxyInputModal.branchName,
            account_type: proxyInputModal.accountType,
            account_number: proxyInputModal.accountNumber,
            account_holder: proxyInputModal.accountHolder
          }, { onConflict: 'tenant_id,user_id' });

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
        await supabase
          .from('employee_payroll_profiles')
          .upsert({
            tenant_id: tenantId,
            user_id: uId,
            commuting_allowance: proxyInputModal.commutingAmount
          }, { onConflict: 'tenant_id,user_id' });

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

      if (sub.document_type === 'bank_passbook') {
        const d = sub.data;
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
      } else if (sub.document_type === 'commuting_pass') {
        const d = sub.data;
        const amount = d.one_month_pass_amount || 0;
        await supabase
          .from('employee_payroll_profiles')
          .upsert({
            tenant_id: tenantId,
            user_id: uId,
            commuting_allowance: amount
          }, { onConflict: 'tenant_id,user_id' });
      } else if (sub.document_type === 'dependents_form') {
        const d = sub.data;
        await supabase
          .from('employee_payroll_profiles')
          .upsert({
            tenant_id: tenantId,
            user_id: uId,
            dependents_count: d.dependents_count || 0
          }, { onConflict: 'tenant_id,user_id' });
      }

      await supabase
        .from('employee_document_submissions')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString()
        })
        .eq('id', sub.id);

      alert(`✅ 「${sub.title}」を承認しました！\n給与計算マスタおよび労務台帳に即座に反映されました。`);
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
      await supabase
        .from('users')
        .update({
          name: data.name,
          department: data.department,
          employment_type: data.employment_type,
          join_date: data.join_date
        })
        .eq('id', data.user_id);

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
          employment_insurance_enabled: data.employment_insurance_joined,
          bank_name: data.bank_name,
          branch_name: data.branch_name,
          account_type: data.account_type,
          account_number: data.account_number,
          account_holder: data.account_holder
        }, { onConflict: 'tenant_id,user_id' });

      await supabase
        .from('shift_employee_settings')
        .upsert({
          tenant_id: tenantId,
          user_id: data.user_id,
          hire_date: data.join_date,
          base_wage: data.salary_type === 'hourly' ? data.hourly_wage : 1150
        }, { onConflict: 'user_id' });

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

      alert('✨ 従業員・労務情報の修正を保存しました！\n勤怠・シフト・給与・雇用契約書に個人別就業時間が即座に反映されました。');
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
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        
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
                const url = `${window.location.origin}/onboarding/welcome`;
                navigator.clipboard.writeText(url);
                alert(`📱 新入社員向け【スマホ入社手続きフォームURL】をコピーしました！\nLINEやメールで新入社員に共有してください。\n\nURL: ${url}`);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              title="新入社員に送るスマホ手続きURLをコピー"
            >
              <Smartphone className="w-4 h-4" />
              スマホ入社手続きURLをコピー
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
                <table className="w-full text-left border-collapse min-w-[980px]">
                  <thead>
                    <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                      <th className="py-3 px-4">氏名 / 所属</th>
                      <th className="py-3 px-3">雇用形態 / 就業時間</th>
                      <th className="py-3 px-3">入社日 / 退職日</th>
                      <th className="py-3 px-3">給与設定</th>
                      <th className="py-3 px-3">口座・通勤費</th>
                      <th className="py-3 px-3 text-center">労務書面証憑</th>
                      <th className="py-3 px-4 text-center">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredEmployees.map(emp => {
                      const isHourly = emp.salary_type === 'hourly' || emp.employment_type === 'part-time';
                      const isRetired = emp.status === 'retired';

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
                                <div className="text-[10px] text-slate-400">{emp.department || '営業部'}</div>
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

                          <td className="py-3.5 px-3 font-medium text-slate-700">
                            <div>{emp.join_date}</div>
                            {emp.retirement_date && (
                              <div className="text-[10px] text-rose-500 font-bold">退: {emp.retirement_date}</div>
                            )}
                          </td>

                          <td className="py-3.5 px-3 font-bold text-slate-800">
                            {isHourly ? (
                              <span>時給 ¥{emp.hourly_wage?.toLocaleString()}</span>
                            ) : (
                              <span>月給 ¥{emp.base_salary?.toLocaleString()}</span>
                            )}
                          </td>

                          <td className="py-3.5 px-3 text-slate-600 text-[11px]">
                            <div>口座: {emp.bank_name ? `${emp.bank_name}` : <span className="text-slate-400">未登録</span>}</div>
                            <div className="text-blue-600 font-bold text-[10px]">通勤: ¥{emp.commuting_allowance?.toLocaleString() || 0}</div>
                          </td>

                          {/* 📁 労務書面キャビネット ボタン */}
                          <td className="py-3.5 px-3 text-center">
                            <button
                              onClick={() => setCabinetModal({
                                isOpen: true,
                                employee: emp,
                                activeDoc: 'contract'
                              })}
                              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs px-2.5 py-1.5 rounded-xl border border-indigo-200 transition flex items-center gap-1 mx-auto cursor-pointer"
                              title="労働条件通知書・通勤届・口座届をまとめて閲覧"
                            >
                              <FolderOpen className="w-3.5 h-3.5" />
                              書面・証憑 (3)
                            </button>
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
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

              <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs font-bold">
                <button
                  onClick={() => setSubmissionFilter('pending')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${submissionFilter === 'pending' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500'}`}
                >
                  未審査のみ ({pendingSubmissionsCount})
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
                <p className="font-bold text-slate-600 text-sm">未審査の書類・申請はありません</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {filteredSubmissions.map(sub => {
                  const isPending = sub.status === 'pending';
                  const d = sub.data || {};

                  return (
                    <div key={sub.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 transition">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-800 text-sm">{sub.user_name} 殿</span>
                          <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-200">
                            {sub.title}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            提出: {new Date(sub.created_at).toLocaleString('ja-JP')}
                          </span>
                        </div>

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
                            <div>扶養親族等の数: <span className="font-bold">{d.dependents_count}名</span></div>
                          )}
                          {sub.document_type === 'my_number' && (
                            <div>マイナンバー: <span className="font-bold tracking-widest">{d.my_number ? '************' : '書類添付済'}</span></div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        {/* 📄 令和8年分 扶養控除等申告書のプレビュー・印刷ボタン */}
                        {sub.document_type === 'dependents_form' && (
                          <button
                            onClick={() => {
                              const emp = employees.find(e => e.user_id === sub.user_id) || {
                                user_id: sub.user_id,
                                name: sub.user_name,
                                role: 'employee',
                                status: 'active',
                                join_date: sub.created_at?.split('T')[0] || '2026-04-01',
                                employment_type: 'full-time',
                                department: '本社',
                                base_salary: 250000,
                                hourly_wage: 1200,
                                commuting_allowance: 12000,
                                health_insurance_joined: true,
                                pension_insurance_joined: true,
                                employment_insurance_joined: true
                              };
                              setCabinetModal({
                                isOpen: true,
                                employee: emp as any,
                                activeDoc: 'tax'
                              });
                            }}
                            className="bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 font-black text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                          >
                            <FileText className="w-4 h-4 text-amber-600" />
                            令和8年分 申告書を表示 / 印刷
                          </button>
                        )}

                        {/* 🚆 通勤申請書のプレビュー・印刷ボタン */}
                        {sub.document_type === 'commuting_pass' && (
                          <button
                            onClick={() => {
                              const emp = employees.find(e => e.user_id === sub.user_id) || {
                                user_id: sub.user_id,
                                name: sub.user_name,
                                role: 'employee',
                                status: 'active',
                                join_date: sub.created_at?.split('T')[0] || '2026-04-01',
                                employment_type: 'full-time',
                                department: '本社',
                                base_salary: 250000,
                                hourly_wage: 1200,
                                commuting_allowance: sub.data?.one_month_pass_amount || 12000,
                                health_insurance_joined: true,
                                pension_insurance_joined: true,
                                employment_insurance_joined: true
                              };
                              setCabinetModal({
                                isOpen: true,
                                employee: emp as any,
                                activeDoc: 'commuting'
                              });
                            }}
                            className="bg-blue-50 hover:bg-blue-100 border border-blue-300 text-blue-900 font-bold text-xs px-3 py-2 rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                          >
                            <Train className="w-4 h-4 text-blue-600" />
                            通勤申請書を表示 / 印刷
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
                            className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold text-xs px-3 py-2 rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                          >
                            <Eye className="w-4 h-4 text-blue-600" />
                            提出写真原本を確認
                          </button>
                        )}

                        {isPending ? (
                          <button
                            onClick={() => handleApproveSubmission(sub)}
                            disabled={isSaving}
                            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs px-4 py-2 rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-4 h-4" />}
                            承認してマスタ反映
                          </button>
                        ) : (
                          <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> 承認済（マスタ反映済）
                          </span>
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-slate-100 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4 print:hidden">
              <div>
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-indigo-600" />
                  労務書面キャビネット（{cabinetModal.employee.name} 殿）
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">入社時に締結した契約書および提出された通勤届・口座届のエビデンス原本</p>
              </div>
              <button onClick={() => setCabinetModal({ isOpen: false, employee: null, activeDoc: 'contract' })} className="p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer">
                <X className="w-5 h-5" />
              </button>
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
            </div>

            {/* 書面本体 */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden p-6 bg-slate-50/50 print:border-none print:p-0 max-h-[65vh] overflow-y-auto">
              {cabinetModal.activeDoc === 'contract' && (
                <OfficialLaborContractDoc data={{
                  companyName: tenantInfo?.name || '株式会社KAP',
                  companyAddress: tenantInfo?.address || '東京都千代田区大手町 1-2-3',
                  representativeName: tenantInfo?.representative_name || '代表取締役 〇〇 〇〇',
                  employeeName: cabinetModal.employee.name,
                  employeeAddress: '東京都新宿区〇〇 1-1',
                  joinDate: cabinetModal.employee.join_date,
                  contractType: cabinetModal.employee.contract_type || 'indefinite',
                  trialPeriodMonths: cabinetModal.employee.trial_period_months ?? 3,
                  workLocation: '本社 および 会社が指定する就業場所',
                  jobDescription: `${cabinetModal.employee.department || '営業部'}における業務全般`,
                  startTime: cabinetModal.employee.start_time || '09:00',
                  endTime: cabinetModal.employee.end_time || '18:00',
                  breakTimeMinutes: cabinetModal.employee.break_time_minutes || 60,
                  overtimeWork: 'あり（業務の都合により命じる場合がある）',
                  holidaysText: cabinetModal.employee.holidays_text || '完全週休2日制（土・日）、国民の祝日',
                  paidLeaveGrantDays: 10,
                  salaryType: (cabinetModal.employee.salary_type || (cabinetModal.employee.employment_type === 'part-time' ? 'hourly' : 'monthly')),
                  baseSalary: cabinetModal.employee.base_salary,
                  hourlyWage: cabinetModal.employee.hourly_wage,
                  positionAllowance: cabinetModal.employee.position_allowance,
                  qualificationAllowance: cabinetModal.employee.qualification_allowance || 0,
                  housingAllowance: cabinetModal.employee.housing_allowance || 0,
                  familyAllowance: cabinetModal.employee.family_allowance || 0,
                  commutingAllowance: cabinetModal.employee.commuting_allowance,
                  fixedOvertimeHours: 0,
                  fixedOvertimeAllowance: 0,
                  bonusPolicy: 'あり（会社の業績および本人の勤務成績を勘案して支給）',
                  raisePolicy: 'あり（原則として年1回査定）',
                  retirementAllowance: 'なし',
                  healthInsuranceJoined: cabinetModal.employee.health_insurance_joined,
                  pensionInsuranceJoined: cabinetModal.employee.pension_insurance_joined,
                  employmentInsuranceJoined: cabinetModal.employee.employment_insurance_joined,
                  workersCompJoined: true
                }} />
              )}

              {cabinetModal.activeDoc === 'commuting' && (() => {
                const subComm = submissions.find(s => s.user_id === cabinetModal.employee?.user_id && s.document_type === 'commuting_pass');
                const cData = subComm?.data || {};

                return (
                  <OfficialCommutingPassDoc data={{
                    companyName: tenantInfo?.name || '株式会社KAP',
                    employeeName: cabinetModal.employee.name,
                    department: cabinetModal.employee.department || '営業部',
                    transportMode: cData.transport_mode || 'train_bus',
                    originStation: cData.origin_station || '自宅最寄',
                    destinationStation: cData.destination_station || '会社最寄',
                    segments: cData.segments || [],
                    carDistanceKm: cData.car_distance_km,
                    oneMonthPassAmount: cData.one_month_pass_amount || cabinetModal.employee.commuting_allowance || 0,
                    sixMonthPassAmount: cData.six_month_pass_amount,
                    attachmentImage: subComm?.attachment_data,
                    appliedDate: cabinetModal.employee.join_date
                  }} />
                );
              })()}

              {cabinetModal.activeDoc === 'bank' && (
                <OfficialBankPassbookDoc data={{
                  companyName: tenantInfo?.name || '株式会社KAP',
                  employeeName: cabinetModal.employee.name,
                  department: cabinetModal.employee.department || '営業部',
                  bankName: cabinetModal.employee.bank_name || '未登録',
                  branchName: cabinetModal.employee.branch_name || '未登録',
                  accountType: cabinetModal.employee.account_type || 'ordinary',
                  accountNumber: cabinetModal.employee.account_number || '',
                  accountHolder: cabinetModal.employee.account_holder || cabinetModal.employee.name,
                  attachmentImage: submissions.find(s => s.user_id === cabinetModal.employee?.user_id && s.document_type === 'bank_passbook')?.attachment_data,
                  appliedDate: cabinetModal.employee.join_date
                }} />
              )}

              {cabinetModal.activeDoc === 'tax' && (() => {
                const subTax = submissions.find(s => s.user_id === cabinetModal.employee?.user_id && s.document_type === 'dependents_form');
                const tData = subTax?.data || {};
                const subResident = submissions.find(s => s.user_id === cabinetModal.employee?.user_id && s.document_type === 'resident_certificate');
                const rData = subResident?.data || {};

                return (
                  <OfficialTaxExemptionDoc data={{
                    year: tData.year || 2026,
                    companyName: tenantInfo?.name || '株式会社KAP',
                    companyAddress: tenantInfo?.address || '東京都千代田区大手町 1-2-3',
                    corporateNumber: tenantInfo?.corporate_number || '1010001999999',
                    taxOfficeName: tenantInfo?.tax_office_name || '千代田',
                    municipalityName: tenantInfo?.municipality_name || '千代田区',
                    employeeName: cabinetModal.employee.name,
                    employeeNameKana: tData.name_kana || rData.name_kana || '',
                    employeeAddress: tData.address || rData.address || '東京都新宿区西新宿 2-8-1',
                    postalCode: tData.postal_code || rData.postal_code || '160-0023',
                    myNumber: tData.my_number || '',
                    birthDate: tData.birth_date || rData.birth_date || '1995-04-01',
                    householderName: tData.householder_name || rData.householder_name || cabinetModal.employee.name,
                    householderRelation: tData.householder_relation || rData.householder_relation || '本人',
                    hasSpouse: tData.has_spouse || false,
                    spouseName: tData.spouse_name,
                    spouseNameKana: tData.spouse_name_kana,
                    spouseBirthDate: tData.spouse_birth_date || '1996-05-15',
                    spouseIncomeEstimate: tData.spouse_income_estimate,
                    spouseIsLivingTogether: tData.spouse_is_living_together !== false,
                    dependents: tData.dependents || [],
                    isDisability: tData.is_disability,
                    isSingleParent: tData.is_single_parent,
                    isWidow: tData.is_widow,
                    isWorkingStudent: tData.is_working_student,
                    appliedDate: cabinetModal.employee.join_date
                  }} />
                );
              })()}
            </div>

            <div className="mt-6 flex justify-end gap-2 pt-4 border-t border-slate-100 print:hidden">
              <button onClick={() => setCabinetModal({ isOpen: false, employee: null, activeDoc: 'contract' })} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer">
                閉じる
              </button>
              <button onClick={() => window.print()} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer">
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
                      value={editModal.data.salary_type === 'hourly' ? editModal.data.hourly_wage : editModal.data.base_salary}
                      onChange={e => {
                        const val = parseInt(e.target.value, 10) || 0;
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
                      value={editModal.data.position_allowance}
                      onChange={e => setEditModal({ ...editModal, data: { ...editModal.data!, position_allowance: parseInt(e.target.value, 10) || 0 } })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">通勤手当</label>
                    <input
                      type="number"
                      value={editModal.data.commuting_allowance}
                      onChange={e => setEditModal({ ...editModal, data: { ...editModal.data!, commuting_allowance: parseInt(e.target.value, 10) || 0 } })}
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
                      value={wizardData.salary_type === 'hourly' ? wizardData.hourly_wage : wizardData.base_salary}
                      onChange={e => {
                        const val = parseInt(e.target.value, 10) || 0;
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
                      value={wizardData.commuting_allowance}
                      onChange={e => setWizardData({ ...wizardData, commuting_allowance: parseInt(e.target.value, 10) || 0 })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">役職手当 (月額)</label>
                    <input
                      type="number"
                      value={wizardData.position_allowance}
                      onChange={e => setWizardData({ ...wizardData, position_allowance: parseInt(e.target.value, 10) || 0 })}
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
                      value={proxyInputModal.commutingAmount}
                      onChange={e => setProxyInputModal(prev => ({ ...prev, commutingAmount: parseInt(e.target.value, 10) || 0 }))}
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
    </div>
  );
}
