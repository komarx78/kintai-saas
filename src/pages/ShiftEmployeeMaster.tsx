import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Users, Save, ArrowLeft, Shield, UserPlus, X, Copy, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AppSwitcher from '../components/AppSwitcher';

interface EmployeeSetting {
  user_id: string;
  name: string;
  role: string;
  department?: string;
  employment_type?: string;
  has_shift_access: boolean;
  hire_date: string;
  max_hours_per_week: number;
  priority_score: number;
  default_role: string;
  base_wage: number;
}

const ShiftEmployeeMaster: React.FC = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<EmployeeSetting[]>([]);
  const [roles, setRoles] = useState<{name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [tenantName, setTenantName] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id');
      if (tenantId) {
        const { data: tData } = await supabase.from('tenants').select('name').eq('id', tenantId).single();
        if (tData) setTenantName(tData.name);
      }

      const { data: usersData } = await supabase.from('users').select('id, name, role, department, employment_type, has_shift_access').eq('tenant_id', tenantId);
      const { data: settingsData } = await supabase.from('shift_employee_settings').select('*').eq('tenant_id', tenantId);
      const { data: rolesData } = await supabase.from('shift_roles').select('name').eq('tenant_id', tenantId);
      
      if (rolesData) setRoles(rolesData);

      const merged = (usersData || []).map(u => {
        const s = (settingsData || []).find(sd => sd.user_id === u.id);
        return {
          user_id: u.id,
          name: u.name,
          role: u.role,
          department: u.department || '未設定',
          employment_type: u.employment_type === 'full-time' ? '正社員' : 'パート・アルバイト',
          has_shift_access: u.has_shift_access || false,
          hire_date: s?.hire_date || '',
          max_hours_per_week: s?.max_hours_per_week || 40,
          priority_score: s?.priority_score || 3,
          default_role: s?.default_role || '',
          base_wage: s?.base_wage || 1000
        };
      });

      setEmployees(merged);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = (userId: string, field: string, value: any) => {
    setEmployees(emps => emps.map(e => e.user_id === userId ? { ...e, [field]: value } : e));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id');
      
      for (const emp of employees) {
        await supabase.from('users').update({ has_shift_access: emp.has_shift_access }).eq('id', emp.user_id);
      }

      const upserts = employees.filter(e => e.has_shift_access).map(e => ({
        tenant_id: tenantId,
        user_id: e.user_id,
        hire_date: e.hire_date || null,
        max_hours_per_week: e.max_hours_per_week,
        priority_score: e.priority_score,
        default_role: e.default_role,
        base_wage: e.base_wage,
        updated_at: new Date().toISOString()
      }));

      if (upserts.length > 0) {
        for (const item of upserts) {
          const { data: exist } = await supabase.from('shift_employee_settings').select('id').eq('user_id', item.user_id).maybeSingle();
          if (exist) {
            await supabase.from('shift_employee_settings').update(item).eq('id', exist.id);
          } else {
            await supabase.from('shift_employee_settings').insert(item);
          }
        }
      }
      
      alert('保存しました');
    } catch (err) {
      console.error(err);
      alert('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-800">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center space-x-4">
            <button onClick={() => navigate('/shift/admin')} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <h1 className="text-2xl font-bold flex items-center">
              <Users className="w-6 h-6 mr-3 text-indigo-600" />
              シフト要員マスタ（AI条件設定）
            </h1>
          </div>
          <div className="flex space-x-4">
            <button 
              onClick={() => setIsInviteModalOpen(true)}
              className="bg-white border border-indigo-200 text-indigo-600 px-4 py-2 rounded-xl flex items-center hover:bg-indigo-50 transition shadow-sm font-bold text-sm"
            >
              <UserPlus className="w-4 h-4 mr-2" /> 従業員を新規招待
            </button>
            <button 
              onClick={handleSave} 
              disabled={saving}
              className="bg-indigo-600 text-white px-6 py-2 rounded-xl flex items-center hover:bg-indigo-700 transition shadow-sm font-bold cursor-pointer"
            >
              {saving ? <div className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full"></div> : <><Save className="w-5 h-5 mr-2" />一括保存</>}
            </button>
            <AppSwitcher currentApp="shift" role="admin" />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-sm text-slate-600">
                <th className="p-4 font-bold text-center">シフト対象</th>
                <th className="p-4 font-bold">氏名</th>
                <th className="p-4 font-bold">所属部署 / 区分</th>
                <th className="p-4 font-bold">メイン役割</th>
                <th className="p-4 font-bold text-center">入社日</th>
                <th className="p-4 font-bold text-center">優先度 (5=最高)</th>
                <th className="p-4 font-bold text-center">週上限(時間)</th>
                <th className="p-4 font-bold text-right">基本時給</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={8} className="p-8 text-center"><div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto"></div></td></tr>
              ) : employees.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-slate-500 font-bold">システムに従業員が登録されていません。「従業員を新規招待」から登録してください。</td></tr>
              ) : (
                employees.map(emp => (
                  <tr key={emp.user_id} className={`hover:bg-indigo-50/30 transition-colors ${!emp.has_shift_access ? 'opacity-50 grayscale' : ''}`}>
                    <td className="p-4 text-center">
                      <input 
                        type="checkbox" 
                        checked={emp.has_shift_access}
                        onChange={e => handleUpdate(emp.user_id, 'has_shift_access', e.target.checked)}
                        className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                      />
                    </td>
                    <td className="p-4">
                      <div className="font-bold flex items-center">
                        {emp.name}
                        {emp.role === 'admin' && <Shield className="w-4 h-4 ml-2 text-amber-500" />}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-bold text-slate-700">{emp.department}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full w-fit font-bold ${emp.employment_type === '正社員' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                          {emp.employment_type}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <select disabled={!emp.has_shift_access} value={emp.default_role} onChange={e => handleUpdate(emp.user_id, 'default_role', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-sm font-bold disabled:bg-slate-100">
                        <option value="">未設定</option>
                        {roles.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
                      </select>
                    </td>
                    <td className="p-4 text-center">
                      <input disabled={!emp.has_shift_access} type="date" value={emp.hire_date} onChange={e => handleUpdate(emp.user_id, 'hire_date', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-sm font-bold text-center disabled:bg-slate-100" />
                    </td>
                    <td className="p-4 text-center">
                      <input disabled={!emp.has_shift_access} type="number" min="1" max="5" value={emp.priority_score} onChange={e => handleUpdate(emp.user_id, 'priority_score', Number(e.target.value))} className="w-20 bg-slate-50 border border-slate-200 rounded p-2 text-sm font-bold text-center inline-block disabled:bg-slate-100" />
                    </td>
                    <td className="p-4 text-center">
                      <input disabled={!emp.has_shift_access} type="number" min="0" max="168" value={emp.max_hours_per_week} onChange={e => handleUpdate(emp.user_id, 'max_hours_per_week', Number(e.target.value))} className="w-20 bg-slate-50 border border-slate-200 rounded p-2 text-sm font-bold text-center inline-block disabled:bg-slate-100" />
                    </td>
                    <td className="p-4 text-right">
                      <input disabled={!emp.has_shift_access} type="number" step="10" value={emp.base_wage} onChange={e => handleUpdate(emp.user_id, 'base_wage', Number(e.target.value))} className="w-24 bg-slate-50 border border-slate-200 rounded p-2 text-sm font-bold text-right inline-block disabled:bg-slate-100" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Invite Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl text-left overflow-hidden shadow-2xl w-full max-w-md flex flex-col">
            <div className="bg-white px-6 pt-6 pb-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-slate-900 flex items-center">
                  <UserPlus className="w-6 h-6 mr-2 text-indigo-600" />
                  従業員を招待する
                </h3>
                <button onClick={() => setIsInviteModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="mb-6 bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                <p className="text-sm text-indigo-800 mb-2 font-bold">
                  以下の招待リンクをコピーして、LINEやメールで従業員に送信してください。
                </p>
                <p className="text-xs text-indigo-600">
                  ※従業員がリンクからアカウントを作成すると、自動的にあなたの会社（{tenantName}）の所属となり、この一覧に表示されます。
                </p>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">招待リンク</label>
                <div className="flex mt-1">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/?tenant=${encodeURIComponent(tenantName)}`}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-l-xl px-3 py-2 text-sm text-slate-600 font-mono focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/?tenant=${encodeURIComponent(tenantName)}`);
                      setCopySuccess(true);
                      setTimeout(() => setCopySuccess(false), 2000);
                    }}
                    className={`px-4 py-2 rounded-r-xl text-white font-bold text-sm transition-colors flex items-center ${copySuccess ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                  >
                    {copySuccess ? <><Check className="w-4 h-4 mr-1" />完了</> : <><Copy className="w-4 h-4 mr-1" />コピー</>}
                  </button>
                </div>
              </div>
            </div>
            <div className="bg-slate-50 px-6 py-4 flex justify-end">
              <button onClick={() => setIsInviteModalOpen(false)} className="bg-white border border-slate-300 text-slate-700 px-6 py-2.5 rounded-xl hover:bg-slate-50 font-bold transition">
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShiftEmployeeMaster;