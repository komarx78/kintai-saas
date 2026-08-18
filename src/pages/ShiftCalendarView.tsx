import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, User, X, Save, Clock, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { format, addDays, startOfDay } from 'date-fns';
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
  const [requirements, setRequirements] = useState<any[]>([]);
  const location = useLocation();
  const queryDate = new URLSearchParams(location.search).get('date');
  const [currentDate, setCurrentDate] = useState(startOfDay(queryDate ? new Date(queryDate) : new Date()));
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalData, setModalData] = useState<Partial<Shift>>({});
  const [saving, setSaving] = useState(false);

  // ガントチャートの時間枠 (9:00〜24:00)
  const hours = Array.from({ length: 16 }, (_, i) => i + 9);

  useEffect(() => {
    fetchData();
  }, [currentDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: tenantIdData } = await supabase.rpc('get_user_tenant_id');
      if (!tenantIdData) return;

      const dateStr = format(currentDate, 'yyyy-MM-dd');

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

      // シフト取得
    const { data: shiftsData } = await supabase.from('advanced_shifts').select('*').eq('tenant_id', tenantIdData).eq('target_date', dateStr);
      
      const userMap: Record<string, string> = {};
      (usersData || []).forEach((u: any) => { userMap[u.id] = u.name; });
      setShifts((shiftsData || []).map((s: any) => ({ ...s, user: { name: userMap[s.user_id] || '不明' } })));

      // 必要枠の取得 (対象日の曜日から)
      const dow = currentDate.getDay();
      const { data: reqData } = await supabase
        .from('advanced_shift_requirements')
        .select('*')
        .eq('tenant_id', tenantIdData)
        .eq('day_of_week', dow)
        .is('target_date', null);

      setRequirements(reqData || []);
      
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
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      alert('シフトの保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const calculateStyle = (start: string, end: string) => {
    const startParts = start.split(':').map(Number);
    const endParts = end.split(':').map(Number);
    
    const startMin = startParts[0] * 60 + startParts[1];
    let endMin = endParts[0] * 60 + endParts[1];
    if (endMin < startMin) endMin += 24 * 60; // 日またぎ対応
    
    // ガントチャートの基準 (9:00 = 540分)
    const baseMin = hours[0] * 60;
    const totalDisplayMins = hours.length * 60;
    
    const leftPercent = Math.max(0, ((startMin - baseMin) / totalDisplayMins) * 100);
    const widthPercent = Math.min(100 - leftPercent, ((endMin - startMin) / totalDisplayMins) * 100);

    return { left: `${leftPercent}%`, width: `${widthPercent}%` };
  };

  // 不足シフト計算ロジック
  interface Shortage {
    role: string;
    start: number;
    end: number;
    shortageCount: number;
  }
  const calculateShortages = (): Shortage[] => {
    const shortages: Shortage[] = [];
    
    roles.forEach(role => {
      const roleName = role.name;
      
      // 各時間の要件人数
      const requiredPerHour = new Array(25).fill(0);
      requirements.filter(r => r.role === roleName).forEach(req => {
        const sH = parseInt(req.start_time.split(':')[0], 10);
        const eH = parseInt(req.end_time.split(':')[0], 10);
        for (let h = sH; h < eH; h++) {
          if (h >= 9 && h <= 24) {
            requiredPerHour[h] = Math.max(requiredPerHour[h], req.required_count);
          }
        }
      });

      // 各時間の実人数
      const actualPerHour = new Array(25).fill(0);
      shifts.filter(s => s.role === roleName).forEach(shift => {
        const sH = parseInt(shift.start_time.split(':')[0], 10);
        const eH = parseInt(shift.end_time.split(':')[0], 10);
        // 分またぎは簡略化して時間(時)のみで判定
        for (let h = sH; h < eH; h++) {
          if (h >= 9 && h <= 24) {
            actualPerHour[h]++;
          }
        }
      });

      let currentShortageCount = 0;
      let currentStart = -1;

      for (let h = 9; h <= 24; h++) {
        const shortage = Math.max(0, requiredPerHour[h] - actualPerHour[h]);
        
        if (shortage !== currentShortageCount) {
          if (currentShortageCount > 0) {
            shortages.push({
              role: roleName,
              start: currentStart,
              end: h,
              shortageCount: currentShortageCount
            });
          }
          currentShortageCount = shortage;
          currentStart = h;
        }
      }
    });

    return shortages;
  };

  const shortages = calculateShortages();

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-800">
      <div className="max-w-screen-2xl mx-auto">
        <div className="flex items-center justify-between mb-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center space-x-4">
            <button onClick={() => navigate('/shift/admin')} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center">
              <Clock className="w-6 h-6 mr-3 text-indigo-600" />
              1デイ・ガントチャート
            </h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center bg-slate-100 rounded-xl p-1">
              <button onClick={() => setCurrentDate(addDays(currentDate, -1))} className="p-2 hover:bg-white rounded-lg transition-colors shadow-sm">
                <ChevronLeft className="w-5 h-5 text-slate-600" />
              </button>
              <span className="font-bold text-lg px-6 min-w-[150px] text-center">
                {format(currentDate, 'yyyy年M月d日 (E)', { locale: ja })}
              </span>
              <button onClick={() => setCurrentDate(addDays(currentDate, 1))} className="p-2 hover:bg-white rounded-lg transition-colors shadow-sm">
                <ChevronRight className="w-5 h-5 text-slate-600" />
              </button>
            </div>
            
            <button 
              onClick={async () => {
                if(!window.confirm('この日のシフトをすべてリセット（削除）しますか？')) return;
                try {
                  const { data: tenantIdData } = await supabase.rpc('get_user_tenant_id');
                  await supabase.from('advanced_shifts').delete().eq('tenant_id', tenantIdData).eq('target_date', format(currentDate, 'yyyy-MM-dd'));
                  fetchData();
                } catch(e) {}
              }}
              className="bg-red-50 text-red-600 px-4 py-2.5 rounded-xl flex items-center space-x-2 hover:bg-red-100 transition shadow-sm font-bold border border-red-200 mr-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>1日リセット</span>
            </button>
            <button 
              onClick={() => {
                setModalData({ target_date: format(currentDate, 'yyyy-MM-dd'), role: roles[0]?.name || 'ホール', start_time: '10:00', end_time: '15:00', user_id: users[0]?.id });
                setIsModalOpen(true);
              }}
              className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl flex items-center space-x-2 hover:bg-indigo-700 transition shadow-md font-bold"
            >
              <Plus className="w-4 h-4" />
              <span>シフト追加</span>
            </button>
          </div>
        </div>

        {/* アラートパネル */}
        {!loading && (
          <div className="mb-6">
            {shortages.length > 0 ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-center text-red-700 font-bold mb-2">
                  <AlertTriangle className="w-5 h-5 mr-2" />
                  <span>シフトに不足があります</span>
                </div>
                <ul className="list-disc list-inside text-sm text-red-600 space-y-1 ml-1">
                  {shortages.map((s, idx) => (
                    <li key={idx}>
                      {s.role}：{s.start}:00〜{s.end}:00 （{s.shortageCount}人不足）
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 shadow-sm flex items-center text-green-700 font-bold">
                <CheckCircle2 className="w-5 h-5 mr-2" />
                <span>全ての必要枠が満たされています</span>
              </div>
            )}
          </div>
        )}

        <div className="bg-white border border-slate-200 shadow-xl rounded-2xl overflow-x-auto">
          <div className="min-w-[1200px]">
            {/* タイムラインヘッダー */}
            <div className="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
              <div className="w-48 shrink-0 p-4 font-bold text-slate-500 border-r border-slate-200">スタッフ / 役割</div>
              <div className="flex-grow flex relative">
                {hours.map(h => (
                  <div key={h} className="flex-1 border-r border-slate-200 relative h-12">
                    <span className="absolute -left-3 top-3 text-xs font-bold text-slate-400">{h}:00</span>
                  </div>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="h-64 flex justify-center items-center"><div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div></div>
            ) : (
              <div className="divide-y divide-slate-100">
                {roles.map(role => {
                  const roleShifts = shifts.filter(s => s.role === role.name);
                  // 役割ごとにスタッフをグループ化 (この役割にシフトが入っているスタッフ)
                  const staffIds = [...new Set(roleShifts.map(s => s.user_id))];

                  return (
                    <div key={role.name}>
                      <div className="bg-slate-50/80 px-4 py-2 font-bold text-sm text-slate-700 flex items-center border-b border-slate-100">
                        <div className="w-3 h-3 rounded-full mr-2" style={{backgroundColor: role.color}}></div>
                        {role.name}
                      </div>
                      
                      {staffIds.length === 0 ? (
                        <div className="flex h-12 text-slate-400 items-center justify-center text-xs">
                           配置なし
                        </div>
                      ) : (
                        staffIds.map(uid => {
                          const userShifts = roleShifts.filter(s => s.user_id === uid);
                          const userObj = users.find(u => u.id === uid);
                          
                          return (
                            <div key={uid} className="flex group hover:bg-slate-50 transition-colors">
                              <div className="w-48 shrink-0 p-3 font-bold text-slate-700 border-r border-slate-200 flex items-center">
                                <User className="w-4 h-4 mr-2 text-slate-400" />
                                <span className="truncate">{userObj?.name || '名称未設定/ダミー'}</span>
                              </div>
                              <div className="flex-grow relative border-r border-slate-200 py-2 h-14">
                                {/* グリッド線 */}
                                <div className="absolute inset-0 flex pointer-events-none">
                                  {hours.map(h => (
                                    <div key={h} className="flex-1 border-r border-slate-100 border-dashed"></div>
                                  ))}
                                </div>
                                
                                {/* シフトバー */}
                                {userShifts.map(shift => {
                                  const style = calculateStyle(shift.start_time, shift.end_time);
                                  return (
                                    <div 
                                      key={shift.id} 
                                      className="absolute top-2 bottom-2 rounded-lg shadow-sm border border-black/10 flex items-center px-2 cursor-pointer hover:brightness-95 transition-all overflow-hidden whitespace-nowrap"
                                      style={{...style, backgroundColor: role.color}}
                                      title={`${shift.start_time.substring(0,5)} - ${shift.end_time.substring(0,5)}`}
                                    >
                                      <span className="text-white text-xs font-bold drop-shadow-md">
                                        {shift.start_time.substring(0,5)}-{shift.end_time.substring(0,5)}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 追加モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-indigo-600 p-4 flex justify-between items-center">
              <h2 className="text-white font-bold text-lg">シフト直接追加</h2>
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
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              
              <button onClick={handleSaveShift} disabled={saving} className="w-full mt-6 bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-md hover:bg-indigo-700 transition flex items-center justify-center">
                {saving ? <div className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full"></div> : <><Save className="w-5 h-5 mr-2" />確定する</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShiftCalendarView;



