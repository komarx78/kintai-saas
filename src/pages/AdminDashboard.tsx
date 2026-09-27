import { useState, useEffect, useMemo } from 'react';
import { Users, FileText, LogOut, Plus, X, Calendar, Coffee, CheckCircle, Clock, DollarSign, Building2, ArrowLeft } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { PaidLeaveManagement } from '../components/PaidLeaveManagement';
import { MonthlyAttendanceManagement } from '../components/MonthlyAttendanceManagement';
import { PayslipManagement } from '../components/PayslipManagement';
import AppSwitcher from '../components/AppSwitcher';
import { HelpGuideModal } from '../components/HelpGuideModal';
import { calculateSubscriptionFee, type BillingMasterConfig } from '../lib/subscriptionBilling';
import { getStoresFromStorage, fetchStoresUnified, type StoreMaster } from '../lib/storeMaster';
import {
  type PaidLeaveCalcMode,
  getCompanyPaidLeaveCalcMode,
  getUserPaidLeaveCalcModeMap,
  saveUserPaidLeaveCalcMode
} from '../lib/paidLeaveCalculation';
import { purgeTenantLocalStorageCache } from '../lib/tenantCache';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'employees' | 'attendance' | 'ledger' | 'payslips'>(
    tabParam && ['employees', 'attendance', 'ledger', 'payslips'].includes(tabParam)
      ? (tabParam as any)
      : 'employees'
  );

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'settings') {
      navigate('/settings/company');
      return;
    }
    if (tab && ['employees', 'attendance', 'ledger', 'payslips'].includes(tab)) {
      setActiveTab(tab as any);
    }
  }, [searchParams, navigate]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [availableStores, setAvailableStores] = useState<StoreMaster[]>([]);
  const [companyCalcMode, setCompanyCalcMode] = useState<PaidLeaveCalcMode>('actual_worked');
  const [userCalcModeMap, setUserCalcModeMap] = useState<Record<string, PaidLeaveCalcMode | 'default'>>({});

  useEffect(() => {
    if (tenantId) {
      setCompanyCalcMode(getCompanyPaidLeaveCalcMode(tenantId));
      setUserCalcModeMap(getUserPaidLeaveCalcModeMap(tenantId));
    }
  }, [tenantId]);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // ロール検証（一般従業員の場合は /kintai/user へ即時リダイレクト）
        const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle();
        if (userData && userData.role !== 'admin' && userData.role !== 'superadmin') {
          navigate('/kintai/user');
          return;
        }

        const { data: tenantIdData, error } = await supabase.rpc('get_user_tenant_id');
        if (tenantIdData) {
          setTenantId(tenantIdData);
          purgeTenantLocalStorageCache(tenantIdData);
        } else if (error) {
          console.error("Error fetching tenant_id:", error);
          setDebugError('Tenant Fetch Error: ' + error.message);
        } else {
          setDebugError('Tenant Fetch Error: tenantIdData is null. RPC might be missing or user lacks tenant_id.');
        }
      } else {
        setDebugError('Not logged in: supabase.auth.getUser() returned no user. Please log out and log in again.');
      }
    };
    fetchProfile();
  }, []);

  // Invite Modal States
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  
  // Debug State
  const [debugError, setDebugError] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string>('');
  const [tenantInfo, setTenantInfo] = useState<any>(null);
  const [systemPrices, setSystemPrices] = useState<any>({
    price_1_user: 200, price_1_user_annual: 2400,
    price_2_users: 400, price_2_users_annual: 4800,
    price_3_users: 600, price_3_users_annual: 7200,
    price_4_users: 800, price_4_users_annual: 9600,
    price_5_users: 1000, price_5_users_annual: 12000,
    additional_user_price: 200, additional_user_price_annual: 2400
  });

  // ブラウザタブのタイトルを動的に更新
  useEffect(() => {
    const titles: Record<string, string> = {
      employees: '従業員管理 | 企業管理ダッシュボード',
      attendance: '月間勤怠・出勤簿管理 | 企業管理ダッシュボード',
      ledger: '有給・休暇管理 | 企業管理ダッシュボード',
      payslips: 'Web給与明細管理 | 企業管理ダッシュボード'
    };
    document.title = titles[activeTab] || '企業管理ダッシュボード | みんなの らくまる労務';
  }, [activeTab]);

  const inviteMessage = `お疲れ様です！
勤怠・有給管理システムへの初期登録をお願いいたします。

以下の手順に沿って、スマートフォンやパソコンからアカウントを作成してください。

■ 登録手順マニュアル（約3分で終わります）
--------------------------------------------------
【ステップ 1】
以下の「新規登録ページ」のURLをタップして開きます。
URL: ${window.location.origin}

【ステップ 2】
画面が開いたら、ご自身の「お名前」「メールアドレス」「パスワード（お好きなもの）」を入力します。

【ステップ 3】
「招待された企業に『従業員』として登録する」という項目にチェックを入れます。

【ステップ 4】
チェックを入れると「招待コード」の入力欄が現れますので、以下のコードをそのままコピーして貼り付けてください。

▼あなたの招待コード
${tenantId || '（エラー：コード取得失敗）'}

【ステップ 5】
最後に「アカウントを作成する」ボタンを押せば完了です！
--------------------------------------------------
ご不明な点がありましたら、管理者までお声がけください。
よろしくお願いいたします。`;

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteMessage);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    } catch (err) {
      console.error('Failed to copy!', err);
      alert('コピーに失敗しました。お手数ですが手動でコピーしてください。');
    }
  };

  // Dynamic Data States
  const [employees, setEmployees] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);

  const fetchEmployees = async () => {
    if (!tenantId) return;
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });
      
    const { data: grantsData } = await supabase
      .from('paid_leave_grants')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('grant_date', { ascending: false });
      
    const { data: requestsData } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', '承認')
      .eq('type', '有給休暇');
    
    if (data) {
      // 大元労務マスタから退職者ステータスを取得（在籍者のみを課金対象とするため）
      let retiredUserIds = new Set<string>();
      try {
        const { data: onbData } = await supabase
          .from('employee_onboarding_profiles')
          .select('user_id, status')
          .eq('tenant_id', tenantId);
        if (onbData) {
          onbData.filter(o => o.status === 'retired').forEach(o => retiredUserIds.add(o.user_id));
        }
      } catch {}

      // 🏪 店舗一覧を取得して選択肢を同期
      try {
        const loadedStores = await fetchStoresUnified(tenantId);
        setAvailableStores(loadedStores);
      } catch {
        setAvailableStores(getStoresFromStorage(tenantId));
      }

      let localPosMap: Record<string, any> = {};
      try {
        localPosMap = JSON.parse(localStorage.getItem(`user_positions_${tenantId}`) || '{}');
      } catch {}

      const mapped = data.map(u => {
        const userRequests = requestsData ? requestsData.filter(r => r.user_id === u.id) : [];
        const userTakenDates: string[] = [];
        
        userRequests.forEach(req => {
          if (req.start_date && req.end_date) {
            const start = new Date(req.start_date);
            const end = new Date(req.end_date);
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
              userTakenDates.push(d.toISOString().split('T')[0]);
            }
          }
        });

        const userLocalPos = localPosMap[u.id] || {};
        const resolvedStoreName = u.store_name || userLocalPos.store_name || '';

        return {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role === 'admin' ? '管理者' : '一般',
          department: u.department || '-',
          store_name: resolvedStoreName,
          manager: u.approver_id ? data.find((emp: any) => emp.id === u.approver_id)?.name || '-' : '-',
          approver_id: u.approver_id,
          join_date: u.join_date || '-',
          type: u.employment_type === 'part-time' ? 'パート' : '正社員',
          weeklyDays: u.weekly_working_days || 5,
          takenDates: userTakenDates,
          daikyuEarned: [],
          daikyuTaken: [],
          leaveGrants: grantsData ? grantsData.filter((g: any) => g.user_id === u.id) : [],
          paidLeaveBalance: parseFloat(u.paid_leave_balance || 0),
          paidLeaveCarryover: parseFloat(u.paid_leave_carryover || 0),
          has_kintai_access: u.has_kintai_access ?? true,
          has_shift_access: u.has_shift_access ?? false,
          is_retired: retiredUserIds.has(u.id) || u.status === 'retired'
        };
      });
      setEmployees(mapped);
    }
    if (error) {
      setDebugError('Employees Fetch Error: ' + error.message);
    }
  };

  useEffect(() => {
    const fetchTenantAndPrices = async () => {
      if (!tenantId) return;
      try {
        // 1. テナント情報と個別価格を取得
        const { data: tData } = await supabase.from('tenants').select('*').eq('id', tenantId).maybeSingle();
        if (tData) {
          setTenantName(tData.name);
          setTenantInfo(tData);
        }

        // 2. システム共通価格表を取得
        const { data: sysData } = await supabase.from('system_settings').select('*').limit(1).maybeSingle();
        if (sysData) {
          setSystemPrices(sysData);
        }
      } catch (e) {
        console.warn('Fetch prices error:', e);
      }
    };
    fetchTenantAndPrices();
    fetchEmployees();
  }, [tenantId]);

  const fetchRequests = async () => {
    if (!tenantId) return;
    try {
      const { data: requests, error } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', '申請中')
        .neq('type', 'シフト希望')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('fetchRequests error:', error);
        return;
      }

      if (requests && requests.length > 0) {
        const userIds = [...new Set(requests.map(r => r.user_id))];
        const { data: usersData } = await supabase.from('users').select('id, name, department').in('id', userIds);
        
        const combined = requests.map(req => ({
          ...req,
          user: usersData?.find(u => u.id === req.user_id) || null
        }));
        setLeaveRequests(combined);
      } else {
        setLeaveRequests([]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [tenantId, activeTab]);

  // 在籍中の従業員のみを課金対象として正確にカウント（退職者は自動除外）
  const activeEmployees = useMemo(() => employees.filter(e => !e.is_retired), [employees]);
  const currentUsers = activeEmployees.length;
  const retiredCount = employees.length - currentUsers;

  // マスタ設定（テナント個別設定優先 ➔ システム共通設定 ➔ 規定単価300円）
  const billingConfig: BillingMasterConfig = useMemo(() => {
    const t = tenantInfo || {};
    const s = systemPrices || {};
    return {
      billing_model: t.custom_billing_model || s.billing_model || 'per_user',
      unit_price_per_user: t.custom_unit_price_per_user ?? s.unit_price_per_user ?? 300,
      unit_price_per_user_annual: t.custom_unit_price_per_user_annual ?? s.unit_price_per_user_annual ?? 3600,
      base_fee: t.custom_base_fee ?? s.base_fee ?? 0,
      base_fee_annual: t.custom_base_fee_annual ?? s.base_fee_annual ?? 0,
      included_users: t.custom_included_users ?? s.included_users ?? 0,
      flat_monthly_price: t.custom_flat_monthly_price ?? s.flat_monthly_price ?? 15000,
      flat_annual_price: t.custom_flat_annual_price ?? s.flat_annual_price ?? 150000,
      billing_cycle: t.billing_cycle || 'monthly'
    };
  }, [tenantInfo, systemPrices]);

  const subscriptionResult = useMemo(() => {
    return calculateSubscriptionFee(currentUsers, billingConfig);
  }, [currentUsers, billingConfig]);

  const calculatedFee = subscriptionResult.totalFee;

  const handleOpenModal = (employee: any = null) => {
    setEditingEmployee(employee);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingEmployee(null);
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee || !tenantId) return;

    const form = e.target as HTMLFormElement;
    const name = (form.elements.namedItem('name') as HTMLInputElement).value;
    const roleStr = (form.elements.namedItem('role') as HTMLSelectElement).value;
    const join_date = (form.elements.namedItem('join_date') as HTMLInputElement).value;
    const rawDept = (form.elements.namedItem('department') as HTMLInputElement).value;
    const rawStore = (form.elements.namedItem('store_name') as HTMLSelectElement)?.value?.trim() || '';
    // 店舗所属者は組織上必ず「店舗運営部」に集約、店舗なしの本部部署ならstore_nameをクリア
    const store_name = rawStore || null;
    const department = store_name ? '店舗運営部' : (rawDept || null);
    const approver_id = (form.elements.namedItem('approver_id') as HTMLSelectElement).value;
    const employment_type_str = (form.elements.namedItem('employment_type') as HTMLSelectElement).value;
    const weekly_days_str = (form.elements.namedItem('weekly_working_days') as HTMLInputElement)?.value;
    const paid_leave_balance_str = (form.elements.namedItem('paid_leave_balance') as HTMLInputElement)?.value;
    const paid_leave_carryover_str = (form.elements.namedItem('paid_leave_carryover') as HTMLInputElement)?.value;
    const has_kintai_access = (form.elements.namedItem('has_kintai_access') as HTMLInputElement)?.checked;
    const has_shift_access = (form.elements.namedItem('has_shift_access') as HTMLInputElement)?.checked;

    try {
      try {
        const { error } = await supabase
          .from('users')
          .update({
            name: name,
            role: roleStr === '管理者' ? 'admin' : 'user',
            join_date: join_date || null,
            department: department,
            store_name: store_name,
            approver_id: approver_id || null,
            employment_type: employment_type_str === 'パート' ? 'part-time' : 'full-time',
            weekly_working_days: employment_type_str === 'パート' ? parseInt(weekly_days_str) || 3 : 5,
            paid_leave_balance: parseFloat(paid_leave_balance_str || '0'),
            paid_leave_carryover: parseFloat(paid_leave_carryover_str || '0'),
            has_kintai_access: has_kintai_access,
            has_shift_access: has_shift_access
          })
          .eq('id', editingEmployee.id);
        if (error) throw error;
      } catch (dbErr) {
        // 万が一store_nameカラム未定義の場合は除外してフォールバック更新
        const { error } = await supabase
          .from('users')
          .update({
            name: name,
            role: roleStr === '管理者' ? 'admin' : 'user',
            join_date: join_date || null,
            department: department || null,
            approver_id: approver_id || null,
            employment_type: employment_type_str === 'パート' ? 'part-time' : 'full-time',
            weekly_working_days: employment_type_str === 'パート' ? parseInt(weekly_days_str) || 3 : 5,
            paid_leave_balance: parseFloat(paid_leave_balance_str || '0'),
            paid_leave_carryover: parseFloat(paid_leave_carryover_str || '0'),
            has_kintai_access: has_kintai_access,
            has_shift_access: has_shift_access
          })
          .eq('id', editingEmployee.id);
        if (error) throw error;
      }

      // LocalStorageへのバックアップ保存
      try {
        const key = `user_positions_${tenantId}`;
        const currentMap = JSON.parse(localStorage.getItem(key) || '{}');
        currentMap[editingEmployee.id] = {
          ...(currentMap[editingEmployee.id] || {}),
          department: department || undefined,
          store_name: store_name || undefined
        };
        localStorage.setItem(key, JSON.stringify(currentMap));
      } catch {}

      // パート有給算定方式の保存
      const paid_leave_calc_mode = (form.elements.namedItem('paid_leave_calc_mode') as HTMLSelectElement)?.value as ('default' | 'actual_worked' | 'contract_fixed' | undefined);
      if (paid_leave_calc_mode && tenantId) {
        saveUserPaidLeaveCalcMode(tenantId, editingEmployee.id, paid_leave_calc_mode);
        setUserCalcModeMap(prev => ({ ...prev, [editingEmployee.id]: paid_leave_calc_mode }));
      }

      alert('従業員情報を保存しました。');
      
      // Full re-fetch to ensure all UI components and mock calculations are perfectly in sync
      await fetchEmployees();

      handleCloseModal();
    } catch (err: any) {
      console.error('Update Error:', err);
      alert('保存に失敗しました。');
    }
  };

  const handleToggleRetireEmployee = async (emp: any) => {
    if (!emp || !tenantId) return;
    const isCurrentlyRetired = emp.is_retired || emp.status === 'retired';
    
    if (isCurrentlyRetired) {
      if (!window.confirm(`【復職確認】「${emp.name}」さんを在籍（アクティブ）に戻しますか？\n※勤怠・シフトへのアクセスが再開され、課金対象人数に再カウントされます。`)) return;
      try {
        const { error } = await supabase
          .from('users')
          .update({
            has_kintai_access: true,
            has_shift_access: true
          })
          .eq('id', emp.id);

        if (error) throw error;

        // 大元労務マスタ（employee_onboarding_profiles）も在籍へ同期
        try {
          await supabase
            .from('employee_onboarding_profiles')
            .upsert({
              tenant_id: tenantId,
              user_id: emp.id,
              status: 'active',
              join_date: (emp.join_date && emp.join_date !== '-') ? emp.join_date : new Date().toISOString().split('T')[0],
              retirement_date: null,
              retirement_reason: '',
              updated_at: new Date().toISOString()
            }, { onConflict: 'tenant_id,user_id' });
        } catch (onbErr) {
          console.warn('employee_onboarding_profiles reactivate note:', onbErr);
        }

        alert(`「${emp.name}」さんを在籍状態へ復帰しました。`);
        await fetchEmployees();
      } catch (err: any) {
        console.error('Reactivate Error:', err);
        alert('復帰処理に失敗しました: ' + (err.message || ''));
      }
    } else {
      if (!window.confirm(`【退職処理確認】「${emp.name}」さんを退職（無効化）処理しますか？\n※勤怠打刻やシフト申請が停止され、課金対象人数からも自動除外されます。過去の出勤簿・有給台帳・給与記録は法定保管のため安全に保持されます。`)) return;
      try {
        const { error } = await supabase
          .from('users')
          .update({
            has_kintai_access: false,
            has_shift_access: false
          })
          .eq('id', emp.id);

        if (error) throw error;

        // 大元労務マスタ（employee_onboarding_profiles）も退職へ同期
        try {
          await supabase
            .from('employee_onboarding_profiles')
            .upsert({
              tenant_id: tenantId,
              user_id: emp.id,
              status: 'retired',
              join_date: (emp.join_date && emp.join_date !== '-') ? emp.join_date : new Date().toISOString().split('T')[0],
              retirement_date: new Date().toISOString().split('T')[0],
              retirement_reason: '退職',
              updated_at: new Date().toISOString()
            }, { onConflict: 'tenant_id,user_id' });
        } catch (onbErr) {
          console.warn('employee_onboarding_profiles retire note:', onbErr);
        }

        alert(`「${emp.name}」さんを退職処理いたしました。`);
        await fetchEmployees();
      } catch (err: any) {
        console.error('Retire Error:', err);
        alert('退職処理に失敗しました: ' + (err.message || ''));
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <div className="w-full md:w-72 shrink-0 bg-blue-900 text-white flex flex-col print:hidden">
        <div className="p-4 text-xl font-bold border-b border-blue-800">
          管理ダッシュボード
        </div>
        <nav className="flex-1 p-4 flex md:flex-col space-x-2 md:space-x-0 md:space-y-2 overflow-x-auto">
          <button 
            onClick={() => setActiveTab('employees')}
            className={`flex items-center w-full p-2.5 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer ${activeTab === 'employees' ? 'bg-blue-800 font-bold' : 'hover:bg-blue-800/80 text-blue-100'}`}
          >
            <Users className="mr-3 h-5 w-5 shrink-0" />
            <span>従業員管理</span>
          </button>
          <button 
            onClick={() => setActiveTab('attendance')}
            className={`flex items-center w-full p-2.5 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer ${activeTab === 'attendance' ? 'bg-blue-800 font-bold' : 'hover:bg-blue-800/80 text-blue-100'}`}
          >
            <Calendar className="mr-3 h-5 w-5 text-cyan-400 shrink-0" />
            <span>月間勤怠・出勤簿</span>
            {leaveRequests.length > 0 && (
              <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold animate-pulse shadow-sm shrink-0">
                {leaveRequests.length}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('ledger')}
            className={`flex items-center w-full p-2.5 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer ${activeTab === 'ledger' ? 'bg-amber-600 font-bold text-white shadow-sm' : 'hover:bg-blue-800/80 text-blue-100'}`}
          >
            <Coffee className="mr-3 h-5 w-5 text-amber-400 shrink-0" />
            <span>有給・休暇管理</span>
          </button>
          <button 
            onClick={() => setActiveTab('payslips')}
            className={`flex items-center w-full p-2.5 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer ${activeTab === 'payslips' ? 'bg-emerald-700 font-bold text-white shadow-sm' : 'hover:bg-blue-800/80 text-emerald-200'}`}
          >
            <DollarSign className="mr-3 h-5 w-5 text-emerald-400 shrink-0" />
            <span>Web給与明細</span>
          </button>
          <button 
            onClick={() => navigate('/settings/company')}
            className="flex items-center w-full p-2.5 rounded-xl transition-all whitespace-nowrap shrink-0 bg-indigo-800/80 hover:bg-indigo-700 text-indigo-100 font-bold mt-2 shadow-xs cursor-pointer border border-indigo-600/40 hover:border-indigo-400/60"
            title="会社情報、締め日、カレンダー、打刻丸め、36協定アラート、就業規則などの全社マスタ設定"
          >
            <Building2 className="mr-3 h-5 w-5 text-indigo-300 shrink-0" />
            <div className="flex flex-col text-left">
              <span>会社・全社マスタ設定</span>
              <span className="text-[10px] text-indigo-300 font-normal">打刻・36協定・カレンダー等</span>
            </div>
          </button>

          <button 
            onClick={() => navigate('/kintai/user')}
            className="flex items-center w-full p-2 mt-4 rounded transition-colors whitespace-nowrap text-blue-200 hover:bg-blue-800"
          >
            <Clock className="mr-3 h-5 w-5" />
            自分の出退勤画面へ
          </button>
        </nav>
        <div className="p-4 border-t border-blue-800 hidden md:block">
          <button 
            onClick={async () => {
              await supabase.auth.signOut();
              navigate('/');
            }}
            className="flex items-center w-full p-2 hover:bg-blue-800 rounded transition-colors cursor-pointer"
          >
            <LogOut className="mr-3 h-5 w-5" />
            ログアウト
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto relative flex flex-col">
        {/* Top App Bar (全システム統一) */}
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
            <div className="text-xs font-bold text-slate-500">
              {tenantName || '会社名未設定'}
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsHelpOpen(true)}
              className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3.5 py-1.5 rounded-xl flex items-center space-x-1.5 transition font-bold text-xs shadow-xs cursor-pointer"
              title="勤怠管理ダッシュボードの使い方・法令チェック機能を見る"
            >
              <span className="text-sm">❓</span>
              <span>使い方ガイド</span>
            </button>
            <AppSwitcher currentApp="kintai" role="admin" />
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                navigate('/');
              }}
              className="p-2 rounded-full hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
              title="ログアウト"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="p-4 md:p-8 flex-1">
          <div className={`${activeTab === 'ledger' || activeTab === 'attendance' || activeTab === 'employees' ? 'max-w-[1440px]' : 'max-w-6xl'} mx-auto w-full transition-all`}>
            {/* Debug Error Alert */}
          {debugError && (
            <div className="bg-red-50 p-4 rounded-lg shadow-sm border border-red-200 mb-6 print:hidden">
              <h3 className="text-sm font-medium text-red-800">デバッグ用エラー表示（原因特定用）</h3>
              <p className="text-sm font-bold text-red-900 mt-1 select-all break-all">
                {debugError}
              </p>
            </div>
          )}

          {/* Billing Info Alert (SaaS安心・トライアル対応) */}
          {(() => {
            const isTrial = !tenantInfo || tenantInfo.plan_type === 'trial';
            const isFree = tenantInfo?.plan_type === 'free';
            const isPaid = tenantInfo?.plan_type === 'paid';
            const trialEnd = tenantInfo?.trial_ends_at ? new Date(tenantInfo.trial_ends_at) : null;
            const diffDays = trialEnd ? Math.ceil((trialEnd.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;

            return (
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    {isTrial ? (
                      <span className="bg-emerald-100 text-emerald-800 text-xs font-black px-2.5 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1 shadow-2xs">
                        🎁 1ヶ月無料トライアル利用中
                      </span>
                    ) : tenantInfo?.plan_type === 'shift_only' ? (
                      <span className="bg-teal-100 text-teal-800 text-xs font-black px-2.5 py-0.5 rounded-full border border-teal-300 flex items-center gap-1 shadow-2xs">
                        📱 シフト＆LINE単体プラン（¥300/名）
                      </span>
                    ) : tenantInfo?.plan_type === 'kintai_only' ? (
                      <span className="bg-blue-100 text-blue-800 text-xs font-black px-2.5 py-0.5 rounded-full border border-blue-300 flex items-center gap-1 shadow-2xs">
                        💼 勤怠＆労務単体プラン（¥300/名）
                      </span>
                    ) : tenantInfo?.plan_type === 'full_advance' ? (
                      <span className="bg-gradient-to-r from-amber-500 to-indigo-600 text-white text-xs font-black px-2.5 py-0.5 rounded-full border border-amber-400 flex items-center gap-1 shadow-2xs">
                        👑 フルセットプラン（¥500/名・100円引）
                      </span>
                    ) : isFree ? (
                      <span className="bg-blue-100 text-blue-800 text-xs font-black px-2.5 py-0.5 rounded-full border border-blue-300 flex items-center gap-1 shadow-2xs">
                        ✨ 無料プラン利用中
                      </span>
                    ) : (
                      <span className="bg-slate-900 text-white text-xs font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                        👑 有料プラン利用中
                      </span>
                    )}
                  </div>
                  
                  <p className="text-sm font-bold text-gray-800 flex flex-wrap items-center gap-1.5">
                    登録従業員数: <strong className="text-base text-slate-900">{currentUsers}</strong> 名
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      在籍中
                    </span>
                    {retiredCount > 0 && (
                      <span className="text-[11px] text-slate-400 font-medium">
                        （退職者 {retiredCount}名 課金対象外）
                      </span>
                    )}
                    {isPaid && (
                      <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                        {subscriptionResult.modelName}（{tenantInfo?.billing_cycle === 'annual' ? '年額' : '月額'} ¥{subscriptionResult.unitPrice.toLocaleString()}/名）
                      </span>
                    )}
                  </p>

                  {isTrial && (
                    <p className="text-xs text-emerald-700 font-bold">
                      ※現在1ヶ月無料トライアル期間のため、<strong>料金は一切発生いたしません。</strong>
                      {trialEnd ? (
                        diffDays && diffDays > 0 ? ` (残り ${diffDays} 日 / ${trialEnd.toLocaleDateString('ja-JP')} まで全機能使い放題)` : ' (トライアル終了)'
                      ) : ' (無料トライアル適用中)'}
                    </p>
                  )}
                  {isFree && (
                    <p className="text-xs text-blue-700 font-bold">
                      ※無料プラン適用中のため、月額料金は発生いたしません。
                    </p>
                  )}
                </div>

                <div className="sm:text-right bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-xl w-full sm:w-auto flex flex-col sm:items-end gap-2">
                  <div>
                    <h3 className="text-xs font-bold text-gray-500">
                      {isPaid ? (tenantInfo?.billing_cycle === 'annual' ? '今期のご利用料金（年額）' : '今月のご利用料金（月額）') : '今月のお支払い予定額'}
                    </h3>
                    <div className="flex sm:justify-end items-baseline gap-1 mt-0.5">
                      {isPaid ? (
                        <div className="text-right">
                          <p className="text-2xl font-black text-blue-600 font-mono">
                            ¥{calculatedFee.toLocaleString()}
                          </p>
                          <p className="text-[11px] text-slate-500 font-bold mt-0.5">
                            内訳: {subscriptionResult.breakdownText}
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-2xl font-black text-emerald-600 font-mono">¥0</span>
                          <span className="text-xs font-bold text-emerald-700">（無料体験中）</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => navigate('/company/settings?tab=billing')}
                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1 cursor-pointer self-start sm:self-auto shadow-2xs whitespace-nowrap shrink-0"
                  >
                    <span>💳 プラン・決済設定</span>
                  </button>
                </div>
              </div>
            );
          })()}

          {activeTab === 'employees' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-lg font-medium">従業員一覧</h2>
                <button 
                  onClick={() => setIsInviteModalOpen(true)}
                  className="flex items-center bg-blue-600 text-white px-3 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 transition cursor-pointer whitespace-nowrap shrink-0 shadow-xs"
                >
                  <Plus className="h-4 w-4 mr-1 shrink-0" />
                  <span>従業員を招待する</span>
                </button>
              </div>

              <div className="bg-blue-50 p-4 border-b border-blue-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-sm font-bold text-blue-900">従業員の招待方法</h3>
                  <p className="text-sm text-blue-800 mt-1">
                    以下の「招待コード」を従業員に共有してください。<br />
                    従業員が新規登録画面でこのコードを入力すると、あなたの企業に紐づきます。
                  </p>
                </div>
                <div className="bg-white px-4 py-2 rounded border border-blue-200 flex items-center shadow-sm">
                  <span className="text-xs text-gray-500 mr-2">招待コード:</span>
                  <code className="text-sm font-mono font-bold text-gray-900 select-all">
                    {tenantId || '読み込み中...'}
                  </code>
                </div>
              </div>

              <div className="p-4 overflow-x-auto">
                <p className="text-sm text-gray-500 mb-4">
                  ※従業員を追加・削除すると、即座にStripeの請求情報が更新されます。
                </p>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">氏名</th>
                      <th className="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">メールアドレス</th>
                      <th className="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">雇用形態</th>
                      <th className="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">部署</th>
                      <th className="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">入社日</th>
                      <th className="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">承認者</th>
                      <th className="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">権限</th>
                      <th className="px-4 py-3 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">アクション</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {employees.map((emp) => (
                      <tr key={emp.id}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{emp.name}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{emp.email}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          <div>
                            <span>{emp.type}</span>
                            {emp.type === 'パート' && <span className="text-xs ml-1 text-gray-400">(週{emp.weeklyDays}日)</span>}
                          </div>
                          {emp.type === 'パート' && (() => {
                            const userSetting = userCalcModeMap[emp.id];
                            const effectiveMode = (!userSetting || userSetting === 'default') ? companyCalcMode : userSetting;
                            return (
                              <div className="mt-0.5">
                                {effectiveMode === 'actual_worked' ? (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-black text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                    ⚡ 打刻実績逆算
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-black text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                                    🏷️ 契約固定
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          <div>{emp.department}</div>
                          {emp.store_name && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded mt-0.5">
                              🏪 {emp.store_name}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{emp.join_date}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{emp.manager}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${emp.role === '管理者' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'} mr-1.5`}>
                            {emp.role}
                          </span>
                          {emp.is_retired && (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-slate-100 text-slate-600 border border-slate-300">
                              退職済
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium">
                          <button onClick={() => handleOpenModal(emp)} className="text-blue-600 hover:text-blue-900 mr-3 cursor-pointer">編集</button>
                          <button 
                            onClick={() => handleToggleRetireEmployee(emp)} 
                            className={`cursor-pointer font-bold ${emp.is_retired ? 'text-emerald-600 hover:text-emerald-800' : 'text-rose-600 hover:text-rose-800'}`}
                            title={emp.is_retired ? '在籍へ戻す（復職）' : '退職処理する'}
                          >
                            {emp.is_retired ? '復職' : '退職'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'ledger' && (
            <PaidLeaveManagement tenantId={tenantId} onRefreshEmployees={fetchEmployees} />
          )}

          {activeTab === 'attendance' && (
            <MonthlyAttendanceManagement 
              tenantId={tenantId} 
              onRefreshRequests={fetchRequests} 
              initialMonth={searchParams.get('month') || undefined} 
            />
          )}

          {activeTab === 'payslips' && (
            <PayslipManagement tenantId={tenantId} />
          )}
        </div>
      </div>
    </div>

      {/* Invite Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50">
          <div className="bg-white rounded-lg text-left overflow-hidden shadow-xl w-full max-w-md flex flex-col">
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  従業員を招待する
                </h3>
                <button onClick={() => setIsInviteModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="mb-4 bg-blue-50 p-4 rounded-md border border-blue-100">
                <p className="text-sm text-blue-800">
                  以下の案内文をコピーして、従業員が普段使っているLINEやメールなどに直接貼り付けて送信してください。
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <textarea 
                    readOnly
                    value={inviteMessage}
                    rows={8}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-gray-50" 
                  />
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-4 py-3 sm:px-6 flex justify-end space-x-3 border-t">
              <button type="button" onClick={() => setIsInviteModalOpen(false)} className="inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm">
                閉じる
              </button>
              <button 
                type="button" 
                onClick={handleCopyInvite} 
                className={`inline-flex justify-center items-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 sm:text-sm transition-colors ${copySuccess ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500' : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'}`}
              >
                {copySuccess ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-1" />
                    コピーしました！
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-1" />
                    案内文をコピーする
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Employee Modal (Edit only now) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50">
          <div className="bg-white rounded-lg text-left overflow-hidden shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                  従業員情報の編集
                </h3>
                <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-500">
                  <X className="h-6 w-6" />
                </button>
              </div>
              <form id="employeeForm" onSubmit={handleSaveEmployee} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">氏名</label>
                  <input name="name" type="text" defaultValue={editingEmployee?.name || ''} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">メールアドレス</label>
                  <input type="email" defaultValue={editingEmployee?.email || ''} readOnly className="mt-1 block w-full border border-gray-300 bg-gray-100 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">権限</label>
                  <select name="role" defaultValue={editingEmployee?.role === 'admin' || editingEmployee?.role === '管理者' ? '管理者' : '一般'} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                    <option value="一般">一般</option>
                    <option value="管理者">管理者</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">入社日</label>
                  <input name="join_date" type="date" defaultValue={editingEmployee?.join_date !== '-' ? editingEmployee?.join_date : ''} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                  <p className="mt-1 text-xs text-gray-500">この日付を基準に、半年後や1年後の有給付与日数が自動計算されます。</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">雇用形態</label>
                  <select name="employment_type" defaultValue={editingEmployee?.type || '正社員'} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" onChange={(e) => {
                    const nextType = e.target.value;
                    if (editingEmployee) {
                      setEditingEmployee({...editingEmployee, type: nextType});
                    }
                  }}>
                    <option value="正社員">正社員</option>
                    <option value="パート">パート・アルバイト</option>
                  </select>
                </div>
                {(editingEmployee?.type === 'パート') && (
                  <div className="bg-amber-50/80 p-4 rounded-xl border border-amber-200 space-y-3">
                    <div>
                      <label className="block text-xs font-black text-amber-950 flex items-center gap-1.5">
                        <span className="p-1 bg-amber-500 text-white rounded text-[10px]">⚡</span>
                        パート有給休暇の算定方式（労基法第39条第3項 比例付与）
                      </label>
                      <select
                        name="paid_leave_calc_mode"
                        defaultValue={userCalcModeMap[editingEmployee?.id] || 'default'}
                        className="mt-1.5 block w-full border border-amber-300 rounded-lg shadow-xs py-2 px-3 focus:outline-none focus:ring-amber-500 focus:border-amber-500 text-xs bg-white font-bold text-slate-800"
                      >
                        <option value="default">
                          🏢 全社設定に従う（現在: {companyCalcMode === 'actual_worked' ? '⚡ 打刻実績から自動逆算' : '🏷️ 雇用契約の週日数固定'}）
                        </option>
                        <option value="actual_worked">
                          ⚡ 実際の勤務打刻から自動逆算（シフト変動パート推奨・厚労省通達準拠）
                        </option>
                        <option value="contract_fixed">
                          🏷️ 雇用契約の週所定労働日数で固定（固定シフト推奨）
                        </option>
                      </select>
                      <p className="mt-1 text-[11px] text-amber-800 font-medium">
                        ※シフト変動等で勤務日数が固定でない場合、過去の打刻実績（年間出勤日数）から自動算定します。
                      </p>
                    </div>

                    <div className="pt-2 border-t border-amber-200/70">
                      <label className="block text-xs font-bold text-slate-700">週の所定労働日数（雇用契約上の目安）</label>
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          name="weekly_working_days"
                          type="number"
                          defaultValue={editingEmployee?.weeklyDays || 3}
                          min={1}
                          max={5}
                          className="block w-24 border border-slate-300 rounded-lg shadow-xs py-1.5 px-3 focus:outline-none focus:ring-amber-500 focus:border-amber-500 text-xs font-black text-slate-800 bg-white"
                        />
                        <span className="text-xs text-slate-600 font-bold">日 / 週</span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        ※「雇用契約で固定」時、または打刻実績がまだない初期付与時の算定基準となります。
                      </p>
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700">部署（本部・組織）</label>
                  <input name="department" type="text" defaultValue={editingEmployee?.department !== '-' ? editingEmployee?.department : ''} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" placeholder="例: 店舗運営部、総務・人事部" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">所属店舗（シフト勤務先拠点）</label>
                  <select
                    name="store_name"
                    defaultValue={editingEmployee?.store_name || ''}
                    className="mt-1 block w-full border border-indigo-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white font-bold text-slate-800"
                  >
                    <option value="">（店舗なし / 本部所属・シフト対象外）</option>
                    {availableStores.map(s => (
                      <option key={s.id} value={s.name}>
                        🏪 {s.name}{s.code ? ` (${s.code})` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">※ 総務・人事・経理などの本部スタッフは「店舗なし」を選択してください。店舗を選択したスタッフのみ各店舗シフトカレンダーに表示されます。</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">承認者（上司）</label>
                  <select name="approver_id" defaultValue={editingEmployee?.approver_id || ''} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                    <option value="">（なし）</option>
                    {employees.filter(emp => emp.role === '管理者' || emp.id !== editingEmployee?.id).map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} {emp.role === '管理者' ? '（管理者）' : ''}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">有給申請などを承認する担当者を選択します。</p>
                </div>
                <div className="grid grid-cols-2 gap-4 border-t border-gray-200 pt-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">勤怠・有給管理 アクセス権限</label>
                    <div className="mt-2 flex items-center">
                      <input name="has_kintai_access" type="checkbox" defaultChecked={editingEmployee?.has_kintai_access ?? true} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                      <span className="ml-2 text-sm text-gray-700">利用を許可する</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">シフト管理 アクセス権限</label>
                    <div className="mt-2 flex items-center">
                      <input name="has_shift_access" type="checkbox" defaultChecked={editingEmployee?.has_shift_access ?? false} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                      <span className="ml-2 text-sm text-gray-700">利用を許可する</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 border-t border-gray-200 pt-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">今年度 有給残日数（初期設定）</label>
                    <input name="paid_leave_balance" type="number" step="0.5" defaultValue={editingEmployee?.paidLeaveBalance || 0} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">前年度 繰越日数（初期設定）</label>
                    <input name="paid_leave_carryover" type="number" step="0.5" defaultValue={editingEmployee?.paidLeaveCarryover || 0} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                  </div>
                </div>
                <p className="text-xs text-gray-500">※システムの導入時など、現在の有給残日数を手動で調整する場合に使用します。</p>
              </form>
            </div>
            <div className="bg-gray-50 px-4 py-3 sm:px-6 flex justify-end space-x-3 border-t">
              <button type="button" onClick={handleCloseModal} className="inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm">
                キャンセル
              </button>
              <button type="submit" form="employeeForm" className="inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm">
                保存する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ❓ 使い方ガイドモーダル */}
      <HelpGuideModal 
        screenKey="attendance_admin" 
        isOpen={isHelpOpen} 
        onClose={() => setIsHelpOpen(false)} 
      />
    </div>
  );
};

export default AdminDashboard;


