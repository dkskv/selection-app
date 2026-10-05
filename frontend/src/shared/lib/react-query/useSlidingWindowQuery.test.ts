/** @vitest-environment happy-dom */
import { createElement, type PropsWithChildren } from 'react';
import { act, renderHook as renderRealHook } from '@testing-library/react';
import {
  QueryClient,
  QueryClientProvider,
  type InfiniteData,
} from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSlidingWindowQuery } from './useSlidingWindowQuery';

type Page = { value: number; next?: number; previous?: number };

const key = ['sliding-window-test'] as const;
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

function renderHook(
  queryFn: (param: number, signal: AbortSignal) => Promise<Page>,
  maxPages = 3,
) {
  const rendered = renderRealHook(
    () =>
      useSlidingWindowQuery<Page, number>({
        queryKey: key,
        initialPageParam: 0,
        queryFn,
        getNextPageParam: (page) => page.next,
        getPreviousPageParam: (page) => page.previous,
        maxPages,
      }),
    {
      wrapper: ({ children }: PropsWithChildren) =>
        createElement(QueryClientProvider, { client: queryClient }, children),
    },
  );

  const result = new Proxy({} as typeof rendered.result.current, {
    get: (_target, property) => {
      const value =
        rendered.result.current[
          property as keyof typeof rendered.result.current
        ];

      if (typeof value !== 'function') return value;

      return (...args: unknown[]) => {
        let output: unknown;

        act(() => {
          output = Reflect.apply(value, undefined, args);
        });

        return output;
      };
    },
  });

  return {
    result,
    rerender: () => {
      rendered.rerender();

      return rendered.result.current;
    },
  };
}

function seed(pages: Page[], pageParams: number[]) {
  queryClient.setQueryData(key, { pages, pageParams });
}

function cachedData() {
  return queryClient.getQueryData<InfiniteData<Page, number>>(key);
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
});

afterEach(() => {
  queryClient.clear();
});

describe('Хук useSlidingWindowQuery', () => {
  it('игнорирует результат обновления, вытесненного более новым обновлением', async () => {
    seed([{ value: 0, next: 1 }], [0]);

    const oldRequest = deferred<Page>();
    const newRequest = deferred<Page>();
    let calls = 0;

    const { result } = renderHook(() =>
      ++calls === 1 ? oldRequest.promise : newRequest.promise,
    );

    const oldRefresh = result.refresh();
    const newRefresh = result.refresh();

    newRequest.resolve({ value: 10 });

    await newRefresh;

    oldRequest.resolve({ value: -1 });

    await oldRefresh;

    expect(cachedData()?.pages).toEqual([{ value: 10 }]);
  });

  it('планирует обновление без запроса данных и запускает его после подтверждения', async () => {
    seed([{ value: 0 }], [0]);

    const request = deferred<Page>();
    const queryFn = vi.fn(() => request.promise);
    const { result, rerender } = renderHook(queryFn);

    result.scheduleRefresh();

    expect(queryFn).not.toHaveBeenCalled();

    expect(rerender().isRefreshing).toBe(true);

    const refresh = result.refresh();

    expect(queryFn).toHaveBeenCalledTimes(1);

    request.resolve({ value: 5 });

    await refresh;

    expect(rerender().isRefreshing).toBe(false);
  });

  it('использует последнее расписание и не запускает повторное обновление', async () => {
    seed([{ value: 0 }], [0]);

    const request = deferred<Page>();
    const queryFn = vi.fn(() => request.promise);
    const { result } = renderHook(queryFn);

    result.scheduleRefresh();

    result.scheduleRefresh();

    expect(queryFn).not.toHaveBeenCalled();

    const refresh = result.refresh();

    expect(queryFn).toHaveBeenCalledTimes(1);

    request.resolve({ value: 2 });

    await refresh;

    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it('сохраняет состояние запланированного обновления, если запрос не последовал', () => {
    seed([{ value: 0 }], [0]);

    const queryFn = vi.fn(() => Promise.resolve({ value: 1 }));
    const { result, rerender } = renderHook(queryFn);

    result.scheduleRefresh();

    expect(queryFn).not.toHaveBeenCalled();

    expect(rerender().isRefreshing).toBe(true);
  });

  it('сохраняет логическую страницу расширения при обновлении после отмены её запроса', async () => {
    seed([{ value: 0, next: 1 }], [0]);

    const expandRequest = deferred<Page>();
    const refreshed: number[] = [];
    let expandCalled = false;

    const queryFn = (param: number, signal: AbortSignal) => {
      if (param === 1 && !expandCalled) {
        expandCalled = true;

        signal.addEventListener('abort', () =>
          expandRequest.reject(new DOMException('Отменено', 'AbortError')),
        );

        return expandRequest.promise;
      }

      refreshed.push(param);

      return Promise.resolve({ value: param });
    };

    const { result, rerender } = renderHook(queryFn);

    const expand = result.fetchNextPage();
    const refresh = result.refresh();

    await Promise.all([expand, refresh]);

    rerender();

    expect(refreshed).toEqual([0, 1]);

    expect(cachedData()?.pageParams).toEqual([0, 1]);
  });

  it.each([true, false])(
    'позволяет обновлению и последующему расширению независимо фиксировать результат (сначала обновление: %s)',
    async (refreshFinishesFirst) => {
      const pageParams = [10, 11, 12, 13, 14];

      seed(
        pageParams.map((value) => ({
          value,
          previous: value - 1,
          next: value + 1,
        })),
        pageParams,
      );

      const refreshRequests = new Map(
        pageParams.map((param) => [param, deferred<Page>()]),
      );

      const expandRequest = deferred<Page>();
      const signals: AbortSignal[] = [];

      const { result } = renderHook((param, signal) => {
        signals.push(signal);

        return param === 15
          ? expandRequest.promise
          : refreshRequests.get(param)!.promise;
      }, 6);

      const refresh = result.refresh();
      const expand = result.fetchNextPage();

      expect(signals.every((signal) => !signal.aborted)).toBe(true);

      const resolveRefresh = () => {
        pageParams.forEach((param) =>
          refreshRequests.get(param)!.resolve({
            value: param * 10,
            previous: param - 1,
            next: param + 1,
          }),
        );
      };

      if (refreshFinishesFirst) {
        resolveRefresh();

        await refresh;

        expect(cachedData()?.pageParams).toEqual(pageParams);
      } else {
        expandRequest.resolve({ value: 150, previous: 14, next: 16 });

        await expand;

        expect(cachedData()?.pageParams).toEqual([...pageParams, 15]);
      }

      if (refreshFinishesFirst) {
        expandRequest.resolve({ value: 150, previous: 14, next: 16 });
      } else {
        resolveRefresh();
      }

      await Promise.all([refresh, expand]);

      expect(cachedData()?.pageParams).toEqual([...pageParams, 15]);

      expect(cachedData()?.pages.map(({ value }) => value)).toEqual([
        100, 110, 120, 130, 140, 150,
      ]);
    },
  );

  it('сохраняет состояние загрузки расширения, пока обновление не завершит отменённую операцию', async () => {
    seed([{ value: 0, next: 1 }], [0]);

    const expandRequest = deferred<Page>();
    const refreshRequests = [deferred<Page>(), deferred<Page>()];
    let firstExpand = true;
    let refreshIndex = 0;

    const { result, rerender } = renderHook((param) => {
      if (param === 1 && firstExpand) {
        firstExpand = false;

        return expandRequest.promise;
      }

      if (param === 0 || param === 1) {
        return refreshRequests[refreshIndex++].promise;
      }

      return Promise.resolve({ value: param });
    });

    const expand = result.fetchNextPage();

    rerender();

    expect(rerender().isFetchingNextPage).toBe(true);

    const refresh = result.refresh();

    expect(rerender().isFetchingNextPage).toBe(true);

    expandRequest.resolve({ value: 1 });

    await expand;

    expect(rerender().isFetchingNextPage).toBe(true);

    refreshRequests[0].resolve({ value: 0, next: 1 });

    refreshRequests[1].resolve({ value: 1 });

    await refresh;

    expect(rerender().isFetchingNextPage).toBe(false);
  });

  it('обрабатывает расширение после scheduleRefresh так же, как после refresh', async () => {
    seed([{ value: 0, next: 1 }], [0]);

    const expandRequest = deferred<Page>();
    const refreshRequest = deferred<Page>();
    const signals: AbortSignal[] = [];
    const requestedParams: number[] = [];

    const { result, rerender } = renderHook((param, signal) => {
      signals.push(signal);

      requestedParams.push(param);

      return param === 1 ? expandRequest.promise : refreshRequest.promise;
    });

    result.scheduleRefresh();

    const expand = result.fetchNextPage();
    const refresh = result.refresh();

    expect(signals.every((signal) => !signal.aborted)).toBe(true);

    expect(rerender().isRefreshing).toBe(true);

    expect(rerender().isExpanding).toBe(true);

    expandRequest.resolve({ value: 1 });

    await expand;

    expect(rerender().isExpanding).toBe(false);

    refreshRequest.resolve({ value: 0, next: 1 });

    await refresh;

    expect(requestedParams).toEqual([1, 0, 1]);

    expect(cachedData()?.pageParams).toEqual([0, 1]);
  });

  it('отменяет расширение до запланированного обновления, но сохраняет его состояние загрузки до завершения обновления', async () => {
    seed([{ value: 0, next: 1 }], [0]);

    const expandRequest = deferred<Page>();
    const refreshRequests = [deferred<Page>(), deferred<Page>()];
    let firstExpand = true;
    let refreshIndex = 0;
    const signals: AbortSignal[] = [];

    const { result, rerender } = renderHook((param, signal) => {
      signals.push(signal);

      if (param === 1 && firstExpand) {
        firstExpand = false;

        return expandRequest.promise;
      }

      return refreshRequests[refreshIndex++].promise;
    });

    const expand = result.fetchNextPage();

    expect(rerender().isExpanding).toBe(true);

    result.scheduleRefresh();

    expect(signals[0].aborted).toBe(true);

    expect(rerender().isRefreshing).toBe(true);

    expect(rerender().isFetchingNextPage).toBe(true);

    const refresh = result.refresh();

    expandRequest.resolve({ value: 99, previous: 0 });

    await expand;

    expect(rerender().isFetchingNextPage).toBe(true);

    expect(cachedData()?.pages).toEqual([{ value: 0, next: 1 }]);

    refreshRequests[0].resolve({ value: 10, next: 1 });

    refreshRequests[1].resolve({ value: 11 });

    await refresh;

    expect(rerender().isFetchingNextPage).toBe(false);

    expect(cachedData()?.pages).toEqual([
      { value: 10, next: 1 },
      { value: 11 },
    ]);
  });

  it('игнорирует повторное расширение в том же направлении', async () => {
    seed([{ value: 0, next: 1 }], [0]);

    const request = deferred<Page>();
    const queryFn = vi.fn(() => request.promise);
    const { result } = renderHook(queryFn);

    const first = result.fetchNextPage();
    const second = result.fetchNextPage();

    expect(queryFn).toHaveBeenCalledTimes(1);

    request.resolve({ value: 1 });

    await Promise.all([first, second]);
  });

  it('отменяет ожидающее расширение, если расширение в обратном направлении переполняет окно', async () => {
    seed(
      [
        { value: 1, previous: 0, next: 2 },
        { value: 2, previous: 1, next: 3 },
        { value: 3, previous: 2, next: 4 },
      ],
      [1, 2, 3],
    );

    const nextRequest = deferred<Page>();

    const queryFn = (param: number, signal: AbortSignal) => {
      if (param === 4) {
        signal.addEventListener('abort', () =>
          nextRequest.reject(new DOMException('Отменено', 'AbortError')),
        );

        return nextRequest.promise;
      }

      return Promise.resolve({ value: param, next: 4 });
    };

    const { result } = renderHook(queryFn);

    const next = result.fetchNextPage();
    const previous = result.fetchPreviousPage();

    await Promise.all([next, previous]);

    expect(cachedData()?.pageParams).toEqual([1, 2, 3]);

    expect(cachedData()?.pages.map(({ value }) => value)).toEqual([1, 2, 3]);
  });

  it('позволяет расширениям в противоположных направлениях завершиться, если в окне есть место', async () => {
    seed([{ value: 0, previous: -1, next: 1 }], [0]);

    const nextRequest = deferred<Page>();
    const previousRequest = deferred<Page>();

    const { result, rerender } = renderHook((param) => {
      if (param === 1) return nextRequest.promise;

      if (param === -1) return previousRequest.promise;

      return Promise.resolve({ value: param });
    });

    const next = result.fetchNextPage();
    const previous = result.fetchPreviousPage();

    expect(rerender().isFetchingNextPage).toBe(true);

    expect(rerender().isFetchingPreviousPage).toBe(true);

    nextRequest.resolve({ value: 1, previous: 0 });

    previousRequest.resolve({ value: -1, next: 0 });

    await Promise.all([next, previous]);

    expect(cachedData()?.pageParams).toEqual([-1, 0, 1]);

    expect(cachedData()?.pages.map(({ value }) => value)).toEqual([-1, 0, 1]);
  });

  it('сохраняет расширенное логическое окно при ошибке загрузки страницы', async () => {
    seed([{ value: 0, next: 1 }], [0]);

    const refreshed: number[] = [];
    let shouldFailExpand = true;

    const { result } = renderHook((param) => {
      if (param === 1 && shouldFailExpand) {
        shouldFailExpand = false;

        return Promise.reject(new Error('Не удалось загрузить страницу'));
      }

      refreshed.push(param);

      return Promise.resolve({ value: param });
    });

    await result.fetchNextPage();

    await result.refresh();

    expect(cachedData()?.pageParams).toEqual([0, 1]);

    expect(refreshed).toEqual([0, 1]);
  });
});
