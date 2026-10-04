import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useQueryClient,
  type InfiniteData,
  type QueryKey,
} from '@tanstack/react-query';
import { useMounted } from '../react/useMounted';

type UseParallelPageRefreshOptions<TPage, TPageParam> = {
  queryKey: QueryKey;
  initialPageParam: TPageParam;
  fetchPage: (pageParam: TPageParam, signal: AbortSignal) => Promise<TPage>;
  onError: (error: Error) => void;
};

/** Обновляет страницы параллельно, обходя последовательное поведение refetchInfiniteQuery в TanStack Query. */
export function useParallelPageRefresh<TPage, TPageParam>({
  queryKey,
  initialPageParam,
  fetchPage,
  onError,
}: UseParallelPageRefreshOptions<TPage, TPageParam>) {
  const isMounted = useMounted();
  const queryClient = useQueryClient();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    controllerRef.current?.abort();

    const controller = new AbortController();
    const { signal } = controller;

    controllerRef.current = controller;

    setIsRefreshing(true);

    try {
      const data =
        queryClient.getQueryData<InfiniteData<TPage, TPageParam>>(queryKey);

      const pageParams = data?.pageParams.length
        ? data.pageParams
        : [initialPageParam];

      await queryClient.cancelQueries({ queryKey, exact: true });

      if (signal.aborted) {
        throw new DOMException('Refresh cancelled.', 'AbortError');
      }

      const pages = await Promise.all(
        pageParams.map((pageParam) => fetchPage(pageParam, signal)),
      );

      if (signal.aborted) {
        throw new DOMException('Refresh cancelled.', 'AbortError');
      }

      queryClient.setQueryData(queryKey, { pages, pageParams });
    } catch (caughtError) {
      if (
        !(
          caughtError instanceof DOMException &&
          caughtError.name === 'AbortError'
        ) &&
        controllerRef.current === controller &&
        isMounted()
      ) {
        onError(
          caughtError instanceof Error
            ? caughtError
            : new Error('Failed to refresh items.'),
        );
      }
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;

        if (isMounted()) {
          setIsRefreshing(false);
        }
      }
    }
  }, [fetchPage, initialPageParam, isMounted, onError, queryClient, queryKey]);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();

    controllerRef.current = null;

    if (isMounted()) {
      setIsRefreshing(false);

    }
  }, [isMounted]);

  useEffect(() => cancel, [cancel]);

  return { refresh, cancel, isRefreshing };
}
