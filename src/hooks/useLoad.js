import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Load data for a screen. Re-runs when `deps` change; ignores stale responses
 * (e.g. after switching spaces quickly). Returns { data, error, loading, reload, setData }.
 */
export function useLoad(loader, deps = []) {
  const [state, setState] = useState({ data: undefined, error: null, loading: true });
  const runId = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(async () => {
    const id = ++runId.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await loader();
      if (id === runId.current) setState({ data, error: null, loading: false });
      return data;
    } catch (error) {
      console.error(error);
      if (id === runId.current) setState((s) => ({ ...s, error, loading: false }));
      return undefined;
    }
  }, deps);

  useEffect(() => { run(); }, [run]);

  const setData = useCallback((update) => {
    setState((s) => ({ ...s, data: typeof update === 'function' ? update(s.data) : update }));
  }, []);

  return { ...state, reload: run, setData };
}
