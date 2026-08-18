import React, { useState, useEffect } from 'react';
import { DollarSign, Zap, Calendar, ArrowLeft, CheckCircle, Settings, Users, ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { startOfWeek, endOfWeek, format, addDays } from 'date-fns';

import { calculateLaborCost, generateAutoShift } from '../lib/shiftAlgorithm';

const ShiftAdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loadingStats, setLoadingStats] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState<{added: number}|null>(null);

  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [submittedUserIds, setSubmittedUserIds] = useState<string[]>([]);
  
  const [estimatedLaborCost, setEstimatedLaborCost] = useState(0);
  const [requiredLaborCost, setRequiredLaborCost] = useState(0);

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

      const { data: empData } = await supabase.from('users').select('id, name, email').eq('tenant_id', tenantId).eq('has_shift_access', true).eq('role', 'user');
      setAllEmployees(empData || []);

      const startDate = format(weekStart, 'yyyy-MM-dd');
      const endDate = format(weekEnd, 'yyyy-MM-dd');
      
      const { data: reqData } = await supabase.from('advanced_shift_requests').select('user_id').eq('tenant_id', tenantId).gte('target_date', startDate).lte('target_date', endDate);
      const uniqueIds = [...new Set((reqData || []).map(r => r.user_id))];
      setSubmittedUserIds(uniqueIds);

      const { data: settingsData } = await supabase.from('shift_settings').select('monthly_labor_budget').eq('tenant_id', tenantId).single();
      if (settingsData) {
        setRequiredLaborCost(settingsData.monthly_labor_budget);
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
            <button onClick={() => navigate('/shift/admin/employees')} className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-md px-4 py-2 rounded-xl flex items-center transition shadow-sm font-bold border border-white/30 text-sm">
              <Users className="w-4 h-4 mr-2" />人員マスタ
            </button>
            <button onClick={() => navigate('/shift/admin/patterns')} className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-md px-4 py-2 rounded-xl flex items-center transition shadow-sm font-bold border border-white/30 text-sm">
              <ClipboardList className="w-4 h-4 mr-2" />必要枠設定
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
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <button onClick={() => navigate('/shift/admin/calendar')} className="w-full bg-white text-indigo-700 font-bold py-3 rounded-xl shadow-lg hover:bg-indigo-50 transition text-sm">
                    1デイ ガントチャート
                  </button>
                  <button onClick={() => navigate('/shift/admin/monthly')} className="w-full bg-indigo-50 text-indigo-700 font-bold py-3 rounded-xl shadow-lg hover:bg-indigo-100 transition border border-indigo-200 text-sm">
                    月間カレンダー
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
      </div>
    </div>
  );
};

export default ShiftAdminDashboard;






