import React, { useState, useEffect } from 'react';
import { Users, Save, ArrowLeft, Plus, Trash2, CheckCircle2, Copy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import AppSwitcher from '../components/AppSwitcher';

const defaultRoles = ['ホール', 'キッチン', 'レジ', '清掃'];
const patternTypes = ['平日', '土日', '祝日'];
const hours = Array.from({ length: 24 }, (_, i) => i);

interface Requirement {
  id: string;
  role: string;
  startHour: number;
  endHour: number;
  count: number;
}

const ShiftRequirementSettings: React.FC = () => {
  const navigate = useNavigate();
  const [activePattern, setActivePattern] = useState('平日');
  const [saved, setSaved] = useState(false);
  const [roles, setRoles] = useState<string[]>(defaultRoles);
  
  const [requirements, setRequirements] = useState<Record<string, Requirement[]>>({
    '平日': [],
    '土日': [],
    '祝日': []
  });

  const [newReq, setNewReq] = useState<Partial<Requirement>>({ role: 'ホール', startHour: 9, endHour: 18, count: 1 });

  useEffect(() => {
    fetchRolesAndRequirements();
  }, []);

  const fetchRolesAndRequirements = async () => {
    try {
      const { data: tenantIdData } = await supabase.rpc('get_user_tenant_id');
      if (!tenantIdData) return;

      // 1. 役割マスタの取得
      const { data: rolesData } = await supabase
        .from('shift_roles')
        .select('name')
        .eq('tenant_id', tenantIdData)
        .order('display_order');
      
      if (rolesData && rolesData.length > 0) {
        const fetchedRoles = rolesData.map(r => r.name);
        setRoles(fetchedRoles);
        if (!fetchedRoles.includes(newReq.role || '')) {
          setNewReq(prev => ({ ...prev, role: fetchedRoles[0] }));
        }
      }

      // 2. 必要枠の取得
      const { data, error } = await supabase
        .from('advanced_shift_requirements')
        .select('*')
        .eq('tenant_id', tenantIdData)
        .is('target_date', null);

      if (error) throw error;
      
      const newReqs: Record<string, Requirement[]> = { '平日': [], '土日': [], '祝日': [] };
      if (data && data.length > 0) {
        // 重複登録されている曜日（例: 平日は1〜5）を1つのパターン枠として重複排除して読み込む
        const seenKeys = {
          '平日': new Set<string>(),
          '土日': new Set<string>(),
          '祝日': new Set<string>()
        };

        data.forEach(row => {
          let pattern: '平日' | '土日' | '祝日' | null = null;
          if (row.day_of_week >= 1 && row.day_of_week <= 5) pattern = '平日';
          else if (row.day_of_week === 0 || row.day_of_week === 6) pattern = '土日';
          else if (row.day_of_week === 7) pattern = '祝日';

          if (pattern) {
            const startH = parseInt(row.start_time.split(':')[0], 10);
            const endH = parseInt(row.end_time.split(':')[0], 10);
            const key = `${row.role}_${startH}_${endH}_${row.required_count}`;

            if (!seenKeys[pattern].has(key)) {
              seenKeys[pattern].add(key);
              newReqs[pattern].push({
                id: row.id || `${Date.now()}_${Math.random()}`,
                role: row.role,
                startHour: startH,
                endHour: endH,
                count: row.required_count
              });
            }
          }
        });
      }

      // もしDBに枠がない、または土日・祝日が空の場合は標準枠（ホール/キッチン/レジ/清掃）を自動補完して消去を防止
      const defaultStandardReqs: Requirement[] = [
        { id: 'def_hall', role: 'ホール', startHour: 9, endHour: 18, count: 1 },
        { id: 'def_kitchen', role: 'キッチン', startHour: 9, endHour: 18, count: 1 },
        { id: 'def_register', role: 'レジ', startHour: 9, endHour: 18, count: 2 },
        { id: 'def_clean_morning', role: '清掃', startHour: 7, endHour: 10, count: 1 },
        { id: 'def_clean_evening', role: '清掃', startHour: 19, endHour: 22, count: 1 }
      ];

      if (newReqs['平日'].length === 0) {
        newReqs['平日'] = defaultStandardReqs.map(r => ({ ...r, id: `weekday_${r.id}` }));
      }
      if (newReqs['土日'].length === 0) {
        newReqs['土日'] = newReqs['平日'].map(r => ({ ...r, id: `weekend_${r.id}` }));
      }
      if (newReqs['祝日'].length === 0) {
        newReqs['祝日'] = newReqs['平日'].map(r => ({ ...r, id: `holiday_${r.id}` }));
      }

      setRequirements(newReqs);
    } catch (err) {
      console.error(err);
    }
  };

  // ドラッグ操作の状態
  const [dragState, setDragState] = useState<{
    type: 'create' | 'resize-start' | 'resize-end' | 'move';
    role: string;
    reqId?: string;
    initialStartHour: number;
    initialEndHour: number;
    startHour: number;
    endHour: number;
    originHour: number;
  } | null>(null);

  // マウスX座標から時間（0〜24）への変換ヘルパー
  const getHourFromEvent = (e: MouseEvent | React.MouseEvent, containerEl: HTMLElement): number => {
    const rect = containerEl.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const rawHour = Math.floor((x / rect.width) * 24);
    return Math.max(0, Math.min(23, rawHour));
  };

  // 全体マウスムーブ＆アップのリスナー（ドラッグ中の滑らかな追従）
  useEffect(() => {
    if (!dragState) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      const containerEl = document.getElementById(`role-timeline-${dragState.role}`);
      if (!containerEl) return;

      const currentHour = getHourFromEvent(e, containerEl);

      if (dragState.type === 'create') {
        const s = Math.min(dragState.originHour, currentHour);
        const end = Math.max(dragState.originHour, currentHour) + 1;
        setDragState(prev => prev ? ({ ...prev, startHour: s, endHour: Math.min(24, end) }) : null);
      } else if (dragState.type === 'resize-start') {
        if (currentHour < dragState.initialEndHour) {
          setDragState(prev => prev ? ({ ...prev, startHour: currentHour }) : null);
        }
      } else if (dragState.type === 'resize-end') {
        const end = Math.max(dragState.initialStartHour + 1, Math.min(24, currentHour + 1));
        setDragState(prev => prev ? ({ ...prev, endHour: end }) : null);
      } else if (dragState.type === 'move') {
        const duration = dragState.initialEndHour - dragState.initialStartHour;
        const delta = currentHour - dragState.originHour;
        let newStart = dragState.initialStartHour + delta;
        let newEnd = newStart + duration;

        if (newStart < 0) {
          newStart = 0;
          newEnd = duration;
        }
        if (newEnd > 24) {
          newEnd = 24;
          newStart = 24 - duration;
        }
        setDragState(prev => prev ? ({ ...prev, startHour: newStart, endHour: newEnd }) : null);
      }
    };

    const handleWindowMouseUp = () => {
      if (!dragState) return;

      if (dragState.type === 'create') {
        if (dragState.endHour > dragState.startHour) {
          const newId = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const created: Requirement = {
            id: newId,
            role: dragState.role,
            startHour: dragState.startHour,
            endHour: dragState.endHour,
            count: 1
          };
          setRequirements(prev => ({
            ...prev,
            [activePattern]: [...(prev[activePattern] || []), created]
          }));
        }
      } else if (dragState.reqId) {
        setRequirements(prev => ({
          ...prev,
          [activePattern]: (prev[activePattern] || []).map(r => 
            r.id === dragState.reqId 
              ? { ...r, startHour: dragState.startHour, endHour: dragState.endHour }
              : r
          )
        }));
      }

      setDragState(null);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [dragState, activePattern]);

  // 人数の加算・減算
  const handleUpdateCount = (id: string, delta: number) => {
    setRequirements(prev => ({
      ...prev,
      [activePattern]: (prev[activePattern] || []).map(r => {
        if (r.id === id) {
          const nextCount = Math.max(1, r.count + delta);
          return { ...r, count: nextCount };
        }
        return r;
      })
    }));
  };

  const handleAdd = () => {
    if (newReq.startHour! >= newReq.endHour!) {
      alert("終了時間は開始時間より後にしてください。");
      return;
    }
    const req: Requirement = { 
      id: Date.now().toString(), 
      role: newReq.role || roles[0] || 'ホール', 
      startHour: newReq.startHour!, 
      endHour: newReq.endHour!, 
      count: newReq.count || 1 
    };
    setRequirements({
      ...requirements,
      [activePattern]: [...(requirements[activePattern] || []), req]
    });
  };

  const handleRemove = (id: string) => {
    setRequirements({
      ...requirements,
      [activePattern]: (requirements[activePattern] || []).filter(r => r.id !== id)
    });
  };

  // 他のパターン（平日・土日・祝日）からシフト枠を丸ごとコピー
  const handleCopyPattern = (sourcePattern: string) => {
    const sourceList = requirements[sourcePattern] || [];
    if (sourceList.length === 0) {
      alert(`「${sourcePattern}」には現在設定されている必要枠がありません。`);
      return;
    }

    const currentCount = (requirements[activePattern] || []).length;
    if (currentCount > 0) {
      if (!window.confirm(`「${sourcePattern}」の設定（${sourceList.length}件）を「${activePattern}」にコピーしますか？\n（※現在の「${activePattern}」の設定は上書きされます）`)) {
        return;
      }
    }

    const cloned = sourceList.map(item => ({
      ...item,
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    }));

    setRequirements({
      ...requirements,
      [activePattern]: cloned
    });

    alert(`✨「${sourcePattern}」の必要シフト枠（${cloned.length}件）を「${activePattern}」にコピーしました！\n調整後、「設定を保存」ボタンを押してください。`);
  };

  const handleSave = async () => {
    try {
      const { data: tenantIdData } = await supabase.rpc('get_user_tenant_id');
      if (!tenantIdData) return;

      const { error: deleteError } = await supabase
        .from('advanced_shift_requirements')
        .delete()
        .eq('tenant_id', tenantIdData)
        .is('target_date', null);
      if (deleteError) throw deleteError;

      const insertData: any[] = [];
      const createRow = (req: Requirement, dow: number) => ({
        tenant_id: tenantIdData,
        day_of_week: dow,
        role: req.role,
        required_count: req.count,
        start_time: `${req.startHour.toString().padStart(2, '0')}:00:00`,
        end_time: `${req.endHour.toString().padStart(2, '0')}:00:00`
      });

      // 平日 (月〜金: 1〜5)
      const weekdayReqs = requirements['平日'] || [];
      const weekendReqs = (requirements['土日'] && requirements['土日'].length > 0) ? requirements['土日'] : weekdayReqs;
      const holidayReqs = (requirements['祝日'] && requirements['祝日'].length > 0) ? requirements['祝日'] : weekdayReqs;

      weekdayReqs.forEach(req => {
        [1, 2, 3, 4, 5].forEach(dow => insertData.push(createRow(req, dow)));
      });
      // 土日 (日: 0, 土: 6)
      weekendReqs.forEach(req => {
        [0, 6].forEach(dow => insertData.push(createRow(req, dow)));
      });
      // 祝日 (7)
      holidayReqs.forEach(req => {
        insertData.push(createRow(req, 7));
      });

      if (insertData.length > 0) {
        const { error: insertError } = await supabase
          .from('advanced_shift_requirements')
          .insert(insertData);
        if (insertError) throw insertError;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      fetchRolesAndRequirements();
    } catch (err) {
      console.error(err);
      alert('保存に失敗しました');
    }
  };

  const currentReqs = requirements[activePattern] || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-blue-100 relative overflow-hidden font-sans text-slate-800 select-none">
      <div className="relative z-10 max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <button onClick={() => navigate('/shift/admin')} className="p-2 bg-white/40 hover:bg-white/60 backdrop-blur-md rounded-full transition-all shadow-sm cursor-pointer">
              <ArrowLeft className="w-5 h-5 text-indigo-700" />
            </button>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center">
              <Users className="w-8 h-8 mr-3 text-indigo-600" />
              必要シフト枠設定
            </h1>
          </div>
          <div className="flex items-center space-x-3">
            <button 
              onClick={handleSave}
              className="flex items-center px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all font-medium cursor-pointer"
            >
              {saved ? <CheckCircle2 className="w-5 h-5 mr-2" /> : <Save className="w-5 h-5 mr-2" />}
              {saved ? '保存しました' : '設定を保存'}
            </button>
            <AppSwitcher currentApp="shift" role="admin" />
          </div>
        </div>

        <div className="bg-white/70 backdrop-blur-xl border border-white/60 shadow-2xl rounded-3xl p-6 md:p-8 flex flex-col gap-6">
          
          {/* Pattern Tabs & Copy Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-indigo-100/50">
            <div className="flex flex-wrap gap-2">
              {patternTypes.map(pattern => (
                <button
                  key={pattern}
                  onClick={() => setActivePattern(pattern)}
                  className={`px-6 py-3 rounded-2xl font-bold text-lg transition-all cursor-pointer ${
                    activePattern === pattern 
                      ? 'bg-indigo-600 text-white shadow-md transform scale-105' 
                      : 'bg-white/60 text-slate-600 hover:bg-white border border-white/50 shadow-sm'
                  }`}
                >
                  {pattern}
                </button>
              ))}
            </div>

            {/* コピーボタン群 */}
            <div className="flex items-center flex-wrap gap-2 bg-indigo-50/70 p-1.5 rounded-2xl border border-indigo-100">
              <span className="text-xs font-bold text-indigo-900 ml-2 mr-1 flex items-center">
                <Copy className="w-3.5 h-3.5 mr-1 text-indigo-600" />
                他からコピー:
              </span>
              {patternTypes.filter(p => p !== activePattern).map(sourcePattern => (
                <button
                  key={sourcePattern}
                  onClick={() => handleCopyPattern(sourcePattern)}
                  className="px-3 py-1.5 bg-white hover:bg-indigo-600 text-indigo-700 hover:text-white text-xs font-bold rounded-xl border border-indigo-200 hover:border-indigo-600 shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                  title={`「${sourcePattern}」の必要枠設定を「${activePattern}」にコピーします`}
                >
                  <span>📋</span>
                  <span>{sourcePattern}からコピー</span>
                </button>
              ))}
            </div>
          </div>

          {/* ドラッグ操作のヒントガイド */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-2.5 rounded-2xl border border-blue-100 flex items-center justify-between text-xs text-indigo-900 font-medium">
            <div className="flex items-center gap-3">
              <span className="font-bold bg-indigo-600 text-white px-2 py-0.5 rounded-md text-[10px]">直感操作</span>
              <span>👉 タイムライン上をドラッグして新規作成</span>
              <span>↔️ バーの端を引っ張って伸縮</span>
              <span>✋ バーを掴んで左右に移動</span>
              <span>🔢 ［+］［-］で人数変更</span>
            </div>
            <div className="text-[11px] text-slate-400">※変更後は「設定を保存」を押してください</div>
          </div>

          {/* Add Form */}
          <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1 ml-1">役割</label>
              <select value={newReq.role} onChange={e => setNewReq({...newReq, role: e.target.value})} className="bg-white rounded-xl px-4 py-2 border-0 shadow-sm outline-none focus:ring-2 focus:ring-indigo-400 font-bold text-slate-700">
                {roles.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1 ml-1">開始時間</label>
              <select value={newReq.startHour} onChange={e => setNewReq({...newReq, startHour: parseInt(e.target.value)})} className="bg-white rounded-xl px-4 py-2 border-0 shadow-sm outline-none focus:ring-2 focus:ring-indigo-400 font-bold text-slate-700">
                {hours.map(h => <option key={h} value={h}>{h.toString().padStart(2, '0')}:00</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1 ml-1">終了時間</label>
              <select value={newReq.endHour} onChange={e => setNewReq({...newReq, endHour: parseInt(e.target.value)})} className="bg-white rounded-xl px-4 py-2 border-0 shadow-sm outline-none focus:ring-2 focus:ring-indigo-400 font-bold text-slate-700">
                {hours.map(h => <option key={h} value={h}>{h.toString().padStart(2, '0')}:00</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1 ml-1">人数</label>
              <input type="number" min="1" value={newReq.count} onChange={e => setNewReq({...newReq, count: parseInt(e.target.value) || 1})} className="w-20 bg-white rounded-xl px-4 py-2 border-0 shadow-sm outline-none focus:ring-2 focus:ring-indigo-400 text-center font-bold text-slate-700" />
            </div>
            <button onClick={handleAdd} className="bg-indigo-600 text-white px-6 py-2 rounded-xl shadow hover:bg-indigo-700 transition flex items-center font-bold h-10 cursor-pointer">
              <Plus className="w-4 h-4 mr-1" />
              追加
            </button>
          </div>

          {/* Gantt Chart UI (Interactive Drag & Resize) */}
          <div className="overflow-x-auto pb-4">
            <div className="min-w-[850px]">
              {/* Header: Hours */}
              <div className="flex ml-28 border-b border-indigo-200 pb-2 mb-4">
                {hours.map(h => (
                  <div key={h} className="flex-1 text-center text-xs font-bold text-slate-400">
                    {h}
                  </div>
                ))}
              </div>

              {/* Roles Rows */}
              <div className="space-y-6">
                {roles.map(role => {
                  const roleReqs = currentReqs.filter(r => r.role === role);
                  const isRoleDragging = dragState && dragState.role === role;

                  return (
                    <div key={role} className="flex items-center relative h-14">
                      <div className="w-28 shrink-0 font-bold text-slate-700 pr-4 text-right truncate">
                        {role}
                      </div>
                      
                      <div 
                        id={`role-timeline-${role}`}
                        onMouseDown={(e) => {
                          if ((e.target as HTMLElement).closest('.req-bar')) return;
                          const containerEl = e.currentTarget;
                          const h = getHourFromEvent(e, containerEl);
                          setDragState({
                            type: 'create',
                            role: role,
                            originHour: h,
                            initialStartHour: h,
                            initialEndHour: h + 1,
                            startHour: h,
                            endHour: h + 1
                          });
                        }}
                        className="flex-1 flex relative h-full bg-slate-50/70 hover:bg-slate-100/60 rounded-xl border border-slate-200 shadow-inner cursor-crosshair transition-colors"
                        title="ドラッグして新規必要枠を作成"
                      >
                        {/* Grid lines */}
                        <div className="absolute inset-0 flex pointer-events-none">
                          {hours.map(h => (
                            <div key={h} className="flex-1 border-r border-slate-200/40 last:border-r-0 h-full"></div>
                          ))}
                        </div>

                        {/* ドラッグ新規作成中のプレビューバー */}
                        {isRoleDragging && dragState.type === 'create' && (
                          <div 
                            className="absolute top-1 bottom-1 bg-indigo-400/60 border-2 border-dashed border-indigo-600 rounded-lg flex items-center justify-center text-white text-xs font-black z-20 pointer-events-none animate-pulse"
                            style={{ 
                              left: `${(dragState.startHour / 24) * 100}%`, 
                              width: `${((dragState.endHour - dragState.startHour) / 24) * 100}%` 
                            }}
                          >
                            {dragState.startHour}:00 - {dragState.endHour}:00 (新規 1人)
                          </div>
                        )}

                        {/* 既存のバー */}
                        {roleReqs.map(req => {
                          const isThisDragging = isRoleDragging && dragState.reqId === req.id;
                          const displayStart = isThisDragging ? dragState.startHour : req.startHour;
                          const displayEnd = isThisDragging ? dragState.endHour : req.endHour;
                          const duration = displayEnd - displayStart;

                          const startPercent = (displayStart / 24) * 100;
                          const widthPercent = (duration / 24) * 100;

                          return (
                            <div 
                              key={req.id} 
                              className={`req-bar absolute top-1 bottom-1 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 text-white rounded-lg shadow-md flex items-center justify-center text-xs font-bold transition-shadow group overflow-visible z-10 ${isThisDragging ? 'opacity-90 ring-2 ring-indigo-400 shadow-xl cursor-grabbing' : 'cursor-grab'}`}
                              style={{ left: `${startPercent}%`, width: `${widthPercent}%` }}
                              onClick={() => {
                                setNewReq({
                                  role: req.role,
                                  startHour: req.startHour,
                                  endHour: req.endHour,
                                  count: req.count
                                });
                              }}
                              onMouseDown={(e) => {
                                if ((e.target as HTMLElement).closest('.resize-handle') || (e.target as HTMLElement).closest('.btn-action')) return;
                                const containerEl = document.getElementById(`role-timeline-${role}`);
                                if (!containerEl) return;
                                const h = getHourFromEvent(e, containerEl);
                                setDragState({
                                  type: 'move',
                                  role: role,
                                  reqId: req.id,
                                  originHour: h,
                                  initialStartHour: req.startHour,
                                  initialEndHour: req.endHour,
                                  startHour: req.startHour,
                                  endHour: req.endHour
                                });
                              }}
                            >
                              {/* 左端リサイズハンドル */}
                              <div 
                                className="resize-handle absolute left-0 top-0 bottom-0 w-2 hover:w-3 bg-indigo-900/30 hover:bg-indigo-300 rounded-l-lg cursor-ew-resize transition-all z-20 flex items-center justify-center"
                                title="ドラッグして開始時間を変更"
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  setDragState({
                                    type: 'resize-start',
                                    role: role,
                                    reqId: req.id,
                                    originHour: req.startHour,
                                    initialStartHour: req.startHour,
                                    initialEndHour: req.endHour,
                                    startHour: req.startHour,
                                    endHour: req.endHour
                                  });
                                }}
                              >
                                <div className="w-0.5 h-2.5 bg-white/70 rounded-full"></div>
                              </div>

                              {/* 幅が狭い時（1〜2時間）のスマートコンパクト表示 */}
                              {duration <= 2 ? (
                                <div className="px-1 text-center pointer-events-none truncate">
                                  <span className="text-xs font-black drop-shadow-sm">{req.count}人</span>
                                </div>
                              ) : (
                                /* 幅が広い時（3時間以上）のフル表示 */
                                <div className="flex-1 flex items-center justify-between px-2 overflow-hidden pointer-events-auto">
                                  <span className="text-[10px] font-black text-indigo-100 whitespace-nowrap drop-shadow-sm mr-1">
                                    {displayStart}:00-{displayEnd}:00
                                  </span>

                                  {/* 人数クイックコントローラー */}
                                  <div className="flex items-center gap-1 bg-black/20 backdrop-blur-xs px-1 py-0.5 rounded-md border border-white/20">
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleUpdateCount(req.id, -1); }}
                                      className="btn-action w-4 h-4 rounded bg-white/20 hover:bg-white/40 flex items-center justify-center text-[10px] font-black cursor-pointer"
                                      title="人数を減らす"
                                    >
                                      -
                                    </button>
                                    <span className="text-xs font-black min-w-[16px] text-center">{req.count}人</span>
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleUpdateCount(req.id, 1); }}
                                      className="btn-action w-4 h-4 rounded bg-white/20 hover:bg-white/40 flex items-center justify-center text-[10px] font-black cursor-pointer"
                                      title="人数を増やす"
                                    >
                                      +
                                    </button>
                                  </div>

                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleRemove(req.id); }}
                                    className="btn-action p-1 hover:bg-rose-500 rounded text-white/80 hover:text-white transition cursor-pointer ml-1"
                                    title="この枠を削除"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}

                              {/* 右端リサイズハンドル */}
                              <div 
                                className="resize-handle absolute right-0 top-0 bottom-0 w-2 hover:w-3 bg-indigo-900/30 hover:bg-indigo-300 rounded-r-lg cursor-ew-resize transition-all z-20 flex items-center justify-center"
                                title="ドラッグして終了時間を伸縮"
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  setDragState({
                                    type: 'resize-end',
                                    role: role,
                                    reqId: req.id,
                                    originHour: req.endHour,
                                    initialStartHour: req.startHour,
                                    initialEndHour: req.endHour,
                                    startHour: req.startHour,
                                    endHour: req.endHour
                                  });
                                }}
                              >
                                <div className="w-0.5 h-2.5 bg-white/70 rounded-full"></div>
                              </div>

                              {/* ホバー時に真上に表示されるスマート吹き出しフローティングツールバー（極小1時間枠でも確実に人数操作可能） */}
                              <div className="hidden group-hover:flex absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 bg-slate-900/95 text-white px-2.5 py-1.5 rounded-xl shadow-2xl items-center gap-2 z-30 pointer-events-auto border border-slate-700/80 backdrop-blur-md whitespace-nowrap animate-in fade-in zoom-in-95 duration-100">
                                <span className="text-[11px] font-bold text-slate-300">
                                  {displayStart}:00-{displayEnd}:00
                                </span>

                                <div className="flex items-center gap-1 bg-white/10 px-1.5 py-0.5 rounded-lg border border-white/10">
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleUpdateCount(req.id, -1); }}
                                    className="btn-action w-5 h-5 rounded bg-white/20 hover:bg-indigo-500 flex items-center justify-center text-xs font-black cursor-pointer transition-colors"
                                    title="人数を減らす"
                                  >
                                    -
                                  </button>
                                  <span className="text-xs font-black text-amber-300 px-1 min-w-[24px] text-center">
                                    {req.count}人
                                  </span>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleUpdateCount(req.id, 1); }}
                                    className="btn-action w-5 h-5 rounded bg-white/20 hover:bg-indigo-500 flex items-center justify-center text-xs font-black cursor-pointer transition-colors"
                                    title="人数を増やす"
                                  >
                                    +
                                  </button>
                                </div>

                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleRemove(req.id); }}
                                  className="btn-action p-1 hover:bg-rose-500 rounded text-slate-400 hover:text-white transition cursor-pointer"
                                  title="この枠を削除"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>

                                {/* 下向き矢印ポインター */}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900/95"></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default ShiftRequirementSettings;
