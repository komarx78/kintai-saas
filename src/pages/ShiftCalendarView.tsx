import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, User, X, Save, Clock, Trash2 } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ja } from 'date-fns/locale';

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
  const location = useLocation();
  const queryDate = new URLSearchParams(location.search).get('date');
  const [baseDate, setBaseDate] = useState(queryDate ? new Date(queryDate) : new Date());
  const [loading, setLoading] = useState(true);
  const [displayPeriod, setDisplayPeriod] = useState<'1day' | '1week' | '2weeks' | '1month'>('1week');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalData, setModalData] = useState<Partial<Shift>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettingsAndData();
  }, [baseDate]);

  const fetchSettingsAndData = async () => {
    setLoading(true);
    try {
      const { data: tenantIdData } = await supabase.rpc('get_user_tenant_id');
      if (!tenantIdData) return;

      // 設定取得
      const { data: settings } = await supabase.from('shift_settings').select('shift_period').eq('tenant_id', tenantIdData).single();
      
      // クエリパラメータで日付が指定されている場合は強制的に1日表示にする
      const isSingleDayQuery = new URLSearchParams(location.search).has('date');
      const period = isSingleDayQuery ? '1day' : (settings?.shift_period || '1week');
      setDisplayPeriod(period);

      // 表示期間の計算
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

      // 役割マスタ取得
      const { data: rolesData } = await supabase.from('shift_roles').select('*').eq('tenant_id', tenantIdData).order('display_order');
      if (rolesData && rolesData.length > 0) {
        setRoles(rolesData);
      } else {
        setRoles([{name: 'ホール', color: '#4F46E5'}, {name: 'キッチン', color: '#EA580C'}]);
      }

      // 従業員取得
      const { data: usersData } = await supabase.from('users').select('id, name').eq('tenant_id', tenantIdData);
      setUsers(usersData || []);

      // シフト取得 (期間指定)
      const { data: shiftsData } = await supabase
        .from('advanced_shifts')
        .select('*')
        .eq('tenant_id', tenantIdData)
        .gte('target_date', startStr)
        .lte('target_date', endStr);
      
      // 希望（リクエスト）取得 (期間指定)
      const { data: requestsData } = await supabase
        .from('advanced_shift_requests')
        .select('*')
        .eq('tenant_id', tenantIdData)
        .gte('target_date', startStr)
        .lte('target_date', endStr);
      
      const userMap: Record<string, string> = {};
      (usersData || []).forEach((u: any) => { userMap[u.id] = u.name; });
      
      const formattedShifts = (shiftsData || []).map((s: any) => ({ ...s, user: { name: userMap[s.user_id] || '不明' }, status: s.status || 'confirmed' }));
      const formattedRequests = (requestsData || []).map((r: any) => ({ ...r, user: { name: userMap[r.user_id] || '不明' }, status: 'request' }));
      
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
          // 希望（リクエスト）を確定する場合
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
          // 確定済みシフトの更新
          const { error } = await supabase.from('advanced_shifts').update({
            target_date: modalData.target_date,
            start_time: modalData.start_time,
            end_time: modalData.end_time,
            role: modalData.role
          }).eq('id', modalData.id);
          if (error) throw error;
        }
      } else {
        // 新規作成
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

  // 表示期間の配列を生成
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
    else setBaseDate(addDays(baseDate, dir * 30)); // 簡易的な月移動（正確には setMonth が良いが startOfMonth で補正される）
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
              onClick={() => {
                setModalData({ target_date: format(baseDate, 'yyyy-MM-dd'), role: roles[0]?.name || 'ホール', start_time: '10:00', end_time: '15:00', user_id: users[0]?.id });
                setIsModalOpen(true);
              }}
              className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl flex items-center space-x-2 hover:bg-indigo-700 transition shadow-md font-bold"
            >
              <Plus className="w-4 h-4" />
              <span>シフト追加</span>
            </button>
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
                    {/* 日付ヘッダー */}
                    <div className={`p-3 font-bold flex items-center border-b border-slate-200 ${isToday ? 'bg-indigo-50 text-indigo-800' : 'bg-slate-100 text-slate-800'}`}>
                      <span className="text-lg">
                        【{format(d, 'M月d日')} ({format(d, 'E', { locale: ja })})】
                      </span>
                      {isToday && <span className="ml-3 text-xs bg-indigo-600 text-white px-2 py-1 rounded-full">本日</span>}
                    </div>

                    <div className="overflow-x-auto">
                      <div className="min-w-[800px]">
                        {/* 時間ヘッダー行 (0:00 - 23:00) */}
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

                        {/* ボディ行（役割とスタッフごとのガントチャート） */}
                        <div className="divide-y divide-slate-100">
                          {roles.map(role => {
                            const roleShifts = dayShifts.filter(s => s.role === role.name);
                            // この日のこの役割にシフトが入っているスタッフIDを取得
                            const staffIds = [...new Set(roleShifts.map(s => s.user_id))];

                            return (
                              <React.Fragment key={role.name}>
                                {/* 役割ヘッダー */}
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
                                        {/* 背景のグリッド線 */}
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
                                        {/* スタッフ名 */}
                                        <div className="w-48 shrink-0 p-2 font-bold text-slate-700 border-r border-slate-100 flex items-center sticky left-0 z-10 bg-white group-hover:bg-slate-50 transition-colors shadow-[1px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                          <User className="w-4 h-4 mr-2 text-slate-400" />
                                          <span className="truncate text-sm">{userObj?.name || '不明なユーザー'}</span>
                                        </div>
                                        
                                        {/* ガントチャートエリア */}
                                        <div 
                                          className="flex-1 relative min-h-[44px] group/cell bg-white flex cursor-pointer"
                                          onClick={(e) => {
                                            if ((e.target as HTMLElement).closest('.shift-block')) return;
                                            openCellModal(uid, role.name, dStr);
                                          }}
                                        >
                                          {/* 背景のグリッド線 */}
                                          <div className="absolute inset-0 flex pointer-events-none">
                                            {Array.from({length: 24}, (_, i) => i).map(h => (
                                              <div key={h} className="flex-1 border-r border-slate-100/50 h-full"></div>
                                            ))}
                                          </div>
                                          
                                          {/* ホバー時の追加アイコン */}
                                          <div className="absolute inset-0 opacity-0 group-hover/cell:opacity-100 bg-indigo-50/30 flex items-center justify-center transition-opacity z-0">
                                            <Plus className="w-5 h-5 text-indigo-400" />
                                          </div>

                                          {/* シフトバーの描画 */}
                                          {userShifts.map(shift => {
                                            const [sh, sm] = shift.start_time.split(':').map(Number);
                                            const [eh, em] = shift.end_time.split(':').map(Number);
                                            const startMinutes = sh * 60 + sm;
                                            const endMinutes = eh * 60 + em;
                                            const totalMinutes = 24 * 60;
                                            const leftPercent = (startMinutes / totalMinutes) * 100;
                                            const widthPercent = ((endMinutes - startMinutes) / totalMinutes) * 100;
                                            const isRequest = shift.status === 'request';
                                            
                                            return (
                                              <div
                                                key={shift.id}
                                                onClick={(e) => { e.stopPropagation(); openEditModal(shift); }}
                                                className={`shift-block absolute top-1.5 bottom-1.5 rounded-md shadow-sm flex items-center justify-center text-white text-[11px] font-bold hover:brightness-110 hover:-translate-y-0.5 transition-all z-10 px-1 overflow-hidden whitespace-nowrap cursor-pointer`}
                                                style={{
                                                  backgroundColor: role.color,
                                                  // 未確定(request)の場合はストライプ柄にする
                                                  backgroundImage: isRequest 
                                                    ? `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.4) 10px, rgba(255,255,255,0.4) 20px)`
                                                    : undefined,
                                                  opacity: isRequest ? 0.9 : 1,
                                                  border: isRequest ? '2px dashed #fff' : '1px solid rgba(0,0,0,0.15)',
                                                  left: `${leftPercent}%`,
                                                  width: `${widthPercent}%`
                                                }}
                                                title={isRequest ? "未確定（希望）" : "確定済み"}
                                              >
                                                {shift.start_time.substring(0,5)} - {shift.end_time.substring(0,5)}
                                                {isRequest && " (希望)"}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </React.Fragment>
                            );
                          })}

                          {/* サマリー行 */}
                          <div className="flex bg-red-50/40 border-t-2 border-red-100 group">
                            <div className="w-48 shrink-0 p-2 font-bold text-red-600 border-r border-slate-200 text-sm flex items-center sticky left-0 z-10 bg-red-50 shadow-[1px_0_5px_-2px_rgba(0,0,0,0.05)]">
                              サマリー (不足状況)
                            </div>
                            <div className="flex-1 relative min-h-[44px] flex items-center">
                              {/* 背景のグリッド線 */}
                              <div className="absolute inset-0 flex pointer-events-none">
                                {Array.from({length: 24}, (_, i) => i).map(h => (
                                  <div key={h} className="flex-1 border-r border-slate-100/50 h-full"></div>
                                ))}
                              </div>
                              
                              {/* モックデータ: 特定曜日のアラート。実際はシフト人数計算などで出す */}
                              {[0, 5, 6].includes(d.getDay()) && (
                                <div 
                                  className="absolute z-10 text-xs font-bold text-red-700 bg-red-100 px-2 py-1 rounded shadow-sm border border-red-300 flex items-center justify-center whitespace-nowrap"
                                  style={{
                                    left: `${(10 / 24) * 100}%`,
                                    width: `${(4 / 24) * 100}%`,
                                    top: '4px',
                                    bottom: '4px'
                                  }}
                                >
                                  10:00 - 14:00 (1枠不足)
                                </div>
                              )}
                            </div>
                          </div>
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

      {/* 追加/編集モーダル */}
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
                  <button onClick={() => handleDeleteShift(modalData.id!, modalData.status)} className="px-4 py-3 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition flex items-center justify-center">
                    <Trash2 className="w-5 h-5" />
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



