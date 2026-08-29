import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
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
import ShiftMonthlyView from './pages/ShiftMonthlyView';
import ShiftRequestsView from './pages/ShiftRequestsView';
import UserDashboard from './pages/UserDashboard';
import PayrollAdminDashboard from './pages/PayrollAdminDashboard';
import PayrollUserDashboard from './pages/PayrollUserDashboard';
import OnboardingAdminDashboard from './pages/OnboardingAdminDashboard';
import EmployeeOnboardingSubmission from './pages/EmployeeOnboardingSubmission';
import CompanySettingsDashboard from './pages/CompanySettingsDashboard';
import TrialEnded from './pages/TrialEnded';
import { supabase } from './lib/supabase';

const PrivateRoute = ({ children, requiredRole }: { children: React.ReactNode, requiredRole?: string }) => {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [trialEnded, setTrialEnded] = useState(false);

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

      const { data: userData } = await supabase
        .from('users')
        .select('role, tenant_id')
        .eq('id', session.user.id)
        .single();

      if (!userData) {
        setAuthorized(false);
        setLoading(false);
        return;
      }

      // Check role
      if (requiredRole && userData.role !== requiredRole) {
        setAuthorized(false);
        setLoading(false);
        return;
      }

      // Check trial lock (Superadmins bypass this)
      if (userData.role !== 'superadmin' && userData.tenant_id) {
        const { data: tenantData } = await supabase
          .from('tenants')
          .select('plan_type, trial_ends_at')
          .eq('id', userData.tenant_id)
          .single();

        if (tenantData && tenantData.plan_type === 'trial' && tenantData.trial_ends_at) {
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

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (trialEnded) return <Navigate to="/trial-ended" replace />;
  if (!authorized) return <Navigate to="/" replace />;
  
  return <>{children}</>;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
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
          <PrivateRoute>
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
        <Route path="/settings/company/*" element={
          <PrivateRoute requiredRole="admin">
            <CompanySettingsDashboard />
          </PrivateRoute>
        } />
        {/* 旧URLや未定義ルートへのアクセス対策リダイレクト */}
        <Route path="/admin/*" element={<Navigate to="/kintai/admin" replace />} />
        <Route path="/user/*" element={<Navigate to="/kintai/user" replace />} />
        <Route path="*" element={<Navigate to="/portal" replace />} />
      </Routes>
    </Router>
  );
}

export default App;




