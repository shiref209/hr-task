import { Providers } from './app/providers';
import { EmployeesPage } from './features/employees/pages/employees-page';
import { DesignSystemPreview } from './shared/ui/preview/design-system-preview';

function App() {
  if (import.meta.env.DEV && window.location.pathname === '/design-system') {
    return <DesignSystemPreview />;
  }
  return (
    <Providers>
      <EmployeesPage />
    </Providers>
  );
}

export default App;
