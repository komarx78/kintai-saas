import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Settings, Users, Save, Database, Edit, X, Sparkles, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('billing'); // 'billing', 'staff', 'ai_settings'

  // Settings State
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [isSavingAi, setIsSavingAi] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ status: 'idle' | 'loading' | 'success' | 'error'; message: string }>({
    status: 'idle',
    message: ''
  });
  
  const [sysPrices, setSysPrices] = useState({
    price_1_user: 2000, price_1_user_annual: 20000,
    price_2_users: 4000, price_2_users_annual: 40000,
    price_3_users: 6000, price_3_users_annual: 60000,
    price_4_users: 8000, price_4_users_annual: 80000,
    price_5_users: 10000, price_5_users_annual: 100000,
    additional_user_price: 500, additional_user_price_annual: 5000
  });

  // Tenants State
  const [tenants, setTenants] = useState<any[]>([]);
  const [editingTenant, setEditingTenant] = useState<any>(null); // For modal

  // Staff State
  const [staffList, setStaffList] = useState<any[]>([]);
  const [newStaffEmail, setNewStaffEmail] = useState('');
  
  useEffect(() => {
    fetchSystemSettings();
    fetchTenants();
    fetchStaff();
  }, []);

  const fetchSystemSettings = async () => {
    // ローカルストレージフォールバック
    const localKey = localStorage.getItem('platform_gemini_api_key') || localStorage.getItem('gemini_api_key_custom') || '';
    if (localKey) setGeminiApiKey(localKey);

    try {
      const { data } = await supabase.from('system_settings').select('*').limit(1).maybeSingle();
      if (data) {
        setSettingsId(data.id);
        if (data.gemini_api_key) setGeminiApiKey(data.gemini_api_key);
        setSysPrices({
          price_1_user: data.price_1_user || 2000,
          price_1_user_annual: data.price_1_user_annual || 20000,
          price_2_users: data.price_2_users || 4000,
          price_2_users_annual: data.price_2_users_annual || 40000,
          price_3_users: data.price_3_users || 6000,
          price_3_users_annual: data.price_3_users_annual || 60000,
          price_4_users: data.price_4_users || 8000,
          price_4_users_annual: data.price_4_users_annual || 80000,
          price_5_users: data.price_5_users || 10000,
          price_5_users_annual: data.price_5_users_annual || 100000,
          additional_user_price: data.additional_user_price || 500,
          additional_user_price_annual: data.additional_user_price_annual || 5000,
        });
      }
    } catch (e) {
      console.warn('Fetch system settings note:', e);
    }
  };

  const fetchTenants = async () => {
    const { data, error } = await supabase.from('tenants').select('*').order('created_at', { ascending: false });
    if (data) {
      setTenants(data);
    } else if (error) {
      console.error('Failed to fetch tenants:', error);
    }
  };

  const fetchStaff = async () => {
    const { data, error } = await supabase.from('users').select('*').eq('role', 'superadmin');
    if (data) {
      setStaffList(data);
    } else if (error) {
      console.error('Failed to fetch staff:', error);
    }
  };

  const handleSysPriceChange = (field: string, value: string) => {
    setSysPrices(prev => ({ ...prev, [field]: Number(value) }));
  };

  const handleSaveSettings = async () => {
    try {
      if (settingsId) {
        const { error } = await supabase.from('system_settings').update(sysPrices).eq('id', settingsId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('system_settings').insert([sysPrices]).select().single();
        if (error) throw error;
        if (data) setSettingsId(data.id);
      }
      alert('システム共通設定を保存しました。');
    } catch (err) {
      console.error(err);
      alert('保存に失敗しました。');
    }
  };

  // 販売元AIキー保存処理
  const handleSaveAiKey = async () => {
    setIsSavingAi(true);
    try {
      const cleanKey = geminiApiKey.trim();
      localStorage.setItem('platform_gemini_api_key', cleanKey);
      localStorage.setItem('gemini_api_key_custom', cleanKey);

      if (settingsId) {
        await supabase.from('system_settings').update({ gemini_api_key: cleanKey }).eq('id', settingsId);
      } else {
        const { data } = await supabase.from('system_settings').insert([{ ...sysPrices, gemini_api_key: cleanKey }]).select().single();
        if (data) setSettingsId(data.id);
      }
      alert('🤖 全テナント共通のGemini APIキーを保存しました！\n全顧客企業の従業員AI相談ボットに即座に適用されます。');
    } catch (err: any) {
      console.error(err);
      alert('APIキーの保存に失敗しました: ' + err.message);
    } finally {
      setIsSavingAi(false);
    }
  };

  // AIキー接続テスト実行
  const handleTestAiKey = async () => {
    const key = geminiApiKey.trim();
    if (!key) {
      alert('APIキーを入力してください。');
      return;
    }
    setAiTestResult({ status: 'loading', message: 'Gemini 3.5 Flash にテスト通信中...' });
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: '「こんにちは！就業規則AIの接続テストです。」とだけ返答してください。' }] }],
          generationConfig: { maxOutputTokens: 100 }
        })
      });

      if (res.ok) {
        const data = await res.json();
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || '通信成功';
        setAiTestResult({
          status: 'success',
          message: `✅ 接続成功！Gemini 3.5 Flash 応答: 「${reply.trim()}」`
        });
      } else {
        const errJson = await res.json().catch(() => ({}));
        setAiTestResult({
          status: 'error',
          message: `❌ 接続失敗 (${res.status}): ${errJson.error?.message || 'APIキーまたはエンドポイントが無効です'}`
        });
      }
    } catch (e: any) {
      setAiTestResult({
        status: 'error',
        message: `❌ 通信エラー: ${e.message}`
      });
    }
  };

  const handleUpdateTenant = async (tenantId: string, field: string, value: any) => {
    try {
      const { error } = await supabase.from('tenants').update({ [field]: value }).eq('id', tenantId);
      if (error) throw error;
      setTenants(tenants.map(t => t.id === tenantId ? { ...t, [field]: value } : t));
    } catch (err) {
      console.error(err);
      alert('テナントの更新に失敗しました。');
    }
  };

  const handleSaveTenantCustomPrices = async () => {
    if (!editingTenant) return;
    try {
      const updatePayload = {
        custom_price_1_user: editingTenant.custom_price_1_user,
        custom_price_1_user_annual: editingTenant.custom_price_1_user_annual,
        custom_price_2_users: editingTenant.custom_price_2_users,
        custom_price_2_users_annual: editingTenant.custom_price_2_users_annual,
        custom_price_3_users: editingTenant.custom_price_3_users,
        custom_price_3_users_annual: editingTenant.custom_price_3_users_annual,
        custom_price_4_users: editingTenant.custom_price_4_users,
        custom_price_4_users_annual: editingTenant.custom_price_4_users_annual,
        custom_price_5_users: editingTenant.custom_price_5_users,
        custom_price_5_users_annual: editingTenant.custom_price_5_users_annual,
      };
      const { error } = await supabase.from('tenants').update(updatePayload).eq('id', editingTenant.id);
      if (error) throw error;
      
      setTenants(tenants.map(t => t.id === editingTenant.id ? { ...t, ...updatePayload } : t));
      setEditingTenant(null);
      alert('個別価格設定を保存しました。');
    } catch (err) {
      console.error(err);
      alert('テナントの個別価格保存に失敗しました。');
    }
  };

  const handleAddStaff = async () => {
    if (!newStaffEmail.trim()) return;
    try {
      const { data: user, error: findError } = await supabase.from('users').select('id').eq('email', newStaffEmail.trim()).single();
      if (findError || !user) {
        alert('該当するメールアドレスのユーザーが見つかりません。');
        return;
      }
      
      const { error: updateError } = await supabase.from('users').update({ role: 'superadmin' }).eq('id', user.id);
      if (updateError) throw updateError;
      
      alert('権限を付与しました。');
      setNewStaffEmail('');
      fetchStaff();
    } catch (err) {
      console.error(err);
      alert('権限付与に失敗しました。');
    }
  };

  const handleRemoveStaff = async (userId: string, email: string) => {
    if (email === 'koma@kap-cocotte.com') {
      alert('この絶対特権アカウントは降格できません。');
      return;
    }
    if (!confirm(`本当に ${email} の権限を剥奪しますか？`)) return;
    try {
      const { error } = await supabase.from('users').update({ role: 'admin' }).eq('id', userId);
      if (error) throw error;
      fetchStaff();
    } catch (err) {
      console.error(err);
      alert('権限剥奪に失敗しました。');
    }
  };

  const renderPriceRow = (label: string, fieldMonthly: string, fieldAnnual: string, isTenantModal = false) => {
    const stateObj = isTenantModal ? editingTenant : sysPrices;
    const onChangeFn = isTenantModal 
      ? (field: string, val: string) => setEditingTenant({ ...editingTenant, [field]: val === '' ? null : Number(val) })
      : handleSysPriceChange;
    
    return (
      <tr className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
        <td className="py-3 px-4 font-medium text-gray-700 whitespace-nowrap">{label}</td>
        <td className="py-3 px-4">
          <div className="relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500 sm:text-sm">¥</span>
            </div>
            <input 
              type="number" 
              value={stateObj[fieldMonthly] === null || stateObj[fieldMonthly] === undefined ? '' : stateObj[fieldMonthly]} 
              onChange={e => onChangeFn(fieldMonthly, e.target.value)} 
              placeholder={isTenantModal ? "共通設定を適用" : ""}
              className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-8 pr-3 sm:text-sm border-gray-300 rounded-md py-2 border" 
            />
          </div>
        </td>
        <td className="py-3 px-4">
          <div className="relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500 sm:text-sm">¥</span>
            </div>
            <input 
              type="number" 
              value={stateObj[fieldAnnual] === null || stateObj[fieldAnnual] === undefined ? '' : stateObj[fieldAnnual]} 
              onChange={e => onChangeFn(fieldAnnual, e.target.value)} 
              placeholder={isTenantModal ? "共通設定を適用" : ""}
              className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-8 pr-3 sm:text-sm border-gray-300 rounded-md py-2 border" 
            />
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">
      {/* Sidebar */}
      <div className="w-full md:w-64 bg-gray-900 text-white flex flex-col shadow-lg z-10">
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center space-x-3 mb-2">
            <Database className="w-8 h-8 text-blue-400" />
            <h1 className="text-xl font-bold">特権管理者</h1>
          </div>
          <p className="text-xs text-gray-400">システム運用・管理用ダッシュボード</p>
        </div>
        <nav className="flex-1 p-4 space-y-2 flex flex-col">
          <button 
            onClick={() => setActiveTab('billing')}
            className={`w-full flex items-center px-4 py-3 text-sm rounded-md transition cursor-pointer ${activeTab === 'billing' ? 'bg-blue-800 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
          >
            <Settings className="h-5 w-5 mr-3" />
            プラン＆価格管理
          </button>
          <button 
            onClick={() => setActiveTab('ai_settings')}
            className={`w-full flex items-center px-4 py-3 text-sm rounded-md transition cursor-pointer ${activeTab === 'ai_settings' ? 'bg-blue-800 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
          >
            <Sparkles className="h-5 w-5 mr-3 text-amber-400" />
            AIプラットフォーム設定
          </button>
          <button 
            onClick={() => setActiveTab('staff')}
            className={`w-full flex items-center px-4 py-3 text-sm rounded-md transition cursor-pointer ${activeTab === 'staff' ? 'bg-blue-800 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
          >
            <Users className="h-5 w-5 mr-3" />
            運営スタッフ管理
          </button>
          <div className="mt-auto pt-4">
            <button onClick={() => navigate('/')} className="w-full flex items-center px-4 py-3 text-sm rounded-md transition text-gray-400 hover:bg-gray-800 hover:text-white cursor-pointer">
              ログアウト
            </button>
          </div>
        </nav>
      </div>

      <div className="flex-1 p-4 md:p-8 overflow-auto relative">
        <div className="max-w-7xl mx-auto space-y-8">
          
          {activeTab === 'billing' && (
            <>
              {/* システム共通料金設定 (価格表UI) */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2 flex items-center">
                  <Settings className="w-5 h-5 mr-2 text-blue-600" />
                  システム共通価格表 (デフォルト価格)
                </h2>
                
                <div className="overflow-x-auto mb-6">
                  <table className="min-w-full text-sm border-collapse">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-gray-600 w-1/4">利用枠・対象</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-600">月額 (円)</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-600">年額 (円)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {renderPriceRow('1名様枠', 'price_1_user', 'price_1_user_annual')}
                      {renderPriceRow('2名様枠', 'price_2_users', 'price_2_users_annual')}
                      {renderPriceRow('3名様枠', 'price_3_users', 'price_3_users_annual')}
                      {renderPriceRow('4名様枠', 'price_4_users', 'price_4_users_annual')}
                      {renderPriceRow('5名様枠', 'price_5_users', 'price_5_users_annual')}
                      {renderPriceRow('6名以降(1名あたり追加)', 'additional_user_price', 'additional_user_price_annual')}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end">
                  <button onClick={handleSaveSettings} className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 font-medium flex items-center shadow-sm">
                    <Save className="w-4 h-4 mr-2" />
                    共通価格表を保存
                  </button>
                </div>
              </div>

              {/* テナント管理リスト */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-lg font-bold text-gray-800 flex items-center">
                    <Users className="w-5 h-5 mr-2 text-green-600" />
                    導入企業（テナント）一覧
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">企業名</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">プラン</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">支払いサイクル</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">トライアル期限</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-500">個別価格</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {tenants.map(t => (
                        <tr key={t.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4 font-bold text-gray-900">{t.name}</td>
                          <td className="px-4 py-4">
                            <select 
                              value={t.plan_type || 'trial'} 
                              onChange={e => handleUpdateTenant(t.id, 'plan_type', e.target.value)}
                              className="border border-gray-300 rounded px-2 py-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
                            >
                              <option value="trial">トライアル</option>
                              <option value="free">無料プラン</option>
                              <option value="paid">有料プラン</option>
                            </select>
                          </td>
                          <td className="px-4 py-4">
                            <select 
                              value={t.billing_cycle || 'monthly'} 
                              onChange={e => handleUpdateTenant(t.id, 'billing_cycle', e.target.value)}
                              className="border border-gray-300 rounded px-2 py-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
                            >
                              <option value="monthly">月額払い</option>
                              <option value="annual">年額払い</option>
                            </select>
                          </td>
                          <td className="px-4 py-4 text-gray-600">
                            {/* トライアル期限はDBの値をフォーマットして表示するだけ */}
                            {t.trial_ends_at ? new Date(t.trial_ends_at).toLocaleDateString('ja-JP') : '期限なし'}
                          </td>
                          <td className="px-4 py-4 text-center">
                            <button
                              onClick={() => setEditingTenant(t)}
                              className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                              <Edit className="w-3.5 h-3.5 mr-1" />
                              価格表を上書き
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {tenants.length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                      企業データがありません。
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === 'staff' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h2 className="text-lg font-bold text-gray-800 mb-6 border-b pb-2 flex items-center">
                <Users className="w-5 h-5 mr-2 text-blue-600" />
                運営スタッフ（特権管理者）の管理
              </h2>

              <div className="mb-8 bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h3 className="text-sm font-bold text-gray-700 mb-2">新規スタッフの追加（権限付与）</h3>
                <div className="flex items-center space-x-2">
                  <input
                    type="email"
                    placeholder="登録済みユーザーのメールアドレス"
                    value={newStaffEmail}
                    onChange={(e) => setNewStaffEmail(e.target.value)}
                    className="flex-1 focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md py-2 px-3 border"
                  />
                  <button
                    onClick={handleAddStaff}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-medium whitespace-nowrap"
                  >
                    権限を付与
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">※ 該当ユーザーがシステムに一度登録されている必要があります。</p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-gray-700 mb-3">現在の特権管理者一覧</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm border">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">名前</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">メールアドレス</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">操作</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {staffList.map(staff => (
                        <tr key={staff.id}>
                          <td className="px-4 py-3 text-gray-900 font-medium">{staff.name}</td>
                          <td className="px-4 py-3 text-gray-500">{staff.email}</td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleRemoveStaff(staff.id, staff.email)}
                              disabled={staff.email === 'koma@kap-cocotte.com'}
                              className="text-red-600 hover:text-red-800 disabled:text-gray-300 font-medium"
                            >
                              権限剥奪
                            </button>
                          </td>
                        </tr>
                      ))}
                      {staffList.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-gray-500">スタッフが存在しません。</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ai_settings' && (
            <div className="bg-white p-6 sm:p-8 rounded-xl shadow-sm border border-gray-200 space-y-6">
              <div className="border-b pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-md">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">
                      AIプラットフォーム設定（全テナント共通）
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      販売元（システム管理者）として全顧客企業に提供する Google Gemini API キーを一括管理します
                    </p>
                  </div>
                </div>
              </div>

              {/* APIキー設定カード */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-1">
                    Google Gemini API キー（プラットフォーム提供キー）
                  </label>
                  <p className="text-xs text-gray-500 mb-3">
                    ここに設定したAPIキーが、全導入企業の「社内規定・就業規則AI相談ボット」の動力源として利用されます。<br />
                    顧客企業側でAPIキーを用意・設定する必要は一切ありません。（※キーはサーバー上に安全に保管されます）
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="password"
                      value={geminiApiKey}
                      onChange={(e) => setGeminiApiKey(e.target.value)}
                      placeholder="AIzaSy... または AQ.Ab8..."
                      className="flex-1 text-sm p-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-amber-500 font-mono shadow-xs"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleTestAiKey}
                        className="px-4 py-3 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        接続テスト
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveAiKey}
                        disabled={isSavingAi}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap disabled:opacity-50"
                      >
                        {isSavingAi ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            保存中...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            設定を保存
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* テスト結果表示 */}
                {aiTestResult.status !== 'idle' && (
                  <div className={`p-4 rounded-xl text-xs font-bold flex items-start gap-2 animate-in fade-in ${
                    aiTestResult.status === 'loading' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                    aiTestResult.status === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                    'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}>
                    {aiTestResult.status === 'loading' && <Loader2 className="w-4 h-4 animate-spin shrink-0 mt-0.5" />}
                    {aiTestResult.status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
                    {aiTestResult.status === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}
                    <span>{aiTestResult.message}</span>
                  </div>
                )}
              </div>

              {/* 運用ガイド */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-xs text-blue-900 space-y-2">
                <h4 className="font-bold flex items-center gap-1.5 text-blue-950">
                  <Database className="w-4 h-4 text-blue-600" />
                  SaaSビジネスにおけるAI機能の提供フロー
                </h4>
                <ul className="list-disc list-inside space-y-1 text-blue-800 pl-1">
                  <li><strong>販売元（我が君）</strong>: この画面でGemini APIキーを一度設定するだけで完了です。</li>
                  <li><strong>導入企業（顧客）</strong>: 管理画面で自社の就業規則をコピペ・保存するだけでOKです。</li>
                  <li><strong>従業員（エンドユーザー）</strong>: スマホやPCから「就業規則AI相談」を開けば、自動で自社の規則に沿ってAIが回答します。</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tenant Custom Price Modal */}
      {editingTenant && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setEditingTenant(null)} />
            
            <div className="relative inline-block w-full max-w-3xl overflow-hidden text-left align-bottom transition-all transform bg-white rounded-xl shadow-2xl sm:my-8 sm:align-middle">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-900">
                  {editingTenant.name} の個別価格設定
                </h3>
                <button onClick={() => setEditingTenant(null)} className="text-gray-400 hover:text-gray-500">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6">
                <p className="text-sm text-gray-500 mb-4">
                  空欄（未入力）の場合はシステム共通価格表のデフォルト値が適用されます。特定の人数枠だけ特別価格にする場合はその枠のみご入力ください。
                </p>
                
                <div className="overflow-x-auto mb-6">
                  <table className="min-w-full text-sm border-collapse">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-gray-600 w-1/4">利用枠</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-600">特別 月額 (円)</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-600">特別 年額 (円)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {renderPriceRow('1名様枠', 'custom_price_1_user', 'custom_price_1_user_annual', true)}
                      {renderPriceRow('2名様枠', 'custom_price_2_users', 'custom_price_2_users_annual', true)}
                      {renderPriceRow('3名様枠', 'custom_price_3_users', 'custom_price_3_users_annual', true)}
                      {renderPriceRow('4名様枠', 'custom_price_4_users', 'custom_price_4_users_annual', true)}
                      {renderPriceRow('5名様枠', 'custom_price_5_users', 'custom_price_5_users_annual', true)}
                    </tbody>
                  </table>
                </div>

                <div className="mt-5 sm:mt-6 sm:flex sm:flex-row-reverse">
                  <button
                    onClick={handleSaveTenantCustomPrices}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    個別価格を保存
                  </button>
                  <button
                    onClick={() => setEditingTenant(null)}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
