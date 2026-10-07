import {
  hashKey,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import type { PageParamFn } from './useSlidingWindowQuery.types';

export type Direction = 'next' | 'previous';

export type WindowState<TPageParam> = {
  queryHash: string;
  pageParams: TPageParam[];
};

export type PageEntry<TPage, TPageParam> = {
  pageParam: TPageParam;
  page: TPage;
};

export type PagesState<TPage, TPageParam> = {
  queryHash: string;
  pageEntries: PageEntry<TPage, TPageParam>[] | undefined;
};

/** Удаляет страницы выборок по префиксу, сохраняя все страницы текущего ключа. */
export function removeOtherQueryCaches(
  queryClient: QueryClient,
  prefix: QueryKey,
  currentQueryKey: QueryKey,
): void {
  const currentQueryHash = hashKey(currentQueryKey);

  queryClient.removeQueries({
    queryKey: [prefix],
    predicate: ({ queryKey }) =>
      Array.isArray(queryKey[0]) && hashKey(queryKey[0]) !== currentQueryHash,
  });
}

/** Расширяет список у края и обрезает противоположную сторону по лимиту. */
export function extendAtEdge<T>(
  items: T[],
  item: T,
  direction: Direction,
  maxCount: number,
): T[] {
  const extended = direction === 'next' ? [...items, item] : [item, ...items];

  if (extended.length > maxCount) {
    extended.splice(direction === 'next' ? 0 : -1, 1);
  }

  return extended;
}

export function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error('Failed to load pages.');
}

export function pageKey<TPageParam>(pageParam: TPageParam): string {
  return hashKey([pageParam]);
}

export function getQueryPageEntriesByWindow<TPage, TPageParam>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  pageParamsWindow: TPageParam[],
): PageEntry<TPage, TPageParam>[] | undefined {
  const pageEntries: PageEntry<TPage, TPageParam>[] = [];

  for (const pageParam of pageParamsWindow) {
    const page = queryClient.getQueryData<TPage>([queryKey, pageParam]);

    if (page === undefined) return undefined;

    pageEntries.push({ pageParam, page });
  }

  return pageEntries;
}

export function getWindowEdgePageParams<TPage, TPageParam>(
  pages: TPage[] | undefined,
  getNextPageParam: PageParamFn<TPage, TPageParam>,
  getPreviousPageParam: PageParamFn<TPage, TPageParam>,
) {
  if (!pages?.length) {
    return { next: undefined, previous: undefined };
  }

  return {
    next: getNextPageParam(pages.at(-1)!, pages),
    previous: getPreviousPageParam(pages[0], pages),
  };
}
