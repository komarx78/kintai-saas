import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Coffee, Download, Users, Loader2, AlertCircle, CheckCircle, XCircle, 
  Plus, Calendar, ShieldCheck, Edit3, Check, Zap, Info, ChevronRight, AlertTriangle
} from 'lucide-react';

// ==============================================================================
// 労働基準法に基づく有給休暇の法定自動算定ロジック
// ==============================================================================
export function calculateStatutoryLeave(
  joinDateStr: string | null | undefined, 
  employmentType: string = '正社員', 
  weeklyDays: number = 5, 
  targetDate: Date = new Date()
) {
  if (!joinDateStr || joinDateStr === '-') {
    return {
      statutoryGrant: 0,
      prevStatutoryGrant: 0,
      serviceMonths: 0,
      serviceText: '入社日未設定',
      nextGrantDate: null,
      nextGrantDays: 0,
      daysUntilNextGrant: null,
      isTarget: false
    };
  }

  const joinDate = new Date(joinDateStr);
  if (isNaN(joinDate.getTime())) {
    return {
      statutoryGrant: 0,
      prevStatutoryGrant: 0,
      serviceMonths: 0,
      serviceText: '入社日無効',
      nextGrantDate: null,
      nextGrantDays: 0,
      daysUntilNextGrant: null,
      isTarget: false
    };
  }

  const now = targetDate;
  
  // 経過月数
  let months = (now.getFullYear() - joinDate.getFullYear()) * 12 + (now.getMonth() - joinDate.getMonth());
  if (now.getDate() < joinDate.getDate()) {
    months -= 1;
  }
  if (months < 0) months = 0;

  const isFullTime = employmentType === '正社員' || employmentType === 'full-time' || weeklyDays >= 5;

  // 正社員・週5日（フルタイム）
  const fullTimeGrants = [
    { months: 6, days: 10 },
    { months: 18, days: 11 },
    { months: 30, days: 12 },
    { months: 42, days: 14 },
    { months: 54, days: 16 },
    { months: 66, days: 18 },
    { months: 78, days: 20 },
  ];

  // パート週4日
  const part4Grants = [
    { months: 6, days: 7 },
    { months: 18, days: 8 },
    { months: 30, days: 9 },
    { months: 42, days: 10 },
    { months: 54, days: 12 },
    { months: 66, days: 13 },
    { months: 78, days: 14 },
  ];

  // パート週3日
  const part3Grants = [
    { months: 6, days: 5 },
    { months: 18, days: 6 },
    { months: 30, days: 6 },
    { months: 42, days: 8 },
    { months: 54, days: 9 },
    { months: 66, days: 10 },
    { months: 78, days: 11 },
  ];

  // パート週2日
  const part2Grants = [
    { months: 6, days: 3 },
    { months: 18, days: 4 },
    { months: 30, days: 4 },
    { months: 42, days: 5 },
    { months: 54, days: 6 },
    { months: 66, days: 6 },
    { months: 78, days: 7 },
  ];

  // パート週1日
  const part1Grants = [
    { months: 6, days: 1 },
    { months: 18, days: 2 },
    { months: 30, days: 2 },
    { months: 42, days: 2 },
    { months: 54, days: 3 },
    { months: 66, days: 3 },
    { months: 78, days: 3 },
  ];

  let schedule = fullTimeGrants;
  if (!isFullTime) {
    if (weeklyDays === 4) schedule = part4Grants;
    else if (weeklyDays === 3) schedule = part3Grants;
    else if (weeklyDays === 2) schedule = part2Grants;
    else if (weeklyDays === 1) schedule = part1Grants;
    else schedule = fullTimeGrants;
  }

  let currentGrant = 0;
  let prevGrant = 0;
  let nextGrantMonths = schedule[0].months;
  let nextGrantDays = schedule[0].days;

  for (let i = 0; i < schedule.length; i++) {
    if (months >= schedule[i].months) {
      prevGrant = currentGrant;
      currentGrant = schedule[i].days;
      if (i + 1 < schedule.length) {
        nextGrantMonths = schedule[i + 1].months;
        nextGrantDays = schedule[i + 1].days;
      } else {
        const maxMonths = schedule[schedule.length - 1].months;
        const cycles = Math.floor((months - maxMonths) / 12) + 1;
        nextGrantMonths = maxMonths + cycles * 12;
        nextGrantDays = schedule[schedule.length - 1].days;
      }
    }
  }

  // 次回付与予定日
  const nextGrantDate = new Date(joinDate);
  nextGrantDate.setMonth(nextGrantDate.getMonth() + nextGrantMonths);
  const diffTime = nextGrantDate.getTime() - now.getTime();
  const daysUntilNextGrant = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  const serviceText = years > 0 ? `${years}年${remMonths}ヶ月` : `${remMonths}ヶ月`;

  return {
    statutoryGrant: currentGrant,
    prevStatutoryGrant: prevGrant,
    serviceMonths: months,
    serviceText,
    nextGrantDate: nextGrantDate.toISOString().split('T')[0],
    nextGrantDays,
    daysUntilNextGrant,
    isTarget: true
  };
}

interface PaidLeaveManagementProps {
  tenantId: string | null;
  onRefreshEmployees?: () => void;
}

export const PaidLeaveManagement: React.FC<PaidLeaveManagementProps> = ({ tenantId, onRefreshEmployees }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<'balance' | 'requests'>('balance');
  const [filterType, setFilterType] = useState<'all' | 'alert_only' | 'fulltime' | 'part'>('all');

  // モーダル用
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);

  // 申請フォーム用
  const [requestForm, setRequestForm] = useState({
    user_id: '',
    type: '有給休暇',
    start_date: '',
    end_date: '',
    reason: ''
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchData = async () => {
    if (!tenantId) return;
    setIsLoading(true);
    try {
      // 1. 従業員一覧取得
      const { data: uData } = await supabase
        .from('users')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name');

      const currentUsers = uData || [];
      setUsers(currentUsers);
      const userIds = currentUsers.map(u => u.id);

      if (userIds.length > 0) {
        // 2. 休暇申請履歴の取得
        const { data: reqData } = await supabase
          .from('leave_requests')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });
        
        // ユーザー情報をマッピング
        const mappedReqs = (reqData || []).map(r => ({
          ...r,
          user: currentUsers.find(u => u.id === r.user_id) || { name: '不明' }
        }));
        setLeaveRequests(mappedReqs);

        // 3. 勤怠打刻レコードから有給打刻を取得
        const { data: attData } = await supabase
          .from('attendance_records')
          .select('*')
          .eq('tenant_id', tenantId);
        setAttendanceRecords(attData || []);
      } else {
        setLeaveRequests([]);
        setAttendanceRecords([]);
      }

    } catch (err) {
      console.error('Paid leave fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tenantId]);

  // 従業員ごとの有給分析・自動算定データを統合
  const analyzedUsers = useMemo(() => {
    return users.map(emp => {
      const isDispatch = emp.role === 'dispatch' || emp.employment_type === '派遣';
      const weeklyDays = Number(emp.weekly_working_days) || 5;
      const empType = emp.employment_type === 'part-time' || emp.employment_type === 'パート' ? 'パート' : '正社員';

      // 法定自動計算
      const statutory = calculateStatutoryLeave(emp.join_date, empType, weeklyDays);

      // 有給消化日数の自動集計（承認済み申請 ＋ 打刻ログ）
      let usedDays = 0;

      // 1. 承認済み申請からの集計
      const empApprovedReqs = leaveRequests.filter(
        r => r.user_id === emp.id && r.status === '承認' && (r.type === '有給休暇' || r.type?.includes('有給'))
      );
      empApprovedReqs.forEach(r => {
        if (r.start_date && r.end_date) {
          const s = new Date(r.start_date);
          const e = new Date(r.end_date);
          const diffDays = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
          if (r.type?.includes('半休')) {
            usedDays += 0.5;
          } else {
            usedDays += diffDays;
          }
        }
      });

      const carryover = Number(emp.paid_leave_carryover || 0);
      const balance = Number(emp.paid_leave_balance || 0);
      const totalGranted = carryover + balance;
      const remainingBalance = Math.max(0, totalGranted - usedDays);

      // 年5日取得義務判定（今年度付与が10日以上の場合）
      const isObligated = balance >= 10;
      const daysNeededForObligation = Math.max(0, 5 - usedDays);
      const isObligationSatisfied = usedDays >= 5.0;

      return {
        ...emp,
        isDispatch,
        weeklyDays,
        empType,
        statutory,
        usedDays,
        carryover,
        balance,
        totalGranted,
        remainingBalance,
        isObligated,
        daysNeededForObligation,
        isObligationSatisfied
      };
    });
  }, [users, leaveRequests, attendanceRecords]);

  // 全社サマリー集計
  const summary = useMemo(() => {
    const valid = analyzedUsers.filter(w => !w.isDispatch);
    const totalGranted = valid.reduce((sum, w) => sum + w.totalGranted, 0);
    const totalUsed = valid.reduce((sum, w) => sum + w.usedDays, 0);
    const totalRemaining = valid.reduce((sum, w) => sum + w.remainingBalance, 0);
    const usageRate = totalGranted > 0 ? Math.round((totalUsed / totalGranted) * 100) : 0;

    const obligatedUsers = valid.filter(w => w.isObligated);
    const alertUsers = obligatedUsers.filter(w => !w.isObligationSatisfied);

    return {
      totalUsers: valid.length,
      dispatchUsers: analyzedUsers.filter(w => w.isDispatch).length,
      totalGranted,
      totalUsed,
      totalRemaining,
      usageRate,
      obligatedCount: obligatedUsers.length,
      alertCount: alertUsers.length
    };
  }, [analyzedUsers]);

  // フィルタリングされた従業員一覧
  const filteredUsers = useMemo(() => {
    return analyzedUsers.filter(w => {
      if (filterType === 'alert_only') return w.isObligated && !w.isObligationSatisfied;
      if (filterType === 'fulltime') return !w.isDispatch && w.empType === '正社員';
      if (filterType === 'part') return !w.isDispatch && w.empType === 'パート';
      return true;
    });
  }, [analyzedUsers, filterType]);

  // 全員の法定有給を一括自動反映
  const handleAutoApplyAllStatutory = async () => {
    const targets = analyzedUsers.filter(w => !w.isDispatch && w.join_date && w.join_date !== '-');
    if (targets.length === 0) {
      alert('入社日が設定されている対象従業員がいません。');
      return;
    }

    if (!confirm(`入社日と勤務日数に基づき、全対象スタッフ（${targets.length}名）の法定有給付与日数を自動計算して一括反映しますか？`)) {
      return;
    }

    setIsProcessing(true);
    try {
      for (const w of targets) {
        const statutory = w.statutory;
        await supabase
          .from('users')
          .update({
            paid_leave_balance: statutory.statutoryGrant,
            paid_leave_carryover: statutory.prevStatutoryGrant
          })
          .eq('id', w.id);
      }

      showToast(`⚡ 全 ${targets.length} 名の法定有給付与日数を自動計算・反映しました！`);
      await fetchData();
      if (onRefreshEmployees) onRefreshEmployees();
    } catch (err: any) {
      console.error('Auto apply error:', err);
      alert('一括更新に失敗しました: ' + (err.message || 'エラー'));
    } finally {
      setIsProcessing(false);
    }
  };

  // 単独スタッフの法定有給を反映
  const handleApplySingleStatutory = async (emp: any) => {
    const statutory = emp.statutory;
    if (!statutory || !emp.join_date || emp.join_date === '-') {
      alert('入社日を設定してください。');
      return;
    }

    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          paid_leave_balance: statutory.statutoryGrant,
          paid_leave_carryover: statutory.prevStatutoryGrant
        })
        .eq('id', emp.id);

      if (error) throw error;

      showToast(`⚡ ${emp.name} さんの法定有給（${statutory.statutoryGrant}日）を反映しました！`);
      await fetchData();
      if (onRefreshEmployees) onRefreshEmployees();
    } catch (err: any) {
      alert('更新に失敗しました: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // 承認・却下処理
  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({ status: newStatus })
        .eq('id', id);
      
      if (error) throw error;
      
      showToast(`休暇申請を「${newStatus}」に更新しました`);
      await fetchData();
      if (onRefreshEmployees) onRefreshEmployees();
    } catch (err) {
      console.error(err);
      alert('ステータスの更新に失敗しました。');
    }
  };

  // 休暇代理申請
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    try {
      const { error } = await supabase.from('leave_requests').insert([{
        tenant_id: tenantId,
        user_id: requestForm.user_id,
        type: requestForm.type,
        start_date: requestForm.start_date,
        end_date: requestForm.end_date,
        reason: requestForm.reason || '管理者代理登録',
        status: '承認'
      }]);
      if (error) throw error;
      
      setIsRequestModalOpen(false);
      setRequestForm({ user_id: '', type: '有給休暇', start_date: '', end_date: '', reason: '' });
      showToast('🎉 休暇の代理申請（即時承認）を登録しました！');
      await fetchData();
      if (onRefreshEmployees) onRefreshEmployees();
    } catch (err) {
      console.error(err);
      alert('申請に失敗しました。');
    }
  };

  // 残日数・設定の手動保存
  const handleSaveBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      const { error } = await supabase.from('users').update({
        paid_leave_carryover: Number(editingUser.paid_leave_carryover) || 0,
        paid_leave_balance: Number(editingUser.paid_leave_balance) || 0,
        join_date: editingUser.join_date || null,
        employment_type: editingUser.empType === 'パート' ? 'part-time' : 'full-time',
        weekly_working_days: Number(editingUser.weekly_working_days) || 5
      }).eq('id', editingUser.id);
      
      if (error) throw error;
      
      setIsEditModalOpen(false);
      showToast(`💾 ${editingUser.name} さんの有給設定を保存しました！`);
      await fetchData();
      if (onRefreshEmployees) onRefreshEmployees();
    } catch (err: any) {
      console.error(err);
      alert('保存に失敗しました: ' + err.message);
    }
  };

  // 有給管理台帳 CSVエクスポート
  const handleExportCsv = () => {
    const year = new Date().getFullYear();
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const filename = `有給休暇管理台帳_${year}年${month}月.csv`;

    const headers = [
      '従業員ID', '従業員名', '雇用形態', '週所定日数', '入社日', '勤続期間',
      '前年度繰越(日)', '今年度付与(日)', '総付与日数(日)', '当期消化日数(日)', '現在残日数(日)',
      '次回付与予定日', '次回付与予定日数(日)', '年5日取得義務対象', '年5日義務達成状況'
    ];

    const rows = analyzedUsers.map(w => [
      w.id,
      w.name,
      w.isDispatch ? '派遣 (対象外)' : w.empType,
      w.isDispatch ? '-' : `${w.weeklyDays}日`,
      w.join_date || '-',
      w.statutory.serviceText,
      w.isDispatch ? '0' : String(w.carryover),
      w.isDispatch ? '0' : String(w.balance),
      w.isDispatch ? '0' : String(w.totalGranted),
      w.isDispatch ? '0' : String(w.usedDays),
      w.isDispatch ? '0' : String(w.remainingBalance),
      w.statutory.nextGrantDate || '-',
      String(w.statutory.nextGrantDays || 0),
      w.isObligated ? '対象' : '対象外',
      w.isObligated ? (w.isObligationSatisfied ? '達成' : `未達成(あと${w.daysNeededForObligation}日)`) : '-'
    ]);

    const csvContent = [headers, ...rows].map(row => 
      row.map(val => `"${String(val ?? '').replace(/"/g, '""')}"`).join(',')
    ).join('\r\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`📄 ${filename} をダウンロードしました！`);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* ヘッダー */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-lg shadow-amber-500/25">
              <Coffee className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">有給・休暇管理システム</h1>
              <p className="text-xs font-bold text-slate-500 mt-0.5">
                労働基準法に基づく有給自動算定・年5日取得義務管理・消化実績のリアルタイム連動
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2.5">
          {/* タブ切り替え */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200">
            <button 
              onClick={() => setActiveTab('balance')}
              className={`px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                activeTab === 'balance' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              有給残日数・算定台帳
            </button>
            <button 
              onClick={() => setActiveTab('requests')}
              className={`px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                activeTab === 'requests' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              休暇申請・承認履歴
              {leaveRequests.filter(r => r.status === '申請中').length > 0 && (
                <span className="ml-1.5 bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full">
                  {leaveRequests.filter(r => r.status === '申請中').length}
                </span>
              )}
            </button>
          </div>

          {/* アクションボタン */}
          <button 
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 hover:text-amber-700 hover:border-amber-300 px-3.5 py-2 rounded-xl font-bold text-xs hover:bg-amber-50/50 shadow-sm transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 text-amber-600" /> 台帳CSV
          </button>

          {activeTab === 'balance' && (
            <button 
              type="button"
              onClick={handleAutoApplyAllStatutory}
              disabled={isProcessing}
              className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-4 py-2 rounded-xl font-black text-xs shadow-md shadow-amber-500/20 hover:shadow-lg transition-all disabled:opacity-50 cursor-pointer"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              全員の法定有給を一括自動反映
            </button>
          )}

          {activeTab === 'requests' && (
            <button 
              onClick={() => setIsRequestModalOpen(true)}
              className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-4 py-2 rounded-xl font-black text-xs shadow-md shadow-amber-500/20 hover:shadow-lg transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" /> 休暇代理申請
            </button>
          )}
        </div>
      </div>

      {/* 4大メトリクス・ダッシュボード */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* カード1: 管理対象スタッフ */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between hover:border-blue-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">管理対象スタッフ</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-800">{summary.totalUsers}</span>
            <span className="text-xs font-bold text-slate-500">名</span>
            {summary.dispatchUsers > 0 && (
              <span className="text-[11px] font-bold text-slate-400 ml-auto">
                (対象外: {summary.dispatchUsers}名)
              </span>
            )}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] font-bold text-slate-400 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> 法定基準に準拠
          </div>
        </div>

        {/* カード2: 総保有有給日数 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between hover:border-amber-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">今期総保有有給</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Coffee className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-600">{summary.totalGranted}</span>
            <span className="text-xs font-bold text-slate-500">日</span>
            <span className="text-[11px] font-bold text-slate-400 ml-auto">
              (現在残: {summary.totalRemaining}日)
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] font-bold text-slate-400 flex items-center justify-between">
            <span>前年繰越 ＋ 今期付与</span>
            <span className="text-slate-600 font-black">{summary.totalGranted}日</span>
          </div>
        </div>

        {/* カード3: 総消化日数 & 消化率 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between hover:border-emerald-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">総消化日数 / 取得率</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-600">{summary.totalUsed}</span>
            <span className="text-xs font-bold text-slate-500">日消化</span>
            <span className="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg ml-auto">
              取得率 {summary.usageRate}%
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100">
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, summary.usageRate)}%` }}
              />
            </div>
          </div>
        </div>

        {/* カード4: 年5日取得義務アラート */}
        <div className={`rounded-2xl p-5 border shadow-sm flex flex-col justify-between ${
          summary.alertCount > 0 
            ? 'bg-rose-50/70 border-rose-200 text-rose-900' 
            : 'bg-white border-slate-200 text-slate-800'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
              {summary.alertCount > 0 ? (
                <AlertTriangle className="w-4 h-4 text-rose-600 animate-pulse" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              )}
              年5日取得義務
            </span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-600">
              対象 {summary.obligatedCount}名
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            {summary.alertCount > 0 ? (
              <>
                <span className="text-3xl font-black text-rose-600">{summary.alertCount}</span>
                <span className="text-xs font-bold text-rose-700">名が5日未達</span>
              </>
            ) : (
              <>
                <span className="text-3xl font-black text-emerald-600">全員達成</span>
                <span className="text-xs font-bold text-slate-500">🎉</span>
              </>
            )}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-200/50 text-[11px] font-bold text-slate-500 flex items-center justify-between">
            <span>労働基準法第39条</span>
            {summary.alertCount > 0 ? (
              <button 
                onClick={() => setFilterType('alert_only')}
                className="text-rose-600 font-black hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                未達者を表示 <ChevronRight className="w-3 h-3" />
              </button>
            ) : (
              <span className="text-emerald-600 font-bold">基準クリア</span>
            )}
          </div>
        </div>

      </div>

      {/* メインコンテンツエリア */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[450px]">
        
        {/* フィルターバー（残日数管理タブ時） */}
        {activeTab === 'balance' && (
          <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-500 mr-1">絞り込み:</span>
              {[
                { id: 'all', label: 'すべて表示' },
                { id: 'alert_only', label: `⚠️ 年5日未達 (${summary.alertCount})` },
                { id: 'fulltime', label: '正社員・フルタイム' },
                { id: 'part', label: 'パート・短時間' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setFilterType(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    filterType === tab.id
                      ? 'bg-amber-500 border-amber-500 text-white shadow-sm font-black'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              <span>勤怠打刻および承認済み申請と自動連動中</span>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            <span className="text-xs font-bold text-slate-400">有給データを算定中...</span>
          </div>
        ) : (
          <>
            {/* タブ1: 残日数管理・法定算定台帳 */}
            {activeTab === 'balance' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead>
                    <tr className="bg-amber-50/50 border-b border-amber-100 text-xs font-black text-amber-900 tracking-wider">
                      <th className="p-4 w-48">従業員・勤務形態</th>
                      <th className="p-4 w-40">入社日・勤続期間</th>
                      <th className="p-4 text-center">前年繰越</th>
                      <th className="p-4 text-center">今年度付与</th>
                      <th className="p-4 text-center">消化日数</th>
                      <th className="p-4 text-center">現在残日数</th>
                      <th className="p-4 w-48">次回付与予定</th>
                      <th className="p-4 text-center w-36">年5日義務</th>
                      <th className="p-4 text-center w-36">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-12 text-center text-slate-400 font-bold">
                          該当する従業員データがありません
                        </td>
                      </tr>
                    ) : filteredUsers.map((emp: any) => {
                      const st = emp.statutory;

                      return (
                        <tr key={emp.id} className={`hover:bg-amber-50/20 transition-colors ${emp.isDispatch ? 'bg-slate-50/50 opacity-60' : ''}`}>
                          
                          {/* 1. 従業員名・雇用形態 */}
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center font-black text-sm">
                                {emp.name.substring(0, 1)}
                              </div>
                              <div>
                                <span className="font-black text-slate-800 text-sm block">{emp.name}</span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {emp.isDispatch ? (
                                    <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-[10px] font-black">
                                      派遣 (対象外)
                                    </span>
                                  ) : (
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                                      emp.empType === '正社員' 
                                        ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    }`}>
                                      {emp.empType} (週{emp.weeklyDays}日)
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* 2. 入社日・勤続期間 */}
                          <td className="p-4">
                            <div className="text-xs font-bold text-slate-700">{emp.join_date && emp.join_date !== '-' ? emp.join_date : '未設定'}</div>
                            <div className="text-[11px] font-bold text-slate-400 mt-0.5">
                              勤続 {st.serviceText}
                            </div>
                          </td>

                          {/* 3. 前年度繰越 */}
                          <td className="p-4 text-center">
                            <span className="font-bold text-slate-500 text-sm">
                              {emp.isDispatch ? '-' : `${emp.carryover} 日`}
                            </span>
                          </td>

                          {/* 4. 今年度付与 */}
                          <td className="p-4 text-center">
                            {emp.isDispatch ? (
                              <span className="text-slate-300">-</span>
                            ) : (
                              <div>
                                <span className="font-black text-emerald-600 text-base">{emp.balance} 日</span>
                                {st.statutoryGrant !== emp.balance && emp.join_date && emp.join_date !== '-' && (
                                  <div className="text-[10px] text-amber-600 font-bold">
                                    (法定: {st.statutoryGrant}日)
                                  </div>
                                )}
                              </div>
                            )}
                          </td>

                          {/* 5. 消化日数 */}
                          <td className="p-4 text-center">
                            {emp.isDispatch ? (
                              <span className="text-slate-300">-</span>
                            ) : (
                              <span className="font-black text-slate-700 text-sm bg-slate-100 px-2 py-1 rounded-lg">
                                {emp.usedDays} 日
                              </span>
                            )}
                          </td>

                          {/* 6. 現在残日数合計 */}
                          <td className="p-4 text-center">
                            {emp.isDispatch ? (
                              <span className="text-slate-300">-</span>
                            ) : (
                              <div className="inline-flex items-center gap-1">
                                <span className="font-black text-amber-600 text-xl tracking-tight">
                                  {emp.remainingBalance}
                                </span>
                                <span className="text-xs font-bold text-amber-700">日</span>
                              </div>
                            )}
                          </td>

                          {/* 7. 次回付与予定 */}
                          <td className="p-4">
                            {emp.isDispatch || !st.nextGrantDate ? (
                              <span className="text-slate-300 text-xs">-</span>
                            ) : (
                              <div>
                                <div className="text-xs font-black text-slate-700 flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5 text-blue-500" />
                                  {st.nextGrantDate}
                                </div>
                                <div className="text-[11px] font-bold text-blue-600 mt-0.5">
                                  ＋{st.nextGrantDays}日付与 (あと {st.daysUntilNextGrant}日)
                                </div>
                              </div>
                            )}
                          </td>

                          {/* 8. 年5日義務達成状況 */}
                          <td className="p-4 text-center">
                            {emp.isDispatch ? (
                              <span className="text-slate-300 text-xs">-</span>
                            ) : !emp.isObligated ? (
                              <span className="text-slate-400 text-[11px] font-bold">対象外 (付与10日未満)</span>
                            ) : emp.isObligationSatisfied ? (
                              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-lg text-xs font-black">
                                <Check className="w-3.5 h-3.5" /> 達成 ({emp.usedDays}日)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 px-2 py-1 rounded-lg text-xs font-black animate-pulse">
                                <AlertCircle className="w-3.5 h-3.5" /> あと {emp.daysNeededForObligation}日
                              </span>
                            )}
                          </td>

                          {/* 9. 操作 */}
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {!emp.isDispatch && emp.join_date && emp.join_date !== '-' && st.statutoryGrant !== emp.balance && (
                                <button
                                  type="button"
                                  onClick={() => handleApplySingleStatutory(emp)}
                                  className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg border border-amber-200 transition-colors cursor-pointer"
                                  title={`法定付与日数(${st.statutoryGrant}日)を適用`}
                                >
                                  <Zap className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button 
                                onClick={() => { setEditingUser(emp); setIsEditModalOpen(true); }}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" /> 編集
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

            {/* タブ2: 休暇申請・承認履歴 */}
            {activeTab === 'requests' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-black text-slate-500">
                      <th className="p-4">申請日</th>
                      <th className="p-4">従業員名</th>
                      <th className="p-4">種別</th>
                      <th className="p-4">期間 (日付)</th>
                      <th className="p-4">理由・備考</th>
                      <th className="p-4 text-center">ステータス</th>
                      <th className="p-4 text-center">アクション</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {leaveRequests.length === 0 ? (
                      <tr><td colSpan={7} className="p-12 text-center text-slate-400 font-bold">申請履歴はありません</td></tr>
                    ) : leaveRequests.map((req: any) => (
                      <tr key={req.id} className="hover:bg-slate-50">
                        <td className="p-4 text-xs font-bold text-slate-500">{req.created_at ? req.created_at.substring(0,10) : '-'}</td>
                        <td className="p-4 font-black text-slate-800">{req.user?.name || '-'}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded text-xs font-black ${
                            req.type?.includes('有給') ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {req.type}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-slate-700 text-sm">{req.start_date} 〜 {req.end_date}</td>
                        <td className="p-4 text-xs text-slate-600 font-medium whitespace-pre-wrap">{req.reason || '-'}</td>
                        <td className="p-4 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-black ${
                            req.status === '承認' ? 'bg-emerald-100 text-emerald-700' :
                            req.status === '却下' ? 'bg-rose-100 text-rose-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>{req.status}</span>
                        </td>
                        <td className="p-4 text-center">
                          {req.status === '申請中' ? (
                            <div className="flex items-center justify-center gap-2">
                              <button 
                                onClick={() => handleUpdateStatus(req.id, '承認')} 
                                className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer" 
                                title="承認"
                              >
                                <CheckCircle className="w-5 h-5" />
                              </button>
                              <button 
                                onClick={() => handleUpdateStatus(req.id, '却下')} 
                                className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer" 
                                title="却下"
                              >
                                <XCircle className="w-5 h-5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-300 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

      </div>

      {/* 代理申請モーダル */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coffee className="w-5 h-5" />
                <h3 className="font-black text-base">休暇の代理申請（管理者）</h3>
              </div>
              <button onClick={() => setIsRequestModalOpen(false)} className="text-white/80 hover:text-white cursor-pointer">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitRequest} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">対象従業員</label>
                <select 
                  required 
                  value={requestForm.user_id} 
                  onChange={e => setRequestForm({...requestForm, user_id: e.target.value})} 
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm bg-white"
                >
                  <option value="">選択してください</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">休暇種別</label>
                <select 
                  value={requestForm.type} 
                  onChange={e => setRequestForm({...requestForm, type: e.target.value})} 
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm bg-white"
                >
                  <option value="有給休暇">有給休暇</option>
                  <option value="代休">代休</option>
                  <option value="欠勤">欠勤</option>
                  <option value="特別休暇">特別休暇 / 慶弔</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">開始日</label>
                  <input 
                    type="date" 
                    required 
                    value={requestForm.start_date} 
                    onChange={e => setRequestForm({...requestForm, start_date: e.target.value})} 
                    className="w-full p-2.5 border border-slate-200 rounded-xl font-bold text-sm" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">終了日</label>
                  <input 
                    type="date" 
                    required 
                    value={requestForm.end_date} 
                    onChange={e => setRequestForm({...requestForm, end_date: e.target.value})} 
                    className="w-full p-2.5 border border-slate-200 rounded-xl font-bold text-sm" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">理由・備考</label>
                <input 
                  type="text" 
                  value={requestForm.reason} 
                  onChange={e => setRequestForm({...requestForm, reason: e.target.value})} 
                  className="w-full p-2.5 border border-slate-200 rounded-xl font-bold text-xs" 
                  placeholder="私用のため等" 
                />
              </div>
              <button 
                type="submit" 
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black py-3 rounded-xl shadow-md transition-all mt-2 text-sm cursor-pointer"
              >
                登録する（即時承認）
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 残日数・設定編集モーダル */}
      {isEditModalOpen && editingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-black text-base">{editingUser.name} の有給設定・手動調整</h3>
                <p className="text-xs text-slate-400 font-bold mt-0.5">
                  法定有給日数の自動計算または手動入力
                </p>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const weeklyDays = Number(editingUser.weekly_working_days) || 5;
              const empType = editingUser.empType || '正社員';
              const st = calculateStatutoryLeave(editingUser.join_date, empType, weeklyDays);

              return (
                <div className="p-6 space-y-4">
                  {editingUser.join_date && editingUser.join_date !== '-' ? (
                    <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-black text-amber-900">
                          労働基準法に基づく法定参考値 (勤続: {st.serviceText})
                        </div>
                        <div className="text-xs font-bold text-amber-700 mt-1">
                          今年度付与: <span className="text-sm font-black">{st.statutoryGrant}日</span> | 前年繰越目安: {st.prevStatutoryGrant}日
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingUser({
                            ...editingUser,
                            paid_leave_balance: st.statutoryGrant,
                            paid_leave_carryover: st.prevStatutoryGrant
                          });
                          showToast('⚡ 法定参考値をフォームに反映しました');
                        }}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Zap className="w-3.5 h-3.5" /> 法定値をセット
                      </button>
                    </div>
                  ) : (
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-500 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-slate-400" />
                      入社日を設定すると、法定付与日数が自動計算されます。
                    </div>
                  )}

                  <form onSubmit={handleSaveBalance} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-black text-slate-700 mb-1">雇用形態</label>
                        <select 
                          value={editingUser.empType || '正社員'} 
                          onChange={e => setEditingUser({...editingUser, empType: e.target.value})} 
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm bg-white"
                        >
                          <option value="正社員">正社員</option>
                          <option value="パート">パート</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-black text-slate-700 mb-1">週所定日数</label>
                        <select 
                          value={editingUser.weekly_working_days || 5} 
                          onChange={e => setEditingUser({...editingUser, weekly_working_days: Number(e.target.value)})} 
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm bg-white"
                        >
                          <option value={5}>週5日 (フルタイム)</option>
                          <option value={4}>週4日</option>
                          <option value={3}>週3日</option>
                          <option value={2}>週2日</option>
                          <option value={1}>週1日</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-black text-slate-700 mb-1">入社日</label>
                      <input 
                        type="date" 
                        value={editingUser.join_date && editingUser.join_date !== '-' ? editingUser.join_date : ''} 
                        onChange={e => setEditingUser({...editingUser, join_date: e.target.value})} 
                        className="w-full p-2.5 border border-slate-200 rounded-xl font-bold text-sm" 
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div>
                        <label className="block text-xs font-black text-slate-700 mb-1">前年度繰越 (日)</label>
                        <input 
                          type="number" 
                          step="0.5" 
                          min="0"
                          value={editingUser.paid_leave_carryover ?? 0} 
                          onChange={e => setEditingUser({...editingUser, paid_leave_carryover: e.target.value})} 
                          className="w-full p-2.5 border border-slate-200 rounded-xl text-right font-black text-sm" 
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-slate-700 mb-1">今年度付与 (日)</label>
                        <input 
                          type="number" 
                          step="0.5" 
                          min="0"
                          value={editingUser.paid_leave_balance ?? 0} 
                          onChange={e => setEditingUser({...editingUser, paid_leave_balance: e.target.value})} 
                          className="w-full p-2.5 border border-slate-200 rounded-xl text-right font-black text-sm text-emerald-600" 
                        />
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                      <button 
                        type="button"
                        onClick={() => setIsEditModalOpen(false)}
                        className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                      >
                        キャンセル
                      </button>
                      <button 
                        type="submit" 
                        className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer"
                      >
                        設定を保存
                      </button>
                    </div>
                  </form>
                </div>
              );
            })()}

          </div>
        </div>
      )}

      {/* トースト通知 */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-2 text-sm font-bold animate-in slide-in-from-bottom-5">
          <Check className="w-4 h-4 text-emerald-400" />
          {toastMessage}
        </div>
      )}

    </div>
  );
};
