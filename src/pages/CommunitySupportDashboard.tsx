import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  ArrowLeft, LogOut, HelpCircle, Bot 
} from 'lucide-react';
import AppSwitcher from '../components/AppSwitcher';
import { SystemSupportHub } from '../components/SystemSupportHub';

interface UserData {
  id: string;
  name: string;
  role: 'superadmin' | 'admin' | 'user';
  tenant_id: string;
  tenant_name?: string;
}

export default function CommunitySupportDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<UserData | null>(null);

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

      let tName = '自社';
      if (data?.tenant_id) {
        const { data: tData } = await supabase
          .from('tenants')
          .select('name')
          .eq('id', data.tenant_id)
          .maybeSingle();
        if (tData?.name) tName = tData.name;
      }

      setUserData({
        ...(data as any),
        tenant_name: tName
      });
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
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition flex items-center gap-1.5 text-xs font-bold cursor-pointer"
            title="ポータルへ戻る"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">ポータル</span>
          </button>

          <div className="h-5 w-px bg-slate-200" />

          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-indigo-600 via-purple-600 to-violet-700 rounded-xl shadow-sm text-white">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-slate-900 leading-none flex items-center gap-2">
                システム公式操作ガイド ＆ 改善要望窓口
              </h1>
              <p className="text-[11px] text-slate-500 mt-1 hidden sm:block">
                KAP勤怠・シフトシステムの公式操作マニュアル、システム機能改善リクエスト受付
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <AppSwitcher currentApp="support" role={role === 'superadmin' ? 'admin' : role} />

          <div className="hidden sm:flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200/80">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-slate-700">{userData?.name || 'ユーザー'}</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white text-slate-500 border border-slate-200">
              {role === 'superadmin' ? '全社管理者' : role === 'admin' ? '管理者' : '従業員'}
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="p-2 sm:px-3 sm:py-1.5 text-xs font-bold text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition flex items-center gap-1.5 border border-transparent hover:border-red-100 cursor-pointer"
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
        <div className="mb-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl border border-indigo-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/30 text-indigo-300 border border-indigo-400/30 mb-1.5">
              <Bot className="w-3 h-3 text-indigo-300" />
              <span>AI自動即答サポート ＆ サービス改善窓口</span>
            </div>
            <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
              システム公式操作Q&A ＆ 改善要望受付ボックス
            </h2>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed max-w-2xl">
              打刻やシフト申請など、本システムの操作手順は初心者向け公式ガイドでいつでも確認できます。
              また、「こんな機能を追加してほしい」「ここをもっと改善してほしい」というご意見・機能リクエストは、
              <strong>「改善要望フォーム」</strong>からいつでも開発元へ直接お寄せいただけます。
            </p>
          </div>
        </div>

        {/* システムサポートハブ本体 */}
        <SystemSupportHub
          tenantId={userData?.tenant_id || ''}
          tenantName={userData?.tenant_name || '自社'}
          role={role}
          userName={userData?.name || 'ゲスト'}
          userId={userData?.id || ''}
        />
      </main>
    </div>
  );
}
