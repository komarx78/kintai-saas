import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import AppSwitcher from '../components/AppSwitcher';
import { DEFAULT_EMPLOYMENT_RULES } from '../lib/defaultRules';
import { 
  Building2, Users, Calendar, DollarSign, BookOpen, 
  ArrowLeft, LogOut, Loader2, Save, Plus, Trash2, 
  Sparkles, Bot, Clock, ShieldCheck
} from 'lucide-react';

interface DepartmentMaster {
  id: string;
  name: string;
  code?: string;
  display_order: number;
}

export default function CompanySettingsDashboard() {
  const navigate = useNavigate();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'departments' | 'calendar' | 'payroll' | 'rules'>('basic');

  // 1. 会社基本情報State
  const [basicInfo, setBasicInfo] = useState({
    name: '株式会社KAP',
    address: '東京都千代田区大手町 1-2-3',
    representative_name: '代表取締役 〇〇 〇〇',
    phone_number: '03-1234-5678',
    corporate_number: '1234567890123'
  });

  // 2. 部署マスタState
  const [departments, setDepartments] = useState<DepartmentMaster[]>([]);
  const [newDeptName, setNewDeptName] = useState('');

  // 3. カレンダー・休日・就業時間State
  const [calendarSettings, setCalendarSettings] = useState({
    fixed_holidays: [0, 6], // 0:日, 6:土
    national_holidays_enabled: true,
    winter_vacation_enabled: true,
    winter_vacation_start: '2026-12-29',
    winter_vacation_end: '2027-01-03',
    summer_vacation_enabled: true,
    summer_vacation_start: '2026-08-13',
    summer_vacation_end: '2026-08-16',
    custom_holidays: [] as { date: string; name: string }[],
    standard_start_time: '09:00',
    standard_end_time: '18:00',
    standard_break_minutes: 60,
    annual_holidays_count: 125,
    holiday_text_summary: '完全週休2日制（土日・祝日）、年末年始休暇、夏季休暇（年間休日125日）'
  });
  const [newCustomHolidayDate, setNewCustomHolidayDate] = useState('');
  const [newCustomHolidayName, setNewCustomHolidayName] = useState('');

  // 4. 給与・労務設定State
  const [payrollSettings, setPayrollSettings] = useState({
    closing_day: 31,
    payment_day: 25,
    payment_month: 'current',
    overtime_rate: 1.25,
    night_rate: 0.25,
    holiday_rate: 1.35,
    health_insurance_rate: 0.05,
    pension_rate: 0.0915,
    employment_insurance_rate: 0.006,
    commuting_allowance_limit: 150000
  });

  // 5. 就業規則・AI State
  const [employmentRulesText, setEmploymentRulesText] = useState(DEFAULT_EMPLOYMENT_RULES);
  const [geminiApiKey, setGeminiApiKey] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/');
        return;
      }

      const { data: tenantIdData } = await supabase.rpc('get_user_tenant_id');
      if (!tenantIdData) return;
      setTenantId(tenantIdData);

      // テナント全体設定取得
      const { data: tData } = await supabase.from('tenants').select('*').eq('id', tenantIdData).maybeSingle();
      if (tData) {
        setBasicInfo({
          name: tData.name || '株式会社KAP',
          address: tData.address || '東京都千代田区大手町 1-2-3',
          representative_name: tData.representative_name || '代表取締役 〇〇 〇〇',
          phone_number: tData.phone_number || '03-1234-5678',
          corporate_number: tData.corporate_number || ''
        });

        if (tData.work_calendar_settings) {
          setCalendarSettings({
            ...calendarSettings,
            ...tData.work_calendar_settings
          });
        }

        if (tData.payroll_common_settings) {
          setPayrollSettings({
            ...payrollSettings,
            ...tData.payroll_common_settings
          });
        }

        if (tData.employment_rules_text) {
          setEmploymentRulesText(tData.employment_rules_text);
        }
        if (tData.gemini_api_key) {
          setGeminiApiKey(tData.gemini_api_key);
        }
      }

      // 部署マスタ取得
      const { data: deptData } = await supabase
        .from('department_masters')
        .select('*')
        .eq('tenant_id', tenantIdData)
        .order('display_order', { ascending: true });

      setDepartments(deptData || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // 全社設定の一括保存
  const handleSaveAllSettings = async () => {
    if (!tenantId) return;
    setIsSaving(true);
    try {
      // 休日テキスト要約の自動生成
      const satSun = calendarSettings.fixed_holidays.includes(0) && calendarSettings.fixed_holidays.includes(6);
      const sunOnly = calendarSettings.fixed_holidays.includes(0) && !calendarSettings.fixed_holidays.includes(6);
      let holSummary = satSun ? '完全週休2日制（土日・祝日）' : sunOnly ? '週休制（日曜・祝日）' : '会社カレンダーによる指定休日';
      if (calendarSettings.winter_vacation_enabled) holSummary += '、年末年始休暇';
      if (calendarSettings.summer_vacation_enabled) holSummary += '、夏季休暇';
      holSummary += `（年間休日${calendarSettings.annual_holidays_count}日）`;

      const updatedCalendar = {
        ...calendarSettings,
        holiday_text_summary: holSummary
      };

      const { error } = await supabase
        .from('tenants')
        .update({
          name: basicInfo.name,
          address: basicInfo.address,
          representative_name: basicInfo.representative_name,
          phone_number: basicInfo.phone_number,
          corporate_number: basicInfo.corporate_number,
          work_calendar_settings: updatedCalendar,
          payroll_common_settings: payrollSettings,
          employment_rules_text: employmentRulesText,
          gemini_api_key: geminiApiKey,
          updated_at: new Date().toISOString()
        })
        .eq('id', tenantId);

      if (error) throw error;

      // ローカルストレージにもバックアップ保存（AI相談ボット等のオフラインキャッシュ用）
      localStorage.setItem(`company_employment_rules_${tenantId}`, employmentRulesText);
      localStorage.setItem('company_employment_rules', employmentRulesText);
      if (geminiApiKey) {
        localStorage.setItem(`gemini_api_key_${tenantId}`, geminiApiKey);
        localStorage.setItem('gemini_api_key_custom', geminiApiKey);
      }

      alert('🏛️ 全社共通マスタ設定を保存しました！\n「勤怠」「シフト」「給与」「入退社・契約書」の全システムに即座に反映されました。');
      await fetchData();
    } catch (err: any) {
      console.error(err);
      alert('保存に失敗しました: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 部署追加
  const handleAddDepartment = async () => {
    if (!tenantId || !newDeptName.trim()) return;
    try {
      await supabase.from('department_masters').insert({
        tenant_id: tenantId,
        name: newDeptName.trim(),
        display_order: departments.length + 1
      });
      setNewDeptName('');
      await fetchData();
    } catch (e) {
      alert('部署の追加に失敗しました。');
    }
  };

  // 部署削除
  const handleDeleteDepartment = async (id: string) => {
    if (!confirm('この部署を削除しますか？')) return;
    try {
      await supabase.from('department_masters').delete().eq('id', id);
      await fetchData();
    } catch (e) {
      alert('削除に失敗しました。');
    }
  };

  // 独自休日の追加
  const handleAddCustomHoliday = () => {
    if (!newCustomHolidayDate || !newCustomHolidayName.trim()) return;
    const updated = [...calendarSettings.custom_holidays, { date: newCustomHolidayDate, name: newCustomHolidayName.trim() }];
    setCalendarSettings({ ...calendarSettings, custom_holidays: updated });
    setNewCustomHolidayDate('');
    setNewCustomHolidayName('');
  };

  // 独自休日の削除
  const handleDeleteCustomHoliday = (index: number) => {
    const updated = calendarSettings.custom_holidays.filter((_, i) => i !== index);
    setCalendarSettings({ ...calendarSettings, custom_holidays: updated });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/portal')}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition flex items-center gap-1 text-xs font-bold cursor-pointer"
            title="ポータルに戻る"
          >
            <ArrowLeft className="w-4 h-4" />
            ポータル
          </button>
          <div className="h-4 w-px bg-slate-200" />
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-sm">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                会社・全社労務マスタ設定センター
                <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full border border-indigo-200">
                  全システム中央一元管理
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-bold">{basicInfo.name}</div>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleSaveAllSettings}
            disabled={isSaving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            設定を一括保存
          </button>
          <AppSwitcher currentApp="portal" role="admin" />
          <button
            onClick={async () => { await supabase.auth.signOut(); navigate('/'); }}
            className="p-2 rounded-full hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        
        {/* ガイドバナー */}
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 rounded-3xl p-6 text-white shadow-md shadow-indigo-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-200" />
              会社・全社労務マスタ 一元管理センター
            </h2>
            <p className="text-xs text-indigo-100 mt-1 leading-relaxed">
              ここで設定した会社情報、部署、年間休日カレンダー、締め日は、<strong>「勤怠」「シフト」「給与」「入退社・契約書」の全4システムへ100%自動連動</strong>されます。二重管理の心配はありません。
            </p>
          </div>
        </div>

        {/* タブナビゲーション */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('basic')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'basic' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <Building2 className="w-4 h-4" />
            1. 会社基本情報
          </button>

          <button
            onClick={() => setActiveTab('departments')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'departments' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            2. 配属部署マスタ
          </button>

          <button
            onClick={() => setActiveTab('calendar')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'calendar' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <Calendar className="w-4 h-4" />
            3. 年間休日・就業時間
          </button>

          <button
            onClick={() => setActiveTab('payroll')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'payroll' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            4. 給与締め日・労務規定
          </button>

          <button
            onClick={() => setActiveTab('rules')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'rules' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            5. 就業規則（AI連動）
          </button>
        </div>

        {/* 1. 会社基本情報 タブ */}
        {activeTab === 'basic' && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-5 animate-in fade-in duration-200">
            <div>
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                会社基本情報
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">労働条件通知書（雇用契約書）の甲欄、給与明細の発行元、各種労務帳票に自動印字されます。</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-600 block mb-1">企業名 / 屋号 <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  value={basicInfo.name}
                  onChange={e => setBasicInfo({ ...basicInfo, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold text-slate-800"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-600 block mb-1">本社所在地（住所） <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  value={basicInfo.address}
                  onChange={e => setBasicInfo({ ...basicInfo, address: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">代表者役職・氏名 <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  value={basicInfo.representative_name}
                  onChange={e => setBasicInfo({ ...basicInfo, representative_name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">代表電話番号</label>
                <input
                  type="text"
                  value={basicInfo.phone_number}
                  onChange={e => setBasicInfo({ ...basicInfo, phone_number: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold text-slate-800"
                />
              </div>
            </div>
          </div>
        )}

        {/* 2. 配属部署マスタ タブ */}
        {activeTab === 'departments' && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-5 animate-in fade-in duration-200">
            <div>
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                配属部署マスタ管理
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">会社の部署を登録すると、全従業員台帳・入社ウィザード・シフト管理の選択肢に自動反映されます。</p>
            </div>

            <div className="flex gap-2 max-w-xl">
              <input
                type="text"
                placeholder="新しい部署名（例: マーケティング部 / 調理部門）"
                value={newDeptName}
                onChange={e => setNewDeptName(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold"
              />
              <button
                onClick={handleAddDepartment}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> 部署を追加
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
              {departments.map((d, index) => (
                <div key={d.id} className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-black flex items-center justify-center">
                      {index + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-800">{d.name}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteDepartment(d.id)}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                    title="削除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. 年間休日・就業時間 タブ */}
        {activeTab === 'calendar' && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-6 animate-in fade-in duration-200">
            <div>
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-600" />
                年間休日カレンダー ＆ 所定労働時間設定
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">勤怠カレンダーの休日判定、シフト公休、雇用契約書の「休日条項」に100%連動します。</p>
            </div>

            {/* 所定労働時間 */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-600" />
                所定労働時間・休憩規定
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">標準始業時刻</label>
                  <input
                    type="time"
                    value={calendarSettings.standard_start_time}
                    onChange={e => setCalendarSettings({ ...calendarSettings, standard_start_time: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">標準終業時刻</label>
                  <input
                    type="time"
                    value={calendarSettings.standard_end_time}
                    onChange={e => setCalendarSettings({ ...calendarSettings, standard_end_time: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">休憩時間 (分)</label>
                  <input
                    type="number"
                    value={calendarSettings.standard_break_minutes}
                    onChange={e => setCalendarSettings({ ...calendarSettings, standard_break_minutes: parseInt(e.target.value, 10) || 60 })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                  />
                </div>
              </div>
            </div>

            {/* 固定休日・祝日 */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4 text-xs">
              <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-indigo-600" />
                会社休日の一括設定ルール
              </h4>

              <div>
                <span className="font-bold text-slate-700 block mb-2">固定休日（曜日）</span>
                <div className="flex flex-wrap gap-3">
                  {['日', '月', '火', '水', '木', '金', '土'].map((day, idx) => {
                    const isChecked = calendarSettings.fixed_holidays.includes(idx);
                    return (
                      <label key={day} className="flex items-center gap-1.5 cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-slate-200 font-bold">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            const next = isChecked
                              ? calendarSettings.fixed_holidays.filter(d => d !== idx)
                              : [...calendarSettings.fixed_holidays, idx];
                            setCalendarSettings({ ...calendarSettings, fixed_holidays: next });
                          }}
                          className="rounded text-indigo-600"
                        />
                        <span className={idx === 0 ? 'text-rose-600' : idx === 6 ? 'text-blue-600' : 'text-slate-700'}>{day}曜日</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={calendarSettings.national_holidays_enabled}
                    onChange={e => setCalendarSettings({ ...calendarSettings, national_holidays_enabled: e.target.checked })}
                    className="rounded text-indigo-600"
                  />
                  <span>国民の祝日をすべて休日に設定する（年間16日）</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 mb-1">
                      <input
                        type="checkbox"
                        checked={calendarSettings.winter_vacation_enabled}
                        onChange={e => setCalendarSettings({ ...calendarSettings, winter_vacation_enabled: e.target.checked })}
                        className="rounded text-indigo-600"
                      />
                      <span>年末年始休暇</span>
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="date"
                        value={calendarSettings.winter_vacation_start}
                        onChange={e => setCalendarSettings({ ...calendarSettings, winter_vacation_start: e.target.value })}
                        className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs"
                      />
                      <span>〜</span>
                      <input
                        type="date"
                        value={calendarSettings.winter_vacation_end}
                        onChange={e => setCalendarSettings({ ...calendarSettings, winter_vacation_end: e.target.value })}
                        className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs"
                      />
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 mb-1">
                      <input
                        type="checkbox"
                        checked={calendarSettings.summer_vacation_enabled}
                        onChange={e => setCalendarSettings({ ...calendarSettings, summer_vacation_enabled: e.target.checked })}
                        className="rounded text-indigo-600"
                      />
                      <span>夏季休暇（お盆休み）</span>
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="date"
                        value={calendarSettings.summer_vacation_start}
                        onChange={e => setCalendarSettings({ ...calendarSettings, summer_vacation_start: e.target.value })}
                        className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs"
                      />
                      <span>〜</span>
                      <input
                        type="date"
                        value={calendarSettings.summer_vacation_end}
                        onChange={e => setCalendarSettings({ ...calendarSettings, summer_vacation_end: e.target.value })}
                        className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 独自の休日（創立記念日等） */}
              <div className="space-y-3 pt-3 border-t border-slate-200">
                <span className="font-bold text-slate-700 block">独自の会社休日（創立記念日・特別休業等）</span>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="date"
                    value={newCustomHolidayDate}
                    onChange={e => setNewCustomHolidayDate(e.target.value)}
                    className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                  />
                  <input
                    type="text"
                    placeholder="休日の名称（例: 創立記念日）"
                    value={newCustomHolidayName}
                    onChange={e => setNewCustomHolidayName(e.target.value)}
                    className="flex-1 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                  />
                  <button
                    onClick={handleAddCustomHoliday}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> 追加
                  </button>
                </div>

                {calendarSettings.custom_holidays.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {calendarSettings.custom_holidays.map((h, i) => (
                      <div key={i} className="bg-white px-3 py-1 rounded-lg border border-slate-200 font-bold text-slate-700 flex items-center gap-2 shadow-xs text-xs">
                        <span>{h.date} : {h.name}</span>
                        <button onClick={() => handleDeleteCustomHoliday(i)} className="text-slate-400 hover:text-rose-600 cursor-pointer">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">年間総休日数の目安（日）</label>
                <input
                  type="number"
                  value={calendarSettings.annual_holidays_count}
                  onChange={e => setCalendarSettings({ ...calendarSettings, annual_holidays_count: parseInt(e.target.value, 10) || 120 })}
                  className="w-36 bg-white border border-slate-300 rounded-xl px-3 py-1.5 font-black text-indigo-700 text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {/* 4. 給与・労務規定 タブ */}
        {activeTab === 'payroll' && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-5 animate-in fade-in duration-200">
            <div>
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-indigo-600" />
                給与締め日 ＆ 割増賃金・社会保険設定
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">給与計算エンジンおよび労働条件通知書の賃金計算条項に即座に反映されます。</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-800">賃金締め日・支払日</h4>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">締め日</label>
                  <select
                    value={payrollSettings.closing_day}
                    onChange={e => setPayrollSettings({ ...payrollSettings, closing_day: parseInt(e.target.value, 10) })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                  >
                    <option value={31}>毎月末日</option>
                    <option value={20}>毎月20日</option>
                    <option value={25}>毎月25日</option>
                    <option value={15}>毎月15日</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">支給日</label>
                  <select
                    value={payrollSettings.payment_day}
                    onChange={e => setPayrollSettings({ ...payrollSettings, payment_day: parseInt(e.target.value, 10) })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                  >
                    <option value={25}>毎月25日（当月25日または翌月25日）</option>
                    <option value={10}>毎月10日（翌月10日）</option>
                    <option value={15}>毎月15日</option>
                    <option value={31}>毎月末日</option>
                  </select>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-800">法定割増賃金率</h4>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">時間外 (残業)</label>
                    <input
                      type="number"
                      step="0.05"
                      value={payrollSettings.overtime_rate}
                      onChange={e => setPayrollSettings({ ...payrollSettings, overtime_rate: parseFloat(e.target.value) || 1.25 })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-bold text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">深夜割増</label>
                    <input
                      type="number"
                      step="0.05"
                      value={payrollSettings.night_rate}
                      onChange={e => setPayrollSettings({ ...payrollSettings, night_rate: parseFloat(e.target.value) || 0.25 })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-bold text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">休日労働</label>
                    <input
                      type="number"
                      step="0.05"
                      value={payrollSettings.holiday_rate}
                      onChange={e => setPayrollSettings({ ...payrollSettings, holiday_rate: parseFloat(e.target.value) || 1.35 })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-bold text-center"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 5. 就業規則（AI連動） タブ */}
        {activeTab === 'rules' && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-5 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <Bot className="w-5 h-5 text-indigo-600" />
                  自社の就業規則・社内規定（AI相談ボット連動）
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">ここに登録された就業規則をもとに、全従業員のスマホAI相談ボットが自動回答します。</p>
              </div>
              <button
                onClick={() => {
                  if (confirm('標準モデル就業規則テンプレートを読み込みますか？')) {
                    setEmploymentRulesText(DEFAULT_EMPLOYMENT_RULES);
                  }
                }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3 py-1.5 rounded-xl border border-slate-200 flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                標準モデル就業規則を読込
              </button>
            </div>

            <textarea
              rows={16}
              value={employmentRulesText}
              onChange={e => setEmploymentRulesText(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-2xl p-4 font-mono text-xs leading-relaxed"
              placeholder="自社の就業規則テキストを入力してください..."
            />
          </div>
        )}

      </main>
    </div>
  );
}
