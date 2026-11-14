import { useEffect, useState } from 'react';
import { invoke } from './tauri';
import { describeError } from './format';

const cache = new Map();
const CACHE_LIMIT = 40;

/** Fetches a catalog page once per session; revisiting it is instant. */
export function useCatalog(command, args) {
  const key = `${command}:${JSON.stringify(args)}`;
  const [state, setState] = useState(() => (cache.has(key) ? { data: cache.get(key), error: null } : { data: null, error: null }));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (cache.has(key)) {
      setState({ data: cache.get(key), error: null });
      return undefined;
    }
    let alive = true;
    setState({ data: null, error: null });
    invoke(command, args)
      .then((data) => {
        cache.set(key, data);
        if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
        if (alive) setState({ data, error: null });
      })
      .catch((error) => alive && setState({ data: null, error: describeError(error) }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  return { ...state, retry: () => setAttempt((n) => n + 1) };
}
