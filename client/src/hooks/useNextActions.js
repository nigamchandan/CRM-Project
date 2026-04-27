import { useCallback, useEffect, useRef, useState } from 'react';
import * as nextActionsService from '../services/nextActionsService';
import { getSocket } from '../services/socket';

// Live next-action suggestions. Auto-refetches on related socket events.
//
//   const { data, loading, refresh } = useNextActions({ scope: 'mine' });
//
// `data` shape: { rules, total, top_severity, scope, counts_by_id }
export default function useNextActions({ scope = 'mine', pollMs = 90_000 } = {}) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef(null);
  const mountedRef  = useRef(true);

  const fetchOnce = useCallback(async () => {
    try {
      const d = await nextActionsService.get(scope);
      if (mountedRef.current) setData(d);
    } catch {
      /* swallow — keep last value */
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [scope]);

  const refresh = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchOnce, 350);
  }, [fetchOnce]);

  useEffect(() => {
    mountedRef.current = true;
    fetchOnce();
    const id = pollMs ? setInterval(fetchOnce, pollMs) : null;
    return () => {
      mountedRef.current = false;
      if (id) clearInterval(id);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchOnce, pollMs]);

  // React to live mutations
  useEffect(() => {
    const sock = getSocket();
    if (!sock) return;
    const events = [
      'lead:new', 'lead:update', 'lead:delete',
      'deal:new', 'deal:update', 'deal:delete',
      'task:update',
      'ticket:new', 'ticket:update', 'ticket:delete', 'ticket:comment',
    ];
    events.forEach((e) => sock.on(e, refresh));
    return () => events.forEach((e) => sock.off(e, refresh));
  }, [refresh]);

  return { data, loading, refresh };
}
