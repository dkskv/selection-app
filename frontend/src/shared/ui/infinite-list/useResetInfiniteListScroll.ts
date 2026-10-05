import { useEffect, useRef, type RefObject } from 'react';
import type { InfiniteListHandle } from './InfiniteList';

export function useResetInfiniteListScroll({
  listRef,
  scrollKey,
  isLoading,
}: {
  listRef: RefObject<InfiniteListHandle | null>;
  scrollKey: unknown;
  isLoading: boolean;
}) {
  const previousKey = useRef(scrollKey);
  const resetPending = useRef(false);

  useEffect(() => {
    if (!Object.is(previousKey.current, scrollKey)) {
      previousKey.current = scrollKey;

      resetPending.current = true;
    }

    if (resetPending.current && !isLoading) {
      listRef.current?.resetScroll();

      resetPending.current = false;
    }
  }, [isLoading, listRef, scrollKey]);
}
