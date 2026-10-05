import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryKey,
} from '@tanstack/react-query';

type PageParamFn<TPage, TPageParam> = (
  page: TPage,
  pages: TPage[],
) => TPageParam | undefined;

type UseSlidingWindowQueryOptions<TPage, TPageParam> = {
  queryKey: QueryKey;
  initialPageParam: TPageParam;
  queryFn: (pageParam: TPageParam, signal: AbortSignal) => Promise<TPage>;
  getNextPageParam: PageParamFn<TPage, TPageParam>;
  getPreviousPageParam: PageParamFn<TPage, TPageParam>;
  maxPages: number;
  onError?: (error: Error) => void;
};

type Direction = 'next' | 'previous';

type ExpandOperation = {
  id: number;
  revision: number;
  controller: AbortController;
  promise: Promise<void>;
};

type RefreshOperation = {
  id: number;
  revision: number;
};

type State = {
  isRefreshing: boolean;
  expanding: Record<Direction, boolean>;
};

function mergePages<TPage, TPageParam>(
  current: InfiniteData<TPage, TPageParam> | undefined,
  window: TPageParam[],
  updatedParams: TPageParam[],
  updatedPages: TPage[],
): InfiniteData<TPage, TPageParam> {
  const pagesByParam = new Map<TPageParam, TPage>();

  current?.pageParams.forEach((param, index) => {
    if (window.includes(param)) pagesByParam.set(param, current.pages[index]);
  });

  updatedParams.forEach((param, index) => {
    if (window.includes(param)) pagesByParam.set(param, updatedPages[index]);
  });

  const pageParams = window.filter((param) => pagesByParam.has(param));

  return {
    pageParams,
    pages: pageParams.map((param) => pagesByParam.get(param)!),
  };
}

function getExpandedWindow<TPageParam>(
  window: TPageParam[],
  pageParam: TPageParam,
  direction: Direction,
  retryingMissingEdge: boolean,
  maxPages: number,
): TPageParam[] {
  if (retryingMissingEdge) return window;

  const expanded =
    direction === 'next' ? [...window, pageParam] : [pageParam, ...window];

  if (expanded.length > maxPages)
    expanded.splice(direction === 'next' ? 0 : -1, 1);

  return expanded;
}

/** Управляет логическим окном отдельно от загруженных страниц и сетевых операций. */
export function useSlidingWindowQuery<TPage, TPageParam>({
  queryKey,
  initialPageParam,
  queryFn,
  getNextPageParam,
  getPreviousPageParam,
  maxPages,
  onError,
}: UseSlidingWindowQueryOptions<TPage, TPageParam>) {
  const queryClient = useQueryClient();

  const query = useQuery<InfiniteData<TPage, TPageParam>>({
    queryKey,
    queryFn: async () => {
      throw new Error('This query is managed by useSlidingWindowQuery.');
    },
    enabled: false,
  });

  const logicalWindow = useRef<TPageParam[]>(
    query.data?.pageParams.length
      ? [...query.data.pageParams]
      : [initialPageParam],
  );

  const revision = useRef(0);
  const nextOperationId = useRef(0);
  const latestRefreshId = useRef(0);
  const scheduledRefresh = useRef<RefreshOperation | null>(null);
  const refreshController = useRef<AbortController | null>(null);
  const expansions = useRef<Partial<Record<Direction, ExpandOperation>>>({});
  const expandEpoch = useRef(0);

  const [state, setState] = useState<State>({
    isRefreshing: false,
    expanding: { next: false, previous: false },
  });

  const reportError = useCallback(
    (caught: unknown) => {
      if (caught instanceof Error && caught.name === 'AbortError') return;

      onError?.(
        caught instanceof Error ? caught : new Error('Failed to load pages.'),
      );
    },
    [onError],
  );

  const invalidateExpansions = useCallback(() => {
    expandEpoch.current += 1;

    Object.values(expansions.current).forEach((operation) =>
      operation?.controller.abort(),
    );
  }, []);

  const prepareRefresh = useCallback(() => {
    const operation = {
      id: ++latestRefreshId.current,
      revision: ++revision.current,
    };

    invalidateExpansions();

    refreshController.current?.abort();

    scheduledRefresh.current = operation;

    setState((current) => ({ ...current, isRefreshing: true }));

    return operation;
  }, [invalidateExpansions]);

  const scheduleRefresh = useCallback(() => {
    prepareRefresh();
  }, [prepareRefresh]);

  const refresh = useCallback(async () => {
    const operation = scheduledRefresh.current ?? prepareRefresh();

    scheduledRefresh.current = null;

    const controller = new AbortController();
    const pageParams = [...logicalWindow.current];

    refreshController.current = controller;

    try {
      const pages = await Promise.all(
        pageParams.map((param) => queryFn(param, controller.signal)),
      );

      if (controller.signal.aborted || operation.id !== latestRefreshId.current)
        return;

      const cached =
        queryClient.getQueryData<InfiniteData<TPage, TPageParam>>(queryKey);

      queryClient.setQueryData(
        queryKey,
        mergePages(cached, logicalWindow.current, pageParams, pages),
      );
    } catch (error) {
      if (
        !controller.signal.aborted &&
        operation.id === latestRefreshId.current
      )
        reportError(error);
    } finally {
      if (operation.id === latestRefreshId.current) {
        refreshController.current = null;

        setState((current) => ({
          isRefreshing: false,
          expanding: {
            next:
              current.expanding.next &&
              (expansions.current.next?.revision ?? Infinity) >=
                operation.revision,
            previous:
              current.expanding.previous &&
              (expansions.current.previous?.revision ?? Infinity) >=
                operation.revision,
          },
        }));

        (['next', 'previous'] as const).forEach((direction) => {
          const expansion = expansions.current[direction];

          if (expansion && expansion.revision < operation.revision) {
            delete expansions.current[direction];
          }
        });
      }
    }
  }, [prepareRefresh, queryClient, queryFn, queryKey, reportError]);

  const expand = useCallback(
    async (direction: Direction) => {
      const active = expansions.current[direction];

      if (active) return active.promise;

      const data =
        queryClient.getQueryData<InfiniteData<TPage, TPageParam>>(queryKey);

      const params = data?.pageParams ?? [];
      const pages = data?.pages ?? [];

      const edgeParam =
        direction === 'next'
          ? logicalWindow.current.at(-1)
          : logicalWindow.current[0];

      const edgeIndex = params.findIndex((param) =>
        Object.is(param, edgeParam),
      );

      const edgePage =
        edgeIndex >= 0
          ? pages[edgeIndex]
          : direction === 'next'
            ? pages.at(-1)
            : pages[0];

      const pageParam =
        edgeIndex === -1 && edgeParam !== undefined
          ? edgeParam
          : edgePage
            ? direction === 'next'
              ? getNextPageParam(edgePage, pages)
              : getPreviousPageParam(edgePage, pages)
            : undefined;

      if (pageParam === undefined) return;

      const retryingMissingEdge =
        edgeIndex === -1 && Object.is(edgeParam, pageParam);

      const overflows =
        !retryingMissingEdge && logicalWindow.current.length >= maxPages;

      if (overflows) {
        expandEpoch.current += 1;

        Object.values(expansions.current).forEach((operation) =>
          operation?.controller.abort(),
        );

        expansions.current = {};

        setState((current) => ({
          ...current,
          expanding: { next: false, previous: false },
        }));
      }

      logicalWindow.current = getExpandedWindow(
        logicalWindow.current,
        pageParam,
        direction,
        retryingMissingEdge,
        maxPages,
      );

      const epoch = expandEpoch.current;

      const operation = {
        id: ++nextOperationId.current,
        revision: revision.current,
        controller: new AbortController(),
        promise: Promise.resolve(),
      };

      setState((current) => ({
        ...current,
        expanding: { ...current.expanding, [direction]: true },
      }));

      operation.promise = (async () => {
        try {
          const page = await queryFn(pageParam, operation.controller.signal);

          if (
            operation.controller.signal.aborted ||
            operation.revision !== revision.current ||
            epoch !== expandEpoch.current
          )
            return;

          const cached =
            queryClient.getQueryData<InfiniteData<TPage, TPageParam>>(queryKey);

          queryClient.setQueryData(
            queryKey,
            mergePages(cached, logicalWindow.current, [pageParam], [page]),
          );
        } catch (error) {
          if (
            !operation.controller.signal.aborted &&
            operation.revision === revision.current &&
            epoch === expandEpoch.current
          )
            reportError(error);
        } finally {
          if (
            expansions.current[direction]?.id === operation.id &&
            operation.revision === revision.current &&
            epoch === expandEpoch.current
          ) {
            delete expansions.current[direction];

            setState((current) => ({
              ...current,
              expanding: { ...current.expanding, [direction]: false },
            }));
          }
        }
      })();

      expansions.current[direction] = operation;

      return operation.promise;
    },
    [
      getNextPageParam,
      getPreviousPageParam,
      maxPages,
      queryClient,
      queryFn,
      queryKey,
      reportError,
    ],
  );

  useEffect(() => {
    if (!query.data) void refresh();
  }, [query.data, refresh]);

  useEffect(
    () => () => {
      revision.current += 1;

      latestRefreshId.current += 1;

      refreshController.current?.abort();

      Object.values(expansions.current).forEach((operation) =>
        operation?.controller.abort(),
      );
    },
    [],
  );

  const pages = query.data?.pages ?? [];

  const hasNextPage =
    pages.length > 0 && getNextPageParam(pages.at(-1)!, pages) !== undefined;

  const hasPreviousPage =
    pages.length > 0 && getPreviousPageParam(pages[0], pages) !== undefined;

  const isExpanding = state.expanding.next || state.expanding.previous;

  return {
    ...query,
    data: query.data,
    hasNextPage,
    hasPreviousPage,
    expand,
    fetchNextPage: () => expand('next'),
    fetchPreviousPage: () => expand('previous'),
    isFetchingNextPage: state.expanding.next,
    isFetchingPreviousPage: state.expanding.previous,
    isExpanding,
    isRefreshing: state.isRefreshing,
    isLoading: !query.data && state.isRefreshing,
    isPending: !query.data && state.isRefreshing,
    isFetching: state.isRefreshing || isExpanding,
    scheduleRefresh,
    refresh,
  };
}
