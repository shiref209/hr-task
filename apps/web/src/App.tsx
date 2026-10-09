import { DesignSystemPreview } from './shared/ui/preview/design-system-preview';

function App() {
  if (import.meta.env.DEV && window.location.pathname === '/design-system') {
    return <DesignSystemPreview />;
  }
  return <h1>HR Payroll</h1>;
}

export default App;
