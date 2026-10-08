import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import { hashKey, useQueryClient } from '@tanstack/react-query';
import { SlidingWindowQueryController } from './SlidingWindowQueryController';
import { getWindowEdgePageParams } from './useSlidingWindowQuery.helpers';
import type {
  UseSlidingWindowQueryOptions,
  UseSlidingWindowQueryResult,
} from './useSlidingWindowQuery.types';

/**
 * Подключает скользящее окно к React. Контроллер управляет загрузкой и кешем,
 * а placeholderData применяется только к отображению и не участвует в подгрузке.
 */
export function useSlidingWindowQuery<TPage, TPageParam>(
  options: UseSlidingWindowQueryOptions<TPage, TPageParam>,
): UseSlidingWindowQueryResult<TPage, TPageParam> {
  const queryClient = useQueryClient();
  const queryHash = hashKey(options.queryKey);

  const [controller] = useState(
    () => new SlidingWindowQueryController(queryClient, options),
  );

  useLayoutEffect(() => {
    controller.setOptions(options);
  });

  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );

  useEffect(() => {
    controller.initialize();
  }, [controller, queryHash]);

  const isCurrentQuery = snapshot.queryHash === queryHash;
  const currentData = isCurrentQuery ? snapshot.data : undefined;
  const { placeholderData } = options;

  const displayData = useMemo(() => {
    if (currentData !== undefined) return currentData;

    return typeof placeholderData === 'function'
      ? placeholderData(snapshot.data ?? snapshot.previousData)
      : placeholderData;
  }, [currentData, placeholderData, snapshot.data, snapshot.previousData]);

  const edgeParams = getWindowEdgePageParams(
    currentData?.pages,
    options.getNextPageParam,
    options.getPreviousPageParam,
  );

  return {
    data: displayData,
    hasNextPage: edgeParams.next !== undefined,
    hasPreviousPage: edgeParams.previous !== undefined,
    fetchNextPage: controller.fetchNextPage,
    fetchPreviousPage: controller.fetchPreviousPage,
    refresh: controller.refresh,
    scheduleRefresh: controller.scheduleRefresh,
    isFetchingNextPage: isCurrentQuery && snapshot.isFetchingNextPage,
    isFetchingPreviousPage: isCurrentQuery && snapshot.isFetchingPreviousPage,
    isRefreshing: isCurrentQuery && snapshot.isRefreshing,
    isLoading: isCurrentQuery && snapshot.isLoading,
  };
}
