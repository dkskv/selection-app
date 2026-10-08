import { useCallback } from 'react';
import { keepPreviousData, useQueryClient } from '@tanstack/react-query';
import { useSlidingWindowQuery } from '@/shared/lib/react-query/useSlidingWindowQuery';
import { removeOtherQueryCaches } from '@/shared/lib/react-query/useSlidingWindowQuery.helpers';
import { useDebouncedRequest } from '@/shared/lib/react/useDebouncedRequest';
import { getItems } from '../api/getItems';
import {
  itemsQueryKeys,
  getNextItemsPageParam,
  getPreviousItemsPageParam,
} from '../api/queries';

export function useItemsQuery(
  selection: 'selected' | 'unselected',
  search: string,
  onError: (error: Error) => void,
) {
  const queryClient = useQueryClient();
  const queryKey = [...itemsQueryKeys[selection], search];

  const queryFn = useCallback(
    (pageParam: number, signal: AbortSignal) =>
      getItems(selection, pageParam, signal, search),
    [selection, search],
  );

  const query = useSlidingWindowQuery({
    queryKey,
    queryFn,
    initialPageParam: 0,
    getNextPageParam: getNextItemsPageParam,
    getPreviousPageParam: getPreviousItemsPageParam,
    maxPages: 5,
    onError,
    placeholderData: keepPreviousData,
  });

  const { scheduleRequest } = useDebouncedRequest({
    delay: 300,
    request: () => {
      removeOtherQueryCaches(queryClient, itemsQueryKeys[selection], queryKey);

      return query.refresh();
    },
  });

  const prepareRefresh = query.scheduleRefresh;

  const scheduleRefresh = useCallback(() => {
    prepareRefresh();

    scheduleRequest();
  }, [prepareRefresh, scheduleRequest]);

  return { ...query, queryKey, scheduleRefresh };
}

export type ItemsQuery = ReturnType<typeof useItemsQuery>;
