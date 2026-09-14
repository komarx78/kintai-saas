import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { PayslipManagement } from '../components/PayslipManagement';
import { SalaryLedgerDashboard } from '../components/SalaryLedgerDashboard';
import { OfficialReportsCenter } from '../components/OfficialReportsCenter';
import { BonusManagement } from '../components/BonusManagement';
import AppSwitcher from '../components/AppSwitcher';
import { HelpGuideModal } from '../components/HelpGuideModal';
import { DollarSign, ArrowLeft, LogOut, TrendingUp, FileText, Gift } from 'lucide-react';

export default function PayrollAdminDashboard() {
  const navigate = useNavigate();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'payslip' | 'ledger' | 'reports' | 'bonus'>('ledger');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/');
        return;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('role, tenant_id, name')
        .eq('id', user.id)
        .single();

      if (userData?.tenant_id) {
        setTenantId(userData.tenant_id);
        const { data: tData } = await supabase
          .from('tenants')
          .select('name')
          .eq('id', userData.tenant_id)
          .maybeSingle();
        if (tData) setTenantName(tData.name);
      }
    } catch (e) {
      console.error(e);
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

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans overflow-x-auto print:overflow-visible print:min-w-0 print:w-full print:bg-white print:h-auto">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-xs min-w-[1024px] print:hidden">
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
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-sm">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                クラウド給与計算システム
                <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                  管理画面
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-bold">{tenantName || '株式会社KAP'}</div>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsHelpOpen(true)}
            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3.5 py-1.5 rounded-xl flex items-center space-x-1.5 transition font-bold text-xs shadow-xs cursor-pointer"
            title="給与計算の流れ・勤怠連動の仕組みを見る"
          >
            <span className="text-sm">❓</span>
            <span>使い方ガイド</span>
          </button>
          <AppSwitcher currentApp="payroll" role="admin" />
          <button
            onClick={handleLogout}
            className="p-2 rounded-full hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
            title="ログアウト"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* 🧭 給与システム内タブナビゲーション */}
      <div className="bg-white border-b border-slate-200 px-6 py-2.5 sticky top-[61px] z-20 shadow-2xs min-w-[1024px] print:hidden">
        <div className="max-w-7xl w-full mx-auto flex items-center justify-between">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('ledger')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'ledger'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              社員給与一覧 ＆ 昇給履歴・改定管理
              <span className="text-[10px] bg-amber-400 text-slate-900 font-black px-1.5 py-0.2 rounded-full shadow-2xs">
                新設
              </span>
            </button>
            <button
              onClick={() => setActiveTab('payslip')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'payslip'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              月別給与計算・明細発行
            </button>
            <button
              onClick={() => setActiveTab('bonus')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'bonus'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Gift className="w-4 h-4 text-amber-300" />
              賞与計算・査定 ＆ 明細発行
              <span className="text-[10px] bg-amber-400 text-slate-900 font-black px-1.5 py-0.2 rounded-full shadow-2xs">
                賞与
              </span>
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'reports'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-4 h-4" />
              労務・法定帳票発行センター（賞与・名簿・台帳）
              <span className="text-[10px] bg-indigo-100 text-indigo-800 font-black px-1.5 py-0.2 rounded-full shadow-2xs">
                公式帳票
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 min-w-[1024px] print:min-w-0 print:w-full print:p-0 print:m-0 print:max-w-none">
        {tenantId && (
          activeTab === 'ledger' ? (
            <SalaryLedgerDashboard tenantId={tenantId} />
          ) : activeTab === 'payslip' ? (
            <PayslipManagement tenantId={tenantId} />
          ) : activeTab === 'bonus' ? (
            <BonusManagement tenantId={tenantId} />
          ) : (
            <OfficialReportsCenter tenantId={tenantId} />
          )
        )}
      </main>

      {/* ❓ 使い方ガイドモーダル */}
      <HelpGuideModal 
        screenKey="payroll_admin" 
        isOpen={isHelpOpen} 
        onClose={() => setIsHelpOpen(false)} 
      />
    </div>
  );
}
