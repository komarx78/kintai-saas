import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, User, X, Save, Clock, Trash2, Wand2 } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ja } from 'date-fns/locale';
import { generateAutoShift } from '../lib/shiftAlgorithm';
import AppSwitcher from '../components/AppSwitcher';

interface Shift {
  id: string;
  user_id: string;
  target_date: string;
  start_time: string;
  end_time: string;
  status: string;
  role: string;
  user?: { name: string };
}

interface ShiftRole {
  name: string;
  color: string;
}

const ShiftCalendarView: React.FC = () => {
  const navigate = useNavigate();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<ShiftRole[]>([]);
  const [requirements, setRequirements] = useState<any[]>([]);
  const location = useLocation();
  const queryDate = new URLSearchParams(location.search).get('date');
  const [baseDate, setBaseDate] = useState(queryDate ? new Date(queryDate) : new Date());
  const [loading, setLoading] = useState(true);
  const [displayPeriod, setDisplayPeriod] = useState<'1day' | '1week' | '2weeks' | '1month'>('1week');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalData, setModalData] = useState<Partial<Shift>>({});
  const [saving, setSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    fetchSettingsAndData();
  }, [baseDate]);

  const fetchSettingsAndData = async () => {
    setLoading(true);
    try {
      const { data: tenantIdData } = await supabase.rpc('get_user_tenant_id');
      if (!tenantIdData) return;

      const { data: settings } = await supabase.from('shift_settings').select('shift_period').eq('tenant_id', tenantIdData).single();
      
      const isSingleDayQuery = new URLSearchParams(location.search).has('date');
      const period = isSingleDayQuery ? '1day' : (settings?.shift_period || '1week');
      setDisplayPeriod(period);

      let startD: Date;
      let endD: Date;
      if (period === '1day') {
        startD = baseDate;
        endD = baseDate;
      } else if (period === '1week') {
        startD = startOfWeek(baseDate, { weekStartsOn: 1 });
        endD = endOfWeek(baseDate, { weekStartsOn: 1 });
      } else if (period === '2weeks') {
        startD = startOfWeek(baseDate, { weekStartsOn: 1 });
        endD = addDays(startD, 13);
      } else {
        startD = startOfMonth(baseDate);
        endD = endOfMonth(baseDate);
      }

      const startStr = format(startD, 'yyyy-MM-dd');
      const endStr = format(endD, 'yyyy-MM-dd');

      const { data: rolesData } = await supabase.from('shift_roles').select('*').eq('tenant_id', tenantIdData).order('display_order');
      if (rolesData && rolesData.length > 0) {
        setRoles(rolesData);
      } else {
        setRoles([{name: 'ホール', color: '#4F46E5'}, {name: 'キッチン', color: '#EA580C'}]);
      }

      const { data: usersData } = await supabase.from('users').select('id, name').eq('tenant_id', tenantIdData);
      setUsers(usersData || []);

      const { data: shiftsData } = await supabase
        .from('advanced_shifts')
        .select('*')
        .eq('tenant_id', tenantIdData)
        .gte('target_date', startStr)
        .lte('target_date', endStr);
      
      const { data: requestsData } = await supabase
        .from('advanced_shift_requests')
        .select('*')
        .eq('tenant_id', tenantIdData)
        .gte('target_date', startStr)
        .lte('target_date', endStr);

      const { data: reqsData } = await supabase
        .from('advanced_shift_requirements')
        .select('*')
        .eq('tenant_id', tenantIdData);
      setRequirements(reqsData || []);
      
      const userMap: Record<string, string> = {};
      (usersData || []).forEach((u: any) => { userMap[u.id] = u.name; });
      
      const formattedShifts = (shiftsData || []).map((s: any) => ({ ...s, user: { name: userMap[s.user_id] || '不明' }, status: s.status || 'confirmed' }));
      const formattedRequests = (requestsData || [])
        .filter((r: any) => r.available_start_time && r.available_end_time)
        .map((r: any) => ({
          id: r.id,
          user_id: r.user_id,
          target_date: r.target_date,
          start_time: r.available_start_time,
          end_time: r.available_end_time,
          role: rolesData && rolesData.length > 0 ? rolesData[0].name : '不明',
          status: 'request',
          user: { name: userMap[r.user_id] || '不明' }
        }));
      
      setShifts([...formattedShifts, ...formattedRequests]);

    } catch (error) {
      console.error('データ取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveShift = async () => {
    if (!modalData.target_date || !modalData.user_id || !modalData.start_time || !modalData.end_time || !modalData.role) {
      alert('すべての項目を入力してください');
      return;
    }
    setSaving(true);
    try {
      const { data: tenantIdData } = await supabase.rpc('get_user_tenant_id');
      
      const [sh, sm] = modalData.start_time.split(':').map(Number);
      const [eh, em] = modalData.end_time.split(':').map(Number);
      if (sh * 60 + sm >= eh * 60 + em) {
        alert('終了時間は開始時間より後に設定してください');
        setSaving(false); return;
      }

      if (modalData.id) {
        if (modalData.status === 'request') {
          const { error: insertError } = await supabase.from('advanced_shifts').insert([{
            tenant_id: tenantIdData,
            user_id: modalData.user_id,
            target_date: modalData.target_date,
            start_time: modalData.start_time,
            end_time: modalData.end_time,
            role: modalData.role,
            status: 'confirmed'
          }]);
          if (insertError) throw insertError;

          const { error: deleteError } = await supabase.from('advanced_shift_requests').delete().eq('id', modalData.id);
          if (deleteError) throw deleteError;
        } else {
          const { error } = await supabase.from('advanced_shifts').update({
            target_date: modalData.target_date,
            start_time: modalData.start_time,
            end_time: modalData.end_time,
            role: modalData.role
          }).eq('id', modalData.id);
          if (error) throw error;
        }
      } else {
        const { error } = await supabase.from('advanced_shifts').insert([{
          tenant_id: tenantIdData,
          user_id: modalData.user_id,
          target_date: modalData.target_date,
          start_time: modalData.start_time,
          end_time: modalData.end_time,
          role: modalData.role,
          status: 'confirmed'
        }]);
        if (error) throw error;
      }
      
      setIsModalOpen(false);
      fetchSettingsAndData();
    } catch (err) {
      console.error(err);
      alert('シフトの保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteShift = async (id: string, status?: string) => {
    if (!window.confirm('このシフト（希望）を削除しますか？')) return;
    try {
      if (status === 'request') {
        await supabase.from('advanced_shift_requests').delete().eq('id', id);
      } else {
        await supabase.from('advanced_shifts').delete().eq('id', id);
      }
      setIsModalOpen(false);
      fetchSettingsAndData();
    } catch (err) {
      console.error(err);
      alert('削除に失敗しました');
    }
  };

  const handleGenerate = async () => {
    if (!window.confirm('現在の表示期間の希望シフトを元に、AI自動割り当てを実行しますか？\n（実行後、割り当てられたシフトは「未確定（ドラフト）」として配置されます）')) return;
    setIsGenerating(true);
    try {
      const { data: tenantIdData } = await supabase.rpc('get_user_tenant_id');
      if (!tenantIdData) return;

      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');

      const { data: settingsData } = await supabase.from('shift_settings').select('auto_generation_mode').eq('tenant_id', tenantIdData).maybeSingle();
      const mode = settingsData?.auto_generation_mode || 'equal';
      const { data: empSettings } = await supabase.from('shift_employee_settings').select('*').eq('tenant_id', tenantIdData);

      // 既存のドラフトシフトをクリア（再生成時の二重配置防止）
      await supabase.from('advanced_shifts')
        .delete()
        .eq('tenant_id', tenantIdData)
        .eq('status', 'draft')
        .gte('target_date', startStr)
        .lte('target_date', endStr);

      const { data: rawRequests } = await supabase.from('advanced_shift_requests')
        .select('*').eq('tenant_id', tenantIdData)
        .gte('target_date', startStr).lte('target_date', endStr);
      
      const { data: existingShifts } = await supabase.from('advanced_shifts')
        .select('*').eq('tenant_id', tenantIdData)
        .gte('target_date', startStr).lte('target_date', endStr);

      const toInsert: any[] = [];
      const datesToProcess = eachDayOfInterval({ start: startDate, end: endDate });

      for (const targetDay of datesToProcess) {
        const targetDateStr = format(targetDay, 'yyyy-MM-dd');
        const dbDow = targetDay.getDay(); // 0: 日 〜 6: 土

        const generated = generateAutoShift(
          requirements || [], 
          rawRequests || [], 
          existingShifts || [], 
          empSettings || [], 
          targetDateStr, 
          dbDow, 
          mode,
          toInsert
        );
        for (const shift of generated) {
          toInsert.push({ ...shift, tenant_id: tenantIdData, status: 'draft' });
        }
      }

      if (toInsert.length > 0) {
        const { error: insertError } = await supabase.from('advanced_shifts').insert(toInsert);
        if (insertError) throw insertError;
      }
      
      alert(`🎉 AI自動割り当てが完了しました！（${toInsert.length}件のシフトを配置）\nカレンダーで配置状況を確認し、「一括確定」を行ってください。`);
      fetchSettingsAndData();
    } catch (err) {
      console.error(err);
      alert('自動生成中にエラーが発生しました');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePublishAll = async () => {
    if (!window.confirm('現在の表示期間内にある「未確定（ドラフト）」のシフトをすべて確定し、従業員に公開しますか？')) return;
    try {
      const { data: tenantIdData } = await supabase.rpc('get_user_tenant_id');
      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');

      const { error } = await supabase.from('advanced_shifts')
        .update({ status: 'confirmed' })
        .eq('tenant_id', tenantIdData)
        .eq('status', 'draft')
        .gte('target_date', startStr)
        .lte('target_date', endStr);
      
      if (error) throw error;
      alert('すべてのシフトを確定しました！');
      fetchSettingsAndData();
    } catch (err) {
      console.error(err);
      alert('確定処理に失敗しました');
    }
  };

  let startDate: Date, endDate: Date;
  if (displayPeriod === '1day') {
    startDate = baseDate;
    endDate = baseDate;
  } else if (displayPeriod === '1week') {
    startDate = startOfWeek(baseDate, { weekStartsOn: 1 });
    endDate = endOfWeek(baseDate, { weekStartsOn: 1 });
  } else if (displayPeriod === '2weeks') {
    startDate = startOfWeek(baseDate, { weekStartsOn: 1 });
    endDate = addDays(startDate, 13);
  } else {
    startDate = startOfMonth(baseDate);
    endDate = endOfMonth(baseDate);
  }
  const dateRange = eachDayOfInterval({ start: startDate, end: endDate });

  const movePeriod = (dir: 1 | -1) => {
    if (displayPeriod === '1day') setBaseDate(addDays(baseDate, dir * 1));
    else if (displayPeriod === '1week') setBaseDate(addDays(baseDate, dir * 7));
    else if (displayPeriod === '2weeks') setBaseDate(addDays(baseDate, dir * 14));
    else setBaseDate(addDays(baseDate, dir * 30));
  };

  const openCellModal = (userId: string, roleName: string, dateStr: string) => {
    setModalData({
      user_id: userId,
      role: roleName,
      target_date: dateStr,
      start_time: '10:00',
      end_time: '15:00'
    });
    setIsModalOpen(true);
  };

  const openEditModal = (shift: Shift) => {
    setModalData({
      id: shift.id,
      user_id: shift.user_id,
      role: shift.role,
      target_date: shift.target_date,
      start_time: shift.start_time.substring(0, 5),
      end_time: shift.end_time.substring(0, 5),
      status: shift.status
    });
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-800">
      <div className="max-w-[1600px] mx-auto">
        <div className="flex items-center justify-between mb-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center space-x-4">
            <button onClick={() => navigate('/shift/admin')} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center">
              <Clock className="w-6 h-6 mr-3 text-indigo-600" />
              シフトカレンダー ({displayPeriod === '1day' ? '1日' : displayPeriod === '1week' ? '1週間' : displayPeriod === '2weeks' ? '2週間' : '1ヶ月'})
            </h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center bg-slate-100 rounded-xl p-1">
              <button onClick={() => movePeriod(-1)} className="p-2 hover:bg-white rounded-lg transition-colors shadow-sm">
                <ChevronLeft className="w-5 h-5 text-slate-600" />
              </button>
              <span className="font-bold text-lg px-6 min-w-[220px] text-center">
                {format(startDate, 'yyyy年M月d日')} 〜 {format(endDate, 'M月d日')}
              </span>
              <button onClick={() => movePeriod(1)} className="p-2 hover:bg-white rounded-lg transition-colors shadow-sm">
                <ChevronRight className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            <button 
              onClick={handleGenerate}
              disabled={isGenerating}
              className="bg-amber-500 text-white px-4 py-2.5 rounded-xl flex items-center space-x-2 hover:bg-amber-600 transition shadow-md font-bold disabled:opacity-50"
            >
              {isGenerating ? <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></div> : <Wand2 className="w-4 h-4" />}
              <span>自動割り当て</span>
            </button>

            <button 
              onClick={handlePublishAll}
              className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl flex items-center space-x-2 hover:bg-emerald-700 transition shadow-md font-bold"
            >
              <Save className="w-4 h-4" />
              <span>一括確定</span>
            </button>
            
            <button 
              onClick={() => {
                setModalData({ target_date: format(baseDate, 'yyyy-MM-dd'), role: roles[0]?.name || 'ホール', start_time: '10:00', end_time: '15:00', user_id: users[0]?.id });
                setIsModalOpen(true);
              }}
              className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl flex items-center space-x-2 hover:bg-indigo-700 transition shadow-md font-bold"
            >
              <Plus className="w-4 h-4" />
              <span>シフト追加</span>
            </button>
            <AppSwitcher currentApp="shift" role="admin" />
          </div>
        </div>

        {/* 凡例 (Legend) */}
        <div className="flex items-center space-x-6 mb-4 px-4">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-4 rounded shadow-sm" style={{backgroundColor: '#94a3b8', backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.5) 4px, rgba(255,255,255,0.5) 8px)', border: '1px dashed #fff'}}></div>
            <span className="text-sm font-bold text-slate-600">従業員からの希望 (未処理)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-6 h-4 rounded shadow-sm opacity-80" style={{backgroundColor: '#94a3b8', border: '2px dotted #fff'}}></div>
            <span className="text-sm font-bold text-slate-600">ドラフト (自動割り当て結果・未確定)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-6 h-4 rounded shadow-sm" style={{backgroundColor: '#94a3b8', border: '1px solid rgba(0,0,0,0.15)'}}></div>
            <span className="text-sm font-bold text-slate-600">確定済みシフト</span>
          </div>
        </div>

        <div className="bg-slate-50 rounded-2xl overflow-y-auto relative max-h-[75vh] p-2 sm:p-4">
          {loading ? (
            <div className="h-64 flex justify-center items-center"><div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div></div>
          ) : (
            <div className="flex flex-col space-y-8">
              {dateRange.map(d => {
                const dStr = format(d, 'yyyy-MM-dd');
                const dayShifts = shifts.filter(s => s.target_date === dStr);
                const isToday = dStr === format(new Date(), 'yyyy-MM-dd');

                return (
                  <div key={dStr} className={`bg-white border ${isToday ? 'border-indigo-300 shadow-md' : 'border-slate-200 shadow-sm'} rounded-xl overflow-hidden`}>
                    <div className={`p-3 font-bold flex items-center border-b border-slate-200 ${isToday ? 'bg-indigo-50 text-indigo-800' : 'bg-slate-100 text-slate-800'}`}>
                      <span className="text-lg">
                        【{format(d, 'M月d日')} ({format(d, 'E', { locale: ja })})】
                      </span>
                      {isToday && <span className="ml-3 text-xs bg-indigo-600 text-white px-2 py-1 rounded-full">本日</span>}
                    </div>

                    <div className="overflow-x-auto">
                      <div className="min-w-[800px]">
                        <div className="flex border-b border-slate-200 bg-slate-50">
                          <div className="w-48 shrink-0 p-2 font-bold text-slate-500 border-r border-slate-200 text-sm flex items-center justify-center bg-slate-100 sticky left-0 z-20">
                            スタッフ / 役割
                          </div>
                          <div className="flex-1 flex">
                            {Array.from({length: 24}, (_, i) => i).map(h => (
                              <div key={h} className="flex-1 border-r border-slate-200 text-center py-1 bg-slate-50">
                                <span className="text-[10px] font-bold text-slate-400">{h.toString().padStart(2, '0')}:00</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="divide-y divide-slate-100">
                          {roles.map(role => {
                            const roleShifts = dayShifts.filter(s => s.role === role.name);
                            const staffIds = [...new Set(roleShifts.map(s => s.user_id))];

                            return (
                              <React.Fragment key={role.name}>
                                <div className="bg-slate-50/50 px-3 py-1.5 font-bold text-xs text-slate-600 flex items-center border-b border-slate-100 sticky left-0 z-10 w-48">
                                  <div className="w-2 h-2 rounded-full mr-2 shadow-sm" style={{backgroundColor: role.color}}></div>
                                  {role.name}
                                </div>

                                {staffIds.length === 0 ? (
                                   <div className="flex text-sm group">
                                     <div className="w-48 shrink-0 p-2 text-slate-400 border-r border-slate-100 flex items-center sticky left-0 z-10 bg-white group-hover:bg-slate-50 transition-colors">
                                       <span className="ml-6 text-xs">配置なし</span>
                                     </div>
                                     <div className="flex-1 flex relative bg-slate-50/20">
                                        <div className="absolute inset-0 flex pointer-events-none">
                                          {Array.from({length: 24}, (_, i) => i).map(h => (
                                            <div key={h} className="flex-1 border-r border-slate-100/50 h-full"></div>
                                          ))}
                                        </div>
                                     </div>
                                   </div>
                                ) : (
                                  staffIds.map(uid => {
                                    const userObj = users.find(u => u.id === uid);
                                    const userShifts = roleShifts.filter(s => s.user_id === uid);

                                    return (
                                      <div key={uid} className="flex group hover:bg-slate-50 transition-colors">
                                        <div className="w-48 shrink-0 p-2 font-bold text-slate-700 border-r border-slate-100 flex items-center sticky left-0 z-10 bg-white group-hover:bg-slate-50 transition-colors shadow-[1px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                          <User className="w-4 h-4 mr-2 text-slate-400" />
                                          <span className="truncate text-sm">{userObj?.name || '不明なユーザー'}</span>
                                        </div>
                                        
                                        <div 
                                          className="flex-1 relative min-h-[44px] group/cell bg-white flex cursor-pointer"
                                          onClick={(e) => {
                                            if ((e.target as HTMLElement).closest('.shift-block')) return;
                                            openCellModal(uid, role.name, dStr);
                                          }}
                                        >
                                          <div className="absolute inset-0 flex pointer-events-none">
                                            {Array.from({length: 24}, (_, i) => i).map(h => (
                                              <div key={h} className="flex-1 border-r border-slate-100/50 h-full"></div>
                                            ))}
                                          </div>
                                          
                                          <div className="absolute inset-0">
                                            {userShifts.map(shift => {
                                              const [sh, sm] = shift.start_time.split(':').map(Number);
                                              const [eh, em] = shift.end_time.split(':').map(Number);
                                              const startMinutes = sh * 60 + sm;
                                              const endMinutes = eh * 60 + em;
                                              
                                              const totalMinutes = 24 * 60;
                                              const leftPercent = (startMinutes / totalMinutes) * 100;
                                              const widthPercent = ((endMinutes - startMinutes) / totalMinutes) * 100;
                                              const isRequest = shift.status === 'request';
                                              const isDraft = shift.status === 'draft';
                                              
                                              return (
                                                <div
                                                  key={shift.id}
                                                  onClick={(e) => { e.stopPropagation(); openEditModal(shift); }}
                                                  className={`shift-block absolute top-1.5 bottom-1.5 rounded-md shadow-sm flex items-center justify-center text-white text-[11px] font-bold hover:brightness-110 hover:-translate-y-0.5 transition-all z-10 px-1 overflow-hidden whitespace-nowrap cursor-pointer`}
                                                  style={{
                                                    backgroundColor: role.color,
                                                    backgroundImage: isRequest 
                                                      ? `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.4) 10px, rgba(255,255,255,0.4) 20px)`
                                                      : undefined,
                                                    opacity: (isRequest || isDraft) ? 0.8 : 1,
                                                    border: isRequest ? '2px dashed #fff' : isDraft ? '2px dotted #fff' : '1px solid rgba(0,0,0,0.15)',
                                                    left: `${leftPercent}%`,
                                                    width: `${widthPercent}%`
                                                  }}
                                                  title={isRequest ? "未確定（希望）" : isDraft ? "ドラフト（未確定）" : "確定済み"}
                                                >
                                                  {shift.start_time.substring(0,5)} - {shift.end_time.substring(0,5)}
                                                  {isRequest && " (希望)"}
                                                  {isDraft && " (未確定)"}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                                {/* 役割ごとの不足状況サマリー */}
                                <div className="flex bg-red-50/20 group border-b border-slate-100">
                                  <div className="w-48 shrink-0 p-2 font-bold text-red-500 border-r border-slate-100 text-[10px] flex items-center sticky left-0 z-10 bg-white shadow-[1px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                    {role.name} 不足状況
                                  </div>
                                  <div className="flex-1 min-h-[36px] flex items-center flex-wrap p-1.5 gap-1.5 relative">
                                    <div className="absolute inset-0 flex pointer-events-none">
                                      {Array.from({length: 24}, (_, i) => i).map(h => (
                                        <div key={h} className="flex-1 border-r border-slate-100/50 h-full"></div>
                                      ))}
                                    </div>
                                    
                                    {(() => {
                                      const dow = d.getDay();
                                      const dayReqs = requirements.filter(r => r.day_of_week === dow && r.role === role.name);
                                      const dayShifts = shifts.filter(s => s.target_date === format(d, 'yyyy-MM-dd') && s.role === role.name);
                                      
                                      const shortages = [];
                                      let currentStart = null;
                                      let currentCount = 0;

                                      for (let h = 0; h < 24; h++) {
                                        let required = 0;
                                        dayReqs.forEach(req => {
                                          const [sh] = req.start_time.split(':').map(Number);
                                          const [eh, em] = req.end_time.split(':').map(Number);
                                          const endHour = em > 0 ? eh : eh - 1;
                                          if (h >= sh && h <= endHour) required += req.required_count || 0;
                                        });

                                        let actual = 0;
                                        if (required > 0) {
                                          dayShifts.forEach(shift => {
                                            const [sh] = shift.start_time.split(':').map(Number);
                                            const [eh, em] = shift.end_time.split(':').map(Number);
                                            const endHour = em > 0 ? eh : eh - 1;
                                            if (h >= sh && h <= endHour) actual++;
                                          });
                                        }

                                        const diff = required - actual;
                                        if (diff > 0) {
                                          if (currentStart === null || currentCount !== diff) {
                                            if (currentStart !== null) {
                                              shortages.push({ start: currentStart, end: h, count: currentCount });
                                            }
                                            currentStart = h;
                                            currentCount = diff;
                                          }
                                        } else {
                                          if (currentStart !== null) {
                                            shortages.push({ start: currentStart, end: h, count: currentCount });
                                            currentStart = null;
                                          }
                                        }
                                      }
                                      if (currentStart !== null) {
                                        shortages.push({ start: currentStart, end: 24, count: currentCount });
                                      }

                                      if (shortages.length === 0) {
                                        return <div className="text-[10px] font-bold text-slate-400 pl-4 z-10">不足なし</div>;
                                      }

                                      return shortages.map((shortage, idx) => (
                                        <div 
                                          key={idx}
                                          className="z-10 text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full shadow-sm border border-red-200"
                                        >
                                          {shortage.start}:00 - {shortage.end}:00 ({shortage.count}枠不足)
                                        </div>
                                      ));
                                    })()}
                                  </div>
                                </div>
                              </React.Fragment>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="bg-indigo-600 p-4 flex justify-between items-center">
              <h2 className="text-white font-bold text-lg">{modalData.id ? 'シフト編集' : 'シフト直接追加'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-white/70 hover:text-white transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">対象日</label>
                <input type="date" value={modalData.target_date || ''} onChange={e => setModalData({...modalData, target_date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">役割</label>
                <select value={modalData.role || ''} onChange={e => setModalData({...modalData, role: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium">
                  {roles.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">開始時間</label>
                  <input type="time" value={modalData.start_time || ''} onChange={e => setModalData({...modalData, start_time: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">終了時間</label>
                  <input type="time" value={modalData.end_time || ''} onChange={e => setModalData({...modalData, end_time: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">担当者</label>
                <select value={modalData.user_id || ''} onChange={e => setModalData({...modalData, user_id: e.target.value})} className="w-full bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-lg p-2 font-bold">
                  <option value="">選択してください</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              
              <div className="flex space-x-3 mt-6">
                {modalData.id && (
                  <button onClick={() => handleDeleteShift(modalData.id!, modalData.status)} className="px-4 py-3 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition flex items-center justify-center whitespace-nowrap">
                    <Trash2 className="w-5 h-5 mr-2" />
                    {modalData.status === 'request' ? '却下する' : '削除する'}
                  </button>
                )}
                <button onClick={handleSaveShift} disabled={saving} className="flex-1 bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-md hover:bg-indigo-700 transition flex items-center justify-center">
                  {saving ? <div className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full"></div> : <><Save className="w-5 h-5 mr-2" />{modalData.status === 'request' ? 'この希望で確定する' : '確定する'}</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShiftCalendarView;
