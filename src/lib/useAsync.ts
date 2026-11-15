import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

type State<T> = { data: T | undefined; error: unknown; loading: boolean };

/**
 * Small data-loading hook: runs `fn`, exposes loading/error/data, reloads on
 * screen focus (so lists are fresh when navigating back) and on demand.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = [], { refetchOnFocus = true } = {}) {
  const [state, setState] = useState<State<T>>({ data: undefined, error: null, loading: true });
  const [refreshing, setRefreshing] = useState(false);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const first = useRef(true);

  const run = useCallback(async (mode: 'initial' | 'refresh' | 'silent' = 'silent') => {
    if (mode === 'initial') setState((s) => ({ ...s, loading: true, error: null }));
    if (mode === 'refresh') setRefreshing(true);
    try {
      const data = await fnRef.current();
      setState({ data, error: null, loading: false });
    } catch (error) {
      setState((s) => ({ ...s, error, loading: false }));
    } finally {
      if (mode === 'refresh') setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    first.current = true;
    run('initial');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      if (refetchOnFocus) run('silent');
    }, [run, refetchOnFocus]),
  );

  return {
    ...state,
    refreshing,
    reload: () => run('initial'),
    refresh: () => run('refresh'),
    silentReload: () => run('silent'),
    setData: (updater: (prev: T | undefined) => T) => setState((s) => ({ ...s, data: updater(s.data) })),
  };
}

/** Throws the Supabase error if present, otherwise returns data. */
export function must<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data as T;
}
