import { useRef, type UIEvent } from 'react';

const LOAD_MORE_THRESHOLD = 200;

type UseInfiniteListScrollArgs = {
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  isFetchingPreviousPage: boolean;
  isFetchingNextPage: boolean;
  fetchPreviousPage: () => Promise<unknown>;
  fetchNextPage: () => Promise<unknown>;
};

/** Управляет двунаправленной подгрузкой страниц при прокрутке списка. */
export function useInfiniteListScroll({
  hasPreviousPage,
  hasNextPage,
  isFetchingPreviousPage,
  isFetchingNextPage,
  fetchPreviousPage,
  fetchNextPage,
}: UseInfiniteListScrollArgs) {
  /** Не даёт повторно запускать загрузку, пока прокрутка не отойдёт от верхнего края. */
  const isPreviousEdgeLockedRef = useRef(false);
  /** Не даёт повторно запускать загрузку, пока прокрутка не отойдёт от нижнего края. */
  const isNextEdgeLockedRef = useRef(false);

  return (event: UIEvent<HTMLDivElement>) => {
    const { scrollHeight, scrollTop, clientHeight } = event.currentTarget;

    if (scrollTop > LOAD_MORE_THRESHOLD) {
      isPreviousEdgeLockedRef.current = false;
    }

    const distanceFromEnd = scrollHeight - scrollTop - clientHeight;

    if (distanceFromEnd > LOAD_MORE_THRESHOLD) {
      isNextEdgeLockedRef.current = false;
    }

    if (
      scrollTop <= LOAD_MORE_THRESHOLD &&
      hasPreviousPage &&
      !isPreviousEdgeLockedRef.current &&
      !isFetchingPreviousPage
    ) {
      isPreviousEdgeLockedRef.current = true;

      fetchPreviousPage();
    }

    if (
      distanceFromEnd <= LOAD_MORE_THRESHOLD &&
      hasNextPage &&
      !isFetchingNextPage &&
      !isNextEdgeLockedRef.current
    ) {
      isNextEdgeLockedRef.current = true;

      fetchNextPage();
    }
  };
}
