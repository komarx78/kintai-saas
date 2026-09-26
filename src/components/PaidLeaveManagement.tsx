import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Coffee, Download, Users, Loader2, AlertCircle, CheckCircle, XCircle, 
  Plus, Calendar, ShieldCheck, Edit3, Check, Zap, Info, ChevronRight, AlertTriangle
} from 'lucide-react';

import {
  type PaidLeaveCalcMode,
  calculateStatutoryLeaveWithMode,
  calculateUsedPaidLeaveDaysInPeriod,
  getCompanyPaidLeaveCalcMode,
  saveCompanyPaidLeaveCalcMode,
  getUserPaidLeaveCalcModeMap,
  saveUserPaidLeaveCalcMode
} from '../lib/paidLeaveCalculation';

// 後方互換ラッパー
export function calculateStatutoryLeave(
  joinDateStr: string | null | undefined, 
  employmentType: string = '正社員', 
  weeklyDays: number = 5, 
  targetDate: Date = new Date()
) {
  return calculateStatutoryLeaveWithMode(joinDateStr, employmentType, weeklyDays, 'contract_fixed', [], targetDate);
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

  // ⚡ パート有給算定方式（全社設定 ＆ 個人個別設定）
  const [companyCalcMode, setCompanyCalcMode] = useState<PaidLeaveCalcMode>('actual_worked');
  const [userCalcModeMap, setUserCalcModeMap] = useState<Record<string, PaidLeaveCalcMode | 'default'>>({});

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

  const handleToggleCompanyCalcMode = (newMode: PaidLeaveCalcMode) => {
    setCompanyCalcMode(newMode);
    if (tenantId) {
      saveCompanyPaidLeaveCalcMode(tenantId, newMode);
    }
    showToast(
      newMode === 'actual_worked'
        ? '⚡ パート有給の算定を「打刻実績からの自動逆算（労基法準拠）」に変更しました'
        : '🏷️ パート有給の算定を「雇用契約の週日数固定」に変更しました'
    );
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

      // 4. パート有給算定設定のロード
      const loadedCompanyMode = getCompanyPaidLeaveCalcMode(tenantId);
      setCompanyCalcMode(loadedCompanyMode);
      const loadedUserMap = getUserPaidLeaveCalcModeMap(tenantId);
      setUserCalcModeMap(loadedUserMap);

      if (userIds.length > 0) {
        // 2. 休暇申請履歴の取得（有給休暇・特別休暇・慶弔休暇等の純粋な休暇申請のみを対象とし、シフト希望や打刻修正は除外）
        const { data: reqData } = await supabase
          .from('leave_requests')
          .select('*')
          .eq('tenant_id', tenantId)
          .neq('type', 'シフト希望')
          .neq('type', '打刻修正')
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

  // 従業員ごとの有給分析・自動算定データを統合（契約固定 ＆ 実績逆算ハイブリッド対応）
  const analyzedUsers = useMemo(() => {
    return users.map(emp => {
      const isDispatch = emp.role === 'dispatch' || emp.employment_type === '派遣';
      const empType = emp.employment_type === 'part-time' || emp.employment_type === 'パート' ? 'パート' : '正社員';
      const weeklyDays = Number(emp.weekly_working_days) || (empType === 'パート' ? 3 : 5);

      // 個人設定 または 全社設定を適用
      const userCustomMode = userCalcModeMap[emp.id] || 'default';
      const effectiveMode: PaidLeaveCalcMode = userCustomMode === 'default' ? companyCalcMode : userCustomMode;

      // 当該従業員の打刻レコード
      const empAtt = attendanceRecords.filter(r => r.user_id === emp.id);

      // 法定ハイブリッド自動計算（契約固定 vs 実績逆算）
      const contractHours = emp.weekly_working_hours ? Number(emp.weekly_working_hours) : (emp.contract_weekly_hours ? Number(emp.contract_weekly_hours) : undefined);
      const statutory = calculateStatutoryLeaveWithMode(
        emp.join_date,
        empType,
        weeklyDays,
        effectiveMode,
        empAtt,
        new Date(),
        contractHours
      );

      // 🛡️ 有給消化日数の自動集計（労働基準法第39条第7項 基準日・法定期間厳格準拠）
      // 1. 当該従業員の申請一覧
      const empLeaveReqs = leaveRequests.filter(r => r.user_id === emp.id);

      // 2. 直近付与サイクル（基準日〜次回付与日）における有休消化日数（年5日取得義務判定用 SSOT）
      const usedDaysInObligationPeriod = statutory.obligationPeriodStart
        ? calculateUsedPaidLeaveDaysInPeriod(empLeaveReqs, statutory.obligationPeriodStart, statutory.obligationPeriodEnd)
        : calculateUsedPaidLeaveDaysInPeriod(empLeaveReqs);

      // 3. 全期間累計消化日数（単日申請 end_date 未指定フォールバック完全対応）
      const usedDaysTotal = calculateUsedPaidLeaveDaysInPeriod(empLeaveReqs);

      // 🛡️ 手動設定値の有無判定（DBに明示的な値が登録されているか）
      const hasExplicitBalance = emp.paid_leave_balance !== null && emp.paid_leave_balance !== undefined && Number(emp.paid_leave_balance) > 0;
      const hasExplicitCarryover = emp.paid_leave_carryover !== null && emp.paid_leave_carryover !== undefined && Number(emp.paid_leave_carryover) > 0;

      // 手動設定値があれば優先、未設定（0日かつ法定日数あり）なら法定計算値を自動適用（SSOT・初期値ゼロ問題の完全根絶）
      const balance = hasExplicitBalance 
        ? Number(emp.paid_leave_balance) 
        : (emp.join_date && emp.join_date !== '-' ? statutory.statutoryGrant : 0);

      const carryover = hasExplicitCarryover 
        ? Number(emp.paid_leave_carryover) 
        : (emp.join_date && emp.join_date !== '-' && !hasExplicitBalance ? statutory.prevStatutoryGrant : 0);

      const totalGranted = carryover + balance;
      const remainingBalance = Math.max(0, totalGranted - usedDaysTotal);

      // 年5日取得義務判定（労基法第39条第7項：法定付与10日以上、かつ基準日から1年以内の消化数で判定）
      const isObligated = statutory.isObligated || balance >= 10;
      const daysNeededForObligation = Math.max(0, 5 - usedDaysInObligationPeriod);
      const isObligationSatisfied = !isObligated || usedDaysInObligationPeriod >= 5.0;

      return {
        ...emp,
        isDispatch,
        weeklyDays,
        empType,
        userCustomMode,
        effectiveMode,
        statutory,
        usedDays: usedDaysInObligationPeriod, // 5日義務進捗に直結
        usedDaysTotal,
        hasExplicitBalance,
        hasExplicitCarryover,
        carryover,
        balance,
        totalGranted,
        remainingBalance,
        isObligated,
        daysNeededForObligation,
        isObligationSatisfied
      };
    });
  }, [users, leaveRequests, attendanceRecords, companyCalcMode, userCalcModeMap]);

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
        const query = supabase
          .from('users')
          .update({
            paid_leave_balance: statutory.statutoryGrant,
            paid_leave_carryover: statutory.prevStatutoryGrant
          })
          .eq('id', w.id);
        if (tenantId) query.eq('tenant_id', tenantId);
        await query;
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
      const query = supabase
        .from('users')
        .update({
          paid_leave_balance: statutory.statutoryGrant,
          paid_leave_carryover: statutory.prevStatutoryGrant
        })
        .eq('id', emp.id);
      if (tenantId) query.eq('tenant_id', tenantId);
      const { error } = await query;

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
      const query = supabase
        .from('leave_requests')
        .update({ status: newStatus })
        .eq('id', id);
      if (tenantId) query.eq('tenant_id', tenantId);
      const { error } = await query;
      
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

    if (!requestForm.user_id) {
      alert('対象従業員を選択してください。');
      return;
    }
    if (!requestForm.start_date || !requestForm.end_date) {
      alert('開始日と終了日を正しく入力してください。');
      return;
    }
    if (requestForm.start_date > requestForm.end_date) {
      alert('開始日は終了日以前の日付を指定してください。');
      return;
    }

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
      const carryover = Math.max(0, Number(editingUser.paid_leave_carryover) || 0);
      const balance = Math.max(0, Number(editingUser.paid_leave_balance) || 0);
      const query = supabase.from('users').update({
        paid_leave_carryover: carryover,
        paid_leave_balance: balance,
        join_date: editingUser.join_date || null,
        employment_type: editingUser.empType === 'パート' ? 'part-time' : 'full-time',
        weekly_working_days: Number(editingUser.weekly_working_days) || (editingUser.empType === 'パート' || editingUser.employment_type === 'part-time' ? 3 : 5)
      }).eq('id', editingUser.id);
      if (tenantId) query.eq('tenant_id', tenantId);
      const { error } = await query;
      
      if (error) throw error;

      if (tenantId && editingUser.userCustomMode) {
        saveUserPaidLeaveCalcMode(tenantId, editingUser.id, editingUser.userCustomMode);
        setUserCalcModeMap(prev => ({ ...prev, [editingUser.id]: editingUser.userCustomMode }));
      }
      
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
      '従業員ID', '従業員名', '雇用形態', '契約週日数', '有給算定方式', '年間実労働換算日数', '入社日', '勤続期間',
      '前年度繰越(日)', '今年度付与(日)', '総付与日数(日)', '当期消化日数(日)', '現在残日数(日)',
      '次回付与予定日', '次回付与予定日数(日)', '年5日取得義務対象', '年5日義務達成状況',
      '義務算定期間開始日', '義務算定期間終了日'
    ];

    const rows = analyzedUsers.map(w => [
      w.id,
      w.name,
      w.isDispatch ? '派遣 (対象外)' : w.empType,
      w.isDispatch ? '-' : `${w.weeklyDays}日`,
      w.isDispatch ? '-' : (w.statutory.calcMode === 'actual_worked' ? '打刻実績逆算' : '契約週日数固定'),
      w.isDispatch ? '-' : (w.statutory.calcMode === 'actual_worked' ? `${w.statutory.actualWorkedDaysAnnual || 0}日(週${w.statutory.effectiveWeeklyDays || 0}日相当)` : '-'),
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
      w.isObligated ? (w.isObligationSatisfied ? '達成' : `未達成(あと${w.daysNeededForObligation}日)`) : '-',
      w.statutory.obligationPeriodStart || '-',
      w.statutory.obligationPeriodEnd || '-'
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

      {/* ⚡ パート・アルバイト有給 算定方式切替バー（労基法第39条第3項・厚労省通達準拠） */}
      <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 p-4 rounded-2xl border border-amber-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="p-2 bg-amber-500 text-white rounded-xl shadow-xs shrink-0">
            <Zap className="w-4 h-4" />
          </span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs font-black text-amber-950">
                パート・アルバイト有給算定方式（労基法第39条第3項 比例付与）
              </h3>
              <span className="bg-amber-200/70 text-amber-900 text-[10px] font-black px-2 py-0.2 rounded-full border border-amber-300">
                全社標準
              </span>
            </div>
            <p className="text-[11px] text-amber-800/80 font-medium mt-0.5">
              シフト変動パートは「打刻実績からの自動逆算」、固定シフトパートは「契約週日数」を選択可能です。
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-amber-300 shadow-2xs shrink-0">
          <button
            type="button"
            onClick={() => handleToggleCompanyCalcMode('actual_worked')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              companyCalcMode === 'actual_worked'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-slate-600 hover:text-amber-800 hover:bg-amber-50'
            }`}
            title="直近1年（または半年×2）の出勤打刻日数から年間労働日数を割り出し、労基法テーブルに照合して自動逆算します"
          >
            <span>⚡ 打刻実績から自動逆算</span>
            <span className={`text-[10px] px-1 py-0.2 rounded font-black ${
              companyCalcMode === 'actual_worked' ? 'bg-amber-600 text-white' : 'bg-emerald-100 text-emerald-800'
            }`}>
              推奨・労基法通達準拠
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleToggleCompanyCalcMode('contract_fixed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              companyCalcMode === 'contract_fixed'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-slate-600 hover:text-amber-800 hover:bg-amber-50'
            }`}
            title="雇用契約書に定められた所定週日数（例: 週3日）に基づいて固定で付与日数を算定します"
          >
            <span>🏷️ 雇用契約の週日数固定</span>
          </button>
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
            : summary.obligatedCount === 0
              ? 'bg-white border-slate-200 text-slate-800'
              : 'bg-emerald-50/30 border-emerald-200 text-slate-800'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
              {summary.alertCount > 0 ? (
                <AlertTriangle className="w-4 h-4 text-rose-600 animate-pulse" />
              ) : summary.obligatedCount === 0 ? (
                <Info className="w-4 h-4 text-slate-400" />
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
            ) : summary.obligatedCount === 0 ? (
              <>
                <span className="text-2xl font-black text-slate-400">対象者なし</span>
                <span className="text-xs font-bold text-slate-400">(付与10日未満)</span>
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
            ) : summary.obligatedCount === 0 ? (
              <span className="text-slate-400 font-bold">義務発生者なし</span>
            ) : (
              <span className="text-emerald-600 font-bold">基準クリア ({summary.obligatedCount}名達成)</span>
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
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  {emp.isDispatch ? (
                                    <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-[10px] font-black">
                                      派遣 (対象外)
                                    </span>
                                  ) : emp.empType === '正社員' ? (
                                    <span className="bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded text-[10px] font-black">
                                      正社員 (週5日)
                                    </span>
                                  ) : (
                                    <>
                                      {st.calcMode === 'actual_worked' ? (
                                        <span 
                                          className="bg-amber-50 text-amber-800 border border-amber-300 px-1.5 py-0.5 rounded text-[10px] font-black flex items-center gap-1 shadow-2xs"
                                          title={`${st.periodText}（実出勤${st.actualDaysCount}日 ➔ 年換算${st.actualWorkedDaysAnnual}日）`}
                                        >
                                          <span>⚡</span>
                                          <span>
                                            {st.actualWorkedDaysAnnual >= 48 
                                              ? `実績: 年${st.actualWorkedDaysAnnual}日(週${st.effectiveWeeklyDays}日相当)` 
                                              : `実績: 年${st.actualWorkedDaysAnnual}日(契約週${st.effectiveWeeklyDays}日下限)`}
                                          </span>
                                        </span>
                                      ) : (
                                        <span 
                                          className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded text-[10px] font-black shadow-2xs"
                                          title="雇用契約に基づく固定所定週日数で算定中"
                                        >
                                          🏷️ 契約固定: 週{emp.weeklyDays}日
                                        </span>
                                      )}

                                      {/* 契約と実績の乖離バッジ */}
                                      {st.isDiffFromContract && (
                                        <span 
                                          className={`px-1.5 py-0.5 rounded text-[9px] font-black border shadow-2xs ${
                                            st.actualEquivalentWeeklyDays > st.contractWeeklyDays
                                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                              : 'bg-rose-100 text-rose-800 border-rose-300'
                                          }`} 
                                          title={st.diffDaysText}
                                        >
                                          {st.actualEquivalentWeeklyDays > st.contractWeeklyDays
                                            ? `実働上回り (週${st.actualEquivalentWeeklyDays}日扱い)`
                                            : `実働下回り (契約週${st.contractWeeklyDays}日)`}
                                        </span>
                                      )}
                                    </>
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
                                {emp.hasExplicitBalance && st.statutoryGrant !== emp.balance && emp.join_date && emp.join_date !== '-' ? (
                                  <div className="text-[10px] text-amber-600 font-bold" title="手動設定値が適用されています">
                                    (法定計算: {st.statutoryGrant}日)
                                  </div>
                                ) : !emp.hasExplicitBalance && emp.join_date && emp.join_date !== '-' && emp.balance > 0 ? (
                                  <div className="text-[9px] text-emerald-700 font-bold">
                                    法定自動適用 ✓
                                  </div>
                                ) : null}
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
                        <td className="p-4 text-xs text-slate-600 font-medium whitespace-pre-wrap">
                          {(req.reason || '-').split('【シフトデータ')[0].trim() || '-'}
                        </td>
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
              const empType = editingUser.empType || (editingUser.employment_type === 'part-time' || editingUser.employment_type === 'パート' ? 'パート' : '正社員');
              const weeklyDays = Number(editingUser.weekly_working_days) || (empType === 'パート' ? 3 : 5);
              const userCustomMode = editingUser.userCustomMode || userCalcModeMap[editingUser.id] || 'default';
              const effectiveMode: PaidLeaveCalcMode = userCustomMode === 'default' ? companyCalcMode : userCustomMode;
              const empAtt = attendanceRecords.filter(r => r.user_id === editingUser.id);
              
              const st = calculateStatutoryLeaveWithMode(
                editingUser.join_date,
                empType,
                weeklyDays,
                effectiveMode,
                empAtt
              );

              // 比較用の固定値と実績逆算値
              const fixedSt = calculateStatutoryLeaveWithMode(
                editingUser.join_date,
                empType,
                weeklyDays,
                'contract_fixed',
                empAtt
              );
              const actualSt = calculateStatutoryLeaveWithMode(
                editingUser.join_date,
                empType,
                weeklyDays,
                'actual_worked',
                empAtt
              );

              return (
                <div className="p-6 space-y-4">
                  {editingUser.join_date && editingUser.join_date !== '-' ? (
                    <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                            <span>🏛️ 労働基準法に基づく法定参考値</span>
                            <span className="text-[11px] text-slate-500 font-bold">(勤続: {st.serviceText})</span>
                          </div>
                          <div className="text-xs font-bold text-amber-800 mt-1">
                            今年度付与: <span className="text-base font-black text-amber-900">{st.statutoryGrant}日</span>
                            <span className="text-slate-500 font-medium ml-2">（前年繰越目安: {st.prevStatutoryGrant}日）</span>
                          </div>
                        </div>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                          effectiveMode === 'actual_worked' 
                            ? 'bg-amber-100 text-amber-900 border-amber-300' 
                            : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        }`}>
                          {effectiveMode === 'actual_worked' ? '⚡ 実績逆算適用中' : '🏷️ 契約固定適用中'}
                        </span>
                      </div>

                      {/* パートの場合: 実績と契約の2大ワンタッチボタン */}
                      {empType === 'パート' && (
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-amber-200/60">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingUser({
                                ...editingUser,
                                userCustomMode: 'actual_worked',
                                paid_leave_balance: actualSt.statutoryGrant,
                                paid_leave_carryover: actualSt.prevStatutoryGrant
                              });
                              showToast(`⚡ 打刻実績逆算値（${actualSt.statutoryGrant}日）をセットしました`);
                            }}
                            className="p-2 bg-white hover:bg-amber-100 text-amber-950 border border-amber-300 rounded-xl text-xs font-bold text-left transition shadow-2xs cursor-pointer"
                          >
                            <span className="block text-[10px] text-amber-700 font-black">⚡ 打刻実績逆算でセット</span>
                            <span className="text-sm font-black">{actualSt.statutoryGrant}日</span>
                            <span className="text-[10px] text-slate-400 block font-normal">(実働年{st.actualWorkedDaysAnnual}日・週{st.actualEquivalentWeeklyDays}日相当)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingUser({
                                ...editingUser,
                                userCustomMode: 'contract_fixed',
                                paid_leave_balance: fixedSt.statutoryGrant,
                                paid_leave_carryover: fixedSt.prevStatutoryGrant
                              });
                              showToast(`🏷️ 契約所定固定値（${fixedSt.statutoryGrant}日）をセットしました`);
                            }}
                            className="p-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold text-left transition shadow-2xs cursor-pointer"
                          >
                            <span className="block text-[10px] text-slate-500 font-black">🏷️ 契約所定固定でセット</span>
                            <span className="text-sm font-black">{fixedSt.statutoryGrant}日</span>
                            <span className="text-[10px] text-slate-400 block font-normal">(契約上の週{weeklyDays}日)</span>
                          </button>
                        </div>
                      )}

                      {empType !== 'パート' && (
                        <div className="flex justify-end pt-1">
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
                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black shadow-2xs transition flex items-center gap-1 cursor-pointer"
                          >
                            <Zap className="w-3.5 h-3.5" /> 法定値をセット
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-500 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-slate-400" />
                      入社日を設定すると、法定付与日数が自動計算されます。
                    </div>
                  )}

                  {/* パートの場合の実労働実績プレビューカード */}
                  {empType === 'パート' && (
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs space-y-1">
                      <div className="font-black text-slate-700 flex items-center justify-between">
                        <span>📊 直近の勤務実績データ（出勤打刻ベース）</span>
                        <span className="text-[10px] text-amber-700 font-bold">{st.periodText}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center pt-1 font-mono">
                        <div className="bg-white p-2 rounded-xl border border-slate-200">
                          <span className="text-[10px] text-slate-400 block font-sans">期間内実打刻</span>
                          <strong className="text-slate-800 text-sm">{st.actualDaysCount}日</strong>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-slate-200">
                          <span className="text-[10px] text-slate-400 block font-sans">年間換算労働</span>
                          <strong className="text-amber-600 text-sm">{st.actualWorkedDaysAnnual}日</strong>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-slate-200">
                          <span className="text-[10px] text-slate-400 block font-sans">労基法週相当</span>
                          <strong className="text-emerald-600 text-sm">週{st.actualEquivalentWeeklyDays}日相当</strong>
                        </div>
                      </div>
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
                        <label className="block text-xs font-black text-slate-700 mb-1">雇用契約の週所定日数</label>
                        <select 
                          value={editingUser.weekly_working_days || (editingUser.empType === 'パート' || editingUser.employment_type === 'part-time' ? 3 : 5)} 
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

                    {/* パートの場合の個人算定方式オーバーライド */}
                    {editingUser.empType === 'パート' && (
                      <div>
                        <label className="block text-xs font-black text-slate-700 mb-1">
                          このスタッフの有給算定方式
                        </label>
                        <select 
                          value={editingUser.userCustomMode || userCalcModeMap[editingUser.id] || 'default'} 
                          onChange={e => setEditingUser({ ...editingUser, userCustomMode: e.target.value })} 
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs"
                        >
                          <option value="default">会社全体設定に従う（現在: {companyCalcMode === 'actual_worked' ? '⚡打刻実績逆算' : '🏷️契約週日数固定'}）</option>
                          <option value="actual_worked">⚡ 打刻実績から自動逆算（シフト変動パート向け・推奨）</option>
                          <option value="contract_fixed">🏷️ 契約週日数で固定（固定シフトパート向け）</option>
                        </select>
                      </div>
                    )}

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
