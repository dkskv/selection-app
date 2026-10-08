import { useLayoutEffect, useRef, type RefObject } from 'react';
import type { InfiniteListApi } from './InfiniteList';

export function useResetInfiniteListScroll(
  listApiRef: RefObject<InfiniteListApi | null>,
  dataVersion: string | number,
) {
  const previousDataVersion = useRef(dataVersion);

  useLayoutEffect(() => {
    const hasChanged = !Object.is(previousDataVersion.current, dataVersion);

    previousDataVersion.current = dataVersion;

    if (hasChanged) {
      listApiRef.current?.resetScroll();
    }
  }, [dataVersion, listApiRef]);
}
