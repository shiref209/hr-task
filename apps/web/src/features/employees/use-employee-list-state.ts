import { useCallback, useEffect, useState } from 'react';
import {
  defaultListState,
  parseListState,
  toSearchParams,
  type EmployeeListState,
} from './list-state';

export function useEmployeeListState() {
  const [state, setState] = useState(() =>
    parseListState(new URLSearchParams(window.location.search)),
  );

  useEffect(() => {
    const query = toSearchParams(state).toString();
    window.history.replaceState(window.history.state, '', query ? `?${query}` : window.location.pathname);
  }, [state]);

  // Any change goes back to page 1 unless it sets the page itself.
  const update = useCallback(
    (changes: Partial<EmployeeListState>) =>
      setState((current) => ({ ...current, page: 1, ...changes })),
    [],
  );
  const reset = useCallback(() => setState(defaultListState), []);

  return { state, update, reset };
}
