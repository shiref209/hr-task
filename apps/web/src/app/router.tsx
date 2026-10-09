import { Navigate, Route, Routes } from 'react-router-dom';
import { EmployeesPage } from '../features/employees/pages/employees-page';
import { SocialInsurancePage } from '../features/payroll/pages/social-insurance-page';
import { TaxTablesPage } from '../features/payroll/pages/tax-tables-page';
import { AppLayout } from './app-layout';
import { NotFoundPage } from './not-found-page';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/employees" replace />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="settings/tax-tables" element={<TaxTablesPage />} />
        <Route path="settings/social-insurance" element={<SocialInsurancePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
