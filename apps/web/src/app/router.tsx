import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth } from '../features/auth/components/require-auth';
import { RequireHr } from '../features/auth/components/require-hr';
import { LoginPage } from '../features/auth/pages/login-page';
import { EmployeesPage } from '../features/employees/pages/employees-page';
import { MyPayPage } from '../features/my-pay/pages/my-pay-page';
import { SocialInsurancePage } from '../features/payroll/pages/social-insurance-page';
import { TaxTablesPage } from '../features/payroll/pages/tax-tables-page';
import { AppLayout } from './app-layout';
import { NotFoundPage } from './not-found-page';
import { useSessionExpiredRedirect } from './use-session-expired-redirect';

export function AppRoutes() {
  useSessionExpiredRedirect();
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/employees" replace />} />
          <Route path="employees" element={<EmployeesPage />} />
          <Route path="my-pay" element={<MyPayPage />} />
          <Route element={<RequireHr />}>
            <Route path="settings/tax-tables" element={<TaxTablesPage />} />
            <Route path="settings/social-insurance" element={<SocialInsurancePage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
