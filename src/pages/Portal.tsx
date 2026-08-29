import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Clock, CalendarDays, LayoutDashboard, ChevronRight, DollarSign, LogOut, UserCheck } from 'lucide-react';

type UserData = {
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
      setUserData(data as UserData);
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
      description: '入社・退職の書類作成、労働条件通知書（雇用契約書）の自動生成、全マスタ即時同期を行います。',
      icon: <UserCheck className="w-7 h-7 text-white drop-shadow-md" />,
      path: '/onboarding/admin',
      color: 'bg-gradient-to-br from-cyan-600 via-blue-600 to-indigo-700 shadow-md ring-1 ring-white/40',
      hoverColor: 'hover:border-cyan-300 hover:shadow-[0_15px_30px_-10px_rgba(6,182,212,0.3)]',
    }
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
          <h1 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 tracking-tight">
            KAP Base
          </h1>
        </div>
        
        <div className="flex items-center space-x-6">
          <div className="text-sm">
            <span className="text-gray-500 mr-2">ようこそ、</span>
            <span className="font-bold text-gray-800">{name}</span>
            <span className="text-gray-500 ml-1">さん</span>
            {role === 'admin' && (
              <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                管理者
              </span>
            )}
          </div>
          <div className="w-px h-6 bg-gray-200"></div>
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
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-12">
        <div className="mb-10 text-center animate-fade-in-up">
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-3">
            利用するアプリケーションを選択してください
          </h2>
          <p className="text-gray-500 text-lg">
            KAP Base へようこそ。以下のサービスが利用可能です。
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
          {apps.filter(app => {
            if (role === 'superadmin') return true;
            if (app.id === 'kintai') return userData?.has_kintai_access;
            if (app.id === 'shift') return userData?.has_shift_access;
            if (app.id === 'payroll') return userData?.has_kintai_access !== false;
            if (app.id === 'onboarding') return role === 'admin';
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
        
        {/* Info Board placeholder */}
        <div className="mt-16 bg-white rounded-2xl shadow-sm border border-gray-200 p-8 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
            <span className="w-2 h-6 bg-blue-500 rounded-full mr-3"></span>
            お知らせ
          </h3>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center py-3 border-b border-gray-100">
              <span className="text-sm font-bold text-blue-600 w-24 mb-1 sm:mb-0">2026.08.18</span>
              <span className="text-sm text-gray-700">KAP Base (総合ポータル) が新しくリリースされました。</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center py-3 border-b border-gray-100">
              <span className="text-sm font-bold text-blue-600 w-24 mb-1 sm:mb-0">2026.08.18</span>
              <span className="text-sm text-gray-700">シフト管理機能が大幅にアップデートされ、複数日の一括入力に対応しました。</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center py-3">
              <span className="text-sm font-bold text-gray-400 w-24 mb-1 sm:mb-0">2026.08.01</span>
              <span className="text-sm text-gray-500">システムのベータ運用を開始しました。</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
