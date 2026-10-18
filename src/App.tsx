import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import SuperAdminLogin from './pages/SuperAdminLogin';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import Portal from './pages/Portal';
import AdminDashboard from './pages/AdminDashboard';
import ShiftRequirementSettings from './pages/ShiftRequirementSettings';
import ShiftAdminDashboard from './pages/ShiftAdminDashboard';
import ShiftSettings from './pages/ShiftSettings';
import ShiftEmployeeRequest from './pages/ShiftEmployeeRequest';
import ShiftEmployeeMaster from './pages/ShiftEmployeeMaster';
import ShiftCalendarView from './pages/ShiftCalendarView';
import ShiftPublicView from './pages/ShiftPublicView';
import ShiftMonthlyView from './pages/ShiftMonthlyView';
import ShiftRequestsView from './pages/ShiftRequestsView';
import UserDashboard from './pages/UserDashboard';
import PayrollAdminDashboard from './pages/PayrollAdminDashboard';
import PayrollUserDashboard from './pages/PayrollUserDashboard';
import OnboardingAdminDashboard from './pages/OnboardingAdminDashboard';
import EmployeeOnboardingSubmission from './pages/EmployeeOnboardingSubmission';
import EmployeeOnboardingWelcome from './pages/EmployeeOnboardingWelcome';
import EmployeeMaternityApplication from './pages/EmployeeMaternityApplication';
import StaffLineLinkPage from './pages/StaffLineLinkPage';
import CompanySettingsDashboard from './pages/CompanySettingsDashboard';
import CommunitySupportDashboard from './pages/CommunitySupportDashboard';
import TrialEnded from './pages/TrialEnded';
import { FloatingSupportAssistant } from './components/FloatingSupportAssistant';
import { supabase } from './lib/supabase';
import { purgeAllLegacyGlobalCache } from './lib/tenantCache';

// 🔗 クエリパラメータ（?tenant_id=...&tab=...）を100%保持して正規URLへ転送するコンポーネント
const RedirectWithSearch = ({ to }: { to: string }) => {
  const location = useLocation();
  return <Navigate to={`${to}${location.search}`} replace />;
};

// 🌐 旧 /lp アクセス時に正規の公式LP（https://kap-cocotte.com/rakumaru/）へ即時転送するコンポーネント
const RedirectToOfficialLp = () => {
  useEffect(() => {
    window.location.replace('https://kap-cocotte.com/rakumaru/');
  }, []);
  return null;
};

const PrivateRoute = ({ children, requiredRole }: { children: React.ReactNode, requiredRole?: string }) => {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [trialEnded, setTrialEnded] = useState(false);
  const location = useLocation();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setAuthorized(false);
        setLoading(false);
        return;
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role, tenant_id')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!userData || userError) {
        console.warn('User has auth session but no public.users record:', session.user.id);
        await supabase.auth.signOut();
        setAuthorized(false);
        setLoading(false);
        return;
      }

      // Check role
      if (requiredRole) {
        if (requiredRole === 'admin') {
          if (userData.role !== 'admin' && userData.role !== 'superadmin') {
            setAuthorized(false);
            setLoading(false);
            return;
          }
        } else if (userData.role !== requiredRole) {
          setAuthorized(false);
          setLoading(false);
          return;
        }
      }

      // Check trial lock (Superadmins bypass this, and Admins accessing /settings/company bypass this so they can upgrade/pay)
      const isBillingSettingsRoute =
        location.pathname.startsWith('/settings/company') ||
        location.pathname.startsWith('/company-settings');
      const canBypassTrialLock =
        userData.role === 'superadmin' ||
        (userData.role === 'admin' && isBillingSettingsRoute);

      if (!canBypassTrialLock && userData.tenant_id) {
        const { data: tenantData } = await supabase
          .from('tenants')
          .select('plan_type, trial_ends_at, payroll_common_settings')
          .eq('id', userData.tenant_id)
          .single();

        const effectivePlan =
          tenantData?.payroll_common_settings?.selected_saas_plan ||
          localStorage.getItem(`selected_saas_plan_${userData.tenant_id}`) ||
          tenantData?.plan_type ||
          'trial';

        if (tenantData && effectivePlan === 'trial' && tenantData.trial_ends_at) {
          const now = new Date();
          const trialEnd = new Date(tenantData.trial_ends_at);
          if (now > trialEnd) {
            setTrialEnded(true);
            setLoading(false);
            return;
          }
        }
      }

      setAuthorized(true);
    } catch (e) {
      console.error(e);
      setAuthorized(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-bold text-slate-600">読み込み中...</p>
      </div>
    );
  }
  if (trialEnded) return <Navigate to="/trial-ended" replace />;
  if (!authorized) {
    const currentPathWithQuery = location.pathname + location.search;
    if (location.pathname !== '/') {
      return <Navigate to={`/?redirect_to=${encodeURIComponent(currentPathWithQuery)}`} replace />;
    }
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

function App() {
  useEffect(() => {
    // 🛡️ アプリ起動時にレガシーなグローバルキャッシュ（他社汚染原因）を完全消去
    purgeAllLegacyGlobalCache();
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/master-login" element={<SuperAdminLogin />} />
        <Route path="/trial-ended" element={<TrialEnded />} />
        <Route path="/super-admin/*" element={
          <PrivateRoute requiredRole="superadmin">
            <SuperAdminDashboard />
          </PrivateRoute>
        } />
        <Route path="/portal" element={
          <PrivateRoute>
            <Portal />
          </PrivateRoute>
        } />
        <Route path="/shift/admin/patterns" element={
          <PrivateRoute requiredRole="admin">
            <ShiftRequirementSettings />
          </PrivateRoute>
        } />
        <Route path="/shift/admin" element={
          <PrivateRoute requiredRole="admin">
            <ShiftAdminDashboard />
          </PrivateRoute>
        } />
        <Route path="/shift/admin/settings" element={
          <PrivateRoute requiredRole="admin">
            <ShiftSettings />
          </PrivateRoute>
        } />
        <Route path="/shift/admin/monthly" element={
          <PrivateRoute requiredRole="admin">
            <ShiftMonthlyView />
          </PrivateRoute>
        } />
        <Route path="/shift/admin/calendar" element={
          <PrivateRoute requiredRole="admin">
            <ShiftCalendarView />
          </PrivateRoute>
        } />
        <Route path="/shift/admin/employees" element={
          <PrivateRoute requiredRole="admin">
            <ShiftEmployeeMaster />
          </PrivateRoute>
        } />
        <Route path="/shift/admin/requests" element={
          <PrivateRoute requiredRole="admin">
            <ShiftRequestsView />
          </PrivateRoute>
        } />
        <Route path="/kintai/admin/*" element={
          <PrivateRoute requiredRole="admin">
            <AdminDashboard />
          </PrivateRoute>
        } />
        <Route path="/kintai/user/*" element={
          <PrivateRoute>
            <UserDashboard />
          </PrivateRoute>
        } />
        <Route path="/shift/user" element={
          <PrivateRoute>
            <ShiftEmployeeRequest />
          </PrivateRoute>
        } />
        <Route path="/payroll/admin/*" element={
          <PrivateRoute requiredRole="admin">
            <PayrollAdminDashboard />
          </PrivateRoute>
        } />
        <Route path="/payroll/user/*" element={
          <PrivateRoute>
            <PayrollUserDashboard />
          </PrivateRoute>
        } />
        <Route path="/onboarding/admin/*" element={
          <PrivateRoute requiredRole="admin">
            <OnboardingAdminDashboard />
          </PrivateRoute>
        } />
        <Route path="/onboarding/my/*" element={
          <PrivateRoute>
            <EmployeeOnboardingSubmission />
          </PrivateRoute>
        } />
        <Route path="/onboarding/welcome" element={<EmployeeOnboardingWelcome />} />
        <Route path="/maternity/apply" element={<EmployeeMaternityApplication />} />
        {/* 📱 既存・新人スタッフ専用 10秒LINEワンタップ連携ルート（パスワードレス公開） */}
        <Route path="/line-link" element={<StaffLineLinkPage />} />
        {/* 🚨【軍律 第9条・第12条 遵守】アルバイト・現場専用 確定シフト公開閲覧ルート（パスワードレス） */}
        <Route path="/shift/view" element={<ShiftPublicView />} />
        <Route path="/settings/company/*" element={
          <PrivateRoute requiredRole="admin">
            <CompanySettingsDashboard />
          </PrivateRoute>
        } />
        <Route path="/support" element={
          <PrivateRoute>
            <CommunitySupportDashboard />
          </PrivateRoute>
        } />
        <Route path="/community" element={<RedirectWithSearch to="/support" />} />
        <Route path="/lp" element={<RedirectToOfficialLp />} />
        <Route path="/lp/*" element={<RedirectToOfficialLp />} />
        {/* 旧URL・別名エイリアスへのアクセス時もクエリ（?tenant_id=...&tab=...）を100%保持して正規URLへ自動転送 */}
        <Route path="/company-settings/*" element={<RedirectWithSearch to="/settings/company" />} />
        <Route path="/payroll" element={<RedirectWithSearch to="/payroll/admin" />} />
        <Route path="/onboarding" element={<RedirectWithSearch to="/onboarding/admin" />} />
        <Route path="/shift/settings" element={<RedirectWithSearch to="/shift/admin/settings" />} />
        <Route path="/shift/requirements" element={<RedirectWithSearch to="/shift/admin/patterns" />} />
        <Route path="/payslip" element={<RedirectWithSearch to="/payroll/user" />} />
        <Route path="/admin/*" element={<RedirectWithSearch to="/kintai/admin" />} />
        <Route path="/user/*" element={<RedirectWithSearch to="/kintai/user" />} />
        <Route path="*" element={<RedirectWithSearch to="/portal" />} />
      </Routes>
      {/* 🤖 24時間常駐・全画面対応 労務＆操作AI自律サポート門番 */}
      <FloatingSupportAssistant />
    </Router>
  );
}

export default App;




