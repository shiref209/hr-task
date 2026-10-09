import { Providers } from './app/providers';
import { AppRoutes } from './app/router';
import { DesignSystemPreview } from './shared/ui/preview/design-system-preview';

function App() {
  if (import.meta.env.DEV && window.location.pathname === '/design-system') {
    return <DesignSystemPreview />;
  }
  return (
    <Providers>
      <AppRoutes />
    </Providers>
  );
}

export default App;
