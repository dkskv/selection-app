/** @vitest-environment happy-dom */
import { createElement, type PropsWithChildren } from 'react';
import { act, renderHook } from '@testing-library/react';
import {
  QueryClient,
  QueryClientProvider,
  type InfiniteData,
} from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSlidingWindowQuery } from './useSlidingWindowQuery';

type Page = { value: number };

const key = ['sliding-window-v4-test'] as const;
let queryClient: QueryClient;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;

    reject = rej;
  });

  return { promise, resolve, reject };
}

function renderSlidingHook(
  queryFn: (pageParam: number, signal: AbortSignal) => Promise<Page>,
  options: {
    queryKey?: readonly unknown[];
    getQueryKey?: () => readonly unknown[];
    getQueryFn?: () => typeof queryFn;
    maxPages?: number;
    onError?: (error: Error) => void;
    placeholderData?:
      | InfiniteData<Page, number>
      | ((previousData: InfiniteData<Page, number> | undefined) =>
          | InfiniteData<Page, number>
          | undefined);
  } = {},
) {
  return renderHook(
    () =>
      useSlidingWindowQuery<Page, number>({
        queryKey: options.getQueryKey?.() ?? options.queryKey ?? key,
        initialPageParam: 0,
        queryFn: options.getQueryFn?.() ?? queryFn,
        getNextPageParam: (lastPage) => {
          const lastPageParam = lastPage.value;

          return lastPageParam === undefined ? undefined : lastPageParam + 1;
        },
        getPreviousPageParam: (firstPage) => {
          const firstPageParam = firstPage.value;

          return firstPageParam === undefined ? undefined : firstPageParam - 1;
        },
        maxPages: options.maxPages ?? 3,
        onError: options.onError,
        placeholderData: options.placeholderData,
      }),
    {
      wrapper: ({ children }: PropsWithChildren) =>
        createElement(QueryClientProvider, { client: queryClient }, children),
    },
  );
}

function seedPage(
  pageParam: number,
  page: Page,
  queryKey: readonly unknown[] = key,
) {
  queryClient.setQueryData([queryKey, pageParam], page);
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();

    await Promise.resolve();
  });
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
});

afterEach(() => {
  queryClient.clear();

  vi.useRealTimers();
});

describe('useSlidingWindowQuery', () => {
  describe('начальная загрузка и смена queryKey', () => {
    it('повторяет запрос старого ключа с его исходной queryFn после смены ключа', async () => {
      vi.useFakeTimers();

      queryClient.setDefaultOptions({
        queries: { retry: 1, retryDelay: 1000, gcTime: Infinity },
      });

      const keyA = [...key, 'retry-A'];
      const keyB = [...key, 'retry-B'];

      const queryFnA = vi.fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValue({ value: 10 });

      const queryFnB = vi.fn().mockResolvedValue({ value: 20 });
      let activeKey = keyA;
      let activeQueryFn = queryFnA;

      const { result, rerender } = renderSlidingHook(queryFnA, {
        getQueryKey: () => activeKey,
        getQueryFn: () => activeQueryFn,
      });

      await flushEffects();

      expect(queryFnA).toHaveBeenCalledTimes(1);

      activeKey = keyB;

      activeQueryFn = queryFnB;

      rerender();

      await flushEffects();

      expect(result.current.data?.pages).toEqual([{ value: 20 }]);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      expect(queryClient.getQueryData([keyA, 0])).toEqual({ value: 10 });

      expect(queryClient.getQueryData([keyB, 0])).toEqual({ value: 20 });

      expect(queryFnA).toHaveBeenCalledTimes(2);

      expect(queryFnB).toHaveBeenCalledTimes(1);

      expect(result.current.data?.pages).toEqual([{ value: 20 }]);
    });

    it('загружает начальную страницу при первом рендере без кеша', async () => {
      const request = deferred<Page>();
      const queryFn = vi.fn(() => request.promise);
      const { result } = renderSlidingHook(queryFn);

      expect(result.current.isLoading).toBe(true);

      expect(queryFn).toHaveBeenCalledTimes(1);

      expect(queryFn).toHaveBeenCalledWith(0, expect.any(AbortSignal));

      request.resolve({ value: 42 });

      await flushEffects();

      expect(result.current.data?.pages).toEqual([{ value: 42 }]);

      expect(result.current.data?.pageParams).toEqual([0]);

      expect(result.current.isLoading).toBe(false);
    });

    it('не включает isLoading для начальной страницы из кеша', () => {
      seedPage(0, { value: 42 });

      const queryFn = vi.fn(() => Promise.resolve({ value: 99 }));
      const { result } = renderSlidingHook(queryFn);

      expect(result.current.isLoading).toBe(false);

      expect(queryFn).not.toHaveBeenCalled();
    });

    it('при смене queryKey начинает с initialPageParam и сохраняет старый кеш', async () => {
      const keyA = ['sliding-window-v4-test', 'A'] as const;
      const keyB = ['sliding-window-v4-test', 'B'] as const;

      seedPage(0, { value: 10 }, keyA);

      seedPage(1, { value: 11 }, keyA);

      let activeKey: readonly unknown[] = keyA;
      const initialB = deferred<Page>();

      const queryFn = vi.fn((pageParam: number) =>
        activeKey === keyB && pageParam === 0
          ? initialB.promise
          : Promise.resolve({ value: pageParam + 20 }),
      );

      const rendered = renderSlidingHook(queryFn, {
        getQueryKey: () => activeKey,
      });

      expect(rendered.result.current.data?.pageParams).toEqual([0]);

      activeKey = keyB;

      rendered.rerender();

      await flushEffects();

      expect(queryFn).toHaveBeenCalledTimes(1);

      expect(queryFn).toHaveBeenCalledWith(0, expect.any(AbortSignal));

      expect(rendered.result.current.data).toBeUndefined();

      expect(rendered.result.current.isLoading).toBe(true);

      expect(queryClient.getQueryData([keyA, 0])).toEqual({ value: 10 });

      expect(queryClient.getQueryData([keyA, 1])).toEqual({ value: 11 });

      initialB.resolve({ value: 20 });

      await flushEffects();

      expect(rendered.result.current.data?.pageParams).toEqual([0]);

      expect(rendered.result.current.data?.pages).toEqual([{ value: 20 }]);

      expect(rendered.result.current.isLoading).toBe(false);

      activeKey = keyA;

      rendered.rerender();

      await flushEffects();

      expect(rendered.result.current.data?.pages).toEqual([{ value: 10 }]);

      expect(rendered.result.current.isLoading).toBe(false);

      expect(queryFn).toHaveBeenCalledTimes(1);
    });

    it('передаёт предыдущие данные в placeholderData при смене queryKey', async () => {
      const keyA = ['sliding-window-v4-test', 'placeholder-A'] as const;
      const keyB = ['sliding-window-v4-test', 'placeholder-B'] as const;

      seedPage(0, { value: 10 }, keyA);

      let activeKey: readonly unknown[] = keyA;
      const initialB = deferred<Page>();
      const queryFn = vi.fn(() => initialB.promise);

      const placeholderData = vi.fn(
        (previousData: InfiniteData<Page, number> | undefined) => previousData,
      );

      const rendered = renderSlidingHook(queryFn, {
        getQueryKey: () => activeKey,
        placeholderData,
      });

      expect(rendered.result.current.data?.pages).toEqual([{ value: 10 }]);

      activeKey = keyB;

      rendered.rerender();

      await flushEffects();

      expect(placeholderData).toHaveBeenCalledWith({
        pages: [{ value: 10 }],
        pageParams: [0],
      });

      expect(rendered.result.current.data).toEqual({
        pages: [{ value: 10 }],
        pageParams: [0],
      });

      expect(rendered.result.current.isLoading).toBe(true);

      expect(rendered.result.current.hasNextPage).toBe(false);

      await act(async () => {
        await rendered.result.current.loadNextPage();
      });

      expect(queryFn).toHaveBeenCalledTimes(1);

      initialB.resolve({ value: 20 });

      await flushEffects();

      expect(rendered.result.current.data).toEqual({
        pages: [{ value: 20 }],
        pageParams: [0],
      });

      expect(rendered.result.current.isLoading).toBe(false);
    });

    it('использует статические placeholderData до загрузки нового queryKey', async () => {
      const keyA = ['sliding-window-v4-test', 'static-placeholder-A'] as const;
      const keyB = ['sliding-window-v4-test', 'static-placeholder-B'] as const;

      seedPage(0, { value: 10 }, keyA);

      let activeKey: readonly unknown[] = keyA;
      const initialB = deferred<Page>();

      const placeholderData: InfiniteData<Page, number> = {
        pages: [{ value: -1 }],
        pageParams: [-1],
      };

      const rendered = renderSlidingHook(() => initialB.promise, {
        getQueryKey: () => activeKey,
        placeholderData,
      });

      activeKey = keyB;

      rendered.rerender();

      await flushEffects();

      expect(rendered.result.current.data).toBe(placeholderData);

      initialB.resolve({ value: 20 });

      await flushEffects();

      expect(rendered.result.current.data).toEqual({
        pages: [{ value: 20 }],
        pageParams: [0],
      });
    });

    it('при прерывании начальной загрузки refresh переключает isLoading на isRefreshing', async () => {
      const initialRequest = deferred<Page>();
      const refreshRequest = deferred<Page>();
      let requestCount = 0;

      const queryFn = vi.fn(() =>
        requestCount++ === 0 ? initialRequest.promise : refreshRequest.promise,
      );

      const { result } = renderSlidingHook(queryFn);

      expect(result.current.isLoading).toBe(true);

      let refreshPromise!: Promise<void>;

      act(() => {
        refreshPromise = result.current.refresh();
      });

      await flushEffects();

      expect(queryFn).toHaveBeenCalledTimes(2);

      expect(result.current.isLoading).toBe(false);

      expect(result.current.isRefreshing).toBe(true);

      refreshRequest.resolve({ value: 42 });

      await act(async () => {
        await refreshPromise;
      });

      expect(result.current.isLoading).toBe(false);

      expect(result.current.isRefreshing).toBe(false);

      expect(result.current.data?.pages).toEqual([{ value: 42 }]);

      initialRequest.resolve({ value: -1 });
    });

    it('не показывает поздний ответ предыдущего queryKey в новом окне', async () => {
      const keyA = ['sliding-window-v4-test', 'late-A'] as const;
      const keyB = ['sliding-window-v4-test', 'late-B'] as const;
      const requestA = deferred<Page>();
      const requestB = deferred<Page>();
      let activeKey: readonly unknown[] = keyA;

      const queryFn = vi.fn(() =>
        activeKey === keyA ? requestA.promise : requestB.promise,
      );

      const rendered = renderSlidingHook(queryFn, {
        getQueryKey: () => activeKey,
      });

      await flushEffects();

      activeKey = keyB;

      rendered.rerender();

      await flushEffects();

      requestA.resolve({ value: -1 });

      await flushEffects();

      expect(rendered.result.current.data).toBeUndefined();

      requestB.resolve({ value: 20 });

      await flushEffects();

      expect(rendered.result.current.data?.pages).toEqual([{ value: 20 }]);

      expect(queryClient.getQueryData([keyA, 0])).toEqual({ value: -1 });
    });

    it('не перезапускает начальную загрузку при новом массиве с тем же queryKey', async () => {
      const request = deferred<Page>();
      const queryFn = vi.fn(() => request.promise);

      const rendered = renderSlidingHook(queryFn, {
        getQueryKey: () => ['sliding-window-v4-test', 'stable-hash'],
      });

      rendered.rerender();

      rendered.rerender();

      expect(queryFn).toHaveBeenCalledTimes(1);

      request.resolve({ value: 1 });

      await flushEffects();

      expect(rendered.result.current.data?.pages).toEqual([{ value: 1 }]);
    });

    it('не позволяет активному expand старого queryKey менять новое окно', async () => {
      const keyA = ['sliding-window-v4-test', 'expand-A'] as const;
      const keyB = ['sliding-window-v4-test', 'expand-B'] as const;

      seedPage(0, { value: 0 }, keyA);

      const expandRequest = deferred<Page>();
      const initialB = deferred<Page>();
      let activeKey: readonly unknown[] = keyA;

      const queryFn = vi.fn((pageParam: number) => {
        if (activeKey === keyA && pageParam === 1) return expandRequest.promise;

        if (activeKey === keyB) return initialB.promise;

        return Promise.resolve({ value: pageParam });
      });

      const rendered = renderSlidingHook(queryFn, {
        getQueryKey: () => activeKey,
      });

      let expandPromise!: Promise<void>;

      act(() => {
        expandPromise = rendered.result.current.loadNextPage();
      });

      activeKey = keyB;

      rendered.rerender();

      await flushEffects();

      expandRequest.resolve({ value: 1 });

      await act(async () => {
        await expandPromise;
      });

      expect(rendered.result.current.data).toBeUndefined();

      expect(rendered.result.current.isFetchingNextPage).toBe(false);

      initialB.resolve({ value: 20 });

      await flushEffects();

      expect(rendered.result.current.data?.pages).toEqual([{ value: 20 }]);
    });

    it('не позволяет активному refresh старого queryKey менять новое окно', async () => {
      const keyA = ['sliding-window-v4-test', 'refresh-A'] as const;
      const keyB = ['sliding-window-v4-test', 'refresh-B'] as const;

      seedPage(0, { value: 0 }, keyA);

      const refreshRequest = deferred<Page>();
      const initialB = deferred<Page>();
      let activeKey: readonly unknown[] = keyA;

      const queryFn = vi.fn(() =>
        activeKey === keyA ? refreshRequest.promise : initialB.promise,
      );

      const rendered = renderSlidingHook(queryFn, {
        getQueryKey: () => activeKey,
      });

      let refreshPromise!: Promise<void>;

      act(() => {
        refreshPromise = rendered.result.current.refresh();
      });

      await flushEffects();

      activeKey = keyB;

      rendered.rerender();

      await flushEffects();

      refreshRequest.resolve({ value: -1 });

      await act(async () => {
        await refreshPromise;
      });

      expect(rendered.result.current.data).toBeUndefined();

      expect(rendered.result.current.isRefreshing).toBe(false);

      initialB.resolve({ value: 20 });

      await flushEffects();

      expect(rendered.result.current.data?.pages).toEqual([{ value: 20 }]);
    });
  });

  describe('расширение окна', () => {
    it('сохранённый loadNextPage использует актуальные страницы и новый ключ', async () => {
      const keyA = [...key, 'saved-A'];
      const keyB = [...key, 'saved-B'];
      let activeKey = keyA;
      const queryFnA = vi.fn((pageParam: number) => Promise.resolve({ value: pageParam }));
      const queryFnB = vi.fn((pageParam: number) => Promise.resolve({ value: pageParam }));
      let activeQueryFn = queryFnA;

      const { result, rerender } = renderSlidingHook(queryFnA, {
        getQueryKey: () => activeKey,
        getQueryFn: () => activeQueryFn,
      });

      await flushEffects();

      const loadNextPage = result.current.loadNextPage;

      await act(async () => { await loadNextPage(); });

      await act(async () => { await loadNextPage(); });

      expect(result.current.data?.pageParams).toEqual([0, 1, 2]);

      activeKey = keyB;

      activeQueryFn = queryFnB;

      rerender();

      await flushEffects();

      await act(async () => { await loadNextPage(); });

      expect(result.current.data?.pageParams).toEqual([0, 1]);

      expect(queryFnA.mock.calls.map(([param]) => param)).toEqual([0, 1, 2]);

      expect(queryFnB.mock.calls.map(([param]) => param)).toEqual([0, 1]);

      expect(queryClient.getQueryData([keyB, 1])).toEqual({ value: 1 });
    });

    it('сохраняет загруженные страницы при расширении после долгого простоя', async () => {
      vi.useFakeTimers();

      queryClient.setDefaultOptions({ queries: { retry: false, gcTime: 1000 } });

      const queryFn = vi.fn((pageParam: number) =>
        Promise.resolve({ value: pageParam }),
      );

      const { result } = renderSlidingHook(queryFn);

      await flushEffects();

      await act(async () => {
        await result.current.loadNextPage();
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
      });

      await act(async () => {
        await result.current.loadNextPage();
      });

      expect(result.current.data).toEqual({
        pages: [{ value: 0 }, { value: 1 }, { value: 2 }],
        pageParams: [0, 1, 2],
      });

      expect(queryFn.mock.calls.map(([param]) => param)).toEqual([0, 1, 2]);
    });

    it('расширяет окно с обоих краёв и ограничивает его maxPages', async () => {
      seedPage(0, { value: 0 });

      const queryFn = vi.fn((pageParam: number) =>
        Promise.resolve({ value: pageParam }),
      );

      const { result } = renderSlidingHook(queryFn, { maxPages: 2 });

      await act(async () => {
        await result.current.loadNextPage();
      });

      expect(result.current.data?.pageParams).toEqual([0, 1]);

      await act(async () => {
        await result.current.loadNextPage();
      });

      expect(result.current.data?.pageParams).toEqual([1, 2]);

      await act(async () => {
        await result.current.loadPreviousPage();
      });

      expect(result.current.data?.pageParams).toEqual([0, 1]);

      expect(queryFn.mock.calls.map(([pageParam]) => pageParam)).toEqual([
        1, 2, 0,
      ]);
    });

    it('позволяет расширяться в обоих направлениях, если в окне есть место', async () => {
      seedPage(0, { value: 0 });

      const nextRequest = deferred<Page>();
      const previousRequest = deferred<Page>();

      const queryFn = vi.fn((pageParam: number) => {
        if (pageParam === 1) return nextRequest.promise;

        if (pageParam === -1) return previousRequest.promise;

        return Promise.resolve({ value: pageParam });
      });

      const { result } = renderSlidingHook(queryFn, { maxPages: 3 });

      let nextPromise!: Promise<void>;
      let previousPromise!: Promise<void>;

      act(() => {
        nextPromise = result.current.loadNextPage();

        previousPromise = result.current.loadPreviousPage();
      });

      expect(result.current.isFetchingNextPage).toBe(true);

      expect(result.current.isFetchingPreviousPage).toBe(true);

      expect(queryFn.mock.calls.map(([pageParam]) => pageParam)).toEqual([
        1, -1,
      ]);

      nextRequest.resolve({ value: 1 });

      previousRequest.resolve({ value: -1 });

      await act(async () => {
        await Promise.all([nextPromise, previousPromise]);
      });

      expect(result.current.data?.pageParams).toEqual([-1, 0, 1]);

      expect(result.current.data?.pages).toEqual([
        { value: -1 },
        { value: 0 },
        { value: 1 },
      ]);
    });

    it('не запрашивает следующую страницу при повторном expand до завершения текущего', async () => {
      seedPage(0, { value: 0 });

      const nextRequest = deferred<Page>();

      const queryFn = vi.fn((pageParam: number) =>
        pageParam === 1
          ? nextRequest.promise
          : Promise.resolve({ value: pageParam }),
      );

      const { result } = renderSlidingHook(queryFn);
      let firstExpand!: Promise<void>;
      let repeatedExpand!: Promise<void>;

      act(() => {
        firstExpand = result.current.loadNextPage();

        repeatedExpand = result.current.loadNextPage();
      });

      expect(queryFn.mock.calls.map(([pageParam]) => pageParam)).toEqual([1]);

      nextRequest.resolve({ value: 1 });

      await act(async () => {
        await Promise.all([firstExpand, repeatedExpand]);
      });

      expect(result.current.data?.pageParams).toEqual([0, 1]);

      expect(queryFn.mock.calls.map(([pageParam]) => pageParam)).toEqual([1]);
    });
  });

  describe('refresh', () => {
    it.each([0, 1, 2])(
      'при ошибке страницы %s отменяет остальные запросы refresh с expand и сохраняет старое окно',
      async (failedPage) => {
        seedPage(0, { value: 0 });

        const requests = [deferred<Page>(), deferred<Page>(), deferred<Page>()];
        const error = new Error('Refresh failed');
        const onError = vi.fn();
        const signals = new Map<number, AbortSignal>();

        const queryFn = vi.fn<(pageParam: number, signal: AbortSignal) => Promise<Page>>(
          (pageParam) => Promise.resolve({ value: pageParam }),
        );

        const { result } = renderSlidingHook(queryFn, { onError });

        await act(async () => {
          await result.current.loadNextPage();
        });

        const oldData = result.current.data;

        queryFn.mockImplementation((pageParam, signal) => {
          signals.set(pageParam, signal);

          return requests[pageParam]!.promise;
        });

        let refreshPromise!: Promise<void>;

        act(() => { refreshPromise = result.current.refresh(); });

        await flushEffects();

        let expandPromise!: Promise<void>;

        act(() => { expandPromise = result.current.loadNextPage(); });

        await flushEffects();

        await act(async () => {
          requests[failedPage]!.reject(error);

          await Promise.all([refreshPromise, expandPromise]);
        });

        for (const pageParam of [0, 1, 2].filter((page) => page !== failedPage)) {
          expect(signals.get(pageParam)?.aborted).toBe(true);

          expect(queryClient.getQueryState([key, pageParam])?.fetchStatus).toBe('idle');
        }

        expect(onError).toHaveBeenCalledExactlyOnceWith(error);

        expect(result.current.isRefreshing).toBe(false);

        expect(result.current.isFetchingNextPage).toBe(false);

        expect(result.current.data).toBe(oldData);

        await act(async () => {
          requests.forEach((request, pageParam) => request.resolve({ value: pageParam + 100 }));
        });

        expect(result.current.data).toBe(oldData);

        expect(onError).toHaveBeenCalledTimes(1);

        queryFn.mockImplementation((pageParam) => Promise.resolve({ value: pageParam + 200 }));

        await act(async () => { await result.current.refresh(); });

        expect(result.current.data?.pages).toEqual([{ value: 200 }, { value: 201 }, { value: 202 }]);
      },
    );

    it('не запускает страницы старого ключа, если ключ сменился во время отмены запросов', async () => {
      const keyA = [...key, 'cancel-A'];
      const keyB = [...key, 'cancel-B'];

      seedPage(0, { value: 10 }, keyA);

      let activeKey = keyA;
      let finishCancellation!: () => void;

      const cancellation = new Promise<void>((resolve) => {
        finishCancellation = resolve;
      });

      const cancelQueries = vi.spyOn(queryClient, 'cancelQueries')
        .mockImplementationOnce(() => cancellation);

      const initialB = deferred<Page>();
      const queryFn = vi.fn(() => initialB.promise);

      const { result, rerender } = renderSlidingHook(queryFn, {
        getQueryKey: () => activeKey,
      });

      let refreshPromise!: Promise<void>;

      try {
        act(() => {
          refreshPromise = result.current.refresh();
        });

        expect(cancelQueries).toHaveBeenCalledWith({ queryKey: [keyA] });

        activeKey = keyB;

        rerender();

        await flushEffects();

        expect(queryFn).toHaveBeenCalledTimes(1);

        await act(async () => {
          finishCancellation();
        });

        expect(queryFn).toHaveBeenCalledTimes(1);

        expect(result.current.isLoading).toBe(true);

        expect(result.current.isRefreshing).toBe(false);

        expect(queryClient.getQueryState([keyA, 0])?.fetchStatus).toBe('idle');

        initialB.resolve({ value: 20 });

        await flushEffects();

        expect(result.current.data?.pages).toEqual([{ value: 20 }]);

        expect(queryClient.getQueryData([keyA, 0])).toEqual({ value: 10 });

        await refreshPromise;
      } finally {
        finishCancellation();

        cancelQueries.mockRestore();
      }
    });

    it.each(['refresh', 'scheduleRefresh'] as const)(
      '%s показывает обновление нового ключа, пока placeholder хранит старые данные',
      async (method) => {
        const keyA = [...key, 'A'];
        const keyB = [...key, 'B'];

        seedPage(0, { value: 10 }, keyA);

        let activeKey = keyA;
        const initialRequest = deferred<Page>();
        const refreshRequest = deferred<Page>();

        const queryFn = vi.fn()
          .mockImplementationOnce(() => initialRequest.promise)
          .mockImplementationOnce(() => refreshRequest.promise);

        const { result, rerender } = renderSlidingHook(queryFn, {
          getQueryKey: () => activeKey,
          placeholderData: (previousData) => previousData,
        });

        activeKey = keyB;

        rerender();

        await flushEffects();

        expect(result.current.isLoading).toBe(true);

        let refreshPromise: Promise<void> | void;

        act(() => {
          refreshPromise = result.current[method]();
        });

        await flushEffects();

        expect(result.current.isLoading).toBe(false);

        expect(result.current.isRefreshing).toBe(true);

        expect(result.current.data?.pages).toEqual([{ value: 10 }]);

        expect(queryFn).toHaveBeenCalledTimes(method === 'refresh' ? 2 : 1);

        if (method === 'scheduleRefresh') {
          act(() => {
            refreshPromise = result.current.refresh();
          });

          await flushEffects();

          expect(result.current.isRefreshing).toBe(true);
        }

        await act(async () => {
          refreshRequest.resolve({ value: 20 });

          await refreshPromise;
        });

        expect(result.current.isRefreshing).toBe(false);

        expect(result.current.data?.pages).toEqual([{ value: 20 }]);

        await act(async () => {
          initialRequest.resolve({ value: -1 });
        });

        expect(result.current.data?.pages).toEqual([{ value: 20 }]);
      },
    );

    it('scheduleRefresh включает состояние обновления без запроса до вызова refresh', async () => {
      seedPage(0, { value: 0 });

      const request = deferred<Page>();
      const queryFn = vi.fn(() => request.promise);
      const { result } = renderSlidingHook(queryFn);

      act(() => {
        result.current.scheduleRefresh();
      });

      expect(queryFn).not.toHaveBeenCalled();

      expect(result.current.isRefreshing).toBe(true);

      let refreshPromise!: Promise<void>;

      act(() => {
        refreshPromise = result.current.refresh();
      });

      await flushEffects();

      expect(queryFn).toHaveBeenCalledTimes(1);

      request.resolve({ value: 10 });

      await act(async () => {
        await refreshPromise;
      });

      expect(result.current.isRefreshing).toBe(false);

      expect(result.current.data?.pages).toEqual([{ value: 10 }]);
    });

    it('повторный scheduleRefresh не запускает лишние запросы', async () => {
      seedPage(0, { value: 0 });

      const request = deferred<Page>();
      const queryFn = vi.fn(() => request.promise);
      const { result } = renderSlidingHook(queryFn);

      act(() => {
        result.current.scheduleRefresh();

        result.current.scheduleRefresh();
      });

      expect(queryFn).not.toHaveBeenCalled();

      expect(result.current.isRefreshing).toBe(true);

      let refreshPromise!: Promise<void>;

      act(() => {
        refreshPromise = result.current.refresh();
      });

      await flushEffects();

      expect(queryFn).toHaveBeenCalledTimes(1);

      request.resolve({ value: 20 });

      await act(async () => {
        await refreshPromise;
      });

      expect(result.current.isRefreshing).toBe(false);
    });

    it('оставляет состояние запланированного обновления, если refresh не вызван', () => {
      seedPage(0, { value: 0 });

      const queryFn = vi.fn(() => Promise.resolve({ value: 1 }));
      const { result } = renderSlidingHook(queryFn);

      act(() => {
        result.current.scheduleRefresh();
      });

      expect(queryFn).not.toHaveBeenCalled();

      expect(result.current.isRefreshing).toBe(true);
    });

    it('оставляет данные видимыми и параллельно перезагружает страницы окна', async () => {
      seedPage(0, { value: 0 });

      const refreshRequests = [deferred<Page>(), deferred<Page>()];
      let isRefreshing = false;

      const queryFn = vi.fn((pageParam: number) =>
        isRefreshing
          ? refreshRequests[pageParam]!.promise
          : Promise.resolve({ value: pageParam }),
      );

      const { result } = renderSlidingHook(queryFn);

      await act(async () => {
        await result.current.loadNextPage();
      });

      isRefreshing = true;

      let refreshPromise!: Promise<void>;

      act(() => {
        refreshPromise = result.current.refresh();
      });

      await flushEffects();

      expect(queryFn.mock.calls.map(([pageParam]) => pageParam)).toEqual([
        1, 0, 1,
      ]);

      expect(result.current.data?.pages).toEqual([{ value: 0 }, { value: 1 }]);

      expect(result.current.isRefreshing).toBe(true);

      refreshRequests[0]!.resolve({ value: 10 });

      refreshRequests[1]!.resolve({ value: 11 });

      await act(async () => {
        await refreshPromise;
      });

      expect(result.current.data?.pages).toEqual([
        { value: 10 },
        { value: 11 },
      ]);

      expect(result.current.isRefreshing).toBe(false);
    });

    it('добавляет expand в активный refresh и ждёт завершения batch', async () => {
      seedPage(0, { value: 0 });

      const refreshRequest = deferred<Page>();
      const expandRequest = deferred<Page>();
      let isRefreshing = false;

      const queryFn = vi.fn((pageParam: number) => {
        if (!isRefreshing) return Promise.resolve({ value: pageParam });

        return pageParam === 0 ? refreshRequest.promise : expandRequest.promise;
      });

      const { result } = renderSlidingHook(queryFn);
      let refreshPromise!: Promise<void>;

      isRefreshing = true;

      act(() => {
        refreshPromise = result.current.refresh();
      });

      await flushEffects();

      let expandPromise!: Promise<void>;

      act(() => {
        expandPromise = result.current.loadNextPage();
      });

      await flushEffects();

      expect(queryFn.mock.calls.map(([pageParam]) => pageParam)).toEqual([
        0, 1,
      ]);

      expect(result.current.isFetchingNextPage).toBe(true);

      expandRequest.resolve({ value: 101 });

      await flushEffects();

      expect(result.current.isFetchingNextPage).toBe(true);

      expect(result.current.data?.pageParams).toEqual([0]);

      refreshRequest.resolve({ value: 100 });

      await act(async () => {
        await Promise.all([refreshPromise, expandPromise]);
      });

      expect(result.current.data?.pageParams).toEqual([0, 1]);

      expect(result.current.data?.pages).toEqual([
        { value: 100 },
        { value: 101 },
      ]);

      expect(result.current.isFetchingNextPage).toBe(false);

      expect(result.current.isRefreshing).toBe(false);
    });

    it('сохраняет состояние expand до завершения refresh, отменившего его запрос', async () => {
      seedPage(0, { value: 0 });

      const onError = vi.fn();
      const expandRequest = deferred<Page>();
      const refreshRequests = [deferred<Page>(), deferred<Page>()];
      let isFirstExpand = true;
      let refreshIndex = 0;

      const { result } = renderSlidingHook((pageParam, signal) => {
        if (pageParam === 1 && isFirstExpand) {
          isFirstExpand = false;

          signal.addEventListener('abort', () => {
            expandRequest.reject(new DOMException('Aborted', 'AbortError'));
          });

          return expandRequest.promise;
        }

        return refreshRequests[refreshIndex++]!.promise;
      }, { onError });

      let expandPromise!: Promise<void>;

      act(() => {
        expandPromise = result.current.loadNextPage();
      });

      await flushEffects();

      expect(result.current.isFetchingNextPage).toBe(true);

      let refreshPromise!: Promise<void>;

      act(() => {
        refreshPromise = result.current.refresh();
      });

      await flushEffects();

      const isExpandStillLoading = result.current.isFetchingNextPage;

      expect(onError).not.toHaveBeenCalled();

      refreshRequests[0]!.resolve({ value: 10 });

      refreshRequests[1]!.resolve({ value: 11 });

      await act(async () => {
        await Promise.all([expandPromise, refreshPromise]);
      });

      expect(isExpandStillLoading).toBe(true);

      expect(onError).not.toHaveBeenCalled();

      expect(result.current.isFetchingNextPage).toBe(false);

      expect(result.current.data?.pageParams).toEqual([0, 1]);
    });

    it('не сбрасывает состояние нового refresh при завершении предыдущего', async () => {
      seedPage(0, { value: 0 });

      const refreshRequests = [deferred<Page>(), deferred<Page>()];
      let refreshIndex = 0;
      const queryFn = vi.fn(() => refreshRequests[refreshIndex++]!.promise);
      const { result } = renderSlidingHook(queryFn);
      let firstRefresh!: Promise<void>;
      let secondRefresh!: Promise<void>;

      act(() => {
        firstRefresh = result.current.refresh();
      });

      await flushEffects();

      act(() => {
        secondRefresh = result.current.refresh();
      });

      await flushEffects();

      refreshRequests[1]!.resolve({ value: 2 });

      await act(async () => {
        await secondRefresh;
      });

      refreshRequests[0]!.resolve({ value: 1 });

      await act(async () => {
        await firstRefresh;
      });

      expect(result.current.data?.pages).toEqual([{ value: 2 }]);

      expect(result.current.isRefreshing).toBe(false);
    });
  });

  describe('ошибки', () => {
    it.each(['next', 'previous'] as const)(
      'сбрасывает индикатор после ошибки %s и повторяет страницу без повторного расширения окна',
      async (direction) => {
        seedPage(0, { value: 0 });

        const error = new Error('Page request failed');
        const firstRequest = deferred<Page>();
        const retryRequest = deferred<Page>();
        const onError = vi.fn();

        const queryFn = vi.fn()
          .mockImplementationOnce(() => firstRequest.promise)
          .mockImplementationOnce(() => retryRequest.promise);

        const { result } = renderSlidingHook(queryFn, { maxPages: 1, onError });

        const loadPage = () => direction === 'next'
          ? result.current.loadNextPage()
          : result.current.loadPreviousPage();

        const isFetching = () => direction === 'next'
          ? result.current.isFetchingNextPage
          : result.current.isFetchingPreviousPage;

        const pageParam = direction === 'next' ? 1 : -1;
        let firstExpand!: Promise<void>;

        act(() => {
          firstExpand = loadPage();
        });

        expect(isFetching()).toBe(true);

        await act(async () => {
          firstRequest.reject(error);

          await firstExpand;
        });

        expect(isFetching()).toBe(false);

        expect(onError).toHaveBeenCalledExactlyOnceWith(error);

        expect(result.current.data?.pageParams).toEqual([0]);

        let retryExpand!: Promise<void>;

        act(() => {
          retryExpand = loadPage();
        });

        expect(isFetching()).toBe(true);

        expect(queryFn.mock.calls.map(([param]) => param)).toEqual([pageParam, pageParam]);

        await act(async () => {
          await loadPage();
        });

        expect(queryFn).toHaveBeenCalledTimes(2);

        await act(async () => {
          retryRequest.resolve({ value: pageParam });

          await retryExpand;
        });

        expect(isFetching()).toBe(false);

        expect(result.current.data).toEqual({
          pages: [{ value: pageParam }],
          pageParams: [pageParam],
        });

        expect(onError).toHaveBeenCalledTimes(1);
      },
    );

    it('сообщает об ошибке загрузки страницы', async () => {
      const error = new Error('request failed');
      const onError = vi.fn();
      const queryFn = vi.fn(() => Promise.reject(error));

      renderSlidingHook(queryFn, { onError });

      await flushEffects();

      expect(onError).toHaveBeenCalledWith(error);
    });
  });
});
