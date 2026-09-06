import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Clock, CalendarDays, LayoutDashboard, ChevronRight, DollarSign, LogOut, UserCheck, Building2, Sparkles } from 'lucide-react';
import { fetchAnnouncements, type AnnouncementItem } from '../lib/announcements';
import { fetchRevisionContracts, type RevisionContractDoc } from '../lib/revisionContracts';
import { PortalCommunityHub } from '../components/PortalCommunityHub';
import { DEFAULT_EMPLOYMENT_RULES } from '../lib/defaultRules';

type UserData = {
  id: string;
  name: string;
  role: 'superadmin' | 'admin' | 'user';
  tenant_id: string;
  has_kintai_access: boolean;
  has_shift_access: boolean;
};

export default function Portal() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [pendingContractDoc, setPendingContractDoc] = useState<RevisionContractDoc | null>(null);
  const [companyRulesText, setCompanyRulesText] = useState<string>(DEFAULT_EMPLOYMENT_RULES);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/');
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .select('name, role, tenant_id, has_kintai_access, has_shift_access')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      const fullUserData: UserData = {
        id: user.id,
        name: data.name,
        role: data.role,
        tenant_id: data.tenant_id,
        has_kintai_access: data.has_kintai_access,
        has_shift_access: data.has_shift_access,
      };
      setUserData(fullUserData);

      // お知らせ一覧のロード（DB自動同期）
      const list = await fetchAnnouncements(data?.tenant_id);
      setAnnouncements(list);

      // 📄 未押印の労働条件通知書チェック（DB自動同期）
      if (data?.tenant_id) {
        const contracts = await fetchRevisionContracts(data.tenant_id);
        const pending = contracts.find(c => (c.user_id === user.id || c.user_name === data.name) && c.status === 'pending_signature');
        setPendingContractDoc(pending || null);

        // 📘 就業規則の読み込み（LocalStorageキャッシュ または tenantsテーブル）
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
      <div className="min-h-screen bg-gray-50 flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  const role = userData?.role || 'user';
  const name = userData?.name || 'ゲスト';

  const apps = [
    {
      id: 'kintai',
      title: '勤怠・有給管理',
      description: '日々の打刻、労働時間の集計、有給休暇の申請・承認を行います。',
      icon: <Clock className="w-7 h-7 text-white drop-shadow-md" />,
      path: (role === 'admin' || role === 'superadmin') ? '/kintai/admin' : '/kintai/user',
      color: 'bg-gradient-to-br from-blue-500 via-blue-400 to-cyan-400 shadow-md ring-1 ring-white/40',
      hoverColor: 'hover:border-blue-300 hover:shadow-[0_15px_30px_-10px_rgba(59,130,246,0.3)]',
    },
    {
      id: 'shift',
      title: 'シフト管理',
      description: 'シフトの作成、パターンの設定、自分のシフトの確認を行います。',
      icon: <CalendarDays className="w-7 h-7 text-white drop-shadow-md" />,
      path: (role === 'admin' || role === 'superadmin') ? '/shift/admin' : '/shift/user',
      color: 'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-md ring-1 ring-white/40',
      hoverColor: 'hover:border-indigo-300 hover:shadow-[0_15px_30px_-10px_rgba(99,102,241,0.3)]',
    },
    {
      id: 'payroll',
      title: '給与計算・明細',
      description: '勤怠打刻から給与を自動試算、割増手当・社保・税金控除、Web明細の発行を行います。',
      icon: <DollarSign className="w-7 h-7 text-white drop-shadow-md" />,
      path: (role === 'admin' || role === 'superadmin') ? '/payroll/admin' : '/payroll/user',
      color: 'bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 shadow-md ring-1 ring-white/40',
      hoverColor: 'hover:border-emerald-300 hover:shadow-[0_15px_30px_-10px_rgba(16,185,129,0.3)]',
    },
    {
      id: 'onboarding',
      title: '入退社・労務手続き',
      description: (role === 'admin' || role === 'superadmin') 
        ? '入社・退職の書類作成、労働条件通知書（雇用契約書）の自動生成、全マスタ即時同期を行います。'
        : '給与振込口座・通帳写真、通勤費、マイナンバー、扶養控除申告書の提出を行います。',
      icon: <UserCheck className="w-7 h-7 text-white drop-shadow-md" />,
      path: (role === 'admin' || role === 'superadmin') ? '/onboarding/admin' : '/onboarding/my',
      color: 'bg-gradient-to-br from-cyan-600 via-blue-600 to-indigo-700 shadow-md ring-1 ring-white/40',
      hoverColor: 'hover:border-cyan-300 hover:shadow-[0_15px_30px_-10px_rgba(6,182,212,0.3)]',
    },
    ...(role === 'admin' || role === 'superadmin' ? [{
      id: 'settings',
      title: '会社・全社マスタ設定',
      description: '企業基本情報、配属部署、年間休日カレンダー、就業時間、給与締め日、就業規則（AI連動）を一元管理します。',
      icon: <Building2 className="w-7 h-7 text-white drop-shadow-md" />,
      path: '/settings/company',
      color: 'bg-gradient-to-br from-indigo-600 via-purple-600 to-slate-800 shadow-md ring-1 ring-white/40',
      hoverColor: 'hover:border-purple-300 hover:shadow-[0_15px_30px_-10px_rgba(147,51,234,0.3)]',
    }] : [])
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="relative flex items-center justify-center p-2.5 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 shadow-md ring-1 ring-white/30 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-white/40 to-transparent opacity-60"></div>
            <LayoutDashboard className="w-6 h-6 text-white relative z-10 drop-shadow-md" />
          </div>
          <div>
            <h1 className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 tracking-tight">
              KAP Base
            </h1>
            <p className="text-xs text-gray-500 font-medium">統合ポータルダッシュボード</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {(role === 'admin' || role === 'superadmin') && (
            <button
              onClick={() => navigate('/settings/company')}
              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs px-3.5 py-2 rounded-xl transition border border-indigo-200 flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Building2 className="w-4 h-4" />
              会社・全社マスタ設定
            </button>
          )}

          <div className="hidden sm:flex items-center space-x-2 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
            <span className="text-xs text-gray-500 font-medium">ログイン中:</span>
            <span className="text-xs font-bold text-gray-700">{name}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
              role === 'superadmin' ? 'bg-purple-100 text-purple-700' :
              role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
            }`}>
              {role === 'superadmin' ? '総管理者' : role === 'admin' ? '管理者' : '従業員'}
            </span>
          </div>

          <button 
            onClick={handleLogout}
            className="flex items-center text-sm font-medium text-gray-500 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4 mr-1.5" />
            ログアウト
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-8 sm:py-12 space-y-8">
        
        {/* 🔔 労働条件通知書（賃金改定版）電子押印依頼バナー */}
        {pendingContractDoc && (
          <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white p-5 rounded-3xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-2 border-amber-300">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl shrink-0">
                🔔
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-base tracking-tight">
                    【重要】給与改定に伴う『労働条件通知書』が届いています
                  </h3>
                  <span className="bg-white text-orange-700 text-[10px] font-black px-2 py-0.5 rounded-full shadow-2xs">
                    電子押印待ち
                  </span>
                </div>
                <p className="text-xs text-amber-100 mt-0.5">
                  {pendingContractDoc.applied_year_month}分給与改定（新基本給: ¥{pendingContractDoc.base_salary.toLocaleString()}）の内容をご確認の上、電子同意・押印を行ってください。
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/payroll/user')}
              className="px-5 py-2.5 bg-white text-orange-700 hover:bg-orange-50 rounded-2xl font-black text-xs transition shadow-md cursor-pointer shrink-0 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-orange-600" />
              Web給与明細で確認・押印する
            </button>
          </div>
        )}

        <div className="mb-10 text-center animate-fade-in-up">
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-3">
            利用するアプリケーションを選択してください
          </h2>
          <p className="text-gray-500 text-lg">
            KAP Base へようこそ。以下のサービスが利用可能です。
          </p>
        </div>

        <div className={`grid gap-6 ${role === 'admin' || role === 'superadmin' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 max-w-4xl mx-auto'}`}>
          {apps.filter(app => {
            if (role === 'superadmin') return true;
            if (role === 'admin') {
              if (app.id === 'kintai') return true;
              if (app.id === 'shift') return true;
              if (app.id === 'payroll') return true;
              if (app.id === 'onboarding') return true;
              if (app.id === 'settings') return true;
              return false;
            }
            // 従業員が利用できるものは「勤怠・有給管理」「シフト管理」のみ
            if (app.id === 'kintai') return userData?.has_kintai_access !== false;
            if (app.id === 'shift') return userData?.has_shift_access !== false;
            return false;
          }).map((app, index) => (
            <button
              key={app.id}
              onClick={() => navigate(app.path)}
              className={`
                group text-left bg-white/80 backdrop-blur-md rounded-2xl p-8 border border-transparent shadow-sm 
                transition-all duration-300 ease-out transform hover:-translate-y-1 hover:bg-white
                flex flex-col h-full animate-fade-in-up ${app.hoverColor}
              `}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-start justify-between w-full mb-6">
                <div className={`relative p-4 rounded-2xl flex items-center justify-center overflow-hidden transition-transform duration-300 group-hover:scale-105 ${app.color}`}>
                  <div className="absolute inset-0 bg-white/20 mix-blend-overlay"></div>
                  <div className="relative z-10">{app.icon}</div>
                </div>
                <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-blue-50 group-hover:scale-110 transition-all duration-300 shadow-sm border border-gray-100 group-hover:border-blue-100">
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                </div>
              </div>
              
              <h3 className="text-2xl font-bold text-gray-800 mb-3 group-hover:text-blue-700 transition-colors">
                {app.title}
              </h3>
              
              <p className="text-gray-500 leading-relaxed flex-1">
                {app.description}
              </p>
            </button>
          ))}
        </div>
        
        {/* 📢 社内ポータル コミュニティ＆サポートハブ（お知らせ・社内Q&A/AI相談・改善目安箱） */}
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
