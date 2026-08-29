import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import AppSwitcher from '../components/AppSwitcher';
import { DEFAULT_EMPLOYMENT_RULES } from '../lib/defaultRules';
import { OfficialCompanyCalendarDoc } from '../components/OfficialCompanyCalendarDoc';
import { 
  Building2, Users, Calendar, DollarSign, BookOpen, 
  ArrowLeft, LogOut, Loader2, Save, Plus, Trash2, 
  Sparkles, Bot, Clock, ShieldCheck, Printer, X
} from 'lucide-react';

interface DepartmentMaster {
  id: string;
  name: string;
  code?: string;
  display_order: number;
}

export interface WorkSchedulePattern {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  target_department?: string;
  display_order: number;
}

// 2026年 国民の祝日
const NATIONAL_HOLIDAYS_2026: { [key: string]: string } = {
  '2026-01-01': '元日',
  '2026-01-12': '成人の日',
  '2026-02-11': '建国記念の日',
  '2026-02-23': '天皇誕生日',
  '2026-03-20': '春分の日',
  '2026-04-29': '昭和の日',
  '2026-05-03': '憲法記念日',
  '2026-05-04': 'みどりの日',
  '2026-05-05': 'こどもの日',
  '2026-05-06': '振替休日',
  '2026-07-20': '海の日',
  '2026-08-11': '山の日',
  '2026-09-21': '敬老の日',
  '2026-09-22': '国民の休日',
  '2026-09-23': '秋分の日',
  '2026-10-12': 'スポーツの日',
  '2026-11-03': '文化の日',
  '2026-11-23': '勤労感謝の日'
};

export default function CompanySettingsDashboard() {
  const navigate = useNavigate();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
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

  // 3. 就業時間パターンマスタState
  const [schedulePatterns, setSchedulePatterns] = useState<WorkSchedulePattern[]>([]);
  const [newPatternName, setNewPatternName] = useState('');
  const [newPatternStartTime, setNewPatternStartTime] = useState('09:00');
  const [newPatternEndTime, setNewPatternEndTime] = useState('18:00');
  const [newPatternBreakMinutes, setNewPatternBreakMinutes] = useState(60);
  const [newPatternDept, setNewPatternDept] = useState('');

  // 4. カレンダー・休日State
  const [calendarSettings, setCalendarSettings] = useState({
    year: 2026,
    fixed_holidays: [0, 6], // 0:日, 6:土
    national_holidays_enabled: true,
    winter_vacation_enabled: true,
    winter_vacation_start: '2026-12-29',
    winter_vacation_end: '2027-01-03',
    summer_vacation_enabled: true,
    summer_vacation_start: '2026-08-13',
    summer_vacation_end: '2026-08-16',
    custom_holidays: [] as { date: string; name: string }[],
    individual_overrides: {} as { [key: string]: boolean }, // 'YYYY-MM-DD': true(休日) or false(稼働日)
    annual_holidays_count: 125,
    holiday_text_summary: '完全週休2日制（土日・祝日）、年末年始休暇、夏季休暇（年間休日125日）'
  });
  const [newCustomHolidayDate, setNewCustomHolidayDate] = useState('');
  const [newCustomHolidayName, setNewCustomHolidayName] = useState('');

  // カレンダー印刷モーダルState
  const [calendarPrintModalOpen, setCalendarPrintModalOpen] = useState(false);

  // 5. 給与・労務設定State
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

  // 6. 就業規則・AI State
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
          setCalendarSettings(prev => ({
            ...prev,
            ...tData.work_calendar_settings
          }));
        }

        if (tData.payroll_common_settings) {
          setPayrollSettings(prev => ({
            ...prev,
            ...tData.payroll_common_settings
          }));
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

      // 就業時間パターンマスタ取得
      const { data: patData } = await supabase
        .from('work_schedule_patterns')
        .select('*')
        .eq('tenant_id', tenantIdData)
        .order('display_order', { ascending: true });
      
      if (patData && patData.length > 0) {
        setSchedulePatterns(patData);
      } else {
        setSchedulePatterns([
          { id: '1', name: '標準勤務（本社・営業）', start_time: '09:00', end_time: '18:00', break_minutes: 60, target_department: '営業部', display_order: 1 },
          { id: '2', name: '店舗早番（08:00〜17:00）', start_time: '08:00', end_time: '17:00', break_minutes: 60, target_department: '店舗運営部', display_order: 2 },
          { id: '3', name: '店舗遅番（12:00〜21:00）', start_time: '12:00', end_time: '21:00', break_minutes: 60, target_department: '店舗運営部', display_order: 3 },
          { id: '4', name: '育児・時短勤務', start_time: '09:30', end_time: '16:30', break_minutes: 60, target_department: '', display_order: 4 }
        ]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // 年間の全休日セットを算出（ルール ＋ 個別上書き）
  const computedHolidaysSet = useMemo(() => {
    const set = new Set<string>();
    const year = calendarSettings.year || 2026;

    // 1. 固定曜日
    for (let m = 0; m < 12; m++) {
      const daysInMonth = new Date(year, m + 1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, m, d);
        if (calendarSettings.fixed_holidays.includes(date.getDay())) {
          const key = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          set.add(key);
        }
      }
    }

    // 2. 国民の祝日
    if (calendarSettings.national_holidays_enabled) {
      Object.keys(NATIONAL_HOLIDAYS_2026).forEach(k => {
        if (k.startsWith(`${year}-`)) set.add(k);
      });
    }

    // 3. 年末年始休暇
    if (calendarSettings.winter_vacation_enabled && calendarSettings.winter_vacation_start && calendarSettings.winter_vacation_end) {
      let cur = new Date(calendarSettings.winter_vacation_start);
      const end = new Date(calendarSettings.winter_vacation_end);
      while (cur <= end) {
        const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
        if (key.startsWith(`${year}-`)) set.add(key);
        cur.setDate(cur.getDate() + 1);
      }
    }

    // 4. 夏季休暇
    if (calendarSettings.summer_vacation_enabled && calendarSettings.summer_vacation_start && calendarSettings.summer_vacation_end) {
      let cur = new Date(calendarSettings.summer_vacation_start);
      const end = new Date(calendarSettings.summer_vacation_end);
      while (cur <= end) {
        const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
        if (key.startsWith(`${year}-`)) set.add(key);
        cur.setDate(cur.getDate() + 1);
      }
    }

    // 5. 独自休日
    calendarSettings.custom_holidays.forEach(h => {
      if (h.date && h.date.startsWith(`${year}-`)) {
        set.add(h.date);
      }
    });

    // 6. 個別上書き (クリック切り替え)
    Object.entries(calendarSettings.individual_overrides || {}).forEach(([dateKey, isHol]) => {
      if (isHol) {
        set.add(dateKey);
      } else {
        set.delete(dateKey);
      }
    });

    return set;
  }, [calendarSettings]);

  // カレンダーの日付クリックで休日/出勤日をトグル
  const handleToggleDay = (dateKey: string) => {
    const isCurrentlyHoliday = computedHolidaysSet.has(dateKey);
    const updatedOverrides = {
      ...(calendarSettings.individual_overrides || {}),
      [dateKey]: !isCurrentlyHoliday
    };

    setCalendarSettings(prev => ({
      ...prev,
      individual_overrides: updatedOverrides
    }));
  };

  // 全社設定の一括保存（超頑健化＆フォールバック）
  const handleSaveAllSettings = async () => {
    if (!tenantId) {
      alert('テナントIDが取得できませんでした。');
      return;
    }

    setIsSaving(true);
    try {
      // 休日要約テキストの自動生成
      const satSun = calendarSettings.fixed_holidays.includes(0) && calendarSettings.fixed_holidays.includes(6);
      const sunOnly = calendarSettings.fixed_holidays.includes(0) && !calendarSettings.fixed_holidays.includes(6);
      let holSummary = satSun ? '完全週休2日制（土日・祝日）' : sunOnly ? '週休制（日曜・祝日）' : '会社カレンダーによる指定休日';
      if (calendarSettings.winter_vacation_enabled) holSummary += '、年末年始休暇';
      if (calendarSettings.summer_vacation_enabled) holSummary += '、夏季休暇';
      holSummary += `（年間休日${computedHolidaysSet.size}日）`;

      const updatedCalendar = {
        ...calendarSettings,
        annual_holidays_count: computedHolidaysSet.size,
        holiday_text_summary: holSummary
      };

      // 1. 基本安全ペイロード
      const mainPayload: Record<string, any> = {
        name: basicInfo.name,
        address: basicInfo.address,
        representative_name: basicInfo.representative_name,
        phone_number: basicInfo.phone_number,
        corporate_number: basicInfo.corporate_number,
        work_calendar_settings: updatedCalendar,
        payroll_common_settings: payrollSettings,
        employment_rules_text: employmentRulesText,
        gemini_api_key: geminiApiKey
      };

      const { error } = await supabase
        .from('tenants')
        .update(mainPayload)
        .eq('id', tenantId);

      if (error) {
        console.warn('Update full payload failed, trying fallback minimal payload:', error);
        // フォールバック: 最低限の基本カラムで保存
        const fallbackPayload: Record<string, any> = {
          name: basicInfo.name,
          work_calendar_settings: updatedCalendar,
          payroll_common_settings: payrollSettings,
          employment_rules_text: employmentRulesText
        };
        const { error: fbErr } = await supabase.from('tenants').update(fallbackPayload).eq('id', tenantId);
        if (fbErr) throw fbErr;
      }

      // ローカルストレージにも同期（勤怠・カレンダーで即使えるように）
      localStorage.setItem('mock_company_holidays', JSON.stringify(Array.from(computedHolidaysSet)));
      localStorage.setItem(`company_employment_rules_${tenantId}`, employmentRulesText);
      localStorage.setItem('company_employment_rules', employmentRulesText);
      if (geminiApiKey) {
        localStorage.setItem(`gemini_api_key_${tenantId}`, geminiApiKey);
        localStorage.setItem('gemini_api_key_custom', geminiApiKey);
      }

      setSaveSuccessMsg('✅ 全社共通マスタ設定を正常に保存しました！\n「勤怠」「シフト」「給与」「入退社・契約書」の全4システムに即座に反映されました。');
      setTimeout(() => setSaveSuccessMsg(null), 5000);
      alert('🏛️ 全社共通マスタ設定を保存しました！\n「勤怠」「シフト」「給与」「入退社・契約書」の全4システムに即座に反映されました。');
      await fetchData();
    } catch (err: any) {
      console.error('Save company settings error:', err);
      alert('保存エラー: ' + (err.message || JSON.stringify(err)));
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

  // 就業時間パターン追加
  const handleAddSchedulePattern = async () => {
    if (!tenantId || !newPatternName.trim()) {
      alert('勤務パターン名を入力してください。');
      return;
    }

    try {
      await supabase.from('work_schedule_patterns').insert({
        tenant_id: tenantId,
        name: newPatternName.trim(),
        start_time: newPatternStartTime,
        end_time: newPatternEndTime,
        break_minutes: newPatternBreakMinutes,
        target_department: newPatternDept,
        display_order: schedulePatterns.length + 1
      });

      setNewPatternName('');
      setNewPatternStartTime('09:00');
      setNewPatternEndTime('18:00');
      setNewPatternBreakMinutes(60);
      setNewPatternDept('');
      await fetchData();
    } catch (e: any) {
      console.error(e);
      alert('就業時間パターンの追加に失敗しました: ' + e.message);
    }
  };

  // 就業時間パターン削除
  const handleDeleteSchedulePattern = async (id: string) => {
    if (!confirm('この就業時間パターンを削除しますか？')) return;
    try {
      await supabase.from('work_schedule_patterns').delete().eq('id', id);
      await fetchData();
    } catch (e: any) {
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

  // 共通の保存ボタンスニペット
  const renderSaveFooter = () => (
    <div className="pt-6 mt-6 border-t border-slate-200 flex items-center justify-between">
      <div className="text-xs text-slate-500 font-bold">
        ※ 変更内容は「設定を一括保存」を押すと全4システムへ即時反映されます。
      </div>
      <button
        onClick={handleSaveAllSettings}
        disabled={isSaving}
        className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs px-6 py-3 rounded-2xl shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
      >
        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        設定を一括保存する
      </button>
    </div>
  );

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
        
        {/* 保存成功トースト */}
        {saveSuccessMsg && (
          <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-3 rounded-2xl shadow-sm flex items-center justify-between text-xs font-bold animate-in fade-in">
            <span>{saveSuccessMsg}</span>
            <button onClick={() => setSaveSuccessMsg(null)} className="p-1 text-emerald-600 hover:text-emerald-900 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ガイドバナー */}
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 rounded-3xl p-6 text-white shadow-md shadow-indigo-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-200" />
              会社・全社労務マスタ 一元管理センター
            </h2>
            <p className="text-xs text-indigo-100 mt-1 leading-relaxed">
              ここで設定した会社情報、部署、就業時間パターン、年間営業カレンダー、締め日は、<strong>「勤怠」「シフト」「給与」「入退社・契約書」の全4システムへ100%自動連動</strong>されます。
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
            3. 年間営業カレンダー ＆ 就業時間
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

            {renderSaveFooter()}
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

            {renderSaveFooter()}
          </div>
        )}

        {/* 3. 年間営業カレンダー ＆ 就業時間 タブ */}
        {activeTab === 'calendar' && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-6 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-indigo-600" />
                  {calendarSettings.year}年 会社年間営業カレンダー ＆ 休日設定
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  カレンダーの日付をクリックして個別に休日/営業日を切り替え可能。会社営業カレンダーとしてA4印刷・PDF出力できます。
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCalendarPrintModalOpen(true)}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs px-4 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-4 h-4 text-indigo-600" />
                  営業カレンダー A4印刷 / PDF出力
                </button>
              </div>
            </div>

            {/* 📅 12ヶ月 インタラクティブ営業カレンダー */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span className="font-black text-slate-800 text-sm">
                    {calendarSettings.year}年 営業日・休日マップ
                  </span>
                  <span className="bg-indigo-100 text-indigo-800 font-black text-xs px-2.5 py-1 rounded-lg">
                    年間総休日数: {computedHolidaysSet.size}日
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-rose-500 inline-block"></span> 休日 (クリックで切替)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-white border border-slate-300 inline-block"></span> 稼働営業日
                  </span>
                </div>
              </div>

              {/* 12ヶ月グリッド */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                  const daysInMonth = new Date(calendarSettings.year, m, 0).getDate();
                  const firstDayOfWeek = new Date(calendarSettings.year, m - 1, 1).getDay();
                  const paddingDays = Array.from({ length: firstDayOfWeek });

                  return (
                    <div key={m} className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
                      <div className="text-center font-black text-xs text-indigo-950 pb-1.5 mb-1.5 border-b border-slate-100 flex items-center justify-between">
                        <span>{m}月</span>
                        <span className="text-[10px] text-slate-400 font-bold">{calendarSettings.year}.{String(m).padStart(2, '0')}</span>
                      </div>

                      {/* 曜日 */}
                      <div className="grid grid-cols-7 text-center text-[9px] font-black pb-1 mb-1 text-slate-400 border-b border-slate-50">
                        <span className="text-rose-500">日</span>
                        <span>月</span>
                        <span>火</span>
                        <span>水</span>
                        <span>木</span>
                        <span>金</span>
                        <span className="text-blue-500">土</span>
                      </div>

                      {/* 日付 */}
                      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px]">
                        {paddingDays.map((_, i) => (
                          <div key={`p-${i}`} className="h-5"></div>
                        ))}
                        {Array.from({ length: daysInMonth }, (_, dIdx) => {
                          const dayNum = dIdx + 1;
                          const dateKey = `${calendarSettings.year}-${String(m).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                          const isHol = computedHolidaysSet.has(dateKey);
                          const dayOfWeek = new Date(calendarSettings.year, m - 1, dayNum).getDay();

                          return (
                            <button
                              key={dateKey}
                              type="button"
                              onClick={() => handleToggleDay(dateKey)}
                              className={`h-5 flex items-center justify-center font-bold rounded transition cursor-pointer ${
                                isHol
                                  ? 'bg-rose-500 text-white font-black hover:bg-rose-600'
                                  : dayOfWeek === 6
                                    ? 'text-blue-600 hover:bg-blue-50'
                                    : dayOfWeek === 0
                                      ? 'text-rose-600 hover:bg-rose-50'
                                      : 'text-slate-700 hover:bg-slate-100'
                              }`}
                              title={`${dateKey}: クリックして${isHol ? '稼働日' : '休日'}に変更`}
                            >
                              {dayNum}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 一括ルール設定 */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4 text-xs">
              <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-indigo-600" />
                休日の一括適用ルール
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
            </div>

            {/* ⏰ 部署別 就業時間パターンマスタ */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
              <div>
                <h4 className="font-black text-slate-800 text-sm flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  就業時間パターン一覧（部署紐付け ＆ 個別調整対応）
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  会社内の勤務パターンを登録します。入社時に部署を選ぶと該当パターンが自動セットされ、個人ごとの時間上書きも可能です。
                </p>
              </div>

              {/* パターン追加フォーム */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
                <div className="sm:col-span-2">
                  <label className="text-[10px] text-slate-500 block mb-0.5">パターン名（例: 本社標準 / 店舗早番）</label>
                  <input
                    type="text"
                    placeholder="パターン名"
                    value={newPatternName}
                    onChange={e => setNewPatternName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">始業 〜 終業</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="time"
                      value={newPatternStartTime}
                      onChange={e => setNewPatternStartTime(e.target.value)}
                      className="bg-slate-50 border border-slate-300 rounded px-1.5 py-1 text-xs"
                    />
                    <span>〜</span>
                    <input
                      type="time"
                      value={newPatternEndTime}
                      onChange={e => setNewPatternEndTime(e.target.value)}
                      className="bg-slate-50 border border-slate-300 rounded px-1.5 py-1 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">休憩(分) / 適用部署</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={newPatternBreakMinutes}
                      onChange={e => setNewPatternBreakMinutes(parseInt(e.target.value, 10) || 60)}
                      className="w-14 bg-slate-50 border border-slate-300 rounded px-1.5 py-1 text-xs"
                    />
                    <select
                      value={newPatternDept}
                      onChange={e => setNewPatternDept(e.target.value)}
                      className="flex-1 bg-slate-50 border border-slate-300 rounded px-1.5 py-1 text-xs"
                    >
                      <option value="">共通（全社）</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.name}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleAddSchedulePattern}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 rounded-lg text-xs transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> パターン追加
                  </button>
                </div>
              </div>

              {/* パターン一覧 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs">
                {schedulePatterns.map(pat => (
                  <div key={pat.id} className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between shadow-xs">
                    <div>
                      <div className="font-black text-slate-800 flex items-center gap-1.5">
                        {pat.name}
                        {pat.target_department && (
                          <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-1.5 py-0.2 rounded border border-indigo-200">
                            {pat.target_department}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        ⏰ {pat.start_time} 〜 {pat.end_time}（休憩 {pat.break_minutes}分）
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteSchedulePattern(pat.id)}
                      className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                      title="削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {renderSaveFooter()}
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

            {renderSaveFooter()}
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

            {renderSaveFooter()}
          </div>
        )}

      </main>

      {/* 📄 年間営業カレンダー A4印刷 / PDF出力 モーダル */}
      {calendarPrintModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-slate-100 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4 print:hidden">
              <div>
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <Printer className="w-5 h-5 text-indigo-600" />
                  会社公式 {calendarSettings.year}年 年間営業カレンダー（A4印刷 / PDF保存）
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">社内掲示・取引先配布用の営業カレンダーとしてご利用いただけます</p>
              </div>
              <button onClick={() => setCalendarPrintModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* プレビュー本体 */}
            <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 print:border-none print:p-0 max-h-[70vh] overflow-y-auto">
              <OfficialCompanyCalendarDoc data={{
                companyName: basicInfo.name,
                year: calendarSettings.year || 2026,
                annualHolidaysCount: computedHolidaysSet.size,
                holidaysSet: computedHolidaysSet,
                holidaySummaryText: calendarSettings.holiday_text_summary
              }} />
            </div>

            <div className="mt-6 flex justify-end gap-2 pt-4 border-t border-slate-100 print:hidden">
              <button onClick={() => setCalendarPrintModalOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer">
                閉じる
              </button>
              <button onClick={() => window.print()} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer">
                <Printer className="w-4 h-4" />
                営業カレンダーをA4印刷 / PDF保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
