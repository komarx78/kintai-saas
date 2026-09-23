import React, { useState, useEffect, useMemo } from 'react';
import { 
  DollarSign, Zap, Calendar, ArrowLeft, CheckCircle, CheckCircle2, 
  Settings, Send, LogOut, RotateCcw, 
  ChevronDown, ChevronUp, Lock, Unlock, Clock, Sparkles, AlertCircle, 
  FileText, ExternalLink, HelpCircle, MessageSquare, X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, addDays } from 'date-fns';
import { ja } from 'date-fns/locale';
import AppSwitcher from '../components/AppSwitcher';

import { calculateLaborCost, generateAutoShift } from '../lib/shiftAlgorithm';
import { HelpGuideModal } from '../components/HelpGuideModal';
import { seedShiftDemoData } from '../lib/seedShiftDemoData';
import { 
  getAllStaffLineLinkMap, 
  syncStaffLineLinkFromDb,
  formatShiftReminderLineMessage, 
  sendShiftRemindersViaLine 
} from '../lib/lineMessaging';

const ShiftAdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [tenantName, setTenantName] = useState<string>('');
  const [loadingStats, setLoadingStats] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUnpublishing, setIsUnpublishing] = useState(false);
  const [generationResult, setGenerationResult] = useState<{ added: number } | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [submittedUserIds, setSubmittedUserIds] = useState<string[]>([]);
  
  const [draftCount, setDraftCount] = useState(0);
  const [confirmedCount, setConfirmedCount] = useState(0);

  const [estimatedLaborCost, setEstimatedLaborCost] = useState(0);
  const [requiredLaborCost, setRequiredLaborCost] = useState(0);

  const [shiftPeriod, setShiftPeriod] = useState<string>('1week');
  const [submissionDeadlineRule, setSubmissionDeadlineRule] = useState<string>('');
  const [isSubmissionLocked, setIsSubmissionLocked] = useState(false);
  const [autoLockDays, setAutoLockDays] = useState<string>('');
  const [isSavingPeriod, setIsSavingPeriod] = useState(false);
  const [isSavingRule, setIsSavingRule] = useState(false);
  const [isSavingLock, setIsSavingLock] = useState(false);
  const [isSavingAutoLock, setIsSavingAutoLock] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // ⚙️ 運用基本設定アコーディオンの開閉状態
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  // 📱 LINE未提出者リマインド用State
  const [tenantId, setTenantId] = useState<string>('');
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [isReminderSending, setIsReminderSending] = useState(false);
  const [reminderSuccessMessage, setReminderSuccessMessage] = useState<string | null>(null);
  const [reminderDeadlineInput, setReminderDeadlineInput] = useState<string>('金曜日 23:59まで');

  // 🧪 検証用ダミーデータの一括投入（店舗配属・必要時間枠・希望シフトを一元生成）
  const handleSeedDummyRequests = async () => {
    if (!window.confirm('【検証用ダミーデータ一括生成】\n全スタッフを3店舗（新宿・渋谷・池袋）に自動配属し、各店舗の必要枠マスタと今週〜来週のダミー希望シフトを一括投入しますか？\n（既存の希望データおよび下書きシフトは一旦上書きされます）')) return;
    setIsSeeding(true);
    try {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id');
      if (!tenantId) {
        alert('テナントIDが取得できませんでした。');
        return;
      }

      const res = await seedShiftDemoData(tenantId);
      if (!res.success) {
        alert('ダミーデータの投入に失敗しました: ' + res.message);
        return;
      }

      alert(`🎉 ${res.message}\n次にカード②の「⚡ 今週のシフトをAI自動作成する」を押してAI割り振りをテストしてください！`);
      setGenerationResult(null);
      await fetchStats();
    } catch (err: any) {
      console.error('ダミー投入エラー:', err);
      alert('ダミー投入に失敗しました: ' + (err.message || err));
    } finally {
      setIsSeeding(false);
    }
  };

  // 1. シフトデータの完全リセット（初期化）
  const handleResetAllShiftData = async () => {
    if (!window.confirm('確定シフト・ドラフトシフト・希望シフトをすべて削除し、完全にリセットします。よろしいですか？')) return;
    setIsResetting(true);
    try {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id');
      if (!tenantId) return;

      await supabase.from('advanced_shifts').delete().eq('tenant_id', tenantId);
      await supabase.from('advanced_shift_requests').delete().eq('tenant_id', tenantId);

      alert('🗑️ シフトデータ（確定・ドラフト・希望）を完全にクリアしました！');
      setGenerationResult(null);
      await fetchStats();
    } catch (err: any) {
      console.error('Reset error:', err);
      alert('リセットに失敗しました: ' + err.message);
    } finally {
      setIsResetting(false);
    }
  };

  const currentDate = useMemo(() => new Date(), []);

  // 基準日 ＆ 管理期間（1週間 / 2週間 / 1ヶ月）の動的計算（全システムSSOT）
  const periodInfo = useMemo(() => {
    let start: Date;
    let end: Date;
    let daysCount = 7;
    let unitLabel = '今週';
    let durationLabel = '1週間';

    if (shiftPeriod === '2weeks') {
      start = startOfWeek(currentDate, { weekStartsOn: 1 });
      end = addDays(start, 13); // 14日間（2週間）
      daysCount = 14;
      unitLabel = '今期（2週間）';
      durationLabel = '2週間';
    } else if (shiftPeriod === '1month') {
      start = startOfMonth(currentDate);
      end = endOfMonth(currentDate);
      daysCount = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      unitLabel = '今月';
      durationLabel = '1ヶ月';
    } else {
      // 1week（デフォルト）
      start = startOfWeek(currentDate, { weekStartsOn: 1 });
      end = endOfWeek(currentDate, { weekStartsOn: 1 });
      daysCount = 7;
      unitLabel = '今週';
      durationLabel = '1週間';
    }

    const startDateStr = format(start, 'yyyy-MM-dd');
    const endDateStr = format(end, 'yyyy-MM-dd');
    const periodLabel = `${format(start, 'yyyy年M月d日', { locale: ja })} 〜 ${format(end, 'M月d日', { locale: ja })}`;

    return {
      start,
      end,
      daysCount,
      unitLabel,
      durationLabel,
      startDateStr,
      endDateStr,
      periodLabel
    };
  }, [currentDate, shiftPeriod]);

  const totalEmployees = allEmployees.length;
  const submittedCount = submittedUserIds.length;
  const submissionRate = totalEmployees > 0 ? Math.round((submittedCount / totalEmployees) * 100) : 0;
  
  // 未提出スタッフの抽出
  const unsubmittedEmployees = allEmployees.filter(emp => !submittedUserIds.includes(emp.id));

  useEffect(() => {
    fetchStats();
  }, [shiftPeriod]);

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id');
      if (!tenantId) return;
      setTenantId(tenantId);

      // 📱 DBからスタッフLINE連携状態を同期（新入社員の追加情報を即時引き継ぎ）
      await syncStaffLineLinkFromDb(tenantId);

      const { data: tData } = await supabase.from('tenants').select('name').eq('id', tenantId).maybeSingle();
      if (tData) setTenantName(tData.name);

      let userList: any[] = [];
      const { data: uDataWithStore, error: uErrWithStore } = await supabase
        .from('users')
        .select('id, name, email, department, store_name')
        .eq('tenant_id', tenantId);

      if (!uErrWithStore && uDataWithStore) {
        userList = uDataWithStore;
      } else {
        const { data: uDataWithoutStore } = await supabase
          .from('users')
          .select('id, name, email, department')
          .eq('tenant_id', tenantId);
        userList = uDataWithoutStore || [];
      }

      // LocalStorage user_positions からの store_name フォールバックマージ
      try {
        const localPosMap = JSON.parse(localStorage.getItem(`user_positions_${tenantId}`) || '{}');
        userList = userList.map(u => ({
          ...u,
          store_name: u.store_name || localPosMap[u.id]?.store_name || ''
        }));
      } catch {}

      // 🏢 本部スタッフ（総務・人事・管理部・営業部など、シフト勤務を行わないスタッフ）を完全除外
      const HQ_DEPARTMENTS = ['総務部', '総務・管理部', '管理部', '人事部', '経理部', '財務部', '営業部', '企画部', '開発部', 'IT部', '本部', '役員'];
      let filteredShiftUsers = userList.filter((u: any) => {
        if (u.store_name && u.store_name.trim() !== '') return true;
        if (HQ_DEPARTMENTS.includes(u.department || '')) return false;
        if (u.department === '店舗運営部') return true;
        return false;
      });

      // 🛡️ 救済フォールバック：初期状態などでまだ全員が店舗未設定の場合、役員以外を全スタッフ候補として採用
      if (filteredShiftUsers.length === 0 && userList.length > 0) {
        filteredShiftUsers = userList.filter((u: any) => u.department !== '役員');
      }

      setAllEmployees(filteredShiftUsers);

      // 1. シフト設定（期間設定 shift_period など）の先行ロード
      let activePeriod = shiftPeriod;
      const { data: settingsData } = await supabase.from('shift_settings').select('*').eq('tenant_id', tenantId).maybeSingle();
      if (settingsData) {
        setRequiredLaborCost(settingsData.monthly_labor_budget || 0);
        if (settingsData.shift_period) {
          setShiftPeriod(settingsData.shift_period);
          activePeriod = settingsData.shift_period;
        }
        if (settingsData.submission_deadline_rule) {
          setSubmissionDeadlineRule(settingsData.submission_deadline_rule);
        }
        if (settingsData.is_submission_locked !== undefined) {
          setIsSubmissionLocked(settingsData.is_submission_locked);
        }
        if (settingsData.auto_lock_days !== undefined && settingsData.auto_lock_days !== null) {
          setAutoLockDays(settingsData.auto_lock_days);
        } else if (settingsData.auto_lock_day !== undefined && settingsData.auto_lock_day !== null) {
          setAutoLockDays(String(settingsData.auto_lock_day));
        }
      }

      // 2. 期間に応じた日付範囲の動的算出（1週間 / 2週間 / 1ヶ月）
      let queryStart: Date;
      let queryEnd: Date;
      if (activePeriod === '2weeks') {
        queryStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        queryEnd = addDays(queryStart, 13);
      } else if (activePeriod === '1month') {
        queryStart = startOfMonth(currentDate);
        queryEnd = endOfMonth(currentDate);
      } else {
        queryStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        queryEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      }
      const startDate = format(queryStart, 'yyyy-MM-dd');
      const endDate = format(queryEnd, 'yyyy-MM-dd');
      
      const { data: reqData } = await supabase.from('advanced_shift_requests').select('user_id').eq('tenant_id', tenantId).gte('target_date', startDate).lte('target_date', endDate);
      const uniqueIds = [...new Set((reqData || []).map(r => r.user_id))];
      setSubmittedUserIds(uniqueIds);

      // 期間分のシフトデータ（ドラフト vs 確定件数の集計）
      const { data: periodShiftsData } = await supabase.from('advanced_shifts')
        .select('id, status')
        .eq('tenant_id', tenantId)
        .gte('target_date', startDate)
        .lte('target_date', endDate);
      
      const drafts = (periodShiftsData || []).filter(s => s.status === 'draft').length;
      const confirmed = (periodShiftsData || []).filter(s => s.status === 'confirmed').length;
      setDraftCount(drafts);
      setConfirmedCount(confirmed);

      const monthStartStr = format(startOfMonth(currentDate), 'yyyy-MM-dd');
      const monthEndStr = format(endOfMonth(currentDate), 'yyyy-MM-dd');
      const { data: shiftsData } = await supabase.from('advanced_shifts').select('*').eq('tenant_id', tenantId).gte('target_date', monthStartStr).lte('target_date', monthEndStr);
      const { data: wageData } = await supabase.from('shift_employee_settings').select('*').eq('tenant_id', tenantId);
      
      if (shiftsData && wageData) {
        const cost = calculateLaborCost(shiftsData, wageData);
        setEstimatedLaborCost(cost);
      }
    } catch (error) {
      console.error('統計データ取得エラー:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const handlePeriodChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPeriod = e.target.value;
    setShiftPeriod(newPeriod);
    setIsSavingPeriod(true);
    try {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id');
      const { error } = await supabase.from('shift_settings').update({ shift_period: newPeriod }).eq('tenant_id', tenantId);
      if (error) throw error;
      await fetchStats();
    } catch (err) {
      console.error('期間設定保存エラー:', err);
      alert('保存に失敗しました');
    } finally {
      setIsSavingPeriod(false);
    }
  };

  const handleSaveRule = async () => {
    setIsSavingRule(true);
    try {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id');
      const { error } = await supabase.from('shift_settings').update({ submission_deadline_rule: submissionDeadlineRule }).eq('tenant_id', tenantId);
      if (error) throw error;
      alert('提出ルールを保存しました。');
    } catch (err) {
      console.error('ルール設定保存エラー:', err);
      alert('保存に失敗しました');
    } finally {
      setIsSavingRule(false);
    }
  };

  const handleToggleLock = async () => {
    setIsSavingLock(true);
    try {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id');
      const newValue = !isSubmissionLocked;
      const { error } = await supabase.from('shift_settings').update({ is_submission_locked: newValue }).eq('tenant_id', tenantId);
      if (error) throw error;
      setIsSubmissionLocked(newValue);
    } catch (err) {
      console.error('ロック設定保存エラー:', err);
      alert('保存に失敗しました');
    } finally {
      setIsSavingLock(false);
    }
  };

  const handleSaveAutoLockDays = async () => {
    setIsSavingAutoLock(true);
    try {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id');
      const val = autoLockDays.trim() === '' ? null : autoLockDays.trim();
      const { error } = await supabase.from('shift_settings').update({ auto_lock_days: val }).eq('tenant_id', tenantId);
      if (error) throw error;
      alert('自動締め切り日を保存しました。');
    } catch (err) {
      console.error('自動締め切り日設定保存エラー:', err);
      alert('保存に失敗しました');
    } finally {
      setIsSavingAutoLock(false);
    }
  };

  const handlePublishDrafts = async () => {
    if (!window.confirm(`${periodInfo.unitLabel}（${periodInfo.durationLabel}）の下書きシフトを確定し、スタッフのスマホマイページへ本番公開します。よろしいですか？\n※確定後もいつでも「下書きに戻す」で再調整できます。`)) return;
    setIsPublishing(true);
    try {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id');
      const startDate = periodInfo.startDateStr;
      const endDate = periodInfo.endDateStr;

      const { error } = await supabase.from('advanced_shifts')
        .update({ status: 'confirmed' })
        .eq('tenant_id', tenantId)
        .eq('status', 'draft')
        .gte('target_date', startDate)
        .lte('target_date', endDate);
      
      if (error) throw error;
      alert(`🎉 ${periodInfo.unitLabel}（${periodInfo.durationLabel}）のシフトを確定し、スタッフへ公開しました！`);
      fetchStats();
    } catch (err) {
      console.error('確定エラー:', err);
      alert('確定処理中にエラーが発生しました。');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleUnpublishDrafts = async () => {
    if (!window.confirm(`${periodInfo.unitLabel}（${periodInfo.durationLabel}）の確定済みシフトを「下書き（作成中）」に戻しますか？\n※スタッフ画面からは未確定状態となり、AI自動生成のやり直しやカレンダーでの手動調整が可能になります。`)) return;
    setIsUnpublishing(true);
    try {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id');
      const startDate = periodInfo.startDateStr;
      const endDate = periodInfo.endDateStr;

      const { error } = await supabase.from('advanced_shifts')
        .update({ status: 'draft' })
        .eq('tenant_id', tenantId)
        .eq('status', 'confirmed')
        .gte('target_date', startDate)
        .lte('target_date', endDate);
      
      if (error) throw error;
      alert('↩️ シフトの確定を解除し、下書き状態に戻しました。再調整が可能です！');
      fetchStats();
    } catch (err) {
      console.error('確定解除エラー:', err);
      alert('確定解除処理中にエラーが発生しました。');
    } finally {
      setIsUnpublishing(false);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerationResult(null);
    try {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id');
      if (!tenantId) return;
      
      const { data: settingsData } = await supabase.from('shift_settings').select('auto_generation_mode').eq('tenant_id', tenantId).maybeSingle();
      const mode = settingsData?.auto_generation_mode || 'equal';
      const { data: empSettings } = await supabase.from('shift_employee_settings').select('*').eq('tenant_id', tenantId);
      
      const startDate = periodInfo.startDateStr;
      const endDate = periodInfo.endDateStr;

      // 既存のドラフトシフトをクリア（再生成時の二重化防止）
      await supabase.from('advanced_shifts')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('status', 'draft')
        .gte('target_date', startDate)
        .lte('target_date', endDate);

      const { data: reqs } = await supabase.from('advanced_shift_requirements').select('*').eq('tenant_id', tenantId);
      const { data: requests } = await supabase.from('advanced_shift_requests').select('*').eq('tenant_id', tenantId).gte('target_date', startDate).lte('target_date', endDate);
      const { data: existingShifts } = await supabase.from('advanced_shifts').select('*').eq('tenant_id', tenantId).gte('target_date', startDate).lte('target_date', endDate);

      const allPeriodGenerated: any[] = [];

      // 💡 設定されたシフト期間の日数（1週間=7日、2週間=14日、1ヶ月=月間日数）分ループして自動生成
      for (let i = 0; i < periodInfo.daysCount; i++) {
        const targetDay = addDays(periodInfo.start, i);
        const targetDateStr = format(targetDay, 'yyyy-MM-dd');
        const dbDow = targetDay.getDay(); // 0: 日 〜 6: 土

        const generated = generateAutoShift(
          reqs || [], 
          requests || [], 
          existingShifts || [], 
          empSettings || [], 
          targetDateStr, 
          dbDow, 
          mode, 
          allPeriodGenerated
        );
        for (const shift of generated) {
          allPeriodGenerated.push({ ...shift, tenant_id: tenantId, status: 'draft' });
        }
      }

      let newShiftsCount = 0;
      if (allPeriodGenerated.length > 0) {
        const { error: insertError } = await supabase.from('advanced_shifts').insert(allPeriodGenerated);
        if (insertError) {
          console.error(insertError);
          alert('シフト保存エラー: ' + insertError.message);
          throw insertError;
        }
        newShiftsCount = allPeriodGenerated.length;
      }
      
      setGenerationResult({ added: newShiftsCount });
      fetchStats();
    } catch (err) {
      console.error('自動生成エラー:', err);
      alert('自動生成中にエラーが発生しました');
    } finally {
      setIsGenerating(false);
    }
  };

  // 📱 未提出スタッフへの一括LINEリマインド送信ハンドラー
  const handleExecuteReminders = async () => {
    if (!tenantId || unsubmittedEmployees.length === 0) return;
    const linkMap = getAllStaffLineLinkMap(tenantId);
    const linkedUnsubmitted = unsubmittedEmployees.filter(emp => Boolean(linkMap[emp.id]));

    if (linkedUnsubmitted.length === 0) {
      alert('未提出のスタッフの中に、LINE連携済みのスタッフがいません。\n「シフト要員マスタ」からスタッフのLINE連携を行ってください。');
      return;
    }

    if (!window.confirm(`未提出のLINE連携スタッフ【${linkedUnsubmitted.length}名】に、希望提出リマインドLINEを一括送信しますか？\n対象期間: ${periodInfo.periodLabel}（${periodInfo.durationLabel}）`)) {
      return;
    }

    setIsReminderSending(true);
    try {
      const periodLabel = periodInfo.periodLabel;
      const payload = linkedUnsubmitted.map(emp => ({
        userId: emp.id,
        staffName: emp.name || emp.email,
        messageText: formatShiftReminderLineMessage({
          staffName: emp.name || emp.email,
          storeName: emp.store_name,
          periodLabel,
          deadlineText: reminderDeadlineInput,
          tenantId: tenantId
        })
      }));

      const res = await sendShiftRemindersViaLine(tenantId, periodLabel, payload);
      setIsReminderModalOpen(false);
      setReminderSuccessMessage(`📢 未提出のスタッフ ${res.sentCount}名へLINE提出リマインドを一括送信しました！`);
      setTimeout(() => setReminderSuccessMessage(null), 6000);
    } catch (e: any) {
      alert('リマインド送信中にエラーが発生しました: ' + (e.message || e));
    } finally {
      setIsReminderSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col">
      {/* 画面最上部：全システム共通ヘッダー（固定トップバー） */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/portal')}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition flex items-center gap-1 text-xs font-bold cursor-pointer"
            title="ポータルに戻る"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">ポータル</span>
          </button>
          <div className="h-4 w-px bg-slate-200" />
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-sm">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                クラウドシフト管理システム
                <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full border border-indigo-200">
                  管理画面
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-bold">{tenantName || '会社名未設定'}</div>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3">
          <button
            onClick={() => setIsHelpOpen(true)}
            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-xl flex items-center space-x-1.5 transition font-bold text-xs shadow-xs cursor-pointer"
            title="シフト作成の流れ・ガイドを見る"
          >
            <HelpCircle className="w-4 h-4 text-indigo-600" />
            <span className="hidden sm:inline">使い方ガイド</span>
          </button>
          <AppSwitcher currentApp="shift" role="admin" />
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

      {/* メインコンテンツエリア */}
      <main className="flex-1 pb-16">
        {/* ヒーローヘッダー ＆ 3ステップナビゲーション */}
        <div className="bg-gradient-to-br from-indigo-700 via-indigo-600 to-purple-700 text-white pt-8 pb-14 px-4 sm:px-6 shadow-md relative overflow-hidden">
          <div className="absolute right-0 top-0 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="max-w-6xl mx-auto">
            {reminderSuccessMessage && (
              <div className="mb-4 p-4 bg-emerald-500/90 backdrop-blur-md border border-emerald-300 text-white rounded-2xl flex items-center justify-between shadow-lg animate-in fade-in">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-5 h-5 text-amber-200 shrink-0" />
                  <span className="font-bold text-sm">{reminderSuccessMessage}</span>
                </div>
                <button 
                  onClick={() => setReminderSuccessMessage(null)} 
                  className="text-white/80 hover:text-white p-1 hover:bg-white/20 rounded-lg transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {/* 上段：タイトル ＆ 対象週バッジ */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-indigo-100 mb-2 border border-white/20">
                  <Clock className="w-3.5 h-3.5" />
                  {periodInfo.unitLabel}の対象期間: {periodInfo.periodLabel}（{periodInfo.durationLabel}）
                </div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2">
                  シフト作成・運用ダッシュボード
                </h1>
                <p className="text-xs sm:text-sm text-indigo-100 mt-1 font-medium">
                  希望収集からAI自動作成・確定公開まで、3つのステップで迷わず完結します
                </p>
              </div>

              {/* クイックリンク */}
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => navigate('/shift/admin/calendar')}
                  className="bg-white text-indigo-700 hover:bg-indigo-50 font-black px-4 py-2.5 rounded-xl shadow-md transition text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Calendar className="w-4 h-4" />
                  <span>カレンダーを開く</span>
                </button>
                <button 
                  onClick={() => navigate('/shift/admin/monthly')}
                  className="bg-white/15 hover:bg-white/25 text-white border border-white/30 font-bold px-3.5 py-2.5 rounded-xl transition text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer backdrop-blur-md"
                >
                  <Clock className="w-4 h-4" />
                  <span>月間状況</span>
                </button>
              </div>
            </div>

            {/* 💡 迷子ゼロ！ 3ステップ・業務進行ナビゲーション */}
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 sm:p-5">
              <div className="text-[11px] font-black uppercase tracking-wider text-indigo-200 mb-3 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                現在の業務進行ステップ（一本道ナビ）
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* STEP 1 */}
                <div className={`p-3.5 rounded-xl border transition-all ${
                  submissionRate < 100 && !isSubmissionLocked
                    ? 'bg-white/25 border-white shadow-md ring-2 ring-white/50' 
                    : 'bg-white/10 border-white/20 opacity-90'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black bg-indigo-500/60 px-2 py-0.5 rounded-md">STEP 1</span>
                    <span className="text-xs font-bold">
                      {isSubmissionLocked ? '🔒 締切済' : '📥 受付中'}
                    </span>
                  </div>
                  <div className="font-bold text-sm mb-1">スタッフの希望を集める</div>
                  <div className="text-xs text-indigo-100 flex items-center gap-1.5">
                    <span>提出率: <strong className="text-white text-sm">{submissionRate}%</strong></span>
                    <span>({submittedCount}/{totalEmployees}名)</span>
                  </div>
                </div>

                {/* STEP 2 */}
                <div className={`p-3.5 rounded-xl border transition-all ${
                  draftCount > 0 
                    ? 'bg-amber-400/25 border-amber-300 shadow-md ring-2 ring-amber-300/60' 
                    : 'bg-white/10 border-white/20 opacity-90'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black bg-amber-500/70 text-amber-100 px-2 py-0.5 rounded-md">STEP 2</span>
                    <span className="text-xs font-bold text-amber-200">
                      {draftCount > 0 ? `✏️ 下書き ${draftCount}件` : '未作成'}
                    </span>
                  </div>
                  <div className="font-bold text-sm mb-1">AI自動作成 ＆ カレンダー調整</div>
                  <div className="text-xs text-indigo-100">
                    ワンクリックで必要人数枠に合わせて自動割り当て
                  </div>
                </div>

                {/* STEP 3 */}
                <div className={`p-3.5 rounded-xl border transition-all ${
                  confirmedCount > 0 && draftCount === 0
                    ? 'bg-emerald-400/25 border-emerald-300 shadow-md ring-2 ring-emerald-300/60' 
                    : 'bg-white/10 border-white/20 opacity-90'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black bg-emerald-500/70 text-emerald-100 px-2 py-0.5 rounded-md">STEP 3</span>
                    <span className="text-xs font-bold text-emerald-200">
                      {confirmedCount > 0 ? `✅ 公開済 ${confirmedCount}件` : '未公開'}
                    </span>
                  </div>
                  <div className="font-bold text-sm mb-1">スタッフへシフト公開</div>
                  <div className="text-xs text-indigo-100">
                    確定ボタンを押すとスタッフのスマホに即座に表示
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 司令塔エリア：3大メインカード */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 -mt-8 relative z-20 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* カード①：📥 スタッフの希望提出状況（STEP 1） */}
            <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-200/80 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">
                      1
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-base sm:text-lg font-black text-slate-800 whitespace-nowrap">希望の提出状況</h2>
                      <p className="text-xs text-slate-400 truncate">{periodInfo.unitLabel}のシフト希望提出（{periodInfo.durationLabel}）</p>
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full border shrink-0 whitespace-nowrap inline-flex items-center ${
                    isSubmissionLocked 
                      ? 'bg-rose-50 text-rose-700 border-rose-200' 
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                    {isSubmissionLocked ? '🔒 締め切り中' : '🟢 受付中'}
                  </span>
                </div>

                {/* 提出率プログレスバー */}
                <div className="mb-4">
                  <div className="flex justify-between items-baseline mb-1.5">
                    <span className="text-3xl font-black text-slate-800">{submissionRate}%</span>
                    <span className="text-xs font-bold text-slate-500">
                      提出済: <strong className="text-indigo-600 text-sm">{submittedCount}</strong> / {totalEmployees}名
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden shadow-inner">
                    <div 
                      className={`h-3 rounded-full transition-all duration-500 ${
                        submissionRate === 100 
                          ? 'bg-emerald-500' 
                          : 'bg-gradient-to-r from-indigo-500 to-blue-500'
                      }`} 
                      style={{ width: `${submissionRate}%` }}
                    />
                  </div>
                </div>

                {/* 未提出スタッフ一覧バッジ */}
                <div className="mb-4 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="text-[11px] font-bold text-slate-500 mb-2 flex items-center justify-between">
                    <span>未提出のスタッフ ({unsubmittedEmployees.length}名)</span>
                    {unsubmittedEmployees.length === 0 && (
                      <span className="text-emerald-600 font-black flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> 全員提出完了！
                      </span>
                    )}
                  </div>
                  {unsubmittedEmployees.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {unsubmittedEmployees.map(emp => (
                        <span key={emp.id} className="text-xs bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-0.5 rounded-lg font-bold">
                          {emp.name || emp.email}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs text-slate-400">全員の希望が集まりました。AI自動作成へ進めます！</p>
                      <div className="mt-2.5 p-2 bg-emerald-50/80 rounded-xl border border-emerald-200 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                          📱 未提出者へのLINE一括催促機能（配備済）
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsReminderModalOpen(true)}
                          className="px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-lg text-[10px] font-black transition cursor-pointer shadow-2xs"
                          title="未提出者が発生した際に送信されるLINE催促画面やメッセージのプレビューを確認できます"
                        >
                          催促画面を確認・テスト
                        </button>
                      </div>
                    </div>
                  )}

                  {unsubmittedEmployees.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsReminderModalOpen(true)}
                      className="w-full mt-3 py-2.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-black text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer border border-emerald-400"
                      title="シフト希望がまだ提出されていないスタッフへLINEで一括リマインドを送信します"
                    >
                      <MessageSquare className="w-4 h-4 text-emerald-200" />
                      <span>📱 未提出者（{unsubmittedEmployees.length}名）へLINE一括催促</span>
                    </button>
                  )}
                </div>

                {/* 提出ルール表示 */}
                {submissionDeadlineRule && (
                  <div className="mb-4 text-xs bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100 text-slate-600">
                    <span className="font-bold text-indigo-700">📌 提出ルール: </span>
                    {submissionDeadlineRule}
                  </div>
                )}
              </div>

              {/* 下部アクション */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => navigate('/shift/admin/requests')}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-xl transition text-xs flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                  <span>希望一覧を確認する</span>
                </button>
                
                <button
                  onClick={handleSeedDummyRequests}
                  disabled={isSeeding}
                  className="w-full bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold py-2.5 px-4 rounded-xl transition text-xs flex items-center justify-center gap-1.5 cursor-pointer border border-amber-300 shadow-2xs"
                  title={`全スタッフの${periodInfo.durationLabel}分（${periodInfo.daysCount}日間）の希望シフトを一発で投入してAI生成をテストできます`}
                >
                  {isSeeding ? (
                    <div className="animate-spin w-3.5 h-3.5 border-2 border-amber-600 border-t-transparent rounded-full"></div>
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-amber-600 fill-amber-600" />
                  )}
                  <span>{isSeeding ? 'ダミー希望を投入中...' : '🧪 検証用ダミー希望を一括投入する'}</span>
                </button>

                <button
                  onClick={handleToggleLock}
                  disabled={isSavingLock}
                  className={`w-full font-bold py-2 px-4 rounded-xl transition text-xs flex items-center justify-center gap-1.5 cursor-pointer border ${
                    isSubmissionLocked
                      ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300'
                      : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-300'
                  }`}
                >
                  {isSubmissionLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  <span>{isSubmissionLocked ? '提出ロックを解除して受付再開' : 'シフト希望の提出を締め切る（ロック）'}</span>
                </button>
              </div>
            </div>

            {/* カード②：⚡ AIシフト作成 ＆ 調整ステーション（STEP 2 & 3） */}
            <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 text-white rounded-3xl p-6 shadow-xl border border-indigo-500/50 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>

              <div>
                <div className="mb-4">
                  {/* 1段目：ステップ番号 ＆ ステータスバッジ */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-white/20 text-white flex items-center justify-center font-black text-xs backdrop-blur-md">
                        2
                      </div>
                      <span className="text-xs font-bold text-indigo-200 tracking-wide">AIシフト作成</span>
                    </div>

                    {/* ステータスバッジ（絶対に他と被らない独立配置） */}
                    <div>
                      {draftCount > 0 ? (
                        <span className="bg-amber-400 text-slate-900 font-black text-xs px-2.5 py-1 rounded-full shadow-xs whitespace-nowrap inline-flex items-center">
                          下書き {draftCount}件
                        </span>
                      ) : confirmedCount > 0 ? (
                        <span className="bg-emerald-400 text-slate-900 font-black text-xs px-2.5 py-1 rounded-full shadow-xs whitespace-nowrap inline-flex items-center">
                          確定済 {confirmedCount}件
                        </span>
                      ) : (
                        <span className="bg-white/20 text-indigo-100 font-bold text-xs px-2.5 py-1 rounded-full whitespace-nowrap inline-flex items-center">
                          未作成
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 2段目：メインタイトル（横幅100%で被りゼロ） */}
                  <h2 className="text-lg font-black flex items-center gap-1.5 text-white">
                    <Zap className="w-5 h-5 text-amber-300 fill-amber-300 shrink-0" />
                    <span>AIシフト作成 ＆ 確定</span>
                  </h2>

                  {/* 3段目：サブタイトル */}
                  <p className="text-xs text-indigo-200 mt-1">必要枠に合わせて自動作成・公開</p>
                </div>

                <p className="text-xs text-indigo-100 mb-4 leading-relaxed">
                  提出された希望と曜日別の必要人数枠を照らし合わせ、最適なシフトをAIが瞬時に自動割り当てします。
                </p>

                {/* 自動生成結果通知 */}
                {generationResult && (
                  <div className="bg-emerald-500/30 border border-emerald-400/60 rounded-2xl p-3.5 mb-4 text-center">
                    <p className="font-bold text-emerald-100 text-xs flex items-center justify-center gap-1 mb-1">
                      <CheckCircle className="w-4 h-4 text-emerald-300" />
                      {generationResult.added}件の下書きシフトを自動作成しました！
                    </p>
                    <p className="text-[11px] text-emerald-200">
                      カレンダーで手動調整するか、このままスタッフへ公開できます。
                    </p>
                  </div>
                )}

                {/* メインアクション：AI自動生成ボタン */}
                <button 
                  onClick={handleGenerate} 
                  disabled={isGenerating}
                  className="w-full bg-white hover:bg-indigo-50 text-indigo-700 font-black py-3.5 px-4 rounded-2xl shadow-lg hover:scale-[1.01] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:hover:scale-100 mb-3"
                >
                  {isGenerating ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full"></div>
                      <span className="text-sm">AIがシフトを自動割り当て中...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-500 fill-amber-500" />
                      <span className="text-sm font-black whitespace-nowrap">⚡ {periodInfo.unitLabel}のシフトをAI自動作成する</span>
                    </>
                  )}
                </button>

                {/* カレンダーで微調整ボタン */}
                <button
                  onClick={() => navigate('/shift/admin/calendar')}
                  className="w-full bg-white/20 hover:bg-white/30 text-white font-bold py-2.5 px-4 rounded-xl border border-white/30 transition text-xs flex items-center justify-center gap-1.5 cursor-pointer backdrop-blur-md mb-3 whitespace-nowrap shrink-0"
                >
                  <Calendar className="w-4 h-4 shrink-0" />
                  <span>📅 カレンダーで確認・微調整</span>
                </button>
              </div>

              {/* 下部：公開・確定アクション（STEP 3） */}
              <div className="pt-3 border-t border-white/20 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-indigo-200 mb-1">
                  <span>スタッフへの公開（確定）</span>
                  <span>いつでも下書きに戻せます</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={handlePublishDrafts} 
                    disabled={isPublishing || draftCount === 0}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white font-black py-2.5 px-3 rounded-xl transition text-xs flex items-center justify-center gap-1 shadow-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    title="下書きシフトを確定し、スタッフのスマホマイページへ公開します"
                  >
                    {isPublishing ? (
                      <div className="animate-spin w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full"></div>
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>📢 シフトを公開</span>
                  </button>

                  <button 
                    onClick={handleUnpublishDrafts} 
                    disabled={isUnpublishing || confirmedCount === 0}
                    className="bg-slate-800/80 hover:bg-slate-800 text-slate-200 font-bold py-2.5 px-3 rounded-xl transition text-xs flex items-center justify-center gap-1 border border-white/20 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    title="確定済みシフトを下書きに戻し、再度のAI生成や手動調整を可能にします"
                  >
                    {isUnpublishing ? (
                      <div className="animate-spin w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full"></div>
                    ) : (
                      <RotateCcw className="w-3.5 h-3.5 text-amber-300" />
                    )}
                    <span>↩️ 下書きに戻す</span>
                  </button>
                </div>
              </div>
            </div>

            {/* カード③：💰 人件費予算 ＆ 労働時間の予実サマリー */}
            <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-200/80 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-sm shrink-0">
                      3
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-base sm:text-lg font-black text-slate-800 whitespace-nowrap">今月の人件費予実</h2>
                      <p className="text-xs text-slate-400 truncate">確定シフトに基づくリアルタイム試算</p>
                    </div>
                  </div>
                  <DollarSign className="w-5 h-5 text-indigo-500 shrink-0" />
                </div>

                {loadingStats ? (
                  <div className="h-32 flex justify-center items-center">
                    <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
                  </div>
                ) : (
                  <div>
                    <div className="mb-4">
                      <div className="text-xs font-bold text-slate-400 mb-1">今月のシフト人件費予測</div>
                      <div className="text-3xl sm:text-4xl font-black text-indigo-600 tracking-tight">
                        ¥{estimatedLaborCost.toLocaleString()}
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 mb-4">
                      <div className="flex justify-between items-center text-xs mb-1">
                        <span className="font-bold text-slate-500">予算設定額:</span>
                        <span className="font-bold text-slate-700">
                          {requiredLaborCost > 0 ? `¥${requiredLaborCost.toLocaleString()}` : '未設定'}
                        </span>
                      </div>
                      
                      <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden mt-2">
                        <div 
                          className={`h-2.5 rounded-full transition-all duration-500 ${
                            estimatedLaborCost > requiredLaborCost && requiredLaborCost > 0 
                              ? 'bg-rose-500' 
                              : 'bg-gradient-to-r from-indigo-500 to-blue-500'
                          }`} 
                          style={{ width: requiredLaborCost > 0 ? `${Math.min((estimatedLaborCost / requiredLaborCost) * 100, 100)}%` : '0%' }}
                        />
                      </div>

                      {estimatedLaborCost > requiredLaborCost && requiredLaborCost > 0 && (
                        <p className="text-[11px] font-bold text-rose-600 mt-2 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" /> 予算設定額をオーバーしています
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 下部リンク */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => navigate('/shift/admin/monthly')}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-xl transition text-xs flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  <span>月間の充足・不足を確認</span>
                </button>
                <button
                  onClick={() => navigate('/shift/admin/settings')}
                  className="w-full text-slate-500 hover:text-indigo-600 font-bold py-1.5 px-4 rounded-xl transition text-xs flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Settings className="w-3.5 h-3.5 shrink-0" />
                  <span>予算・AI生成モードを変更</span>
                </button>
              </div>
            </div>

          </div>

          {/* ⚙️ 運用の基本設定アコーディオン（日常はすっきり、必要な時だけ開く） */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className="w-full p-5 sm:p-6 flex items-center justify-between text-left hover:bg-slate-50 transition cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-base font-black text-slate-800 flex items-center gap-2">
                    ⚙️ シフト運用の基本設定
                    <span className="text-xs font-bold text-slate-400 font-normal">（期間・ルール・自動ロック・必要枠）</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    対象期間（1週間/2週間/月）や締切ルール、時間帯別必要人数、人員マスタの設定
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-600">
                <span>{isSettingsOpen ? '閉じる' : '設定を展開'}</span>
                {isSettingsOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>
            </button>

            {/* 開閉コンテンツ */}
            {isSettingsOpen && (
              <div className="p-5 sm:p-6 border-t border-slate-100 bg-slate-50/50 space-y-6">
                
                {/* 1. マスタ管理ショートカット */}
                <div>
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3">
                    マスタ・ルール設定リンク
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      onClick={() => navigate('/shift/admin/patterns')}
                      className="bg-white hover:bg-indigo-50 border border-slate-200 p-4 rounded-2xl flex items-center justify-between text-left transition shadow-xs group cursor-pointer"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 whitespace-nowrap">👥 必要人数枠の設定</div>
                        <div className="text-[11px] text-slate-400 mt-0.5 whitespace-nowrap">時間帯・曜日別の必要人数</div>
                      </div>
                      <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 shrink-0" />
                    </button>

                    <button
                      onClick={() => navigate('/shift/admin/employees')}
                      className="bg-white hover:bg-indigo-50 border border-slate-200 p-4 rounded-2xl flex items-center justify-between text-left transition shadow-xs group cursor-pointer"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 whitespace-nowrap">🧑‍💼 人員マスタ設定</div>
                        <div className="text-[11px] text-slate-400 mt-0.5 whitespace-nowrap">時給・標準役割の設定</div>
                      </div>
                      <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 shrink-0" />
                    </button>

                    <button
                      onClick={() => navigate('/shift/admin/settings')}
                      className="bg-white hover:bg-indigo-50 border border-slate-200 p-4 rounded-2xl flex items-center justify-between text-left transition shadow-xs group cursor-pointer"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 whitespace-nowrap">⚡ AI生成・詳細設定</div>
                        <div className="text-[11px] text-slate-400 mt-0.5 whitespace-nowrap">均等配分/希望優先の選択</div>
                      </div>
                      <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 shrink-0" />
                    </button>
                  </div>
                </div>

                {/* 2. 期間 ＆ 締め切り日設定 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-5 rounded-2xl border border-slate-200">
                  {/* 期間設定 */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      シフト管理期間の単位
                    </label>
                    <div className="flex items-center gap-3">
                      <select
                        value={shiftPeriod}
                        onChange={handlePeriodChange}
                        disabled={isSavingPeriod}
                        className="px-3.5 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-slate-700 font-bold text-xs flex-1"
                      >
                        <option value="1week">1週間（推奨・毎週更新）</option>
                        <option value="2weeks">2週間（半月ごと）</option>
                        <option value="1month">1ヶ月（月単位）</option>
                      </select>
                      {isSavingPeriod && <span className="text-xs text-indigo-500 font-bold animate-pulse">保存中...</span>}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">※シフト提出画面やカレンダーの基準期間になります。</p>
                  </div>

                  {/* 自動締め切り日 */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      自動締め切り日（毎月）
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={autoLockDays}
                        onChange={(e) => setAutoLockDays(e.target.value)}
                        placeholder="例: 10,25（カンマ区切り）"
                        className="px-3.5 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-slate-700 text-xs flex-1"
                      />
                      <button
                        onClick={handleSaveAutoLockDays}
                        disabled={isSavingAutoLock}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-xl transition text-xs disabled:opacity-50 cursor-pointer"
                      >
                        {isSavingAutoLock ? '保存中...' : '保存'}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">※指定した日を過ぎると自動的にシフト提出がロックされます（空欄で手動のみ）。</p>
                  </div>
                </div>

                {/* 3. 提出ルールの案内文 */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    スタッフ向け 提出ルールの案内文（スマホ提出画面の上部に表示）
                  </label>
                  <textarea
                    value={submissionDeadlineRule}
                    onChange={(e) => setSubmissionDeadlineRule(e.target.value)}
                    placeholder="例: 1〜15日のシフトは前月20日までに提出してください。希望休は月3日まででお願いします。"
                    className="w-full p-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-slate-700 text-xs min-h-[80px]"
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      onClick={handleSaveRule}
                      disabled={isSavingRule}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-5 rounded-xl transition text-xs disabled:opacity-50 cursor-pointer"
                    >
                      {isSavingRule ? '保存中...' : 'ルール案内文を保存'}
                    </button>
                  </div>
                </div>

                {/* 4. 危険操作エリア（全リセット） */}
                <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                      シフトデータのリセット（初期化）
                    </div>
                    <p className="text-[11px] text-rose-600 mt-0.5">
                      登録されている確定・下書き・希望シフトをすべて消去します。テストデータを一掃したい場合に使用します。
                    </p>
                  </div>
                  <button
                    onClick={handleResetAllShiftData}
                    disabled={isResetting}
                    className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2 rounded-xl transition text-xs shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    {isResetting ? '削除中...' : '🗑️ 全データをリセット'}
                  </button>
                </div>

              </div>
            )}
          </div>

        </div>
      </main>

      {/* 📱 未提出スタッフへのLINE一括リマインドモーダル */}
      {isReminderModalOpen && (() => {
        const linkMap = tenantId ? getAllStaffLineLinkMap(tenantId) : {};
        const unsubmittedWithLink = unsubmittedEmployees.map(emp => ({
          ...emp,
          isLineLinked: Boolean(linkMap[emp.id])
        }));
        const linkedCount = unsubmittedWithLink.filter(e => e.isLineLinked).length;
        const unlinkedCount = unsubmittedWithLink.filter(e => !e.isLineLinked).length;
        const periodLabel = periodInfo.periodLabel;
        const sampleEmpName = unsubmittedWithLink[0]?.name || '佐藤 健太';

        const previewMsg = formatShiftReminderLineMessage({
          staffName: sampleEmpName,
          storeName: tenantName,
          periodLabel,
          deadlineText: reminderDeadlineInput,
          tenantId: tenantId
        });

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl text-left overflow-hidden shadow-2xl w-full max-w-4xl flex flex-col border border-slate-200 max-h-[92vh]">
              {/* モーダルヘッダー */}
              <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 p-5 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner">
                    <MessageSquare className="w-5 h-5 text-emerald-200" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black tracking-tight">📱 シフト希望 未提出者へLINE一括催促</h3>
                    <p className="text-xs text-emerald-100 mt-0.5">
                      まだシフト希望を出していないスタッフへ、スマホから30秒で出せるリンク付きでLINE通知を送ります
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsReminderModalOpen(false)}
                  className="p-2 hover:bg-white/20 rounded-full transition text-white/80 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 締切設定バー */}
              <div className="p-4 bg-emerald-50/50 border-b border-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <span>📅 対象期間:</span>
                  <span className="bg-white px-2.5 py-1 rounded-lg border border-emerald-200 text-emerald-900">
                    {periodLabel}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700 whitespace-nowrap">⏰ 提出締切日時の案内:</span>
                  <input
                    type="text"
                    value={reminderDeadlineInput}
                    onChange={(e) => setReminderDeadlineInput(e.target.value)}
                    placeholder="例: 今週金曜日 23:59まで"
                    className="text-xs px-3 py-1.5 rounded-xl border border-emerald-200 bg-white font-medium focus:ring-2 focus:ring-emerald-400 focus:outline-none w-48 sm:w-60"
                  />
                </div>
              </div>

              {/* メインエリア：未提出スタッフ一覧 ＆ スマホLINEプレビュー */}
              <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-200">
                {/* 左：未提出スタッフ一覧 */}
                <div className="md:col-span-5 p-4 overflow-y-auto space-y-2 max-h-[45vh] md:max-h-none">
                  <div className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
                    <span>未提出スタッフ一覧:</span>
                    <span className="text-[10px] text-slate-400">計 {unsubmittedWithLink.length}名</span>
                  </div>

                  {unsubmittedWithLink.length > 0 ? (
                    unsubmittedWithLink.map(emp => (
                      <div
                        key={emp.id}
                        className={`p-3 rounded-2xl border text-xs flex items-center justify-between gap-2 ${
                          emp.isLineLinked 
                            ? 'bg-emerald-50/50 border-emerald-200' 
                            : 'bg-slate-50 border-slate-200 opacity-60'
                        }`}
                      >
                        <div>
                          <div className="font-black text-slate-800 flex items-center gap-1.5">
                            <span>{emp.name || emp.email}</span>
                            {emp.isLineLinked ? (
                              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded border border-emerald-300">
                                🟢 送信対象
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded">
                                ⚪ LINE未連携
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {emp.store_name ? `${emp.store_name}所属` : '店舗未設定'}
                          </div>
                        </div>
                        <span className="text-[11px] font-bold text-rose-600">未提出</span>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-700">現在、未提出のスタッフはいません</p>
                      <p className="text-[11px] text-slate-400 mt-1">（※未提出者が発生すると、ここに自動で対象者がリストアップされます）</p>
                    </div>
                  )}
                </div>

                {/* 右：スマホLINEトーク画面風プレビュー */}
                <div className="md:col-span-7 p-4 bg-slate-100/70 overflow-y-auto flex flex-col items-center justify-center">
                  <div className="w-full max-w-sm bg-slate-200/90 rounded-[2.5rem] p-3 shadow-xl border-4 border-slate-800">
                    <div className="w-24 h-4 bg-slate-800 rounded-full mx-auto mb-2"></div>
                    <div className="bg-[#7895b2] rounded-[1.8rem] p-3 min-h-[340px] flex flex-col justify-between shadow-inner">
                      <div>
                        <div className="text-center text-[10px] text-white/80 font-bold mb-3 bg-black/20 py-0.5 px-2 rounded-full w-fit mx-auto">
                          今日 {format(new Date(), 'HH:mm')}
                        </div>

                        <div className="flex items-start gap-2 max-w-[90%]">
                          <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[11px] font-bold shadow-xs shrink-0">
                            📱
                          </div>
                          <div className="bg-white rounded-2xl rounded-tl-xs p-3 shadow-md text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
                            {previewMsg}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 bg-white/90 backdrop-blur-xs rounded-xl p-2 text-center text-[10px] text-slate-500 font-bold border border-white/50">
                        📱 スタッフのスマホLINE受信画面プレビュー
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* フッター操作バー */}
              <div className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div className="text-xs text-slate-600 font-medium">
                  送信対象: <strong className="text-emerald-700 font-black">{linkedCount}名</strong>（LINE未連携: {unlinkedCount}名）
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsReminderModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  >
                    キャンセル
                  </button>

                  <button
                    onClick={handleExecuteReminders}
                    disabled={isReminderSending || linkedCount === 0}
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black shadow-md transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {isReminderSending ? (
                      <>
                        <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></div>
                        <span>一括送信中...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 text-emerald-200" />
                        <span>🚀 LINE連携済みの未提出者（{linkedCount}名）へ一括送信</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ❓ 使い方ガイドモーダル */}
      <HelpGuideModal 
        screenKey="shift_dashboard" 
        isOpen={isHelpOpen} 
        onClose={() => setIsHelpOpen(false)} 
      />
    </div>
  );
};

export default ShiftAdminDashboard;



