import { useEffect, useMemo, useRef, useState } from 'react';
import {
  hashKey,
  CancelledError,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { PromiseBatch } from '../async/promiseBatch';
import { useLatest } from '../react/useLatest';
import {
  extendAtEdge,
  getQueryPageEntriesByWindow,
  getWindowEdgePageParams,
  pageKey,
  toError,
  type Direction,
  type PagesState,
  type WindowState,
} from './useSlidingWindowQuery.helpers';
import type {
  UseSlidingWindowQueryOptions,
  UseSlidingWindowQueryResult,
} from './useSlidingWindowQuery.types';

/** Загружает независимые страницы через QueryClient и хранит ожидаемое окно отдельно от данных. */
export function useSlidingWindowQuery<TPage, TPageParam>(
  props: UseSlidingWindowQueryOptions<TPage, TPageParam>,
): UseSlidingWindowQueryResult<TPage, TPageParam> {
  const {
    queryKey,
    initialPageParam,
    getNextPageParam,
    getPreviousPageParam,
    placeholderData,
  } = props;

  const queryClient = useQueryClient();
  const queryHash = hashKey(queryKey);

  /** Желаемое окно для загрузки */
  const targetWindowRef = useRef<WindowState<TPageParam>>({
    queryHash,
    pageParams: [initialPageParam],
  });

  /** Загруженные страницы */
  const [pagesState, setPagesState] = useState<PagesState<TPage, TPageParam>>(
    () => ({
      queryHash,
      pageEntries: getQueryPageEntriesByWindow(queryClient, queryKey, [
        initialPageParam,
      ]),
    }),
  );

  /** Актуальные значения для обработчиков, сохранённых потребителем. */
  const latestRef = useLatest({ props, queryHash, pagesState });

  /** Состояние загрузки для конкретного queryKey. */
  const [requestState, setRequestState] = useState(() => ({
    queryHash,
    isLoading: pagesState.pageEntries === undefined,
    isRefreshing: false,
    next: false,
    previous: false,
  }));

  /** Batch запросов refresh, включая присоединившиеся запросы expand */
  const refreshBatchRef = useRef<PromiseBatch<unknown> | undefined>(undefined);

  /** Обработка ошибки */
  function handleError(error: unknown): void {
    latestRef.current.props.onError?.(toError(error));
  }

  /** Запросить конкретную страницу по ее параметрам */
  const queryPage = (
    pageParam: TPageParam,
    { queryKey, queryFn }: Pick<UseSlidingWindowQueryOptions<TPage, TPageParam>, 'queryKey' | 'queryFn'>,
  ) => {
    // Ключ и функция фиксируются вместе, в том числе для повторных попыток.
    return queryClient.query({
      queryKey: [queryKey, pageParam],
      queryFn: ({ signal }) => queryFn(pageParam, signal),
      staleTime: 0,
      // Без observers страницы окна нужно сохранять до явной очистки кеша.
      gcTime: Infinity,
    });
  };

  /** Положить в state страницы, актуальные на момент вызова */
  function publishPages(
    currentQueryHash: string,
    currentQueryKey: typeof queryKey,
  ): void {
    if (targetWindowRef.current.queryHash !== currentQueryHash) return;

    setPagesState({
      queryHash: currentQueryHash,
      pageEntries: getQueryPageEntriesByWindow(
        queryClient,
        currentQueryKey,
        targetWindowRef.current.pageParams,
      ),
    });
  }

  /** Начальная загрузка и переход к новому queryKey */
  useEffect(() => {
    const { props: currentProps, queryHash: currentQueryHash } = latestRef.current;
    const queryChanged = targetWindowRef.current.queryHash !== currentQueryHash;
    const pageParams = [currentProps.initialPageParam];

    if (queryChanged) {
      targetWindowRef.current = { queryHash: currentQueryHash, pageParams };

      refreshBatchRef.current = undefined;
    }

    const pageEntries = getQueryPageEntriesByWindow<TPage, TPageParam>(
      queryClient,
      currentProps.queryKey,
      pageParams,
    );

    if (queryChanged) {
      if (pageEntries !== undefined) {
        setPagesState({ queryHash: currentQueryHash, pageEntries });
      }

      setRequestState({
        queryHash: currentQueryHash,
        isLoading: pageEntries === undefined,
        isRefreshing: false,
        next: false,
        previous: false,
      });
    }

    if (!pageEntries) {
      queryPage(currentProps.initialPageParam, currentProps)
        .then(() => publishPages(currentQueryHash, currentProps.queryKey))
        .catch(handleError)
        .finally(() => {
          if (latestRef.current.queryHash === currentQueryHash) {
            setRequestState((value) => ({ ...value, isLoading: false }));
          }
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryHash]);

  /** Загрузить дополнительную страницу в указанном направлении */
  async function expand(direction: Direction): Promise<void> {
    const {
      props: currentProps,
      queryHash: currentQueryHash,
      pagesState: currentPagesState,
    } = latestRef.current;

    const currentQueryKey = currentProps.queryKey;
    const loadedWindowPages = currentPagesState.pageEntries?.map(({ page }) => page);

    if (
      targetWindowRef.current.queryHash !== currentQueryHash ||
      currentPagesState.queryHash !== currentQueryHash ||
      !loadedWindowPages
    )
      return;

    const pageParam =
      direction === 'next'
        ? currentProps.getNextPageParam(
            loadedWindowPages.at(-1)!,
            loadedWindowPages,
          )
        : currentProps.getPreviousPageParam(
            loadedWindowPages[0],
            loadedWindowPages,
          );

    if (pageParam === undefined) return;

    const alreadyInWindow = targetWindowRef.current.pageParams.some(
      (param) => pageKey(param) === pageKey(pageParam),
    );

    if (alreadyInWindow) {
      const pageState = queryClient.getQueryState([currentQueryKey, pageParam]);

      // Повторяем только завершившийся с ошибкой запрос, не расширяя окно снова.
      if (pageState?.status !== 'error' || pageState.fetchStatus !== 'idle') return;
    } else {
      targetWindowRef.current = {
        queryHash: currentQueryHash,
        pageParams: extendAtEdge(
          targetWindowRef.current.pageParams,
          pageParam,
          direction,
          currentProps.maxPages,
        ),
      };
    }

    setRequestState((value) => ({ ...value, [direction]: true }));

    const pagePromise = queryPage(pageParam, currentProps);

    // Если уже запущен refresh, присоединяемся к нему (для атомарного обновления state)
    if (refreshBatchRef.current) {
      // Публикацией, ошибками и индикаторами общего batch управляет refresh.
      await refreshBatchRef.current.add(pagePromise).collect().catch(() => {});

      return;
    }

    return pagePromise
      .then(() => publishPages(currentQueryHash, currentQueryKey))
      .then(() => {
        if (latestRef.current.queryHash === currentQueryHash) {
          setRequestState((value) => ({ ...value, [direction]: false }));
        }
      })
      .catch((error: unknown) => {
        // При отмене ради refresh индикатор сбросит сам refresh.
        if (error instanceof CancelledError) return;

        if (latestRef.current.queryHash === currentQueryHash) {
          setRequestState((value) => ({ ...value, [direction]: false }));
        }

        handleError(error);
      });
  }

  /** Актуализировать страницы активного окна (инвалидация) */
  async function refresh(): Promise<void> {
    const { props: currentProps, queryHash: currentQueryHash } = latestRef.current;
    const currentQueryKey = currentProps.queryKey;

    if (targetWindowRef.current.queryHash !== currentQueryHash) return;

    setRequestState((value) => ({ ...value, isLoading: false, isRefreshing: true }));

    await queryClient.cancelQueries({ queryKey: [currentQueryKey] });

    // За время отмены пользователь мог переключить выборку.
    if (latestRef.current.queryHash !== currentQueryHash) return;

    const batch = new PromiseBatch();

    targetWindowRef.current.pageParams.forEach((pageParam) => {
      batch.add(queryPage(pageParam, currentProps));
    });

    refreshBatchRef.current = batch;

    await batch
      .collect()
      .then(() => publishPages(currentQueryHash, currentQueryKey))
      .catch(async (error: unknown) => {
        if (error instanceof CancelledError) return;

        if (latestRef.current.queryHash === currentQueryHash && refreshBatchRef.current === batch) {
          await queryClient.cancelQueries({ queryKey: [currentQueryKey] });

          handleError(error);
        }
      })
      .finally(() => {
        if (refreshBatchRef.current === batch) {
          refreshBatchRef.current = undefined;

          if (latestRef.current.queryHash === currentQueryHash) {
            setRequestState((value) => ({
              ...value,
              next: false,
              previous: false,
              isRefreshing: false,
            }));
          }
        }
      });
  }

  /** Переводит хук в состояние обновления без запуска запросов */
  function scheduleRefresh(): void {
    if (targetWindowRef.current.queryHash !== latestRef.current.queryHash) return;

    setRequestState((value) => ({ ...value, isLoading: false, isRefreshing: true }));
  }

  /** Данные на основе pagesState */
  const stateData = useMemo<InfiniteData<TPage, TPageParam> | undefined>(
    () =>
      pagesState.pageEntries
        ? {
            pages: pagesState.pageEntries.map(({ page }) => page),
            pageParams: pagesState.pageEntries.map(
              ({ pageParam }) => pageParam,
            ),
          }
        : undefined,
    [pagesState],
  );

  /** Данные с учетом текущего queryKey */
  const currentQueryData =
    pagesState.queryHash === queryHash ? stateData : undefined;

  /** Отображаемые данные с учетом placeholderData */
  const displayData = useMemo<
    InfiniteData<TPage, TPageParam> | undefined
  >(() => {
    if (currentQueryData !== undefined) return currentQueryData;

    return typeof placeholderData === 'function'
      ? placeholderData(stateData)
      : placeholderData;
  }, [currentQueryData, placeholderData, stateData]);

  const edgeParams = getWindowEdgePageParams(
    currentQueryData?.pages,
    getNextPageParam,
    getPreviousPageParam,
  );

  const isCurrentQuery = requestState.queryHash === queryHash;

  return {
    data: displayData,
    hasNextPage: edgeParams.next !== undefined,
    hasPreviousPage: edgeParams.previous !== undefined,
    loadNextPage: () => expand('next'),
    loadPreviousPage: () => expand('previous'),
    refresh,
    scheduleRefresh,
    isFetchingNextPage: isCurrentQuery && requestState.next,
    isFetchingPreviousPage: isCurrentQuery && requestState.previous,
    isRefreshing: isCurrentQuery && requestState.isRefreshing,
    isLoading: isCurrentQuery && requestState.isLoading,
  };
}
