import React, { useState, useEffect } from 'react';
import { DollarSign, Zap, Calendar, ArrowLeft, CheckCircle, Settings, Users, ClipboardList, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { startOfWeek, endOfWeek, format, addDays } from 'date-fns';

import { calculateLaborCost, generateAutoShift } from '../lib/shiftAlgorithm';

const ShiftAdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loadingStats, setLoadingStats] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [generationResult, setGenerationResult] = useState<{added: number}|null>(null);

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

      const { data: empData } = await supabase.from('users').select('id, name, email').eq('tenant_id', tenantId);
      setAllEmployees(empData || []);

      const startDate = format(weekStart, 'yyyy-MM-dd');
      const endDate = format(weekEnd, 'yyyy-MM-dd');
      
      const { data: reqData } = await supabase.from('advanced_shift_requests').select('user_id').eq('tenant_id', tenantId).gte('target_date', startDate).lte('target_date', endDate);
      const uniqueIds = [...new Set((reqData || []).map(r => r.user_id))];
      setSubmittedUserIds(uniqueIds);

      const { data: settingsData } = await supabase.from('shift_settings').select('monthly_labor_budget, shift_period, submission_deadline_rule, is_submission_locked, auto_lock_day, auto_lock_days').eq('tenant_id', tenantId).single();
      if (settingsData) {
        setRequiredLaborCost(settingsData.monthly_labor_budget);
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

      const { data: shiftsData } = await supabase.from('advanced_shifts').select('*').eq('tenant_id', tenantId).gte('target_date', format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-01')).lte('target_date', format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-31'));
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
      
      let newShiftsCount = 0;
      const { data: settingsData } = await supabase.from('shift_settings').select('auto_generation_mode').eq('tenant_id', tenantId).single();
      const mode = settingsData?.auto_generation_mode || 'equal';
      const { data: empSettings } = await supabase.from('shift_employee_settings').select('*').eq('tenant_id', tenantId);
      
      const startDate = format(weekStart, 'yyyy-MM-dd');
      const endDate = format(weekEnd, 'yyyy-MM-dd');

      const { data: reqs } = await supabase.from('advanced_shift_requirements').select('*').eq('tenant_id', tenantId).is('target_date', null);
      const { data: requests } = await supabase.from('advanced_shift_requests').select('*').eq('tenant_id', tenantId).gte('target_date', startDate).lte('target_date', endDate);
      const { data: existingShifts } = await supabase.from('advanced_shifts').select('*').eq('tenant_id', tenantId).gte('target_date', startDate).lte('target_date', endDate);

      const toInsert = [];

      for (let i = 0; i < 7; i++) {
        const targetDay = addDays(weekStart, i);
        const targetDateStr = format(targetDay, 'yyyy-MM-dd');
        let dbDow = targetDay.getDay();
        if (dbDow === 0) dbDow = 7;

        const generated = generateAutoShift(reqs || [], requests || [], existingShifts || [], empSettings || [], targetDateStr, dbDow, mode);
        for(const shift of generated) {
          toInsert.push({...shift, tenant_id: tenantId});
        }
      }

      if (toInsert.length > 0) {
                  const { error: insertError } = await supabase.from('advanced_shifts').insert(toInsert);
          if (insertError) {
            console.error(insertError);
            alert('シフト保存エラー: ' + insertError.message);
            throw insertError;
          }
        newShiftsCount = toInsert.length;
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
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[400px] bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-700 opacity-90 rounded-b-[4rem] shadow-2xl"></div>
      
      <div className="relative z-10 max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center text-white">
            <button onClick={() => navigate('/portal')} className="p-2 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-full transition mr-4">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-3xl font-bold flex items-center">
              <Calendar className="w-8 h-8 mr-3" />
              シフト管理ダッシュボード
            </h1>
          </div>
          <div className="flex space-x-3">
            <button 
              onClick={handlePublishDrafts} 
              disabled={isPublishing}
              className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg px-4 py-2 rounded-xl flex items-center transition font-bold text-sm disabled:opacity-50"
            >
              {isPublishing ? <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full mr-2"></div> : <Send className="w-4 h-4 mr-2" />}
              下書きシフトを確定する（Publish）
            </button>
            <button onClick={() => navigate('/shift/admin/employees')} className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-md px-4 py-2 rounded-xl flex items-center transition shadow-sm font-bold border border-white/30 text-sm">
              <Users className="w-4 h-4 mr-2" />人員マスタ
            </button>
            <button onClick={() => navigate('/shift/admin/patterns')} className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-md px-4 py-2 rounded-xl flex items-center transition shadow-sm font-bold border border-white/30 text-sm">
              <ClipboardList className="w-4 h-4 mr-2" />必要枠設定
            </button>
            <button onClick={() => navigate('/shift/admin/monthly')} className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-md px-4 py-2 rounded-xl flex items-center transition shadow-sm font-bold border border-white/30 text-sm">
              <Calendar className="w-4 h-4 mr-2" />月間シフト状況
            </button>
            <button onClick={() => navigate('/shift/admin/settings')} className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-md px-4 py-2 rounded-xl flex items-center transition shadow-sm font-bold border border-white/30 text-sm">
              <Settings className="w-4 h-4 mr-2" />詳細設定
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
                <div className="mt-4">
                  <button onClick={() => navigate('/shift/admin/calendar')} className="w-full bg-white text-indigo-700 font-bold py-3 rounded-xl shadow-lg hover:bg-indigo-50 transition text-sm flex items-center justify-center">
                    📅 シフトカレンダーを開く
                  </button>
                </div>
              </div>
            ) : (
              <button 
                onClick={handleGenerate} 
                disabled={isGenerating || submissionRate === 0}
                className="w-full bg-white text-indigo-700 font-black py-4 rounded-xl shadow-lg hover:bg-indigo-50 hover:scale-[1.02] transition-all flex items-center justify-center disabled:opacity-50 disabled:hover:scale-100"
              >
                {isGenerating ? (
                  <><div className="animate-spin w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full mr-3"></div>生成中...</>
                ) : (
                  <>シフトを自動生成する</>
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
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-xl transition shadow flex items-center disabled:opacity-50"
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
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-xl transition shadow flex items-center justify-center disabled:opacity-50 w-full md:w-auto"
            >
              {isSavingAutoLock ? '保存中...' : '保存する'}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2">※カンマ区切りで複数指定できます（例: 10,25）。指定した日を過ぎると、次のサイクルの提出開始まで自動的にシフト提出がロックされます（空欄で無効化）。</p>
        </div>
      </div>
    </div>
  );
};

export default ShiftAdminDashboard;






