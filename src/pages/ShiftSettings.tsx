import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Settings, Save, ArrowLeft, Plus, Trash2, Building2, ArrowRightLeft, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AppSwitcher from '../components/AppSwitcher';

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
  const [enableStoreHelp, setEnableStoreHelp] = useState(false);

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

      const { data: settingsData } = await supabase.from('shift_settings').select('*').eq('tenant_id', tenantId).maybeSingle();
      if (settingsData) { 
        setBudget(settingsData.monthly_labor_budget || 0); 
        setAutoGenMode(settingsData.auto_generation_mode || 'equal');
        // DB値またはローカルストレージから応援設定を復元
        const localHelp = localStorage.getItem(`shift_store_help_${tenantId}`);
        setEnableStoreHelp(settingsData.enable_store_help ?? (localHelp === 'true'));
      } else {
        const localHelp = localStorage.getItem(`shift_store_help_${tenantId}`);
        if (localHelp !== null) setEnableStoreHelp(localHelp === 'true');
      }

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
      // DBにenable_store_helpカラムがあるか試行し、なければ安全にフォールバック
      try {
        const { error } = await supabase.from('shift_settings').upsert({
          tenant_id: tenantId,
          monthly_labor_budget: budget, 
          auto_generation_mode: autoGenMode,
          enable_store_help: enableStoreHelp,
          updated_at: new Date().toISOString()
        }, { onConflict: 'tenant_id' });
        if (error) {
          // カラムが存在しないエラーの場合はenable_store_helpを除外してupsert
          await supabase.from('shift_settings').upsert({
            tenant_id: tenantId,
            monthly_labor_budget: budget, 
            auto_generation_mode: autoGenMode,
            updated_at: new Date().toISOString()
          }, { onConflict: 'tenant_id' });
        }
      } catch (e) {
        console.warn('DB upsert fallback:', e);
      }
      
      // ローカルストレージにも確実に保持
      if (tenantId) {
        localStorage.setItem(`shift_store_help_${tenantId}`, String(enableStoreHelp));
      }

      alert('シフト設定（予算・AIモード・店舗応援機能）を保存しました');
    } catch (err) {
      console.error(err); 
      alert('エラーが発生しました: ' + (err as any).message);
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
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id');
      let query = supabase.from('shift_roles').update({ [field]: value }).eq('id', id);
      if (tenantId) query = query.eq('tenant_id', tenantId);
      const { error } = await query;
      if (error) throw error;
      setRoles(roles.map(r => r.id === id ? { ...r, [field]: value } : r));
    } catch (err) {
      console.error(err); alert('エラーが発生しました: ' + (err as any).message);
    }
  };

  const handleDeleteRole = async (id: string) => {
    if (!window.confirm('本当に削除しますか？')) return;
    try {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id');
      let query = supabase.from('shift_roles').delete().eq('id', id);
      if (tenantId) query = query.eq('tenant_id', tenantId);
      const { error } = await query;
      if (error) throw error;
      setRoles(roles.filter(r => r.id !== id));
    } catch (err) {
      console.error(err); alert('エラーが発生しました: ' + (err as any).message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-800">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <button onClick={() => navigate('/shift/admin')} className="p-2 hover:bg-slate-200 rounded-full transition mr-4 cursor-pointer">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <h1 className="text-2xl font-bold flex items-center">
              <Settings className="w-6 h-6 mr-3 text-indigo-600" />
              シフト詳細設定
            </h1>
          </div>
          <AppSwitcher currentApp="shift" role="admin" />
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
                className="w-full bg-indigo-600 text-white px-6 py-2.5 rounded-lg hover:bg-indigo-700 transition font-bold flex items-center justify-center shadow hover:shadow-md"
              >
                <Save className="w-4 h-4 mr-2" /> 設定を保存する
              </button>
            </div>

            {/* 複数店舗・店舗間応援設定 */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-3 border-b pb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-800 flex items-center">
                      店舗間応援（ヘルプ勤務）機能
                      <span className={`ml-3 text-xs px-2.5 py-0.5 rounded-full font-bold ${enableStoreHelp ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                        {enableStoreHelp ? '🤝 応援モード有効' : '🔒 店舗固定モード'}
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      人手不足時に他店舗のスタッフをシフトに組み込めるようにするかを設定します。
                    </p>
                  </div>
                </div>
                {/* スイッチ */}
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={enableStoreHelp} 
                    onChange={e => setEnableStoreHelp(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              <div className={`p-4 rounded-xl border transition-colors ${enableStoreHelp ? 'bg-indigo-50/60 border-indigo-200 text-indigo-950' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                <div className="flex items-start space-x-3">
                  {enableStoreHelp ? (
                    <ArrowRightLeft className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="text-sm space-y-1">
                    {enableStoreHelp ? (
                      <>
                        <div className="font-bold text-indigo-900">【店舗応援モード中】他店舗スタッフのヘルプ配置が可能です</div>
                        <ul className="list-disc list-inside text-xs text-indigo-800 space-y-0.5 ml-1">
                          <li>カレンダーで自店舗以外のスタッフも応援としてシフト登録できます。</li>
                          <li>配置されたシフトには「🤝 〇〇店より応援」バッジが表示されます。</li>
                          <li>同じ日に別店舗で既にシフトが入っている場合の重複（ダブルブッキング）を自動防止します。</li>
                        </ul>
                      </>
                    ) : (
                      <>
                        <div className="font-bold text-slate-800">【店舗固定モード中】自店舗スタッフのみのシンプル運用です</div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          店舗ごとの独立運用となり、シフト作成画面には自店舗に所属するスタッフのみが表示されます。応援を行わない企業様はOFFのままご利用いただくことで、誤操作のない最もシンプルな操作性を維持できます。
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t flex justify-end">
                <button 
                  onClick={handleSaveBudget} 
                  disabled={saving}
                  className="bg-indigo-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-indigo-700 transition font-bold flex items-center shadow"
                >
                  <Save className="w-4 h-4 mr-1.5" /> 応援設定を保存する
                </button>
              </div>
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


