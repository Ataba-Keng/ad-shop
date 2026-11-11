import { createContext, useContext, useEffect, useState } from 'react';
import { apiRequest } from '../lib/api.js';

export const InitialPageDataContext = createContext({ key: '', data: null, demoMode: false });

export function useApiResource(key, endpoint) {
  const initial = useContext(InitialPageDataContext);
  const matchesInitial = initial.key === key;
  const [state, setState] = useState(() => ({
    key: initial.key,
    data: initial.data,
    loading: false,
    error: null,
  }));
  const visibleState = state.key === key
    ? state
    : matchesInitial
      ? { key, data: initial.data, loading: false, error: null }
      : { key, data: null, loading: Boolean(endpoint), error: null };

  useEffect(() => {
    if (!endpoint) {
      setState({ key, data: null, loading: false, error: null });
      return undefined;
    }
    if (matchesInitial) {
      setState({ key, data: initial.data, loading: false, error: null });
      return undefined;
    }

    const controller = new AbortController();
    setState({ key, data: null, loading: true, error: null });
    apiRequest(endpoint, { signal: controller.signal })
      .then((data) => setState((current) => current.key === key
        ? { key, data, loading: false, error: null }
        : current))
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setState((current) => current.key === key
            ? { key, data: null, loading: false, error }
            : current);
        }
      });

    return () => controller.abort();
  }, [endpoint, initial.data, key, matchesInitial]);

  return visibleState;
}
