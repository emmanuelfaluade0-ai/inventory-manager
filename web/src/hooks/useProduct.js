import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../api';

export function useProduct(id) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const latestRequestId = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++latestRequestId.current;
    setLoading(true);
    setError(null);
    try {
      const body = await apiFetch(`/products/${id}`);
      if (requestId === latestRequestId.current) setData(body);
    } catch (err) {
      if (requestId === latestRequestId.current) setError(err);
    } finally {
      if (requestId === latestRequestId.current) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, refetch: load };
}
