import { useState, useEffect } from 'react';
import { Users, FileText, Settings, LogOut, Plus, X, Calendar, Coffee, CheckCircle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { PaidLeaveManagement } from '../components/PaidLeaveManagement';
import { MonthlyAttendanceManagement } from '../components/MonthlyAttendanceManagement';

// 2026年の日本の祝日（簡易モック用リスト）
const NATIONAL_HOLIDAYS_2026 = [
  '2026-1-1', '2026-1-12', '2026-2-11', '2026-2-23', '2026-3-20', '2026-4-29', 
  '2026-5-3', '2026-5-4', '2026-5-5', '2026-5-6', '2026-7-20', '2026-8-11', 
  '2026-9-21', '2026-9-22', '2026-9-23', '2026-10-12', '2026-11-3', '2026-11-23'
];

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('employees');
  const [settingsTab, setSettingsTab] = useState('basic');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: tenantIdData, error } = await supabase.rpc('get_user_tenant_id');
        if (tenantIdData) {
          setTenantId(tenantIdData);
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

  // 打刻の丸め単位（1分、15分、30分）
  const [roundingUnit, setRoundingUnit] = useState<number>(() => {
    const saved = localStorage.getItem('mock_rounding_unit');
    return saved ? parseInt(saved) : 15;
  });

  const handleRoundingChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = parseInt(e.target.value);
    setRoundingUnit(val);
    localStorage.setItem('mock_rounding_unit', val.toString());
  };

  const handleSaveBasicSettings = async () => {
    if (!tenantId) return;
    try {
      const { error } = await supabase.from('tenants').update({ name: tenantName }).eq('id', tenantId);
      if (error) throw error;
      alert('基本設定を保存しました。');
    } catch (err: any) {
      console.error('Update Error:', err);
      alert('保存に失敗しました。');
    }
  };

  // Holiday States
  const [holidays, setHolidays] = useState<Set<string>>(new Set());
  const [customHolidaysList, setCustomHolidaysList] = useState<{date: string, name: string}[]>([
    { date: '2026-10-01', name: '創立記念日' }
  ]);
  const [newCustomDate, setNewCustomDate] = useState('');
  const [newCustomName, setNewCustomName] = useState('');

  // Bulk Rule States
  const [ruleFixedDays, setRuleFixedDays] = useState<number[]>([0, 6]); // 0=Sun, 1=Mon... 6=Sat
  const [ruleNationalHolidays, setRuleNationalHolidays] = useState(true);
  
  const [ruleWinterEnabled, setRuleWinterEnabled] = useState(true);
  const [ruleWinterStart, setRuleWinterStart] = useState('2026-12-29');
  const [ruleWinterEnd, setRuleWinterEnd] = useState('2027-01-03');
  
  const [ruleSummerEnabled, setRuleSummerEnabled] = useState(true);
  const [ruleSummerStart, setRuleSummerStart] = useState('2026-08-13');
  const [ruleSummerEnd, setRuleSummerEnd] = useState('2026-08-15');

  // Helper to generate dates between two dates
  const getDatesBetween = (startStr: string, endStr: string) => {
    const dates = [];
    let current = new Date(startStr);
    const end = new Date(endStr);
    while (current <= end) {
      dates.push(`${current.getFullYear()}-${current.getMonth() + 1}-${current.getDate()}`);
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  const applyRulesLogic = () => {
    const newHolidays = new Set<string>();
    
    // 1. 固定曜日
    for (let m = 0; m < 12; m++) {
      const daysInMonth = new Date(2026, m + 1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(2026, m, d);
        if (ruleFixedDays.includes(date.getDay())) {
          newHolidays.add(`2026-${m+1}-${d}`);
        }
      }
    }

    // 2. 国民の祝日
    if (ruleNationalHolidays) {
      NATIONAL_HOLIDAYS_2026.forEach(h => newHolidays.add(h));
    }

    // 3. 長期休暇（年末年始）
    if (ruleWinterEnabled && ruleWinterStart && ruleWinterEnd) {
      getDatesBetween(ruleWinterStart, ruleWinterEnd).forEach(h => newHolidays.add(h));
    }

    // 4. 長期休暇（夏季休暇）
    if (ruleSummerEnabled && ruleSummerStart && ruleSummerEnd) {
      getDatesBetween(ruleSummerStart, ruleSummerEnd).forEach(h => newHolidays.add(h));
    }

    // 5. 独自の休日（常に適用）
    customHolidaysList.forEach(h => {
      const [y, m, d] = h.date.split('-');
      newHolidays.add(`${y}-${parseInt(m)}-${parseInt(d)}`);
    });

    setHolidays(newHolidays);
    
    // 他の画面（ユーザーダッシュボードなど）とモックデータを連携するためにローカルストレージに保存
    localStorage.setItem('mock_company_holidays', JSON.stringify(Array.from(newHolidays)));
  };

  // Initial mockup holidays
  useEffect(() => {
    applyRulesLogic();
  }, []);

  // Dynamic Data States
  const [employees, setEmployees] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);

  const fetchLeaveTypes = async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from('leave_types')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });
    
    if (data) {
      setLeaveTypes(data);
    }
  };

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

        return {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role === 'admin' ? '管理者' : '一般',
          department: u.department || '-',
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
          has_shift_access: u.has_shift_access ?? false
        };
      });
      setEmployees(mapped);
    }
    if (error) {
      setDebugError('Employees Fetch Error: ' + error.message);
    }
  };

  useEffect(() => {
    const fetchTenantName = async () => {
      if (!tenantId) return;
      const { data } = await supabase.from('tenants').select('name').eq('id', tenantId).single();
      if (data) setTenantName(data.name);
    };
    fetchTenantName();
    fetchEmployees();
    fetchLeaveTypes();
  }, [tenantId]);

  const fetchRequests = async () => {
    if (!tenantId) return;
    try {
      const { data: requests, error } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', '申請中')
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

  const currentUsers = employees.length;
  const planLimit = 5;
  const monthlyFee = 2000 + (Math.max(0, currentUsers - planLimit) * 500);

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
    const department = (form.elements.namedItem('department') as HTMLInputElement).value;
    const approver_id = (form.elements.namedItem('approver_id') as HTMLSelectElement).value;
    const employment_type_str = (form.elements.namedItem('employment_type') as HTMLSelectElement).value;
    const weekly_days_str = (form.elements.namedItem('weekly_working_days') as HTMLInputElement)?.value;
    const paid_leave_balance_str = (form.elements.namedItem('paid_leave_balance') as HTMLInputElement)?.value;
    const paid_leave_carryover_str = (form.elements.namedItem('paid_leave_carryover') as HTMLInputElement)?.value;
    const has_kintai_access = (form.elements.namedItem('has_kintai_access') as HTMLInputElement)?.checked;
    const has_shift_access = (form.elements.namedItem('has_shift_access') as HTMLInputElement)?.checked;

    try {
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

      alert('従業員情報を保存しました。');
      
      // Full re-fetch to ensure all UI components and mock calculations are perfectly in sync
      await fetchEmployees();

      handleCloseModal();
    } catch (err: any) {
      console.error('Update Error:', err);
      alert('保存に失敗しました。');
    }
  };

  const handleAddLeaveType = async () => {
    if (!tenantId) return;
    const nameInput = document.getElementById('newLeaveName') as HTMLInputElement;
    const isPaidInput = document.getElementById('newLeaveIsPaid') as HTMLInputElement;
    const isHalfDayInput = document.getElementById('newLeaveIsHalfDay') as HTMLInputElement;
    
    if (!nameInput.value) return;

    const { error } = await supabase.from('leave_types').insert({
      tenant_id: tenantId,
      name: nameInput.value,
      is_paid: isPaidInput.checked,
      is_half_day: isHalfDayInput.checked
    });

    if (error) {
      alert('追加に失敗しました: ' + error.message);
    } else {
      nameInput.value = '';
      fetchLeaveTypes();
    }
  };

  const handleDeleteLeaveType = async (id: string) => {
    if (!confirm('本当に削除しますか？')) return;
    const { error } = await supabase.from('leave_types').delete().eq('id', id);
    if (error) {
      alert('削除に失敗しました: ' + error.message);
    } else {
      fetchLeaveTypes();
    }
  };

  const handleApplyRules = () => {
    applyRulesLogic();
    alert('設定したルールに基づいて、カレンダーの休日を自動設定しました！');
  };

  const toggleHoliday = (m: number, d: number) => {
    const key = `2026-${m}-${d}`;
    const newSet = new Set(holidays);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setHolidays(newSet);
  };

  const handleAddCustomHoliday = () => {
    if (!newCustomDate || !newCustomName) return;
    setCustomHolidaysList([...customHolidaysList, { date: newCustomDate, name: newCustomName }]);
    const [y, m, d] = newCustomDate.split('-');
    const key = `${y}-${parseInt(m)}-${parseInt(d)}`;
    const newSet = new Set(holidays);
    newSet.add(key);
    setHolidays(newSet);
    setNewCustomDate('');
    setNewCustomName('');
  };

  const handleDeleteCustomHoliday = (index: number) => {
    const list = [...customHolidaysList];
    const removed = list.splice(index, 1)[0];
    setCustomHolidaysList(list);
    
    const [y, m, d] = removed.date.split('-');
    const key = `${y}-${parseInt(m)}-${parseInt(d)}`;
    const newSet = new Set(holidays);
    newSet.delete(key);
    setHolidays(newSet);
  };

  const toggleFixedDay = (dayIndex: number) => {
    if (ruleFixedDays.includes(dayIndex)) {
      setRuleFixedDays(ruleFixedDays.filter(d => d !== dayIndex));
    } else {
      setRuleFixedDays([...ruleFixedDays, dayIndex]);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <div className="w-full md:w-64 bg-blue-900 text-white flex flex-col print:hidden">
        <div className="p-4 text-xl font-bold border-b border-blue-800">
          管理ダッシュボード
        </div>
        <nav className="flex-1 p-4 flex md:flex-col space-x-2 md:space-x-0 md:space-y-2 overflow-x-auto">
          <button 
            onClick={() => setActiveTab('employees')}
            className={`flex items-center w-full p-2 rounded transition-colors whitespace-nowrap ${activeTab === 'employees' ? 'bg-blue-800' : 'hover:bg-blue-800'}`}
          >
            <Users className="mr-3 h-5 w-5" />
            従業員管理
          </button>
          <button 
            onClick={() => setActiveTab('attendance')}
            className={`flex items-center w-full p-2 rounded transition-colors whitespace-nowrap ${activeTab === 'attendance' ? 'bg-blue-800 font-bold' : 'hover:bg-blue-800'}`}
          >
            <Calendar className="mr-3 h-5 w-5 text-cyan-400" />
            月間勤怠・出勤簿管理
            {leaveRequests.length > 0 && (
              <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold animate-pulse shadow-sm">
                {leaveRequests.length}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('ledger')}
            className={`flex items-center w-full p-2 rounded transition-colors whitespace-nowrap ${activeTab === 'ledger' ? 'bg-amber-600 font-bold' : 'hover:bg-blue-800'}`}
          >
            <Coffee className="mr-3 h-5 w-5 text-amber-400" />
            有給・休暇管理システム
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex items-center w-full p-2 rounded transition-colors whitespace-nowrap ${activeTab === 'settings' ? 'bg-blue-800' : 'hover:bg-blue-800'}`}
          >
            <Settings className="mr-3 h-5 w-5" />
            会社・システム設定
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
            onClick={() => navigate('/')}
            className="flex items-center w-full p-2 hover:bg-blue-800 rounded transition-colors"
          >
            <LogOut className="mr-3 h-5 w-5" />
            ログアウト
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-8 overflow-auto relative">
        <div className="max-w-6xl mx-auto">
          
          {/* Debug Error Alert */}
          {debugError && (
            <div className="bg-red-50 p-4 rounded-lg shadow-sm border border-red-200 mb-6 print:hidden">
              <h3 className="text-sm font-medium text-red-800">デバッグ用エラー表示（原因特定用）</h3>
              <p className="text-sm font-bold text-red-900 mt-1 select-all break-all">
                {debugError}
              </p>
            </div>
          )}

          {/* Billing Info Alert */}
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
            <div>
              <h3 className="text-sm font-medium text-gray-500">現在のご利用状況（自動課金）</h3>
              <p className="text-lg font-bold text-gray-900 mt-1">
                登録人数: {currentUsers}名 <span className="text-sm font-normal text-gray-500">(基本枠 {planLimit}名)</span>
              </p>
            </div>
            <div className="sm:text-right">
              <h3 className="text-sm font-medium text-gray-500">今月の想定請求額</h3>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                ¥{monthlyFee.toLocaleString()}
              </p>
            </div>
          </div>

          {activeTab === 'employees' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-lg font-medium">従業員一覧</h2>
                <button 
                  onClick={() => setIsInviteModalOpen(true)}
                  className="flex items-center bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700 transition"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  従業員を招待する
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
                          {emp.type}
                          {emp.type === 'パート' && <span className="text-xs ml-1 text-gray-400">(週{emp.weeklyDays}日)</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{emp.department}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{emp.join_date}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{emp.manager}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${emp.role === '管理者' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'}`}>
                            {emp.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium">
                          <button onClick={() => handleOpenModal(emp)} className="text-blue-600 hover:text-blue-900 mr-3">編集</button>
                          <button className="text-red-600 hover:text-red-900">削除</button>
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
            <MonthlyAttendanceManagement tenantId={tenantId} onRefreshRequests={fetchRequests} />
          )}

          {activeTab === 'settings' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 print:p-0 print:border-none print:shadow-none">
              <h2 className="text-lg font-medium mb-4 print:hidden">会社・システム設定</h2>
              
              <div className="flex space-x-4 border-b border-gray-200 mb-6 print:hidden">
                <button
                  className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${settingsTab === 'basic' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                  onClick={() => setSettingsTab('basic')}
                >
                  基本設定
                </button>
                <button
                  className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${settingsTab === 'leave' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                  onClick={() => setSettingsTab('leave')}
                >
                  休暇・有給設定
                </button>
                <button
                  className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${settingsTab === 'calendar' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                  onClick={() => setSettingsTab('calendar')}
                >
                  会社カレンダー
                </button>
              </div>

              <div className="space-y-8 max-w-4xl">
                {settingsTab === 'leave' && (
                <div className="space-y-8 max-w-2xl">
                  <div className="space-y-4">
                    <h3 className="text-md font-medium text-gray-800 border-b pb-2">有給休暇付与基準</h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">正社員の付与基準設定</label>
                      <select className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md border">
                        <option>法定基準通り（入社半年後に10日付与）</option>
                        <option>入社時即日付与（入社時に10日付与）</option>
                        <option>独自設定（カスタマイズ）</option>
                      </select>
                      <p className="mt-1 text-xs text-gray-500">※「独自設定」の場合、入社年数に応じた付与テーブルを細かく設定可能です。</p>
                    </div>
                  </div>

                  <div className="space-y-4 mt-8">
                    <h3 className="text-md font-medium text-gray-800 border-b pb-2">休暇種類マスタ（カスタマイズ）</h3>
                    <p className="text-sm text-gray-500">有給・無給や、半休の可否を設定できます。ユーザーの申請画面で選択可能になります。</p>
                    
                    <div className="flex gap-2 mb-4">
                      <input type="text" id="newLeaveName" placeholder="新しい休暇名（例: 特別休暇）" className="flex-1 border-gray-300 rounded-md border p-2 text-sm" />
                      <label className="flex items-center text-sm gap-1">
                        <input type="checkbox" id="newLeaveIsPaid" defaultChecked className="rounded border-gray-300" />
                        有給
                      </label>
                      <label className="flex items-center text-sm gap-1 ml-2">
                        <input type="checkbox" id="newLeaveIsHalfDay" className="rounded border-gray-300" />
                        半休可
                      </label>
                      <button 
                        onClick={handleAddLeaveType}
                        className="bg-blue-600 text-white px-4 py-1 ml-2 rounded text-sm hover:bg-blue-700"
                      >追加</button>
                    </div>

                    <table className="min-w-full divide-y divide-gray-200 border">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">名称</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">有給/無給</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">半休可否</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">操作</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {leaveTypes.length === 0 ? (
                          <tr><td colSpan={4} className="px-4 py-4 text-center text-sm text-gray-500">休暇種類が設定されていません</td></tr>
                        ) : (
                          leaveTypes.map(lt => (
                            <tr key={lt.id}>
                              <td className="px-4 py-2 text-sm text-gray-900">{lt.name}</td>
                              <td className="px-4 py-2 text-center text-sm text-gray-500">{lt.is_paid ? '有給' : '無給'}</td>
                              <td className="px-4 py-2 text-center text-sm text-gray-500">{lt.is_half_day ? '可' : '不可'}</td>
                              <td className="px-4 py-2 text-right text-sm">
                                <button onClick={() => handleDeleteLeaveType(lt.id)} className="text-red-600 hover:text-red-800">削除</button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                )}

                {settingsTab === 'basic' && (
                <div className="space-y-4 max-w-lg">
                  <h3 className="text-md font-medium text-gray-800 border-b pb-2">基本設定</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">会社名（テナント名）</label>
                    <input 
                      type="text" 
                      value={tenantName} 
                      onChange={(e) => setTenantName(e.target.value)}
                      className="mt-1 block w-full pl-3 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm" 
                    />
                    <p className="mt-1 text-xs text-gray-500">※カレンダーの印刷タイトル等にリアルタイムで反映されます。</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mt-4">打刻の丸め単位</label>
                    <select 
                      value={roundingUnit} 
                      onChange={handleRoundingChange}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md border"
                    >
                      <option value={1}>1分単位（丸めなし）</option>
                      <option value={15}>15分単位（出勤:切り上げ, 退勤:切り捨て）</option>
                      <option value={30}>30分単位（出勤:切り上げ, 退勤:切り捨て）</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500">※従業員のタイムカード（打刻）に適用される計算単位です。</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mt-4">締め日</label>
                    <select className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md border">
                      <option>末日</option>
                      <option>15日</option>
                      <option>20日</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">残業アラート基準（時間）</label>
                    <div className="space-y-3 bg-gray-50 p-4 rounded-md border border-gray-200">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-yellow-600 flex items-center w-24">
                          <span className="w-2 h-2 rounded-full bg-yellow-400 mr-2"></span>注意
                        </span>
                        <div className="flex items-center">
                          <input type="number" defaultValue={20} className="block w-20 pl-3 pr-2 py-1 border border-gray-300 rounded-md shadow-sm focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm text-right" />
                          <span className="ml-2 text-sm text-gray-500">時間超過</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-orange-600 flex items-center w-24">
                          <span className="w-2 h-2 rounded-full bg-orange-400 mr-2"></span>危険
                        </span>
                        <div className="flex items-center">
                          <input type="number" defaultValue={40} className="block w-20 pl-3 pr-2 py-1 border border-gray-300 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm text-right" />
                          <span className="ml-2 text-sm text-gray-500">時間超過</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-red-600 flex items-center w-24">
                          <span className="w-2 h-2 rounded-full bg-red-600 mr-2"></span>超過/禁止
                        </span>
                        <div className="flex items-center">
                          <input type="number" defaultValue={60} className="block w-20 pl-3 pr-2 py-1 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm text-right" />
                          <span className="ml-2 text-sm text-gray-500">時間超過</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">代休有効期限（ヶ月）</label>
                      <input type="number" defaultValue={1} className="mt-1 block w-full pl-3 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                      <p className="mt-1 text-xs text-gray-500">※休日出勤に対する代休</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">振休有効期限（ヶ月）</label>
                      <input type="number" defaultValue={2} className="mt-1 block w-full pl-3 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                      <p className="mt-1 text-xs text-gray-500">※事前の振替休日</p>
                    </div>
                  </div>
                  <button onClick={handleSaveBasicSettings} className="bg-blue-600 text-white px-4 py-2 mt-4 rounded hover:bg-blue-700 text-sm font-medium">
                    設定を保存
                  </button>
                </div>
                )}

                {settingsTab === 'calendar' && (
                <div className="space-y-4">
                  <div className="hidden print:block mb-6 text-center">
                    <h1 className="text-2xl font-bold text-gray-800">{tenantName ? `${tenantName} 2026年度カレンダー` : '会社カレンダー (2026年度)'}</h1>
                  </div>
                  <div className="flex justify-between items-end border-b pb-2 print:hidden">
                    <h3 className="text-md font-medium text-gray-800">会社休日設定（カレンダー）</h3>
                    <div className="flex items-end space-x-4">
                      <div className="text-right">
                        <p className="text-sm text-gray-500">2026年度 年間休日（土日祝＋独自休日）</p>
                        <p className="text-xl font-bold text-blue-600">合計 {holidays.size} 日</p>
                      </div>
                      <button 
                        onClick={() => window.print()} 
                        className="mb-1 text-sm bg-gray-600 hover:bg-gray-700 text-white px-4 py-1.5 rounded shadow-sm flex items-center transition"
                      >
                        <FileText className="w-4 h-4 mr-1" />
                        PDF出力 (印刷)
                      </button>
                    </div>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-md border border-blue-100 mb-6 space-y-4 print:hidden">
                    <h4 className="text-sm font-bold text-blue-900 border-b border-blue-200 pb-2">一括設定ルール</h4>
                    
                    <div>
                      <span className="block text-sm font-medium text-blue-800 mb-2">固定休日（曜日）</span>
                      <div className="flex flex-wrap gap-3">
                        {['日', '月', '火', '水', '木', '金', '土'].map((day, index) => (
                          <label key={day} className="inline-flex items-center">
                            <input 
                              type="checkbox" 
                              checked={ruleFixedDays.includes(index)}
                              onChange={() => toggleFixedDay(index)}
                              className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" 
                            />
                            <span className="ml-2 text-sm text-gray-700">{day}曜</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="block text-sm font-medium text-blue-800 mb-2">祝日・長期休暇</span>
                      <div className="space-y-4">
                        <label className="inline-flex items-center">
                          <input 
                            type="checkbox" 
                            checked={ruleNationalHolidays}
                            onChange={(e) => setRuleNationalHolidays(e.target.checked)}
                            className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" 
                          />
                          <span className="ml-2 text-sm text-gray-700">国民の祝日をすべて休日に設定する</span>
                        </label>
                        
                        <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                          <div className="flex items-center">
                            <input 
                              type="checkbox" 
                              checked={ruleWinterEnabled}
                              onChange={(e) => setRuleWinterEnabled(e.target.checked)}
                              className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" 
                            />
                            <span className="ml-2 text-sm text-gray-700 w-24">年末年始休暇:</span>
                          </div>
                          <div className="flex items-center">
                            <input 
                              type="date" 
                              value={ruleWinterStart}
                              onChange={(e) => setRuleWinterStart(e.target.value)}
                              className="block w-36 pl-2 pr-2 py-1 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-xs" 
                            />
                            <span className="text-gray-500 mx-2">〜</span>
                            <input 
                              type="date" 
                              value={ruleWinterEnd}
                              onChange={(e) => setRuleWinterEnd(e.target.value)}
                              className="block w-36 pl-2 pr-2 py-1 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-xs" 
                            />
                          </div>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                          <div className="flex items-center">
                            <input 
                              type="checkbox" 
                              checked={ruleSummerEnabled}
                              onChange={(e) => setRuleSummerEnabled(e.target.checked)}
                              className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" 
                            />
                            <span className="ml-2 text-sm text-gray-700 w-24">夏季休暇:</span>
                          </div>
                          <div className="flex items-center">
                            <input 
                              type="date" 
                              value={ruleSummerStart}
                              onChange={(e) => setRuleSummerStart(e.target.value)}
                              className="block w-36 pl-2 pr-2 py-1 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-xs" 
                            />
                            <span className="text-gray-500 mx-2">〜</span>
                            <input 
                              type="date" 
                              value={ruleSummerEnd}
                              onChange={(e) => setRuleSummerEnd(e.target.value)}
                              className="block w-36 pl-2 pr-2 py-1 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-xs" 
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button 
                        onClick={handleApplyRules}
                        className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 transition"
                      >
                        ルールをカレンダーに適用
                      </button>
                    </div>
                  </div>

                  {/* 独自の休日追加エリア */}
                  <div className="mb-6 print:hidden">
                    <h3 className="text-md font-medium text-gray-800 mb-4">特定の休日（創立記念日など）を追加</h3>
                    <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 max-w-2xl mb-4">
                      <input 
                        type="date" 
                        value={newCustomDate}
                        onChange={(e) => setNewCustomDate(e.target.value)}
                        className="block w-full sm:w-48 pl-3 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm" 
                      />
                      <input 
                        type="text" 
                        value={newCustomName}
                        onChange={(e) => setNewCustomName(e.target.value)}
                        placeholder="休日の名称（例：創立記念日）" 
                        className="block flex-1 pl-3 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm" 
                      />
                      <button 
                        onClick={handleAddCustomHoliday}
                        className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-900 text-sm font-medium whitespace-nowrap transition"
                      >
                        リストに追加
                      </button>
                    </div>

                    <div className="border rounded-md overflow-hidden max-w-2xl">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">日付</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">名称</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {customHolidaysList.map((h, index) => (
                            <tr key={index}>
                              <td className="px-4 py-2 text-sm text-gray-900">{h.date}</td>
                              <td className="px-4 py-2 text-sm text-gray-500">{h.name}</td>
                              <td className="px-4 py-2 text-sm text-right">
                                <button 
                                  onClick={() => handleDeleteCustomHoliday(index)}
                                  className="text-red-600 hover:text-red-900 text-xs font-medium"
                                >
                                  削除
                                </button>
                              </td>
                            </tr>
                          ))}
                          {customHolidaysList.length === 0 && (
                            <tr>
                              <td colSpan={3} className="px-4 py-4 text-sm text-gray-500 text-center">登録された独自の休日はありません</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <p className="text-sm text-gray-500 mb-4 print:hidden">
                    ※設定適用後でも、下のカレンダーの日付をクリックすることで、個別に「出勤日・休日」を切り替えることができます。
                  </p>
                  
                  {/* 年間カレンダーモックアップ */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 print:grid-cols-3 print:scale-90 print:origin-top print:gap-2">
                    {Array.from({ length: 12 }).map((_, monthIndex) => {
                      const daysInMonth = new Date(2026, monthIndex + 1, 0).getDate();
                      
                      return (
                        <div key={monthIndex} className="border border-gray-200 rounded-xl shadow-md bg-white overflow-hidden print:shadow-none print:border-gray-300 print:bg-transparent">
                          <div className="text-center py-1.5 bg-blue-50 text-blue-900 font-bold border-b border-gray-100 print:bg-transparent print:text-gray-800 print:border-gray-300">
                            {monthIndex + 1}月
                          </div>
                          <div className="bg-gray-50 py-1 border-b border-gray-100 print:bg-transparent print:border-gray-300">
                            <div className="grid grid-cols-7 gap-1 text-center text-xs px-2">
                              <div className="text-red-500 font-medium">日</div><div className="font-medium">月</div><div className="font-medium">火</div><div className="font-medium">水</div><div className="font-medium">木</div><div className="font-medium">金</div><div className="text-blue-500 font-medium">土</div>
                            </div>
                          </div>
                          <div className="grid grid-cols-7 gap-1 text-center text-xs p-2">
                            {/* 空白セル（月初の曜日合わせ） */}
                            {Array.from({ length: new Date(2026, monthIndex, 1).getDay() }).map((_, i) => (
                              <div key={`empty-${i}`}></div>
                            ))}
                            {/* カレンダーの日付 */}
                            {Array.from({ length: daysInMonth }).map((_, i) => {
                              const d = i + 1;
                              const isHoliday = holidays.has(`2026-${monthIndex + 1}-${d}`);
                              
                              return (
                                <button 
                                  key={i}
                                  className={`w-6 h-6 sm:w-5 sm:h-5 mx-auto flex items-center justify-center rounded-full hover:bg-gray-200 transition ${isHoliday ? 'text-red-600 font-bold bg-red-100 border border-red-200' : 'text-gray-600'}`}
                                  onClick={() => toggleHoliday(monthIndex + 1, d)}
                                >
                                  {d}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="hidden print:block mt-8 text-right pr-8">
                    <p className="text-lg font-bold text-gray-800">年間休日数：{holidays.size}日</p>
                  </div>

                </div>
                )}
              </div>
            </div>
          )}
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
                  <select name="role" defaultValue={editingEmployee?.role || '一般'} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                    <option>一般</option>
                    <option>管理者</option>
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700">週の所定労働日数（パートのみ）</label>
                    <input name="weekly_working_days" type="number" defaultValue={editingEmployee?.weeklyDays || 3} min={1} max={5} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                    <p className="mt-1 text-xs text-gray-500">※出勤簿（打刻）機能がある場合は自動取得することも可能ですが、基本設定として登録します。</p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700">部署</label>
                  <input name="department" type="text" defaultValue={editingEmployee?.department !== '-' ? editingEmployee?.department : ''} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" placeholder="例: 営業部" />
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



    </div>
  );
};

export default AdminDashboard;


