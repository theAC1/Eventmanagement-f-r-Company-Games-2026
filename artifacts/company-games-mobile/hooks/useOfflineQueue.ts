import { useCallback, useEffect, useState } from 'react';
import {
  flushQueue,
  initOfflineQueue,
  subscribeQueue,
  type PendingErgebnis,
} from '@/lib/offline-queue';

/** Live view of pending (unsynced) score submissions plus a manual retry. */
export function useOfflineQueue() {
  const [queue, setQueue] = useState<PendingErgebnis[]>([]);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    void initOfflineQueue();
    return subscribeQueue(setQueue);
  }, []);

  const retryNow = useCallback(async () => {
    setSyncing(true);
    try {
      return await flushQueue();
    } finally {
      setSyncing(false);
    }
  }, []);

  return { queue, syncing, retryNow };
}
