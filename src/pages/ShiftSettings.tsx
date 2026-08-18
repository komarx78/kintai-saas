import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Settings, Save, ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ShiftRole {
  id: string;
  name: string;
  color: string;
  display_order: number;
}

const ShiftSettings: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [roles, setRoles] = useState<ShiftRole[]>([]);
  const [budget, setBudget] = useState(0);
  const [autoGenMode, setAutoGenMode] = useState('equal');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id');
      if (!tenantId) return;

      const { data: rolesData } = await supabase.from('shift_roles').select('*').eq('tenant_id', tenantId).order('display_order');
      if (rolesData) setRoles(rolesData);

      const { data: settingsData } = await supabase.from('shift_settings').select('*').eq('tenant_id', tenantId).single();
      if (settingsData) { setBudget(settingsData.monthly_labor_budget); setAutoGenMode(settingsData.auto_generation_mode || 'equal'); }

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBudget = async () => {
    setSaving(true);
    try {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id');
      const { error } = await supabase.from('shift_settings').upsert({
        tenant_id: tenantId,
        monthly_labor_budget: budget, auto_generation_mode: autoGenMode,
        updated_at: new Date().toISOString()
      }, { onConflict: 'tenant_id' });
      if (error) throw error;
      alert('予算を保存しました');
    } catch (err) {
      console.error(err); alert('エラーが発生しました: ' + (err as any).message);
      alert('保存エラー');
    } finally {
      setSaving(false);
    }
  };

  const handleAddRole = async () => {
    try {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id');
      const newRole = { tenant_id: tenantId, name: '新規役割 ' + (roles.length + 1), color: '#4F46E5', display_order: roles.length };
      const { data, error } = await supabase.from('shift_roles').insert([newRole]).select().single();
      if (error) throw error;
      setRoles([...roles, data]);
    } catch (err) {
      console.error(err); alert('エラーが発生しました: ' + (err as any).message);
    }
  };

  const handleUpdateRole = async (id: string, field: string, value: string) => {
    try {
      await supabase.from('shift_roles').update({ [field]: value }).eq('id', id);
      setRoles(roles.map(r => r.id === id ? { ...r, [field]: value } : r));
    } catch (err) {
      console.error(err); alert('エラーが発生しました: ' + (err as any).message);
    }
  };

  const handleDeleteRole = async (id: string) => {
    if (!window.confirm('本当に削除しますか？')) return;
    try {
      await supabase.from('shift_roles').delete().eq('id', id);
      setRoles(roles.filter(r => r.id !== id));
    } catch (err) {
      console.error(err); alert('エラーが発生しました: ' + (err as any).message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-800">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center mb-8">
          <button onClick={() => navigate('/shift/admin')} className="p-2 hover:bg-slate-200 rounded-full transition mr-4">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h1 className="text-2xl font-bold flex items-center">
            <Settings className="w-6 h-6 mr-3 text-indigo-600" />
            シフト詳細設定
          </h1>
        </div>

        {loading ? (
          <div>Loading...</div>
        ) : (
          <div className="space-y-8">
            {/* 予算設定 */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-bold mb-4 border-b pb-2">月間人件費予算設定</h2>
              <div className="flex items-end space-x-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">目標予算 (円)</label>
                  <input 
                    type="number" 
                    value={budget} 
                    onChange={e => setBudget(Number(e.target.value))}
                    className="w-48 bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold text-lg"
                  />
                </div>
              </div>
              <div className="mt-6">
                <label className="block text-xs font-bold text-slate-500 mb-1">AI自動生成モード</label>
                <select 
                  value={autoGenMode} 
                  onChange={e => setAutoGenMode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold mb-4"
                >
                  <option value="equal">均等分配モード (全員のシフト数を平準化)</option>
                  <option value="veteran">ベテラン優先モード (入社日が古い順に優先)</option>
                  <option value="priority">優先度重視モード (設定した優先スコア順)</option>
                </select>
              </div>
              <button 
                onClick={handleSaveBudget} 
                disabled={saving}
                className="w-full bg-indigo-600 text-white px-6 py-2.5 rounded-lg hover:bg-indigo-700 transition font-bold flex items-center justify-center"
              >
                <Save className="w-4 h-4 mr-2" /> 予算とモードを保存
              </button>
            </div>

            {/* 役割設定 */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex justify-between items-center mb-4 border-b pb-2">
                <h2 className="text-lg font-bold">役割（ポジション）マスタ</h2>
                <button onClick={handleAddRole} className="text-indigo-600 text-sm font-bold flex items-center hover:bg-indigo-50 px-3 py-1 rounded transition">
                  <Plus className="w-4 h-4 mr-1" /> 追加
                </button>
              </div>
              
              <div className="space-y-3">
                {roles.map(role => (
                  <div key={role.id} className="flex items-center space-x-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <input 
                      type="text" 
                      value={role.name}
                      onChange={e => handleUpdateRole(role.id, 'name', e.target.value)}
                      className="flex-grow bg-white border border-slate-200 rounded p-2 font-medium"
                    />
                    <input 
                      type="color" 
                      value={role.color}
                      onChange={e => handleUpdateRole(role.id, 'color', e.target.value)}
                      className="w-12 h-10 rounded cursor-pointer"
                    />
                    <button onClick={() => handleDeleteRole(role.id)} className="p-2 text-red-500 hover:bg-red-100 rounded transition">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShiftSettings;


