import { useLayoutEffect, useRef, type RefObject } from 'react';
import type { InfiniteListHandle } from './InfiniteList';

export function useResetInfiniteListScroll(
  listRef: RefObject<InfiniteListHandle | null>,
  dataVersion: string | number,
) {
  const previousDataVersion = useRef(dataVersion);

  useLayoutEffect(() => {
    const hasChanged = !Object.is(previousDataVersion.current, dataVersion);

    previousDataVersion.current = dataVersion;

    if (hasChanged) {
      listRef.current?.resetScroll();
    }
  }, [dataVersion, listRef]);
}
