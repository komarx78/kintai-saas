import React, { useState, useEffect } from 'react';
import { DollarSign, Zap, Calendar, ArrowLeft, CheckCircle, Settings, Users, ClipboardList, Send, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, addDays } from 'date-fns';
import AppSwitcher from '../components/AppSwitcher';

import { calculateLaborCost, generateAutoShift } from '../lib/shiftAlgorithm';
import { HelpGuideModal } from '../components/HelpGuideModal';

const ShiftAdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [tenantName, setTenantName] = useState<string>('');
  const [loadingStats, setLoadingStats] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [generationResult, setGenerationResult] = useState<{ added: number } | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [submittedUserIds, setSubmittedUserIds] = useState<string[]>([]);
  
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

  const currentDate = new Date();
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

  const totalEmployees = allEmployees.length;
  const submittedCount = submittedUserIds.length;
  const submissionRate = totalEmployees > 0 ? Math.round((submittedCount / totalEmployees) * 100) : 0;

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id');
      if (!tenantId) return;

      const { data: tData } = await supabase.from('tenants').select('name').eq('id', tenantId).maybeSingle();
      if (tData) setTenantName(tData.name);

      const { data: empData } = await supabase.from('users').select('id, name, email').eq('tenant_id', tenantId);
      setAllEmployees(empData || []);

      const startDate = format(weekStart, 'yyyy-MM-dd');
      const endDate = format(weekEnd, 'yyyy-MM-dd');
      
      const { data: reqData } = await supabase.from('advanced_shift_requests').select('user_id').eq('tenant_id', tenantId).gte('target_date', startDate).lte('target_date', endDate);
      const uniqueIds = [...new Set((reqData || []).map(r => r.user_id))];
      setSubmittedUserIds(uniqueIds);

      const { data: settingsData } = await supabase.from('shift_settings').select('*').eq('tenant_id', tenantId).maybeSingle();
      if (settingsData) {
        setRequiredLaborCost(settingsData.monthly_labor_budget || 0);
        if (settingsData.shift_period) {
          setShiftPeriod(settingsData.shift_period);
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
    if (!window.confirm('対象期間の下書きシフトをすべて確定（公開）します。よろしいですか？')) return;
    setIsPublishing(true);
    try {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id');
      const startDate = format(weekStart, 'yyyy-MM-dd');
      const endDate = format(weekEnd, 'yyyy-MM-dd');

      const { error } = await supabase.from('advanced_shifts')
        .update({ status: 'confirmed' })
        .eq('tenant_id', tenantId)
        .eq('status', 'draft')
        .gte('target_date', startDate)
        .lte('target_date', endDate);
      
      if (error) throw error;
      alert('シフトを確定しました！');
      fetchStats();
    } catch (err) {
      console.error('確定エラー:', err);
      alert('確定処理中にエラーが発生しました。');
    } finally {
      setIsPublishing(false);
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
      
      const startDate = format(weekStart, 'yyyy-MM-dd');
      const endDate = format(weekEnd, 'yyyy-MM-dd');

      // 既存のドラフトシフトをクリア（再生成時の二重化防止）
      await supabase.from('advanced_shifts')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('status', 'draft')
        .gte('target_date', startDate)
        .lte('target_date', endDate);

      const { data: reqs } = await supabase.from('advanced_shift_requirements').select('*').eq('tenant_id', tenantId).is('target_date', null);
      const { data: requests } = await supabase.from('advanced_shift_requests').select('*').eq('tenant_id', tenantId).gte('target_date', startDate).lte('target_date', endDate);
      const { data: existingShifts } = await supabase.from('advanced_shifts').select('*').eq('tenant_id', tenantId).gte('target_date', startDate).lte('target_date', endDate);

      const allPeriodGenerated: any[] = [];

      for (let i = 0; i < 7; i++) {
        const targetDay = addDays(weekStart, i);
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans relative overflow-hidden flex flex-col">
      {/* 画面最上部：全システム共通ヘッダー（固定トップバー） */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-xs">
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
              <div className="text-[10px] text-slate-400 font-bold">{tenantName || '株式会社KAP'}</div>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsHelpOpen(true)}
            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3.5 py-1.5 rounded-xl flex items-center space-x-1.5 transition font-bold text-xs shadow-xs cursor-pointer"
            title="シフト管理ダッシュボードの使い方・目的を見る"
          >
            <span className="text-sm">❓</span>
            <span>使い方ガイド</span>
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

      {/* グラデーション背景バナー */}
      <div className="relative flex-1">
        <div className="absolute top-0 left-0 w-full h-[320px] bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-700 opacity-90 rounded-b-[3rem] shadow-2xl"></div>
        
        <div className="relative z-10 max-w-6xl mx-auto px-4 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-4">
            <div className="text-white">
              <h1 className="text-2xl lg:text-3xl font-black flex items-center tracking-tight">
                シフト管理ダッシュボード
              </h1>
              <p className="text-xs text-indigo-100 mt-1 font-medium">希望シフトの収集からAI自動生成・確定・人件費試算まで一括管理</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button 
                onClick={handleResetAllShiftData} 
                disabled={isResetting}
                className="bg-rose-500 hover:bg-rose-600 text-white shadow-md px-3 py-2 rounded-xl flex items-center transition font-bold text-xs cursor-pointer disabled:opacity-50"
                title="確定シフト・ドラフト・希望を全削除して初期化します"
              >
                {isResetting ? <div className="animate-spin w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full mr-1.5"></div> : <span className="mr-1">🗑️</span>}
                全リセット
              </button>
              <button 
                onClick={handlePublishDrafts} 
                disabled={isPublishing}
                className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-md px-3.5 py-2 rounded-xl flex items-center transition font-bold text-xs disabled:opacity-50 cursor-pointer"
              >
                {isPublishing ? <div className="animate-spin w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full mr-1.5"></div> : <Send className="w-3.5 h-3.5 mr-1.5" />}
                下書き確定（Publish）
              </button>
              <button onClick={() => navigate('/shift/admin/employees')} className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-md px-3 py-2 rounded-xl flex items-center transition shadow-xs font-bold border border-white/30 text-xs cursor-pointer">
                <Users className="w-3.5 h-3.5 mr-1.5" />人員マスタ
              </button>
              <button onClick={() => navigate('/shift/admin/patterns')} className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-md px-3 py-2 rounded-xl flex items-center transition shadow-xs font-bold border border-white/30 text-xs cursor-pointer">
                <ClipboardList className="w-3.5 h-3.5 mr-1.5" />必要枠設定
              </button>
              <button onClick={() => navigate('/shift/admin/monthly')} className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-md px-3 py-2 rounded-xl flex items-center transition shadow-xs font-bold border border-white/30 text-xs cursor-pointer">
                <Calendar className="w-3.5 h-3.5 mr-1.5" />月間状況
              </button>
              <button onClick={() => navigate('/shift/admin/settings')} className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-md px-3 py-2 rounded-xl flex items-center transition shadow-xs font-bold border border-white/30 text-xs cursor-pointer">
                <Settings className="w-3.5 h-3.5 mr-1.5" />詳細設定
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 flex items-center">
                    <DollarSign className="w-6 h-6 mr-2 text-indigo-500" />
                    今月の人件費予実
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">※確定シフトに基づく試算</p>
                </div>
              </div>

              {loadingStats ? (
                <div className="h-32 flex justify-center items-center"><div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div></div>
              ) : (
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <div>
                      <span className="text-4xl font-black text-indigo-600 tracking-tight">¥{estimatedLaborCost.toLocaleString()}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">予算設定額</div>
                      <div className="text-lg font-bold text-slate-700">¥{requiredLaborCost > 0 ? requiredLaborCost.toLocaleString() : '未設定'}</div>
                    </div>
                  </div>

                  <div className="w-full bg-slate-100 rounded-full h-4 mt-4 overflow-hidden shadow-inner">
                    <div 
                      className={`h-4 rounded-full ${estimatedLaborCost > requiredLaborCost && requiredLaborCost > 0 ? 'bg-red-500' : 'bg-gradient-to-r from-indigo-500 to-blue-500'}`} 
                      style={{ width: requiredLaborCost > 0 ? `${Math.min((estimatedLaborCost / requiredLaborCost) * 100, 100)}%` : '0%' }}
                    ></div>
                  </div>
                  {estimatedLaborCost > requiredLaborCost && requiredLaborCost > 0 && (
                    <p className="text-xs font-bold text-red-500 mt-2 text-right flex items-center justify-end">
                      <Zap className="w-3 h-3 mr-1" /> 予算をオーバーしています！
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-3xl p-6 shadow-xl border border-indigo-500/50 text-white relative overflow-hidden">
              <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/10 rounded-full blur-2xl"></div>
              <h2 className="text-xl font-bold mb-2 flex items-center">
                <Zap className="w-6 h-6 mr-2 text-yellow-300" />
                オートシフト生成 (AI)
              </h2>
              <p className="text-indigo-100 text-sm mb-6">提出された希望と必要枠を照らし合わせ、今週の最適なシフトを1秒で自動作成します。</p>

              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 mb-6 border border-white/20 flex justify-between items-center cursor-pointer hover:bg-white/20 transition" onClick={() => navigate('/shift/admin/requests')}>
                <div>
                  <div className="text-xs text-indigo-200 mb-1">今週のシフト提出率</div>
                  <div className="text-2xl font-bold">{submissionRate}%</div>
                </div>
                <div className="w-px h-10 bg-white/20"></div>
                <div>
                  <div className="text-xs text-indigo-200 mb-1">対象期間</div>
                  <div className="font-bold text-sm">{format(weekStart, 'M/d')} - {format(weekEnd, 'M/d')}</div>
                </div>
              </div>

              {generationResult ? (
                <div className="bg-emerald-500/20 border border-emerald-400 rounded-2xl p-4 text-center">
                  <p className="font-bold text-emerald-100 mb-3 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 mr-2 text-emerald-300" />
                    {generationResult.added}件のシフトを自動生成しました！
                  </p>
                  <div className="mt-4 flex gap-2">
                    <button onClick={() => navigate('/shift/admin/calendar')} className="flex-1 bg-white text-indigo-700 font-black py-3 rounded-xl shadow-lg hover:bg-indigo-50 transition text-sm flex items-center justify-center cursor-pointer">
                      📅 シフトカレンダーで確認
                    </button>
                    <button onClick={() => setGenerationResult(null)} className="px-4 bg-white/20 hover:bg-white/30 text-white font-bold py-3 rounded-xl transition text-sm cursor-pointer">
                      再生成
                    </button>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={handleGenerate} 
                  disabled={isGenerating}
                  className="w-full bg-white text-indigo-700 font-black py-4 rounded-xl shadow-lg hover:bg-indigo-50 hover:scale-[1.02] transition-all flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:hover:scale-100"
                >
                  {isGenerating ? (
                    <><div className="animate-spin w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full mr-3"></div>AIがシフトを自動割り当て中...</>
                  ) : (
                    <><Zap className="w-5 h-5 mr-2 text-amber-500 fill-amber-500" />⚡ シフトを自動生成する (AI)</>
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 relative overflow-hidden mb-8">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center">
              <Settings className="w-6 h-6 mr-2 text-indigo-500" />
              シフト管理期間設定
            </h2>
            <div className="flex items-center space-x-4">
              <select
                value={shiftPeriod}
                onChange={handlePeriodChange}
                disabled={isSavingPeriod}
                className="px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-slate-700 font-bold min-w-[200px]"
              >
                <option value="1week">1週間</option>
                <option value="2weeks">2週間</option>
                <option value="1month">1ヶ月</option>
              </select>
              {isSavingPeriod && <span className="text-sm text-indigo-500 font-bold animate-pulse">保存中...</span>}
              {!isSavingPeriod && shiftPeriod && (
                <span className="text-sm text-emerald-600 font-bold flex items-center">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  現在の設定: {shiftPeriod === '1week' ? '1週間' : shiftPeriod === '2weeks' ? '2週間' : '1ヶ月'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-2">※この設定はシフト提出画面やカレンダーの表示期間に影響します。</p>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 relative overflow-hidden mb-8">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center">
              <Settings className="w-6 h-6 mr-2 text-indigo-500" />
              提出ルールの設定（テキスト）
            </h2>
            <div className="flex flex-col space-y-3">
              <textarea
                value={submissionDeadlineRule}
                onChange={(e) => setSubmissionDeadlineRule(e.target.value)}
                placeholder="例: 1〜15日のシフトは前月20日までに提出してください"
                className="w-full p-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-slate-700 min-h-[100px]"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleSaveRule}
                  disabled={isSavingRule}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-xl transition shadow flex items-center disabled:opacity-50 cursor-pointer"
                >
                  {isSavingRule ? '保存中...' : 'ルールを保存'}
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">※従業員のシフト提出画面の上部にこのルールが表示されます。</p>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-xl border border-red-100 relative overflow-hidden mb-8">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center">
              <Settings className="w-6 h-6 mr-2 text-red-500" />
              提出を締め切る（ロック）
            </h2>
            <div className="flex items-center space-x-4">
              <label className="flex items-center cursor-pointer">
                <div className="relative">
                  <input type="checkbox" className="sr-only" checked={isSubmissionLocked} onChange={handleToggleLock} disabled={isSavingLock} />
                  <div className={`block w-14 h-8 rounded-full transition-colors ${isSubmissionLocked ? 'bg-red-500' : 'bg-slate-300'}`}></div>
                  <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${isSubmissionLocked ? 'transform translate-x-6' : ''}`}></div>
                </div>
                <div className="ml-3 text-slate-700 font-bold">
                  {isSubmissionLocked ? 'ロック中（提出不可）' : '提出可能'}
                </div>
              </label>
              {isSavingLock && <span className="text-sm text-indigo-500 font-bold animate-pulse">保存中...</span>}
            </div>
            <p className="text-xs text-slate-500 mt-2">※オンにすると、従業員はシフト希望の提出・変更ができなくなります。</p>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-xl border border-orange-100 relative overflow-hidden mb-8">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center">
              <Settings className="w-6 h-6 mr-2 text-orange-500" />
              自動締め切り日（複数設定可）
            </h2>
            <div className="flex flex-col md:flex-row md:items-center space-y-3 md:space-y-0 md:space-x-4">
              <div className="flex items-center w-full md:w-auto">
                <input
                  type="text"
                  value={autoLockDays}
                  onChange={(e) => setAutoLockDays(e.target.value)}
                  placeholder="例: 10,25"
                  className="px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-slate-700 w-full md:w-64"
                />
                <span className="font-bold text-slate-700 ml-3 whitespace-nowrap">日</span>
              </div>
              <button
                onClick={handleSaveAutoLockDays}
                disabled={isSavingAutoLock}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-xl transition shadow flex items-center justify-center disabled:opacity-50 w-full md:w-auto cursor-pointer"
              >
                {isSavingAutoLock ? '保存中...' : '保存する'}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">※カンマ区切りで複数指定できます（例: 10,25）。指定した日を過ぎると、次のサイクルの提出開始まで自動的にシフト提出がロックされます（空欄で無効化）。</p>
          </div>
        </div>
      </div>

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


