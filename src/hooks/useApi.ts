import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';

// Loads a GET endpoint. `reload` refreshes the data without flashing the loading state.
export function useApi<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setData(await api<T>('GET', path));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this page');
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    setData(null);
    setLoading(true);
    void reload();
  }, [reload]);

  return { data, error, loading, reload };
}
