import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  ArrowLeft, LogOut, Sparkles, Building2, HelpCircle 
} from 'lucide-react';
import AppSwitcher from '../components/AppSwitcher';
import { PortalCommunityHub } from '../components/PortalCommunityHub';
import { DEFAULT_EMPLOYMENT_RULES } from '../lib/defaultRules';
import { fetchAnnouncements, type AnnouncementItem } from '../lib/announcements';

interface UserData {
  id: string;
  name: string;
  role: 'superadmin' | 'admin' | 'user';
  tenant_id: string;
}

export default function CommunitySupportDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [companyRulesText, setCompanyRulesText] = useState<string>(DEFAULT_EMPLOYMENT_RULES);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/');
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .select('id, name, role, tenant_id')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setUserData(data as UserData);

      // お知らせのロード
      if (data?.tenant_id) {
        const list = await fetchAnnouncements(data.tenant_id);
        setAnnouncements(list);

        // 就業規則テキストのロード
        const cachedRules = localStorage.getItem(`company_employment_rules_${data.tenant_id}`) || localStorage.getItem('company_employment_rules');
        if (cachedRules) {
          setCompanyRulesText(cachedRules);
        }

        const { data: tData } = await supabase
          .from('tenants')
          .select('employment_rules_text')
          .eq('id', data.tenant_id)
          .maybeSingle();

        if (tData?.employment_rules_text) {
          setCompanyRulesText(tData.employment_rules_text);
          localStorage.setItem(`company_employment_rules_${data.tenant_id}`, tData.employment_rules_text);
        }
      }
    } catch (err) {
      console.error(err);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  const role = userData?.role || 'user';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* グローバルヘッダー */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => navigate('/portal')}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition flex items-center gap-1.5 text-xs font-bold"
            title="ポータルへ戻る"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">ポータル</span>
          </button>

          <div className="h-5 w-px bg-slate-200" />

          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 rounded-xl shadow-sm text-white">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-slate-900 leading-none flex items-center gap-1.5">
                社内Q&A・相談 ＆ 改善目安箱
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-violet-500 to-indigo-600 text-white shadow-xs">
                  <Sparkles className="w-2.5 h-2.5" />
                  Gemini AI連動
                </span>
              </h1>
              <p className="text-[11px] text-slate-500 mt-0.5 hidden sm:block">
                就業規則・社内FAQの即時検索、AI自動相談、社員改善提案回収
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <AppSwitcher currentApp="support" role={role === 'superadmin' ? 'admin' : role} />

          <div className="hidden sm:flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200/80">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-slate-700">{userData?.name || '従業員'}</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white text-slate-500 border border-slate-200">
              {role === 'superadmin' ? '全社管理者' : role === 'admin' ? '管理者' : '従業員'}
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="p-2 sm:px-3 sm:py-1.5 text-xs font-bold text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition flex items-center gap-1.5 border border-transparent hover:border-red-100"
            title="ログアウト"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">ログアウト</span>
          </button>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* ナビゲーション案内カード */}
        <div className="mb-6 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 rounded-2xl p-5 text-white shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-300" />
              社内サポート ＆ コミュニケーションハブ
            </h2>
            <p className="text-xs text-violet-100 mt-1 leading-relaxed">
              会社の規定や手続きでわからないことはFAQやAIに質問できます。また、職場環境の改善アイデアやご意見は「改善目安箱」からいつでもお寄せください。
            </p>
          </div>
          {(role === 'admin' || role === 'superadmin') && (
            <button
              onClick={() => navigate('/settings/company')}
              className="shrink-0 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white text-xs font-bold px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 border border-white/30"
            >
              <Building2 className="w-3.5 h-3.5" />
              就業規則・お知らせの編集
            </button>
          )}
        </div>

        {/* コミュニティハブ本体 */}
        <PortalCommunityHub
          tenantId={userData?.tenant_id || ''}
          role={role}
          userName={userData?.name || 'ゲスト'}
          userId={userData?.id || ''}
          announcements={announcements}
          companyRulesText={companyRulesText}
        />
      </main>
    </div>
  );
}
