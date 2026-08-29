import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import AppSwitcher from '../components/AppSwitcher';
import { OfficialLaborContractDoc, type LaborContractData } from '../components/OfficialLaborContractDoc';
import { 
  UserPlus, Users, FileText, CheckCircle2, 
  Printer, ArrowLeft, LogOut, Loader2, X, ChevronRight, 
  HelpCircle, Building2, Check, UserCheck
} from 'lucide-react';

interface EmployeeOnboardingData {
  user_id: string;
  name: string;
  email?: string;
  role: string;
  status: 'onboarding' | 'active' | 'offboarding' | 'retired';
  join_date: string;
  retirement_date?: string;
  employment_type: 'full-time' | 'part-time' | 'contract';
  department?: string;
  contract_type: 'indefinite' | 'fixed_term';
  base_salary: number;
  hourly_wage: number;
  position_allowance: number;
  commuting_allowance: number;
  health_insurance_joined: boolean;
  pension_insurance_joined: boolean;
  employment_insurance_joined: boolean;
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

export default function OnboardingAdminDashboard() {
  const navigate = useNavigate();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantInfo, setTenantInfo] = useState<any>(null);
  const [employees, setEmployees] = useState<EmployeeOnboardingData[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'onboarding' | 'retired'>('all');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // ウィザードモーダルState
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [wizardData, setWizardData] = useState({
    name: '',
    email: '',
    phone: '',
    birth_date: '1995-01-01',
    address: '',
    join_date: new Date().toISOString().split('T')[0],
    employment_type: 'full-time', // 'full-time', 'part-time'
    department: '営業部',
    role_title: '一般社員',
    contract_type: 'indefinite', // 'indefinite', 'fixed_term'
    trial_period_months: 3,
    start_time: '09:00',
    end_time: '18:00',
    break_time_minutes: 60,
    holidays_text: '完全週休2日制（土日・祝日）、年末年始休暇',
    salary_type: 'monthly', // 'monthly', 'hourly'
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

  // 書類プレビューモーダルState
  const [contractPreviewModal, setContractPreviewModal] = useState<{
    isOpen: boolean;
    data: LaborContractData | null;
  }>({
    isOpen: false,
    data: null
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

      const combined: EmployeeOnboardingData[] = (uData || []).map((u: any) => {
        const onb: any = onbMap.get(u.id);
        const pay: any = payMap.get(u.id);

        return {
          user_id: u.id,
          name: u.name || '従業員',
          email: u.email,
          role: u.role,
          status: onb?.status || 'active',
          join_date: onb?.join_date || u.join_date || '2026-04-01',
          retirement_date: onb?.retirement_date,
          employment_type: u.employment_type || 'full-time',
          department: u.department || '本社',
          contract_type: onb?.contract_type || 'indefinite',
          base_salary: pay?.base_salary || onb?.base_salary || 250000,
          hourly_wage: pay?.hourly_wage || onb?.hourly_wage || 1150,
          position_allowance: pay?.position_allowance || 0,
          commuting_allowance: pay?.commuting_allowance || 15000,
          health_insurance_joined: pay?.health_insurance_enabled ?? true,
          pension_insurance_joined: pay?.pension_insurance_enabled ?? true,
          employment_insurance_joined: pay?.employment_insurance_enabled ?? true,
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
    } catch (e) {
      console.error('Fetch onboarding error:', e);
    } finally {
      setLoading(false);
    }
  };

  // 入社ウィザード完了 ＆ 3大マスタ一括同期処理
  const handleCompleteOnboardingWizard = async () => {
    if (!tenantId || !wizardData.name) {
      alert('氏名を入力してください。');
      return;
    }

    setIsSaving(true);
    try {
      // 1. users テーブルへ追加（または更新）
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

      // 2. shift_employee_settings テーブルへ追加（シフトマスタ同期）
      await supabase.from('shift_employee_settings').upsert({
        tenant_id: tenantId,
        user_id: newUserId,
        hire_date: wizardData.join_date,
        max_hours_per_week: wizardData.employment_type === 'part-time' ? 25 : 40,
        priority_score: 3,
        default_role: 'ホール',
        base_wage: wizardData.salary_type === 'hourly' ? wizardData.hourly_wage : 1150
      }, { onConflict: 'user_id' });

      // 3. employee_payroll_profiles テーブルへ追加（給与マスタ同期）
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

      // 4. employee_onboarding_profiles テーブルへ詳細保存
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

  // 労働条件通知書のプレビューを開く
  const handleOpenContractPreview = (emp: EmployeeOnboardingData) => {
    const contractData: LaborContractData = {
      companyName: tenantInfo?.name || '株式会社KAP',
      companyAddress: '東京都千代田区〇〇 1-2-3',
      representativeName: '代表取締役 〇〇 〇〇',
      employeeName: emp.name,
      employeeAddress: '東京都新宿区〇〇 1-1',
      joinDate: emp.join_date,
      contractType: emp.contract_type || 'indefinite',
      trialPeriodMonths: 3,
      workLocation: '本社 および 会社が指定する就業場所',
      jobDescription: `${emp.department}における業務全般`,
      startTime: '09:00',
      endTime: '18:00',
      breakTimeMinutes: 60,
      overtimeWork: 'あり（業務の都合により命じる場合がある）',
      holidaysText: '完全週休2日制（土・日）、国民の祝日、年末年始休暇',
      paidLeaveGrantDays: 10,
      salaryType: (emp.employment_type === 'part-time') ? 'hourly' : 'monthly',
      baseSalary: emp.base_salary,
      hourlyWage: emp.hourly_wage,
      positionAllowance: emp.position_allowance,
      qualificationAllowance: 0,
      housingAllowance: 0,
      familyAllowance: 0,
      commutingAllowance: emp.commuting_allowance,
      fixedOvertimeHours: 0,
      fixedOvertimeAllowance: 0,
      bonusPolicy: 'あり（会社の業績および本人の勤務成績を勘案して支給）',
      raisePolicy: 'あり（原則として年1回査定）',
      retirementAllowance: 'なし',
      healthInsuranceJoined: emp.health_insurance_joined,
      pensionInsuranceJoined: emp.pension_insurance_joined,
      employmentInsuranceJoined: emp.employment_insurance_joined,
      workersCompJoined: true
    };

    setContractPreviewModal({
      isOpen: true,
      data: contractData
    });
  };

  // チェックリストの更新
  const handleToggleChecklist = async (emp: EmployeeOnboardingData, docKey: string) => {
    if (!tenantId) return;
    const currentChecklist = emp.documents_checklist || {
      id_copy: false,
      my_number: false,
      pension_handbook: false,
      employment_insurance_card: false,
      withholding_tax_slip: false,
      bank_account_copy: false,
      labor_contract_signed: false
    };

    const updatedChecklist = {
      ...currentChecklist,
      [docKey]: !(currentChecklist as any)[docKey]
    };

    try {
      await supabase
        .from('employee_onboarding_profiles')
        .upsert({
          tenant_id: tenantId,
          user_id: emp.user_id,
          documents_checklist: updatedChecklist,
          join_date: emp.join_date
        }, { onConflict: 'tenant_id,user_id' });

      setEmployees(prev => prev.map(e => e.user_id === emp.user_id ? { ...e, documents_checklist: updatedChecklist } : e));
    } catch (e) {
      console.error(e);
    }
  };

  const filteredEmployees = employees.filter(e => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'active') return e.status === 'active';
    if (activeFilter === 'onboarding') return e.status === 'onboarding';
    if (activeFilter === 'retired') return e.status === 'retired';
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
            onClick={() => setGuideModalOpen(true)}
            className="bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs px-3 py-2 rounded-xl transition border border-slate-200 flex items-center gap-1.5 cursor-pointer"
          >
            <HelpCircle className="w-4 h-4 text-blue-600" />
            労務手続きガイド
          </button>
          <AppSwitcher currentApp="portal" role="admin" />
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
              <span className="text-xs font-bold">入社手続き中</span>
              <UserPlus className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black text-amber-600">{onboardingCount}名</div>
            <div className="mt-2 text-[11px] text-slate-400">書類回収・届出待ち</div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold">退職者・OB</span>
              <Building2 className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-black text-slate-600">{retiredCount}名</div>
            <div className="mt-2 text-[11px] text-slate-400">過去の在籍記録保存</div>
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

        {/* 従業員入退社リスト */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                従業員 入退社・労務書類台帳
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">労働条件通知書の出力・必要書類回収の進捗・各システムへの同期状態</p>
            </div>

            {/* フィルタータブ */}
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
              <span className="text-xs">従業員台帳を読み込み中...</span>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="font-bold text-slate-600 text-sm">該当する従業員データがありません</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[950px]">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <th className="py-3 px-4">氏名 / 所属</th>
                    <th className="py-3 px-3">雇用形態</th>
                    <th className="py-3 px-3">入社年月日</th>
                    <th className="py-3 px-3">給与設定</th>
                    <th className="py-3 px-4">必要書類回収状況</th>
                    <th className="py-3 px-3 text-center">マスタ連動</th>
                    <th className="py-3 px-4 text-center">書類・操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredEmployees.map(emp => {
                    const isHourly = emp.employment_type === 'part-time';
                    const docs = emp.documents_checklist || {
                      id_copy: false,
                      my_number: false,
                      pension_handbook: false,
                      employment_insurance_card: false,
                      withholding_tax_slip: false,
                      bank_account_copy: false,
                      labor_contract_signed: false
                    };

                    return (
                      <tr key={emp.user_id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-700 font-bold flex items-center justify-center text-xs">
                              {emp.name.substring(0, 1)}
                            </div>
                            <div>
                              <div className="font-bold text-slate-800">{emp.name}</div>
                              <div className="text-[10px] text-slate-400">{emp.department || '本社'}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                            isHourly ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}>
                            {isHourly ? 'パート・アルバイト' : '正社員（無期）'}
                          </span>
                        </td>

                        <td className="py-3.5 px-3 font-medium text-slate-700">
                          {emp.join_date}
                        </td>

                        <td className="py-3.5 px-3 font-bold text-slate-800">
                          {isHourly ? (
                            <span>時給 ¥{emp.hourly_wage?.toLocaleString()}</span>
                          ) : (
                            <span>月給 ¥{emp.base_salary?.toLocaleString()}</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1 text-[10px]">
                            <button
                              onClick={() => handleToggleChecklist(emp, 'labor_contract_signed')}
                              className={`px-1.5 py-0.5 rounded border transition cursor-pointer ${
                                docs.labor_contract_signed ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold' : 'bg-slate-50 text-slate-400 border-slate-200'
                              }`}
                              title="雇用契約書・署名回収"
                            >
                              {docs.labor_contract_signed ? '☑' : '☐'} 契約書
                            </button>
                            <button
                              onClick={() => handleToggleChecklist(emp, 'my_number')}
                              className={`px-1.5 py-0.5 rounded border transition cursor-pointer ${
                                docs.my_number ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold' : 'bg-slate-50 text-slate-400 border-slate-200'
                              }`}
                              title="マイナンバー確認"
                            >
                              {docs.my_number ? '☑' : '☐'} マイナ
                            </button>
                            <button
                              onClick={() => handleToggleChecklist(emp, 'pension_handbook')}
                              className={`px-1.5 py-0.5 rounded border transition cursor-pointer ${
                                docs.pension_handbook ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold' : 'bg-slate-50 text-slate-400 border-slate-200'
                              }`}
                              title="年金手帳・基礎年金番号"
                            >
                              {docs.pension_handbook ? '☑' : '☐'} 年金
                            </button>
                            <button
                              onClick={() => handleToggleChecklist(emp, 'bank_account_copy')}
                              className={`px-1.5 py-0.5 rounded border transition cursor-pointer ${
                                docs.bank_account_copy ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold' : 'bg-slate-50 text-slate-400 border-slate-200'
                              }`}
                              title="口座情報"
                            >
                              {docs.bank_account_copy ? '☑' : '☐'} 口座
                            </button>
                          </div>
                        </td>

                        <td className="py-3.5 px-3 text-center">
                          <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200 inline-flex items-center gap-0.5">
                            <Check className="w-3 h-3" /> 勤怠・シフト・給与
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => handleOpenContractPreview(emp)}
                            className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs px-2.5 py-1.5 rounded-lg border border-blue-200 transition flex items-center gap-1 mx-auto cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            契約書を出力
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </main>

      {/* 新規入社ウィザード モーダル */}
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

            {/* ステップナビゲーション */}
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

            {/* ウィザード Step 1: 基本情報 */}
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
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">配属部署</label>
                    <input
                      type="text"
                      placeholder="例: 店舗運営部 / 営業部"
                      value={wizardData.department}
                      onChange={e => setWizardData({ ...wizardData, department: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ウィザード Step 2: 労働時間・休日 */}
            {wizardStep === 2 && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">始業時刻</label>
                    <input
                      type="time"
                      value={wizardData.start_time}
                      onChange={e => setWizardData({ ...wizardData, start_time: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">終業時刻</label>
                    <input
                      type="time"
                      value={wizardData.end_time}
                      onChange={e => setWizardData({ ...wizardData, end_time: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">休日規定</label>
                  <input
                    type="text"
                    value={wizardData.holidays_text}
                    onChange={e => setWizardData({ ...wizardData, holidays_text: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
                  />
                </div>
              </div>
            )}

            {/* ウィザード Step 3: 給与・社保・口座 */}
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

                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-700 block">振込先銀行口座</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="銀行名"
                      value={wizardData.bank_name}
                      onChange={e => setWizardData({ ...wizardData, bank_name: e.target.value })}
                      className="bg-white border border-slate-300 rounded-lg px-2 py-1"
                    />
                    <input
                      type="text"
                      placeholder="支店名"
                      value={wizardData.branch_name}
                      onChange={e => setWizardData({ ...wizardData, branch_name: e.target.value })}
                      className="bg-white border border-slate-300 rounded-lg px-2 py-1"
                    />
                    <input
                      type="text"
                      placeholder="口座番号"
                      value={wizardData.account_number}
                      onChange={e => setWizardData({ ...wizardData, account_number: e.target.value })}
                      className="bg-white border border-slate-300 rounded-lg px-2 py-1"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ウィザード Step 4: 完了 ＆ 全同期 */}
            {wizardStep === 4 && (
              <div className="space-y-4 text-xs">
                <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 space-y-2">
                  <div className="flex items-center gap-2 font-black text-emerald-800 text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    以下の内容で入社登録および全マスタ同期を実行します
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-slate-700 pt-2 border-t border-emerald-200/60">
                    <div>氏名: <span className="font-bold">{wizardData.name}</span></div>
                    <div>入社日: <span className="font-bold">{wizardData.join_date}</span></div>
                    <div>雇用形態: <span className="font-bold">{wizardData.employment_type === 'part-time' ? 'パート' : '正社員'}</span></div>
                    <div>給与: <span className="font-bold">{wizardData.salary_type === 'hourly' ? `時給 ¥${wizardData.hourly_wage}` : `月給 ¥${wizardData.base_salary.toLocaleString()}`}</span></div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5 text-[11px] text-slate-600">
                  <div className="font-bold text-slate-800 mb-1">⚡ 同期されるシステム:</div>
                  <div>✅ <b>勤怠管理システム</b>: 従業員アカウントが即座に作成され、打刻・有給管理が可能になります。</div>
                  <div>✅ <b>シフト管理システム</b>: シフト希望提出・AIオート生成の対象枠に自動配置されます。</div>
                  <div>✅ <b>給与計算システム</b>: 基本給・時給・通勤手当・口座情報が給与マスタへ即座にセットされます。</div>
                </div>
              </div>
            )}

            {/* フッターナビゲーション */}
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

      {/* 労働条件通知書 プレビューモーダル */}
      {contractPreviewModal.isOpen && contractPreviewModal.data && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-slate-100 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4 print:hidden">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <Printer className="w-5 h-5 text-blue-600" />
                労働条件通知書 兼 雇用契約書（{contractPreviewModal.data.employeeName} 殿）
              </h3>
              <button onClick={() => setContractPreviewModal({ isOpen: false, data: null })} className="p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden p-6 bg-slate-50/50 print:border-none print:p-0">
              <OfficialLaborContractDoc data={contractPreviewModal.data} />
            </div>

            <div className="mt-6 flex justify-end gap-2 pt-4 border-t border-slate-100 print:hidden">
              <button onClick={() => setContractPreviewModal({ isOpen: false, data: null })} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer">
                閉じる
              </button>
              <button onClick={() => window.print()} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer">
                <Printer className="w-4 h-4" />
                A4印刷 / PDF保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 零細企業向け 労務手続きToDoガイド モーダル */}
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
              {/* 入社時の手続き */}
              <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-200">
                <h4 className="font-black text-blue-900 text-sm mb-2 flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-blue-600" />
                  1. 従業員が入社したときの手続きと期限
                </h4>
                <div className="space-y-2">
                  <div className="bg-white p-3 rounded-xl border border-blue-100">
                    <div className="font-bold text-slate-800">① 労働条件通知書（雇用契約書）の交付【入社当日まで・必須】</div>
                    <p className="text-[11px] text-slate-500 mt-0.5">当システムの「契約書を出力」ボタンからA4印刷し、2部印刷して労使双方で署名捺印のうえ1部ずつ保管します。</p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-blue-100">
                    <div className="font-bold text-slate-800">② 健康保険・厚生年金 資格取得届【事実発生から5日以内】</div>
                    <p className="text-[11px] text-slate-500 mt-0.5">提出先: 管轄の年金事務所（または日本年金機構）。週所定労働時間が週30時間以上（正社員等）の場合に提出します。</p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-blue-100">
                    <div className="font-bold text-slate-800">③ 雇用保険被保険者 資格取得届【翌月10日まで】</div>
                    <p className="text-[11px] text-slate-500 mt-0.5">提出先: 管轄のハローワーク。週20時間以上かつ31日以上雇用の見込みがあるパート・正社員全員が対象です。</p>
                  </div>
                </div>
              </div>

              {/* 退社時の手続き */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <h4 className="font-black text-slate-900 text-sm mb-2 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-slate-600" />
                  2. 従業員が退職したときの手続きと期限
                </h4>
                <div className="space-y-2">
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <div className="font-bold text-slate-800">① 健康保険・厚生年金 資格喪失届【退職日から5日以内】</div>
                    <p className="text-[11px] text-slate-500 mt-0.5">提出先: 年金事務所。健康保険被保険者証（保険証）を回収して添付します。</p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <div className="font-bold text-slate-800">② 雇用保険被保険者 資格喪失届 ＆ 離職票【退職日の翌日から10日以内】</div>
                    <p className="text-[11px] text-slate-500 mt-0.5">提出先: ハローワーク。退職者が失業給付を受けるために離職票が必要な場合は交付します。</p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <div className="font-bold text-slate-800">③ 給与所得の源泉徴収票の交付【退職後1ヶ月以内】</div>
                    <p className="text-[11px] text-slate-500 mt-0.5">退職者本人へその年の最終給与確定後に交付します（転職先への提出用）。</p>
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
