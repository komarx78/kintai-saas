import React, { useState, useEffect } from 'react';
import { Users, Save, ArrowLeft, Plus, Trash2, CheckCircle2 } from 'lucide-react';
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
      if (data) {
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
      setRequirements(newReqs);
    } catch (err) {
      console.error(err);
    }
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
      (requirements['平日'] || []).forEach(req => {
        [1, 2, 3, 4, 5].forEach(dow => insertData.push(createRow(req, dow)));
      });
      // 土日 (日: 0, 土: 6)
      (requirements['土日'] || []).forEach(req => {
        [0, 6].forEach(dow => insertData.push(createRow(req, dow)));
      });
      // 祝日 (7)
      (requirements['祝日'] || []).forEach(req => {
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-blue-100 relative overflow-hidden font-sans text-slate-800">
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

        <div className="bg-white/70 backdrop-blur-xl border border-white/60 shadow-2xl rounded-3xl p-6 md:p-8 flex flex-col gap-8">
          
          {/* Pattern Tabs */}
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

          {/* Gantt Chart UI */}
          <div className="overflow-x-auto pb-4">
            <div className="min-w-[800px]">
              {/* Header: Hours */}
              <div className="flex ml-24 border-b border-indigo-200 pb-2 mb-4">
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
                  return (
                    <div key={role} className="flex items-center relative h-12">
                      <div className="w-24 shrink-0 font-bold text-slate-600 pr-4 text-right">
                        {role}
                      </div>
                      <div className="flex-1 flex relative h-full bg-slate-50/50 rounded-lg border border-slate-100">
                        {/* Grid lines */}
                        <div className="absolute inset-0 flex">
                          {hours.map(h => (
                            <div key={h} className="flex-1 border-r border-slate-200/50 last:border-r-0"></div>
                          ))}
                        </div>

                        {/* Bars */}
                        {roleReqs.map(req => {
                          const startPercent = (req.startHour / 24) * 100;
                          const widthPercent = ((req.endHour - req.startHour) / 24) * 100;
                          return (
                            <div 
                              key={req.id} 
                              className="absolute top-1 bottom-1 bg-indigo-500/80 hover:bg-indigo-600 rounded-md shadow flex items-center justify-center text-white text-xs font-bold transition-all group overflow-hidden cursor-pointer"
                              style={{ left: `${startPercent}%`, width: `${widthPercent}%` }}
                              title={`${req.startHour}:00 - ${req.endHour}:00 (${req.count}人)`}
                            >
                              <span className="group-hover:hidden">{req.count}人</span>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleRemove(req.id); }}
                                className="hidden group-hover:flex items-center justify-center w-full h-full bg-red-500 text-white cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
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
