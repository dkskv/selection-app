import { useCallback, useRef } from 'react';
import { useDebouncedRequest } from './useDebouncedRequest';

/** Планирует refresh с задержкой и возвращает Promise его завершения. */
export function useDebouncedRefresh({
  delay,
  markRefreshScheduled,
  refresh,
}: {
  delay: number;
  markRefreshScheduled: () => void;
  refresh: () => Promise<void>;
}) {
  /** Ожидания всех вызовов, объединённых следующим refresh. */
  const waitersRef = useRef<Array<() => void>>([]);

  const { scheduleRequest } = useDebouncedRequest({
    delay,
    request: async () => {
      const waiters = waitersRef.current;

      // Новые ожидания во время refresh попадут уже в следующую очередь.
      waitersRef.current = [];

      try {
        await refresh().catch(() => undefined);
      } finally {
        waiters.forEach((resolve) => resolve());
      }
    },
    cancelRequest: () => {
      const waiters = waitersRef.current;

      waitersRef.current = [];

      waiters.forEach((resolve) => resolve());
    },
  });

  return useCallback(() => {
    /** Завершается после refresh, который обработает текущую очередь. */
    const { promise, resolve } = Promise.withResolvers<void>();

    waitersRef.current.push(resolve);

    markRefreshScheduled();

    scheduleRequest();

    return promise;
  }, [markRefreshScheduled, scheduleRequest]);
}
